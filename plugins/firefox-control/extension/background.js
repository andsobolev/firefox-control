"use strict";
let port=null, connected=false, paused=false, connection=null, connectionError="", queue=Promise.resolve();
let retryTimer=null,retryDelay=1000;
const cancelled=new Set();
function safeUrl(value) {
  const url=new URL(value);
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Only HTTP/HTTPS pages without embedded credentials are supported.");
  return url.href;
}
async function tabFor(args) {
  if (!Number.isInteger(args.tabId)) throw new Error("Invalid tab id.");
  const tab=await browser.tabs.get(args.tabId);
  if (tab.incognito) throw new Error("Private tabs are excluded.");
  safeUrl(tab.url);
  if (args.expectedUrl && tab.url!==args.expectedUrl) throw new Error("Tab navigated. Read it again.");
  return tab;
}
const describe=tab=>({tabId:tab.id,windowId:tab.windowId,title:tab.title,url:tab.url,active:tab.active,status:tab.status,
  pinned:tab.pinned===true,audible:tab.audible===true,index:tab.index});
async function execute(method,args,guard) {
  guard();
  if (paused) throw new Error("Firefox Control is paused. Resume using the Firefox toolbar popup.");
  if (method==="list_tabs") {
    const tabs=await browser.tabs.query({});
    return {tabs:tabs.filter(t=>!t.incognito && /^https?:\/\//.test(t.url||"")).map(describe)};
  }
  if (method==="open_tab") return describe(await browser.tabs.create({url:safeUrl(args.url),active:true}));
  const tab=await tabFor(args);
  guard();
  if (method==="close_tab") {
    if (typeof args.expectedUrl!=="string" || !args.expectedUrl) throw new Error("Closing requires the exact URL from the latest tab list.");
    if (args.keepTabId!==undefined) {
      if (args.keepTabId===tab.id) throw new Error("The kept tab must be different from the closed tab.");
      await tabFor({tabId:args.keepTabId,expectedUrl:args.expectedUrl});
      // Recheck the target after awaiting the retained duplicate.
      await tabFor(args);
    }
    guard();
    await browser.tabs.remove(tab.id);
    guard();
    // Firefox may keep a tab when its beforeunload prompt is cancelled.
    const remaining=await browser.tabs.query({});
    if (remaining.some(t=>t.id===tab.id)) throw new Error("Tab is still open. Closing may have been cancelled; inspect the tab list before deciding what to do.");
    return {closed:true,tabId:tab.id,...(args.keepTabId!==undefined?{keptTabId:args.keepTabId}:{})};
  }
  if (method==="navigate") return describe(await browser.tabs.update(tab.id,{url:safeUrl(args.url)}));
  if (method==="screenshot") {
    const image=await browser.tabs.captureTab(tab.id,{format:"jpeg",quality:65});
    // Limit native messaging payloads; fail explicitly instead of truncating images.
    if (image.length>2500000) throw new Error("Screenshot too large. Reduce the Firefox window size.");
    return {url:tab.url,image:image.split(",")[1]};
  }
  if (!["read_page","click","fill","scroll"].includes(method)) throw new Error("Unsupported operation.");
  await browser.tabs.executeScript(tab.id,{file:"content.js",runAt:"document_start"});
  guard();
  return browser.tabs.sendMessage(tab.id,{channel:"firefox-control",method,args},{frameId:0});
}
function badge() {
  browser.browserAction.setBadgeText({text:paused?"OFF":connected?"ON":port?"...":"!"});
  browser.browserAction.setBadgeBackgroundColor({color:paused?"#666666":connected?"#357a38":"#b54a25"});
}
function disconnect() {
  clearTimeout(retryTimer);retryTimer=null;
  const old=port;port=null;connected=false;
  if(old)old.disconnect();
  badge();
}
function scheduleReconnect() {
  if(retryTimer || !connection || paused)return;
  retryTimer=setTimeout(()=>{retryTimer=null;connect();},retryDelay);
  retryDelay=Math.min(retryDelay*2,10000);
}
function connect() {
  if (port || !connection || paused) {badge();return;}
  connectionError="";
  connected=false;
  queue=Promise.resolve();
  let handshakeTimer;
  try {
    const current=createLoopbackPort(connection);
    port=current;
    current.onDisconnect.addListener(()=>{
      clearTimeout(handshakeTimer);
      if (port===current) {
        connectionError=current.error?.message||"Local bridge disconnected.";
        port=null; connected=false; badge();scheduleReconnect();
      }
    });
    current.onMessage.addListener(message=>{
      if (port!==current) return;
      if (message.hello===true && message.protocol===1) {
        clearTimeout(handshakeTimer);connected=true;connectionError="";retryDelay=1000;badge();return;
      }
      if (message.cancel) {cancelled.add(message.cancel);setTimeout(()=>cancelled.delete(message.cancel),20000);return;}
      if (!connected || typeof message.id!=="string" || !Number.isFinite(message.deadline)) return;
      queue=queue.then(async()=>{
        if (cancelled.delete(message.id) || message.deadline<=Date.now()) return;
        let requestFinished=false;
        try {
          const guard=()=>{
            if (requestFinished || paused || port!==current || cancelled.has(message.id) || message.deadline<=Date.now())
              throw new Error("Request paused, cancelled or expired. Read the page before retrying.");
          };
          let timer;
          const remaining=Math.max(1,Math.min(12000,message.deadline-Date.now()));
          const timeout=new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(new Error("Firefox page did not respond in time. Open the tab, then read it again before any action.")),remaining);
          });
          try {
            const result=await Promise.race([execute(message.method,{...message.args,_deadline:message.deadline},guard),timeout]);
            guard();
            if (port===current) current.postMessage({id:message.id,result});
          } finally {clearTimeout(timer);requestFinished=true;}
        } catch(error) {
          if (port===current) current.postMessage({id:message.id,error:error.message});
        }
      }).catch(()=>{});
    });
    handshakeTimer=setTimeout(()=>{
      if(port===current && !connected){
        connectionError="Local bridge did not answer within 5 seconds.";
        current.disconnect();
      }
    },5000);
    current.postMessage({hello:true,protocol:1});badge();
  } catch(error) {
    clearTimeout(handshakeTimer);
    const old=port;port=null;connected=false;connectionError=error.message;
    if(old)try{old.disconnect();}catch{}
    badge();scheduleReconnect();
  }
}
const startup=browser.storage.local.get(["paused","connection","consentVersion"]).then(state=>{
  paused=state.paused===true;
  if(state.connection && state.consentVersion===1) {
    try{connection=validateConnection(state.connection);}catch(error){connectionError=error.message;}
  }
  connect();
});
browser.runtime.onMessage.addListener(async(message,sender)=>{
  if(sender.id!==browser.runtime.id ||
     !["popup.html","options.html"].some(page=>sender.url===browser.runtime.getURL(page)))return;
  await startup;
  if(message.type==="configure"){
    if(sender.url!==browser.runtime.getURL("options.html") || message.consent!==true)
      throw new Error("Confirm access in the add-on settings.");
    const next=validateConnection(message.connection);
    disconnect();
    await browser.storage.local.set({connection:next,consentVersion:1,paused:false});
    connection=next;paused=false;retryDelay=1000;connect();
  }
  if(message.type==="forget"){
    disconnect();connection=null;paused=false;connectionError="";
    await browser.storage.local.remove(["connection","consentVersion","paused"]);badge();
  }
  if(message.type==="pause"){
    paused=!!message.paused;await browser.storage.local.set({paused});
    if(paused)disconnect();else connect();
  }
  if(message.type==="reconnect"){disconnect();retryDelay=1000;connect();}
  return {connected,connecting:!!port&&!connected,configured:!!connection,paused,error:connectionError,version:browser.runtime.getManifest().version};
});
browser.runtime.onInstalled.addListener(async details=>{
  await startup;
  if(details.reason==="install" || !connection)await browser.runtime.openOptionsPage();
});
