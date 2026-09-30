# Cross-Protocol Trusted Invocation Experiments

This repository implements local, reproducible experiments for adapting and invoking MCP, A2A, Skill, and OpenAPI/HTTP resources through an OAN control plane. It adds adapters, an invocation gate, native mocks, task orchestration, fault injection, and analysis without copying or modifying OAN core production logic.

## OAN integration

| OAN component | Used capability | Repository responsibility |
|---|---|---|
| `oan-registrar-node` | Registration of `agent_service`, `skill`, `mcp_server`, and `tool_api` resources. | Convert native descriptions into typed drafts and submit them through public APIs. |
| Root node in `oan-root-services` | Identity, authorization, package-claim, version, hash, lifecycle, and publication validation. | Retrieve and record package evidence; never fabricate or replace Root proof. |
| CDN node and publisher | Complete-package storage, publication, and retrieval. | Measure publication/fetch timing and host controlled local artifact references. |
| `oan-discovery-node` | Authorized-resource indexing, candidate query, resource details, visibility, and explanations. | Select candidates for adaptation; never treat a candidate alone as invocation authorization. |
| `oan-protocol-common` | Shared resource, DID, package, binding, and hash contracts. | Consume public JSON contracts and record the core commit without vendoring crates. |
| `oan-sdk-ts` | Four resource-draft builders, `OanClient`, lifecycle observation, package-shape, service-binding, candidate/package, and lifecycle checks. | Implement control-plane access, package verification, adapter selection, and invocation decisions. |
| PostgreSQL and NATS | Local dependencies of OAN core services. | Probe availability and record versions; never write directly to core databases. |

The concrete MCP, A2A, Skill, and OpenAPI runtime adapters are implemented here. Native mock execution proves only application-level behavior and never replaces OAN package or lifecycle evidence.

Trust Indexer is not used. Existing local genesis identities and authorization material are supplied through configuration. This repository does not issue infrastructure authorization, fabricate Root proof, insert records directly into Discovery, or trust an endpoint without package evidence.

## Comparison profiles

- `split`: protocol-specific directories, clients, and minimal checks.
- `unverified-unified`: a unified envelope and adapter interface with lightweight checks.
- `trusted-unified`: a unified envelope, complete-package verification, contract/digest/nonce checks, and at most one verified fallback.

All profiles use the same source artifacts, task chain, native mock responses, fault profile, network profile, random seed, and repetitions.

## Language responsibilities

- TypeScript: draft construction, OAN HTTP access, package verification, adapter selection, and `VerificationReport`/`InvocationDecision` generation.
- Python: task-chain orchestration, native mock calls, fault schedules, access-log consistency checks, repetition, and offline analysis.
- Rust: optional fixture conversion, deterministic proxy, digest, or high-throughput helper tools.

## Configuration

Copy `configs/local.sample.json` to `configs/local.json` and replace all control-plane and native-mock placeholder ports. OAN core services and native mocks must already be running. Control-plane endpoints and native endpoints must remain separate.

The comparison switches are defined in `configs/comparison-profiles.json`.

## Commands

```text
npm install
npm run probe -- --config configs/local.json
npm run validate:resources -- --config configs/local.json
uv run python -m runners.task_chain --config configs/local.json
```

## Outputs

A complete run produces capability probes, a run manifest, source-artifact digests, adapter and verification events, native access logs, task summaries, fault summaries, latency breakdowns, protocol comparison tables, data-quality errors, and checksums. Generated data belongs under `results/<run-id>/`; secrets, private keys, production credentials, and external server addresses must not be committed.

The experiment measures local software-control-plane and application-layer behavior only. It does not represent real orbital, radio, satellite-power, or blockchain-governance performance.
