// Authorized local CLI counterpart to firefox_close_tab. No URLs or titles are logged.
import {request} from "../server/bridge.mjs";
import {ensureLoopback} from "../server/loopback-start.mjs";
import {validate} from "../server/tools.mjs";
import {planDuplicateTabs} from "../server/dedupe.mjs";

const argv=process.argv.slice(2);
let sessionId,apply=false;
for(let i=0;i<argv.length;i++) {
  if(argv[i]==="--apply")apply=true;
  else if(argv[i]==="--session" && argv[i+1])sessionId=argv[++i];
  else throw new Error("Usage: node scripts/deduplicate-tabs.mjs [--session ID] [--apply]");
}
const call=(method,args={})=>{
  const checked=validate("firefox_"+method,{...args,...(sessionId?{sessionId}:{})});
  return request(method,checked);
};
await ensureLoopback();
const before=await call("list_tabs");
const plan=planDuplicateTabs(before.tabs);
console.log(JSON.stringify({mode:apply?"apply":"preview",tabs:before.tabs.length,
  duplicateGroups:new Set(plan.map(p=>p.expectedUrl)).size,extraCopies:plan.length}));
if(apply) {
  let closed=0;
  try {
    for(const action of plan) {
      const result=await call("close_tab",action);
      if(result.closed!==true)throw new Error("Closure was not confirmed.");
      closed++;
    }
    const after=await call("list_tabs");
    const remaining=planDuplicateTabs(after.tabs).length;
    const retainedMissing=new Set(plan.map(p=>p.expectedUrl));
    for(const tab of after.tabs)retainedMissing.delete(tab.url);
    console.log(JSON.stringify({closed,remainingTabs:after.tabs.length,remainingDuplicates:remaining,missingRetainedAddresses:retainedMissing.size}));
    if(remaining || retainedMissing.size)process.exitCode=1;
  } catch(error) {
    console.error(JSON.stringify({closed,error:error.message,stopped:true,
      nextStep:"Inspect the current tab list. No action was automatically retried."}));
    process.exitCode=1;
  }
}
