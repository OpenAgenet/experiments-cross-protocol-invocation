export type Protocol="mcp"|"skill"|"openapi"|"a2a";
export type EndpointSet={registrar:string;root:string;cdn:string;discovery:string};
export async function health(endpoint:string):Promise<boolean>{const r=await fetch(`${endpoint}/health`);return r.ok;}
export async function requireTopology(e:EndpointSet):Promise<void>{for(const [name,url] of Object.entries(e)){if(!(await health(url)))throw new Error(`${name} unavailable: ${url}`);}}
export function protocolRoute(p:Protocol){return {mcp:"/mcp",skill:"/manifest",openapi:"/openapi",a2a:"/agent"}[p];}
export function assertRealManifest(m:Record<string,unknown>){if(m.mode!=="real-oan-local"||m.databaseBackend!=="sqlite"||m.trustIndexer!==false)throw new Error("not a real SQLite OAN run");}
