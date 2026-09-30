export type Protocol = "mcp" | "a2a" | "skill" | "openapi";
export type CheckResult = "pass" | "fail" | "skip";
export interface UnifiedResourceEnvelope { resourceDid: string; resourceType: "agent_service" | "skill" | "mcp_server" | "tool_api"; protocol: Protocol; protocolBinding: Record<string, unknown>; version: string; endpointOrArtifact: string; inputContract: unknown; outputContract: unknown; packageHash?: string; metadataHash?: string; lifecycleState?: string; rootProof?: unknown; sourceArtifactDigest: string; }
export interface VerificationReport { checks: Record<string, CheckResult>; allowed: boolean; failures: string[]; latencyMs: number; }
export interface InvocationDecision { decision: "allow" | "block" | "fallback"; nativeCallIssued: boolean; blockReason?: string; candidateDid: string; verification: VerificationReport; }
