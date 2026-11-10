import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { stateDir, MAX_BYTES, TIMEOUT } from "./bridge.mjs";

const id=randomUUID(), token=randomBytes(32).toString("hex");
fs.mkdirSync(stateDir,{recursive:true,mode:0o700});
const pipe=process.platform==="win32" ? "\\\\.\\pipe\\firefox-control-"+id : path.join(stateDir,id+".sock");
const stateFile=path.join(stateDir,"session-"+id+".json");
const pending=new Map(), clients=new Set();
let buffer=Buffer.alloc(0), ready=false, closing=false;
const startedAt=new Date().toISOString();
function send(message) {
  const body=Buffer.from(JSON.stringify(message));
  if (body.length>1024*1024) throw new Error("Native request too large.");
  const length=Buffer.alloc(4); length.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([length,body]));
}
function reply(socket,message) { if (!socket.destroyed) socket.end(JSON.stringify(message)+"\n"); }
function failPending(message) {
  for (const [requestId,item] of pending) {
    clearTimeout(item.timer); reply(item.socket,{error:message}); pending.delete(requestId);
  }
}
function cleanup() {
  if (closing) return; closing=true;
  failPending("Firefox disconnected. Check page state before retrying.");
  for (const client of clients) client.destroy();
  server.close();
  try { fs.unlinkSync(stateFile); } catch {}
  if (process.platform!=="win32") { try { fs.unlinkSync(pipe); } catch {} }
}
function validToken(value) {
  if (typeof value!=="string") return false;
  const input=Buffer.from(value), expected=Buffer.from(token);
  return input.length===expected.length && timingSafeEqual(input,expected);
}
const server=net.createServer(socket=>{
  clients.add(socket); socket.setTimeout(TIMEOUT,()=>socket.destroy());
  let input=Buffer.alloc(0), received=false, requestId;
  socket.on("error",()=>{});
  socket.on("close",()=>{
    clients.delete(socket);
    if (requestId && pending.has(requestId)) {
      clearTimeout(pending.get(requestId).timer); pending.delete(requestId);
      try { send({cancel:requestId}); } catch {}
    }
  });
  socket.on("data",chunk=>{
    if (received) return;
    input=Buffer.concat([input,chunk]);
    if (input.length>128*1024) return socket.destroy();
    const end=input.indexOf(10); if (end<0) return;
    received=true;
    try {
      const message=JSON.parse(input.subarray(0,end).toString("utf8"));
      if (!validToken(message.token)) return reply(socket,{error:"Unauthorized bridge client."});
      if (message.method==="__status") return reply(socket,{result:{ready,startedAt}});
      if (!ready) return reply(socket,{error:"Firefox extension is not ready."});
      if (typeof message.method!=="string" || !Number.isFinite(message.deadline) || message.deadline<=Date.now())
        return reply(socket,{error:"Invalid or expired request."});
      requestId=randomUUID();
      const deadline=Math.min(message.deadline,Date.now()+TIMEOUT);
      const timer=setTimeout(()=>{
        pending.delete(requestId); send({cancel:requestId});
        reply(socket,{error:"Firefox timed out. Check the page before retrying."});
      },deadline-Date.now());
      pending.set(requestId,{socket,timer});
      send({id:requestId,method:message.method,args:message.args,deadline});
    } catch { reply(socket,{error:"Invalid bridge request."}); }
  });
});
server.on("error",error=>{console.error(error.message); cleanup(); process.exitCode=1; process.stdin.destroy();});
server.listen(pipe,()=>{
  fs.writeFileSync(stateFile,JSON.stringify({id,token,pipe,pid:process.pid,startedAt}),{mode:0o600});
});
process.stdin.on("data",chunk=>{
  buffer=Buffer.concat([buffer,chunk]);
  while (buffer.length>=4) {
    const size=buffer.readUInt32LE(0);
    if (size>MAX_BYTES) { cleanup(); process.exit(1); }
    if (buffer.length<size+4) break;
    try {
      const message=JSON.parse(buffer.subarray(4,4+size).toString("utf8"));
      if (message.hello===true) { ready=true; send({hello:true,protocol:1,version:"0.1.2"}); }
      else if (pending.has(message.id)) {
        const item=pending.get(message.id); pending.delete(message.id);
        clearTimeout(item.timer);
        reply(item.socket,message.error ? {error:String(message.error).slice(0,1000)} : {result:message.result});
      }
    } catch { cleanup(); process.exit(1); }
    buffer=buffer.subarray(size+4);
  }
});
process.stdin.on("end",()=>{cleanup();process.exit(0);});
process.stdin.on("error",()=>{cleanup();process.exit(1);});
process.stdout.on("error",()=>{cleanup();process.exit(1);});
process.on("SIGTERM",()=>{cleanup();process.exit(0);});
process.on("SIGINT",()=>{cleanup();process.exit(0);});
process.on("exit",cleanup);
