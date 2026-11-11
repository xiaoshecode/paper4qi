# Research workspace: visual and interaction refinement

## Direction

Keep the existing paper4qi indigo palette and light/dark CSS tokens. Put research content ahead of configuration, with a restrained three-step orientation strip, a quieter inbox, and a stronger paper reading surface. The notebook illustration is a small inline SVG, with no downloaded fonts or external assets.

References reviewed:

- [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh), March 12, 2026. Applied the principles of quieter navigation, predictable action placement, and softer structural borders, without copying its interface.
- [Zotero: Collections and Tags](https://www.zotero.org/support/collections_and_tags). Applied the separation of library filtering and selected-item detail. No collection model or tag semantics were changed.

## Changes

- Explicit public/local/connected labels. Public hosting hides the unusable token form and links to local setup instead.
- Category filter, title sorting, result counts, and a single clear-filter action. `/` focuses search outside editable controls.
- Sticky, viewport-bounded desktop inbox; stacked phone layout with automatic scroll to the selected paper and a return-to-list action.
- Selected-paper heading and visible read-only explanation; source forms and advanced JSON use progressive disclosure.
- Readable AI summary, contributions, limitations, and evidence basis. Raw JSON remains available. Existing cost/data-sharing disclosures and explicit draft-adoption/save actions remain intact.
- Theme-aware contrast, visible focus, touch-sized phone controls, large phone inputs to avoid automatic zoom, and reduced-motion support.
- No backend, API, data schema, credential storage, or publication changes.

## Verification

The offline controller harness covers category/search/reset/sort, slash-key focus, mobile focus/return navigation, source disclosure, structured analysis, and public-read-only behavior alongside existing dirty-edit, conflict, version, and token regressions. All Python and worker tests, Astro build, data validation, and a targeted strict TypeScript check passed.

Visual browser QA is not complete in this execution environment: the installed Chromium process could not create its required socket, and the separate cloud browser could not reach the local preview. No screenshots are claimed. Before merging, inspect the built page at desktop and 390px widths in both themes, including a selected paper and expanded source settings.
