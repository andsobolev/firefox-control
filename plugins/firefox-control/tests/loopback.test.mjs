import test from "node:test";
import vm from "node:vm";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {randomBytes,randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {pipeCall} from "../server/bridge.mjs";
test("loopback authenticates, rejects web origins, and transports native requests",async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),"firefox-loopback-test-"));
 const token=randomBytes(32).toString("hex");
 await fs.writeFile(path.join(temp,"loopback.json"),JSON.stringify({port:0,token}));
 const child=spawn(process.execPath,[fileURLToPath(new URL("../server/loopback-host.mjs",import.meta.url))],{env:{...process.env,FIREFOX_CONTROL_HOME:temp},windowsHide:true});
 child.stderr.on("data",x=>process.stderr.write(x));
 try{
  const [chunk]=await once(child.stdout,"data");const port=JSON.parse(chunk.toString()).port;
  const url="http://127.0.0.1:"+port;
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+token};
  assert.equal((await fetch(url+"/health")).status,401);
  assert.equal((await fetch(url+"/health",{headers:{...headers,Origin:"https://example.com"}})).status,403);
  assert.equal((await fetch(url+"/health",{headers})).status,200);
  const clientId=randomUUID();
  const exchange=async(messages,extra={})=>{const res=await fetch(url+"/exchange",{method:"POST",headers,body:JSON.stringify({clientId,messages,...extra})});assert.equal(res.status,200);return res.json();};
  // A surviving browser connection can outlive the companion. Reject its old
  // polling/replies so it reconnects; never create a permanently unready peer.
  for(const messages of [[],[{id:"stale-result",result:{tabs:[]}}]]){
   const stale=await fetch(url+"/exchange",{method:"POST",headers,body:JSON.stringify({clientId,messages})});
   assert.equal(stale.status,409);
  }
  assert.equal((await fs.readdir(temp)).filter(x=>x.startsWith("session-")).length,0);
  let result=await exchange([{hello:true,protocol:1}]);
  for(let i=0;i<20&&!result.messages.some(m=>m.hello);i++)result=await exchange([]);
  assert.ok(result.messages.some(m=>m.hello&&m.protocol===1));
  const names=(await fs.readdir(temp)).filter(x=>x.startsWith("session-"));
  assert.equal(names.length,1);
  const session=JSON.parse(await fs.readFile(path.join(temp,names[0]),"utf8"));
  assert.equal((await pipeCall(session,"__status")).ready,true);
  const response=pipeCall(session,"list_tabs",{test:true});
  result=await exchange([]);const request=result.messages.find(m=>m.method==="list_tabs");
  assert.ok(request);
  await exchange([{id:request.id,result:{tabs:[]}}]);assert.deepEqual(await response,{tabs:[]});
  await exchange([],{disconnect:true});
  for(let i=0;i<30&&(await fs.readdir(temp)).some(x=>x.startsWith("session-"));i++)await new Promise(r=>setTimeout(r,50));
  assert.equal((await fs.readdir(temp)).filter(x=>x.startsWith("session-")).length,0);
  const runtimeListeners=[];
  const browser={runtime:{id:"{733bdf90-e75f-42d5-9b0c-0cc486bf8133}",getManifest:()=>({version:"0.3.0"}),getURL:p=>"moz-extension://test/"+p,onInstalled:{addListener(){}},onMessage:{addListener(fn){runtimeListeners.push(fn);}}},browserAction:{setBadgeText(){},setBadgeBackgroundColor(){}},storage:{local:{async get(){return {connection:{schema:1,url,token},consentVersion:1}},async set(){}}},tabs:{async query(){return [{id:77,windowId:1,url:"https://example.com/",title:"Test fixture",active:true,status:"complete"}];}}};
  let transportClientId;
  const trackedFetch=(input,init)=>{if(init?.body){const b=JSON.parse(init.body);if(!b.disconnect)transportClientId=b.clientId;}return fetch(input,init);};
  const ctx=vm.createContext({browser,fetch:trackedFetch,AbortController,AbortSignal,URL,crypto:{randomUUID},setTimeout,clearTimeout,console});
  try{
   vm.runInContext(await fs.readFile(new URL("../extension/config.js",import.meta.url),"utf8"),ctx);
   vm.runInContext(await fs.readFile(new URL("../extension/local-transport.js",import.meta.url),"utf8"),ctx);
   vm.runInContext(await fs.readFile(new URL("../extension/background.js",import.meta.url),"utf8"),ctx);
   let status;
   for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));status=await runtimeListeners[0]({type:"status"},{id:browser.runtime.id,url:browser.runtime.getURL("popup.html")});if(status.connected)break;}
   assert.equal(status.connected,true);
   const entry=(await fs.readdir(temp)).find(x=>x.startsWith("session-"));let live=JSON.parse(await fs.readFile(path.join(temp,entry),"utf8"));
   const tabs=await pipeCall(live,"list_tabs",{});assert.equal(tabs.tabs[0].tabId,77);
   // Dispose only the native peer while the real transport keeps polling.
   // The next poll must force a new handshake and recover automatically.
   await exchange([],{clientId:transportClientId,disconnect:true});
   let recovered=false;
   for(let i=0;i<50;i++){
    await new Promise(r=>setTimeout(r,100));
    const next=(await fs.readdir(temp)).find(x=>x.startsWith("session-")&&x!==entry);
    if(!next)continue;
    const candidate=JSON.parse(await fs.readFile(path.join(temp,next),"utf8"));
    if((await pipeCall(candidate,"__status")).ready){live=candidate;recovered=true;break;}
   }
   assert.equal(recovered,true,"transport must reconnect after companion loses its peer state");
   assert.equal((await pipeCall(live,"list_tabs",{})).tabs[0].tabId,77);

   await runtimeListeners[0]({type:"pause",paused:true},{id:browser.runtime.id,url:browser.runtime.getURL("popup.html")});
   await assert.rejects(pipeCall(live,"list_tabs",{},1000));
  }finally{vm.runInContext("disconnect()",ctx);}

 }finally{
  child.kill();await once(child,"exit");
  if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith("firefox-loopback-test-"))await fs.rm(temp,{recursive:true,force:true});
 }
});
