import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { randomUUID } from "node:crypto";

export const stateDir = process.env.FIREFOX_CONTROL_HOME ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "FirefoxControl");
export const MAX_BYTES = 4 * 1024 * 1024;
export const TIMEOUT = 15000;

export function pipeCall(session, method, args = {}, timeout = TIMEOUT, signal) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(session.pipe);
    let data = Buffer.alloc(0), done = false;
    const finish = (err, value) => {
      if (done) return;
      done = true; clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      socket.destroy();
      err ? reject(err) : resolve(value);
    };
    const abort = () => finish(new Error("Cancelled. If an action had started, read the page before retrying."));
    const timer = setTimeout(() => finish(new Error("Firefox timed out. Read the page before retrying an action.")), timeout);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    socket.on("error", e => finish(new Error("Firefox bridge unavailable: " + e.code)));
    socket.on("end", () => { if (!done) finish(new Error("Firefox bridge disconnected.")); });
    socket.on("connect", () => socket.write(JSON.stringify({
      id:randomUUID(), token:session.token, method, args, deadline:Date.now()+timeout
    })+"\n"));
    socket.on("data", chunk => {
      data = Buffer.concat([data,chunk]);
      if (data.length > MAX_BYTES) return finish(new Error("Firefox response is too large."));
      const index = data.indexOf(10);
      if (index < 0) return;
      try {
        const message = JSON.parse(data.subarray(0,index).toString("utf8"));
        if (message.error) finish(new Error(message.error));
        else finish(null,message.result);
      } catch { finish(new Error("Invalid response from Firefox bridge.")); }
    });
  });
}
export async function sessions() {
  let names;
  try { names = await fs.readdir(stateDir); } catch (e) {
    if (e.code==="ENOENT") return [];
    throw e;
  }
  const candidates = names.filter(n=>/^session-[a-f0-9-]+\.json$/.test(n));
  const found = await Promise.all(candidates.map(async name=>{
    try {
      const session=JSON.parse(await fs.readFile(path.join(stateDir,name),"utf8"));
      const status=await pipeCall(session,"__status",{},800);
      return {...session,status};
    } catch { return null; }
  }));
  return found.filter(Boolean);
}
export async function request(method, args = {}, signal) {
  const available=await sessions();
  const {sessionId,...params}=args;
  const matching=sessionId ? available.filter(s=>s.id===sessionId) : available;
  if (!matching.length) throw new Error("Firefox is not connected. Install the signed companion extension, import the local connection file in its settings, and resume access. Allow a few seconds for reconnection.");
  if (matching.length!==1) throw new Error("Multiple Firefox profiles are connected. Use firefox_status and supply its sessionId.");
  return pipeCall(matching[0],method,params,TIMEOUT,signal);
}
