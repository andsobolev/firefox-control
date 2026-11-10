// Exact URL matching only: query strings, fragments and schemes stay distinct.
export function planDuplicateTabs(tabs) {
  const groups=new Map();
  for (const tab of tabs) {
    if (tab.incognito || !Number.isInteger(tab.tabId) || typeof tab.url!=="string") continue;
    let url;
    try { url=new URL(tab.url); } catch { continue; }
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password) continue;
    if (!groups.has(tab.url)) groups.set(tab.url,[]);
    groups.get(tab.url).push(tab);
  }
  const rank=tab=>(tab.active?4:0)+(tab.pinned?2:0)+(tab.audible?1:0);
  const plan=[];
  for (const group of groups.values()) {
    if (group.length<2) continue;
    const keep=group.reduce((best,tab)=>rank(tab)>rank(best)?tab:best);
    for (const tab of group) if (tab.tabId!==keep.tabId)
      plan.push({tabId:tab.tabId,expectedUrl:tab.url,keepTabId:keep.tabId});
  }
  return plan;
}
