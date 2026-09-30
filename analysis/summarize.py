"""Validate and aggregate task-summary.csv into paper-ready tables and figures."""
from __future__ import annotations
import argparse, csv, json
from collections import defaultdict
from pathlib import Path

NUMERIC = ("adaptationLatencyMs", "packageFetchLatencyMs", "verificationLatencyMs", "nativeLatencyMs", "endToEndLatencyMs")

def rows(path: Path) -> list[dict[str, str]]:
    with (path / "task-summary.csv").open(encoding="utf-8", newline="") as handle: return list(csv.DictReader(handle))

def validate(path: Path, records: list[dict[str, str]]) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    for row in records:
        for key in NUMERIC:
            try:
                if float(row[key]) < 0: raise ValueError("negative latency")
            except (KeyError, ValueError) as exc: errors.append({"taskId": row.get("taskId", ""), "error": f"{key}:{exc}"})
        if row.get("taskCompleted") == "True" and row.get("serviceStatus") not in ("success", "fallback-success"): errors.append({"taskId": row.get("taskId", ""), "error": "completed-without-successful-service"})
        if row.get("decision") == "block" and row.get("nativeCallIssued") == "True": errors.append({"taskId": row.get("taskId", ""), "error": "blocked-call-issued"})
    (path / "data-quality-errors.jsonl").write_text("".join(json.dumps(item) + "\n" for item in errors), encoding="utf-8")
    return errors

def aggregate(records: list[dict[str, str]]) -> list[dict[str, str]]:
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in records: grouped[(row["profile"], row["protocol"])].append(row)
    output = []
    for (profile, protocol), items in sorted(grouped.items()):
        count = len(items); mean = lambda key: sum(float(x[key]) for x in items) / count
        output.append({"profile": profile, "protocol": protocol, "samples": str(count), "taskCompletionRate": f"{sum(x['taskCompleted']=='True' for x in items)/count:.6f}", "blockRate": f"{sum(x['blockRate']=='1' for x in items)/count:.6f}", "fallbackSuccessRate": f"{sum(x['fallbackSuccess']=='1' for x in items)/count:.6f}", "meanEndToEndLatencyMs": f"{mean('endToEndLatencyMs'):.6f}", "meanVerificationLatencyMs": f"{mean('verificationLatencyMs'):.6f}"})
    return output

def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--input", required=True); args = parser.parse_args(); path = Path(args.input); records = rows(path); errors = validate(path, records); summary = aggregate(records)
    fields = list(summary[0]) if summary else ["profile", "protocol", "samples"]
    with (path / "comparison-summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(summary)
    (path / "analysis-manifest.json").write_text(json.dumps({"input": str(path), "rawRows": len(records), "dataQualityErrors": len(errors), "derived": ["comparison-summary.csv"]}, indent=2), encoding="utf-8")
    print(json.dumps({"rawRows": len(records), "groups": len(summary), "dataQualityErrors": len(errors)}, indent=2))

if __name__ == "__main__": main()
