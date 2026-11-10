import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL,fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import {once} from "node:events";
import assert from "node:assert/strict";
const root=fileURLToPath(new URL("..",import.meta.url));
if(!process.env.WEB_EXT_MODULE)throw new Error("Set WEB_EXT_MODULE to web-ext/lib/cmd/run.js (web-ext 10.8.0).");
const run=(await import(pathToFileURL(process.env.WEB_EXT_MODULE))).default;
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"firefox-signing-smoke-"));
process.env.FIREFOX_CONTROL_HOME=path.join(temp,"state");
let runner;
const execute=async (file)=>{
  const child=spawn(process.execPath,[file],{cwd:root,env:process.env,windowsHide:true,stdio:"inherit"});
  const [code]=await once(child,"exit");assert.equal(code,0,file+" failed");
};
try{
  await execute("server/setup-loopback.mjs");
  const {ensureLoopback}=await import("../server/loopback-start.mjs");
  const {sessions}=await import("../server/bridge.mjs");
  await ensureLoopback();
  const sourceDir=path.join(temp,"extension");await fs.cp(path.join(root,"extension"),sourceDir,{recursive:true});
  // Test-only options driver. Never included in the distributed signing archive.
  const config=await fs.readFile(path.join(process.env.FIREFOX_CONTROL_HOME,"firefox-control-connection.json"),"utf8");
  await fs.writeFile(path.join(sourceDir,"test-connection.json"),config);
  await fs.appendFile(path.join(sourceDir,"options.html"),'\n<script src="test-options-driver.js"></script>\n');
  await fs.writeFile(path.join(sourceDir,"test-options-driver.js"),`
(async()=>{
  const config=await (await fetch(browser.runtime.getURL("test-connection.json"))).text();
  const data=new DataTransfer();
  data.items.add(new File([config],"firefox-control-connection.json",{type:"application/json"}));
  document.getElementById("file").files=data.files;
  document.getElementById("consent").checked=true;
  document.getElementById("pair").requestSubmit();
})();
`);
  const profile=path.join(temp,"profile");await fs.mkdir(profile);
  runner=await run({firefoxProfile:profile,keepProfileChanges:true,sourceDir,firefox:"C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    artifactsDir:path.join(temp,"artifacts"),noInput:true,noReload:true,args:["-headless"],
    pref:{"browser.shell.checkDefaultBrowser":false,"browser.startup.page":0},startUrl:["about:blank"]});
  let connected=[];
  for(let i=0;i<100;i++){connected=await sessions();if(connected.some(s=>s.status.ready))break;await new Promise(r=>setTimeout(r,250));}
  assert.equal(connected.length,1,"test options page must import and connect");
  process.env.FIREFOX_TEST_SESSION=connected[0].id;
  await execute("tests/smoke.mjs");
  console.log("Real Firefox options import and all ten tools verified.");
}finally{
  if(runner){const closed=new Promise(resolve=>runner.registerCleanup(resolve));await runner.exit();await closed;await new Promise(r=>setTimeout(r,1000));}
  try{
    const c=JSON.parse(await fs.readFile(path.join(process.env.FIREFOX_CONTROL_HOME,"loopback.json"),"utf8"));
    await fetch("http://127.0.0.1:"+c.port+"/shutdown",{method:"POST",headers:{Authorization:"Bearer "+c.token},signal:AbortSignal.timeout(2000)});
  }catch{}
  if(path.dirname(temp)===os.tmpdir()&&path.basename(temp).startsWith("firefox-signing-smoke-")){
    await fs.rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:300});
  }
}
