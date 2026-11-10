import test from "node:test";
import assert from "node:assert/strict";
import {planDuplicateTabs} from "../server/dedupe.mjs";

test("duplicate planning preserves exact URL distinctions and the active copy",()=>{
  const tabs=[
    {tabId:1,url:"https://example.com/?q=1#part",pinned:true},
    {tabId:2,url:"https://example.com/?q=1#part",active:true},
    {tabId:3,url:"https://example.com/?q=1#part"},
    {tabId:4,url:"https://example.com/?q=2#part"},
    {tabId:5,url:"https://example.com/?q=1#other"},
    {tabId:6,url:"http://example.com/?q=1#part"},
    {tabId:7,url:"https://example.com/?q=1#part",incognito:true},
    {tabId:8,url:"about:blank"},{tabId:9,url:"about:blank"}
  ];
  const plan=planDuplicateTabs(tabs);
  assert.deepEqual(plan,[
    {tabId:1,expectedUrl:tabs[0].url,keepTabId:2},
    {tabId:3,expectedUrl:tabs[0].url,keepTabId:2}
  ]);
  const closed=new Set(plan.map(t=>t.tabId));
  assert.deepEqual(planDuplicateTabs(tabs.filter(t=>!closed.has(t.tabId))),[]);
});

test("fallback selection keeps pinned, then audible, then first tabs",()=>{
  const tabs=[
    {tabId:1,url:"https://example.com/a"},{tabId:2,url:"https://example.com/a",pinned:true},
    {tabId:3,url:"https://example.com/b"},{tabId:4,url:"https://example.com/b",audible:true},
    {tabId:5,url:"https://example.com/c"},{tabId:6,url:"https://example.com/c"},
    {tabId:7,url:"https://user:pass@example.com/"},{tabId:8,url:"https://user:pass@example.com/"}
  ];
  assert.deepEqual(planDuplicateTabs(tabs).map(p=>[p.tabId,p.keepTabId]),[[1,2],[3,4],[6,5]]);
});
