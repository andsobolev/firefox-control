import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {stateDir} from "./bridge.mjs";
let starting;
export async function ensureLoopback(){
 if(starting)return starting;
 starting=start().finally(()=>{starting=undefined;});return starting;
}
async function start(){
 let config;try{config=JSON.parse(await fs.readFile(path.join(stateDir,"loopback.json"),"utf8"));}catch(e){if(e.code==="ENOENT")return false;throw e;}
 if(!/^[a-f0-9]{64}$/.test(config.token)||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error("Invalid local connection configuration.");
 const health=async()=>{try{const r=await fetch("http://127.0.0.1:"+config.port+"/health",{headers:{Authorization:"Bearer "+config.token},signal:AbortSignal.timeout(500)});return r.ok&&(await r.json()).protocol===1;}catch{return false;}};
 if(await health())return true;
 const child=spawn(process.execPath,[fileURLToPath(new URL("./loopback-host.mjs",import.meta.url))],{windowsHide:true,detached:true,stdio:"ignore"});
 child.on("error",()=>{});child.unref();
 for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,200));if(await health())return true;}
 throw new Error("The local Firefox bridge could not start. Run install.ps1 again.");
}
