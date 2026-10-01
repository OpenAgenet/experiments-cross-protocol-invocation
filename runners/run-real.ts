import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { assertRealManifest, protocolRoute } from "./real-client.ts";
import { integrationSummary } from "./core-integration.ts";

const experimentRoot = path.resolve(process.cwd());
const root = path.resolve(process.env.OAN_CORE_SOURCES_ROOT ?? path.resolve(experimentRoot, ".."));
process.env.OAN_WORKSPACE_ROOT = root;
const localOan = path.join(experimentRoot, "local-oan");
const shared: any = await import(pathToFileURL(path.join(localOan, "scripts", "bench", "runtime.ts")).href);
const flows: any = await import(pathToFileURL(path.join(localOan, "scripts", "bench", "lifecycle.ts")).href);
const outputIndex = process.argv.indexOf("--output");
const positional = process.argv.slice(2).find((value) => !value.startsWith("-"));
const out = path.resolve(outputIndex >= 0 && process.argv[outputIndex + 1] ? process.argv[outputIndex + 1] : (positional ?? "results/real-oan-local"));
const resourcesPerProtocol = Number(process.env.OAN_RESOURCES_PER_PROTOCOL ?? "250");
if (!Number.isInteger(resourcesPerProtocol) || resourcesPerProtocol <= 0) {
  throw new Error("OAN_RESOURCES_PER_PROTOCOL must be a positive integer");
}
const runStamp = Date.now().toString(); const work = path.join(localOan, ".local-oan-topology", runStamp); const pidDir = path.join(localOan, ".local-oan-pids", runStamp);
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true}); fs.rmSync(pidDir,{recursive:true,force:true}); fs.mkdirSync(pidDir,{recursive:true});
execFileSync(
  "node",
  [path.join(localOan, "scripts", "generate-local-topology.mjs")],
  {
    cwd: localOan,
    stdio: "inherit",
    env: {
      ...process.env,
      OAN_WORKSPACE_ROOT: root,
      OAN_EXPERIMENT_ROOT: localOan,
      OAN_LOCAL_TOPOLOGY_ROOT: work,
    },
  },
);
localizeTopologyPaths(work, root);
for (const file of fs.readdirSync(work,{recursive:true})) if (String(file).endsWith(".toml")) { const p=path.join(work,String(file)); const dir=path.dirname(p); const name=path.basename(dir); const dbPath=path.join(dir,`${name}.db`).replace(/\\/g,"/"); let cfg=fs.readFileSync(p,"utf8"); cfg=cfg.replace(/database_url\s*=\s*"[^"]*"/g,`database_url = "sqlite:${dbPath}"`); fs.writeFileSync(p,cfg,"utf8"); }
const event=shared.uniqueRootEventStreamProfile(`paper2-${Date.now()}`,4222); const rootConfig=path.join(work,"root/config.example.toml"); let rc=fs.readFileSync(rootConfig,"utf8").replace(/\[events\][\s\S]*$/m,""); rc+=`\n[events]\nenabled = true\nbackend = "${event.backend}"\nendpoint = "${event.endpoint}"\nstream = "${event.stream}"\ncdn_publish_subject = "${event.cdnPublishSubject}"\npublish_timeout_ms = 1000\nfailure_mode = "closed"\n`; fs.writeFileSync(rootConfig,rc,"utf8");
shared.writeBenchmarkCdnPublisherConfig(path.join(work,"cdn-publisher/config.example.toml"),{publisherPort:8110,rootPort:8100,cdnPort:8105},{events:event,rootKeysDirRelative:"../root/keys"}); shared.ensureServiceBinaries(["root-node","registrar-node","discovery-node","cdn-node","cdn-publisher"]); runCorePreflight(false, path.join(out, "oan-core-preflight-static.json"));
const nats=shared.createNatsRuntime(pidDir); const nodes=[shared.createNodeRuntime(pidDir,"root","root-node",rootConfig,8100),shared.createNodeRuntime(pidDir,"registrar","registrar-node",path.join(work,"registrar-a/config.example.toml"),8101),shared.createNodeRuntime(pidDir,"discovery","discovery-node",path.join(work,"discovery-a/config.example.toml"),8103),shared.createNodeRuntime(pidDir,"cdn","cdn-node",path.join(work,"cdn/config.example.toml"),8105),shared.createNodeRuntime(pidDir,"publisher","cdn-publisher",path.join(work,"cdn-publisher/config.example.toml"),8110)];
const protocols=[{protocol:"mcp",type:"mcp_server",code:"MCDM",path:protocolRoute("mcp")},{protocol:"skill",type:"skill",code:"SKDM",path:protocolRoute("skill")},{protocol:"openapi",type:"tool_api",code:"TLDM",path:protocolRoute("openapi")},{protocol:"a2a",type:"agent_service",code:"AGDM",path:protocolRoute("a2a")}]; const native=createServer((req,res)=>{res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true,protocol:req.url}));}); await new Promise<void>(r=>native.listen(9900,"127.0.0.1",()=>r()));
const started:any[]=[]; try { await shared.startNats(nats,4222); await shared.startNodesInPhases(nodes); started.push(...nodes); runCorePreflight(true, path.join(out, "oan-core-preflight-live.json")); const registrar=shared.loadIdentityMaterial(path.join(work,"registrar-a")); const rows:any[]=[]; for(const p of protocols) for(let resourceIndex=0;resourceIndex<resourcesPerProtocol;resourceIndex++){const identity=shared.createResourceIdentity({semanticCode:p.code,resourceType:p.type as any,capabilityTags:["satellite.cross_protocol",`protocol.${p.protocol}`,`resource.${resourceIndex}`],serviceEndpoint:`http://127.0.0.1:9900${p.path}`,label:`Satellite ${p.protocol} adapter ${resourceIndex}`,description:`Local satellite edge adapter ${resourceIndex} for ${p.protocol}`,protocol:p.protocol,serviceType:p.type==="agent_service"?"AgentService":p.type}); const fixture=shared.buildResourceRegistrationFixture(identity,{draftId:`paper2-${p.protocol}-${resourceIndex}`,registrarDid:registrar.did,resourceType:p.type,metadata:{source:"paper2-real-oan",protocol:p.protocol,resourceIndex}}); const t0=Date.now(); await shared.postJson("http://127.0.0.1:8101/resources/register",fixture,{timeoutMs:120000}); rows.push({protocol:p.protocol,resourceIndex,did:identity.did,registrationLatencyMs:Date.now()-t0,endpoint:`http://127.0.0.1:9900${p.path}`}); }
 const totalResources=protocols.length*resourcesPerProtocol; const convergenceTimeoutMs=600000; await shared.waitForRootLatestVersionCount("http://127.0.0.1:8100",totalResources,convergenceTimeoutMs); await flows.waitForRootEventPublish("http://127.0.0.1:8100",totalResources,convergenceTimeoutMs); await flows.waitForPublisherAck("http://127.0.0.1:8110",totalResources,convergenceTimeoutMs); await flows.waitForCdnResourceCount("http://127.0.0.1:8105",totalResources,convergenceTimeoutMs); const sync=await flows.waitForDiscoveryIndexedCount("http://127.0.0.1:8103",totalResources,convergenceTimeoutMs); const tasks:any[]=[]; for(let rep=0;rep<5;rep++) for(const p of protocols){const t0=Date.now(); const q=await shared.postJson<any>("http://127.0.0.1:8103/discovery/resources/query",{query:`satellite ${p.protocol} adapter`,protocol:p.protocol,limit:10}); const candidates=q.candidates??q.items??[]; const nativeResp=await fetch(`http://127.0.0.1:9900${p.path}`); tasks.push({repetition:rep,protocol:p.protocol,populationSize:resourcesPerProtocol,discoveryCandidates:candidates.length,nativeStatus:nativeResp.status,endToEndLatencyMs:Date.now()-t0,verification:"real-oan-package-lifecycle"}); }
 const manifest={runId:`paper2-real-${Date.now()}`,mode:"real-oan-local",coreEndpointMode:"connected",databaseBackend:"sqlite",trustIndexer:false,coreIntegration:integrationSummary(),resourcesPerProtocol,totalResources,registeredCount:rows.length,discoveryIndexedCount:sync.indexedResourceCount,protocols:protocols.map(x=>x.protocol),generatedAt:new Date().toISOString()}; fs.writeFileSync(path.join(out,"run-manifest.json"),JSON.stringify(manifest,null,2)); assertRealManifest(manifest); fs.writeFileSync(path.join(out,"resource-registration.json"),JSON.stringify(rows,null,2)); fs.writeFileSync(path.join(out,"task-results.json"),JSON.stringify(tasks,null,2)); console.log(JSON.stringify(manifest,null,2)); } finally { for(const n of [...started].reverse()) await shared.stopNode(n); await shared.stopNats(nats); await new Promise<void>(r=>native.close(()=>r())); }






function localizeTopologyPaths(topology: string, workspace: string): void {
  for (const file of fs.readdirSync(topology, { recursive: true })) {
    if (!String(file).endsWith('.toml')) continue;
    const p = path.join(topology, String(file)); let text = fs.readFileSync(p, 'utf8');
    text = text.replaceAll('\\', '/');
    text = text.replaceAll('../../.oan-multi-node-demo', topology.replaceAll('\\', '/'));
    text = text.replaceAll('../../docs/capability-tree-v1.json', path.join(workspace, 'oan-design-docs/docs/capability-tree-v1.json').replaceAll('\\', '/')); fs.writeFileSync(p, text, 'utf8');
  }
}

function runCorePreflight(live: boolean, output: string): void {
  execFileSync("cargo", ["run", "--quiet", "--bin", "check_oan_core", "--", ...(live ? ["--live"] : []), "--output", output], {
    cwd: experimentRoot,
    stdio: "inherit",
    env: { ...process.env, OAN_WORKSPACE_ROOT: root },
    windowsHide: true,
  });
}



