#!/usr/bin/env python3
"""One bounded discovery pass, suitable for a user-configured local scheduler.

Never calls DeepSeek, commits, pushes or deploys. Scheduling is opt-in and not
installed by this program. Do not run concurrently with the editing server.
"""
import argparse
import json
import time
from pathlib import Path
from workspace_store import WorkspaceStore, WorkspaceLease


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lookback", type=int, default=30)
    parser.add_argument("--max-items", type=int, default=1000)
    parser.add_argument("--every-hours", type=int, default=0,
                        help="Opt-in local recurring metadata refresh (1–168 hours); 0 runs once")
    args = parser.parse_args()
    if not 1 <= args.lookback <= 3650 or not 1 <= args.max_items <= 10000:
        parser.error("lookback must be 1–3650 days; max-items 1–10000 per venue")
    if not 0 <= args.every_hours <= 168:
        parser.error("every-hours must be 0–168")
    root = Path(__file__).resolve().parent.parent
    while True:
        with WorkspaceLease(root):
            store = WorkspaceStore(root)
            report = store.refresh(lookback=args.lookback, max_items=args.max_items)
        print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
        if not args.every_hours:
            return 0 if all(source["complete"] for source in report["sources"]) else 1
        time.sleep(args.every_hours * 3600)


if __name__ == "__main__":
    raise SystemExit(main())
