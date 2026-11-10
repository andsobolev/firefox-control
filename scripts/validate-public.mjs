import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("..",import.meta.url));
const plugin=path.join(root,"plugins/firefox-control");
const json=async name=>JSON.parse(await fs.readFile(name,"utf8"));
const [manifest,compat,addon,pkg,catalog,mcp]=await Promise.all([
  json(path.join(plugin,"plugin.json")),json(path.join(plugin,".codex-plugin/plugin.json")),
  json(path.join(plugin,"extension/manifest.json")),json(path.join(plugin,"package.json")),
  json(path.join(root,".agents/plugins/marketplace.json")),json(path.join(plugin,"mcp.json"))
]);
assert.equal(manifest.name,"firefox-control");
assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
assert.equal(manifest.version,compat.version);assert.equal(manifest.version,addon.version);assert.equal(manifest.version,pkg.version);
assert.equal(addon.browser_specific_settings.gecko.id,"{733bdf90-e75f-42d5-9b0c-0cc486bf8133}");
assert.equal(addon.incognito,"not_allowed");
assert.deepEqual(addon.permissions,["tabs","storage","<all_urls>"]);
assert.equal(manifest.$schema,"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
assert.equal(mcp.mcpServers[manifest.name].type,"stdio");
assert.ok(mcp.mcpServers[manifest.name].args[0].startsWith("${PLUGIN_ROOT}/"));
assert.equal(catalog.plugins[0].source.path,"./plugins/firefox-control");
assert.equal(manifest.extensions["com.openai"].requires_local_executor,true);
const ui=manifest.extensions["com.openai"].interface;
assert.ok(ui.displayName.length<=30 && ui.shortDescription.length<=30);
assert.equal(ui.category,"Productivity");
assert.deepEqual(ui,compat.interface);
const forbidden=/^(?:loopback\.json|firefox-control-connection\.json|session-.*\.json|local-connection\.js|test-connection\.json|test-options-driver\.js)$/;
let privateToken;
try {privateToken=(await json(path.join(process.env.LOCALAPPDATA,"FirefoxControl/loopback.json"))).token;} catch(error){if(error.code!=="ENOENT")throw error;}
let files=0;
async function inspect(folder){
 for(const entry of await fs.readdir(folder,{withFileTypes:true})){
  if([".git","dist","artifacts","node_modules"].includes(entry.name))continue;
  assert.equal(entry.isSymbolicLink(),false,"Symbolic link in release source");
  const name=path.join(folder,entry.name);
  if(entry.isDirectory()){await inspect(name);continue;}
  assert.equal(forbidden.test(entry.name),false,"Private or generated fixture file in package");
  const text=await fs.readFile(name,"utf8");
  if(privateToken)assert.equal(text.includes(privateToken),false,"Local secret detected");
  if(process.env.USERPROFILE) {
   for(const personal of [process.env.USERPROFILE,process.env.USERPROFILE.replaceAll("\\","/"),process.env.USERPROFILE.replaceAll("\\","\\\\")])
    assert.equal(text.includes(personal),false,"Personal absolute path detected");
  }
  if(entry.name.endsWith(".json"))JSON.parse(text);
  files++;
 }
}
await inspect(root);
console.log(JSON.stringify({valid:true,version:manifest.version,files,identityPreserved:true,privateDataScan:"passed"}));
