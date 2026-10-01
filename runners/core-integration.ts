/** Explicit integration map for the local OAN control plane. */
export const OAN_CORE_REPOSITORIES = { registrar: "oan-registrar-node", root: "oan-root-services/services/root-node", cdn: "oan-root-services/services/cdn-node", publisher: "oan-root-services/services/cdn-publisher", discovery: "oan-discovery-node/services/discovery-node", sdk: "oan-sdk-ts" } as const;
export const LOCAL_OAN_ENDPOINTS = { registrar: "http://127.0.0.1:8101", root: "http://127.0.0.1:8100", cdn: "http://127.0.0.1:8105", publisher: "http://127.0.0.1:8110", discovery: "http://127.0.0.1:8103" } as const;
export const OAN_ROUTES = { register: "/resources/register", rootStatus: "/root/status", discoveryQuery: "/discovery/resources/query", discoveryStatus: "/discovery/status" } as const;
export type ProtocolLifecycle = "registered" | "root-accepted" | "cdn-published" | "discovery-indexed" | "native-invoked";
export const OAN_LIFECYCLE: readonly ProtocolLifecycle[] = ["registered", "root-accepted", "cdn-published", "discovery-indexed", "native-invoked"];
export function integrationSummary() { return { repositories: OAN_CORE_REPOSITORIES, endpoints: LOCAL_OAN_ENDPOINTS, routes: OAN_ROUTES, lifecycle: OAN_LIFECYCLE, database: "sqlite", trustIndexer: false }; }
