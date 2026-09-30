"""Generate compact paper-ready PNG and PDF figures from comparison-summary.csv."""
from __future__ import annotations
import argparse, csv
from pathlib import Path

def main() -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True); args = parser.parse_args(); path = Path(args.input)
    with (path / "comparison-summary.csv").open(encoding="utf-8", newline="") as handle: rows = list(csv.DictReader(handle))
    profiles = ["split", "unverified-unified", "trusted-unified"]; protocols = ["mcp", "skill", "openapi", "a2a"]; labels = ["Split", "Unified", "Trusted"]
    def draw(field: str, ylabel: str, stem: str) -> None:
        fig, ax = plt.subplots(figsize=(6.4, 3.2))
        width = 0.22; xs = list(range(len(protocols)))
        for i, profile in enumerate(profiles):
            values = [float(next((r[field] for r in rows if r["profile"] == profile and r["protocol"] == protocol), 0.0)) for protocol in protocols]
            ax.bar([x + (i - 1) * width for x in xs], values, width, label=labels[i])
        ax.set_xticks(xs, [p.upper() for p in protocols]); ax.set_ylabel(ylabel); ax.grid(axis="y", alpha=0.25); ax.legend(frameon=False, ncol=3, fontsize=8); fig.tight_layout(); fig.savefig(path / f"{stem}.pdf"); fig.savefig(path / f"{stem}.png", dpi=220); plt.close(fig)
    draw("taskCompletionRate", "Task completion rate", "fig-task-completion"); draw("blockRate", "Block rate", "fig-block-rate"); draw("meanEndToEndLatencyMs", "Mean end-to-end latency (ms)", "fig-latency"); draw("fallbackSuccessRate", "Fallback success rate", "fig-fallback-success")

if __name__ == "__main__": main()
