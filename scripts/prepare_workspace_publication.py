#!/usr/bin/env python3
"""Prepare a reviewed public snapshot without publishing it.

Includes all current human-saved Wiki content and discovered paper metadata.
Excludes revision history, edit summaries, AI drafts, and collection checkpoints.
"""
import argparse
from pathlib import Path
from workspace_store import WorkspaceLease, prepare_public_snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-public", action="store_true",
                        help="Confirm all current saved content is suitable for the public repository")
    args = parser.parse_args()
    if not args.confirm_public:
        parser.error("Review current saved Wiki content first, then pass --confirm-public. Nothing was written.")
    root = Path(__file__).resolve().parent.parent
    with WorkspaceLease(root):
        snapshot = prepare_public_snapshot(root)
    print(f"Prepared data_src/workspace-public.json: {len(snapshot['articles'])} saved articles, "
          f"{len(snapshot['discoveries'])} discovered papers. Review the diff before committing. "
          "No history or AI drafts included. Nothing was pushed or deployed.")


if __name__ == "__main__":
    main()
