import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import {randomBytes} from "node:crypto";
import {stateDir} from "./bridge.mjs";
const configFile=path.join(stateDir,"loopback.json");
await fs.mkdir(stateDir,{recursive:true});
let config;try{config=JSON.parse(await fs.readFile(configFile,"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
if(!config){
  const s=net.createServer();
  await new Promise((resolve,reject)=>{s.once("error",reject);s.listen(0,"127.0.0.1",resolve)});
  const port=s.address().port;await new Promise(r=>s.close(r));
  config={port,token:randomBytes(32).toString("hex")};
  await fs.writeFile(configFile,JSON.stringify(config),{mode:0o600});
}
if(!/^[a-f0-9]{64}$/.test(config.token)||!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error("Invalid local connection configuration.");
const target=path.join(stateDir,"firefox-control-connection.json");
await fs.writeFile(target,JSON.stringify({schema:1,url:"http://127.0.0.1:"+config.port,token:config.token},null,2)+"\n",{mode:0o600});
console.log("Connection file (import locally in the Firefox add-on settings): "+target);
console.log("Do not upload or share this file. It is not part of the signing package.");
