from __future__ import annotations
import argparse, json
from pathlib import Path

def main() -> None:
    ap = argparse.ArgumentParser(); ap.add_argument("--root", required=True); args = ap.parse_args()
    root = Path(args.root); profiles = ["split", "unverified-unified", "trusted-unified"]
    rows = []
    for profile in profiles:
        data = json.loads((root / f"real-oan-rust-core-{profile}" / "paper-metrics.json").read_text(encoding="utf-8"))
        rows.append({"profile": profile, "meanEndToEndLatencyMs": data["meanEndToEndLatencyMs"], "registeredCount": data["registeredCount"], "indexedCount": data["discoveryIndexedCount"], "tasks": data["tasks"]})
    (root / "comparison-summary.json").write_text(json.dumps({"profiles": rows, "resourcesPerProtocol": 50, "totalResources": 200}, indent=2), encoding="utf-8")
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        labels = ["Split", "Unified", "Trusted"]; latency = [r["meanEndToEndLatencyMs"] for r in rows]
        fig, ax = plt.subplots(figsize=(5.8, 3.2)); ax.bar(labels, latency, color=["#7F7F7F", "#4472C4", "#70AD47"]); ax.set_ylabel("Mean end-to-end latency (ms)"); ax.set_title("Invocation profile comparison"); ax.grid(axis="y", alpha=.25); fig.tight_layout(); fig.savefig(root / "comparison-latency.pdf"); fig.savefig(root / "comparison-latency.png", dpi=220); plt.close(fig)
    except ImportError:
        pass
if __name__ == "__main__": main()
