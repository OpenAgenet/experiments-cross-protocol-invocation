import { readFile } from "node:fs/promises";
type Config = { endpoints: Record<string, string>; nativeEndpoints: Record<string, string> };
const i = process.argv.indexOf("--config"); const path = i >= 0 ? process.argv[i + 1] : undefined; if (!path) throw new Error("--config is required");
const config = JSON.parse(await readFile(path, "utf8")) as Config; const all = { ...config.endpoints, ...config.nativeEndpoints }; const probes: Record<string, unknown> = {};
for (const [name, url] of Object.entries(all)) { if (url.includes("_PORT")) { probes[name] = { status: "not-configured" }; continue; } try { const r = await fetch(`${url}/health`); probes[name] = { status: r.ok ? "supported" : "failed", httpStatus: r.status }; } catch (e) { probes[name] = { status: "failed", error: String(e) }; } }
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), probes }, null, 2));
