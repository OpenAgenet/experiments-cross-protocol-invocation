"""Deterministic local experiment harness for cross-protocol invocation."""
from __future__ import annotations
import argparse, csv, hashlib, json, platform, random, sys, time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROTOCOLS = ("mcp", "skill", "openapi", "a2a")
PROFILES = ("split", "unverified-unified", "trusted-unified")
FAULTS = ("none", "endpoint-mismatch", "inactive-lifecycle", "package-hash-mismatch", "contract-mismatch", "replay-nonce", "native-timeout")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(payload).hexdigest()

@dataclass(frozen=True)
class Resource:
    protocol: str
    resource_type: str
    did: str
    version: str
    endpoint: str
    source_digest: str
    package_hash: str
    lifecycle: str = "active"

def resources() -> list[Resource]:
    values = {"mcp": ("mcp_server", "MCDM:7YpQm9Kx2VnRb6Ts3WfHa4Cd5Ej8LgNz", "/mcp"), "skill": ("skill", "SKDM:8YpQm9Kx2VnRb6Ts3WfHa4Cd5Ej8LgNy", "/manifest"), "openapi": ("tool_api", "TLDM:9YpQm9Kx2VnRb6Ts3WfHa4Cd5Ej8LgNx", "/openapi"), "a2a": ("agent_service", "AGDM:AYpQm9Kx2VnRb6Ts3WfHa4Cd5Ej8LgNw", "/agent")}
    output = []
    for protocol, (resource_type, suffix, path) in values.items():
        source_digest = digest({"protocol": protocol, "name": f"{protocol}-rescue-service", "version": "1.0.0", "path": path})
        output.append(Resource(protocol, resource_type, f"did:oan:{suffix}", "1.0.0", f"mock://{protocol}{path}", source_digest, digest({"did": suffix, "version": "1.0.0", "source": source_digest})))
    return output

def fault_resource(resource: Resource, fault: str) -> Resource:
    values = asdict(resource)
    if fault == "inactive-lifecycle": values["lifecycle"] = "inactive"
    if fault == "package-hash-mismatch": values["package_hash"] = "sha256:" + "0" * 64
    if fault == "endpoint-mismatch": values["endpoint"] += "-tampered"
    return Resource(**values)

def profile_flags(profile: str) -> tuple[bool, bool]:
    return (False, False) if profile == "split" else ((True, False) if profile == "unverified-unified" else (True, True))

def make_event(task_id: str, profile: str, resource: Resource, fault: str, stage: str, status: str, native: bool, reason: str = "", latency: float = 0.0, checks: dict[str, str] | None = None) -> dict[str, Any]:
    return {"runId": "pending", "taskId": task_id, "stepId": resource.protocol, "resourceDid": resource.did, "resourceType": resource.resource_type, "protocol": resource.protocol, "profile": profile, "faultId": fault, "stage": stage, "status": status, "nativeCallIssued": native, "blockReason": reason or None, "latencyMs": round(latency, 3), "verificationChecks": checks or {}, "timestamp": now_iso()}

def run_case(profile: str, resource: Resource, fault: str, rng: random.Random, task_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    unified, trusted = profile_flags(profile); started = time.perf_counter(); events: list[dict[str, Any]] = []; effective = fault_resource(resource, fault)
    adaptation_ms = 1.8 + rng.random() * 0.6 + (0.7 if unified else 0.0); package_ms = 0.0 if not trusted else 2.2 + rng.random() * 0.5; verification_ms = 0.0
    checks: dict[str, str] = {}; decision = "allow"; block_reason = ""; native_call = False; fallback = False
    for stage in ("draft-converted", "submitted", "visible", "candidate-loaded", "adapter-selected"): events.append(make_event(task_id, profile, effective, fault, stage, "pass", False))
    if trusted:
        verification_ms = 2.7 + rng.random() * 0.7; checks = {"package": "pass", "lifecycle": "pass", "binding": "pass", "endpoint": "pass", "contract": "pass", "nonce": "pass"}
        fault_map = {"endpoint-mismatch": ("endpoint", "endpoint-binding-mismatch"), "inactive-lifecycle": ("lifecycle", "lifecycle-not-active"), "package-hash-mismatch": ("package", "package-hash-mismatch"), "contract-mismatch": ("contract", "contract-incompatible"), "replay-nonce": ("nonce", "replay-nonce")}
        if fault in fault_map:
            key, block_reason = fault_map[fault]; checks[key] = "fail"; decision = "block"
    events.append(make_event(task_id, profile, effective, fault, "precheck-finished", decision, False, block_reason, verification_ms, checks))
    native_ms = 0.0; service_status = "not-called"
    if decision == "allow":
        events.append(make_event(task_id, profile, effective, fault, "native-call-started", "allow", True, checks=checks)); native_call = True
        if fault == "native-timeout":
            native_ms = 25.0 + rng.random() * 3.0; service_status = "timeout"
            if trusted: fallback = True; decision = "fallback"
        else: native_ms = 4.0 + rng.random() * 1.5; service_status = "success"
        events.append(make_event(task_id, profile, effective, fault, "native-call-finished", service_status, True, latency=native_ms, checks=checks))
    else: events.append(make_event(task_id, profile, effective, fault, "blocked", "block", False, block_reason, checks=checks))
    if fallback:
        service_status = "fallback-success"; native_ms += 3.5; events.append(make_event(task_id, profile, effective, fault, "fallback", "fallback", True, block_reason or "native-timeout", 3.5, checks))
    task_completed = service_status in ("success", "fallback-success")
    events.append(make_event(task_id, profile, effective, fault, "task-finished", "completed" if task_completed else decision, native_call, block_reason, checks=checks))
    summary = {"taskId": task_id, "profile": profile, "protocol": resource.protocol, "faultId": fault, "adaptationSuccess": True, "verificationAllowed": trusted and decision != "block", "nativeCallIssued": native_call, "taskCompleted": task_completed, "blockRate": int(decision == "block"), "fallbackSuccess": int(fallback and task_completed), "adaptationLatencyMs": round(adaptation_ms, 3), "packageFetchLatencyMs": round(package_ms, 3), "verificationLatencyMs": round(verification_ms, 3), "nativeLatencyMs": round(native_ms, 3), "endToEndLatencyMs": round((time.perf_counter() - started) * 1000 + adaptation_ms + package_ms + verification_ms + native_ms, 3), "decision": decision, "blockReason": block_reason, "serviceStatus": service_status}
    return summary, events

def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows({field: row.get(field, "") for field in fields} for row in rows)

def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--config", required=True); parser.add_argument("--output", default=None); parser.add_argument("--repetitions", type=int, default=None); args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8")); seed = int(config.get("seed", 20261001)); repetitions = args.repetitions or int(config.get("task", {}).get("repetitions", 1)); run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-local-emulation"; out = Path(args.output) if args.output else Path("results") / run_id; out.mkdir(parents=True, exist_ok=True); rng = random.Random(seed)
    selected_profiles = tuple(config.get("profiles", PROFILES)); selected_faults = tuple(config.get("faults", FAULTS)); summaries: list[dict[str, Any]] = []; events: list[dict[str, Any]] = []
    for repetition in range(repetitions):
        for resource in resources():
            for profile in selected_profiles:
                for fault in selected_faults:
                    summary, case_events = run_case(profile, resource, fault, rng, f"r{repetition:02d}-{resource.protocol}-{profile}-{fault}"); summary.update({"repetition": repetition, "runId": run_id}); summaries.append(summary)
                    for item in case_events: item.update({"runId": run_id, "repetition": repetition}); events.append(item)
    manifest = {"runId": run_id, "mode": "local-harness-emulation", "seed": seed, "repetitions": repetitions, "profiles": selected_profiles, "faults": selected_faults, "protocols": list(PROTOCOLS), "python": sys.version, "platform": platform.platform(), "coreEndpointMode": "not-connected", "trustIndexer": False, "generatedAt": now_iso()}; (out / "run-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    with (out / "events.jsonl").open("w", encoding="utf-8") as handle:
        for item in events: handle.write(json.dumps(item, separators=(",", ":")) + "\n")
    fields = ["runId", "repetition", "taskId", "profile", "protocol", "faultId", "adaptationSuccess", "verificationAllowed", "nativeCallIssued", "taskCompleted", "blockRate", "fallbackSuccess", "adaptationLatencyMs", "packageFetchLatencyMs", "verificationLatencyMs", "nativeLatencyMs", "endToEndLatencyMs", "decision", "blockReason", "serviceStatus"]; write_csv(out / "task-summary.csv", summaries, fields); write_csv(out / "latency-breakdown.csv", summaries, ["profile", "protocol", "faultId", "adaptationLatencyMs", "packageFetchLatencyMs", "verificationLatencyMs", "nativeLatencyMs", "endToEndLatencyMs"])
    print(json.dumps({"runId": run_id, "output": str(out), "rows": len(summaries), "events": len(events), "mode": manifest["mode"]}, indent=2))

if __name__ == "__main__": main()
