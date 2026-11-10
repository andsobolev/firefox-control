import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {timingSafeEqual} from "node:crypto";
import {stateDir,MAX_BYTES} from "./bridge.mjs";
const config=JSON.parse(await fs.readFile(path.join(stateDir,"loopback.json"),"utf8"));
if(!/^[a-f0-9]{64}$/.test(config.token)||!Number.isInteger(config.port)||config.port<0||config.port>65535)throw new Error("Invalid local connection configuration.");
const peers=new Map();let boundPort=config.port,lastActivity=Date.now(),closing=false;
function allowedOrigin(origin){return !origin||/^moz-extension:\/\/[a-f0-9-]+$/.test(origin);}
function authenticated(value){if(typeof value!=="string")return false;const a=Buffer.from(value),b=Buffer.from("Bearer "+config.token);return a.length===b.length&&timingSafeEqual(a,b);}
function respond(res,code,value){if(!res.destroyed)res.writeHead(code,{"Content-Type":"application/json","Cache-Control":"no-store"}).end(JSON.stringify(value));}
function dispose(id){const p=peers.get(id);if(!p)return;peers.delete(id);p.child.stdin.end();const timer=setTimeout(()=>{if(p.child.exitCode===null)p.child.kill();},1500);timer.unref();}
function getPeer(id){
 let p=peers.get(id);if(p)return p;
 if(peers.size>=4)throw new Error("Too many connected profiles.");
 const child=spawn(process.execPath,[fileURLToPath(new URL("./native-host.mjs",import.meta.url))],{windowsHide:true,stdio:["pipe","pipe","pipe"]});
 p={child,queue:[],buffer:Buffer.alloc(0),lastSeen:Date.now(),ended:false};peers.set(id,p);
 child.stdout.on("data",chunk=>{
  p.buffer=Buffer.concat([p.buffer,chunk]);
  while(p.buffer.length>=4){
   const n=p.buffer.readUInt32LE(0);if(n>MAX_BYTES){dispose(id);return;}if(p.buffer.length<n+4)break;
   try{p.queue.push(JSON.parse(p.buffer.subarray(4,n+4)));}catch{dispose(id);return;}p.buffer=p.buffer.subarray(n+4);
   if(p.queue.length>256){dispose(id);return;}
   p.wake?.();
  }
 });
 child.stderr.on("data",()=>{});
 child.on("error",()=>{p.ended=true;});
 child.on("exit",()=>{p.ended=true;if(peers.get(id)===p)peers.delete(id);});
 child.stdin.on("error",()=>{p.ended=true;});
 return p;
}
const server=http.createServer(async(req,res)=>{
 if(req.headers.host!=="127.0.0.1:"+boundPort||!allowedOrigin(req.headers.origin))return respond(res,403,{error:"Origin rejected"});
 if(req.method==="OPTIONS"){
  if(req.headers.origin)res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
  res.setHeader("Access-Control-Allow-Methods","GET, POST");res.setHeader("Access-Control-Allow-Headers","authorization, content-type");
  return res.writeHead(204).end();
 }
 if(!authenticated(req.headers.authorization))return respond(res,401,{error:"Unauthorized"});
 lastActivity=Date.now();
 if(req.url==="/health"&&req.method==="GET")return respond(res,200,{protocol:1,hostTime:Date.now(),profiles:[...peers.values()].map(p=>({lastSeen:p.lastSeen,diagnostic:p.diagnostic}))});
 if(req.url==="/shutdown"&&req.method==="POST"){respond(res,200,{stopping:true});setTimeout(stop,50);return;}
 if(req.url!=="/exchange"||req.method!=="POST")return respond(res,404,{error:"Unknown endpoint"});
 try{
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>MAX_BYTES){respond(res,413,{error:"Request too large"});req.destroy();return;}parts.push(part);}
  const body=JSON.parse(Buffer.concat(parts).toString("utf8"));
  if(!/^[a-f0-9-]{36}$/.test(body.clientId)||!Array.isArray(body.messages)||body.messages.length>64)throw new Error("Invalid exchange");
  if(body.disconnect===true){dispose(body.clientId);return respond(res,200,{messages:[]});}
  if(!peers.has(body.clientId)&&!body.messages.some(m=>m?.hello===true&&m.protocol===1))
   return respond(res,409,{error:"Connection expired; reconnect with a fresh handshake."});
  const p=getPeer(body.clientId);p.lastSeen=Date.now();
  if(body.diagnostic&&typeof body.diagnostic==="object")p.diagnostic={browserTime:Number(body.diagnostic.browserTime),receivedTotal:Number(body.diagnostic.receivedTotal),sentTotal:Number(body.diagnostic.sentTotal),lastMethod:["list_tabs","read_page","open_tab","navigate","click","fill","scroll","screenshot"].includes(body.diagnostic.lastMethod)?body.diagnostic.lastMethod:"",lastDeadline:Number(body.diagnostic.lastDeadline)};
  if(p.ended)throw new Error("Local bridge disconnected");
  for(const msg of body.messages){
   if(!msg||typeof msg!=="object"||Array.isArray(msg)||(!msg.hello&&typeof msg.id!=="string"))throw new Error("Invalid message");
   const data=Buffer.from(JSON.stringify(msg)),header=Buffer.alloc(4);header.writeUInt32LE(data.length);
   p.child.stdin.write(Buffer.concat([header,data]));
  }
  if(p.queue.length===0)await new Promise(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);p.wake=null;resolve();}p.wake=done;});
  respond(res,200,{messages:p.queue.splice(0,64)});
 }catch(e){respond(res,400,{error:e.message});}
});
server.on("error",e=>{console.error(e.code||e.message);process.exitCode=1;});
server.listen(config.port,"127.0.0.1",()=>{boundPort=server.address().port;console.log(JSON.stringify({ready:true,port:boundPort}));});
const timer=setInterval(()=>{
 for(const [id,p]of peers)if(Date.now()-p.lastSeen>15000)dispose(id);
 if(Date.now()-lastActivity>10*60*1000)stop();
},5000);timer.unref();
function stop(){if(closing)return;closing=true;clearInterval(timer);for(const id of peers.keys())dispose(id);server.closeAllConnections();server.close();}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
