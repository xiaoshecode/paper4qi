#!/usr/bin/env python3
"""Prepare a reviewed public snapshot without publishing it.

Includes current Wiki content, all research revisions, edit summaries, AI drafts
and discovered metadata. Runtime credentials, actor identities and checkpoints
remain excluded; existing local state is never automatically uploaded.
"""
import argparse
from pathlib import Path
from workspace_store import WorkspaceLease, prepare_public_snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-public", action="store_true",
                        help="Confirm current content, all research history and AI drafts are suitable for the public repository")
    args = parser.parse_args()
    if not args.confirm_public:
        parser.error("Review saved Wiki content, every research revision and AI draft first, then pass --confirm-public. Nothing was written.")
    root = Path(__file__).resolve().parent.parent
    with WorkspaceLease(root):
        snapshot = prepare_public_snapshot(root)
    print(f"Prepared data_src/workspace-public.json: {len(snapshot['articles'])} saved articles, "
          f"{len(snapshot['discoveries'])} discovered papers. Review the diff before committing. "
          "Research history and AI drafts included; runtime credentials and identities excluded. Nothing was pushed or deployed.")


if __name__ == "__main__":
    main()
