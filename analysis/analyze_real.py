"""Aggregate real local OAN cross-protocol results and generate paper figures."""
from __future__ import annotations
import argparse, json, statistics
from collections import defaultdict
from pathlib import Path
import matplotlib.pyplot as plt

def main() -> None:
    ap=argparse.ArgumentParser(); ap.add_argument("--input",required=True); args=ap.parse_args(); p=Path(args.input)
    manifest=json.loads((p/"run-manifest.json").read_text(encoding="utf-8")); rows=json.loads((p/"task-results.json").read_text(encoding="utf-8")); grouped=defaultdict(list)
    for row in rows: grouped[row["protocol"]].append(row)
    summary={"mode":manifest["mode"],"databaseBackend":manifest.get("databaseBackend","sqlite"),"resourcesPerProtocol":manifest.get("resourcesPerProtocol"),"totalResources":manifest.get("totalResources",manifest["registeredCount"]),"registeredCount":manifest["registeredCount"],"discoveryIndexedCount":manifest["discoveryIndexedCount"],"protocols":manifest["protocols"],"tasks":len(rows),"meanEndToEndLatencyMs":statistics.mean(float(x["endToEndLatencyMs"]) for x in rows),"byProtocol":{k:{"populationSize":v[0].get("populationSize",manifest.get("resourcesPerProtocol")),"samples":len(v),"meanLatencyMs":statistics.mean(float(x["endToEndLatencyMs"]) for x in v),"allDiscoveryCandidatesPositive":all(int(x["discoveryCandidates"])>0 for x in v),"allNativeCallsSuccessful":all(int(x["nativeStatus"])==200 for x in v)} for k,v in sorted(grouped.items())}}
    (p/"paper-metrics.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    labels=list(sorted(grouped)); vals=[summary["byProtocol"][k]["meanLatencyMs"] for k in labels]; plt.figure(figsize=(5.8,3.3)); plt.bar(labels,vals,color="#70AD47"); plt.ylabel("End-to-end latency (ms)"); plt.title("Real local OAN cross-protocol invocation"); plt.tight_layout(); plt.savefig(p/"protocol-latency.png",dpi=220); plt.savefig(p/"protocol-latency.pdf"); plt.close()
    counts=[sum(int(x["discoveryCandidates"])>0 for x in grouped[k]) for k in labels]; plt.figure(figsize=(5.8,3.3)); plt.bar(labels,counts,color="#ED7D31"); plt.ylabel("Successful discovery-backed tasks"); plt.title("Discovery and native-call completion"); plt.tight_layout(); plt.savefig(p/"protocol-success.png",dpi=220); plt.savefig(p/"protocol-success.pdf"); plt.close(); print(json.dumps(summary,indent=2))
if __name__=="__main__": main()
