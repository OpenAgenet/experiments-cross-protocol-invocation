import { assertUsableLifecycle, verifyArtifactReferenceMaterial, verifyDidDocumentServiceBindings, verifyResourcePackageShape } from "@openagenet/oan-sdk-ts";
import type { ResourcePackage } from "@openagenet/oan-sdk-ts/protocol-types";
import type { InvocationDecision } from "./types.js";

export function verifyPackage(packageValue: ResourcePackage, candidateDid: string): InvocationDecision {
  const started = performance.now(); const checks: Record<string, "pass" | "fail" | "skip"> = {};
  const failures: string[] = [];
  for (const [name, check] of Object.entries({ shape: verifyResourcePackageShape, lifecycle: assertUsableLifecycle, binding: (value: ResourcePackage) => verifyDidDocumentServiceBindings(value.didDocument), artifactReference: (value: ResourcePackage) => verifyArtifactReferenceMaterial(value.didDocument.oanMetadata?.packageInfo ?? {}) })) {
    try { check(packageValue); checks[name] = "pass"; } catch (error) { checks[name] = "fail"; failures.push(`${name}:${String(error)}`); }
  }
  const verification = { checks, allowed: failures.length === 0, failures, latencyMs: performance.now() - started };
  return { decision: verification.allowed ? "allow" : "block", nativeCallIssued: false, blockReason: failures[0], candidateDid, verification };
}

// Artifact bytes are verified separately because the SDK helper above checks
// reference material, not the downloaded content digest.
