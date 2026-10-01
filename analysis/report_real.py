import argparse,json,statistics
from pathlib import Path
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('input'); p=Path(ap.parse_args().input); m=json.loads((p/'run-manifest.json').read_text()); r=json.loads((p/'task-results.json').read_text()); out={'real':m['mode']=='real-oan-local' and m.get('databaseBackend','sqlite')=='sqlite','resources':m['registeredCount'],'tasks':len(r),'discovery_success':sum(x['discoveryCandidates']>0 for x in r),'native_success':sum(x['nativeStatus']==200 for x in r),'mean_latency_ms':statistics.mean(x['endToEndLatencyMs'] for x in r)}; (p/'report.json').write_text(json.dumps(out,indent=2)); print(json.dumps(out,indent=2))
