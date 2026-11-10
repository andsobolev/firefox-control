import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const configCode=await fs.readFile(new URL("../extension/config.js",import.meta.url),"utf8");
const backgroundCode=await fs.readFile(new URL("../extension/background.js",import.meta.url),"utf8");
const connection={schema:1,url:"http://127.0.0.1:4567",token:"a".repeat(64)};
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn)},emit(...args){for(const fn of this.listeners)fn(...args)}});
async function harness(t,state={},tabs={}) {
  const ports=[],messages=event(),installed=event();
  const browser={
    runtime:{id:"{733bdf90-e75f-42d5-9b0c-0cc486bf8133}",getManifest:()=>({version:"0.3.0"}),getURL:p=>"moz-extension://test/"+p,onMessage:messages,onInstalled:installed,async openOptionsPage(){}},
    browserAction:{setBadgeText(){},setBadgeBackgroundColor(){}},
    storage:{local:{async get(){return structuredClone(state)},async set(v){Object.assign(state,structuredClone(v))},async remove(keys){for(const k of keys)delete state[k]}}},
    tabs
  };
  const ctx=vm.createContext({browser,URL,setTimeout,clearTimeout,console,createLoopbackPort(value){
    assert.equal(value.url,connection.url);
    const p={sent:[],onDisconnect:event(),onMessage:event(),postMessage(m){this.sent.push(m)},disconnect(){this.onDisconnect.emit()}};
    ports.push(p);return p;
  }});
  vm.runInContext(configCode,ctx);vm.runInContext(backgroundCode,ctx);
  const send=(message={type:"status"},page="options.html")=>messages.listeners[0](message,{id:browser.runtime.id,url:browser.runtime.getURL(page)});
  t.after(()=>vm.runInContext("disconnect()",ctx));
  await send();
  return {ports,send,state,browser,messages,ctx};
}
test("pairing requires local endpoint and explicit consent; persists across background restarts",async t=>{
  const state={},a=await harness(t,state);
  assert.equal(a.ports.length,0);
  await assert.rejects(a.send({type:"configure",connection,consent:false}),/Confirm access/);
  for(const url of ["https://127.0.0.1:4567","http://example.com:4567","http://127.0.0.1:65536","http://127.0.0.1:0","http://127.0.0.1:4567/path"]){
    await assert.rejects(a.send({type:"configure",connection:{...connection,url},consent:true}),/connection JSON/);
  }
  const rejected=await a.messages.listeners[0]({type:"configure",connection,consent:true},{id:a.browser.runtime.id,url:"https://example.com/",tab:{id:1}});
  assert.equal(rejected,undefined);assert.equal(a.ports.length,0);
  await assert.rejects(a.send({type:"configure",connection,consent:true},"popup.html"),/Confirm access/);
  assert.equal((await a.send({type:"configure",connection,consent:true})).configured,true);
  assert.equal(state.connection.token,connection.token);
  assert.equal(JSON.stringify(await a.send()).includes(connection.token),false,"status never exposes the key");
  vm.runInContext("disconnect()",a.ctx);
  const b=await harness(t,state);
  assert.equal(b.ports.length,1,"restored storage reconnects without setup");
  await b.send({type:"pause",paused:true});
  const c=await harness(t,state);
  assert.equal(c.ports.length,0,"pause survives restart");
  await c.send({type:"pause",paused:false});
  assert.equal(c.ports.length,1);
  await c.send({type:"forget"});
  assert.equal((await c.send()).configured,false);assert.equal(state.connection,undefined);
});
test("connection waits for acknowledgement and reconnects without replaying requests",async t=>{
  let opens=0;
  const h=await harness(t,{connection,consentVersion:1},{async create(){opens++;return {id:7,url:"https://example.com/"}}});
  assert.equal((await h.send()).connected,false);assert.equal((await h.send()).connecting,true);
  h.ports[0].onMessage.emit({hello:true,protocol:1});
  assert.equal((await h.send()).connected,true);
  h.ports[0].onMessage.emit({id:"once",method:"open_tab",args:{url:"https://example.com/"},deadline:Date.now()+5000});
  await new Promise(r=>setTimeout(r,20));assert.equal(opens,1);
  h.ports[0].error={message:"Disconnected"};h.ports[0].disconnect();
  assert.equal((await h.send()).connected,false);
  await new Promise(r=>setTimeout(r,1100));
  assert.equal(h.ports.length,2);
  h.ports[0].onMessage.emit({hello:true,protocol:1});
  assert.equal((await h.send()).connected,false,"ignore old connection");
  h.ports[1].onMessage.emit({hello:true,protocol:1});
  assert.equal((await h.send()).connected,true);
  assert.equal(opens,1,"reconnection never repeats a browser action");
  assert.deepEqual(h.ports[1].sent.map(m=>Object.keys(m).sort().join(",")),["hello,protocol"]);
});
test("hung script expires without blocking the queue or executing a late click",async t=>{
  let releaseInjection,injections=0,clickMessages=0;
  const h=await harness(t,{connection,consentVersion:1},{
    async get(){return {id:250,url:"https://example.com/",incognito:false}},
    async query(){return [{id:250,url:"https://example.com/",incognito:false},{id:251,url:"https://private.example/",incognito:true}]},
    executeScript(id,args){assert.equal(args.file,"content.js");injections++;return new Promise(r=>{releaseInjection=r})},
    async sendMessage(){clickMessages++}
  });
  const p=h.ports[0];p.onMessage.emit({hello:true,protocol:1});
  p.onMessage.emit({id:"hung",method:"click",args:{tabId:250,expectedUrl:"https://example.com/",elementId:"observed"},deadline:Date.now()+60});
  p.onMessage.emit({id:"list",method:"list_tabs",args:{},deadline:Date.now()+1000});
  await new Promise(r=>setTimeout(r,120));
  assert.match(p.sent.find(m=>m.id==="hung").error,/did not respond in time/);
  assert.equal(p.sent.find(m=>m.id==="list").result.tabs.length,1);
  releaseInjection([]);await new Promise(r=>setTimeout(r,20));
  assert.equal(injections,1);assert.equal(clickMessages,0,"expired injection cannot trigger a click");
  assert.equal(p.sent.filter(m=>m.id==="hung").length,1);
});

test("closing requires an unchanged public tab and preserves the selected duplicate",async t=>{
  const records=new Map([
    [1,{id:1,url:"https://example.com/?q=one#part",incognito:false}],
    [2,{id:2,url:"https://example.com/?q=one#part",incognito:false}],
    [3,{id:3,url:"https://example.com/?q=two#part",incognito:false}],
    [4,{id:4,url:"https://example.com/?q=one#part",incognito:true}],
    [5,{id:5,url:"about:config",incognito:false}]
  ]);
  const removed=[];
  const h=await harness(t,{connection,consentVersion:1},{
    async get(id){if(!records.has(id))throw new Error("No such tab");return {...records.get(id)}},
    async query(){return [...records.values()]},
    async remove(id){removed.push(id);records.delete(id)}
  });
  const p=h.ports[0];p.onMessage.emit({hello:true,protocol:1});
  let n=0;
  const close=async args=>{
    const id="close-"+(++n);
    p.onMessage.emit({id,method:"close_tab",args,deadline:Date.now()+2000});
    await vm.runInContext("queue",h.ctx);
    return p.sent.find(m=>m.id===id);
  };
  for(const args of [
    {tabId:1},
    {tabId:1,expectedUrl:"https://example.com/"},
    {tabId:1,expectedUrl:records.get(1).url,keepTabId:1},
    {tabId:1,expectedUrl:records.get(1).url,keepTabId:3},
    {tabId:1,expectedUrl:records.get(1).url,keepTabId:99},
    {tabId:1,expectedUrl:records.get(1).url,keepTabId:4},
    {tabId:4,expectedUrl:records.get(4).url},
    {tabId:5,expectedUrl:"about:config"}
  ])assert.ok((await close(args)).error);
  assert.deepEqual(removed,[]);
  const result=await close({tabId:1,expectedUrl:records.get(1).url,keepTabId:2});
  assert.equal(result.result.closed,true);
  assert.deepEqual(removed,[1]);assert.ok(records.has(2));
});

test("cancelled close is not reported as success and cancelled requests never close a tab",async t=>{
  let removes=0;
  const tab={id:1,url:"https://example.com/",incognito:false};
  const h=await harness(t,{connection,consentVersion:1},{
    async get(){return {...tab}},async query(){return [tab]},async remove(){removes++}
  });
  const p=h.ports[0];p.onMessage.emit({hello:true,protocol:1});
  const args={tabId:1,expectedUrl:tab.url};
  p.onMessage.emit({cancel:"cancelled"});
  p.onMessage.emit({id:"cancelled",method:"close_tab",args,deadline:Date.now()+2000});
  p.onMessage.emit({id:"expired",method:"close_tab",args,deadline:Date.now()-1});
  await vm.runInContext("queue",h.ctx);assert.equal(removes,0);
  p.onMessage.emit({id:"blocked",method:"close_tab",args,deadline:Date.now()+2000});
  await vm.runInContext("queue",h.ctx);
  assert.match(p.sent.find(m=>m.id==="blocked").error,/still open/);
  assert.equal(removes,1);
});

test("a close queued behind a slow tab lookup cannot run after its deadline",async t=>{
  let release,removes=0;
  const h=await harness(t,{connection,consentVersion:1},{
    get(){return new Promise(resolve=>{release=resolve})},
    async remove(){removes++},async query(){return []}
  });
  const p=h.ports[0];p.onMessage.emit({hello:true,protocol:1});
  p.onMessage.emit({id:"slow-close",method:"close_tab",args:{tabId:1,expectedUrl:"https://example.com/"},deadline:Date.now()+50});
  await new Promise(r=>setTimeout(r,100));
  assert.match(p.sent.find(m=>m.id==="slow-close").error,/did not respond in time/);
  release({id:1,url:"https://example.com/",incognito:false});
  await new Promise(r=>setTimeout(r,20));assert.equal(removes,0);
});
