# Research workspace acceptance record

Verified on 2026-11-12 against the feature branch `feat/deepseek-research-workspace`.
This is an acceptance record, not a claim that the changes are deployed.

## Automated checks

- 69 Python unit/integration tests passed, including local authentication, stale-revision conflicts, ingestion pagination/checkpoints, provider response validation, and public/private snapshot isolation.
- `node scripts/test_workspace_ui.mjs` passed, including source pending/error reporting, request/response behavior and editor safety.
- `node scripts/test-site-worker.mjs` passed.
- `python scripts/build_data.py`, Astro production build (36 pages), and `python scripts/validate_agent_data.py --site-dir dist` passed. Corpus: 2,511 records; 9 agent resources.
- `git diff --check` passed.

## Cloud-computer browser checks

A temporary copy of the built website and source data was used. Test notes and AI fixtures were not written to the repository's production data.

| Workflow | Observed outcome |
| --- | --- |
| Connect local workspace | Session connected; token input cleared. Token is a local session credential, not an AI key. |
| Find a paper | Searching `AtomFlow` narrowed the corpus to one result and opened its Wiki editor. |
| Save and restore Wiki | Saved v1 and v2; restoring v1 after confirmation created v3 with the original body. |
| Concurrent editing | Two pages edited the same paper. After one saved v2, the other received a 409 conflict and retained its unsaved body. |
| Missing AI credential | Without a server API key, generation was disabled and the UI explained the missing configuration. |
| AI workflow (mock only) | A fixed response visibly labeled `QA-MOCK-NO-NETWORK` was generated, adopted into the editor, then explicitly saved. The test never contacted DeepSeek. |
| Real discovery request | The two default Crossref sources returned bounded partial results, with 0 new papers in this run. This verified provider requests, not completion of historical ingestion. The UI now distinguishes pending, failed and completed sources and reports scanned records. |
| Disconnect | Returned to the public read-only snapshot; private local edits disappeared from the public view. |
| Desktop presentation | Light and dark themes rendered in the cloud browser at a 1,180 px viewport, with no horizontal overflow (document width 1,170 px). |

## Privacy repair

Local state (`data_src/workspace.json`) is ignored by Git. Ordinary builds read only an explicitly prepared public snapshot. Revision history, edit summaries, pending ingestion checkpoints and unadopted AI drafts are excluded from public output. Run `python scripts/prepare_workspace_publication.py --confirm-public` only after reviewing current saved content, then inspect the generated snapshot diff. The command does not push or deploy. Regression tests cover private-field exclusion, ordinary-build isolation, fresh-checkout recovery and conflicting public revisions.

## Remaining limits

- Real DeepSeek API authentication, billing, network errors and model quality remain unverified. Use a newly issued key through a secure server-side environment variable; do not use the key previously shared in chat.
- Real ingestion returned partial windows, not a completed backfill or a positive new-paper discovery. Further refreshes and source-specific tuning may be required.
- Mobile-device interaction was not separately exercised. The existing responsive styles were built but are not equivalent to device acceptance testing.
- No new scheduled job was activated, and no merge or deployment was performed. GitHub Pages remains read-only; editing and AI calls require the local service.
