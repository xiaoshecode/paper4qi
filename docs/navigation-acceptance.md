# Navigation hierarchy and acceptance

## Structure

The old header exposed 11 peer links and required horizontal scrolling on small screens. The new header has five first-level destinations:

- Home: site overview.
- Workspace: paper discovery, wiki editing and AI interpretation.
- Paper library: QCE papers, TQE papers, venue index and research statistics.
- Research guides: research map (including its topic pages), CS4Q and OpenQASM.
- Data & help: Agent data access and source/methodology documentation.

All 11 existing URLs remain unchanged. Group labels expand rather than navigate. Current groups are highlighted, exact pages use `aria-current="page"`, and research-map descendants use `aria-current="location"` on their parent link.

Desktop uses disclosure dropdowns; screens at or below 700 CSS pixels use a compact site-navigation disclosure with nested groups. Native details/summary controls support keyboard and no-JavaScript navigation. Enhancement keeps one group open, closes on outside clicks, restores focus on Escape, resets on viewport-mode changes and Back/Forward restoration, and closes after navigation. Themes and both languages retain the same hierarchy.

## Verified locally on 2026-11-12

- Production build: 36 pages; data validation: 2,511 records, curated resources unchanged.
- Existing 69 Python tests, frontend controller tests and Worker contract tests pass.
- Navigation regression checks preserve all 11 routes, verify five top-level entries and three groups, check route-segment boundaries, and inspect built destination pages with a single current-page marker.
- Cloud Chromium: desktop QCE link navigation, current destination and group state, switching dropdown groups, Escape dismissal, browser Back, and light/dark inspection.
- Compact window at 500 CSS pixels: nested guide navigation to CS4Q, automatic collapse after navigation, English labels, dark theme, two-level Escape behavior, and outside-click dismissal.
- Zoom-adjusted 400 and 333 CSS-pixel viewport: navigation itself remains within the viewport, scrollable nested list visible. This is a narrow desktop-browser check, not mobile hardware or touchscreen testing.

## Limits

At 333 CSS pixels, the existing CS4Q content path cards extend a few pixels outside the page; the navigation itself does not overflow. That unrelated page-content layout is not changed here. Physical phones and screen-reader software were not tested. No merge or deployment was performed.
