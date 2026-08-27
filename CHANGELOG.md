# Changelog (Active)

This is the lightweight active changelog.

For full historical entries, see:
- CHANGELOG.archive.md (private)

Format follows Keep a Changelog and Semantic Versioning.

---

## [0.8.0] - 2026-08-26

### Added
- **Learning Hub — richer learning-path cards** — the Demo Hub landing page now shows path descriptions, per-category lesson counts, progress bars, completion rings, status pills, and estimated total time derived from the live lesson registry.
- **API Mock body editor — Tree view** — the full-screen body editor now has a Text / Tree toggle. Tree mode renders an interactive JSON tree with collapsible nodes, syntax colors, search, Expand all / Collapse all, and is kept in sync with the text editor.
- **Runtime journal — collapse the detail panel** — a chevron on the divider lets you hide the request/response detail and give the transaction list the full width, then bring the detail back.
- **Journal redaction — header reference chips** — the Redact headers field now shows clickable chips for common defaults plus extras. Click to add or remove; type any custom name; Restore defaults resets the list.
- **API Mock Proxy — Allowlist failover chain** — the proxy Allowlist is now an ordered primary → backup chain. Unmatched requests try each server top to bottom, moving on only when a server is unreachable or returns 5xx / 404. Any real 2xx/3xx/4xx reply stops the chain.
- **API Mock export — Save to disk** — the export confirmation footer now has a Save to disk button alongside Copy.
- **Response Selection — Pick JSONPath from sample** — conditional rule variants can open the Pattern Toolbox JSONPath picker to select a key from a sample body rather than typing the path by hand.
- **Response body — Browse helpers** — a searchable catalog of every `{{ }}` helper the engine evaluates (request, context, identity, random, transform, state, faker) is available from the body editor. Search, Copy, and Insert.
- **Simulate — Headers expand popup** — the Headers field now has the same full-screen expand control as Body, with Raw / Table modes, search, undo/redo, and Apply.
- **API Mock gallery — Storefront basics sample** — a compact six-rule storefront preset for exploring the runtime journal, filtering rows, and promoting a captured near-miss.
- **API Mock Timeout fault — configurable hold** — the Timeout / no response fault card now has a Hold for (ms) field. A server-wide Timeout hold max is available under Settings → Network → Limits.
- **API Mock settings — Proxy safety** — the Proxy tab now has a Block private nets toggle, a default-deny note while proxy is on, and a 508 loop-guard note.
- **API Mock export confirmation** — every export download opens a readable confirmation with a JSON/YAML preview tree, redaction callout, WireMock loss notes, HAR entry count, and a copyable CLI command.
- **API Mock — Saved servers library** — mock server definitions now live in a durable library independent of the tab bar. Closing a tab parks the server with all its rules, examples, variables, and settings intact. A Saved servers button opens a searchable library dialog. Removing a server is an explicit Delete behind a confirm with a 5-second undo.
- **API Mock demo curriculum v2** — 24-lesson scenario curriculum replacing the v1 eight-lesson pack. Each lesson builds on the previous one across Studio Tour, Multi-Server Workspace, Rule Library, Path Matching, Request Predicates, Body Matching, Payload Formats, Selection Policy, Conflict Inspector, Response Content, Templating, Variants & Sequence, Stateful Mocks, Timing Faults, Import, Export, Proxy, Journal Forensics, Runtime Ops, TLS/mTLS, Simulation as a Test Suite, Variants & Sequence (advanced), Test Runner & CI Handoff, and the capstone Ship a Contract Mock.

### Changed
- **API Mock chrome** — removed the redundant "API Mock Studio" title from the tab strip; the protocol tab already names the view.
- **API Mock settings — port conflict guard** — entering a listen port already claimed by another saved server now shows an inline error naming the owner and disables Save settings.
- **API Mock Conflict Inspector** — redesigned two-column layout with competing-rule cards, Match dimensions, Selection policy, full SHA-256 fingerprints with Same / Different badge, and a sticky action bar for Acknowledge / Adjust priority.
- **API Mock body conditions** — the key box on a body source condition is now disabled and shows `(whole body)` with a tooltip, making it clear that body matchers read the entire payload.
- **API Mock selection policy** — when two rules tie at highest priority, Simulate now shows a Winner badge and a specificity score breakdown. The Ambiguous response body is editable.
- **API Mock response preview** — the body preview panel now evaluates `{{ }}` template helpers against a sample request derived from the rule path. Unknown helpers show an inline diagnostic.
- **API Mock response editor** — the status reason phrase is now editable. Changing Content-Type also sets the body kind (JSON / HTML / XML / text / base64).
- **API Mock Studio — resizable rules panel** — the vertical bar between the rules list and the editor is now draggable. Width persists across sessions.
- **API Mock rules footer tally** — enabled vs draft shown as two status chips (live green / draft amber) instead of faint inline text.
- **API Mock Simulate — Saved samples** — Save as sample stores the full request under Saved samples with a focused name field. Reopening a saved sample restores that request.
- **API Mock Pattern Toolbox — XPath layout** — presets on the left, Sample XML fills the remaining width, Generated matcher underneath. A live Resolved read and ✓ / × verdict added to the XPath tab.
- **API Mock — Body expand popup** — Simulate request body, Match body expected/schema, and Pattern Toolbox Sample XML all have an expand control opening a full-screen editor with search, pretty-print, undo/redo, and Apply.
- **API Mock Simulate — From rules probes** — sidebar From rules entries now show the rule's request read-only, with an Edit in Ad-hoc button to copy into the scratch pad.
- **API Mock Proxy settings** — default-deny and 508 loop-guard notes placed clearly under the Enabled toggle. Allowlist hint explains the failover ordering.
- **API Mock Outbound tab** — redesigned with a pipeline strip (Template → Transforms → Client → Callbacks), section cards with sentence-case titles, and two-tone callback card rows.
- **API Mock Expires at** — the expiry field now has a calendar picker (month grid + 24-hour time row) in addition to typed ISO and the +1h / +24h / +7d chips.
- **API Mock response cookies** — HttpOnly, Secure, and SameSite flag meanings are shown inline. The SameSite menu repeats a one-line hint per option.
- **API Mock export Preview popup** — cleaned-up header layout: title left, flexible search field with N/M counter in the middle, Expand / Collapse / Copy JSON grouped on the right.
- **API Mock export inline Preview** — the JSON preview in the export confirmation card now uses the interactive JSON tree (collapsible nodes, syntax colors, search) instead of a flat text dump. YAML and unparseable content keep the plain text preview.

### Fixed
- **API Mock Studio — no flash on load** — `ApiMockLibraryLanding` is now suppressed until workspace hydration completes, eliminating the brief empty-landing flicker when navigating to the API Mock tab with saved servers.
- **AM-25 lesson — step 3 spotlight** — the Replay step now highlights the **Start** button instead of the (already-running) Stop button.
- **AM-25 lesson — step 5 Show breakdown** — the modal step now spotlights and clicks **Show breakdown** so viewers see the field-by-field body diff expand from the collapsed "all fields match" state. Added `HAR_COMPARE_SHOW_BREAKDOWN` selector to the shared API Mock selector map.
- **API Mock `{id}` / `:id` paths now match real requests** — OpenAPI import was storing parameterized paths as exact literals. Import now infers the parameterized kind, and the matcher promotes templates at evaluation time.
- **API Mock near-misses** — unmatched journal rows now require a path match or a same-arity path typo (≤2 edits) to qualify as a near-miss. Disabled routes are included. The failed dimension is named in the result.
- **API Mock Start/Apply — stale workspace** — Start, Apply, and Restart now read the latest server snapshot so enabling a draft then starting the server applies the current state.
- **API Mock rule list — Draft/On enable control** — the chip on each explorer row is a real button. Click Draft to enable a rule; double-click on the row still toggles as before.
- **API Mock Simulate — no auto-generated probes on open** — Simulate no longer injects auto-generated From rules stubs on open. It starts with only the scratch pad and any samples you have saved.
- **Open in Requests → Send — invalid connection header** — journal rows no longer copy hop-by-hop headers (Connection, Host, Accept-Encoding) into replayed requests.
- **API Mock — closing a running server** — the confirm dialog now says Stop and close / Stop & Close and explains that the listener stops and the port is freed, instead of "Confirm Deletion / Delete Permanently".
- **API Mock Runtime Settings — clipped field hints** — Journal, Limits, and CORS help text was cut off. Hinted rows now grow; short numeric hints sit beside the control.
- **API Mock journal — 404 poll noise** — API state/transaction/draft endpoints now return 200 with `ok: false` when the listener is stopped, preventing repeated 404s in the browser console.
- **API Mock Console — reliable "Started …" line** — the companion now keeps a short replay buffer and replays recently-broadcast lifecycle lines to newly connected clients, so the Started line is never lost to a connect race.
- **API Mock Console — empty despite a running server** — the SSE stream now stays attached across starting / applying / draining states. Restart now emits its own Restarted lifecycle line.
- **API Mock TLS/mTLS — live HTTPS requests** — loopback HTTPS requests to a self-signed API Mock listener are now treated as skip-verify by default, so live requests over HTTPS complete and journal correctly.
- **API Mock Conflicts — stale after lesson wipe** — the Conflict Inspector findings and badge now clear on workspace replace and active-server change. Opening Conflicts re-analyzes the current library.
- **API Mock Proxy settings — label column collapse** — a long non-wrapping hint was pushing the label column off-screen. Settings rows cap min-width; the Allowlist hint wraps.
- **Workflow API Mock nodes — isolated run targeting** — Reset/Stop/Assert Mock Calls nodes now resolve their target against the run's started-server registry when a Start Mock Server node used Isolate this run, so downstream nodes reliably reach the isolated listener.
- **API Mock export — YAML Preview now uses the tree** — YAML downloads now render the same collapsible JSON tree in the Preview popup as JSON/WireMock/HAR exports.
- **JSON tree — Expand all while searching** — Expand all now correctly expands all nodes even when a search filter is active.
- **API Mock Response body editor — dark theme** — the Monaco editor now uses the app's theme tokens instead of the default dark background.
- **API Mock export confirm — journal header bleed** — the sticky journal header no longer appears above the export dialog.
- **Learning Hub — Docker gate on Tauri** — the Docker prerequisite gate now probes via the native companion proxy on Tauri instead of WKWebView fetch, resolving loopback proxy interception issues.
- **API Mock — `Form field present` never matched** — the matcher now correctly reads a bare string as the field name for form field presence checks.
- **Simulate / FLAKY variant — unexpected 404** — rule-level predicates no longer gate variant conditions; a probability-weighted variant correctly claims its request even when the default route predicate does not match the variant body.

---

## Recent Release Highlights

### 0.6.x
- Major workflow, testing, and platform reliability improvements.
- Kafka and protocol feature depth expanded.
- Coverage, type safety, and E2E stability improvements.

### 0.5.x
- Data Mapper, validation, and results explorer refinements.
- Workflow UX and storage reliability improvements.

> Full engineering-level detail and historical release notes are in `CHANGELOG.archive.md` (private repo).
