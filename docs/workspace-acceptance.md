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
- The default-source ingestion run returned partial windows. The independent positive control below proves real insertion and same-window deduplication, not a complete historical backfill or unattended scheduling.
- Mobile-device interaction was not separately exercised. The existing responsive styles were built but are not equivalent to device acceptance testing.
- No new scheduled job was activated, and no merge or deployment was performed. GitHub Pages remains read-only; editing and AI calls require the local service.

## Follow-up: live positive discovery control

On 2026-11-12, an isolated temporary workspace followed **Quantum** (ISSN `2521-327X`) with the keyword `quantum`, independently of the default QCE/TQE sources. The full existing 2,511-record corpus was copied into the test workspace to retain real corpus deduplication. No production source configuration was changed.

Before ingestion, a live Crossref DOI lookup confirmed that [Overview and Comparison of Gate Level Quantum Software Platforms](https://doi.org/10.22331/q-2019-03-25-130) was absent from that corpus, matched the actual ISSN/type/title/relevance filters, and had an indexed date of **2026-10-13**. This is an indexed-date control, not a claim that the 2019 paper was newly published.

Using the production `WorkspaceStore.refresh` and `fetch_venue` code against the live Crossref journal endpoint, with the historical single-day window and a raw-record budget of 1,000:

| Check | Result |
| --- | --- |
| First real request | 18 records scanned; 16 eligible papers added; 0 updated |
| Expected DOI | Present in persisted discoveries |
| Source completion | `status=ok`, `complete=true`; checkpoint `2026-10-13`; no pending windows |
| Second real request for the identical day | 18 scanned; 0 added; 0 updated; discovery count remained 16; source complete |
| Persistence | Reopened `WorkspaceStore` from disk and read the expected DOI successfully |
| Isolation | SHA-256 hashes of every file under production `data_src` and `public/data` were unchanged |

The second test supplied a fetcher that pinned the query to the same day while still calling the real production Crossref fetch function. This deliberately excludes the normal two-day overlap from this particular deduplication control. Both passes used real network responses, not recorded fixtures. Temporary state was removed after the checks. No functional defect was observed.

This closes the earlier missing positive-insertion evidence. It does not verify the entire Crossref backfill, default-source completion, every journal/conference, scheduled execution, or DeepSeek integration. Crossref indexing can change, so the exact counts are observations from this run rather than permanent assertions.
