/** Repository-local lifecycle observers for the experiment's OAN topology. */
import { getJson, sleep } from "./runtime.ts";

async function waitForCount(description: string, url: string, readCount: (payload: any) => number,
  target: number, timeoutMs: number, reject?: (payload: any) => string | undefined): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  while (Date.now() < deadline) {
    const payload = await getJson<any>(url);
    const failure = reject?.(payload);
    if (failure) throw new Error(failure);
    lastCount = readCount(payload);
    if (lastCount >= target) return payload;
    await sleep(250);
  }
  throw new Error(`${description} did not reach ${target}; last count was ${lastCount}`);
}
export function waitForRootEventPublish(rootBaseUrl: string, target: number, timeoutMs = 120_000): Promise<any> {
  return waitForCount("Root publication count", `${rootBaseUrl}/root/status`,
    (status) => Number(status?.eventRuntime?.publish_success_count ?? 0), target, timeoutMs,
    (status) => Number(status?.eventRuntime?.publish_failure_count ?? 0) > 0
      ? `Root event publication failed: ${JSON.stringify(status.eventRuntime)}` : undefined);
}
export function waitForPublisherAck(publisherBaseUrl: string, target: number, timeoutMs = 120_000): Promise<any> {
  return waitForCount("CDN publisher acknowledgement count", `${publisherBaseUrl}/status`,
    (status) => Number(status?.runtime?.total_acked_count ?? 0), target, timeoutMs,
    (status) => Number(status?.runtime?.total_failed_count ?? 0) > 0
      ? `CDN publisher failed: ${JSON.stringify(status.runtime)}` : undefined);
}
export function waitForCdnResourceCount(cdnBaseUrl: string, target: number, timeoutMs = 120_000): Promise<any> {
  return waitForCount("CDN resource count", `${cdnBaseUrl}/cdn/status`,
    (status) => Number(status?.resourceCount ?? 0), target, timeoutMs);
}
export function waitForDiscoveryIndexedCount(discoveryBaseUrl: string, target: number, timeoutMs = 120_000): Promise<any> {
  return waitForCount("Discovery index count", `${discoveryBaseUrl}/discovery/index/stats`,
    (stats) => Number(stats?.indexedResourceCount ?? stats?.resourceCount ?? 0), target, timeoutMs);
}
