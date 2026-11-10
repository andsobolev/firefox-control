"use strict";
function createLoopbackPort(configuration) {
  const config=validateConnection(configuration);
  const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},emit(value){for(const fn of this.listeners)fn(value);}});
  let stopped=false,pending=[],controller;
  const clientId=crypto.randomUUID();
  const headers={"Content-Type":"application/json",Authorization:"Bearer "+config.token};
  const port={onMessage:event(),onDisconnect:event(),error:null,
    postMessage(message){if(stopped)throw new Error("Local connection closed.");pending.push(message);},
    disconnect(){
      if(stopped)return;
      stopped=true;pending=[];controller?.abort();
      fetch(config.url+"/exchange",{method:"POST",headers,body:JSON.stringify({clientId,messages:[],disconnect:true}),signal:AbortSignal.timeout(2000)}).catch(()=>{});
      port.onDisconnect.emit();
    }
  };
  async function poll(){
    while(!stopped){
      controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),4500);
      try{
        // Never replay a batch after a failed exchange: its result may be uncertain.
        const messages=pending;pending=[];
        const response=await fetch(config.url+"/exchange",{method:"POST",headers,body:JSON.stringify({clientId,messages}),signal:controller.signal});
        if(!response.ok)throw new Error("Local bridge HTTP "+response.status);
        const data=await response.json();
        if(stopped)break;
        if(!Array.isArray(data.messages)||data.messages.length>64)throw new Error("Invalid local bridge response.");
        for(const message of data.messages)port.onMessage.emit(message);
      }catch(error){
        if(!stopped){port.error={message:"Local connection unavailable. Open Codex to start the bridge."};port.disconnect();}
        break;
      }finally{clearTimeout(timer);}
    }
  }
  setTimeout(poll,0);
  return port;
}
