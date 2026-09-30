"""Task-chain skeleton; native calls will be added after local mock contracts are fixed."""
import argparse, json
def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--config", required=True); args = parser.parse_args()
    with open(args.config, encoding="utf-8") as handle: config = json.load(handle)
    print(json.dumps({"stage": "preflight", "chain": config["task"]["chain"], "verificationProfile": config["verificationProfile"]}, ensure_ascii=False))
if __name__ == "__main__": main()
