# Cross-Protocol Trusted Invocation Experiments

This repository implements local, reproducible experiments for adapting and invoking MCP, A2A, Skill, and OpenAPI/HTTP resources through an OAN control plane. It adds adapters, an invocation gate, native mocks, task orchestration, fault injection, and analysis without copying or modifying OAN core production logic.

## OAN integration

The Rust crate has compile-time path dependencies on `oan-core`,
`oan-protocol`, and `oan-client` from the sibling `oan-protocol-common`
repository. `check_oan_core` validates the Root, Registrar, Discovery, and
protocol-common workspaces, required service binaries, SQLite support,
genesis identities, protocol constants, resource types, and live node health.
Every real run writes static and live preflight reports into its result
directory before resource registration proceeds.

The node lifecycle harness is repository-local. `local-oan/scripts/bench/runtime.ts`
starts and stops the required binaries and NATS process, while
`local-oan/scripts/bench/lifecycle.ts` observes Root publication, CDN delivery,
and Discovery indexing. `local-oan/scripts/generate-local-topology.mjs` creates
isolated genesis-based configuration and SQLite databases. All experiment
runtime code, configuration templates, and lifecycle polling logic are
maintained in this repository; only the public OAN core repositories and
`oan-design-docs` genesis identities are external inputs.

The executable integration path is visible in `runners/run-real.ts`,
`runners/real-client.ts`, and `runners/core-integration.ts`. The runner starts
the official Root, Registrar, CDN, Publisher, and Discovery binaries, submits
four protocol-specific resources through Registrar, waits for Root/CDN/
Discovery completion, queries Discovery, and only then invokes local native
protocol endpoints. The generated manifest records this mapping in
`coreIntegration`.

| OAN component | Used capability | Repository responsibility |
|---|---|---|
| `oan-registrar-node` | Registration of `agent_service`, `skill`, `mcp_server`, and `tool_api` resources. | Convert native descriptions into typed drafts and submit them through public APIs. |
| Root node in `oan-root-services` | Identity, authorization, package-claim, version, hash, lifecycle, and publication validation. | Retrieve and record package evidence; never fabricate or replace Root proof. |
| CDN node and publisher | Complete-package storage, publication, and retrieval. | Measure publication/fetch timing and host controlled local artifact references. |
| `oan-discovery-node` | Authorized-resource indexing, candidate query, resource details, visibility, and explanations. | Select candidates for adaptation; never treat a candidate alone as invocation authorization. |
| `oan-protocol-common` | Shared resource, DID, package, binding, and hash contracts. | Consume public JSON contracts and record the core commit without vendoring crates. |
| `oan-sdk-ts` | Four resource-draft builders, `OanClient`, lifecycle observation, package-shape, service-binding, candidate/package, and lifecycle checks. | Implement control-plane access, package verification, adapter selection, and invocation decisions. |
| SQLite and NATS | Local dependencies of OAN core services. | The real runner creates isolated SQLite files and uses NATS JetStream only for Root-to-CDN publication; it never writes directly to core databases. |

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
- Rust: an explicit `CoreNode` topology, OAN repository/endpoint mapping,
  fail-closed lifecycle/count validation, result hashing, CLI inspection, and
  unit-tested run validation.

## Real local run

The supported experiment path starts an isolated local Root, Registrar, CDN,
CDN Publisher, and Discovery topology with genesis identities, SQLite files,
and NATS JetStream. It registers 50 MCP, 50 Skill, 50 OpenAPI, and 50 A2A
resources by default (200 resources in total),
waits for Discovery visibility, and invokes local native endpoints only after
the control-plane path succeeds. Trust Indexer remains disabled.

```text
npm install
$env:OAN_WORKSPACE_ROOT="D:\\Works\\VscodeProject\\OAN"
$env:OAN_NATS_SERVER_PATH="C:\\Program Files\\WinGet\\Links\\nats-server.exe"
npm run run:real -- --output results/real-oan-local
python analysis/analyze_real.py --input results/real-oan-local
```

`OAN_RESOURCES_PER_PROTOCOL` can override the default population for a quick
development smoke run; formal experiment runs use the default value `50`.

The runner fails closed if the local OAN topology is unavailable and never
labels an emulation result as a real experiment.

## Configuration

Copy `configs/local.sample.json` to `configs/local.json` and replace all control-plane and native-mock placeholder ports. OAN core services and native mocks must already be running. Control-plane endpoints and native endpoints must remain separate.

The comparison switches are defined in `configs/comparison-profiles.json`.

## Commands

```text
npm install
npm run probe -- --config configs/local.json
npm run validate:resources -- --config configs/local.json
npm run analyze:real -- --input results/real-oan-local
```

## Outputs

A complete run produces capability probes, a run manifest, source-artifact digests, adapter and verification events, native access logs, task summaries, fault summaries, latency breakdowns, protocol comparison tables, data-quality errors, and checksums. Generated data belongs under `results/<run-id>/`; secrets, private keys, production credentials, and external server addresses must not be committed.

The experiment measures local software-control-plane and application-layer behavior only. It does not represent real orbital, radio, satellite-power, or blockchain-governance performance.
