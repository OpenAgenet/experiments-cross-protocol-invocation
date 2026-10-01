// Copyright (c) 2026 OpenAgenet contributors
//
// Initial author: JINLIANG XU
// Email: jlxufly@gmail.com

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync, execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inferredExperimentRuntimeRoot = path.resolve(__dirname, "..");
const inferredWorkspaceRoot = path.resolve(inferredExperimentRuntimeRoot, "..", "..", "..", "..", "..");

export const workspaceRoot = process.env.OAN_WORKSPACE_ROOT ?? inferredWorkspaceRoot;
export const examplesRoot = process.env.OAN_EXPERIMENT_ROOT ?? inferredExperimentRuntimeRoot;
export const rootServicesRoot =
  process.env.OAN_ROOT_SERVICES_ROOT ?? path.join(workspaceRoot, "oan-root-services");
export const registrarNodeRoot =
  process.env.OAN_REGISTRAR_NODE_ROOT ?? path.join(workspaceRoot, "oan-registrar-node");
export const discoveryNodeRoot =
  process.env.OAN_DISCOVERY_NODE_ROOT ?? path.join(workspaceRoot, "oan-discovery-node");
export const designDocsRoot =
  process.env.OAN_DESIGN_DOCS_ROOT ?? path.join(workspaceRoot, "oan-design-docs");
export const capabilityTreeFixturePath = path.join(designDocsRoot, "docs", "capability-tree-v1.json");
export const genesisNodesRoot =
  process.env.OAN_GENESIS_NODES_ROOT ?? path.join(designDocsRoot, "genesis", "nodes");
export const adminToken = process.env.OAN_ADMIN_TOKEN ?? "local-dev-admin-token";
export const benchmarkDatabaseBackend = "sqlite";
export const benchmarkPostgresMaxConnections =
  positiveIntegerEnv("OAN_BENCH_POSTGRES_MAX_CONNECTIONS", 8);
export const benchmarkPostgresAcquireTimeoutSeconds =
  positiveIntegerEnv("OAN_BENCH_POSTGRES_ACQUIRE_TIMEOUT_SECONDS", 60);
export const benchmarkSqliteMaxConnections =
  positiveIntegerEnv("OAN_BENCH_SQLITE_MAX_CONNECTIONS", 32);
export const benchmarkSqliteAcquireTimeoutSeconds =
  positiveIntegerEnv("OAN_BENCH_SQLITE_ACQUIRE_TIMEOUT_SECONDS", 30);
export const rootWorkerProfile = {
  enabled: envBool("OAN_BENCH_ROOT_WORKERS_ENABLED", true),
  cdnIntervalMs: positiveIntegerEnv("OAN_BENCH_ROOT_CDN_INTERVAL_MS", 250),
  discoveryIntervalMs: positiveIntegerEnv("OAN_BENCH_ROOT_DISCOVERY_INTERVAL_MS", 250),
  cdnBatchSize: positiveIntegerEnv("OAN_BENCH_ROOT_CDN_BATCH_SIZE", 200),
  discoveryBatchSize: positiveIntegerEnv("OAN_BENCH_ROOT_DISCOVERY_BATCH_SIZE", 100),
  cdnConcurrency: positiveIntegerEnv("OAN_BENCH_ROOT_CDN_CONCURRENCY", 16),
  discoveryConcurrency: positiveIntegerEnv("OAN_BENCH_ROOT_DISCOVERY_CONCURRENCY", 8),
  admissionConcurrency: positiveIntegerEnv("OAN_BENCH_ROOT_ADMISSION_CONCURRENCY", 64),
  leaseSeconds: positiveIntegerEnv("OAN_BENCH_ROOT_WORKER_LEASE_SECONDS", 240),
  retryBackoffSeconds: positiveIntegerEnv("OAN_BENCH_ROOT_WORKER_RETRY_BACKOFF_SECONDS", 5),
  httpTimeoutSeconds: positiveIntegerEnv("OAN_BENCH_ROOT_WORKER_HTTP_TIMEOUT_SECONDS", 180),
};
export const rootEventStreamProfile = {
  enabled: true,
  backend: process.env.OAN_BENCH_EVENTS_BACKEND ?? "nats-jetstream",
  endpoint: process.env.OAN_BENCH_EVENTS_ENDPOINT ?? "nats://127.0.0.1:4222",
  stream: process.env.OAN_BENCH_EVENTS_STREAM ?? "OAN_RESOURCE_PUBLICATION",
  cdnPublishSubject:
    process.env.OAN_BENCH_CDN_PUBLISH_SUBJECT ?? "oan.resource.cdn.publish.requested",
  publishTimeoutMs: positiveIntegerEnv("OAN_BENCH_EVENT_PUBLISH_TIMEOUT_MS", 1000),
  failureMode: process.env.OAN_BENCH_EVENT_FAILURE_MODE ?? "closed",
};
export const cdnPublisherProfile = {
  durableConsumer: process.env.OAN_BENCH_CDN_PUBLISHER_DURABLE ?? "oan-cdn-publisher",
  batchSize: positiveIntegerEnv("OAN_BENCH_CDN_PUBLISHER_BATCH_SIZE", 200),
  fetchTimeoutMs: positiveIntegerEnv("OAN_BENCH_CDN_PUBLISHER_FETCH_TIMEOUT_MS", 1000),
  maxInFlight: positiveIntegerEnv("OAN_BENCH_CDN_PUBLISHER_MAX_IN_FLIGHT", 200),
  httpTimeoutSeconds: positiveIntegerEnv("OAN_BENCH_CDN_PUBLISHER_HTTP_TIMEOUT_SECONDS", 30),
};
export const tscPath = path.join(
  process.env.OAN_TYPESCRIPT_TOOLS_ROOT ?? examplesRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
);
export const defaultAuthorizedDomains = ["technology.software_engineering"];
export const rareAuthorizedDomain = "sports_and_fitness.sports_technology";
export const rareAuthorizedDomains = [rareAuthorizedDomain];
export const demoCapabilityTag = "demo.agent_service";
export const benchmarkCapabilityTag = "benchmark.agent_service";

export const serviceRepositoryRoots: Record<string, string> = {
  "root-node": rootServicesRoot,
  "cdn-node": rootServicesRoot,
  "cdn-publisher": rootServicesRoot,
  "registrar-node": registrarNodeRoot,
  "discovery-node": discoveryNodeRoot,
};

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NodeRuntime {
  name: string;
  packageName: string;
  configPath: string;
  port: number;
  repositoryRoot: string;
  executablePath?: string;
  process?: any;
  exitCode?: number | null;
  exitSignal?: string | null;
  stdoutPath: string;
  stderrPath: string;
}

export interface PercentileStats {
  count: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  totalMs: number;
}

export interface StageMetrics {
  [stageName: string]: number[];
}

export interface PipelineTimelineSample {
  capturedAt: string;
  elapsedMs: number;
  root: JsonValue;
  publisher: JsonValue;
  discoveries: Array<{
    baseUrl: string;
    status: JsonValue;
    indexStats: JsonValue;
  }>;
}

export interface PipelineDrainObservation {
  timeline: PipelineTimelineSample[];
  completedAtElapsedMs: number;
}

export interface ScaleScenarioResult {
  scale: number;
  concurrency: number;
  totalWallMs: number;
  registrationWallMs: number;
  rootAcceptWaitWallMs?: number;
  finalDrainWallMs: number;
  discoveryWallMs: number;
  queryVerificationWallMs: number;
  registeredCount: number;
  discoveredCount: number;
  missingCount: number;
  registrationThroughputPerSec: number;
  endToEndThroughputPerSec: number;
  stageStats: Record<string, PercentileStats>;
  stageGroups?: Record<string, Record<string, PercentileStats>>;
  pipelineStats?: Record<string, PercentileStats>;
  rootStatus: JsonValue;
  publisherStatus?: JsonValue;
  discoveryStatuses: JsonValue[];
  diagnostics?: unknown;
  failureSnapshot?: JsonValue;
}

export interface BenchmarkSummary {
  benchmarkName: string;
  startedAt: string;
  finishedAt: string;
  scales: ScaleScenarioResult[];
  observations: string[];
}

export interface MultiNodeScaleScenarioResult extends ScaleScenarioResult {
  perRegistrarRegisteredCount: Record<string, number>;
  perDiscoveryDiscoveredCount: Record<string, number>;
}

export interface IdentityMaterial {
  did: string;
  keyId: string;
  didDocument: Record<string, any>;
  privateKeyJwk: Record<string, any>;
  publicKeyJwk: Record<string, any>;
  cryptoSuite: string;
  hashAlgorithm: string;
  keypairPath: string;
}

export type DiscoverableResourceType =
  | "agent_service"
  | "skill"
  | "mcp_server"
  | "tool_api";

export interface ResourceIdentityOptions {
  semanticCode: string;
  resourceType: DiscoverableResourceType;
  capabilityTags: string[];
  authorizedDomains?: string[];
  serviceEndpoint?: string;
  label: string;
  description?: string;
  protocol?: string;
  transport?: string;
  serviceType?: string;
  serviceVersion?: string;
  identityType?: string;
  packageInfo?: Record<string, any>;
  protocolBindings?: Record<string, any>[];
  useCaseExamples?: string[];
}

export interface ResourceRegistrationFixture {
  resourceDid: string;
  resourceType: string;
  didDocument: Record<string, any>;
  didDocumentHash: string;
  metadata: Record<string, any>;
  packageVersion: string;
  packageHash: string;
  metadataHash: string;
  hashAlgorithm: string;
  registrationCredential: Record<string, any>;
  subjectControlProof: Record<string, any>;
  controllerAuthorizationProof?: Record<string, any>;
}

export interface InfrastructureIdentityOptions {
  semanticCode: string;
  identityType: string;
  role: string;
  description: string;
  capabilityTags: string[];
  serviceType: string;
  serviceFragment: string;
  serviceEndpoint: string;
  serverType: string;
  network?: string;
}

export interface BenchmarkEnvironment {
  runId: string;
  workDir: string;
  reportDir: string;
  pidDir: string;
}

interface WindowsVirtualMemorySnapshot {
  maxSizeMb: number | null;
  availableMb: number | null;
  inUseMb: number | null;
  pageFileLocation: string | null;
  automaticManagedPagefile: boolean | null;
  pagingFilesConfigured?: string[];
}

export interface NatsRuntime {
  process?: any;
  stdoutPath: string;
  stderrPath: string;
  storeDir: string;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function resetDir(dir: string): void {
  fs.rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath: string, value: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function copyDir(source: string, target: string): void {
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      ensureDir(path.dirname(to));
      fs.copyFileSync(from, to);
    }
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`)
    .join(",")}}`;
}

export function sha256Hex(value: unknown): string {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function prefixedSha256(value: unknown): string {
  return `sha256:${sha256Hex(value)}`;
}

function omitUndefinedAndNull<T extends Record<string, any>>(value: T): Record<string, any> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null),
  );
}

function serializeProtocolBindingForRust(value: Record<string, any>): Record<string, any> {
  return omitUndefinedAndNull({
    id: value.id,
    protocol: value.protocol,
    version: value.version,
    transport: value.transport,
    serviceRef: value.serviceRef,
    schemaRef: value.schemaRef,
    ...Object.fromEntries(
      Object.entries(value).filter(
        ([key]) => !["id", "protocol", "version", "transport", "serviceRef", "schemaRef"].includes(key),
      ),
    ),
  });
}

function serializeServiceEndpointForRust(value: Record<string, any>): Record<string, any> {
  return omitUndefinedAndNull({
    id: value.id,
    type: value.type,
    serviceEndpoint: value.serviceEndpoint,
    version: value.version,
    protocol: value.protocol,
    serverType: value.serverType,
    port: value.port,
  });
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (const byte of bytes) {
    if (byte === 0) result += BASE58_ALPHABET[0];
    else break;
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    result += BASE58_ALPHABET[digits[index]];
  }
  return result;
}

function didSuffixFromPublicKey(publicKeyRaw: Uint8Array): string {
  const digest = crypto.createHash("sha256").update(publicKeyRaw).digest();
  let suffix = base58Encode(digest);
  while (suffix.length < 32) {
    suffix += BASE58_ALPHABET[0];
  }
  return suffix.slice(0, 32);
}

export function createBenchmarkEnvironment(name: string): BenchmarkEnvironment {
  cleanupResidualBenchmarkProcesses();
  const runId = new Date().toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "-").replace("Z", "");
  const workDir = path.join(examplesRoot, ".oan-benchmark-work", name, runId);
  const reportDir = path.join(examplesRoot, ".oan-benchmark-reports", name, runId);
  const pidDir = path.join(examplesRoot, ".oan-benchmark-pids", name, runId);
  resetDir(workDir);
  resetDir(reportDir);
  resetDir(pidDir);
  writeJson(path.join(reportDir, "environment-preflight.json"), benchmarkEnvironmentPreflight());
  if (!envBool("OAN_BENCH_SKIP_ENV_PREFLIGHT", false)) {
    assertBenchmarkEnvironmentHealthy(path.join(reportDir, "environment-preflight.json"));
  }
  return { runId, workDir, reportDir, pidDir };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uniqueRootEventStreamProfile(
  runId: string,
  natsPort: number,
): typeof rootEventStreamProfile {
  const suffix = runId.replace(/[^A-Za-z0-9]/g, "_");
  return {
    ...rootEventStreamProfile,
    enabled: true,
    endpoint: process.env.OAN_BENCH_EVENTS_ENDPOINT ?? `nats://127.0.0.1:${natsPort}`,
    stream: process.env.OAN_BENCH_EVENTS_STREAM ?? `OAN_RESOURCE_PUBLICATION_${suffix}`,
    cdnPublishSubject:
      process.env.OAN_BENCH_CDN_PUBLISH_SUBJECT ?? `oan.resource.cdn.publish.requested.${suffix}`,
    failureMode: process.env.OAN_BENCH_EVENT_FAILURE_MODE ?? "closed",
  };
}

export function createNatsRuntime(pidDir: string): NatsRuntime {
  return {
    stdoutPath: path.join(pidDir, "nats-server.out.log"),
    stderrPath: path.join(pidDir, "nats-server.err.log"),
    storeDir: path.join(pidDir, "nats-store"),
  };
}

export function findNatsServer(): string {
  const explicit = process.env.OAN_NATS_SERVER_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const fixedWindowsInstall = path.join(
    "D:",
    "ProgramFiles",
    "nats",
    "nats-server",
    process.platform === "win32" ? "nats-server.exe" : "nats-server",
  );
  if (process.platform === "win32" && fs.existsSync(fixedWindowsInstall)) return fixedWindowsInstall;
  const local = path.join(
    workspaceRoot,
    ".tmp",
    "nats-server",
    process.platform === "win32" ? "nats-server.exe" : "nats-server",
  );
  if (fs.existsSync(local)) return local;
  return process.platform === "win32" ? "nats-server.exe" : "nats-server";
}

export async function startNats(runtime: NatsRuntime, port: number): Promise<void> {
  const executable = findNatsServer();
  stopPortIfOccupied(port);
  resetDir(runtime.storeDir);
  const stdoutFd = fs.openSync(runtime.stdoutPath, "w");
  const stderrFd = fs.openSync(runtime.stderrPath, "w");
  runtime.process = spawn(executable, ["-js", "-p", String(port), "-sd", runtime.storeDir], {
    stdio: ["ignore", stdoutFd, stderrFd],
    windowsHide: true,
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const net = await import("node:net");
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", reject);
        socket.setTimeout(500, () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await sleep(250);
    }
  }
  const stderr = fs.existsSync(runtime.stderrPath)
    ? fs.readFileSync(runtime.stderrPath, "utf8").split(/\r?\n/).slice(-20).join("\n")
    : "";
  throw new Error(
    `nats-server did not start on port ${port}. Install nats-server or set OAN_NATS_SERVER_PATH.${stderr ? `\n${stderr}` : ""}`,
  );
}

export async function stopNats(runtime: NatsRuntime): Promise<void> {
  if (!runtime.process?.pid) return;
  try {
    runtime.process.kill("SIGTERM");
  } catch {
    // ignore shutdown races in benchmark cleanup
  }
}

function rustChronoIso(value: string): string {
  return value.replace(".000Z", "Z");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(
  url: string,
  init?: Record<string, any>,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, init);
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(body)}`);
  }
  return { status: response.status, body };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  options?: { admin?: boolean; timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 60_000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (options?.admin) {
      headers.authorization = `Bearer ${adminToken}`;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json()) as T;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(data)}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function capturePipelineTimelineSample(input: {
  startedAt: number;
  rootBaseUrl: string;
  publisherBaseUrl: string;
  discoveryBaseUrls: string[];
}): Promise<PipelineTimelineSample> {
  const [root, publisher, discoveries] = await Promise.all([
    getJson<any>(`${input.rootBaseUrl}/root/status`).catch((error) => ({ error: String(error) })),
    getJson<any>(`${input.publisherBaseUrl}/status`).catch((error) => ({ error: String(error) })),
    Promise.all(
      input.discoveryBaseUrls.map(async (baseUrl) => ({
        baseUrl,
        status: await getJson<any>(`${baseUrl}/discovery/status`).catch((error) => ({ error: String(error) })),
        indexStats: await getJson<any>(`${baseUrl}/discovery/index/stats`).catch((error) => ({ error: String(error) })),
      })),
    ),
  ]);
  return {
    capturedAt: nowIso(),
    elapsedMs: Date.now() - input.startedAt,
    root: compactRootTimelineStatus(root),
    publisher: compactPublisherTimelineStatus(publisher),
    discoveries: discoveries.map(({ baseUrl, status, indexStats }) => ({
      baseUrl,
      status: compactDiscoveryTimelineStatus(status),
      indexStats: compactDiscoveryIndexStats(indexStats),
    })),
  };
}

function compactRootTimelineStatus(status: any): JsonValue {
  if (status?.error) return { error: String(status.error) };
  const worker = status?.workerRuntime ?? {};
  const admission = status?.admissionRuntime ?? {};
  return {
    latestVersionCount: status?.latestVersionCount ?? null,
    cdnQueueCount: status?.cdnQueueCount ?? null,
    cdnReadyQueueCount: status?.cdnReadyQueueCount ?? null,
    cdnActiveQueueCount: status?.cdnActiveQueueCount ?? null,
    discoveryQueueCount: status?.discoveryQueueCount ?? null,
    discoveryReadyQueueCount: status?.discoveryReadyQueueCount ?? null,
    discoveryPendingQueueCount: status?.discoveryPendingQueueCount ?? null,
    admission: {
      acceptedCount: admission.accepted_count ?? null,
      busyRejectedCount: admission.busy_rejected_count ?? null,
      lastWaitMs: admission.last_wait_ms ?? null,
      maxWaitMs: admission.max_wait_ms ?? null,
    },
    worker: {
      cdnEventTriggerCount: worker.cdn_event_trigger_count ?? null,
      cdnTimerTriggerCount: worker.cdn_timer_trigger_count ?? null,
      cdnNoopCycleCount: worker.cdn_noop_cycle_count ?? null,
      cdnLastProgressElapsedMs: worker.cdn_last_progress_elapsed_ms ?? null,
      discoveryEventTriggerCount: worker.discovery_event_trigger_count ?? null,
      discoveryTimerTriggerCount: worker.discovery_timer_trigger_count ?? null,
      discoveryNoopCycleCount: worker.discovery_noop_cycle_count ?? null,
      discoveryLastProgressElapsedMs: worker.discovery_last_progress_elapsed_ms ?? null,
      markPublishedLastTotalElapsedMs: worker.mark_published_last_total_elapsed_ms ?? null,
      markPublishedLastUpdateElapsedMs: worker.mark_published_last_update_elapsed_ms ?? null,
      markPublishedMaxTotalElapsedMs: worker.mark_published_max_total_elapsed_ms ?? null,
      markPublishedMaxUpdateElapsedMs: worker.mark_published_max_update_elapsed_ms ?? null,
      markPublishedTotalCallCount: worker.mark_published_total_call_count ?? null,
    },
    event: {
      publishSuccessCount: status?.eventRuntime?.publish_success_count ?? null,
      publishFailureCount: status?.eventRuntime?.publish_failure_count ?? null,
      lastError: status?.eventRuntime?.last_error ?? null,
    },
  };
}

function compactPublisherTimelineStatus(status: any): JsonValue {
  if (status?.error) return { error: String(status.error) };
  const runtime = status?.runtime ?? {};
  return {
    totalAckedCount: runtime.total_acked_count ?? null,
    totalFailedCount: runtime.total_failed_count ?? null,
    lastFetchedCount: runtime.last_fetched_count ?? null,
    lastFailedCount: runtime.last_failed_count ?? null,
    lastFetchElapsedMs: runtime.last_fetch_elapsed_ms ?? null,
    lastPublishElapsedMs: runtime.last_publish_elapsed_ms ?? null,
    lastCallbackElapsedMs: runtime.last_callback_elapsed_ms ?? null,
    lastError: runtime.last_error ?? null,
  };
}

function compactDiscoveryTimelineStatus(status: any): JsonValue {
  if (status?.error) return { error: String(status.error) };
  const lastSync = status?.lastSync ?? {};
  return {
    indexedResourceCount: status?.indexedResourceCount ?? null,
    syncCursor: status?.syncCursor ?? lastSync.toCursor ?? null,
    cursorLag: lastSync.cursorLag ?? null,
    lastSyncElapsedMs: lastSync.elapsedMs ?? null,
    lastSyncItemsFetched: lastSync.itemsFetched ?? null,
    rejectedCount: lastSync.rejectedCount ?? null,
    blockedCursor: lastSync.blockedCursor ?? null,
  };
}

function compactDiscoveryIndexStats(stats: any): JsonValue {
  if (stats?.error) return { error: String(stats.error) };
  return {
    indexedResourceCount: stats?.indexedResourceCount ?? stats?.resourceCount ?? null,
    syncCursor: stats?.syncCursor ?? null,
    semanticIndexedCount: stats?.semanticIndexedCount ?? null,
  };
}

export async function observeDiscoveryUntilIndexedCount(
  discoveryBaseUrl: string,
  targetIndexedCount: number,
  stageMetrics: StageMetrics,
  stageName: string,
  timeoutMs = 300_000,
): Promise<any[]> {
  const results: any[] = [];
  const deadline = Date.now() + timeoutMs;
  let lastIndexedCount = -1;
  while (Date.now() < deadline) {
    const observedStarted = timeNow();
    const indexStats = await getJson<any>(`${discoveryBaseUrl}/discovery/index/stats`);
    stageMetricPush(stageMetrics, stageName, hrtimeMs(observedStarted));
    results.push(indexStats);
    const indexedCount = Number(indexStats?.indexedResourceCount ?? indexStats?.resourceCount ?? 0);
    if (indexedCount >= targetIndexedCount) {
      return results;
    }
    if (indexedCount > lastIndexedCount) {
      lastIndexedCount = indexedCount;
    }
    await sleep(500);
  }
  throw new Error(`discovery observation timed out before reaching indexed resource count ${targetIndexedCount}`);
}

export const observeDiscoveryUntilCursor = observeDiscoveryUntilIndexedCount;

export function assertDiscoveryDeltaSyncContract(
  results: any[],
  targetCursor: number,
  context: string,
): void {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`${context}: discovery sync did not return any cycle results`);
  }
  let previousToCursor = -1;
  for (const [index, result] of results.entries()) {
    if (result?.deltaUpsert !== true) {
      throw new Error(`${context}: sync result ${index} did not use delta upsert: ${JSON.stringify(result)}`);
    }
    for (const field of ["fromCursor", "toCursor", "pagesFetched"]) {
      if (typeof result?.[field] !== "number") {
        throw new Error(`${context}: sync result ${index} is missing numeric ${field}: ${JSON.stringify(result)}`);
      }
    }
    if (result.toCursor < result.fromCursor) {
      throw new Error(`${context}: sync cursor moved backwards: ${JSON.stringify(result)}`);
    }
    if (previousToCursor > result.toCursor) {
      throw new Error(`${context}: sync cycles are not monotonic: ${JSON.stringify(results)}`);
    }
    previousToCursor = result.toCursor;
  }
  const finalResult = results[results.length - 1];
  if (targetCursor > 0 && Number(finalResult?.toCursor ?? 0) < targetCursor) {
    throw new Error(`${context}: final sync cursor did not reach ${targetCursor}: ${JSON.stringify(finalResult)}`);
  }
}

export function assertDiscoveryObservationContract(
  results: any[],
  targetCursor: number,
  context: string,
): void {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`${context}: discovery observation did not return status samples`);
  }
  let previousIndexedCount = -1;
  for (const [index, result] of results.entries()) {
    const indexedCount = Number(result?.indexedResourceCount ?? result?.resourceCount ?? 0);
    if (!Number.isFinite(indexedCount)) {
      throw new Error(`${context}: observation ${index} is missing indexed count: ${JSON.stringify(result)}`);
    }
    if (indexedCount < previousIndexedCount) {
      throw new Error(`${context}: indexed count regressed: ${JSON.stringify(results)}`);
    }
    previousIndexedCount = indexedCount;
  }
  const finalResult = results[results.length - 1];
  const finalIndexedCount = Number(finalResult?.indexedResourceCount ?? finalResult?.resourceCount ?? 0);
  const finalSyncCursor = Number(finalResult?.syncCursor ?? finalIndexedCount);
  if (targetCursor > 0 && (finalIndexedCount < targetCursor || finalSyncCursor < targetCursor)) {
    throw new Error(`${context}: final observation did not reach ${targetCursor}: ${JSON.stringify(finalResult)}`);
  }
}

export function assertCdnBatchPublishContract(result: any, context: string): void {
  if (result?.batchMode !== "cdn-resource-batch") {
    throw new Error(`${context}: root did not use CDN batch publish mode: ${JSON.stringify(result)}`);
  }
  for (const field of ["claimedCount", "attemptedCount", "successCount", "failedCount", "elapsedMs"]) {
    if (typeof result?.[field] !== "number") {
      throw new Error(`${context}: CDN publish result is missing numeric ${field}: ${JSON.stringify(result)}`);
    }
  }
  if (result.failedCount > 0) {
    throw new Error(`${context}: CDN batch publish reported failures: ${JSON.stringify(result)}`);
  }
  if (result.attemptedCount !== result.successCount + result.failedCount) {
    throw new Error(`${context}: CDN publish counters are inconsistent: ${JSON.stringify(result)}`);
  }
}

export function assertRootWorkerRuntimeContract(status: any, context: string): void {
  const runtime = status?.workerRuntime;
  if (!runtime || typeof runtime !== "object") {
    throw new Error(`${context}: root status is missing workerRuntime: ${JSON.stringify(status)}`);
  }
  for (const field of [
    "cdn_last_elapsed_ms",
    "cdn_last_success_count",
    "cdn_last_failed_count",
    "cdn_last_progress_elapsed_ms",
    "cdn_last_progress_success_count",
    "cdn_last_progress_failed_count",
    "cdn_event_trigger_count",
    "cdn_timer_trigger_count",
    "cdn_noop_cycle_count",
    "cdn_last_event_to_cycle_start_ms",
    "cdn_oldest_pending_age_ms",
    "cdn_effective_batch_size",
    "discovery_last_elapsed_ms",
    "discovery_last_success_count",
    "discovery_last_failed_count",
    "discovery_last_progress_elapsed_ms",
    "discovery_last_progress_success_count",
    "discovery_last_progress_failed_count",
    "discovery_event_trigger_count",
    "discovery_timer_trigger_count",
    "discovery_noop_cycle_count",
    "discovery_last_event_to_cycle_start_ms",
    "discovery_oldest_pending_age_ms",
    "discovery_effective_batch_size",
    "mark_published_last_fetch_elapsed_ms",
    "mark_published_last_update_elapsed_ms",
    "mark_published_last_watermark_elapsed_ms",
    "mark_published_last_total_elapsed_ms",
    "mark_published_last_job_count",
    "mark_published_total_call_count",
  ]) {
    if (typeof runtime[field] !== "number") {
      throw new Error(`${context}: workerRuntime is missing numeric ${field}: ${JSON.stringify(runtime)}`);
    }
  }
  const admissionRuntime = status?.admissionRuntime;
  if (!admissionRuntime || typeof admissionRuntime !== "object") {
    throw new Error(`${context}: root status is missing admissionRuntime: ${JSON.stringify(status)}`);
  }
  for (const field of ["last_wait_ms", "max_wait_ms", "accepted_count", "busy_rejected_count"]) {
    if (typeof admissionRuntime[field] !== "number") {
      throw new Error(`${context}: admissionRuntime is missing numeric ${field}: ${JSON.stringify(admissionRuntime)}`);
    }
  }
}

export async function capturePipelineFailureSnapshot(
  runtime: {
    rootPort: number;
    discoveryPort: number;
    publisherPort: number;
  },
  targetCursor: number,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const rootStatus = await getJson<any>(`http://127.0.0.1:${runtime.rootPort}/root/status`).catch((error) => ({
    error: String(error),
  }));
  const publisherStatus = await getJson<any>(`http://127.0.0.1:${runtime.publisherPort}/status`).catch((error) => ({
    error: String(error),
  }));
  const discoveryStatus = await getJson<any>(`http://127.0.0.1:${runtime.discoveryPort}/discovery/status`).catch((error) => ({
    error: String(error),
  }));
  const discoveryIndexStats = await getJson<any>(`http://127.0.0.1:${runtime.discoveryPort}/discovery/index/stats`).catch((error) => ({
    error: String(error),
  }));
  const postgresStatus = probeBenchmarkPostgres();
  return {
    capturedAt: nowIso(),
    targetCursor,
    rootStatus,
    publisherStatus,
    discoveryStatus,
    discoveryIndexStats,
    postgresStatus,
    ...extra,
  };
}

export function probeBenchmarkPostgres(): Record<string, unknown> {
  if (benchmarkDatabaseBackend !== "postgres") {
    return {
      backend: benchmarkDatabaseBackend,
      ready: true,
      skipped: true,
    };
  }
  const pgIsReady = findPostgresCli("pg_isready");
  try {
    const output = execFileSync(
      pgIsReady,
      ["-h", "127.0.0.1", "-p", "5432"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        encoding: "utf8",
        timeout: 5_000,
      },
    ).trim();
    return {
      backend: "postgres",
      ready: true,
      output,
    };
  } catch (error) {
    const details =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr?: unknown }).stderr ?? "")
        : String(error);
    return {
      backend: "postgres",
      ready: false,
      error: details.trim() || String(error),
    };
  }
}

function cleanupResidualBenchmarkProcesses(): void {
  // Each experiment owns explicit node and NATS handles. Cleanup is performed
  // through stopNode/stopNats, so no external runner process discovery is used.
}

function benchmarkEnvironmentPreflight(): Record<string, unknown> {
  const snapshot = readWindowsVirtualMemorySnapshot();
  return {
    capturedAt: nowIso(),
    platform: process.platform,
    node: process.version,
    benchmarkDatabaseBackend,
    virtualMemory: snapshot,
  };
}

function readWindowsVirtualMemorySnapshot(): WindowsVirtualMemorySnapshot | null {
  if (process.platform !== "win32") return null;
  try {
    const raw = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        [
          "$os = Get-CimInstance Win32_OperatingSystem;",
          "$cs = Get-CimInstance Win32_ComputerSystem;",
          "$mm = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management';",
          "[pscustomobject]@{",
          "  FreeVirtualMemory = $os.FreeVirtualMemory;",
          "  TotalVirtualMemorySize = $os.TotalVirtualMemorySize;",
          "  AutomaticManagedPagefile = $cs.AutomaticManagedPagefile;",
          "  PagingFiles = @($mm.PagingFiles);",
          "} | ConvertTo-Json -Compress",
        ].join(" "),
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const parsed = JSON.parse(raw) as {
      FreeVirtualMemory?: number | string;
      TotalVirtualMemorySize?: number | string;
      AutomaticManagedPagefile?: boolean;
      PagingFiles?: string[] | string;
    };
    const freeKb = Number(parsed.FreeVirtualMemory ?? 0);
    const totalKb = Number(parsed.TotalVirtualMemorySize ?? 0);
    const pagingFilesRaw = Array.isArray(parsed.PagingFiles)
      ? parsed.PagingFiles
      : typeof parsed.PagingFiles === "string" && parsed.PagingFiles.trim().length > 0
        ? [parsed.PagingFiles.trim()]
        : [];
    const pagingFilesConfigured = pagingFilesRaw
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const pageFileLocation =
      pagingFilesConfigured.length > 0
        ? pagingFilesConfigured.map((value) => value.split(/\s+/)[0]).join(", ")
        : null;
    return {
      maxSizeMb: totalKb > 0 ? Math.round(totalKb / 1024) : null,
      availableMb: freeKb > 0 ? Math.round(freeKb / 1024) : null,
      inUseMb: totalKb > 0 && freeKb >= 0 ? Math.round((totalKb - freeKb) / 1024) : null,
      pageFileLocation,
      automaticManagedPagefile:
        typeof parsed.AutomaticManagedPagefile === "boolean" ? parsed.AutomaticManagedPagefile : null,
      pagingFilesConfigured,
    };
  } catch (error) {
    return {
      maxSizeMb: null,
      availableMb: null,
      inUseMb: null,
      pageFileLocation: `probe_failed: ${String(error)}`,
      automaticManagedPagefile: null,
      pagingFilesConfigured: [],
    };
  }
}

function assertBenchmarkEnvironmentHealthy(preflightPath: string): void {
  const snapshot = readWindowsVirtualMemorySnapshot();
  if (!snapshot) return;
  const problems: string[] = [];
  if (snapshot.automaticManagedPagefile === false) {
    problems.push("AutomaticManagedPagefile=false");
  }
  if (
    !snapshot.pageFileLocation ||
    snapshot.pageFileLocation.toUpperCase() === "N/A" ||
    (snapshot.pagingFilesConfigured?.length ?? 0) === 0
  ) {
    problems.push(
      `PagingFiles=${snapshot.pagingFilesConfigured?.length ? snapshot.pagingFilesConfigured.join(", ") : "empty"}`,
    );
  }
  if (snapshot.availableMb !== null && snapshot.availableMb < 4096) {
    problems.push(`Virtual Memory Available=${snapshot.availableMb}MB`);
  }
  if (problems.length === 0) return;
  throw new Error(
    `benchmark environment is not healthy for Rust/OAN pressure on Windows: ${problems.join(", ")}. ` +
      `See ${preflightPath}`,
  );
}

export async function waitForRootLatestVersionCount(
  rootBaseUrl: string,
  targetCount: number,
  timeoutMs = 300_000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = -1;
  while (Date.now() < deadline) {
    const status = await getJson<any>(`${rootBaseUrl}/root/status`);
    const latestVersionCount = Number(status?.latestVersionCount ?? 0);
    if (latestVersionCount >= targetCount) {
      return status;
    }
    lastSeen = latestVersionCount;
    await sleep(250);
  }
  throw new Error(
    `root latestVersionCount did not reach target ${targetCount}; lastSeen=${lastSeen}`,
  );
}

export async function waitForHealth(name: string, port: number, timeoutMs = 60_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await getJson(`http://127.0.0.1:${port}/health`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`${name} did not become healthy on port ${port}`);
}

export function createNodeRuntime(
  pidDir: string,
  name: string,
  packageName: string,
  configPath: string,
  port: number,
): NodeRuntime {
  const repositoryRoot = serviceRepositoryRoot(packageName);
  return {
    name,
    packageName,
    configPath,
    port,
    repositoryRoot,
    executablePath: serviceExecutablePath(packageName),
    stdoutPath: path.join(pidDir, `${name}.out.log`),
    stderrPath: path.join(pidDir, `${name}.err.log`),
  };
}

export function serviceRepositoryRoot(packageName: string): string {
  const repositoryRoot = serviceRepositoryRoots[packageName];
  if (!repositoryRoot) {
    throw new Error(`unknown service package ${packageName}`);
  }
  if (!fs.existsSync(repositoryRoot)) {
    throw new Error(`missing repository for ${packageName}: ${repositoryRoot}`);
  }
  return repositoryRoot;
}

export function serviceExecutablePath(packageName: string): string {
  return path.join(
    serviceRepositoryRoot(packageName),
    "target",
    "debug",
    `${packageName}${process.platform === "win32" ? ".exe" : ""}`,
  );
}

export function ensureServiceBinaries(packageNames: string[]): void {
  const packagesByRoot = new Map<string, string[]>();
  for (const packageName of new Set(packageNames)) {
    const repositoryRoot = serviceRepositoryRoot(packageName);
    packagesByRoot.set(repositoryRoot, [...(packagesByRoot.get(repositoryRoot) ?? []), packageName]);
  }
  for (const [repositoryRoot, packages] of packagesByRoot.entries()) {
    console.log(`[bench] building ${packages.join(", ")} from ${repositoryRoot}`);
    execFileSync("cargo", ["build", ...packages.flatMap((packageName) => ["-p", packageName])], {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true,
    });
  }
}

export async function ensureServiceBinariesAsync(packageNames: string[]): Promise<void> {
  const packagesByRoot = new Map<string, string[]>();
  for (const packageName of new Set(packageNames)) {
    const repositoryRoot = serviceRepositoryRoot(packageName);
    packagesByRoot.set(repositoryRoot, [...(packagesByRoot.get(repositoryRoot) ?? []), packageName]);
  }
  for (const [repositoryRoot, packages] of packagesByRoot.entries()) {
    console.log(`[bench] building ${packages.join(", ")} from ${repositoryRoot}`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("cargo", ["build", ...packages.flatMap((packageName) => ["-p", packageName])], {
        cwd: repositoryRoot,
        stdio: "inherit",
        windowsHide: true,
      });
      child.once("error", reject);
      child.once("close", (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`cargo build failed in ${repositoryRoot} with exit code ${code}`));
        }
      });
    });
  }
}

export async function startNode(runtime: NodeRuntime): Promise<void> {
  stopPortIfOccupied(runtime.port);
  ensureDir(path.dirname(runtime.stdoutPath));
  const executablePath =
    runtime.executablePath ??
    serviceExecutablePath(runtime.packageName);
  if (!fs.existsSync(executablePath)) {
    throw new Error(`missing service executable for ${runtime.packageName}: ${executablePath}`);
  }
  console.log(`[bench] starting ${runtime.name} from ${runtime.repositoryRoot}: ${executablePath}`);
  const stdoutFd = fs.openSync(runtime.stdoutPath, "w");
  const stderrFd = fs.openSync(runtime.stderrPath, "w");
  const child = spawn(executablePath, [runtime.configPath], {
    cwd: runtime.repositoryRoot,
    env: {
      ...process.env,
      OAN_POSTGRES_MAX_CONNECTIONS:
        process.env.OAN_POSTGRES_MAX_CONNECTIONS ?? String(benchmarkPostgresMaxConnections),
      OAN_POSTGRES_ACQUIRE_TIMEOUT_SECONDS:
        process.env.OAN_POSTGRES_ACQUIRE_TIMEOUT_SECONDS ??
        String(benchmarkPostgresAcquireTimeoutSeconds),
      OAN_SQLITE_MAX_CONNECTIONS:
        process.env.OAN_SQLITE_MAX_CONNECTIONS ?? String(benchmarkSqliteMaxConnections),
      OAN_SQLITE_ACQUIRE_TIMEOUT_SECONDS:
        process.env.OAN_SQLITE_ACQUIRE_TIMEOUT_SECONDS ??
        String(benchmarkSqliteAcquireTimeoutSeconds),
    },
    stdio: ["ignore", stdoutFd, stderrFd],
    windowsHide: true,
    detached: process.platform === "win32",
  });
  if (process.platform === "win32") {
    child.unref();
  }
  runtime.process = child;
  child.once("exit", (code: number | null, signal: string | null) => {
    runtime.exitCode = code;
    runtime.exitSignal = signal;
  });
  writeText(path.join(path.dirname(runtime.stdoutPath), `${runtime.name}.pid`), String(child.pid ?? ""));
  await waitForHealth(runtime.name, runtime.port);
}

export function assertNodesAlive(runtimes: NodeRuntime[], context: string): void {
  const exited = runtimes
    .filter((runtime) => runtime.process && runtime.exitCode !== undefined)
    .map((runtime) => `${runtime.name}(code=${runtime.exitCode}, signal=${runtime.exitSignal ?? "none"})`);
  if (exited.length > 0) {
    throw new Error(`${context}: service process exited unexpectedly: ${exited.join(", ")}`);
  }
}

export async function startNodesInPhases(
  runtimes: NodeRuntime[],
  options?: {
    delayedNames?: string[];
    logPrefix?: string;
  },
): Promise<void> {
  const delayedNames = new Set(options?.delayedNames ?? ["cdn-publisher"]);
  const immediate = runtimes.filter((runtime) => !delayedNames.has(runtime.name));
  const delayed = runtimes.filter((runtime) => delayedNames.has(runtime.name));

  await Promise.all(
    immediate.map(async (runtime) => {
      if (options?.logPrefix) {
        console.log(`${options.logPrefix} starting ${runtime.name}`);
      }
      await startNode(runtime);
    }),
  );

  for (const runtime of delayed) {
    if (options?.logPrefix) {
      console.log(`${options.logPrefix} starting ${runtime.name}`);
    }
    await startNode(runtime);
  }
}

export async function stopNode(runtime: NodeRuntime): Promise<void> {
  if (!runtime.process?.pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${runtime.process.pid} /T /F`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // ignore
    }
    return;
  }
  try {
    process.kill(runtime.process.pid, "SIGTERM");
  } catch {
    return;
  }
  const started = Date.now();
  while (Date.now() - started < 5_000) {
    try {
      process.kill(runtime.process.pid, 0);
      await sleep(100);
    } catch {
      return;
    }
  }
  try {
    process.kill(runtime.process.pid, "SIGKILL");
  } catch {
    // ignore
  }
}

function stopPortIfOccupied(port: number): void {
  try {
    const command =
      process.platform === "win32"
        ? `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`
        : `lsof -ti tcp:${port}`;
    const output = requireCommand(command).trim();
    if (!output) return;
    const pid = Number(output.split(/\s+/)[0]);
    if (!Number.isFinite(pid)) return;
    try {
      if (process.platform === "win32") {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function requireCommand(command: string): string {
  const shellCommand =
    process.platform === "win32"
      ? `powershell -NoProfile -Command "${command.replaceAll('"', '\\"')}"`
      : command;
  return execSync(shellCommand, { encoding: "utf8" }).toString();
}

export function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

export function summarizeStage(values: number[]): PercentileStats {
  const totalMs = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    minMs: values.length ? Math.min(...values) : 0,
    maxMs: values.length ? Math.max(...values) : 0,
    avgMs: values.length ? totalMs / values.length : 0,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    p99Ms: percentile(values, 0.99),
    totalMs,
  };
}

export function summarizeStages(stageMetrics: StageMetrics): Record<string, PercentileStats> {
  return Object.fromEntries(
    Object.entries(stageMetrics).map(([name, values]) => [name, summarizeStage(values)]),
  );
}

export function summarizeStageGroups(
  stageStats: Record<string, PercentileStats>,
): Record<string, Record<string, PercentileStats>> {
  const groups: Record<string, Record<string, PercentileStats>> = {
    rootAccept: {},
    cdnPublish: {},
    discoverySync: {},
    fullE2E: {},
  };
  for (const [name, stats] of Object.entries(stageStats)) {
    if (name.startsWith("registrar.") || name.startsWith("root.accept")) {
      groups.rootAccept[name] = stats;
      continue;
    }
    if (name.startsWith("root.publishCdnBatch") || name.startsWith("cdn.")) {
      groups.cdnPublish[name] = stats;
      continue;
    }
    if (
      name.startsWith("root.notifyDiscoveryBatch") ||
      name.startsWith("discovery.sync") ||
      name.startsWith("discovery.query")
    ) {
      groups.discoverySync[name] = stats;
      continue;
    }
    groups.fullE2E[name] = stats;
  }
  return Object.fromEntries(
    Object.entries(groups).filter(([, value]) => Object.keys(value).length > 0),
  );
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export function cryptoSuiteToProofType(cryptoSuite: string): string {
  return cryptoSuite === "sm2-sm3" || cryptoSuite === "Sm2Sm3" ? "SM2Signature2020" : "Ed25519Signature2020";
}

export function cryptoSuiteToHashAlgorithm(cryptoSuite: string): string {
  return cryptoSuite === "sm2-sm3" || cryptoSuite === "Sm2Sm3" ? "SM3" : "SHA-256";
}

export function buildProof(payload: unknown, identity: IdentityMaterial): Record<string, unknown> {
  const privateKey = crypto.createPrivateKey({
    key: identity.privateKeyJwk,
    format: "jwk",
  });
  const payloadInput =
    identity.cryptoSuite === "ed25519-sha256-legacy" || identity.cryptoSuite === "Ed25519Sha256Legacy"
      ? crypto.createHash("sha256").update(canonicalJson(payload)).digest("hex")
      : canonicalJson(payload);
  return {
    type: cryptoSuiteToProofType(identity.cryptoSuite),
    creator: identity.keyId,
    created: nowIso(),
    proofPurpose: "assertionMethod",
    proofValue: crypto.sign(null, Buffer.from(payloadInput, "utf8"), privateKey).toString("base64url"),
    cryptoSuite: identity.cryptoSuite,
    hashAlgorithm: identity.hashAlgorithm,
    verificationMethod: identity.keyId,
  };
}

export function createAgentIdentity(
  semanticCode: string,
  capabilityTags: string[],
  serviceEndpoint: string,
  label: string,
): IdentityMaterial {
  return createResourceIdentity({
    semanticCode,
    resourceType: "agent_service",
    capabilityTags,
    serviceEndpoint,
    label,
    description: `${label} benchmark agent service resource`,
    protocol: "http",
    serviceType: "AgentService",
    identityType: "service-agent",
    useCaseExamples: ["Benchmark registration", "Benchmark discovery"],
  });
}

export function createResourceIdentity(options: ResourceIdentityOptions): IdentityMaterial {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyJwk = publicKey.export({ format: "jwk" }) as Record<string, any>;
  const privateKeyJwk = privateKey.export({ format: "jwk" }) as Record<string, any>;
  const publicKeyRaw = Buffer.from(publicKeyJwk.x, "base64url");
  const did = `did:oan:${options.semanticCode}:${didSuffixFromPublicKey(publicKeyRaw)}`;
  const keyId = `${did}#key-1`;
  const serviceEndpoint = options.serviceEndpoint ?? `https://example.org/oan/${options.resourceType}/${did.split(":").at(-1)}`;
  const protocol = options.protocol ?? (serviceEndpoint.startsWith("mcp:") ? "mcp" : new URL(serviceEndpoint).protocol.replace(":", ""));
  const serviceType = options.serviceType ?? defaultResourceServiceType(options.resourceType);
  const serviceVersion = options.serviceVersion ?? "1.0.0";
  const authorizedDomains = options.authorizedDomains ?? defaultAuthorizedDomains;
  const service =
    options.resourceType === "skill" && !options.serviceEndpoint
      ? []
      : [
          {
            id: `${did}#service`,
            type: serviceType,
            serviceEndpoint,
            version: serviceVersion,
            protocol,
            serverType: "benchmark-resource",
            port: serviceEndpoint.startsWith("http")
              ? Number(new URL(serviceEndpoint).port || (serviceEndpoint.startsWith("https:") ? 443 : 80))
              : 0,
          },
        ];
  const protocolBindings =
    options.protocolBindings ??
    (service.length > 0
      ? [
          {
            id: `${did}#binding-${protocol}`,
            protocol,
            version: serviceVersion,
            transport: options.transport ?? (protocol === "mcp" ? "streamable-http" : "http"),
            serviceRef: `${did}#service`,
          },
        ]
      : []);
  const resourceDescription = {
    name: options.label,
    description: options.description ?? `${options.label} benchmark ${options.resourceType} resource`,
    capabilityTags: options.capabilityTags,
    useCaseExamples:
      options.useCaseExamples ??
      [
        `Discover ${options.resourceType} resources by demand description`,
        `Validate ${options.resourceType} resource metadata before use`,
      ],
  };
  const oanMetadata: Record<string, any> = {
    subjectType: options.resourceType,
    resourceType: options.resourceType,
    identityType: options.identityType ?? options.resourceType,
    ttl: 300,
    resourceDescription,
    capabilityTags: options.capabilityTags,
    authorizedDomains,
    protocolBindings,
    implementationLinks: [],
    credentialRequirements: [],
    servicePolicy: "public-local-resolution",
    networkScope: "oan-local",
    lifecycleState: "active",
  };
  if (options.packageInfo) {
    oanMetadata.packageInfo = options.packageInfo;
  }
  const didDocument = {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/oan/v1"],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        cryptoSuite: "ed25519-sha256",
        publicKeyFormat: "multibase",
        publicKeyMultibase: `z${base58Encode(publicKeyRaw)}`,
        publicKeyJwk,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    service,
    oanMetadata,
  };
  return {
    did,
    keyId,
    didDocument,
    privateKeyJwk,
    publicKeyJwk,
    cryptoSuite: "ed25519-sha256",
    hashAlgorithm: "sha256",
    keypairPath: "",
  };
}

function defaultResourceServiceType(resourceType: DiscoverableResourceType): string {
  switch (resourceType) {
    case "agent_service":
      return "AgentService";
    case "skill":
      return "SkillManifest";
    case "mcp_server":
      return "McpServer";
    case "tool_api":
      return "ToolApi";
  }
}

export function createInfrastructureIdentity(
  options: InfrastructureIdentityOptions,
): IdentityMaterial {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyJwk = publicKey.export({ format: "jwk" }) as Record<string, any>;
  const privateKeyJwk = privateKey.export({ format: "jwk" }) as Record<string, any>;
  const publicKeyRaw = Buffer.from(publicKeyJwk.x, "base64url");
  const did = `did:oan:${options.semanticCode}:${didSuffixFromPublicKey(publicKeyRaw)}`;
  const keyId = `${did}#key-1`;
  const parsedEndpoint = new URL(options.serviceEndpoint);
  const serviceFragment = options.serviceFragment.startsWith("#")
    ? options.serviceFragment
    : `#${options.serviceFragment}`;
  const addressFragment = serviceFragment.replace(/^#/, "#addr-");
  const didDocument = {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/oan/v1"],
    id: did,
    verificationMethod: [
      {
        id: keyId,
        type: "Ed25519VerificationKey2020",
        controller: did,
        cryptoSuite: "ed25519-sha256",
        publicKeyFormat: "multibase",
        publicKeyMultibase: `z${base58Encode(publicKeyRaw)}`,
        publicKeyJwk,
      },
    ],
    authentication: [keyId],
    assertionMethod: [keyId],
    service: [
      {
        id: `${did}${serviceFragment}`,
        type: options.serviceType,
        serviceEndpoint: options.serviceEndpoint,
        version: "1.0.0",
        protocol: parsedEndpoint.protocol.replace(":", ""),
        serverType: options.serverType,
        port: Number(parsedEndpoint.port || (parsedEndpoint.protocol === "https:" ? 443 : 80)),
      },
    ],
    oanMetadata: {
      subjectType: "infrastructure_node",
      resourceType: "infrastructure_node",
      identityType: options.identityType,
      ttl: 300,
      resourceDescription: {
        name: options.role,
        description: options.description,
        capabilityTags: options.capabilityTags,
        useCaseExamples: [
          `${options.role} benchmark fixture`,
          "Support multi-node registration and discovery benchmark flows",
        ],
      },
      capabilityTags: options.capabilityTags,
      protocolBindings: [
        {
          id: `${did}#binding-${options.role}`,
          protocol: parsedEndpoint.protocol.replace(":", ""),
          version: "1.0.0",
          transport: "http",
          serviceRef: `${did}${serviceFragment}`,
        },
      ],
      servicePolicy: "public-local-resolution",
      networkScope: "oan-local",
      lifecycleState: "active",
    },
  };
  return {
    did,
    keyId,
    didDocument,
    privateKeyJwk,
    publicKeyJwk,
    cryptoSuite: "ed25519-sha256",
    hashAlgorithm: "sha256",
    keypairPath: "",
  };
}

export function buildResourceRegistrationFixture(
  identity: IdentityMaterial,
  options: {
    draftId: string;
    registrarDid?: string;
    resourceType?: string;
    packageVersion?: string;
    metadata?: Record<string, any>;
  },
): ResourceRegistrationFixture {
  const resourceType = options.resourceType ?? "agent_service";
  const packageVersion = options.packageVersion ?? "1.0.0";
  const didDocumentHash = prefixedSha256(identity.didDocument);
  const issuedAt = rustChronoIso(nowIso());
  const challenge = {
    challengeId: `${options.draftId}-challenge`,
    draftId: options.draftId,
    subjectDid: identity.did,
    didDocumentHash,
    registrarDid: options.registrarDid ?? "did:oan:AGRG:local-benchmark-registrar",
    purpose: "resource-registration",
    verificationMethod: identity.keyId,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
  const proof = buildProof(challenge, identity);
  const metadataInput = {
    name: options.metadata?.name ?? identity.did,
    description: options.metadata?.description ?? "Benchmark resource registration",
    capabilityTags:
      options.metadata?.capabilityTags ??
      identity.didDocument.oanMetadata?.capabilityTags ??
      [],
    authorizedDomains:
      options.metadata?.authorizedDomains ??
      identity.didDocument.oanMetadata?.authorizedDomains ??
      [],
    lifecycleState: options.metadata?.lifecycleState ?? "active",
    ...options.metadata,
  };
  const oanMetadata = identity.didDocument.oanMetadata ?? {};
  const resourceDescription = oanMetadata.resourceDescription;
  const resourceMetadata = omitUndefinedAndNull({
    resourceDid: identity.did,
    resourceType,
    subjectType: oanMetadata.subjectType ?? resourceType,
    publisherDid: oanMetadata.publisherDid,
    subjectDid: identity.did,
    name: metadataInput.name ?? resourceDescription?.name ?? identity.did,
    description: metadataInput.description ?? resourceDescription?.description ?? "",
    capabilityTags:
      metadataInput.capabilityTags ??
      (Array.isArray(oanMetadata.capabilityTags) && oanMetadata.capabilityTags.length > 0
        ? oanMetadata.capabilityTags
        : resourceDescription?.capabilityTags ?? []),
    authorizedDomains:
      metadataInput.authorizedDomains ??
      (Array.isArray(oanMetadata.authorizedDomains) ? oanMetadata.authorizedDomains : []),
    protocolBindings: (oanMetadata.protocolBindings ?? []).map(serializeProtocolBindingForRust),
    services: (identity.didDocument.service ?? []).map(serializeServiceEndpointForRust),
    lifecycleState: metadataInput.lifecycleState ?? oanMetadata.lifecycleState ?? "active",
    packageVersion,
    packageHash: "",
    metadataHash: "",
    hashAlgorithm: "sha256",
    updatedAt: issuedAt,
  });
  const metadataHash = prefixedSha256(resourceMetadata);
  const packageHash = prefixedSha256({
    packageVersion,
    resourceDid: identity.did,
    resourceType,
    didDocumentHash,
    metadataHash,
    hashAlgorithm: "sha256",
  });
  const controllerChallenge = {
    challengeId: `${options.draftId}-controller-authorization`,
    resourceDid: identity.did,
    controllerDid: identity.did,
    publisherDid: oanMetadata.publisherDid === identity.did ? identity.did : undefined,
    didDocumentHash,
    metadataHash,
    registrarDid: options.registrarDid ?? "did:oan:AGRG:local-benchmark-registrar",
    purpose: "resource-registration-controller-authorization",
    verificationMethod: identity.keyId,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt,
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
  const controllerProof = {
    ...buildProof(controllerChallenge, identity),
    proofPurpose: "capabilityInvocation",
  };
  return {
    resourceDid: identity.did,
    resourceType,
    didDocument: identity.didDocument,
    didDocumentHash,
    metadata: {
      ...metadataInput,
      ...resourceMetadata,
    },
    packageVersion,
    packageHash,
    metadataHash,
    hashAlgorithm: "sha256",
    registrationCredential: { status: "active", issuedAt },
    subjectControlProof: {
      challenge,
      proof,
      verifiedAt: issuedAt,
      verifiedVerificationMethod: identity.keyId,
      proofHash: prefixedSha256(proof),
    },
    controllerAuthorizationProof: {
      challenge: controllerChallenge,
      controllerDidDocument: publicDidDocumentSnapshot(identity),
      proof: controllerProof,
    },
  };
}

function publicDidDocumentSnapshot(identity: IdentityMaterial): Record<string, any> {
  return JSON.parse(JSON.stringify(identity.didDocument, (key, value) => {
    if (
      key === "privateKeyJwk" ||
      key === "privateKeyMultibase" ||
      key === "privateKeyBase58" ||
      key === "privateKeyHex" ||
      key === "d"
    ) {
      return undefined;
    }
    return value;
  }));
}

export function persistIdentityMaterial(dataDir: string, identity: IdentityMaterial): IdentityMaterial {
  writeJson(path.join(dataDir, "did-document.json"), identity.didDocument);
  writeJson(path.join(dataDir, "keys", "keypair.json"), {
    warning: "Development key only. Do not use in production.",
    did: identity.did,
    keyId: identity.keyId,
    algorithm: "Ed25519",
    cryptoSuite: identity.cryptoSuite,
    publicKeyMultibase:
      identity.didDocument?.verificationMethod?.[0]?.publicKeyMultibase ?? undefined,
    publicKeyJwk: identity.publicKeyJwk,
    privateKeyJwk: identity.privateKeyJwk,
  });
  return {
    ...identity,
    keypairPath: path.join(dataDir, "keys", "keypair.json"),
  };
}

export function loadIdentityMaterial(dataDir: string): IdentityMaterial {
  const keypair = readJson<any>(path.join(dataDir, "keys", "keypair.json"));
  const didDocument = readJson<Record<string, any>>(path.join(dataDir, "did-document.json"));
  return {
    did: didDocument.id,
    keyId: keypair.keyId,
    didDocument,
    privateKeyJwk: keypair.privateKeyJwk,
    publicKeyJwk: keypair.publicKeyJwk,
    cryptoSuite: keypair.cryptoSuite ?? "ed25519-sha256",
    hashAlgorithm: cryptoSuiteToHashAlgorithm(keypair.cryptoSuite ?? "ed25519-sha256"),
    keypairPath: path.join(dataDir, "keys", "keypair.json"),
  };
}

export function stageMetricPush(stageMetrics: StageMetrics, stage: string, value: number): void {
  if (!stageMetrics[stage]) {
    stageMetrics[stage] = [];
  }
  stageMetrics[stage].push(value);
}

export function hrtimeMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

export function timeNow(): bigint {
  return process.hrtime.bigint();
}

export function clampConcurrency(scale: number, desired: number): number {
  return Math.max(1, Math.min(scale, desired));
}

export function formatObservation(text: string): string {
  return `- ${text}`;
}

export function listDiscoveryCandidates(response: any): string[] {
  return Array.isArray(response?.candidates)
    ? response.candidates.map((candidate: any) => String(candidate.resourceDid ?? candidate.did))
    : [];
}

export async function observeIndexedResourceVisibility(
  discoveryBaseUrl: string,
  dids: string[],
  submittedAt: Map<string, number>,
  visibleAt: Map<string, number>,
  options: { timeoutMs?: number } = {},
): Promise<number> {
  const pending = dids.filter((did) => submittedAt.has(did) && !visibleAt.has(did));
  if (pending.length === 0) return 0;
  const response = await postJson<any>(
    `${discoveryBaseUrl}/discovery/index/resources/visibility`,
    { resourceDids: pending },
    { timeoutMs: options.timeoutMs ?? 120_000 },
  );
  const now = Date.now();
  const visible = Array.isArray(response?.visible) ? response.visible.map(String) : [];
  for (const did of visible) {
    if (submittedAt.has(did) && !visibleAt.has(did)) {
      visibleAt.set(did, now);
    }
  }
  return visible.length;
}

export function benchmarkRuntimeInfo(): Record<string, string> {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    node: process.version,
  };
}

export function copyServiceIdentity(
  source: string,
  target: string,
  options: { endpoint?: string } = {},
): void {
  ensureDir(target);
  const didDocument = readJson<Record<string, any>>(path.join(source, "did-document.json"));
  normalizeBenchmarkDidDocument(didDocument);
  if (options.endpoint) {
    rewriteServiceEndpoints(didDocument, options.endpoint);
  }
  writeJson(path.join(target, "did-document.json"), didDocument);
  ensureDir(path.join(target, "keys"));
  fs.copyFileSync(path.join(source, "keys", "keypair.json"), path.join(target, "keys", "keypair.json"));
}

export function copyGenesisNodeIdentity(
  nodeId: string,
  target: string,
  options: { endpoint?: string } = {},
): IdentityMaterial {
  const source = path.join(genesisNodesRoot, nodeId);
  if (!fs.existsSync(source)) {
    throw new Error(`missing genesis node identity: ${source}`);
  }
  ensureDir(target);
  const didDocument = readJson<Record<string, any>>(path.join(source, "did-document.json"));
  normalizeBenchmarkDidDocument(didDocument);
  normalizeGenesisVerificationMethods(didDocument);
  if (options.endpoint) {
    rewriteServiceEndpoints(didDocument, options.endpoint);
  }
  const privateKeyJwk = readJson<Record<string, any>>(path.join(source, "private-key.jwk.json"));
  const publicKeyJwk = readJson<Record<string, any>>(path.join(source, "public-key.jwk.json"));
  const did = String(didDocument.id);
  const keyId = String(privateKeyJwk.kid ?? publicKeyJwk.kid ?? `${did}#key-1`);
  const publicKeyMultibase =
    didDocument?.verificationMethod?.[0]?.publicKeyMultibase ??
    (publicKeyJwk.x ? `z${base58Encode(Buffer.from(String(publicKeyJwk.x), "base64url"))}` : undefined);
  writeJson(path.join(target, "did-document.json"), didDocument);
  ensureDir(path.join(target, "keys"));
  writeJson(path.join(target, "keys", "keypair.json"), {
    warning: "Genesis infrastructure key. Managed in oan-design-docs/genesis/nodes and copied read-only for tests/deployments.",
    did,
    keyId,
    algorithm: privateKeyJwk.crv === "Ed25519" ? "Ed25519" : String(privateKeyJwk.crv ?? "Ed25519"),
    cryptoSuite: "ed25519-sha256",
    publicKeyMultibase,
    publicKeyJwk,
    privateKeyJwk,
  });
  return {
    did,
    keyId,
    didDocument,
    privateKeyJwk,
    publicKeyJwk,
    cryptoSuite: "ed25519-sha256",
    hashAlgorithm: "sha256",
    keypairPath: path.join(target, "keys", "keypair.json"),
  };
}

function normalizeGenesisVerificationMethods(didDocument: Record<string, any>): void {
  const methods = Array.isArray(didDocument.verificationMethod)
    ? didDocument.verificationMethod
    : [];
  for (const method of methods) {
    if (!method || typeof method !== "object") continue;
    const jwk = method.publicKeyJwk;
    if (!method.cryptoSuite && jwk?.crv === "Ed25519") {
      method.cryptoSuite = "Ed25519Sha256";
    }
    if (!method.publicKeyFormat && jwk?.crv === "Ed25519") {
      method.publicKeyFormat = "multibase";
    }
    if (!method.publicKeyMultibase && typeof jwk?.x === "string") {
      method.publicKeyMultibase = `z${base58Encode(Buffer.from(jwk.x, "base64url"))}`;
    }
  }
}

export function writeGenesisAuthorizationState(
  rootDataDir: string,
  options: {
    registrarDirs?: string[];
    discoveryDirs?: string[];
    authorizedDomains?: string[];
  },
): void {
  const updatedAt = rustChronoIso(nowIso());
  const registrars: Record<string, any> = {};
  for (const dir of options.registrarDirs ?? []) {
    const didDocument = readJson<Record<string, any>>(path.join(dir, "did-document.json"));
    const authorizedDomains = options.authorizedDomains ?? didDocumentAuthorizedDomains(didDocument);
    registrars[String(didDocument.id)] = {
      status: "active",
      updated_at: updatedAt,
      did_document_hash: prefixedSha256(didDocument),
      didDocumentSnapshot: didDocument,
      authorizedDomains,
      tag_tree_version: 1,
    };
  }
  const discovery_nodes: Record<string, any> = {};
  for (const dir of options.discoveryDirs ?? []) {
    const didDocument = readJson<Record<string, any>>(path.join(dir, "did-document.json"));
    const authorizedDomains = options.authorizedDomains ?? didDocumentAuthorizedDomains(didDocument);
    discovery_nodes[String(didDocument.id)] = {
      status: "active",
      updated_at: updatedAt,
      did_document_hash: prefixedSha256(didDocument),
      didDocumentSnapshot: didDocument,
      authorized_domains: authorizedDomains,
      tag_tree_version: 1,
    };
  }
  writeJson(path.join(rootDataDir, "authorization-state.json"), {
    registrars,
    discovery_nodes,
    vc_issuers: {},
  });
}

function didDocumentAuthorizedDomains(didDocument: Record<string, any>): string[] {
  const domains = didDocument.oanMetadata?.authorizedDomains;
  return Array.isArray(domains) ? domains.map(String) : defaultAuthorizedDomains;
}

function rewriteServiceEndpoints(didDocument: Record<string, any>, endpoint: string): void {
  const services = Array.isArray(didDocument.service) ? didDocument.service : [];
  for (const service of services) {
    if (!service || typeof service !== "object") continue;
    const pathSuffix = typeof service.serviceEndpoint === "string"
      ? new URL(service.serviceEndpoint).pathname.replace(/\/$/, "")
      : "";
    service.serviceEndpoint = `${endpoint}${pathSuffix === "/" ? "" : pathSuffix}`;
    service.protocol = endpoint.startsWith("https:") ? "https" : "http";
    service.port = Number(new URL(endpoint).port || (endpoint.startsWith("https:") ? 443 : 80));
  }
  const bindings = didDocument.oanMetadata?.addressBindings;
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      if (!binding || typeof binding !== "object" || typeof binding.address !== "string") continue;
      const pathSuffix = new URL(binding.address).pathname.replace(/\/$/, "");
      binding.address = `${endpoint}${pathSuffix === "/" ? "" : pathSuffix}`;
    }
  }
}

function normalizeBenchmarkDidDocument(didDocument: Record<string, any>): void {
  const metadata = didDocument.oanMetadata;
  if (!metadata || typeof metadata !== "object") {
    return;
  }
  if (metadata.resourceType === "infrastructure-node") {
    metadata.resourceType = "infrastructure_node";
  }
  if (metadata.subjectType === "infrastructure-node") {
    metadata.subjectType = "infrastructure_node";
  }
  if (!metadata.resourceDescription && metadata.agentDescription) {
    metadata.resourceDescription = {
      description: metadata.agentDescription.capabilityDescription,
      capabilityTags: metadata.agentDescription.capabilityTags ?? [],
      useCaseExamples: metadata.agentDescription.useCaseExamples ?? [],
    };
  }
  if (!metadata.capabilityTags && metadata.resourceDescription?.capabilityTags) {
    metadata.capabilityTags = metadata.resourceDescription.capabilityTags;
  }
}

function postgresCliName(binaryBaseName: string): string {
  return process.platform === "win32" ? `${binaryBaseName}.exe` : binaryBaseName;
}

function findPostgresCli(binaryBaseName: string): string {
  const cliName = postgresCliName(binaryBaseName);
  const candidates = [
    path.join("D:", "ProgramFiles", "postgresql", "bin", cliName),
    path.join(workspaceRoot, ".tmp", "postgresql-bin", "pgsql", "bin", cliName),
    path.join(path.dirname(workspaceRoot), "OAN", ".tmp", "postgresql-bin", "pgsql", "bin", cliName),
    path.join(workspaceRoot, ".local", "postgres", "bin", cliName),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return cliName;
}

function extractDatabaseUrlFromConfig(configPath: string): string | null {
  const configText = fs.readFileSync(configPath, "utf8");
  const match = configText.match(/database_url\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

let benchmarkPostgresDatabasesReset = false;
const postgresDropDatabaseRetries = positiveIntegerEnv("OAN_BENCH_POSTGRES_DROP_RETRIES", 5);
const postgresDropDatabaseRetryDelayMs = positiveIntegerEnv("OAN_BENCH_POSTGRES_DROP_RETRY_DELAY_MS", 400);

function postgresAdminConnectionFromUrl(databaseUrl: string): {
  adminDb: string;
  host: string;
  port: string;
  user: string;
  password: string;
} {
  const parsed = new URL(databaseUrl);
  const adminDb = process.env.OAN_BENCH_POSTGRES_ADMIN_DB ?? "postgres";
  return {
    adminDb,
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || "postgres"),
  };
}

function runPsqlAdminCommand(
  connection: ReturnType<typeof postgresAdminConnectionFromUrl>,
  sql: string,
): string {
  const psql = findPostgresCli("psql");
  const env = {
    ...process.env,
    PGPASSWORD: connection.password,
  };
  return execFileSync(
    psql,
    [
      "-h",
      connection.host,
      "-p",
      connection.port,
      "-U",
      connection.user,
      "-d",
      connection.adminDb,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      sql,
    ],
    { env, stdio: ["ignore", "pipe", "ignore"], windowsHide: true, encoding: "utf8" },
  );
}

function quotePostgresLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function terminateDatabaseConnections(
  connection: ReturnType<typeof postgresAdminConnectionFromUrl>,
  dbName: string,
): void {
  runPsqlAdminCommand(
    connection,
    [
      "SELECT pg_terminate_backend(pid)",
      "FROM pg_stat_activity",
      `WHERE datname = ${quotePostgresLiteral(dbName)}`,
      "AND pid <> pg_backend_pid();",
    ].join(" "),
  );
}

function listBenchmarkPostgresDatabases(
  connection: ReturnType<typeof postgresAdminConnectionFromUrl>,
): string[] {
  const output = runPsqlAdminCommand(
    connection,
    "SELECT datname FROM pg_database WHERE datname LIKE 'oan_bench_%' ORDER BY datname;",
  );
  return output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function dropPostgresDatabaseWithRetries(
  connection: ReturnType<typeof postgresAdminConnectionFromUrl>,
  dbName: string,
): void {
  let lastError: unknown;
  for (let attempt = 1; attempt <= postgresDropDatabaseRetries; attempt += 1) {
    try {
      terminateDatabaseConnections(connection, dbName);
      runPsqlAdminCommand(connection, `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= postgresDropDatabaseRetries) {
        break;
      }
      sleepSync(postgresDropDatabaseRetryDelayMs);
    }
  }
  throw new Error(`failed to drop benchmark database ${dbName}: ${String(lastError)}`);
}

export function resetBenchmarkPostgresDatabases(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  if (!parsed.protocol.startsWith("postgres")) {
    return;
  }
  const connection = postgresAdminConnectionFromUrl(databaseUrl);
  const databaseNames = listBenchmarkPostgresDatabases(connection);
  for (const dbName of databaseNames) {
    dropPostgresDatabaseWithRetries(connection, dbName);
  }
  const remaining = listBenchmarkPostgresDatabases(connection);
  if (remaining.length > 0) {
    throw new Error(`benchmark database reset left residual databases: ${remaining.join(", ")}`);
  }
}

export function ensurePostgresDatabaseByUrl(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  if (!parsed.protocol.startsWith("postgres")) {
    return;
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!dbName) {
    throw new Error(`database_url is missing database name: ${databaseUrl}`);
  }
  const connection = postgresAdminConnectionFromUrl(databaseUrl);
  dropPostgresDatabaseWithRetries(connection, dbName);
  runPsqlAdminCommand(connection, `CREATE DATABASE "${dbName}";`);
}

export function ensurePostgresDatabasesFromConfigs(configPaths: string[]): void {
  const databaseUrls = configPaths
    .map((configPath) => extractDatabaseUrlFromConfig(configPath))
    .filter((databaseUrl): databaseUrl is string => Boolean(databaseUrl));
  if (!benchmarkPostgresDatabasesReset) {
    const firstPostgresUrl = databaseUrls.find((databaseUrl) => new URL(databaseUrl).protocol.startsWith("postgres"));
    if (firstPostgresUrl) {
      resetBenchmarkPostgresDatabases(firstPostgresUrl);
      benchmarkPostgresDatabasesReset = true;
    }
  }
  for (const configPath of configPaths) {
    const databaseUrl = extractDatabaseUrlFromConfig(configPath);
    if (databaseUrl) {
      ensurePostgresDatabaseByUrl(databaseUrl);
    }
  }
}

function benchmarkDatabaseUrl(relativeSqlitePath: string, postgresDatabaseName: string): string {
  if (benchmarkDatabaseBackend === "sqlite") {
    return `sqlite:${relativeSqlitePath.replaceAll("\\", "/")}`;
  }
  return `postgres://postgres:postgres@127.0.0.1:5432/${postgresDatabaseName}`;
}

export function seedRootBulletin(
  sourceRoot: string,
  targetRoot: string,
  options: { cdnPort?: number } = {},
): void {
  const sourceBulletin = readJson<any>(path.join(sourceRoot, "bulletin.json"));
  const seeded = {
    ...sourceBulletin,
    events: Array.isArray(sourceBulletin.events) ? sourceBulletin.events.slice(0, 2) : [],
  };
  if (options.cdnPort) {
    const cdnBaseUrl = `http://localhost:${options.cdnPort}`;
    for (const event of seeded.events) {
      if (event?.eventType !== "CDN_SERVICE_INFO_UPDATED" || !event.payload) continue;
      event.payload = {
        ...event.payload,
        baseUrl: cdnBaseUrl,
        resourceIndexUrl: `${cdnBaseUrl}/cdn/resources/index`,
        resourcePublishUrl: `${cdnBaseUrl}/cdn/resources`,
        resourceUrlTemplate: `${cdnBaseUrl}/cdn/resources/{did}`,
      };
    }
  }
  writeJson(path.join(targetRoot, "bulletin.json"), seeded);
}

export function writeBenchmarkRootConfig(
  configPath: string,
  runtime: { rootPort: number },
  rootDid: string,
  options: {
    workers?: typeof rootWorkerProfile;
    events?: typeof rootEventStreamProfile;
    trustIndexerEndpoint?: string;
    trustIndexerEnabled?: boolean;
  } = {},
): void {
  const docsTree = capabilityTreeFixturePath;
  const workers = options.workers ?? rootWorkerProfile;
  const events = options.events ?? rootEventStreamProfile;
  const trustIndexerEndpoint = options.trustIndexerEndpoint ?? "http://127.0.0.1:8088";
  const trustIndexerEnabled = options.trustIndexerEnabled ?? false;
  writeText(
    configPath,
    `
[server]
host = "127.0.0.1"
port = ${runtime.rootPort}
endpoint = "http://localhost:${runtime.rootPort}"

[cors]
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

[node]
name = "Root Node"
role = "root"
did_semantic_code = "AGRT"

[security.admin]
mode = "static-token"
static_tokens = ["${adminToken}"]

[security.workers]
enabled = ${workers.enabled ? "true" : "false"}
cdn_interval_ms = ${workers.cdnIntervalMs}
discovery_interval_ms = ${workers.discoveryIntervalMs}
cdn_batch_size = ${workers.cdnBatchSize}
discovery_batch_size = ${workers.discoveryBatchSize}
cdn_concurrency = ${workers.cdnConcurrency}
discovery_concurrency = ${workers.discoveryConcurrency}
admission_concurrency = ${workers.admissionConcurrency}
http_timeout_seconds = ${workers.httpTimeoutSeconds}
lease_seconds = ${workers.leaseSeconds}
retry_backoff_seconds = ${workers.retryBackoffSeconds}

[security.trust_indexer]
enabled = ${trustIndexerEnabled ? "true" : "false"}
endpoint = "${trustIndexerEndpoint}"
fail_mode = "closed"
timeout_ms = 500
poll_interval_ms = 3000

[events]
enabled = ${events.enabled ? "true" : "false"}
backend = "${events.backend}"
endpoint = "${events.endpoint}"
stream = "${events.stream}"
cdn_publish_subject = "${events.cdnPublishSubject}"
publish_timeout_ms = ${events.publishTimeoutMs}
failure_mode = "${events.failureMode}"

[debug]
export_snapshots = false

[paths]
data_dir = "../root"
keys_dir = "../root/keys"
bulletin_file = "../root/bulletin.json"
authorization_state_file = "../root/authorization-state.json"
request_nonce_file = "../root/request-nonces.json"
controller_authorization_nonce_file = "../root/controller-authorization-nonces.json"
capability_tree_file = "${docsTree.replaceAll("\\", "\\\\")}"
database_url = "${benchmarkDatabaseUrl("../root/root.db", "oan_bench_root")}"
`.trim(),
  );
}

export function writeBenchmarkCdnPublisherConfig(
  configPath: string,
  runtime: { publisherPort: number; rootPort: number; cdnPort: number },
  options: {
    events?: typeof rootEventStreamProfile;
    publisher?: typeof cdnPublisherProfile;
    rootKeysDirRelative?: string;
  } = {},
): void {
  const events = options.events ?? rootEventStreamProfile;
  const publisher = options.publisher ?? cdnPublisherProfile;
  const rootKeysDirRelative = options.rootKeysDirRelative ?? "../root/keys";
  writeText(
    configPath,
    `
[server]
host = "127.0.0.1"
port = ${runtime.publisherPort}

[events]
endpoint = "${events.endpoint}"
stream = "${events.stream}"
subject = "${events.cdnPublishSubject}"
durable_consumer = "${publisher.durableConsumer}"
batch_size = ${publisher.batchSize}
fetch_timeout_ms = ${publisher.fetchTimeoutMs}
max_in_flight = ${publisher.maxInFlight}

[root]
endpoint = "http://localhost:${runtime.rootPort}"
keys_dir = "${rootKeysDirRelative}"
admin_token = "${adminToken}"
package_batch_path = "/root/internal/cdn-publication-jobs/packages"
mark_published_path = "/root/internal/cdn-publication-jobs/mark-published"

[cdn]
endpoint = "http://localhost:${runtime.cdnPort}"
publish_batch_path = "/cdn/resources/batch"
http_timeout_seconds = ${publisher.httpTimeoutSeconds}
`.trim(),
  );
}

export function writeBenchmarkRegistrarConfig(
  configPath: string,
  runtime: { registrarPort: number; rootPort: number },
  rootDid: string,
  dataDirRelative: string,
): void {
  writeText(
    configPath,
    `
[server]
host = "127.0.0.1"
port = ${runtime.registrarPort}
endpoint = "http://localhost:${runtime.registrarPort}"

[cors]
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

[node]
name = "Registrar Node"
role = "registrar"
did_semantic_code = "AGRG"

[upstream]
root_endpoint = "http://localhost:${runtime.rootPort}"

[security.upstream]
protocol_label = "ans-2026"
root_did = "${rootDid}"

[security.submit]
max_in_flight = 16
retry_after_seconds = 1
upstream_timeout_ms = 120000

[paths]
data_dir = "../${dataDirRelative}"
records_dir = "../${dataDirRelative}/records"
keys_dir = "../${dataDirRelative}/keys"
database_url = "${benchmarkDatabaseUrl(`../${dataDirRelative}/registrar.db`, `oan_bench_${dataDirRelative.replaceAll("-", "_")}`)}"
`.trim(),
  );
}

export function writeBenchmarkDiscoveryConfig(
  configPath: string,
  runtime: { discoveryPort: number; rootPort: number; cdnPort: number },
  dataDirRelative: string,
): void {
  writeText(
    configPath,
    `
[server]
host = "127.0.0.1"
port = ${runtime.discoveryPort}
endpoint = "http://localhost:${runtime.discoveryPort}"

[cors]
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

[node]
name = "Discovery Node"
role = "discovery"
did_semantic_code = "AGDS"

[upstream]
root_endpoint = "http://localhost:${runtime.rootPort}"
cdn_endpoint = "http://localhost:${runtime.cdnPort}"

[paths]
data_dir = "../${dataDirRelative}"
index_dir = "../${dataDirRelative}/index"
database_url = "${benchmarkDatabaseUrl(`../${dataDirRelative}/discovery.db`, `oan_bench_${dataDirRelative.replaceAll("-", "_")}`)}"
keys_dir = "../${dataDirRelative}/keys"
`.trim(),
  );
}

export function writeBenchmarkCdnConfig(
  configPath: string,
  runtime: { cdnPort: number; rootPort: number },
  rootDid: string,
): void {
  writeText(
    configPath,
    `
[server]
host = "127.0.0.1"
port = ${runtime.cdnPort}
endpoint = "http://localhost:${runtime.cdnPort}"

[cors]
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

[service]
name = "CDN Service"
role = "cdn-service"
provider = "local"

[security.admin]
mode = "static-token"
static_tokens = ["${adminToken}"]

[security.trusted_upstream]
root_did = "${rootDid}"
root_did_document_file = "../root/did-document.json"
nonce_store_file = "../cdn/request-nonces.json"

[upstream]
root_endpoint = "http://localhost:${runtime.rootPort}"

[paths]
data_dir = "../cdn"
manifest_file = "../cdn/manifest.json"
documents_dir = "../cdn/documents"
metadata_dir = "../cdn/metadata"
resources_dir = "../cdn/resources"
database_url = "${benchmarkDatabaseUrl("../cdn/cdn.db", "oan_bench_cdn")}"
`.trim(),
  );
}
