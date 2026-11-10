import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
const root=fileURLToPath(new URL("..",import.meta.url));
const fixture=http.createServer((req,res)=>{
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end(req.url==="/second" ? "<!doctype html><title>Second fixture</title><h1>Navigation verified</h1>" :
    '<!doctype html><meta charset="utf-8"><title>Firefox Control Test</title><h1>Local bridge fixture</h1><label for="q">Search query</label><input id="q"><button id="go">Apply</button><p id="result">Waiting</p><input type="password" aria-label="Secret password"><div style="height:1800px">Scroll area</div><script>document.getElementById("go").onclick=()=>{document.getElementById("result").innerText="Result: "+document.getElementById("q").value;};</script>');
});
await new Promise(resolve=>fixture.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+fixture.address().port;
const child=spawn(process.execPath,["server/mcp.mjs"],{cwd:root,windowsHide:true});
let buffer="",nextId=0;
const waiting=new Map();
child.stdout.setEncoding("utf8");
child.stdout.on("data",chunk=>{
  buffer+=chunk;let n;
  while((n=buffer.indexOf("\n"))>=0){const msg=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);waiting.get(msg.id)?.(msg);waiting.delete(msg.id);}
});
child.stderr.on("data",chunk=>process.stderr.write(chunk));
function rpc(method,params={}) {
  return new Promise((resolve,reject)=>{
    const id=++nextId,timer=setTimeout(()=>{waiting.delete(id);reject(new Error("MCP call timed out: "+method))},18000);
    waiting.set(id,msg=>{clearTimeout(timer);msg.error?reject(new Error(msg.error.message)):resolve(msg.result)});
    child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");
  });
}
let sessionId,checks=0;
async function call(name,args={},expectError=false){
  const result=await rpc("tools/call",{name:"firefox_"+name,arguments:{...args,...(sessionId?{sessionId}:{})}});
  if(expectError){assert.equal(result.isError,true);checks++;return result;}
  if(result.isError) throw new Error(result.content[0].text);
  checks++;return result.content[0].type==="image"?result:JSON.parse(result.content[0].text);
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
  await rpc("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"smoke-test",version:"1"}});
  const status=await call("status");
  sessionId=process.env.FIREFOX_TEST_SESSION || (status.sessions.length===1?status.sessions[0].sessionId:null);
  assert.ok(sessionId,"Use exactly one isolated Firefox test profile, or supply FIREFOX_TEST_SESSION.");
  const opened=await call("open_tab",{url:base+"/"});
  const tabId=opened.tabId;
  let page;
  for(let attempt=0;attempt<20;attempt++){
    await delay(200);
    try{page=await call("read_page",{tabId});if(page.title==="Firefox Control Test")break;}catch(e){if(attempt===19)throw e;}
  }
  assert.match(page.text,/Local bridge fixture/);
  assert.ok((await call("list_tabs")).tabs.some(t=>t.tabId===tabId));
  const field=page.elements.find(e=>e.label==="Search query");
  assert.ok(field);
  await call("fill",{tabId,expectedUrl:page.url,elementId:field.id,text:"Godot bridge works"});
  await call("fill",{tabId,expectedUrl:page.url,elementId:field.id,text:"stale"},true);
  page=await call("read_page",{tabId});
  const apply=page.elements.find(e=>e.label==="Apply");
  await call("click",{tabId,expectedUrl:page.url,elementId:apply.id});
  page=await call("read_page",{tabId});
  assert.match(page.text,/Result: Godot bridge works/);
  const secret=page.elements.find(e=>e.type==="password");
  await call("fill",{tabId,expectedUrl:page.url,elementId:secret.id,text:"forbidden"},true);
  await call("click",{tabId,expectedUrl:base+"/wrong",elementId:page.elements[0].id},true);
  const screenshot=await call("screenshot",{tabId,expectedUrl:page.url});
  const image=screenshot.content.find(c=>c.type==="image");
  const bytes=Buffer.from(image.data,"base64");assert.equal(bytes[0],255);assert.equal(bytes[1],216);
  await fs.mkdir(new URL("../artifacts/",import.meta.url),{recursive:true});
  await fs.writeFile(new URL("../artifacts/smoke-screenshot.jpg",import.meta.url),bytes);
  const scrolled=await call("scroll",{tabId,expectedUrl:page.url,deltaY:600});assert.ok(scrolled.scrollY>0);
  await call("navigate",{tabId,expectedUrl:page.url,url:base+"/second"});
  for(let attempt=0;attempt<20;attempt++){await delay(150);page=await call("read_page",{tabId});if(page.title==="Second fixture")break;}
  assert.equal(page.title,"Second fixture");
  await call("open_tab",{url:"file:///C:/Windows/win.ini"},true);
  const copy=await call("open_tab",{url:base+"/second"});
  for(let attempt=0;attempt<20;attempt++){
    const tabs=(await call("list_tabs")).tabs;
    if(tabs.some(t=>t.tabId===copy.tabId && t.url===base+"/second"))break;
    await delay(100);
  }
  await call("close_tab",{tabId:copy.tabId,expectedUrl:base+"/wrong",keepTabId:tabId},true);
  const closed=await call("close_tab",{tabId:copy.tabId,expectedUrl:base+"/second",keepTabId:tabId});
  assert.equal(closed.closed,true);
  const remaining=(await call("list_tabs")).tabs;
  assert.ok(remaining.some(t=>t.tabId===tabId));
  assert.ok(!remaining.some(t=>t.tabId===copy.tabId));
  await call("close_tab",{tabId,expectedUrl:base+"/second"});
  console.log(JSON.stringify({passed:true,checks,screenshot:"artifacts/smoke-screenshot.jpg"}));
} finally {
  fixture.closeAllConnections();fixture.close();child.stdin.end();await once(child,"exit");
}
