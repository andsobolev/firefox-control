import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate,tools } from "../server/tools.mjs";
import { pipeCall } from "../server/bridge.mjs";
const root=fileURLToPath(new URL("..",import.meta.url));
const delay=ms=>new Promise(r=>setTimeout(r,ms));

test("tool validation rejects unsafe URLs, invalid ids, oversized text and unexpected fields",()=>{
  assert.equal(tools.length,10);
  assert.throws(()=>validate("firefox_open_tab",{url:"file:///secret"}));
  assert.throws(()=>validate("firefox_open_tab",{url:"https://user:pass@example.com"}));
  assert.throws(()=>validate("firefox_read_page",{tabId:-1}));
  assert.throws(()=>validate("firefox_read_page",{tabId:1,eval:"document.cookie"}));
  assert.throws(()=>validate("firefox_fill",{tabId:1,expectedUrl:"https://example.com",elementId:"x",text:"x".repeat(20001)}));
  assert.throws(()=>validate("firefox_click",{tabId:1}));
  assert.throws(()=>validate("firefox_close_tab",{tabId:1}));
  assert.throws(()=>validate("firefox_close_tab",{tabId:1,expectedUrl:"about:config"}));
  assert.throws(()=>validate("firefox_close_tab",{tabId:1,expectedUrl:"https://example.com/",keepTabId:1}));
  assert.doesNotThrow(()=>validate("firefox_close_tab",{tabId:1,expectedUrl:"https://example.com/",keepTabId:2}));
  assert.equal(tools.find(t=>t.name==="firefox_close_tab").annotations.destructiveHint,true);
  assert.doesNotThrow(()=>validate("firefox_fill",{tabId:1,expectedUrl:"https://example.com",elementId:"x",text:""}));
});

test("MCP handshake, discovery, errors, and disconnected status",async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"firefox-control-test-"));
  const child=spawn(process.execPath,["server/mcp.mjs"],{cwd:root,env:{...process.env,FIREFOX_CONTROL_HOME:temp},windowsHide:true});
  let buffer="";const pending=new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data",chunk=>{
    buffer+=chunk;let i;
    while((i=buffer.indexOf("\n"))>=0){
      const message=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);
      pending.get(message.id)?.(message);pending.delete(message.id);
    }
  });
  let id=0;
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>reject(new Error("MCP timeout")),3000);
    pending.set(key,value=>{clearTimeout(timer);resolve(value)});
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:key,method,params})+"\n");
  });
  try {
    const initialized=await call("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"test",version:"1"}});
    assert.equal(initialized.result.protocolVersion,"2025-11-25");
    assert.equal((await call("tools/list")).result.tools.length,10);
    assert.equal((await call("ping")).result.constructor,Object);
    const status=await call("tools/call",{name:"firefox_status",arguments:{}});
    assert.deepEqual(JSON.parse(status.result.content[0].text).sessions,[]);
    assert.equal((await call("tools/call",{name:"firefox_open_tab",arguments:{url:"javascript:alert(1)"}})).result.isError,true);
    assert.equal((await call("tools/call",{name:"firefox_list_tabs",arguments:{}})).result.isError,true);
    assert.equal((await call("unknown")).error.code,-32601);
  } finally {
    child.stdin.end();await once(child,"exit");
    if(path.dirname(temp)===os.tmpdir() && path.basename(temp).startsWith("firefox-control-test-"))
      await fs.rm(temp,{recursive:true,force:true});
  }
});

test("native framing, local authentication, response correlation, and cleanup",async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),"firefox-control-test-"));
  const child=spawn(process.execPath,["server/native-host.mjs"],{cwd:root,env:{...process.env,FIREFOX_CONTROL_HOME:temp},windowsHide:true});
  const send=value=>{
    const body=Buffer.from(JSON.stringify(value)),prefix=Buffer.alloc(4);prefix.writeUInt32LE(body.length);
    child.stdin.write(prefix.subarray(0,2));child.stdin.write(Buffer.concat([prefix.subarray(2),body]));
  };
  child.stderr.on("data",chunk=>process.stderr.write(chunk));
  let input=Buffer.alloc(0), acknowledged=false;
  child.stdout.on("data",chunk=>{
    input=Buffer.concat([input,chunk]);
    while(input.length>=4 && input.length>=4+input.readUInt32LE(0)){
      const size=input.readUInt32LE(0),msg=JSON.parse(input.subarray(4,4+size));input=input.subarray(4+size);
      if(msg.hello===true && msg.protocol===1) acknowledged=true;
      if(msg.id) send({id:msg.id,result:{echo:msg.args,method:msg.method}});
    }
  });
  try {
    send({hello:true});
    let session;
    for(let i=0;i<60;i++){
      const names=await fs.readdir(temp);
      if(names.some(n=>n.endsWith(".json"))){session=JSON.parse(await fs.readFile(path.join(temp,names.find(n=>n.endsWith(".json"))),"utf8"));break;}
      await delay(50);
    }
    assert.ok(session);
    for(let i=0;i<60 && !acknowledged;i++) await delay(20);
    assert.equal(acknowledged,true);
    assert.equal((await pipeCall(session,"__status")).ready,true);
    await assert.rejects(pipeCall({...session,token:"wrong"},"list_tabs"),/Unauthorized/);
    const replies=await Promise.all([pipeCall(session,"one",{value:"A"}),pipeCall(session,"two",{value:"B"})]);
    assert.deepEqual(replies,[{echo:{value:"A"},method:"one"},{echo:{value:"B"},method:"two"}]);
  } finally {
    child.stdin.end();await once(child,"exit");
    assert.equal((await fs.readdir(temp)).length,0);
    if(path.dirname(temp)===os.tmpdir() && path.basename(temp).startsWith("firefox-control-test-"))
      await fs.rm(temp,{recursive:true,force:true});
  }
});
