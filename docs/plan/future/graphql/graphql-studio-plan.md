# GraphQL Studio — Feature Plan

> **Status**: Phase 1 Complete ✅ (1A + 1B + 1C + 1D + 1E + All Gap items + Prettify button + per-tab op selection + Round 10 a11y/UX polish + **Phase 1 Comprehensive Re-evaluation Rounds 1–5 — 26 bugs fixed** + **CSS Linting overhaul — 33 CSS bugs fixed** + **Phase 1 Comprehensive Re-eval Round 6 — 8 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 7 — 8 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 8 — 12 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 9 — 12 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 10 — 11 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 11 — 10 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 12 — 9 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 13 — 4 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 14 — 4 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 15 — 6 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 16 — 2 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 17 — 2 bugs fixed** + **Phase 1 Comprehensive Re-eval Round 18 — 1 bug fixed** + **Phase 1 Comprehensive Re-eval Round 19 — 2 bugs fixed** + **StrictMode tab persistence bug fixed — loadedRef/tabsRef flush guards**) | Phase 2 Planning: **Phase 2 Comprehensive Evaluation Rounds 1–4 complete — 67 tasks, 5 major reuse opportunities documented** (§23.14–§23.15): streaming blocker scoped, Docker server exists, 10 types added, 38 selectors added, server route pattern identified, 5 hooks reusable, alias/keyboard/protocol-settings gaps found, revised sprint plan  
> **Target Version**: v0.8.x  
> **Prerequisites**: WebSocket Studio (done), Kafka Studio (done), SSE Studio (done)  
> **Last Updated**: 2026-06-17 (Phase 2 Re-eval Round 4: 16 gaps + 5 reuse opportunities — Docker GQL server exists, SSE needs no fetchStream, useWebSocketReconnect/wsAuthResolve/useVirtualizer all reusable, 2A-10/2F-15 added, alias panel corrected, keyboard shortcuts tasked)  
> **Editor**: Monaco (already in project via `@monaco-editor/react`)

## Implementation Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| **1A** | Monaco Editor Integration | ✅ **Done** | Multi-tab editor, variables/headers panels, localStorage persistence, `monaco-graphql` worker, **close-tab two-click confirm** |
| **1B** | Schema Introspection + Explorer | ✅ **Done** | Introspect button, schema parser, schema caching, polling, type explorer with SDL highlighting |
| **1C** | Query Execution Engine | ✅ **Done** | HTTP POST execution, 3-tab response viewer, cancellation, vars validation, **query AST validation squiggles + ⚠ badge**, **Prettify button** |
| **1D** | Connection Management | ✅ **Done** | Auth config popover (Bearer/Basic/API Key), recent endpoints dropdown, **Connection Profiles (save/load endpoint+auth)** |
| **1E** | Environment Variables | ✅ **Done** | `{{var}}` interpolation, two-panel env manager modal, unresolved-var warnings |
| **Phase 2** | Subscriptions + Query Builder | 🔲 Planned | WS/SSE subscriptions, visual query builder, `@defer`/`@stream`, file upload, performance tracing — see [Section 23 Evaluation](#23-phase-2-comprehensive-evaluation) |
| **Phase 3** | Collections + Code Gen | 🔲 Planned | History, collections, pre/post scripts, code generation, schema diff, mock server, APQ |
| **Phase 4** | Workflow Integration + Lessons | 🔲 Planned | Workflow nodes, demo lessons, gallery templates, E2E tests |

### Phase 1A Implementation Summary (Done — Re-evaluated 2026-06-17)
- `GraphqlEditor.tsx` — Monaco-based editor with `monaco-graphql` language mode  
- `GraphqlVariablesPanel.tsx` — JSON variables editor with per-operation schema validation  
- `GraphqlHeadersPanel.tsx` — key-value headers editor with enable/disable toggles  
- `GraphqlConnectionBar.tsx` — endpoint URL input, Introspect button, Execute button, schema status badge  
- `GraphqlStudioPage.tsx` — multi-tab orchestration, localStorage persistence, `⌘ Enter` shortcut  
- `monacoGraphqlSetup.ts` — Monaco worker shim, model management, operation extraction  
- `GraphqlResponseViewer.tsx` — JSON response display (placeholder for Phase 1C)  
- Full Catppuccin Mocha color palette, `graphql-studio.css`

#### Phase 1A Re-evaluation Fixes (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-1A-1** | **Unsaved dot wrong color** — `.gql-tab-dot` used `var(--gql-accent)` (blue), identical to the active-tab underline, making it hard to distinguish "active" from "unsaved". Mockup spec says "orange dot". | Changed to `var(--gql-warning)` (amber) — visually distinct from the blue active-tab indicator. |
| **BUG-1A-2** | **`+` new-tab button vanished at MAX\_TABS** — `{tabs.length < MAX_TABS && <button>}` made the button completely disappear with no user feedback when 8 tabs were open. | Button is always rendered; disabled state (`opacity: 0.3; cursor: not-allowed`) with tooltip "Maximum 8 tabs — close one to open another". |
| **BUG-1A-3** | **Bottom panel `role="tabpanel"` had no `aria-labelledby`** — single panel div had no link to the active tab button, violating WCAG 4.1.2. | Added `id` to each bottom tab button and `aria-labelledby`/`aria-controls` to link the panel to the active tab. |
| **BUG-1A-4** | **Right pane `role="tabpanel"` had no `aria-labelledby`** — same issue for Response/Schema view toggle panel. | Same fix: IDs on Response/Schema tab buttons, `aria-labelledby` on the panel pointing to the active view button. |
| **BUG-1A-5** | **Main tab bar `role="tablist"` had no `aria-label`** — the other two tablists (bottom, right pane) both had `aria-label`, but the main tab bar did not. | Added `aria-label="Query tabs"`. |
| **BUG-1A-6** | **Tab close button hover used hardcoded `#ef5350`** — breaks on light themes and deviates from the app's design token system. | Replaced with `color: var(--gql-danger)` and `background: color-mix(in srgb, var(--gql-danger) 12%, transparent)`. |
| **BUG-1A-7** | **Bottom tab count badge used hardcoded `color: #fff`** — breaks on light themes where the accent background is not dark enough to contrast with white text. | Changed to `color: var(--bg-primary)` — the page background color always contrasts with the accent pill regardless of theme. |

#### Phase 1A Re-evaluation Round 2 (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-1A-R2-1** | **Monaco editor didn't auto-focus on tab switch** — `editor.focus()` was only called in `onMount`, which fires once. Switching tabs swaps the Monaco model silently; the editor lost keyboard focus. Users had to click inside the editor before they could start typing after switching tabs. | Added `useEffect([modelPath])` to `GraphqlEditor.tsx` that calls `editorRef.current?.focus()` (deferred one `requestAnimationFrame` to let the model swap settle). |
| **BUG-1A-R2-2** | **Last-tab close button was visible but clicked silently** — when only 1 tab remained, `setTabs((prev) => { if (prev.length === 1) return prev; })` returned unchanged. The × was fully visible but clicking it did nothing — no feedback, no animation. | Conditionally render the close button only when `tabs.length > 1`. With a single tab the × disappears entirely (it can't be closed anyway), matching the VS Code pattern. |
| **BUG-1A-R2-3** | **Tab button accessible name was polluted by inner spans** — without an explicit `aria-label`, screen readers computed the button's accessible name from all child text: _"GetCountries Unsaved changes Close GetCountries tab"_. | Added `aria-label={\`${tab.label}${tab.unsavedChanges ? ', unsaved' : ''}\`}` on the tab `<button>`. Added `aria-hidden="true"` to the label span and unsaved dot span so screen readers only see the clean `aria-label` without re-reading child content. |
| **BUG-1A-R2-4** | **`gql-tab--unsaved` CSS class was dead code** — the class was applied in JSX but had no CSS rule, providing zero visual effect. | Removed the class from the JSX. The unsaved state is fully indicated by the amber dot (`.gql-tab-dot`) and the explicit `aria-label`. |

#### Phase 1A Re-evaluation Round 3 (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-1A-R3-1** | **Invisible close buttons were in the Tab order** — every close `<span>` had `tabIndex={0}`, including the opacity-0 ones on inactive tabs that aren't hovered. Keyboard users could Tab to a button they couldn't see or interact with visually. | Changed `tabIndex` to `isActive \|\| isConfirming ? 0 : -1` — only the active tab's close button (and any tab in confirming-close state) is reachable via Tab. Inactive, invisible close buttons are removed from Tab order. |
| **BUG-1A-R3-2** | **Phase 1A/1C CSS error states bypassed the `--gql-danger` design token** — `.gql-tab-close--confirming`, `.gql-bottom-tab--error`, `.gql-bottom-tab-error-dot`, `.gql-vars-error-banner`, and `.gql-vars-panel--error` all used hardcoded `#f38ba8` / `#ef5350` hex values instead of `var(--gql-danger)`. Breaks on custom/light themes. | Replaced all with `var(--gql-danger)` and `color-mix(in srgb, var(--gql-danger) N%, transparent)` for background/border tints. |
| **BUG-1A-R3-3** | **Headers panel inputs had non-unique `aria-label`** — every row rendered `aria-label="Header key"` and `aria-label="Header value"`. With 3+ headers, screen readers could not distinguish rows: "Header key, edit text" × 3. | Added row index to labels: `aria-label="Header 1 name"`, `aria-label="Authorization header value"` (uses key name if set, index otherwise). Same pattern applied to checkbox and remove button. |

### Phase 1B Implementation Summary (Done — Re-evaluated 2026-06-17)
- `useGraphqlSchema.ts` — introspection hook: fetch, parse, cache (localStorage), poll on interval, error classification  
- `schemaParser.ts` — `IntrospectionQuery` → `GraphqlSchemaInfo` with per-type `sdlFragment` via `printType()`  
- `GraphqlSchemaExplorer.tsx` — 2-pane schema explorer:
  - Left column: "Types (N)" header, Re-introspect + Export SDL buttons, search input, kind filter chips (wrapping), scrollable type entries with colored 22px icon badges
  - Right column: type detail panel with header (name + kind badge + description + Implements/Union-of), Fields/SDL sub-tabs, table view for fields (sticky header, args, deprecated markers), SDL view with syntax-highlighted definition
  - SDL tab: pinned toolbar with "SDL Definition" label + **Copy** button (clipboard + "✓ Copied" flash); scrollable `<pre>` below
  - Scroll position resets automatically when switching between types (`key` prop on TypeDetail)
  - Empty/loading/error states have CTA action buttons (Introspect / Retry); SVG icons; idle/warn/error opacity tuning
  - Stats footer: "Schema: N types • N fields • N inputs • N enums | Last introspected: HH:MM (or Jun 15 HH:MM for cached schemas)"
  - **Click-to-navigate**: user-defined type references in the Fields table render as clickable buttons; clicking selects that type in the list
  - **Smart kind filter**: keeping existing type selection when the selected type is still visible in the new filter
- SDL tokenizer: lightweight zero-dependency lexer with **parenthesis-depth tracking** for argument name coloring
  - Token classes: `gql-sdl-keyword` (purple), `gql-sdl-type` (blue), `gql-sdl-field` (base), `gql-sdl-arg` (yellow — inside `(...)`), `gql-sdl-directive` (red), `gql-sdl-comment` (muted italic), `gql-sdl-string` (green), `gql-sdl-number` (orange), `gql-sdl-punc` (muted)
- Schema polling: change-detection via SDL hash, pauses when tab hidden  
- Error classification: network / auth / access-denied / server / introspection-disabled / invalid-JSON
- All interactive elements use Catppuccin `#89b4fa` — active tab underlines, unsaved dots, focus rings, badges, checkboxes, header-cell focus borders, loading spinners (removed all remaining `var(--accent, #7c3aed)` purple fallbacks from Phase 1A)
- All success/OK indicators use Catppuccin `#a6e3a1`
- `gql-select:focus` now shows consistent focus ring matching `gql-input:focus`
- `monacoGraphqlSetup.ts` uses `MonacoType.Environment` instead of `any` casts; regex escape fixed
- `.gql-se-detail-content` has `min-height: 0` for correct flex + overflow-y scroll behavior

#### Phase 1B Re-evaluation Fixes (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-1B-1** | **`role="listitem"` on `<button>` elements** — WAI-ARIA prohibits overriding an interactive element's native role with a non-interactive role. The type list had `<button role="listitem">` which is invalid. Screen readers announced them as list items (non-interactive) instead of buttons. | Wrapped each button in `<div role="listitem">` with `display: contents` (zero visual footprint) so the semantic list→listitem→button ownership chain is valid. |
| **BUG-1B-2** | **TypeDetail `role="tablist"` had no `aria-label`; tab panels had no `aria-labelledby`** — the Fields/SDL sub-tabs and their panels were unlabeled, failing WCAG 4.1.2. | Added `aria-label={"\${type.name} detail"}` to the tablist. Added `id` to each tab button and `aria-labelledby` + `aria-controls` to each tab panel. |
| **BUG-1B-3** | **`handleExportSDL` revoked the blob URL before the browser could start the download** — `URL.revokeObjectURL()` was called synchronously immediately after `a.click()`. On Firefox this silently aborted the download. | Fixed by appending the anchor to `document.body`, clicking, removing it, then revoking in a `setTimeout(150ms)` to let the browser initiate the download first. |
| **BUG-1B-4** | **Field type references looked clickable (pointer + underline on hover) but clicking did nothing** — the CSS implied navigation that wasn't implemented, deceiving users. | Implemented click-to-navigate: user-defined types are rendered as `<button class="gql-se-ftype--link">` that calls `handleSelectType()`. Built-in scalars (String, Int, Boolean, etc.) remain plain spans. `navigableTypes: Set<string>` is memoized from `schemaInfo.types`. |
| **BUG-1B-5** | **Kind filter chip clicks always cleared the type selection** — selecting "Object" filter when an Object type was already selected needlessly blanked the detail panel. | `handleKindFilter` now only clears `selectedTypeName` if the currently selected type's kind doesn't match the new filter. If the type is still in the filtered view, the selection is preserved. |
| **BUG-1B-6** | **Stats footer showed time only (`HH:MM`)** — if the schema was loaded from cache during a session the next day, "10:30 PM" is ambiguous. | Stats footer now shows `HH:MM` if the schema was fetched today, or `Jun 15 HH:MM` for schemas fetched on a previous date. |
| **BUG-1B-7** | **Hardcoded hex danger/warning colors in empty state and deprecated tag CSS** — `.gql-se-empty--warn` (`#fab387`), `.gql-se-empty--error` (`#f38ba8`), `.gql-se-deprecated-tag` (`#f38ba8`, `rgba(243,139,168,...)`), and the warn/error CTA button variants all bypassed the `--gql-danger` / `--gql-warning` CSS tokens, breaking on custom themes. | Replaced all with `var(--gql-danger)` / `var(--gql-warning)` and `color-mix(in srgb, var(--gql-danger) N%, transparent)`. |

#### Phase 1B Re-evaluation Round 2 (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-1B-R2-1** | **Search input cleared type selection on every keystroke** — the `onChange` handler called `setSelectedTypeName(null)` in addition to `setSearchQuery()`. Typing "Or" to narrow results immediately blanked the detail panel for the previously selected type, forcing the user to re-click. | Removed `setSelectedTypeName(null)` from the search handler. Selection now only changes on an explicit type click. |
| **BUG-1B-R2-2** | **Click-to-navigate from field type didn't reset kind filter** — if the schema explorer was filtered to "Object" types and the user clicked an ENUM field type (e.g. `OrderStatus`), the detail panel correctly showed `OrderStatus` but the left list still showed only Object types with nothing highlighted — a confusing list/detail mismatch. | `handleSelectType` now checks if the navigated type's kind matches the current kind filter; if not, it resets the filter to `'ALL'` so the type is visible and highlighted in the list. |
| **BUG-1B-R2-3** | **`role="list"` used `aria-label="Schema types"` while a visible heading "Types (N)" already existed** — redundant and not semantically linked. | Added `id="gql-se-list-title"` to the title span and changed the list to `aria-labelledby="gql-se-list-title"`, linking it to the visible heading. |
| **BUG-1B-R2-4** | **Schema explorer hover backgrounds used hardcoded `rgba(255,255,255,…)` values** — `.gql-se-icon-btn:hover`, `.gql-se-filter-chip:hover`, `.gql-se-type-entry:hover`, and `.gql-se-ftr:hover` all used raw white-alpha overlays that break on light themes. Other hover states in the same file already used `var(--surface-hover)`. | Replaced all four with `var(--surface-hover)` (and `var(--border)` for border-color where applicable). |

### Phase 1C Implementation Summary (Done — Re-evaluated)
- `useGraphqlExecution.ts` — execution hook managing the full query/mutation lifecycle:
  - `execute(params)` — fires HTTP POST via `httpFetch`, builds `GraphqlResponse` from result
  - `cancel()` — aborts in-flight request via `AbortController`; Escape key also calls cancel
  - Handles: network errors, non-JSON responses (HTML error pages), GraphQL partial results (data + errors)
  - Status: `idle → loading → success | error`; silent abort on cancel
- `GraphqlResponseViewer.tsx` — fully featured 3-tab response viewer (re-evaluated v2):
  - **Status bar** (top row):
    - HTTP status badge with full text label ("200 OK", "404 Not Found", "500 Server Error") — now uses full 5-class color spectrum: green (2xx), amber (3xx), red (4xx/5xx), deep-red (network error)
    - Latency (amber), response size (muted)
    - Partial badge (amber) + error count (red) — shown conditionally in left cluster
    - **Copy button** (right-aligned in status bar) — copies response JSON body with "✓ Copied" flash; replaces previous separate toolbar row
  - **Body tab** — pure JSON scroll area; no extra toolbar stripe between tab bar and content
  - **Headers tab** — HTTP response headers table (sticky header, key/value columns)
  - **Metadata tab** — HTTP status (full verbose label), latency, size, content-type, timestamp; GraphQL error detail cards (message, line/col location badges, path, extension code)
  - Resets to Body tab automatically on new response (`useEffect` + `prevTimestampRef`)
  - Loading state: spinner + "Executing…" + "Press Esc to cancel"
  - Empty state: lightning-bolt SVG icon + "No response yet" title + "Press ⌘ Enter to execute"
- `GraphqlConnectionBar.tsx` — Execute/Cancel button swap + GQL badge:
  - **"GQL" method badge** (solid green pill, dark text) at the far left — matches mockup design
  - While executing: shows **Cancel** button (red, stop-icon) instead of Execute
  - `varsInvalid` prop: disables Execute button when variables JSON is malformed
  - `onCancel` prop wired to `AbortController.abort()`
- `GraphqlStudioPage.tsx` — execution integration:
  - Real `useGraphqlExecution` hook (replaces `executing = false; response = null` stubs)
  - `handleExecute` switches right pane to "Response" view before firing
  - Keyboard: `⌘ Enter / Ctrl+Enter` → execute, `Escape` → cancel
  - Variables JSON validation: debounced 300ms; red dot on Variables tab; disables Execute button
  - **Inline variables error banner**: red banner with info icon above Monaco editor when JSON is invalid ("Invalid JSON — fix to enable Execute")
  - **`.gql-vars-wrapper`** flex column wrapping banner + editor for correct layout
  - **Response tab status indicator**: green dot (success) / red dot (error) on the "Response" right-pane tab — mirrors the Schema tab badge pattern
  - `selectedOperation` state: auto-syncs; passed to execution hook
- CSS additions/updates (`graphql-studio.css`):
  - `.gql-method-badge` — solid green GQL badge (matches mockup: `#a6e3a1` bg, `#1e1e2e` text)
  - `.gql-rv-statusbar` — flex `justify-content: space-between`; `.gql-rv-statusbar-left` flex cluster
  - Full 5-class status badge color spectrum: `--ok`, `--redirect`, `--client-error`, `--server-error`, `--network-error`
  - `.gql-vars-wrapper` + `.gql-vars-wrapper > .gql-vars-panel` — flex column, min-height: 0 layout
  - `.gql-vars-error-banner` — red-tinted banner with icon
  - `.gql-rv-empty-title` + `.gql-rv-empty-body` — improved two-line empty state hierarchy
  - Removed `gql-rv-toolbar` / `gql-rv-toolbar-left` (merged into status bar)
  - Removed `margin-left: auto` from `gql-rv-error-count` (layout handled by flex parent)
- Bug fixes applied in re-evaluation rounds:
  - **BUG-V1/V2**: Status bar badge was only "200" (number) and only used 2 colors (green/red). Now shows full label "200 OK" and uses 5-class color spectrum
  - **BUG-V3**: Missing GQL method badge on connection bar — added solid green pill
  - **BUG-V4**: Response right-pane tab had no execution status indicator — added green/red dot badge
  - **BUG-V5**: Variables tab error had no inline guidance — added error banner above Monaco editor
  - **BUG-V6/V7**: Separate toolbar row between tab bar and JSON content — eliminated; Copy moved to status bar
  - **BUG-V8**: `margin-left: auto` on error count caused misalignment in new flex layout — removed
  - **BUG-V9**: Error count badge was non-interactive; now a button that navigates to Metadata tab on click (with dotted underline hover affordance)
  - **BUG-V10**: Copy button had no icon — added clipboard SVG for pre-copy and checkmark SVG for post-copy state
  - **BUG-V11**: Dead CSS: `.gql-rv-body-tab` and `span.gql-rv-empty-hint` removed; replaced with `.gql-rv-tab-empty` for empty tab states
  - **BUG-V12**: `HeadersTab` empty state was not vertically centered — now uses `.gql-rv-tab-empty` (flex center)
  - **BUG-V13**: Status bar used `align-items: center` which looked wrong on multi-line left cluster — changed to `align-items: flex-start`

### Phase 1C Re-evaluation History

#### Round 1 (2026-06-17) — 7 bugs fixed

| ID | Bug | Fix |
|----|-----|-----|
| **BUG-1C-1** | `.gql-rv-tab:hover:not(.gql-rv-tab--active)` had `color: var(--text-muted)` — identical to the default, so hovering an inactive tab had **zero visible effect** | Changed hover color to `var(--text)` so inactive tabs lighten visibly on hover |
| **BUG-1C-2** | Status bar used `align-items: flex-start` causing the Copy button to not vertically center with the left cluster badges; `padding-top: 2px` hack on left cluster was a symptom | Changed status bar to `align-items: center`; removed the `padding-top: 2px` offset |
| **BUG-1C-3** | `handleCopy` in `GraphqlResponseViewer.tsx` had no `.catch()` on the Clipboard API promise — any rejection (insecure context, denied permission) caused an unhandled promise rejection | Added `.catch(() => {})` to silently absorb clipboard failures |
| **BUG-1C-4** | All status badge colors (ok, error, redirect), latency, partial badge, and metadata status used hardcoded hex (`#a6e3a1`, `#f38ba8`, `#f9e2af`, `rgba(...)`) instead of `var(--gql-success)`, `var(--gql-danger)`, `var(--gql-warning)` | Replaced all with CSS variable + `color-mix()` equivalents |
| **BUG-1C-5** | `.gql-rv-copy-btn:hover` used hardcoded `rgba(255,255,255,0.06)` and `rgba(255,255,255,0.2)` — breaks light themes | Replaced with `var(--surface-hover)` and `var(--border)` |
| **BUG-1C-6** | `.gql-rv-error-count:focus-visible` had hardcoded `#f38ba8` outline instead of `var(--gql-danger)` | Fixed |
| **BUG-1C-7** | **Complete CSS design-token sweep**: hardcoded hex colors remained in Phase 1A–1E CSS sections — `.gql-method-badge`, `.gql-validation-warning`, `.gql-btn--cancel`, `.gql-env-active-badge`, `.gql-env-var-secret-toggle--active`, `.gql-env-var-remove:hover`, `.gql-env-sidebar-delete:hover`, `.gql-env-import-error`, `.gql-headers-value--warn`, `.gql-headers-unresolved-icon`, `.gql-profile-*`, `.gql-se-sdl-copy-btn--copied`, `.gql-response-spinner` track color, legacy `.gql-status--ok/error` | Replaced all remaining hardcoded semantic hex values with `var(--gql-success/danger/warning)` + `color-mix()` |

#### Round 2 (2026-06-17) — 6 bugs fixed

| ID | Bug | Fix |
|----|-----|-----|
| **BUG-1C-R2-1** | `.gql-rv--has-errors` class applied in JSX but **no CSS rule** existed — dead class assignment | Added `.gql-rv--has-errors .gql-rv-statusbar { background: color-mix(in srgb, var(--gql-danger) 4%, var(--surface)); }` to give the status bar a subtle danger tint when the response contains errors |
| **BUG-1C-R2-2** | Error count `<button>` in the status bar had only `title` for accessibility — screen readers don't reliably announce `title` | Added explicit `aria-label` describing both the count and navigation action |
| **BUG-1C-R2-3** | **Logic bug**: `gqlResponse.data = parsed.data` can be `undefined` when a server omits the `"data"` key. The `isSuccess = !hasErrors \|\| gqlResponse.data !== null` check treats `undefined !== null` as `true`, incorrectly marking pure-error responses as `'success'` | Normalized `gqlResponse.data = parsed.data ?? null` so the existing `!== null` guard is always correct |
| **BUG-1C-R2-4** | `gql-rv-headers-table td` row separator used `rgba(255,255,255,0.04)` — invisible on light themes | Changed to `color-mix(in srgb, var(--border) 40%, transparent)` |
| **BUG-1C-R2-5** | Error path/code `<code>` background used `rgba(255,255,255,0.05)` — breaks light themes | Changed to `var(--surface-hover)` |
| **BUG-1C-R2-6** | `trimmed !== ''` condition in `execute()` was dead code — `if (trimmed &&` already guards for empty strings | Removed the redundant condition |

### Phase 1D Implementation Summary (Done — Re-evaluated ×5)

- `authUtils.ts` — pure utilities with no React dependency:
  - `buildAuthHeaders(auth)` — converts `GraphqlAuth | null` → `Record<string, string>` header map for injection
  - `authBadgeLabel(auth)` — returns display label: `'No Auth'` / `'Bearer'` / `'Basic'` / `'API Key'` / etc.
  - `isAuthConfigured(auth)` — returns true when auth config is non-empty (used for badge accent color)
- `useRecentEndpoints.ts` — persisted recent endpoints hook:
  - `push(url)` — adds to front, deduplicates, caps at 10, saves to localStorage
  - `remove(url)` — removes a specific entry
  - `clear()` — empties the list
- `GraphqlAuthPopover.tsx` — floating auth config dialog:
  - **Type dropdown**: No Auth / Bearer Token / Basic Auth / API Key / OAuth 2.0 / Custom
  - **Bearer**: password-masked token input with visibility toggle (eye icon)
  - **Basic**: username + password (masked) inputs
  - **API Key**: header name (default `X-API-Key`) + value (masked) inputs
  - **OAuth 2.0 / Custom**: read-only info boxes explaining where to configure
  - **Footer preview**: shows exact header that will be injected (`Authorization: Bearer xxx…`, `X-API-Key: •••`)
  - `onChange(null)` called when "No Auth" selected — parent clears auth state
- `GraphqlConnectionBar.tsx` — Phase 1D additions:
  - **Auth badge button**: shows current type with lock icon + chevron
    - Gray (unconfigured): `No Auth` or empty bearer/basic/apiKey
    - Blue accent (configured): `Bearer` / `Basic` / `API Key` with filled credentials
  - **Auth badge click** → opens `GraphqlAuthPopover` (floating panel)
  - **Recent endpoints dropdown**: appears when URL input is focused, shows clock icon + URL, × remove button (hidden until hover)
  - Both popover and dropdown close on click-outside / Escape
- `GraphqlStudioPage.tsx` — Phase 1D additions:
  - `auth` state (`GraphqlAuth | null`) with localStorage persistence (`gql_auth_v1`)
  - `handleAuthChange(auth | null)` — updates state + localStorage
  - `useRecentEndpoints()` hook wired: `push(endpoint)` called before every execution
  - `buildAuthHeaders(auth)` merged into request headers: auth headers spread first, user tab headers override
- CSS additions (`graphql-studio.css`):
  - `.gql-auth-badge` — configurable color scheme (gray default, blue when configured)
  - `.gql-auth-badge--configured` — accent styles for active auth
  - `.gql-auth-popover` — floating panel (320px wide, shadow, border-radius)
  - `.gql-auth-popover-header/body/footer` — layout sections
  - `.gql-auth-field` + `.gql-auth-label` + `.gql-auth-input` — field + label system
  - `.gql-auth-pw-wrap` + `.gql-auth-pw-toggle` — password wrap with visibility toggle
  - `.gql-auth-info-box` — tinted info box for OAuth2/Custom notes
  - `.gql-auth-preview` — monospace preview in popover footer
  - `.gql-recent-endpoints` + `.gql-recent-endpoint-item/btn/url/remove` — dropdown system
- Mockup updated (`graphql-studio-main.html`):
  - Connection bar now shows **auth badge** (configured with Bearer example) + **auth popover** (open state)
  - Recent endpoints dropdown shown in mockup (hidden by default)
  - Replaced flat `<select class="auth-dropdown">` with proper popover design
- Bug fixes applied in re-evaluation round 1:
  - **BUG-1D-V1/V2**: "No Auth" selection wrote `{ type: 'bearer', token: '' }` to localStorage and showed "Bearer Token" pre-selected on next open — fixed by making `onChange` accept `null` and initializing popover from null auth correctly
  - **BUG-1D-V3**: Escape key in auth popover also triggered global cancel-execution handler — fixed by using `{ capture: true }` event listener with `e.stopPropagation()`
  - **BUG-1D-V4**: Auth popover anchored `left: 0` — overflowed off right side of viewport — fixed by using `right: 0; left: auto` (right-edge anchoring)
  - **BUG-1D-V5**: Missing `aria-modal="true"` on popover `role="dialog"` — added
- Bug fixes applied in re-evaluation round 2:
  - **BUG-R2-1**: Schema status badge showed TWO dots simultaneously when `schemaPolling=true` (animated pulsing dot + static green dot) — polling dot now replaces the static dot (mutually exclusive)
  - **BUG-R2-2**: Auth badge had no "open" visual state — added `[aria-expanded="true"]` CSS for both unconfigured and configured badge states
  - **BUG-R2-3**: Auth popover opened without moving keyboard focus — added `requestAnimationFrame(() => typeSelectRef.current?.focus())` on mount for keyboard accessibility
  - **BUG-R2-4 (cleanup)**: Removed dead `auth.type === 'none' as string` comparison from `authBadgeLabel()` in `authUtils.ts`
- Bug fixes applied in re-evaluation round 3:
  - **BUG-R3-1 (UX)**: Popover body was completely empty when "No Auth" was selected — no guidance. Added `.gql-auth-no-auth-hint` message: "No authentication headers will be sent. Select a type above to add credentials." with dashed border and muted text
  - **BUG-R3-2 (UX)**: Auto-focus on popover mount always went to the type selector, even when auth was already configured (Bearer+token, Basic+username, etc.) — user had to Tab once to reach the credential field. Fixed: if auth is not null on mount, focus the first credential field directly (`firstFieldRef`)
  - **BUG-R3-3 (Polish)**: Basic Auth preview showed a misleading base64 string computed from `"username:***"` (e.g. `Authorization: Basic dGVzdHVzZXI6KioqKioq`) — non-obvious to users. Changed to `Authorization: Basic ••• (username:••••••)` which is clearer and human-readable
  - **BUG-R3-4 (Logic)**: `isAuthConfigured()` for `apiKey` required BOTH `headerName` AND non-empty `headerValue` to turn the badge blue. But an API key with an empty value may be intentional (header presence as auth signal). Fixed: only check `headerName.trim()` — setting the header name is sufficient to be "configured"
  - **BUG-R3-5 (UX)**: After selecting a new auth type from the dropdown, focus stayed on the type selector. User had to Tab to reach the first credential field. Fixed: a `prevTypeRef` tracks the previous type; when type changes (after mount), a `requestAnimationFrame` focuses `firstFieldRef.current` so the user can type immediately
  - **PasswordInput refactor**: Added optional `inputRef` prop (`React.RefObject<HTMLInputElement | null>`) to forward to the underlying `<input>` element — required for `firstFieldRef` auto-focus in Bearer token and API Key value fields
- Bug fixes applied in re-evaluation round 4 (2026-06-17):
  - **BUG-1D-R4-1 (UX/Visibility)**: Profile badge hover kept `color: var(--text-muted)` — identical to the default, providing no visible hover feedback. Fixed: `color: var(--text)` on hover so the label lightens.
  - **BUG-1D-R4-2 (UX/Visibility)**: Auth badge hover also kept `color: var(--text-muted)` — same invisible hover. Fixed: `color: var(--text)` on hover.
  - **BUG-1D-R4-3–18 (CSS Token Sweep)**: 16 hardcoded `rgba(255,255,255,...)` and one `rgba(0,0,0,...)` value across auth badge defaults/hover/open-state, auth popover header/close-hover/pw-toggle-hover/no-auth-hint/footer, profile badge default-border/hover, profile modal border/header-border/close-hover/section-divider/list-scrollbar/row-bg/row-border/row-hover, and recent endpoint button hover — all replaced with CSS variable equivalents (`var(--surface-hover)`, `var(--border)`, `color-mix(in srgb, var(--border) …, …)`, etc.) for light/dark theme compatibility.
  - **BUG-1D-R4-19 (A11y)**: Auth badge button only had a `title` attribute for screen readers. `title` is not reliably announced by all assistive technologies. Fixed: added explicit `aria-label="Authentication: ${authLabel} — click to configure"`.
  - **BUG-1D-R4-20 (A11y/Focus)**: After closing the auth popover via Escape key or the × close button, focus was not returned to the triggering button. Per the ARIA dialog pattern, closing a modal/popover via keyboard must return focus to the element that opened it. Fixed: (a) Escape handler in `GraphqlAuthPopover.tsx` calls `anchorRef.current?.focus()` before `onClose()`. (b) Close button `onClick` also calls `anchorRef.current?.focus()` before `onClose()`. Click-outside dismissal intentionally does NOT restore focus (user is navigating away).
  - **BUG-1D-R4-21 (Code Quality)**: `gql-auth-badge-wrap` had `position: relative` applied as an inline `style` in JSX. Moved to the CSS class `.gql-auth-badge-wrap` in `graphql-studio.css`, consistent with `gql-connection-url-wrap`.
- Bug fixes applied in re-evaluation round 5 (2026-06-17):
  - **BUG-R5-1 (A11y/Focus)**: Profile modal close via Escape or × didn't restore focus — after dismissal, focus evaporated into the void (the modal container had `tabIndex=-1`, so keyboard users were stranded). Fixed in `GraphqlStudioPage.tsx`: `onClose` now calls `requestAnimationFrame(() => document.querySelector('[data-testid="gql-profile-badge"]')?.focus())` to return focus to the profile badge button. Intentional exception: closing via the **Load** action does not restore focus, since the user's intent is to continue with the newly-loaded endpoint.
  - **BUG-R5-5 (CSS Specificity)**: After the Round 4 hover color fix (`gql-auth-badge:hover { color: var(--text) }`), the configured auth badge lost its accent color on hover. Both `.gql-auth-badge:hover` (specificity 0,2,0) and `.gql-auth-badge--configured` (0,1,0) applied — the higher-specificity hover rule stripped the accent. Fixed: added `color: var(--gql-accent)` to `.gql-auth-badge--configured:hover` so the accent is explicitly preserved on hover for configured badges.

### Phase 1E Implementation Summary (Done — Re-evaluated ×6)

- **New file: `src/features/graphql/utils/envUtils.ts`** — pure utilities (no React):
  - `resolveVars(str, env)` — replaces `{{key}}` with values from enabled vars; unresolved refs stay as-is; single-pass only
  - `findUnresolvedVars(str, env)` → `string[]` — returns list of unresolved `{{key}}` names
  - `hasUnresolvedVars(str, env)` → `boolean` — shorthand for `findUnresolvedVars(...).length > 0`
  - Uses `buildVarMap()` helper: only `enabled: true` + non-empty-key vars are resolved
- **New file: `src/features/graphql/hooks/useGraphqlEnvironments.ts`** — environment state hook:
  - Manages `GraphqlEnvironment[]` persisted in `localStorage` under `gql_environments_v1`
  - `activeEnvironment: GraphqlEnvironment | null` — the env with `isActive: true`
  - `createEnvironment(name)` → id; auto-activates first env only if it's the first created
  - `deleteEnvironment(id)` — auto-activates first remaining env if active env is deleted
  - `setActiveEnvironment(id | null)` — only one active at a time
  - `updateEnvironmentName(id, name)` / `updateVariables(id, vars[])` — mutations
  - `importEnvironment(json)` — supports Postman format (`values[]`) and native format (`variables[]`)
  - `exportEnvironment(id)` — returns JSON string (without `id` or `isActive` fields)
- **New file: `src/features/graphql/components/GraphqlEnvModal.tsx`** — two-panel modal:
  - Left sidebar (210px): env list, active-env green dot, hover delete (trash), `[+ New]`, `[↑ Import]`
  - Right panel: click-to-edit env name, `[Active ✓]` badge or `[Set Active]` button, `[↓ Export]`
  - Variable table: enabled checkbox, key input, value input (masked when `masked: true`), 🔒 secret toggle (amber), × delete
  - `[+ Add Variable]` button at bottom
  - Escape key closes (with `stopPropagation`); click outside panel closes
  - After `+ New`: env is selected and name edit mode activates immediately (via `skipNextResetRef` + `requestAnimationFrame`, no flash)
  - After import: the last env in the list is auto-selected (via `prevEnvCountRef` effect)
  - Non-masked values render as plain `gql-input`; only `masked: true` values use the `gql-env-masked-wrap` border container
- **Updated: `GraphqlConnectionBar.tsx`**:
  - New `activeEnvName` + `onEnvBadgeClick` props
  - Env badge placed between URL input and auth badge: gray `No Env ▾` / teal `Staging ▾`
  - Badge shows name truncated to 18 chars with `…`
- **Updated: `GraphqlStudioPage.tsx`**:
  - `useGraphqlEnvironments()` hook wired; `activeEnvironment` threaded through
  - `envModalOpen` state controls `GraphqlEnvModal` visibility
  - `handleExecute`: `resolveVars()` applied to endpoint URL, all header values, and variables JSON at call time — stored values never mutated
  - `activeEnvironment` passed to `GraphqlHeadersPanel`
- **Updated: `GraphqlHeadersPanel.tsx`**:
  - New `activeEnvironment?: GraphqlEnvironment | null` prop
  - Value column is now wrapped in `.gql-headers-cell--value-wrap` flex div
  - Enabled headers with unresolved `{{var}}` refs show amber `⚠` warning icon with tooltip listing each missing var name
- **CSS additions (`graphql-studio.css`)**:
  - `.gql-env-badge` / `.gql-env-badge--active` — env button with teal accent when active
  - `.gql-env-modal-overlay` — transparent fixed overlay
  - `.gql-env-modal` — 780px panel with heavy shadow
  - `.gql-env-sidebar` + `.gql-env-sidebar-header/list/item/footer` — left env list panel
  - `.gql-env-active-dot` / `.gql-env-active-dot--on` — green glow dot for active env
  - `.gql-env-main` + `.gql-env-main-header` + `.gql-env-name-display` — right panel
  - `.gql-env-var-row` + `.gql-env-masked-wrap` + `.gql-env-var-secret-toggle` — variable table
  - `.gql-env-active-badge` — green `Active ✓` badge
  - `.gql-headers-cell--value-wrap` + `.gql-headers-unresolved-icon` — header warning system
- **Mockup updated (`graphql-studio-main.html`)**:
  - Env badge shown in connection bar (teal `Staging ▾` example)
  - Full env manager modal mockup (env list, variable table, active badge, secret masking)
  - UX guide annotations in HTML comments
- Bug fixes applied in re-evaluation round 1:
  - **BUG-1E-V1 (Critical Logic)**: When switching environments in the modal, the `localVars` flush effect was called with the new `selectedId` but OLD `localVars` (before the sync effect updated them) — writing the old env's variables to the new env. Fixed by using a `selectedIdRef` (updated every render) instead of putting `selectedId` in the flush effect's deps, plus a `flushInitRef` to skip the initial-mount flush entirely.
  - **BUG-1E-V2 (Polish)**: `handleFileChange` had redundant `setSelectedId(null) + setTimeout` logic — the `prevEnvCountRef` effect already handles auto-selecting the imported env. Removed the dead code.
  - **BUG-1E-V3 (CSS)**: `.gql-headers-cell--value` inside the new flex wrapper inherited `width: 100%` from the class rule, which conflicts with `flex: 1` sizing. Added `width: auto` override to `.gql-headers-cell--value-wrap .gql-headers-cell--value`.
- Bug fixes applied in re-evaluation round 2:
  - **BUG-R2-1 (UX — Flash)**: Creating a new environment caused a visible flash: `setSelectedId(id)` triggers the `useEffect([selectedId, selectedEnv?.name])` sync effect which sets `editingName = false`, then the 50ms timeout re-sets it to `true`. Fixed by introducing `skipNextResetRef` (a `useRef`) and using `requestAnimationFrame` instead of `setTimeout(50)`. The ref tells the sync effect to skip the reset; RAF fires after React paints the new env in the sidebar, avoiding any intermediate false→true transition.
  - **BUG-R2-2 (Layout — Modal height)**: `gql-env-modal` had no `min-height`, causing the modal to collapse to a tiny panel when there are no environments or variables. Added `min-height: 440px` so the modal always appears as a full, professional panel.
  - **BUG-R2-3 (CSS — Focus ring)**: `gql-env-masked-wrap` had no `:focus-within` styling. When the secret value input inside received focus, the border stayed gray (the input's own focus ring was suppressed via `border: none` from the parent override). Added `.gql-env-masked-wrap:focus-within { border-color: accent; box-shadow }` and `outline: none` on the inner input so the wrapper's focus ring is used instead.
  - **BUG-R2-4 (UX — Error persistence)**: Import error message stayed visible forever. Added a `useEffect` that clears `importError` after 5 seconds via `setTimeout`.
  - **BUG-R2-5 (Polish — No activation feedback)**: When clicking "Set Active", the static badge replacement with "Active ✓" gave no motion cue that the action was received. Added `@keyframes gql-badge-pop` (scale 0.8→1.06→1, opacity 0→1, 0.18s) on `.gql-env-active-badge`.
  - **BUG-R2-6 (UX — Tooltip text)**: Env badge `title` for no-env state said "No environment selected" — uninformative. Updated to "No environment active — click to set up environment variables". Active state: "Active environment: ${name} — click to manage".
  - **BUG-R2-7 (Layout — MaskedInput wrapper)**: `MaskedInput` always wrapped the value in `.gql-env-masked-wrap` (border-providing div) regardless of whether `masked = true` or `false`. Non-masked variables ended up inside an extra container that provided redundant visual styling. Fixed: non-masked renders a plain `gql-input gql-env-var-input`, masked renders inside the wrap div with `autoComplete="new-password"` and no `gql-input` class on the inner input. Also added `min-width: 0` to `gql-env-var-input` to allow flex shrinking in the variable table.
  - **Polish**: Moved `nameValue` state declaration above the auto-clear `useEffect` for cleaner hook ordering.
- Bug fixes applied in re-evaluation round 3:
  - **BUG-R3-1 (CSS — Padding)**: The masked input inside `.gql-env-masked-wrap` had no padding — text rendered flush against the border. Non-masked inputs get `padding: 5px 9px` from the `gql-input` class, but the masked path only applied `gql-env-var-input` (no `gql-input`, no explicit padding). Fixed by adding `padding: 5px 9px` to `.gql-env-masked-wrap .gql-env-var-input` in the CSS.
  - **BUG-R3-2 (UX — Empty state coherence)**: When there are no variables, the empty state text was vertically centered but the "Add Variable" button sat at the bottom-left — visually disconnected. Fixed by restructuring the JSX: in the empty branch, the button is rendered INSIDE the empty-state div with `gql-env-var-add--centered` modifier (solid border, teal color, centered alignment). In the non-empty branch, the button remains below the scrollable table as before.
  - **BUG-R3-3 (Logic — Blank name commit)**: In `commitName`, if the user cleared the name input and blurred, `onRename` was correctly skipped but `nameValue` stayed as `''`. The next time the user clicked the name to edit, the input showed blank text instead of the actual environment name. Fixed by adding an `else` branch in `commitName` that resets `nameValue` to `selectedEnv?.name` when the trimmed value is empty.
- Bug fixes applied in re-evaluation round 4 (2026-06-17):
  - **BUG-1E-R4-1–13 (CSS Token Sweep)**: 13 hardcoded `rgba(255,255,255,...)` values replaced with CSS variables — env badge default/hover bg, modal close hover, sidebar item hover, env name display hover, inline `{{KEY}}` code bg, var row border/hover, masked-value toggle hover, secret toggle hover. All replaced with `var(--surface-hover)`, `color-mix(in srgb, var(--border) …, …)`, etc. for light/dark theme compatibility.
  - **BUG-1E-R4-14 (CSS Design Token — Teal)**: Env badge active state and schema-explorer interface kind badge used hardcoded Catppuccin teal `#94e2d5` and `rgba(148,226,213,...)`. On light themes, these would produce the wrong tint (white-on-white for low-opacity backgrounds) or jarring fixed colors. Fixed: added `--gql-teal: var(--teal, #94e2d5)` to the `.gql-studio` CSS block (falls back to the Catppuccin constant). Replaced all `#94e2d5` / `rgba(148,226,213,...)` occurrences with `var(--gql-teal)` and `color-mix(in srgb, var(--gql-teal) …%, transparent)`. Also updated `.gql-se-kind--interface` and `.gql-se-impl-link` for full consistency.
  - **BUG-1E-R4-15 (A11y/Focus)**: Closing the env manager modal via Escape or the × button did not return focus to the triggering element. After dismissal, keyboard users were left with no focused element. Fixed in `GraphqlEnvModal.tsx`: added `restoreFocusToTrigger()` helper (queries `[data-testid="gql-env-badge"]` and focuses it via `requestAnimationFrame`). Called in both the Escape key handler (non-editing-name path) and the × button's `onClick`. Click-outside dismissal intentionally does NOT restore focus (user clicked elsewhere).
- Additional cross-phase token sweep (Round 4 — comprehensive):
  - **Schema explorer SDL copy btn hover**: `rgba(255,255,255,0.06)` bg and `rgba(255,255,255,0.16)` border → `var(--surface-hover)` and `var(--border)`.
  - **CTA/SE spinner track** (`.gql-se-btn-spinner`): `rgba(255,255,255,0.3)` → `color-mix(in srgb, currentColor 30%, transparent)` — track now matches the spinner color for consistent appearance on any background.
  - **Ghost button hover** (`.gql-btn--ghost:hover`): `rgba(255,255,255,0.05)` bg and `rgba(255,255,255,0.18)` border → `var(--surface-hover)` and `var(--border)`.
  - **Primary button spinner** (`.gql-btn-spinner`): `rgba(255,255,255,0.3)` track and `#fff` tip → `currentColor` pattern (`color-mix(in srgb, currentColor 30%, transparent)` track / `currentColor` tip) for full theme compatibility.
  - **Profile auth badge** (`.gql-profile-auth-badge`): `rgba(255,255,255,0.06)` bg and `rgba(255,255,255,0.08)` border → `var(--surface-hover)` and `var(--border)`.
  - **Profile delete button default border** (`.gql-profile-btn--delete`): `rgba(255,255,255,0.07)` → `var(--border)`.
  - **Profile save-form section bg** (`.gql-profile-section--save`): `rgba(255,255,255,0.015)` → `color-mix(in srgb, var(--border) 15%, transparent)`.
  - **Profile save-form preview** (`.gql-profile-save-form__preview`): `rgba(255,255,255,0.03)` bg and `rgba(255,255,255,0.06)` border → `color-mix(in srgb, var(--border) 25%, transparent)` and `color-mix(in srgb, var(--border) 50%, transparent)`.
  - **Schema explorer type list item separator** (line ~2348): `rgba(255,255,255,0.04)` border-bottom → `color-mix(in srgb, var(--border) 40%, transparent)`.
  - **Schema explorer field count** (`.gql-se-type-count`): `rgba(255,255,255,0.28)` color → `var(--text-muted)` (field count is a UI label, not a decorative element).
  - **Schema explorer field table row** (`.gql-se-ftr`): `rgba(255,255,255,0.05)` border-bottom → `color-mix(in srgb, var(--border) 50%, transparent)`.
  - **Result**: `graphql-studio.css` now has **zero** hardcoded `rgba(255,255,255,...)` values.
- Bug fixes applied in re-evaluation round 5 (2026-06-17):
  - **BUG-1E-R5-1 (CSS Design Tokens — Mauve/Peach)**: Added `--gql-mauve: var(--mauve, #cba6f7)` and `--gql-peach: var(--peach, #fab387)` to the `.gql-studio` CSS block. These cover enum kind badges, schema arg names, SDL/JSON keyword/number tokens, and boolean values — all were previously hardcoded Catppuccin constants.
  - **BUG-1E-R5-2 (CSS — Toggle thumb)**: `#fff` on `.gql-polling-switch-thumb` → `var(--bg)`. On light themes, a white thumb on a light-gray track is invisible; `--bg` is always the page background, contrasting naturally against the `--gql-success` active track.
  - **BUG-1E-R5-3 (CSS — Danger button hover)**: `#ef5350` on `.gql-btn--danger:hover` → `var(--gql-danger)` for consistency.
  - **BUG-1E-R5-4 (CSS — Tab type dots)**: Hardcoded Material Design colors `#4fc3f7` (query), `#ef9a9a` (mutation), `#a5d6a7` (subscription) → `var(--gql-accent)`, `var(--gql-danger)`, `var(--gql-success)`.
  - **BUG-1E-R5-5 (CSS — Response error count)**: `#ef9a9a` → `var(--gql-danger)`.
  - **BUG-1E-R5-6 (CSS — Schema kind badges)**: `rgba(243,139,168,0.2)` (union) / `rgba(250,179,135,0.2)` (input) / `rgba(203,166,247,0.2)` (enum) / `rgba(166,227,161,0.2)` (scalar) + matching text colors → replaced with `color-mix()` of `--gql-danger`, `--gql-peach`, `--gql-mauve`, `--gql-success`.
  - **BUG-1E-R5-7 (CSS — Schema explorer labels)**: `#fab387` (arg names), `#cba6f7` (enum values bg/fg, SDL toolbar label) → `var(--gql-peach)` / `var(--gql-mauve)`.
  - **BUG-1E-R5-8 (CSS — SDL syntax tokens)**: All 7 hardcoded colors in SDL viewer token rules replaced with CSS vars: `var(--gql-mauve)` keyword, `var(--gql-warning)` arg, `var(--gql-danger)` directive, `var(--text-muted)` comment/punc, `var(--gql-success)` string, `var(--gql-peach)` number.
  - **BUG-1E-R5-9 (CSS — JSON syntax tokens)**: All 5 hardcoded colors in JSON viewer token rules replaced: `var(--gql-success)` string, `var(--gql-peach)` number, `var(--gql-mauve)` boolean, `var(--text-muted)` null/punc.
  - **Result**: `graphql-studio.css` now has **zero** hardcoded semantic color values — all syntax/kind/state colors go through CSS design tokens. The only remaining hardcoded value is `#12261c` (very dark green text on the method badge), which is intentional for contrast against the bright green background.
  - **BUG-1E-R5-10 (A11y — Env badge aria-label)**: `aria-label` for the env badge was inconsistent with its `title`. Active: aria-label said `"Environment: {name}"` vs title `"Active environment: {name} — click to manage"`. No-env: aria-label said `"No environment — click to manage"` vs title `"No environment active — click to set up environment variables"`. Fixed: aria-label now mirrors the title exactly in both states.
- Bug fixes applied in re-evaluation round 6 (2026-06-17):
  - **BUG-1E-R6-1 (A11y — ARIA listbox/option invalid structure)**: The env sidebar used `<ul role="listbox">` with `<li role="option">` containing nested `<button>` elements inside each option. ARIA requires that `role="option"` elements BE the interactive elements (not contain them), and `role="listbox"` implies arrow-key navigation which was not implemented. This is an ARIA validity violation that causes confusing screen reader announcements. Fixed: changed to plain `<ul role="list">`, removed `role="option"` and `aria-selected` from `<li>`, and added `aria-current="true"` to the selected item's inner `<button>` — which is the correct pattern for sidebar navigation lists.
  - **BUG-1E-R6-2 (A11y — No initial focus on modal open)**: When `GraphqlEnvModal` mounted, no element received focus — keyboard-only and screen reader users were left with focus on the env badge button behind the modal, unable to navigate into it without pressing Tab many times. Fixed: added `tabIndex={-1}` to the modal panel `<div>` and a mount `useEffect` that calls `panelRef.current?.focus()`. This announces the dialog label ("Environment Variables") to screen readers and positions focus inside the modal as per ARIA dialog open patterns.
  - **Mockup updated (`graphql-studio-main.html`)**: Added `role="dialog"`, `aria-label`, `aria-modal`, and `tabindex="-1"` to the env modal `<div>`. Updated sidebar list to use `role="list"` and `aria-current="true"` on the selected button. Fixed the modal box-shadow inner glow (replaced `rgba(255,255,255,0.04)` with `#2a2a40`). Added clarifying HTML comments for the new ARIA patterns.

### Phase 1 Gap Items — Implementation Summary (Done + Re-evaluated ×6 + Round 7–9 gap-fill)

#### Round 10 — Audit-driven polish (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R10-1** | **Prettify no-op set `unsavedChanges: true`** — `gqlPrint(gqlParse(query))` on an already-canonical query returns the identical string, but `handleQueryChange` was called unconditionally, setting `unsavedChanges: true` and showing the unsaved dot + requiring two-click close. | Added `if (formatted === query) return;` before `handleQueryChange`. |
| **BUG-R10-2** | **`role="tabpanel"` had no `aria-labelledby`** — the single `<div role="tabpanel">` in `GraphqlResponseViewer.tsx` wasn't linked to the active tab button. Screen readers would announce "tab panel" without context. | Added `id` attributes to each tab button (`gql-rv-tab-body-btn`, etc.), `aria-controls="gql-rv-tabpanel"` on each tab, and `aria-labelledby={\`gql-rv-tab-${activeTab}-btn\`}` on the panel div. |
| **BUG-R10-3** | **`pushRecentEndpoint` stored the raw template URL** — if endpoint was `https://{{host}}/graphql`, the recent dropdown showed the unresolved placeholder instead of the human-readable resolved URL. | Moved `pushRecentEndpoint` call to after `resolveVars`, passing `resolvedEndpoint` instead of raw `endpoint`. |
| **BUG-R10-4** | **Stale comment in `updateActiveTab`** — comment said "useCallback with [setTabs, activeTabId]" but actual deps array is `[]` (stable via `activeTabIdRef`). | Corrected comment to accurately describe the `[]` deps pattern. |

---

#### Round 9 — `selectedOperation` per-tab bug (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R9-1** | **`selectedOperation` was global state, not per-tab** — switching away from Tab A then back lost the user's operation-picker selection (always reset to the first operation). For a tab with `[GetUser, GetPost]` where the user selected "GetPost", returning after a tab switch would silently reset to "GetUser". | Added `selectedOperation?: string` to `GraphqlOperationTab` type. Replaced the global `useState` with a derived value from `activeTab.selectedOperation`. Added `handleSelectOperation` callback that calls `updateActiveTab`. Added a normalising `useEffect([activeTab?.query])` that clears stale/invalid stored selections when the operations list changes. `normalizeTab` now restores the field from localStorage. |

---

#### Re-evaluation Round 8 — Prettify + Empty-Endpoint Polish (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R8-1** | Prettify button `background: var(--surface)` blended into Monaco's dark editor background — at `opacity: 0.55` the button was nearly invisible against the editor canvas. | Added `backdrop-filter: blur(6px)` and `background: color-mix(in srgb, var(--surface) 85%, transparent)` so the button always reads clearly over the dark editor regardless of theme token values. Raised resting opacity to `0.75`. |
| **BUG-R8-2** | Missing `user-select: none` on Prettify button — clicking the button label could accidentally select the text "Prettify". | Added `user-select: none` to `.gql-prettify-btn`. |
| **BUG-R8-3** | Missing `white-space: nowrap` on Prettify button — the label could wrap to two lines on narrow layouts. | Added `white-space: nowrap` to `.gql-prettify-btn`. |
| **BUG-R8-4** | Prettify button had `right: 10px` — right edge of button was touching Monaco's ~10px vertical scrollbar with 0px visual gap. | Changed to `right: 14px` for a clean 4px gap between button and scrollbar track. |
| **BUG-R8-5** | Redundant `pointer-events: auto` in `.gql-prettify-btn` CSS — this is the default value; no effect but adds noise. | Removed. |
| **BUG-R8-6** | Mockup HTML (`graphql-studio-main.html`) was missing the Prettify button and the empty-endpoint disabled-button state. | Added `.prettify-btn` CSS rules and button overlay to the editor area. Added HTML comment documenting the empty-endpoint disabled state for Execute + Introspect. |

---

**Round 7 gap-fill (2026-06-17): Two remaining table-stakes items found during final Phase 1 audit.**

#### 7. Empty Endpoint Disables Execute + Introspect Buttons

**Problem**: `executeDisabled` and `introspectDisabled` in `GraphqlConnectionBar.tsx` did not check `!endpoint.trim()`. The `handleExecute` handler in `GraphqlStudioPage.tsx` already early-returned on empty endpoint, but the button appeared *visually enabled* — users could click it and nothing would happen with no feedback.

**Fix**: Added `noEndpoint = !endpoint.trim()` and included it in both disabled conditions. Updated `aria-label` and `title` attributes on both buttons to explain why they're disabled when the endpoint is empty (e.g. "Enter an endpoint URL first"). This matches standard UX: if an action can't fire, its trigger must look disabled.

**Files changed**: `GraphqlConnectionBar.tsx`

---

#### 8. Prettify / Format Query Button

**Purpose**: Every major GraphQL IDE (GraphiQL, Insomnia, GraphQL Playground, Apollo Studio) has a Prettify button that normalises query indentation and whitespace using `print(parse(query))`. This is table-stakes for a GraphQL editor and was missing entirely.

**Design decisions**:
- Floating button overlay in the **top-right corner of the query editor pane** — discoverable without cluttering the connection bar
- Rests at 55% opacity; becomes fully opaque on hover/focus so it doesn't distract while writing
- On success: silently formats the query in-place (calls `handleQueryChange` which updates the tab label, operation type, etc.)
- On **parse failure** (syntax errors in the query): button flashes red with a shake animation for 1 second, then resets — no destructive changes made. This teaches the user their query has unfixable syntax before they can format it
- Icon: pen/wand SVG (matches the "edit/transform" metaphor)
- Keyboard accessible: focusable, `:focus-visible` ring, `aria-label` updates on error state

**Files changed**:
- `GraphqlStudioPage.tsx`: `import { parse as gqlParse, print as gqlPrint } from 'graphql'`, `prettifyError` state, `prettifyErrorTimerRef`, `handlePrettify` callback, button JSX overlay in `gql-editor-pane`
- `graphql-studio.css`: `.gql-prettify-btn`, `.gql-prettify-btn:hover/focus-visible/active`, `.gql-prettify-btn--error`, `@keyframes gql-prettify-shake`

---

**Second batch (2026-06-17): Three high-impact features added after a second gap analysis.**

#### 4. Execution Error Monaco Markers (Phase 1 Gap)

**Purpose**: When the GraphQL server returns errors with `locations` (line/column info), show them as red squiggles directly in the editor — the same affordance users see for schema validation errors.

**Design decisions**:
- Uses a separate Monaco owner `'gql-execution'` to coexist cleanly with `'gql-schema-validate'` markers
- Only errors with `locations` field produce squiggles; network/transport errors don't have locations
- Markers are cleared immediately on tab switch (a second `useEffect` on `activeTab.modelUri` ensures stale response markers never bleed onto a different tab's editor)
- Markers are cleared on execution success (response with no errors)

**Files changed**:
- `GraphqlStudioPage.tsx`:
  - `useMonaco()` hook from `@monaco-editor/react` for direct Monaco API access
  - `prevExecModelUriRef` + `useEffect([activeTab?.modelUri])` — clears execution markers when tab changes
  - `useEffect([response])` — sets markers from `response.errors[].locations`, clears on success

---

#### 5. Schema Polling Config UI (Phase 1 Gap)

**Purpose**: Wire the already-built polling infrastructure to an actual UI. Previously `pollingIntervalMs` was never passed to `useGraphqlSchema`, leaving schema auto-refresh permanently disabled.

**Design decisions**:
- State lives in `GraphqlStudioPage` and is persisted to localStorage (`gql_polling_v1`)
- Default: polling OFF, interval 30 seconds
- Minimum interval: 10s; maximum: 3600s (1 hour)
- The schema polling config button appears next to the "Schema loaded (N)" badge — clicking opens a small popover
- The popover has a toggle switch + interval input (seconds); only interval input shows when polling is enabled
- When toggling polling ON, the interval is clamped before being applied
- The pulsing green dot already existing in the schema badge activates automatically when polling is enabled

**Files changed**:
- `GraphqlStudioPage.tsx`:
  - `pollingEnabled` state (boolean, localStorage persisted)
  - `pollingIntervalSeconds` state (number, defaults 30, localStorage persisted)
  - `handlePollingChange(enabled, intervalSeconds)` — updates state + localStorage
  - `pollingIntervalMs` — computed: `pollingEnabled ? pollingIntervalSeconds * 1000 : 0`
  - `useGraphqlSchema(endpoint, activeTabHeaders, { pollingIntervalMs, skipTlsVerify })` — now receives polling config
- `GraphqlConnectionBar.tsx`:
  - `pollingEnabled`, `pollingIntervalSeconds`, `onPollingChange` props
  - `pollingBtnRef`, `pollingPopoverRef`, `pollingSwitchRef` refs
  - Polling config popover with toggle switch + interval input + hint text
  - `commitPollingInterval()` — clamps + propagates interval on blur/Enter
  - Autofocus to toggle switch when popover opens (`useEffect` + `requestAnimationFrame`)
  - Escape closes popover; click-outside closes popover
- `graphql-studio.css`:
  - `.gql-schema-status-wrap` — flex wrapper for badge + config button
  - `.gql-polling-config-btn` / `--active` — small circular button, green when polling active
  - `.gql-polling-popover`, `.gql-polling-popover-header/body` — floating config panel
  - `.gql-polling-switch` / `--on` / `.gql-polling-switch-thumb` — CSS toggle switch
  - `.gql-polling-interval-row/input/unit` — interval row layout
  - `.gql-polling-hint` — instructional text at bottom of popover

---

#### 6. TLS Skip Toggle (Phase 1 Gap)

**Purpose**: Allow connecting to GraphQL endpoints with self-signed or invalid TLS certificates (common in dev/staging environments). The `GraphqlConnection.skipTlsVerify` field already existed in the type system but was never wired to UI or HTTP transport.

**Architecture**:
In web mode, HTTP requests are proxied via `/__proxy` in `vite.config.ts`. The `skipTlsVerify` flag is added to the POST body payload; the middleware creates an undici `Agent` with `connect: { rejectUnauthorized: false }` for that specific request.

In Tauri mode, `httpFetch` falls through to the Tauri HTTP plugin which handles TLS separately.

**Design decisions**:
- Toggle only visible when endpoint URL starts with `https://` (irrelevant for `http://`)
- Active (TLS disabled) state uses amber/warning color — visually communicates "unsafe"
- Shield icon with diagonal line (active) vs. plain shield (inactive) — universally understood
- Label: `SSL` (normal) / `SSL off` (active) — short, unambiguous
- State persisted to localStorage (`gql_tls_skip_v1`)
- A new `gqlFetch.ts` utility wraps `/__proxy` with `skipTlsVerify` support

**Files changed**:
- `vite.config.ts`:
  - Extended `/__proxy` payload type with `skipTlsVerify?: boolean`
  - When `skipTlsVerify=true` + `https://` URL: creates one-off undici `Agent({ connect: { rejectUnauthorized: false } })`; bypasses the pooled dispatcher
- `src/features/graphql/utils/gqlFetch.ts` (NEW):
  - `gqlFetch(url, method, headers, body, signal, skipTlsVerify)` — GQL-specific transport helper
  - Web mode + TLS skip: calls `/__proxy` directly with `skipTlsVerify: true` in the JSON payload
  - All other cases: delegates to standard `httpFetch`
- `useGraphqlExecution.ts`:
  - `skipTlsVerify?: boolean` added to `ExecuteParams`
  - `httpFetch` replaced with `gqlFetch` throughout
- `useGraphqlSchema.ts`:
  - `skipTlsVerify?: boolean` added to `UseGraphqlSchemaOptions`
  - `skipTlsVerifyRef` tracks latest value for use inside callbacks
  - `gqlFetch` replaces `httpFetch` in `runIntrospection`
- `GraphqlConnectionBar.tsx`:
  - `skipTlsVerify`, `onSkipTlsVerifyChange` props
  - `isHttps` derived from endpoint URL
  - TLS toggle button (only rendered for `https://`): `aria-pressed`, shield SVG (with/without slash), amber active state
- `GraphqlStudioPage.tsx`:
  - `skipTlsVerify` state (boolean, localStorage persisted as `gql_tls_skip_v1`)
  - `handleSkipTlsVerifyChange(skip)` — updates state + localStorage
  - Passed to `GraphqlConnectionBar` + `useGraphqlSchema` options + `handleExecute`
- `graphql-studio.css`:
  - `.gql-tls-toggle` — base button (muted colors)
  - `.gql-tls-toggle--active` — amber warning state
  - `.gql-tls-toggle-label` — 11px font

---

#### Keyboard Shortcuts (Phase 1 Gap)

**`⌘Shift+I` / `Ctrl+Shift+I` — Introspect**: Triggers `introspect()` from `useGraphqlSchema`. Works in both Tauri and browser.

**`⌘W` / `Ctrl+W` — Close active tab**: Only in Tauri (browsers intercept `⌘W` to close the browser window). Uses the two-click confirm pattern for unsaved tabs.

**`⌘T` / `Ctrl+T` — New tab**: Only in Tauri (browsers intercept `⌘T` to open a new browser tab).

**Files changed**: `GraphqlStudioPage.tsx` — keyboard handler extended with 3 new shortcuts.

---

#### Re-evaluation Round 6 — Bugs fixed (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R6-1** | **Auth headers missing from introspection** — `useGraphqlSchema` only received the tab's custom headers, not the auth config from the Auth badge. Endpoints requiring Bearer tokens, API keys, or other auth to access their schema would silently receive a 401/403 during introspection even after the user correctly configured auth. Execution worked fine (it merged auth in `handleExecute`) but schema exploration was blocked. | Added `schemaHeaders` `useMemo` in `GraphqlStudioPage.tsx` that merges `buildAuthHeaders(auth)` with `activeTabHeaders` (tab-level headers override auth, same priority as execution). `useGraphqlSchema` now receives `schemaHeaders` instead of bare `activeTabHeaders`. |
| **BUG-R6-2** | **Env vars not resolved in introspection URL and headers** — The raw `endpoint` template (e.g. `https://{{SERVER}}/graphql`) and header values (e.g. `Bearer {{TOKEN}}`) were passed directly to `useGraphqlSchema` without `{{variable}}` substitution. The resolved environment URL/headers were only used during execution. | `useGraphqlSchema` now receives `resolveVars(endpoint, activeEnvironment)` as its endpoint. The new `schemaHeaders` memo also runs `resolveVars(v, activeEnvironment)` on each header value before passing to the schema hook. |

---

#### Re-evaluation Round 5 — Bugs fixed (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R5-1** | `⌘Enter` keyboard shortcut bypassed `varsInvalid` guard — pressing `⌘Enter` with invalid variables JSON still fired `execute()`, even though the Execute button was visually disabled. | Added `varsError !== null` early-return guard in `handleExecute`; added `varsError` to the `useCallback` deps array. |
| **BUG-R5-2** | Polling popover didn't restore focus on close — pressing Escape moved focus to nothing, stranding keyboard users. | `closePollingPopoverViaRef.current()` now calls `requestAnimationFrame(() => pollingBtnRef.current?.focus())` after setting `pollingOpen = false`. |
| **CSS-R5-3** | `gql-input:invalid` missing — when the interval number input had a value below `min={10}`, the browser's native `:invalid` red border could bleed through the custom border styles. | Added `.gql-input:invalid { border-color: var(--border); box-shadow: none; }` and `.gql-input:invalid:focus` override — clamping on blur makes native validation unnecessary. |
| **BUG-R5-4** | Clicking the polling config button a second time to close called `setPollingOpen(false)` directly, bypassing `closePollingPopoverViaRef` — any uncommitted interval edit was silently discarded. | Button `onClick` now checks `pollingOpen`; when true, calls `closePollingPopoverViaRef.current()` instead of toggling state directly. |
| **CSS-R5-5** | `.gql-polling-dot` still used hardcoded `#a6e3a1` instead of `var(--gql-success)` (missed in Round 3 token sweep). | Updated to `background: var(--gql-success)`. |
| **CSS-R5-6** | `.gql-polling-dot` had `margin-right: 4px`, causing 9px total gap in polling state (`margin + flex gap`) vs 5px in static state. Visual inconsistency between dot variants. | Removed `margin-right: 4px`; added `flex-shrink: 0` instead. Parent flex `gap: 5px` now handles spacing uniformly for both dot variants. |

---

#### Re-evaluation Round 4 — Bugs fixed (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R4-1** | **Execution markers race condition** — The markers effect depended on `activeTab?.modelUri`, so it re-ran on every tab switch. When switching from tab A to tab B while tab A had error markers, the effect applied tab A's response errors to tab B's editor model. Users switching tabs would see misleading squiggles in a fresh editor. | Added `responseModelUriRef` (records the model URI when `execute()` fires). Effect now resolves the Monaco model for the **owner tab** (the tab that fired the execution), not the currently active tab. Removed `activeTab?.modelUri` from the effect's dep array — Monaco persists markers per-model URI, so markers survive tab switches without re-running the effect. |
| **BUG-R4-2** | **Polling popover stale closure** — The click-outside and Escape key event listeners (in a `useEffect` gated on `pollingOpen`) captured `closePollingPopover` at the time `pollingOpen` changed to `true`. If the user typed a new interval value, the effect closure still saw the old `localIntervalSeconds` from when the popover opened. Closing via outside click / Escape would silently discard the typed value. | Added `localIntervalSecondsRef`, `pollingEnabledRef`, `onPollingChangeRef` mirrors updated every render. Added `closePollingPopoverViaRef` ref updated each render with the freshest close logic. Effect handlers now call `closePollingPopoverViaRef.current()` — always the latest version. |
| **BUG-R4-3** | **Polling popover: typing a value then pressing Escape discards the edit** — Even after the stale-closure fix, pressing Escape or clicking outside while the interval input had an uncommitted value would discard it (old behavior: just call `setPollingOpen(false)`). | `closePollingPopoverViaRef.current()` now commits the interval (clamps + propagates via `onPollingChange`) before setting `pollingOpen = false`. |
| **BUG-R4-4** | **`closePollingPopover` used before `const` declaration** — The `useEffect` for outside-click/Escape was defined before `closePollingPopover`, creating a temporal dead zone (TDZ) crash at runtime. | Restructured the polling section: all helpers (`commitPollingInterval`, refs, `closePollingPopoverViaRef`) are declared before the `useEffect` that uses them. |
| **CSS-R4-5** | **Stale `eslint-disable-next-line` comment** — After removing `activeTab?.modelUri` from the markers effect's deps, the `exhaustive-deps` disable comment became a false positive. | Removed the dead comment; ESLint now passes with `--max-warnings 0`. |

---

#### Re-evaluation Round 3 — Bugs fixed (2026-06-17)

| Bug | Description | Fix |
|-----|-------------|-----|
| **BUG-R3-1** | TLS skip toggle shown in Tauri mode but silently ignored (Tauri HTTP plugin handles TLS separately; passing `skipTlsVerify` to `/__proxy` doesn't work in desktop mode) | `GraphqlStudioPage.tsx`: pass `isTauri() ? undefined : handleSkipTlsVerifyChange` — button hidden in Tauri mode |
| **BUG-R3-2** | Schema polling popover hint showed raw (potentially `0`) `localIntervalSeconds` as user typed, before clamping | Hint now shows `Math.max(MIN_POLL_SECONDS, localIntervalSeconds)` — the effective clamped value |
| **BUG-R3-3** | Execution error markers: no bounds check on `loc.line` from server — GraphQL servers can report invalid line numbers causing `getLineLength()` to return undefined or throw | Added `filter((loc) => loc.line >= 1 && loc.line <= lineCount)` guard before mapping locations |
| **BUG-R3-4** | Introspect button tooltip lacked keyboard shortcut hint | Title and aria-label now include `(⌘⇧I)` |
| **BUG-R3-5** | Schema polling popover: `<label>` wrapped `<button>` — clicking the "Enable polling" text didn't trigger the toggle (HTML labels only activate input-type form controls, not buttons) | Changed row container from `<label>` to `<div>` with `onClick` on the row + `e.stopPropagation()` on the button to prevent double-fire |
| **BUG-R3-6** | Schema status wrap had `position: relative` as an inline style instead of in the CSS class | Moved to `.gql-schema-status-wrap` CSS class; removed inline style |
| **CSS-R3-7** | Schema status badge, polling switch ON state, polling config button active state, env active dot, and TLS toggle warning state all used hardcoded Catppuccin hex colors instead of the app's canonical theme tokens — breaking visual consistency across light/dark/custom themes | Added `--gql-success`, `--gql-danger`, `--gql-warning` aliases to `.gql-studio` theme shim; updated all functional state indicators to use `color-mix()` with these tokens |

---

**Original batch (before 2026-06-17): Three Phase 1 features identified in an initial post-implementation gap analysis.**

Three Phase 1 features identified in a post-implementation gap analysis, implemented, and then thoroughly re-evaluated with all issues fixed:

#### 1. Close-Tab Confirmation for Unsaved Changes (Phase 1A addition)

**UX pattern**: Two-click confirmation on the × close button for tabs with `unsavedChanges === true`.
- First click → enters "confirming" state: × turns red with pulsing animation; tooltip changes to `"Unsaved changes — click again to close"`
- Confirming state auto-resets after 2.5 seconds if no second click
- Clicking any other tab also cancels the confirming state
- Second click on same × within the window → immediately closes the tab
- Tabs with 0 or 1 tabs: no confirmation needed (only tab can't be closed)
- The unsaved dot hides during confirming state (× indicator takes visual precedence)

**Files changed**:
- `GraphqlStudioPage.tsx`:
  - `confirmingCloseTabId` state + `confirmTimerRef` ref
  - `handleTabClick(tabId)` callback — replaces `setActiveTabId(tabId)` inline call; resets confirming state on tab switch
  - `addTab()` — resets confirming state on new tab
  - `closeTab()` — two-click confirm logic with auto-reset timer
  - Tab render: `isConfirming` flag; `gql-tab-close--confirming` class; dynamic `title` / `aria-label`
  - **Re-eval fix (BUG-R1-1)**: `confirmTimerRef` cleaned up in the unmount `useEffect` alongside `saveTimerRef`
- `graphql-studio.css`:
  - `.gql-tab-close--confirming` — red color, bold, pulsing `gql-close-confirm-pulse` keyframe

#### 2. Query AST Validation (Phase 1C addition)

**Purpose**: After introspection, validate the editor's query against the loaded schema using `graphql.validate()`. Shows red squiggles in the editor and a `⚠ N` badge in the connection bar next to Execute.

**Design decisions**:
- Does NOT block execution — the badge is informational (user may intentionally send a partial query to see server-side error detail)
- Uses a separate Monaco marker owner `'gql-schema-validate'` so the monaco-graphql worker's own markers (`'graphql'` owner) are not overwritten
- 500ms debounce to avoid validating on every keystroke
- Clears markers when schema is unloaded or query is empty
- Parse errors (invalid syntax) are handled by the monaco-graphql worker — this hook only handles semantic errors (type mismatches, undefined fields, missing required args, etc.)

**Files changed**:
- **New: `src/features/graphql/hooks/useQueryValidation.ts`** — the validation hook:
  - Uses `useMonaco()` from `@monaco-editor/react` to access the Monaco instance
  - `buildClientSchema(rawIntrospection)` → `validate(schema, parse(query))` → markers
  - Returns `errorCount: number` for the badge
  - Each error maps to `{ severity: Error, message, startLine, startCol, endLine, endCol, source: 'GraphQL Schema' }`
  - **Re-eval fix (BUG-R1-2)**: separate `useEffect([modelUri])` immediately resets `errorCount` to 0 on tab switch — prevents stale badge count during the 500ms debounce window
- `GraphqlStudioPage.tsx`: `useQueryValidation(activeTab.query, activeTab.modelUri, rawIntrospection, schemaLoaded)` → `queryValidationErrorCount`
- `GraphqlConnectionBar.tsx`:
  - New `queryValidationErrors?: number` prop
  - `⚠ N` amber badge (`gql-validation-warning`) shown between Introspect and Execute when `queryValidationErrors > 0`; hidden during execution
  - **Re-eval fix (BUG-R1-3)**: badge `<span>` now has `role="status"` + `aria-live="polite"` for screen reader support
- `graphql-studio.css`:
  - `.gql-validation-warning` — amber pill with triangle icon, `gql-warning-fade-in` entrance animation

#### 3. Connection Profiles (Phase 1D addition)

**Purpose**: Save named endpoint+auth combos and restore them with a single click. Eliminates re-entering the endpoint URL and re-configuring auth when switching between environments or APIs.

**Profile data model**:
```typescript
interface ConnectionProfile {
  id: string;        // gql-profile-{timestamp}-{random5}
  name: string;      // user-defined display name (max 64 chars)
  endpoint: string;  // full URL
  auth: GraphqlAuth | null;
  createdAt: number; // Unix ms
}
```
Persisted in `localStorage` under `gql_profiles_v1`.

**Files changed**:
- **New: `src/features/graphql/hooks/useGraphqlConnectionProfiles.ts`**:
  - `profiles: ConnectionProfile[]` — persisted list
  - `saveProfile(name, endpoint, auth)` → `ConnectionProfile` — creates + persists
  - `renameProfile(id, newName)` — in-place rename
  - `deleteProfile(id)` — removes from list
- **New: `src/features/graphql/components/GraphqlProfileModal.tsx`** — single-panel modal:
  - Header: bookmark SVG icon + "Connection Profiles" + × close
  - Modal panel: `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}` (keyboard focus target when profiles exist)
  - Section 1: "Saved Profiles" — scrollable list (`max-height: 280px`) so Section 2 is always visible
    - Each row: name + endpoint (truncated to 42 chars) + auth badge + "Load" button + × delete button
    - Delete: two-click confirm (same 2.5 s reset pattern as tab close); delete button has `min-width: 74px` to prevent layout shift when text changes `×` → `✓ Confirm`
    - Empty state: bookmark icon + "No saved profiles yet" + "Fill in the form below…"
  - Section 2: "Save Current Connection" — always visible below the scrollable list
    - Preview row: current endpoint + auth badge
    - Name input (max 64 chars) + "Save" button (`min-width: 68px`)
    - Save button: green "✓ Saved" flash for 2 s after saving (`gql-saved-pop` animation); NOT disabled during flash (BUG-R3-1 fix)
    - Hint with ⚠ SVG icon if no endpoint: "Enter an endpoint URL in the connection bar first"
  - Auto-focus: name input if no profiles; modal panel itself if profiles exist (BUG-R1-4 + BUG-R2-2 fix)
  - Escape key / click outside closes
  - `gql-env-modal-overlay` (transparent, centered)
  - `gql-modal-pop-in` entrance animation (`scale + translateY + opacity`, 0.18 s cubic-bezier spring)
- `GraphqlConnectionBar.tsx`:
  - New `profiles?: ConnectionProfile[]` + `onProfileBadgeClick?: () => void` props
  - Profile badge placed between GQL badge and URL input:
    - Bookmark icon + "Profiles" text when no profiles
    - Bookmark icon + blue count badge (`N`) when profiles exist
    - Tooltip adapts: "No saved profiles — click to save current connection" / "N saved profiles — click to manage"
  - **Re-eval fix (BUG-R2-1)**: profile badge has `:focus-visible` outline (`2px solid #89b4fa`)
- `GraphqlStudioPage.tsx`:
  - `useGraphqlConnectionProfiles()` hook wired: `profiles`, `saveProfile`, `deleteProfile`
  - `profileModalOpen` state controls `GraphqlProfileModal` visibility
  - `onSave(name)` → calls `saveProfile(name, endpoint, auth)`
  - `onLoad(profile)` → `setEndpoint(profile.endpoint)` + `handleAuthChange(profile.auth)` + close modal
- `graphql-studio.css`:
  - `.gql-profile-badge` / `.gql-profile-badge--has-profiles` / `.gql-profile-badge-count` / `.gql-profile-badge-label`
  - `.gql-profile-badge:focus-visible` — keyboard focus ring (BUG-R2-1)
  - `.gql-profile-modal` / `__header` / `__title` / `__close` / `__body`
  - `.gql-profile-section` / `__heading`
  - `.gql-profile-empty`
  - `.gql-profile-list` — `max-height: 280px; overflow-y: auto; scrollbar-width: thin` (BUG-R1-6)
  - `.gql-profile-row` / `__info` / `__name` / `__endpoint` / `__actions`
  - `.gql-profile-auth-badge` / `--active`
  - `.gql-profile-btn` / `--load` / `--delete` (min-width: 74px — BUG-R1-7) / `--confirming`
  - `.gql-profile-save-form__preview` / `__endpoint` / `__row` / `__input`
  - `.gql-profile-save-btn` (min-width: 68px) / `.gql-profile-save-btn--saved` (green flash — BUG-R1-5)
  - `.gql-profile-save-form__hint` (flex row with icon — BUG-R1-8) / `__hint svg`
  - `@keyframes gql-modal-pop-in` / `gql-close-confirm-pulse` / `gql-confirm-pulse` / `gql-warning-fade-in` / `gql-saved-pop`

---

## 1. Executive Summary

Add a **GraphQL Studio** tab to RedfireForge's Protocol Studios, enabling users to:
- Compose and execute queries, mutations, and subscriptions against any GraphQL endpoint
- Explore schemas via introspection with a visual Schema Explorer
- Build operations visually with a point-and-click query builder
- Manage variables, headers, and authentication per-connection
- Track response performance (latency, resolver tracing)
- Save operations to collections and share them
- Integrate with the workflow engine for automated GraphQL testing

This follows the established protocol studio pattern (WebSocket → Kafka → SSE → **GraphQL**).

---

## 2. Market Research & Tool Landscape

### 2.1 Commercial Tools

| Tool | Key Features | Subscription Support | Strengths |
|------|-------------|---------------------|-----------|
| **Postman** | Visual query builder, schema introspection, collections, environments, auth (OAuth2/JWT/AWS), collaboration | ✅ (filterable stream) | Unified platform, team collaboration, multi-protocol |
| **Apollo Studio (GraphOS)** | Schema registry, operation metrics, traces, breaking change detection, Explorer IDE | ✅ (via gateway) | Deep federation support, production monitoring, supergraph management |
| **Insomnia** | Query editor with autocomplete, environment variables, plugins, code generation | ✅ (basic) | Fast, lightweight, open-source core |
| **Thunder Client (VS Code)** | Inline VS Code GraphQL client, collections, env variables | ❌ | IDE-native, zero-config |
| **Hoppscotch** | Open-source Postman alternative, GraphQL tab, real-time subscriptions, collections | ✅ | Free, fast, web-based |
| **RapidAPI/Paw** | Schema explorer, history, code gen, team features | ✅ | Mac-native (Paw), API marketplace |

### 2.2 Open-Source Tools

| Tool | Stars | Key Features | Status |
|------|-------|-------------|--------|
| **GraphiQL** | 16.8k | Official reference IDE, CodeMirror 6/Monaco modes, plugin API, explorer plugin, language service (LSP) | Active (monorepo) |
| **Altair GraphQL Client** | 5k+ | Desktop/Chrome/Firefox, environments, pre-request scripts, file upload, collections, plugin system, auto-schema refresh, query generation from schema | Active (v8.5.4) |
| **GraphQL Playground** | 8.8k | Multi-tab, subscriptions, docs sidebar, tracing, schema polling, sharing (GraphQL Bin) | **Archived** (2026) — merged into GraphiQL |
| **Banana Cake Pop** | — | .NET HotChocolate ecosystem, schema explorer, document sync | Active |
| **GraphQL Voyager** | 7k+ | Visual schema relationship explorer (ER-diagram style) | Maintained |
| **Stellate** | — | Edge caching, rate limiting, metrics dashboard (acquired by The Guild) | Active |
| **Hive (The Guild)** | — | Schema registry, composition checks, observability, gateway, federation audit | Active (MIT) |

### 2.3 Key Libraries for Integration

| Library | Purpose | Notes |
|---------|---------|-------|
| `graphql` (npm) | Core parser/validator/executor | Required — parse, validate, introspect |
| `monaco-graphql` | Monaco editor GraphQL mode | From GraphiQL monorepo — syntax, autocomplete, validation |
| `graphql-language-service` | Autocomplete, diagnostics, hover | Powers `monaco-graphql` under the hood |
| `graphql-ws` | WebSocket subscriptions (spec-compliant) | Modern `graphql-transport-ws` protocol |
| `subscriptions-transport-ws` | Legacy subscription protocol | Deprecated but still used by Apollo Server ≤v3 |
| `@graphql-tools/utils` | Schema utilities, merging | The Guild ecosystem |
| `@graphql-tools/mock` | Auto-mock schema resolvers | For mock server feature |
| `graphql-request` | Minimal GraphQL client | Code-gen target only — not installed as a runtime dependency |
| `extract-files` | File upload (multipart) | GraphQL multipart request spec |
| `meros` | Incremental delivery parsing | `@defer`/`@stream` multipart response |

### 2.4 Key Differentiating Features from Research

Features discovered across competitors that we should prioritize:

| Feature | Found In | Priority for Us |
|---------|----------|----------------|
| **Pre-request / post-response scripts** | Altair, Postman | P2 — dynamic auth tokens, response chaining, advanced testing |
| **File upload (multipart)** | Altair, Postman | P1 — common GraphQL pattern |
| **Persisted queries (APQ)** | Apollo Studio | P2 — production workflow |
| **`@defer`/`@stream` incremental delivery** | Apollo Studio, GraphiQL | P1 — modern spec feature |
| **Query batching** | Apollo, Hoppscotch | P2 — performance optimization |
| **Schema polling / auto-refresh** | GraphQL Playground, Altair | P1 — great DX |
| **Environment variables** | Altair, Postman, Hoppscotch | P0 — essential for teams |
| **Operation collections with folders** | Postman, Apollo, Altair | P1 — organization |
| **Federation-aware introspection** | Apollo Studio, Hive | P2 — enterprise GraphQL |
| **Two-step schema search** (find field → find path) | Apollo Studio | P1 — superior UX |
| **GraphQL Config support** | GraphQL Playground, GraphiQL | P2 — project integration |

---

## 3. Feature Specification

### 3.1 Core Features (Phase 1 — MVP)

Phase 1 is organized into five subsystems (1A–1E).

---

#### 1A — Monaco Editor Integration

**`monacoGraphqlSetup.ts`** — the most complex Phase 1 utility:
1. Register the `monaco-graphql` Web Worker (lazy — loaded only when the GraphQL tab is first activated):
   ```typescript
   // In monacoGraphqlSetup.ts — called once from GraphqlStudioPage on first mount:
   import { initializeMode } from 'monaco-graphql/esm/initializeMode';
   let gqlApi: ReturnType<typeof initializeMode> | null = null;
   export function getOrInitGraphqlMode() {
     if (!gqlApi) gqlApi = initializeMode({ diagnosticSettings: { validateVariables: true } });
     return gqlApi;
   }
   ```
   **Vite worker note**: `monaco-graphql` uses a GraphQL language service worker. With Vite, the worker is loaded automatically via `new Worker(new URL('monaco-graphql/esm/graphql.worker', import.meta.url))`. No changes to `vite.config.ts` are required — Vite resolves the `new URL(..., import.meta.url)` pattern natively. The `MonacoEnvironment.getWorker` shim must be set before the first `<Editor>` renders. Place it at the top of `monacoGraphqlSetup.ts` in module scope so it runs on import:
   ```typescript
   // Extend the existing Monaco worker shim to handle 'graphql' label
   const _prevGetWorker = (window as any).MonacoEnvironment?.getWorker;
   (window as any).MonacoEnvironment = {
     getWorker(_: string, label: string) {
       if (label === 'graphql') {
         return new Worker(new URL('monaco-graphql/esm/graphql.worker', import.meta.url), { type: 'module' });
       }
       // Fall back to the existing shim (handles 'json', 'css', 'html', 'typescript', 'javascript', etc.)
       return _prevGetWorker ? _prevGetWorker(_, label) : new Worker(
         new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' }
       );
     }
   };
   ```
2. Bind the introspected schema to the language worker: `api.setSchemaConfig([{ introspectionJSON, uri: 'schema.graphql' }])` — called every time a new schema is introspected (Phase 1B)
3. Create one Monaco model per operation tab (`monaco.editor.createModel(query, 'graphql', modelUri)`) — each tab gets its own isolated model with its own diagnostics
4. Dispose unused models when tabs close (memory management)

**Tab state persistence** (`localStorage`):
- Storage key: `gql_tabs_v1` — JSON array of `GraphqlOperationTab[]`
- Saved on every tab change (debounced 500ms) and when the window `beforeunload` fires
- Restored on page load; if localStorage is empty, a single blank tab is created

**Multi-tab operations** (`GraphqlStudioPage.tsx`):
- Up to 8 tabs (same limit as WebSocket Studio)
- Each tab: `{ id, label, modelUri, variables, headers }`
- Tab bar: shows operation name (extracted from query AST) or "Untitled" for anonymous operations
- `[+]` button opens a new blank tab; `×` closes a tab (prompts to save if unsaved changes)
- `⌘T` / `Ctrl+T` keyboard shortcut (Tauri only — conflicts with new-tab in browsers, see Section 15)

**Operation name selector** (multi-operation documents):
- If a single document contains multiple named operations (e.g. `query A { ... } query B { ... }`), a dropdown appears in the connection bar: "Executing: [A ▾]"
- `graphql.parse(query).definitions` extracts named operations; `OperationDefinitionNode.name.value` gets the name
- If only one operation is defined, the dropdown is hidden

**Variables panel** (`GraphqlVariablesPanel.tsx`):
- Monaco editor in JSON mode (`language: 'json'`)
- JSON schema derived from the operation's variable definitions fed to Monaco's JSON validation
- When the query changes (debounced 300ms): extract `VariableDefinitionNode[]`, build a JSON Schema matching those types, register via `monaco.languages.json.jsonDefaults.setDiagnosticsOptions`

**Headers panel** (`GraphqlHeadersPanel.tsx`):
- Same key-value row component as WebSocket Studio's headers panel (reuse existing component)
- `{{var}}` interpolation: values are resolved against the active environment before request

---

#### 1B — Schema Explorer

**Dependencies installed**: `graphql@^17.0.1` and `monaco-graphql@^1.8.0` are now installed.

**Introspection flow** (`useGraphqlSchema.ts` + `schemaParser.ts`):
1. User clicks "Introspect" button in the connection bar
2. **No separate server-side proxy needed**: `httpFetch(endpoint, 'POST', headers, body)` sends the introspection query directly to the user's endpoint.
   - In **Tauri** mode: `httpFetch` uses the Tauri HTTP plugin — direct, no CORS restrictions
   - In **web/dev** mode: `httpFetch` routes through Vite's `/__proxy` middleware (server-side forwarding) — no CORS restrictions
3. The standard `IntrospectionQuery` is sent as the POST body
4. `schemaParser.ts` converts `data.__schema` → `GraphqlSchemaInfo` (navigable `GraphqlTypeNode[]` tree)
5. `setGraphqlSchema(rawIntrospection)` feeds the raw introspection JSON to the `monaco-graphql` worker for live autocomplete/validation
6. Schema cached in `localStorage` with a DJB2-hashed endpoint key; parsed `GraphqlSchemaInfo` stored for display without re-parsing

**`graphqlIntrospectionQuery.ts`** — exports the standard introspection query string as `INTROSPECTION_QUERY`.

**`schemaParser.ts`**:
- Input: raw introspection response body (the `data` field: `{ __schema: { ... } }`)
- Output: `GraphqlSchemaInfo` with `types: GraphqlTypeNode[]`, root type names, full SDL
- Uses `graphql` library: `buildClientSchema(introspectionData as IntrospectionQuery)` → `GraphQLSchema`, then `printSchema()` for SDL
- Filters built-in types (`__Schema`, `__Type`, etc.) and scalar built-ins (`String`, `Int`, `Float`, `Boolean`, `ID`)

**Schema cache key** (in `useGraphqlSchema.ts`):
```typescript
// DJB2 hash of the endpoint URL — fits in a short localStorage key
function hashEndpoint(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h) ^ url.charCodeAt(i);
  return (h >>> 0).toString(16);
}
// Storage key: "gql_schema_v1_<8-char-hex>"
```

**`monaco-graphql` worker setup** (in `monacoGraphqlSetup.ts`):
```typescript
import GraphqlWorkerCtor from 'monaco-graphql/esm/graphql.worker?worker';

// Runs at module-import time (before any React rendering)
if (typeof window !== 'undefined') {
  const _prev = (window as any).MonacoEnvironment?.getWorker;
  (window as any).MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'graphql') return new GraphqlWorkerCtor();
      if (_prev) return _prev(_, label);
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url),
        { type: 'module' }
      );
    }
  };
}

export function getOrInitGraphqlMode(): MonacoGraphQLAPI {
  if (!gqlApi) gqlApi = initializeMode({ diagnosticSettings: { validateVariables: true } });
  return gqlApi;
}

export function setGraphqlSchema(introspectionJSON: IntrospectionQuery): void {
  getOrInitGraphqlMode().setSchemaConfig([{ introspectionJSON, uri: 'schema.graphql' }]);
}
```

**Schema Explorer UI** (`GraphqlSchemaExplorer.tsx`) — lives in the **right pane**:
- The right pane has two view tabs: **"Response"** | **"Schema"**
- "Schema" tab shows the Schema Explorer; "Response" tab shows `GraphqlResponseViewer`
- Schema explorer layout:
  - **Top**: search bar (filters type names and field names)
  - **Main** (two sub-tabs): **"Types"** (type list + type detail) | **"SDL"** (full SDL in read-only Monaco)
  - **Type list**: left column, grouped by kind (Objects, Inputs, Enums, Interfaces, Unions, Scalars), collapsible groups
  - **Type detail**: right column, shows all fields/values with type, args, and deprecation notice
- Shows "No schema loaded — click Introspect" empty state when `schemaInfo` is null

**Schema hash** (`useGraphqlSchema.ts`):
Schema change detection uses DJB2 hash of the SDL string — synchronous, no external library needed.
SDL hash is stored alongside the cached schema. On each poll: re-introspect; compare SDL hash vs cached; if different → update schema + call `setGraphqlSchema`.

**Schema polling** (`useGraphqlSchema.ts`):
- `pollingIntervalMs` prop (default 0 = disabled); 30 000 ms is the recommended value
- `setInterval` started when `pollingIntervalMs > 0`; cleared on unmount or when `endpoint` changes
- `document.visibilitychange` listener pauses polling while the tab is hidden

**Introspection failure handling**:
| Scenario | Status | User-facing message |
|---|---|---|
| Network unreachable / timeout | `'error'` | "Cannot reach endpoint — check URL and network" |
| HTTP 401 | `'error'` | "Authentication required — add a Bearer token or API key in headers" |
| HTTP 403 | `'error'` | "Access denied — token valid but lacks introspection permission" |
| HTTP 5xx | `'error'` | "Server error (HTTP {status}) — endpoint returned an error" |
| Introspection disabled | `'introspection-disabled'` | "Introspection is disabled on this server. You can still execute operations manually." |
| Not introspection JSON | `'error'` | "Response is not a valid GraphQL introspection result — check the endpoint URL" |

**Detecting introspection-disabled**: HTTP 200 response that is valid JSON but contains `{ errors: [{ message: "..." }] }` with an empty (null) `data.__schema`. The error message is checked for `"introspect"`, `"disabled"`, `"not allowed"`, `"permission"` to classify as `'introspection-disabled'` (amber badge) rather than a generic red error.

---

#### 1C — Execution Engine

**`useGraphqlExecution.ts`** — query/mutation lifecycle:
```typescript
interface ExecutionState {
  status:     'idle' | 'loading' | 'success' | 'error';
  response?:  GraphqlResponse;
  abortCtrl?: AbortController;
}
```

**Execution flow**:
1. User clicks Execute (or `⌘Enter`)
2. Interpolate `{{var}}` in headers against active environment
3. Inject auth header based on `GraphqlConnection.auth` type
4. Create `AbortController` → store in state
5. `POST /api/graphql/query` with `{ query, variables, operationName }`
6. On response: parse JSON → build `GraphqlResponse` → update state
7. On abort: catch `AbortError` → set status `'idle'` (no error shown)

**Request cancellation**:
- Escape key → `abortCtrl.abort()` — cancels the in-flight request (AbortController)
- Also available as a `[Cancel]` button that appears next to the Execute button while loading
- Proxy route forwards the `AbortSignal` through Node's `AbortController` to the upstream `fetch()`

**Client-side pre-execution validation** (`useGraphqlExecution.ts`):

Before sending the request, two client-side checks block execution and show an inline error:

1. **Invalid variables JSON**: `JSON.parse(variables)` throws → Execute button is disabled; a red border + "Invalid JSON" label appears on the Variables panel. Resolves as soon as the JSON becomes valid again (debounced 300ms parse check).

2. **Query AST validation** (when schema is available): `graphql.validate(schema, graphql.parse(query))` — runs against the introspected schema after every query edit (debounced 500ms). If validation errors are found:
   - They are shown as Monaco squiggles immediately (replacing any stale execution-time markers)
   - The Execute button shows a `⚠ N errors` badge (still clickable — server may be more permissive)
   - This is advisory, not blocking — some servers accept non-standard SDL; the user can override

If schema is not yet introspected, skip step 2 and let the server report errors.

The `ExecutionState` interface gains `operationName?: string` to carry the selected operation name when the document contains multiple named operations:
```typescript
interface ExecutionState {
  status:         'idle' | 'loading' | 'success' | 'error';
  response?:      GraphqlResponse;
  abortCtrl?:     AbortController;
  operationName?: string;   // active operation name when document has multiple named operations
}
```

**`GraphqlResponseViewer.tsx`**:
- Three tabs: **Response** (formatted JSON), **Headers** (HTTP response headers), **Metadata**
- Response tab: Monaco in read-only JSON mode (syntax highlighted, collapsible, searchable)
- Copy button: copies raw JSON to clipboard
- "Expand all" / "Collapse all" toggles for nested objects
- **Metadata tab**: shows HTTP status (colored: green 2xx, amber 3xx, red 4xx/5xx), latency ms, response size (bytes + humanized), content-type

**Error highlighting** in the editor:
- After execution: if `errors[].locations` present → call `monaco.editor.setModelMarkers(model, 'graphql-execution', markers)` with error squiggles at the reported line/column
- If `errors[].extensions.code` present → display code prominently in the Errors sub-tab (e.g. `UNAUTHENTICATED`, `NOT_FOUND`)
- Partial data: show both `data` and `errors` when both are present ("partial success" — 200 status but errors in body)

---

#### 1D — Connection Management

**`GraphqlConnectionBar.tsx`** — the horizontal bar at the top of the page:
- Endpoint URL input with `{{var}}` autocomplete dropdown
- Recent endpoints dropdown (last 10, stored in `localStorage`)
- Auth badge: `[Bearer ▾]` → opens auth config popover
- `[Execute ▶]` button (or `⌘Enter`)
- `[Introspect ⟳]` button (or `⌘Shift+I`)
- TLS skip toggle (⚠ icon, only shown when URL is `https://`)
- Schema polling indicator (green pulsing dot when polling is active)

**Auth header injection** (`graphqlClient.ts`):
```typescript
function buildAuthHeaders(auth?: GraphqlAuth): Record<string, string> {
  if (!auth) return {};
  switch (auth.type) {
    case 'bearer': return { Authorization: `Bearer ${auth.token}` };
    case 'basic':  return { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` };
    case 'apiKey': return { [auth.headerName!]: auth.headerValue! };
    case 'oauth2': return {};  // token fetched in pre-request script or via useGraphqlOAuth2 hook
    case 'custom': return {};  // arbitrary headers added directly in Headers panel
  }
}
```

**Auth config popover** (opens when clicking the auth badge in the connection bar):

The popover has a `Type` dropdown at the top:

| Selected type | Fields shown |
|---|---|
| None | _(no fields)_ |
| Bearer | `Token` text input (password-masked); "Test" button validates the token against `/api/graphql/introspect` |
| Basic | `Username` + `Password` inputs |
| API Key | `Header name` input (default `X-API-Key`) + `Header value` input (password-masked) |
| OAuth 2.0 | Read-only message: "OAuth2 token injection is handled by pre-request scripts (Phase 3). Set `Bearer` type here if you already have a token." |
| Custom | "Custom headers added directly in the Headers panel take precedence." |

All sensitive values (Bearer token, Basic password, API Key value) are stored in `localStorage` under the connection profile — not in plain text. Note: `localStorage` is not a secure credential store; advise users to use `{{secretVar}}` environment variable references for production tokens.

**Connection profiles** (`useGraphqlState.ts`):
- `GraphqlConnection[]` persisted in `localStorage` (same pattern as WebSocket Studio connections)
- Sorted by `updatedAt` descending (most recently used first)
- "Save as profile" button in connection bar → prompts for profile name
- Profile switcher dropdown shows all saved profiles with endpoint preview + auth type badge
- Delete profile: long-press or right-click on the profile name in the dropdown

---

#### 1E — Environment Variables

Phase 1E implements named environment management with `{{var}}` resolution across URL, headers, and variables JSON before execution.

**New file: `src/features/graphql/utils/envUtils.ts`** — pure utilities (no React):
- `resolveVars(str, env)` — replaces `{{key}}` with values from the active env; unresolved refs stay as-is
- `findUnresolvedVars(str, env)` → `string[]` — returns list of `{{key}}` names that have no match in env
- `hasUnresolvedVars(str, env)` → `boolean` — true if any `{{key}}` cannot be resolved
- Single-pass only: nested vars (e.g. `{{a}}` where `a = "{{b}}"`) are NOT recursively resolved
- Only `enabled: true` variables from the environment are considered during resolution

**New file: `src/features/graphql/hooks/useGraphqlEnvironments.ts`**:
- Manages `GraphqlEnvironment[]` persisted in `localStorage` under key `gql_environments_v1`
- `activeEnvironment: GraphqlEnvironment | null` — the one with `isActive: true`
- Methods: `createEnvironment(name)`, `deleteEnvironment(id)`, `setActiveEnvironment(id | null)`, `updateEnvironmentName(id, name)`, `updateVariables(id, variables[])`
- `importEnvironment(json)` — supports Postman format (`values[].key/value/enabled/type`) and native format
- `exportEnvironment(id)` — returns JSON string for download
- Auto-activates the first remaining env when the active one is deleted
- `type: "secret"` in Postman format maps to `masked: true`

**New file: `src/features/graphql/components/GraphqlEnvModal.tsx`** — two-panel modal:
- **Left sidebar (210px)**: scrollable list of environments, each row shows active dot + name + click-to-select
  - "Active" green dot next to the currently active environment
  - `[+ New]` button at the top of the sidebar header
  - `[↑ Import]` button at the bottom of the sidebar (file picker, accepts `.json`)
  - Delete button on each row (with confirmation via single-click since this is a deliberate action)
- **Right panel**: editable environment name (click to rename inline) + variable table
  - `[Set Active]` button (when env is NOT active) OR `Active ✓` green badge (when it IS active)
  - `[↓ Export]` button → downloads env as `.json`
  - Variable table columns: `☑ Enabled` | `Key` | `Value` (masked) | `Actions`
  - Each variable row: enable checkbox, key input, value input (password-type when `masked: true`), eye-toggle, delete button
  - `[+ Add Variable]` at the bottom of the table
  - Empty state: "No variables yet. Click + Add Variable to add your first one."
- Empty left panel state: "No environments yet. Click + New to create one."
- Escape key closes the modal; click outside the panel also closes

**Updated: `GraphqlConnectionBar.tsx`** — add env badge between URL and auth badge:
- `[🌐 No Env ▾]` — gray badge when no active environment
- `[🌐 Staging ▾]` — teal-colored badge when an environment is active
- Clicking opens `GraphqlEnvModal` via `onEnvBadgeClick` prop
- Badge shows active environment name (truncated to 16 chars with ellipsis)
- New props: `activeEnvName`, `onEnvBadgeClick`

**Updated: `GraphqlStudioPage.tsx`** — integrate env hook:
- `useGraphqlEnvironments()` wired; `activeEnvironment` passed down
- In `handleExecute`: apply `resolveVars()` to endpoint URL, all enabled header values, and variables JSON string before calling `execute()`
- The raw values stored in state are never mutated — resolution is applied at call time only

**Updated: `GraphqlHeadersPanel.tsx`** — show unresolved var warnings:
- New `activeEnvironment` prop (optional, `GraphqlEnvironment | null`)
- For each enabled header row whose value contains `{{key}}` patterns not in the active env: show an amber `!` icon after the value input
- Tooltip on the icon: `"Variable '{{name}}' not found in active environment"`
- Multiple unresolved vars in one value: show a single `!` with combined tooltip

**CSS additions (`graphql-studio.css`)**:
- `.gql-env-badge` — teal-colored badge (similar to auth badge but teal)
- `.gql-env-badge--active` — colored state when env is set
- `.gql-env-badge[aria-expanded="true"]` — open/pressed state
- `.gql-env-modal-overlay` — transparent fixed overlay (per project modal rules: `background: transparent`)
- `.gql-env-modal` — 760×520px centered panel, dark bg, rounded corners, heavy shadow
- `.gql-env-modal-header` — flex row with title + close button
- `.gql-env-modal-body` — flex row: sidebar + main
- `.gql-env-sidebar` — 210px left column
- `.gql-env-sidebar-header` — env list header with `[+ New]` button
- `.gql-env-sidebar-list` — scrollable env list
- `.gql-env-sidebar-item` — env row (hover/active states), active dot
- `.gql-env-sidebar-import` — bottom import button area
- `.gql-env-main` — right panel flex column
- `.gql-env-main-header` — env name + Set Active + Export row
- `.gql-env-name-edit` — inline editable name input
- `.gql-env-var-table` — variable rows container
- `.gql-env-var-row` — single variable row (flex)
- `.gql-env-masked-wrap` — password wrap with toggle
- `.gql-env-unresolved-icon` — amber `!` warning icon for header values

**Postman environment import format** (supported):
```json
{
  "name": "My Environment",
  "values": [
    { "key": "baseUrl", "value": "https://api.example.com", "enabled": true },
    { "key": "token",   "value": "abc123",                  "enabled": true, "type": "secret" }
  ]
}
```

**`resolveVars` implementation**:
```typescript
export function resolveVars(str: string, env: GraphqlEnvironment | null | undefined): string {
  if (!env) return str;
  const vars: Record<string, string> = {};
  for (const v of env.variables) {
    if (v.enabled) vars[v.key] = v.value;
  }
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => vars[key.trim()] ?? match);
}
```

### 3.2 Advanced Features (Phase 2)

Phase 2 is organized into seven subsystems (2A–2G). Each subsystem is independently shippable and has its own component, hook, and proxy-route footprint.

---

#### 2A — WebSocket Subscriptions

**Transports**:
- **Primary**: `graphql-ws` npm package, WebSocket subprotocol `graphql-transport-ws` (modern, spec-compliant, maintained by The Guild)
- **Legacy fallback**: `subscriptions-transport-ws` npm package, WebSocket subprotocol `graphql-ws` (deprecated Apollo Server ≤v3 protocol)

**Proxy route — `WS /api/graphql/subscribe`**:
- Accept WebSocket upgrade from client
- Negotiate subprotocol with upstream: first try `graphql-transport-ws`; if server closes with `4406` (Subprotocol Not Acceptable) or `4400` (Bad Request) → re-connect advertising `graphql-ws` legacy subprotocol
- Relay all frames bidirectionally: `connection_init`, `subscribe`, `next`, `complete`, `error`, `ping`, `pong`
- Track active subscriptions by `id` to support multiplexing over a single WebSocket connection

**Protocol auto-detection algorithm**:
1. Open WebSocket to `wsEndpoint` with subprotocol `graphql-transport-ws`
2. Await handshake — three outcomes:
   - Server accepts `graphql-transport-ws` → use `graphql-ws` client library ✓
   - Server closes with `4406` or `4400` → retry with subprotocol `graphql-ws` (legacy)
   - Server closes with `1000` (normal) — ambiguous; do **not** retry; show "Connection closed unexpectedly" message
3. If legacy retry succeeds → use `subscriptions-transport-ws` client library ✓
4. If legacy retry also fails → surface error to user with manual protocol dropdown override in connection settings

**Subscription state machine** (in `useGraphqlSubscription.ts`):
```
idle → connecting → connected → subscribing → active ─┐
                                   ↑                    │
                            reconnecting ←──────────────┘ (on unexpected close)
                                   │
                                 error (max retries exceeded or permanent close code)
                                   │
                             disconnected (user-initiated complete frame)
```
- `idle`: no active subscription; subscribe button enabled
- `connecting`: WebSocket SYN in progress; spinner + "Connecting…"
- `connected`: WebSocket open, `connection_init` sent, awaiting `connection_ack`
- `subscribing`: `connection_ack` received; `subscribe` frame sent
- `active`: receiving `next` frames; live message count shown
- `reconnecting`: unexpected close; exponential backoff countdown visible ("Reconnecting in 4s…")
- `error`: unrecoverable — close code `4401` (Unauthorized), `4499` (terminate), `error` frame with non-retryable reason
- `disconnected`: clean exit via user-initiated `complete` frame or explicit disconnect click

**`wsEndpoint` URL derivation** (`graphqlClient.ts`):

When `GraphqlConnection.wsEndpoint` is not explicitly set, the WebSocket endpoint is derived from the HTTP endpoint:
```typescript
export function deriveWsEndpoint(httpEndpoint: string): string {
  return httpEndpoint
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i,  'ws://');
}
// e.g. "https://api.example.com/graphql" → "wss://api.example.com/graphql"
// e.g. "http://localhost:4000/graphql"   → "ws://localhost:4000/graphql"
```
If `wsEndpoint` is explicitly set (e.g. subscriptions on a different path like `wss://api.example.com/subscriptions`), that value is used as-is.

**Authenticated subscriptions via `connection_init_payload`**:

For the `graphql-transport-ws` (modern) and `graphql-ws` (legacy) protocols, auth tokens are **not** sent in HTTP headers — WebSocket upgrades only support query params or the `Sec-WebSocket-Protocol` header. The standard pattern is to pass auth in the `connection_init` message payload (`connectionParams`):

```typescript
// In graphqlClient.ts — building the graphql-ws Client
const client = createClient({
  url: wsEndpoint,
  connectionParams: async () => {
    // Dynamically fetch the current token (may be refreshed by pre-request script)
    const token = resolveVars('{{accessToken}}', activeEnv);
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
```

The server reads `connectionParams` from `context.connectionParams` and validates the token before allowing subscriptions. If `connectionParams` is rejected, the server closes with close code `4401` (Unauthorized) — which the state machine maps to the permanent `error` state (no retry).

`connectionParams` is built from `GraphqlConnection.auth` — the same `buildAuthHeaders()` function used for HTTP, but the result is passed as the `connectionParams` payload object instead of HTTP headers.

**Auto-reconnect**:
- Delay formula: `min(1000 × 2^attempt, 30_000)` ms ± 20% jitter (to avoid thundering herd)
- Max 5 attempts; count shown in status indicator
- Aborts immediately on close codes signaling permanent failure: `4400`, `4401`, `4499`
- User can click "Stop Reconnecting" at any time to cancel

**Connection status indicator** (colored pill in connection bar):
| State | Color | Label |
|-------|-------|-------|
| `idle` | Gray | Idle |
| `connecting` | Blue pulsing | Connecting… |
| `connected` | Blue | Handshaking… |
| `subscribing` | Blue | Subscribing… |
| `active` | Green | Active · N msgs |
| `reconnecting` | Orange | Reconnecting (N/5)… |
| `error` | Red | Error — {reason} |
| `disconnected` | Gray | Disconnected |

---

#### 2B — SSE Subscriptions

GraphQL over SSE follows the [`graphql-sse`](https://github.com/enisdenjo/graphql-sse) spec (distinct from the WebSocket protocols). The server must also use `graphql-sse` server-side.

**Two modes** (per `graphql-sse` spec):
- **Distinct connections mode** (default): Each subscription opens a new `GET {endpoint}` with `Accept: text/event-stream`. Operation is encoded in query params. Simple to implement; one SSE stream per subscription.
- **Single connection mode**: POST `{endpoint}/stream` once to establish a shared stream; multiplex multiple subscriptions via `id` within the event data. More efficient for many concurrent subscriptions.

**Proxy route — `GET /api/graphql/sse`**:
- Relay upstream SSE stream with correct `Content-Type: text/event-stream; charset=utf-8` and `Cache-Control: no-cache` headers
- Handle CORS for the upstream endpoint
- Forward `Last-Event-ID` header for resumability

**Client implementation** (in `graphqlClient.ts`):
- Use `graphql-sse` `createClient({ url, fetchFn })` — `fetchFn` routed through the proxy
- Expose same `subscribe(operation) → AsyncIterator` interface as the WebSocket client methods (same hook API, different transport under the hood)

**Auto-detection heuristics**:
- URL path ending in `/graphql/stream` → default to SSE single-connection mode
- Explicit `sseMode: 'distinct' | 'single'` setting in connection profile
- Manual transport override dropdown in connection settings: `WebSocket (modern) | WebSocket (legacy) | SSE`

**SSE error handling and reconnect**:

Unlike WebSocket, SSE connections are managed by the browser's `EventSource` API (or the `graphql-sse` client's fetch-based implementation). Reconnect behavior differs from WebSocket:

- **Automatic reconnect**: `graphql-sse`'s `createClient` handles reconnect automatically via its `retry` configuration. The client retries failed connections with increasing backoff, up to 5 attempts (same limit as WS).
- **`Last-Event-ID` resumability**: When the proxy forwards `Last-Event-ID` from the client, the upstream SSE server can resume the stream from the last acknowledged event ID — no messages are lost after a brief network interruption.
- **SSE state machine**: SSE uses a simplified version of the WS state machine (no `connected`/`subscribing` distinction since SSE has no handshake):
  ```
  idle → connecting → active ─┐
                ↑              │
          reconnecting ←───────┘ (on EventSource error)
                │
              error (max retries exceeded)
          disconnected (user-initiated close)
  ```
- **Error scenarios**: 
  | Scenario | Behavior |
  |---|---|
  | Network drop | `reconnecting` state; retry with Last-Event-ID |
  | HTTP 401/403 | Permanent `error` state (no retry — server rejected the subscription) |
  | CORS blocked | Red banner: "SSE blocked by CORS — route through proxy" |
  | Server sends `event: error` | Map to subscription `error` event; display in message log |
- **Status pill**: SSE uses the same colored status pill as WS (same 2C subscription log UI); the state labels differ slightly: no `handshaking/subscribing` steps.

---

#### 2C — Subscription UI (`GraphqlSubscriptionLog.tsx`)

The subscription log is the central UI for Phase 2 — all subscription transports (WS modern, WS legacy, SSE) feed the same log component.

**Message list**:
- Virtualized scrolling (CSS `contain: strict` + programmatic scroll-to-bottom) for performance at high message rates (>100 msg/s)
- Each message row:
  - `#N` index (sequential since subscribe)
  - Direction badge: `IN` (server push) in green, `OUT` (client send — e.g. ping/pong) in gray
  - Operation name (from subscription query)
  - Relative timestamp: `+1.23s` since subscribe started
  - Delivery latency: time from `subscribe` send to this `next` receipt (first message only) or inter-message gap
  - Collapsible JSON body with syntax highlighting (reuse `GraphqlResponseViewer` renderer)
  - Error indicator if message contains a GraphQL `errors` array

**Sticky header bar**:
- Total message count
- Error count (messages containing `errors`)
- Messages/sec: rolling 5-second average
- Connected duration: `HH:MM:SS` stopwatch

**Toolbar**:
- `[Pause]` / `[Resume]` — buffer new messages when paused; resume scrolls to newest
- `[Clear]` — wipe the log (connection stays active)
- `[Export JSON]` — download all messages as a JSON array
- `[Filter…]` — toggle inline filter bar

**Inline filter bar** (appears below toolbar when active):
- Text input with a mode toggle button: `[Text]` / `[JSONPath]`
  - **Text mode** (default): substring match against the JSON-stringified message body
  - **JSONPath mode**: evaluates the expression against each message's `data` object; messages where the result is falsy are hidden. Expressions can be simple path existence (`$.data.order.id`) or comparisons (`$.data.order.status == "SHIPPED"`). Uses `jsonpath-plus`.
- Live filter — messages not matching are hidden (not deleted from buffer)
- Match count: `Showing 4/17 messages`

**Message buffer limit**:
- Maximum 5,000 messages stored in the in-memory buffer (configurable 100–10,000 in connection settings)
- When the buffer is full, the oldest message is evicted (ring buffer / FIFO)
- A `⚠ Buffer capped at 5,000 messages — oldest removed` warning appears in the sticky header
- The `[Export JSON]` button exports only the current buffer (not evicted messages)

**`[Export JSON]` format** (downloaded as `graphql-subscription-{operationName}-{timestamp}.json`):
```json
{
  "_meta": {
    "exportedAt":    "2026-06-17T12:00:00Z",
    "operationName": "OnOrderStatusChanged",
    "totalMessages": 17,
    "durationMs":    45320,
    "transport":     "graphql-transport-ws"
  },
  "messages": [
    { "index": 1, "offsetMs": 120,  "data": { "order": { "status": "PENDING" } }, "errors": null },
    { "index": 2, "offsetMs": 3400, "data": { "order": { "status": "SHIPPED" } }, "errors": null }
  ]
}
```

**Assertion panel** (right sidebar, toggle):
- User defines N JSONPath assertions applied to every incoming message
- JSONPath evaluation uses `jsonpath-plus` npm package (`JSONPath.query(message, expression)`)
- Supported expression forms:
  - Existence: `$.data.order.id` (non-null/non-undefined result = pass)
  - Equality: `$.data.order.status == "SHIPPED"` (evaluated as JS expression after path resolution)
  - Numeric: `$.data.order.total > 0`
- Pass (green ✓) / Fail (red ✗) badge on each message row
- Aggregate footer: `N/M assertions pass` across all messages received
- **Note**: `jsonpath-plus` must be added to Phase 2 npm client dependencies

---

#### 2D — Incremental Delivery (`@defer` / `@stream`)

GraphQL `@defer` defers a fragment's resolution to a subsequent chunk. `@stream` streams list items one by one. Both use `multipart/mixed` HTTP responses.

**Example `@defer` response stream** (what `multipartParser.ts` processes):
```
HTTP/1.1 200 OK
Content-Type: multipart/mixed; boundary="---"
Transfer-Encoding: chunked

-----
Content-Type: application/json

{"data": {"user": {"id": "1", "name": "Alice"}}, "hasNext": true}
-----
Content-Type: application/json

{"incremental": [{"path": ["user", "reviews"], "data": [{"id":"r1","rating":5}]}], "hasNext": true}
-----
Content-Type: application/json

{"incremental": [{"path": ["user", "stats"], "data": {"orderCount": 42}}], "hasNext": false}
-----
```

**`multipartParser.ts`** responsibilities:
1. Use `meros` to split the `ReadableStream` into boundary-separated parts
2. Parse each part's JSON body
3. Apply incremental patches to the accumulated result using path-based merge: `merge(base, patch.path, patch.data)`
4. Emit events: `{ type: 'initial' | 'patch', patchIndex, path, merged }` — subscribed to by `useGraphqlExecution.ts`
5. Set `hasNext: false` signals completion of the incremental stream

**`GraphqlResponseViewer.tsx` updates for incremental delivery**:
- Fields covered by `@defer` show a **shimmer/skeleton** placeholder while their patch hasn't arrived
- Once a patch arrives, the skeleton dissolves and the real data renders with a brief green flash
- `@stream` lists show items appending in real time with a `[Streaming...]` badge at the bottom
- **Chunk tracker** toolbar above the response JSON:
  - `Chunk 1 of ? received` → progresses to `All 3 chunks received (890ms total)` when `hasNext: false`
  - Individual chunk timing shown on hover: `Chunk 2: +340ms`
- The fully-merged final JSON is what gets copied/exported (not the raw multipart stream)

**`@defer` / `@stream` AST detection** (in `useGraphqlExecution.ts`):

Before sending the request, the client checks whether the query uses incremental delivery:
```typescript
import { parse, visit } from 'graphql';

export function hasIncrementalDirective(query: string): boolean {
  try {
    const doc = parse(query);
    let found = false;
    visit(doc, {
      Directive(node) {
        if (node.name.value === 'defer' || node.name.value === 'stream') {
          found = true;
        }
      },
    });
    return found;
  } catch {
    return false; // parse error — let server report the problem
  }
}
```
If `hasIncrementalDirective(query)` is `true`:
- Set `Accept: multipart/mixed` on the request
- Route response through `multipartParser.ts` instead of a single `response.json()` call

If `false`: normal single-response path (no multipart overhead).

**Proxy route update** (`POST /api/graphql/query`):
- Client sends `Accept: multipart/mixed` in the request headers when the query contains `@defer` or `@stream`
- Proxy detects `Content-Type: multipart/mixed` in upstream response
- Passes through chunked response body without buffering (`Transfer-Encoding: chunked` preserved)
- Normalizes upstream boundary string to a fixed value for predictable client-side parsing

**Constraint — file upload and `@defer`/`@stream` cannot be combined**:
The `graphql-multipart-request-spec` uses `multipart/form-data`, while `@defer`/`@stream` responses use `multipart/mixed`. These are different multipart formats and cannot be mixed in a single request/response cycle. If the user adds a file variable AND uses `@defer`, show a validation error before execution: "File upload operations cannot use `@defer` or `@stream` — remove the `@defer` directive or the file variable."

**`IncrementalDeliveryResult` type** (used internally by `multipartParser.ts`):
```typescript
export interface IncrementalDeliveryResult {
  type:       'initial' | 'patch';
  patchIndex: number;
  path?:      Array<string | number>;   // path to the field being patched (undefined for initial)
  data?:      unknown;                  // the patched fragment data
  errors?:    GraphqlError[];           // errors for this specific patch
  merged:     unknown;                  // accumulated merged result so far
  hasNext:    boolean;                  // false on the final part
}
```

---

#### 2E — File Upload

GraphQL file upload follows the [graphql-multipart-request-spec](https://github.com/jaydenseric/graphql-multipart-request-spec) (used by Apollo Server, Yoga, Altair, Hasura).

**Request construction** (client-side):
1. In Variables panel, user marks file variable slots with `null` placeholder: `{"avatar": null}` or `{"files": [null, null]}`
2. In the new **Files tab** of the Variables panel, user assigns actual `File` objects to each `null` slot
3. `extract-files` library walks the variables object, extracts `File` objects, and returns `{ clone, files }` where `clone` has `null` in place of each file
4. Client constructs `FormData`:
   - `operations`: `JSON.stringify({ query, variables: clone })`
   - `map`: `JSON.stringify({ "0": ["variables.avatar"] })`
   - `0`: the actual `File` blob
5. Client POSTs `multipart/form-data` to `POST /api/graphql/upload`

**Proxy route** (`POST /api/graphql/upload`):
- `busboy` parses incoming `multipart/form-data`
- Reconstructs the equivalent `multipart/form-data` targeting the upstream GraphQL endpoint
- Streams file bytes to upstream — no buffering in memory (pipe directly)
- Sends `X-Upload-Progress: {bytesUploaded}/{totalBytes}` SSE-style progress events back to client during upload

**`GraphqlFileUpload.tsx`** (integrated as "Files" tab inside Variables bottom panel):
- Dropzone: drag-and-drop or "Browse" button opens file picker
- File list: each row shows filename, MIME type, size (humanized), a `×` remove button
- Auto-injects `null` placeholder into the Variables JSON for each file's variable path
- Multiple files: numbered keys `files.0`, `files.1` etc., or user-specified variable path
- Upload progress bar per file (filled as proxy reports `X-Upload-Progress`)

**File size validation** (client-side, before upload starts):
- **On file selection** (drag-drop or browse picker): `file.size` is checked immediately against `maxFileSize` from `GraphqlConnection`
- If `file.size > maxFileSize`: the file is rejected at selection time with an inline error on the file row: `"File too large (48 MB) — maximum is 50 MB"`. The file is added to the list in a red error state and cannot be submitted.
- If `file.size > 200 MB` (hard cap): same immediate rejection with `"File exceeds the 200 MB hard cap and cannot be uploaded"`
- The `[Execute]` button is disabled while any file row shows a size error

**`X-Upload-Progress` event format**:

The proxy sends progress as chunked SSE-style lines in the response body **before** the JSON result:
```
X-Upload-Progress: 1048576/10485760

X-Upload-Progress: 5242880/10485760

X-Upload-Progress: 10485760/10485760

{"data": {"uploadAvatar": {"url": "..."}}}
```
The client reads the response as a `ReadableStream`, splits on `
`, interprets lines starting with `X-Upload-Progress:` as progress updates (`bytesUploaded/totalBytes`), and the final non-prefix line is the GraphQL JSON response.

---

#### 2F — Visual Query Builder

The query builder lets users construct a GraphQL operation by clicking checkboxes on a schema tree — no manual typing required. The generated SDL is kept in sync with the Monaco editor.

**Architecture**:
```
GraphqlSchemaInfo (from useGraphqlSchema)
      ↓
GraphqlQueryBuilder.tsx  ←→  useGraphqlQueryBuilder.ts
      ↓ generates SDL via
  queryBuilder.ts
      ↓
  Monaco editor (read-only preview panel)
      ↓ "Edit in Editor" escape hatch
  Monaco editor (full edit mode — builder deactivated)
```

**Builder state** (`useGraphqlQueryBuilder.ts`):
```typescript
interface QueryBuilderState {
  operationType:  'query' | 'mutation' | 'subscription';
  operationName:  string;
  // Map from dot-notation field path ("user.preferences.theme") → selection options
  selectedFields: Record<string, FieldSelectionOptions>;
  // Map from "fieldPath.argName" → literal value or "$varRef"
  argValues:      Record<string, string>;
  // Map from field path → alias string
  aliases:        Record<string, string>;
  // Map from field path → applied directives
  directives:     Record<string, DirectiveApplication[]>;
  // Named fragments defined by the user
  fragments:      FragmentDefinition[];
}

interface FieldSelectionOptions {
  selected: boolean;
  partial:  boolean;  // true when an object-type field has only some children selected
}

interface DirectiveApplication {
  name:     '@skip' | '@include';
  ifVar:    string;   // name of the Boolean variable (auto-created in variables)
}

interface FragmentDefinition {
  name:     string;
  onType:   string;
  fields:   Record<string, FieldSelectionOptions>;
}
```

**SDL generator** (`queryBuilder.ts`):
- Recursively builds selection sets from `selectedFields` tree
- Inlines arguments as GraphQL literal values OR `$varName` references (auto-generates `$varName: TypeName` variable definitions)
- Appends `@skip(if: $var)` / `@include(if: $var)` directives per field
- Prefixes aliased fields: `alias: fieldName`
- Appends used fragment spreads (`...FragmentName`) and full fragment definitions at document end
- Returns a valid, prettily-formatted GraphQL document string

**Field tree UI** (`GraphqlQueryBuilder.tsx`):
- Root renders fields of the Query/Mutation/Subscription root type
- Each field row:
  - Checkbox (or partial-select `−`) to toggle selection
  - `⊕` button as alternative to checkbox (same toggle action)
  - Expand arrow `›` for Object/Interface/Union types (navigates into children)
  - Field name
  - Type badge: blue for Scalar, purple for Object, amber for Enum, teal for Interface/Union
  - `[DEPRECATED]` badge in gray for deprecated fields
  - On hover: short description from schema tooltip
- Expanded object type shows children indented; breadcrumb updates: `Query › user › preferences`
- Argument accordion: collapses under the field row when selected; shows per-arg input widget (text, number, boolean toggle, enum dropdown, `$var` reference switch)

**Two-step schema search** (Apollo Studio pattern):
1. User types in the search box at the top of the field tree
2. List immediately filters to matching fields across **all** types (not just root type)
3. Each result shows field name + parent type name + description excerpt
4. Clicking a result: auto-expands the tree to that field's full path from root + updates breadcrumb
5. Pressing Escape returns to the unfiltered root view

**Fragment panel** (right column in the builder, collapsible):
- `[+ New Fragment]` — name input + type selector (from schema types)
- Fragment list: each with its own mini field-selector for the chosen type
- Insert a fragment into the main query: click `Use` → inserts `...FragmentName` at the current selection level
- Highlights which fragments are used vs. defined but unused (unused shown in amber)

**Directive toggles** (per field row, visible on hover):
- `@skip` / `@include` buttons; click opens a popover to choose or create a Boolean variable
- The chosen variable is auto-added to the Variables panel as `{ "condVar": true }` (editable)
- Directive indicators shown inline on the field row label: `fieldName @skip($hideField)`

**Alias support**:
- Inline alias input appears on hover/focus of a selected field row
- User types the alias (validated: no spaces, no reserved names); field row updates: `alias: fieldName`

**Union and Interface type handling** (inline fragments):

When a field returns a Union or Interface type, the query builder must generate inline fragments (`... on ConcreteTypeName { }`), since you cannot select fields directly on abstract types.

Example: `OrderResult` is `union OrderResult = Order | OrderError`
```graphql
query GetOrder($id: ID!) {
  order(id: $id) {
    ... on Order  { id status total { amount currency } }
    ... on OrderError { code message }
  }
}
```

**Builder handling**:
- When the user expands a Union/Interface field in the tree, the children are grouped under concrete type headers: `─── Order ───` / `─── OrderError ───`
- Each group is an inline fragment target — selecting any field under a group automatically wraps it in `... on TypeName { }`
- The `selectedFields` map uses path keys like `order.__on_Order.id` and `order.__on_OrderError.code` to represent inline fragment selections
- The SDL generator detects `__on_TypeName` path segments and emits `... on TypeName { ... }` selection sets
- Interface fields common to all implementors (e.g. `id` on a `Node` interface) are shown at the top of the expansion, outside of concrete type groups

**"Select All" / "Deselect All"** (in builder toolbar):
- `[Select All]` — selects all fields at the current tree level (the root type, or the currently expanded object type). Does not recurse into child types (recursion would create enormous queries).
- `[Deselect All]` — deselects all fields at the current tree level and clears any argument values set for those fields.
- Both buttons are scoped to the current breadcrumb context (e.g. pressing "Select All" while at `Query › user › preferences` selects all `preferences` fields, not all `Query` fields).

**`QueryBuilderState` persistence** (`useGraphqlQueryBuilder.ts`):
- Builder state IS persisted across page reloads, stored in `localStorage` keyed by `${tabId}:builderState`
- Serialization: `JSON.stringify(builderState)` — all fields are JSON-serializable
- On reload: if `localStorage` has a saved state for the tab, it is restored; the builder renders in its previous selection state
- This allows users to build a complex query over multiple sessions without losing work
- `unsavedChanges` flag (from `GraphqlOperationTab`) is set to `true` when the builder state changes the generated SDL

**"Edit in Editor" escape hatch** (button in builder toolbar):
- Copies current generated SDL into the Monaco editor
- Deactivates the query builder (switches sub-tab back to Editor)
- Builder state is reset (two-way sync from editor-written SDL back to builder is out of scope — too complex; one-way only)

---

#### 2G — Performance & Tracing

**Apollo Tracing Waterfall** (`GraphqlTracingView.tsx`):

Renders when `extensions.tracing` is present in the response (Apollo Server returns this when `tracing: true` config is set, or when `apollo-tracing` plugin is enabled).

**Note on tracing formats**: This implementation targets Apollo Tracing v1 (`extensions.tracing.version === 1`). Other servers may return tracing data in different locations:
- **OpenTelemetry** (`extensions.opentelemetry`): structured differently; not supported in Phase 2 — flagged for Phase 3+
- **Yoga / Envelop**: `extensions.tracing` but with slightly different resolver paths — same v1 format, compatible
- When `extensions.tracing` is absent: the Tracing tab is hidden from the response panel

Structure of `extensions.tracing`:
```json
{
  "version": 1,
  "startTime": "...",
  "endTime": "...",
  "duration": 1234000,
  "execution": {
    "resolvers": [
      { "path": ["user"], "parentType": "Query", "fieldName": "user",
        "returnType": "User", "startOffset": 1000, "duration": 50000 }
    ]
  }
}
```

Display:
- Each resolver shown as a horizontal bar: position = `startOffset / totalDuration * width`, width = `duration / totalDuration * width`
- Label: `ParentType.fieldName → ReturnType`
- Color-coded duration: green < 50ms, amber 50–200ms, red > 200ms
- Hover tooltip: exact start offset, duration, return type
- Click row → scrolls the response JSON panel to the corresponding field
- Sort options: by start time (default), by duration descending (slowest resolvers first), by path alphabetical

**Query Complexity Estimator**:

Pre-execution cost estimate based on the query AST and schema structure.

Cost model (configurable per connection):
- Each scalar field selected: +1
- Each object-type field: +2
- Each list-type field: cost × `listMultiplier` (default 10, configurable)
- Inline fragment (`... on Type { }`) fields: same cost as their parent type contribution
- Named fragment spreads (`...FragmentName`): cost = sum of all fields within the fragment definition (resolved from the document)
- Directive `@defer` on a fragment: reduce its cost contribution by 50%
- Maximum depth penalty: each level beyond configurable `maxDepth` (default 10) doubles sub-tree cost

Display:
- Estimated cost badge next to the Execute button: `Cost: ~42`
- Badge color: green (< threshold / 2), amber (between threshold / 2 and threshold), red (> threshold)
- Configurable warning threshold (default 500) — located in a new **"Performance" tab** of the connection settings popover, alongside `listMultiplier` (default 10) and `maxDepth` (default 10) inputs
- Blocks execution with a confirmation dialog if cost > 2× threshold ("This query is very expensive — execute anyway?")

**Response Time Histogram**:
- Activated automatically after ≥3 executions of the same operation
- **Same-query detection**: uses a `SHA-256` hash of the normalized query text (`print(parse(query))` — normalizes whitespace and formatting) keyed by that hash. Named operations additionally group by `operationName`. Anonymous operations group by hash only.
- Stored in memory only (not persisted across sessions)
- Mini histogram (7 buckets) displayed in a collapsible strip at the bottom of the response panel
- Shows: min, P50, P95, P99, max with axis labels; bucket heights proportional to count
- Resets when the query hash changes (i.e. when the user edits the query text itself)

### 3.3 Power Features (Phase 3)

Phase 3 is organized into six subsystems (3A–3F). Each subsystem is independently shippable.

---

#### 3A — Collections & History

**Two data stores, one sidebar:**
- **History**: auto-saved ring buffer of every executed operation (last 100 per connection, configurable 10–500). Stored in IndexedDB. Never requires user action.
- **Collections**: named, user-curated sets of operations organized in a folder hierarchy. Also IndexedDB-persisted.

**History storage design** (`useGraphqlHistory.ts` + IndexedDB):
- Each entry is a `GraphqlHistoryItem` (operation + full response + timestamp)
- Keyed by `connectionId + timestamp` — enables fast range queries per connection
- Eviction: when `maxItems` is reached, the oldest entry is deleted (FIFO)
- Grouped by recency in the UI: **Today**, **Yesterday**, **Last 7 days**, **Older** — dividers auto-computed at render time

**History UI** (`GraphqlHistoryPanel.tsx`):
- Full-height sidebar with search bar at top (filters by operation name or query text)
- Each entry shows: operation type badge (Q/M/S), operation name, timestamp, latency, status (✓ / ✗)
- Hover → preview operation + response JSON in tooltip
- Click → load into current editor tab (does not execute)
- Double-click → load AND execute immediately
- Context menu: "Save to Collection", "Copy query", "Delete"

**Collections data model** (uses `GraphqlCollectionFolder` + `GraphqlCollectionItem` from Section 4.3):
- Infinite folder nesting via `parentId` reference
- Root items have `folderId: undefined`
- Items support pinning (`isPinned: true` → float to top of folder), tags, and per-item pre/post scripts
- Drag-and-drop reorder of items and folders (within-folder only; cross-folder via context menu)

**Collections UI** (`GraphqlCollections.tsx`):
- Folder tree with expand/collapse chevrons
- Right-click context menu: Rename, Duplicate, Move to folder, Delete
- Double-click folder name for inline rename
- "Save current operation" button in response panel adds directly to selected folder
- Badge per item: last-run status (green ✓ / red ✗ / gray —), latency
- "Run" button: loads + executes immediately
- Global search bar filters across all folders by name/tag

**Export/Import format:**
```json
{
  "_exportMeta": {
    "version": "1.0",
    "exportedAt": "2026-06-17T10:00:00Z",
    "source": "RedfireForge/GraphQL"
  },
  "collections": [{
    "id": "...",
    "name": "E-Commerce API",
    "folders": [{ "id": "f1", "name": "User Auth", "parentId": null }],
    "items": [{
      "id": "...",
      "name": "GetUserProfile",
      "folderId": "f1",
      "operation": { "query": "...", "variables": "{}", "operationType": "query" },
      "scripts": { "preRequest": "// rf.setHeader(...)", "postResponse": "" },
      "isPinned": false,
      "tags": ["auth", "user"]
    }]
  }]
}
```

**Import merge vs. replace behavior**:
- **Replace** (default): all existing collections are deleted first, then the imported data is inserted with its original IDs. If an ID collision occurs, the imported item wins.
- **Merge**: existing collections are kept. Imported items are matched by `id`:
  - If the `id` does not exist locally → inserted as new
  - If the `id` exists → user is prompted: "Overwrite?" / "Keep both" (which generates a new UUID for the imported copy) / "Skip"
- Import always validates the `_exportMeta.version` — schema version mismatches show a warning but proceed.
- The import file picker accepts `.json` only; files > 10 MB show an error before parsing.

**IndexedDB object stores** (created in `idbOpen.ts`, schema version incremented at Phase 3):
| Store name | Key | Indexes |
|---|---|---|
| `graphql-history` | `id` | `connectionId`, `timestamp` |
| `graphql-collections` | `id` | `name` |
| `graphql-collection-folders` | `id` | `name`, `parentId` |
| `graphql-schema-snapshots` | `id` | `connectionId`, `timestamp` |

**History max-items configuration**: The configurable ring buffer limit (10–500) is set in a new **"History" tab** of the connection settings popover (alongside the polling interval). The connection-level setting overrides the global default. A "Clear all history" button with confirmation dialog is also in this tab.

---

#### 3B — Pre-Request / Post-Response Scripts

The full `rf.*` scripting API is documented in **Section 14**. This subsection covers the implementation and UI.

**Sandbox implementation** (`preRequestScriptRunner.ts`):

Scripts run in a strict sandboxed context using `new Function` with scope injection — the same pattern used by Postman and Altair. Direct access to `window`, `document`, `globalThis`, `process`, `require`, and `eval` is blocked by variable shadowing:

```typescript
async function runScript(source: string, rfContext: RfContext, timeoutMs = 5000): Promise<void> {
  const wrapped = `(async function execute(rf) {
    "use strict";
    const window = undefined, document = undefined, globalThis = undefined,
          process = undefined, require = undefined, eval = undefined;
    ${source}
  })`;
  const fn = new Function('return ' + wrapped)();
  await Promise.race([
    fn(rfContext),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Script timeout after ' + timeoutMs + 'ms')), timeoutMs)
    ),
  ]);
}
```

Key behaviors:
- `rf.assert(false, msg)` throws `GraphqlAssertionError` which aborts execution and blocks the request
- `rf.fetch()` is routed through the proxy — no direct network access from scripts
- All `rf.log()` calls are captured and displayed in the script console
- Timeout (default 5s) is configurable per collection item in `GraphqlScriptConfig.timeout`

**`RfContext` interface** (the `rf` object injected into scripts):
```typescript
interface RfContext {
  // Environment
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  // Request modification (pre-request only — no-op in post-response)
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  // Response (populated only in post-response scripts; undefined in pre-request)
  response?: {
    httpStatus:  number;
    httpHeaders: Record<string, string>;
    data:        unknown;
    errors?:     GraphqlError[];
    latencyMs:   number;
  };
  // Assertions
  assert(condition: boolean, message?: string): void;  // throws GraphqlAssertionError if false
  // Logging (captured into script console)
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  // HTTP fetch (proxied)
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
```

**Post-response script timing and error handling**:
- Pre-request script runs **before** the HTTP request is sent; if it throws or `rf.assert` fails → request is blocked, error shown in script console, response panel shows "Blocked by pre-request script"
- Post-response script runs **after** the response is received and rendered. The response is shown to the user regardless — post-response failures are non-blocking.
- Post-response script failure: logged as `warn` in the script console with an amber `⚠ Post-script error` indicator on the collection item row. The next execution clears this indicator.

**Script scope isolation** (per-tab, per-execution):
- Each execution creates a fresh `RfContext` object — no state carries over between runs
- Variables set via `rf.setEnv()` modify the active environment and persist across executions (they are written to `GraphqlEnvironment.variables` immediately)
- Variables set via `rf.setHeader()` apply only to the current execution — they are not persisted to the connection's header table

**Script editor UI** (integrated into each collection item's detail panel):
- Monaco editor in JavaScript mode — height 120px, resizable; reuses existing Monaco instance
- Custom completions for `rf.*` methods (registered via `monaco.languages.registerCompletionItemProvider`)
- "Test Script" button: runs the script against the most recent history response (dry-run without execution)
- Script console panel below: `rf.log()` output, errors, assertion failures — color-coded (gray log, amber warn, red error)
- Tab indicator shows if a script is set: `[Script]` badge on the collection item row

**Script template library** (dropdown in editor toolbar):

| Template | Inserts |
|---|---|
| OAuth2 Token Refresh | Check expiry, fetch new token, `rf.setEnv` + `rf.setHeader` |
| JWT Decode (debug) | Decode payload, `rf.log` claims |
| Inject Tenant ID | `rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'))` |
| Assert No GraphQL Errors | `rf.assert(rf.response.errors === undefined, ...)` |
| Extract and Chain ID | `rf.setEnv('createdId', (rf.response.data as any).createX.id)` |

---

#### 3C — Code Generation

**Supported targets and their output format:**

| Target | Library | Generated output |
|---|---|---|
| `typescript-graphql-request` | `graphql-request` | `async function getUser(vars): Promise<GetUserQuery>` |
| `typescript-urql` | `urql` | `const [result] = useQuery<GetUserQuery>({ query: GET_USER, variables })` |
| `typescript-apollo` | `@apollo/client` | `const { data } = useQuery<GetUserQuery>(GET_USER, { variables })` |
| `typescript-fetch` | native `fetch` | Typed `fetch()` with JSON body + response type cast |
| `python-gql` | `gql` | `client.execute(gql("..."), variable_values={...})` |
| `curl` | cURL | `curl -X POST -H "Authorization: Bearer $TOKEN" ...` |
| `httpie` | HTTPie | `http POST .../graphql Authorization:"Bearer $TOKEN" ...` |

**TypeScript type generation** (built-in — no `graphql-code-generator` dependency):

`codeGenerator.ts` walks the operation AST against `GraphqlSchemaInfo` to produce types:
1. `graphql.parse(operation.query)` → `DocumentNode`
2. For each `OperationDefinitionNode`: walk selection set recursively, resolve types via schema `fields` map
3. Build `interface` for each named object type in the selection (`GetUserQuery`, `GetUserQuery_user`, etc.)
4. Emit variable types from `variableDefinitions` (using schema input type definitions)
5. Assemble the full `.ts` output string

**TypeScript type generation rules** (applied while walking the AST):
- **Nullable fields**: GraphQL fields are nullable by default (`String` = `string | null`); non-null (`String!`) = `string`. In generated TypeScript: nullable → `fieldName?: string | null`, non-null → `fieldName: string`.
- **Enum types**: emit as a TypeScript string literal union: `type Status = 'ACTIVE' | 'INACTIVE' | 'PENDING'`. If the enum is used in multiple places, it is emitted once at the top of the file.
- **Anonymous operations**: if the operation has no `name`, use the operation type as prefix: `QueryResult` / `MutationResult` / `SubscriptionResult`. Variables interface: `QueryVariables` etc.
- **No-schema fallback**: if `GraphqlSchemaInfo` is not yet available (user hasn't introspected), code gen proceeds WITHOUT type information — TypeScript output uses `any` for the result type; a warning banner shows "Schema not introspected — types are untyped. Introspect first for accurate types." The generated client code (function signature, gql call) is still correct.

Example output for `typescript-graphql-request`:
```typescript
// Auto-generated by RedfireForge — do not edit manually
export interface GetUserQuery_user_preferences { theme: string; language: string; }
export interface GetUserQuery_user {
  id: string; name: string; preferences: GetUserQuery_user_preferences;
}
export interface GetUserQuery { user: GetUserQuery_user; }
export interface GetUserQueryVariables { id: string; }

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) { id name preferences { theme language } }
  }
`;

export async function getUser(
  client: GraphQLClient, variables: GetUserQueryVariables
): Promise<GetUserQuery> {
  return client.request<GetUserQuery>(GET_USER, variables);
}
```

**Code gen UI** (tab inside `GraphqlCollections.tsx` or dedicated code gen panel):
- Language selector: 7 tab buttons at top
- Options checkboxes: "Include TypeScript types", "Use `{{env}}` vars in URL/headers", "Include error handling"
- Monaco output panel (read-only, syntax highlighted for target language)
- `[Copy]` button → copies to clipboard
- `[Download]` button → downloads as `.ts` / `.py` / `.sh` with filename derived from operation name

---

#### 3D — Schema Diff & Validation

Uses `@graphql-inspector/core` — the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura).

**Snapshot lifecycle** (`schemaSnapshot.ts`):
1. User clicks "Save snapshot" in Schema Explorer toolbar → captures current SDL + `GraphqlSchemaInfo` + timestamp
2. User can add a label: "v2.3 — before user model refactor"
3. Stored in IndexedDB per `connectionId`; limit 20 per connection (oldest evicted)
4. Snapshots listed in "Changelog" tab of Schema Explorer: date, label, type count, diff button

**Schema diff algorithm** (`schemaDiff.ts`):
```typescript
import { diff as inspectorDiff, CriticalityLevel } from '@graphql-inspector/core';
import { buildSchema } from 'graphql';

export function computeSchemaDiff(oldSdl: string, newSdl: string): GraphqlSchemaDiffResult {
  const changes = inspectorDiff(buildSchema(oldSdl), buildSchema(newSdl));
  return {
    changes: changes.map(c => ({
      criticality: c.criticality.level === CriticalityLevel.Breaking  ? 'BREAKING'
                 : c.criticality.level === CriticalityLevel.Dangerous ? 'DANGEROUS' : 'SAFE',
      path:        c.path ?? '',
      description: c.message,
      oldValue:    c.meta?.oldValue,
      newValue:    c.meta?.newValue,
    })),
    breakingCount:  changes.filter(c => c.criticality.level === CriticalityLevel.Breaking).length,
    dangerousCount: changes.filter(c => c.criticality.level === CriticalityLevel.Dangerous).length,
    safeCount:      changes.filter(c => c.criticality.level === CriticalityLevel.NonBreaking).length,
  };
}
```

**Breaking change severity categories:**

| Severity | Examples |
|---|---|
| `BREAKING` | Field removed, required argument added, field type changed incompatibly, enum value removed |
| `DANGEROUS` | Default value changed, argument type changed compatibly, union member removed |
| `SAFE` | Field added, optional argument added, description changed, directive added |

**Schema diff UI** (`GraphqlSchemaDiff.tsx`):
- Side-by-side SDL panels (left = old snapshot, right = current schema) with line-level diff highlights: red deleted lines, green added lines
- Change list panel below: severity badge, path, human-readable description, old/new value
- Summary header: `3 Breaking   2 Dangerous   8 Safe` with colored count pills
- Severity filter buttons: `All | Breaking | Dangerous | Safe`
- "Export diff as JSON" and "Download SDL" buttons
- Automatic diff toast on schema refresh: "Schema changed — view diff?"

**Snapshot vs. snapshot comparison** (in addition to snapshot-vs-current):
- In the "Changelog" tab of Schema Explorer, each snapshot row has a diff button AND a dropdown to select the comparison target: `vs. Current Schema` (default) or `vs. [other snapshot name]`
- When two snapshots are selected, `computeSchemaDiff(snapshot1.sdl, snapshot2.sdl)` is called — the same function, just using two historical SDLs instead of one + current
- The diff view header updates to show both snapshot labels: `"v2.2 — before migration" vs. "v2.3 — after migration"`
- This enables auditing historical schema evolution without needing the live endpoint

**Diff result persistence**:
- The diff result is NOT persisted — it is recomputed fresh every time the diff view is opened
- Recomputation is fast (<100ms for typical schemas) since `@graphql-inspector/core` is synchronous
- Benefit: always reflects the latest state; no stale cache to manage

---

#### 3E — Mock Server

The mock server runs inside the existing proxy server as a dedicated route. Users point their apps at `http://localhost:3001/api/graphql/mock` instead of the real endpoint.

**Proxy routes** (`src-server/routes/graphql/mock.ts`):
- `POST /api/graphql/mock` — execute `{ query, variables }` against in-memory mock schema
- `POST /api/graphql/mock/config` — activate/deactivate mock, set SDL, set custom resolvers, set latency
- `GET /api/graphql/mock/status` — return `{ enabled, schemaHash, activeResolverCount, latencyMs }`

**Server-side mock execution:**
```typescript
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { execute, parse } from 'graphql';

let mockSchema: GraphQLSchema | null = null;
let mockConfig: GraphqlMockConfig | null = null;

function configureMock(sdl: string, config: GraphqlMockConfig): void {
  const mocks = buildMockMap(config.resolvers);  // MockResolver[] → graphql-tools mocks map
  mockSchema = addMocksToSchema({ schema: makeExecutableSchema({ typeDefs: sdl }), mocks });
  mockConfig = config;
}

async function executeMock(query: string, variables: object): Promise<ExecutionResult> {
  if (!mockSchema) throw new Error('Mock not configured — call POST /api/graphql/mock/config first');
  if (mockConfig?.globalLatencyMs) await delay(mockConfig.globalLatencyMs);
  return execute({ schema: mockSchema, document: parse(query), variableValues: variables });
}
```

**Mock resolver types** (3 modes per field):
- **Random** (default): `@graphql-tools/mock` generates realistic fake data (strings, numbers, IDs)
- **Fixed**: return a hardcoded value specified in the config
- **Script**: JavaScript expression evaluated per call, e.g. `() => new Date().toISOString()`

**Mock schema source**:
The mock server needs an SDL to generate its schema. Two sources are supported:
1. **Use introspected schema** (default): the SDL from the most recent successful introspection of the active connection is automatically sent to the mock server when it is activated. No user action required.
2. **Paste custom SDL**: a Monaco editor in SDL mode appears in the mock panel when "Custom SDL" radio is selected. The user pastes or types an SDL; it is sent to `POST /api/graphql/mock/config` immediately.

If neither source is available (never introspected, no custom SDL), the "Mock mode" toggle is disabled with a tooltip: "Introspect first or provide a custom SDL".

**`useGraphqlMockServer.ts` sync trigger**:
- Config is synced to the server (via `POST /api/graphql/mock/config`) on each of these events:
  1. User toggles mock mode ON → sync full config immediately
  2. User changes a resolver override (Random/Fixed/Script) → debounced 300ms, then sync
  3. User changes global latency or seed → debounced 300ms, then sync
  4. User pastes custom SDL → sync on blur of the SDL editor (not on every keystroke)
- Mock mode OFF: sends `{ enabled: false }` — server disables without losing resolver config
- If the sync POST fails (server unreachable): toast "Failed to update mock server — check that the proxy is running" + revert the toggle to OFF

**Mock server UI** (`GraphqlMockPanel.tsx`):
- Toggle switch in connection settings: "Mock mode" — endpoint pill turns amber + shows `[MOCK]` label
- **Schema source** radio: "Use introspected schema" / "Custom SDL" (shows Monaco editor if Custom selected)
- Type tree (same structure as Schema Explorer): each field row has a resolver override dropdown (Random / Fixed / Script)
- Fixed value: inline JSON input field
- Script: mini Monaco editor (1–3 lines)
- Global latency slider: 0–5000ms
- Seed input: integer for deterministic randomness
- "Reset all to defaults", "Copy mock endpoint URL" (`http://localhost:3001/api/graphql/mock`) buttons
- Status row: "Mock active — 3 custom resolvers — 200ms latency — endpoint: localhost:3001/api/graphql/mock"

---

#### 3F — Advanced Query Features

##### Persisted Queries (APQ)

Automatic Persisted Queries (Apollo APQ spec v1) reduce bandwidth by sending only the query hash on repeat executions.

**Two-step flow:**
1. Client sends hash-only: `{ extensions: { persistedQuery: { version: 1, sha256Hash: "abc..." } } }`
2. Server returns `PERSISTED_QUERY_NOT_FOUND` if not cached
3. Client resends with full query + hash — server caches and responds
4. All subsequent requests use hash-only (cache hit)

**`apqClient.ts`** implementation using browser `crypto.subtle` (no extra npm package):
```typescript
import { parse, print } from 'graphql';

export async function computeAPQHash(query: string): Promise<string> {
  const normalized = print(parse(query));  // normalize whitespace before hashing
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function executeWithAPQ(
  sendFn: (body: object) => Promise<GraphqlResponse>,
  operation: GraphqlOperation,
): Promise<GraphqlResponse> {
  const hash = await computeAPQHash(operation.query);
  const exts = { persistedQuery: { version: 1, sha256Hash: hash } };
  const r1 = await sendFn({ extensions: exts });
  if (isPersistedQueryNotFound(r1)) {
    return sendFn({ query: operation.query, extensions: exts });
  }
  return r1;
}
```

**APQ UI:**
- Toggle in connection settings: "Automatic Persisted Queries" (default: off)
- Request metadata panel shows `APQ: abc123ef…` (16-char prefix, hover for full hash)
- First send: `[Cache miss]` amber indicator; subsequent: `[Cache hit]` green indicator

**APQ — server not supported fallback**:
If the server returns a 400 error or an error with `extensions.code !== 'PERSISTED_QUERY_NOT_FOUND'` on the hash-only first request, it likely doesn't support APQ. In this case:
- `apqClient.ts` falls back to a standard full-query request automatically (transparent to user)
- A `[APQ unsupported]` amber badge is shown in the Metadata tab
- The APQ toggle is automatically disabled for this connection with a toast: "This server does not support APQ — disabled for this connection"
- The detection is cached per `connectionId` in `localStorage` so the fallback test is not repeated

##### Query Batching

Send multiple GraphQL operations in one HTTP request as a JSON array — supported by Apollo Server, Yoga, and most modern servers.

**UI:**
- "Batch" checkbox per operation tab (appears on hover)
- When ≥2 tabs checked: `Send Batch (N)` button appears in connection bar
- Results: stacked N response cards, one per batched operation
- Warning badge if a subscription tab is checked: "Subscriptions cannot be batched — will be skipped"

**Proxy route** `POST /api/graphql/batch`: relay each operation to upstream individually, collect results, return as `ExecutionResult[]`

**Server-side batch handling:** detect whether upstream supports array batching (`array-batch` header or config flag) — if yes, forward as array; if no, execute sequentially and aggregate.

**Batch response error display**:
- Each batched operation gets its own response card, independent of others
- Success card: green header with operation name + latency
- Error card (HTTP error or GraphQL errors): red/amber header; same error display as single-operation response panel
- Partial batch success: `Batch: 3 passed, 1 failed` summary row above the cards
- Individual card body shows full `data` + `errors` if both are present (partial success per-operation is supported)

##### Request Deduplication

Detect when the same query + variables is fired while an identical request is still in-flight.

**Detection mechanism** (`useGraphqlExecution.ts`):
- In-flight requests tracked in a `Map<string, AbortController>` keyed by `hash(trimmed query + sorted JSON variables)`
- When a duplicate hash is about to fire: show a non-blocking inline badge on the Execute button

**Duplicate warning UX:**
- Execute button area shows `[Duplicate in flight]` amber badge
- Dropdown with three choices:
  - **Wait and merge** — share the existing in-flight response when it resolves (0 extra network calls)
  - **Cancel original** — `AbortController.abort()` the in-flight request, then fire fresh
  - **Send anyway** — allow both; skip dedup for this one execution
- Toggle per connection: "Request deduplication" (default: on)

### 3.4 Workflow Integration (Phase 4)

Phase 4 integrates GraphQL as a first-class protocol in the Workflow Designer — alongside HTTP, WebSocket, and Kafka. It also ships 12 interactive demo lessons. It is organized into six subsystems (4A–4F).

---

#### 4A — Node Type Definitions

GraphQL nodes follow the same structural contract as all other workflow nodes:
- A `XxxNodeData` interface in `src/features/workflow/types/workflow.ts`
- A factory case in `src/features/workflow/utils/workflowNodeFactory.ts`
- Execution branch in `src/features/workflow/engine/graphRunner.ts`
- A visual config panel component `GraphqlXxxConfigPanel.tsx`

**Node types added to `WorkflowNodeType`**:
```typescript
// Append to the existing union in workflow.ts:
type WorkflowNodeType = /* existing types */ |
  'graphqlQuery' | 'graphqlMutation' | 'graphqlSubscription' |
  'graphqlIntrospect' | 'graphqlAssert';
```

**Shared helper types** (added to `workflow.ts`):
```typescript
export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name to store the extracted value under
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlQueryNodeData`** (used for both `graphqlQuery` and `graphqlMutation` — they are structurally identical):
```typescript
export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint ({{var}} supported)
  query: string;                 // GraphQL operation text
  variables: string;             // JSON string ({{var}} interpolated at runtime)
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;            // reuses shared GraphqlAuth type from graphql.ts
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];   // JSONPath extractions from response.data
  outputBindings: GraphqlOutputBinding[];
}
```

**`GraphqlSubscriptionNodeData`**:
```typescript
export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP/WS endpoint; wss:// derived automatically
  subscriptionQuery: string;     // must start with `subscription`
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  // Stop conditions — first condition reached wins
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on last message: e.g. "$.data.status == 'COMPLETE'"
  extractionRules: GraphqlExtractionRule[];   // applied to each individual message
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlIntrospectNodeData`**:
```typescript
export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;              // default 30000; introspection can be slow on cold starts
  // Optional validation rules — if any fail, the node errors
  minTypeCount?: number;          // error if schema has fewer types than this
  requiredTypes?: string[];       // error if any of these type names are missing from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}
```

**`GraphqlAssertNodeData`**:
```typescript
export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  // Source: reference a variable from a previous node's output binding
  sourceVariable: string;        // variable name containing the data to assert on
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' = halt workflow; 'warn' = continue with warning badge
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'exists' | 'not_exists' |
           'gt' | 'gte' | 'lt' | 'lte' | 'matches_regex';
  expectedValue?: string;        // stringified expected value; omitted for 'exists'/'not_exists'
  description?: string;          // human-readable label shown in the run timeline
}
```

---

#### 4B — Graph Runner Execution Logic

All five node types are implemented as new `else if` branches in `src/features/workflow/engine/graphRunner.ts`. The execution follows the same async context pattern as existing HTTP and WebSocket nodes.

**Shared utility imports required** (add to `graphRunner.ts` import block):
```typescript
import { JSONPath }         from 'jsonpath-plus';
import { buildClientSchema, printSchema, isObjectType } from 'graphql';
import { computeAPQHash }   from '../../graphql/utils/apqClient';   // sha256 via crypto.subtle
import { evaluateAssertionOp } from '../../engine/fieldOperatorEvaluation';  // existing 24-op evaluator
import { buildAuthHeaders } from '../../graphql/utils/graphqlClient'; // defined in Phase 1 alongside other transport helpers
```

The `sha256` helper used in the `graphqlIntrospect` branch delegates to `computeAPQHash` (which internally uses `crypto.subtle.digest('SHA-256', ...)`). `buildAuthHeaders` is implemented in Phase 1 and converts a `GraphqlAuth` config into an HTTP `Authorization` header string. `evaluateAssertionOp` is the shared 24-operator evaluator already used by HTTP node assertions.

**`graphqlQuery` / `graphqlMutation` execution**:
```typescript
else if (node.type === 'graphqlQuery' || node.type === 'graphqlMutation') {
  const d = node.data as GraphqlQueryNodeData;
  const endpoint  = resolveVars(d.endpoint,  vars);
  const variables = resolveVars(d.variables, vars); // {{var}} in JSON string values
  const headers   = buildGraphqlHeaders(d.headers, d.auth, env);

  let parsedVariables: Record<string, unknown>;
  try {
    parsedVariables = variables ? JSON.parse(variables) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in variables after interpolation: ${variables}` };
  }

  const start = performance.now();
  const resp  = await httpFetch(`${proxyBase}/api/graphql/query`, {
    method:  'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: d.query, variables: parsedVariables }),
    signal:  ctx.abortSignal,
  });
  const latencyMs = performance.now() - start;
  const body = await resp.json() as { data?: unknown; errors?: unknown[] };

  // Apply extraction rules
  for (const rule of d.extractionRules) {
    const extracted = JSONPath.query(body.data, rule.jsonPath)?.[0];
    vars[rule.variableName] = extracted;
  }
  // Bind standard outputs
  applyOutputBindings(d.outputBindings, { data: body.data, errors: body.errors,
    latencyMs, httpStatus: resp.status, operationName: d.label }, vars);

  // Fail node if GraphQL errors present and no extraction rules consumed them
  if (body.errors?.length) {
    return { status: 'error', message: `GraphQL errors: ${JSON.stringify(body.errors)}` };
  }
}
```

**`graphqlSubscription` execution**:
```typescript
else if (node.type === 'graphqlSubscription') {
  const d = node.data as GraphqlSubscriptionNodeData;
  const wsEndpoint  = deriveWsEndpoint(resolveVars(d.endpoint, vars));
  const messages: unknown[] = [];
  let firstMsgLatency = -1;
  const start = performance.now();

  let parsedSubVariables: Record<string, unknown>;
  try {
    parsedSubVariables = d.variables ? JSON.parse(resolveVars(d.variables, vars)) : {};
  } catch (e) {
    return { status: 'error', message: `Invalid JSON in subscription variables: ${d.variables}` };
  }

  // Guard: check abort before opening WebSocket
  if (ctx.abortSignal?.aborted) return { status: 'error', message: 'Aborted before subscription started' };

  await new Promise<void>((resolve, reject) => {
    const client = createGraphqlWsClient(wsEndpoint, d.subscriptionTransport, d.auth);
    // timer and cleanup are forward-referenced; cleanup assigned immediately after subscribe() call
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (d.stopAfterMs) timer = setTimeout(() => { cleanup(); resolve(); }, d.stopAfterMs);

    const cleanup = client.subscribe(
      { query: d.subscriptionQuery, variables: parsedSubVariables },
      {
        next(msg) {
          if (firstMsgLatency < 0) firstMsgLatency = performance.now() - start;
          messages.push(msg.data);
          if (d.stopAfterMessages && messages.length >= d.stopAfterMessages) {
            if (timer) clearTimeout(timer); cleanup(); resolve();
          }
          if (d.stopCondition) {
            const condMet = JSONPath.query(msg.data, d.stopCondition)?.[0];
            if (condMet) { if (timer) clearTimeout(timer); cleanup(); resolve(); }
          }
        },
        error(err) { if (timer) clearTimeout(timer); reject(err); },
        complete()  { if (timer) clearTimeout(timer); resolve(); },
      }
    );
    if (ctx.abortSignal) ctx.abortSignal.addEventListener('abort', () => { cleanup(); resolve(); });
  });

  applyOutputBindings(d.outputBindings, {
    messages, messageCount: messages.length,
    firstMessage: messages[0], lastMessage: messages.at(-1),
    latencyMs: firstMsgLatency,
  }, vars);
}
```

**`graphqlIntrospect` execution**:
```typescript
else if (node.type === 'graphqlIntrospect') {
  const d = node.data as GraphqlIntrospectNodeData;
  const headers = buildGraphqlHeaders(d.headers, d.auth, env);
  const resp = await httpFetch(`${proxyBase}/api/graphql/introspect`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: resolveVars(d.endpoint, vars) }),
    signal: ctx.abortSignal,
  });
  const introspectionResult = await resp.json();
  const schema  = buildClientSchema(introspectionResult.data);
  const sdl     = printSchema(schema);
  const types   = Object.values(schema.getTypeMap()).filter(t => !t.name.startsWith('__'));
  const fields  = types.reduce((n, t) => n + (isObjectType(t) ? Object.keys(t.getFields()).length : 0), 0);
  const sdlHash = await sha256(sdl);

  // Validate rules
  if (d.minTypeCount && types.length < d.minTypeCount) {
    return { status: 'error', message: `Schema has ${types.length} types; expected ≥ ${d.minTypeCount}` };
  }
  for (const req of d.requiredTypes ?? []) {
    if (!schema.getType(req)) return { status: 'error', message: `Required type "${req}" missing from schema` };
  }
  for (const { typeName, fieldName } of d.requiredFields ?? []) {
    const t = schema.getType(typeName);
    if (!isObjectType(t) || !t.getFields()[fieldName]) {
      return { status: 'error', message: `Required field "${typeName}.${fieldName}" missing from schema` };
    }
  }

  applyOutputBindings(d.outputBindings, {
    sdl, typeCount: types.length, fieldCount: fields,
    schemaHash: sdlHash, queryTypeName: schema.getQueryType()?.name ?? 'Query',
  }, vars);
}
```

**`graphqlAssert` execution**:
```typescript
else if (node.type === 'graphqlAssert') {
  const d = node.data as GraphqlAssertNodeData;
  const source = vars[d.sourceVariable];
  const failures: string[] = [];

  for (const assertion of d.assertions) {
    const actual = JSONPath.query(source, assertion.jsonPath)?.[0];
    const passed = evaluateAssertionOp(assertion.operator, actual, assertion.expectedValue);
    if (!passed) {
      failures.push(assertion.description
        ?? `${assertion.jsonPath} ${assertion.operator} ${assertion.expectedValue ?? ''}: got ${JSON.stringify(actual)}`
      );
    }
  }

  if (failures.length > 0 && d.failBehavior === 'error') {
    return { status: 'error', message: failures.join('
') };
  }
  if (failures.length > 0 && d.failBehavior === 'warn') {
    ctx.log('warn', `GraphQL assert warnings:
${failures.join('
')}`);
  }
}
```

**Shared helper** (`buildGraphqlHeaders`):
```typescript
function buildGraphqlHeaders(
  rows: GraphqlNodeHeaderRow[],
  auth: GraphqlAuth | undefined,
  env: Record<string, string>
): Record<string, string> {
  const base = Object.fromEntries(
    rows.filter(r => r.enabled).map(r => [resolveVars(r.key, env), resolveVars(r.value, env)])
  );
  return { ...base, ...buildAuthHeaders(auth) };
}
```

---

#### 4C — Node Configuration Panel UI

Each node type has a dedicated config panel rendered in the workflow designer's right sidebar when the node is selected. Config panels follow the same two-column tab layout as existing node panels.

**`GraphqlQueryConfigPanel.tsx`** (used for both `graphqlQuery` and `graphqlMutation`):

Tabs:
1. **Operation** — endpoint URL input with `{{var}}` autocomplete; Monaco editor in GraphQL mode (height 200px, min; full screen button); "Import from Collections" button (picks an operation from Phase 3 collections)
2. **Variables** — Monaco JSON editor (height 120px) with `{{var}}` interpolation note
3. **Headers** — key-value table (same component as existing HTTP node headers tab)
4. **Auth** — auth type selector (Bearer / Basic / API Key); same as HTTP node auth tab
5. **Extraction** — JSONPath extraction rules table: variable name + JSONPath expression + "Test" button
6. **Output** — output binding table: field dropdown (`data | errors | latencyMs | httpStatus`) + variable name

**"Import from Collections" empty state**: if Phase 3 collections are empty or haven't been set up, the collection picker shows: "No saved operations yet — save one from GraphQL Studio first." with a link that navigates to the GraphQL Studio page in a new tab.

**Extraction tab "Test" button behavior**: runs the JSONPath expression against the most recent successful run output stored in the workflow's run trace (`ctx.runTrace`). If no run exists yet for this node, shows a tooltip "No run data available yet — execute the workflow first." Test result shown inline: `→ "value"` (green) or `→ undefined` (amber).

**Panel validation**: inline validation errors shown in the relevant tab's header with a red dot:
- Operation tab: endpoint URL must be non-empty; editor must not be empty (no blank query); invalid `{{var}}` references shown as amber underlines (warn, not block)
- Variables tab: JSON must parse without error; invalid JSON shows red underline + error message below editor
- Extraction tab: JSONPath expression must be non-empty; variable name must be a valid identifier (`[a-zA-Z_][a-zA-Z0-9_]*`)
- Output tab: variable name must be non-empty and a valid identifier; duplicate variable names within the node show a warning

Field on the canvas node card:
- Shows operation type icon (Q / M) + label + endpoint host (truncated)
- Status badge: last run result (green ✓ / red ✗ / gray —), latency

**`GraphqlSubscriptionConfigPanel.tsx`**:

Tabs:
1. **Subscription** — endpoint URL; Monaco GraphQL editor; variables JSON; transport dropdown (`Auto / graphql-transport-ws / graphql-ws / SSE`)
2. **Stop Conditions** — radio: `After N messages` / `After N seconds` / `When condition met` (JSONPath expression input); defaults to `After 10 messages`
3. **Headers & Auth** — same as query panel
4. **Extraction** — per-message JSONPath extractions (applied to each individual message in the array)
5. **Output** — `messages | messageCount | firstMessage | lastMessage | latencyMs`

**`GraphqlIntrospectConfigPanel.tsx`**:

Tabs:
1. **Endpoint** — URL input + auth + headers
2. **Schema Validation** — optional rules: min type count input; required type names (tag input); required fields (TypeName.fieldName chips)
3. **Output** — `sdl | typeCount | fieldCount | schemaHash | queryTypeName`

**`GraphqlAssertConfigPanel.tsx`**:

Tabs:
1. **Source** — variable picker dropdown (populated from output bindings of upstream nodes via `workflowVariableHints`)
2. **Assertions** — assertion table: JSONPath | operator dropdown | expected value | description; `[+ Add assertion]` button; "Run test" button tests assertions against the most recent run output of the node referenced in `sourceVariable`. If no run data exists, shows "No data — run the workflow first." Operator dropdown includes all 11 operators: `eq, neq, contains, not_contains, exists, not_exists, gt, gte, lt, lte, matches_regex`
3. **Behavior** — fail behavior radio: `Halt workflow (error)` / `Continue with warning`

---

#### 4D — Output Bindings and Variable Chain

The extracted and bound values from GraphQL nodes become available as workflow variables for downstream nodes — identical to how HTTP nodes export `{{nodeLabel.data.user.id}}`.

**Variable naming convention** (same as HTTP nodes):
- `{{nodeLabel.data}}` — full `data` object from query response
- `{{nodeLabel.data.user.id}}` — nested field (dot notation)
- `{{nodeLabel.errors}}` — errors array (usually empty)
- `{{nodeLabel.latencyMs}}` — execution time
- `{{nodeLabel.httpStatus}}` — HTTP status code (usually 200)
- Custom extractions: `{{myVar}}` — named by extraction rule variable name

**For subscription nodes**:
- `{{nodeLabel.messages}}` — array of all collected message payloads
- `{{nodeLabel.messageCount}}` — total messages received
- `{{nodeLabel.firstMessage}}` — first message payload
- `{{nodeLabel.lastMessage}}` — last message payload

**`workflowVariableHints.ts` additions**:

A `WorkflowVariableHint` object has this shape (already defined in the workflow types):
```typescript
interface WorkflowVariableHint {
  category:     string;      // e.g. 'GraphQL Steps', 'HTTP Steps'
  nodeLabel:    string;      // node's label (user-facing)
  variablePath: string;      // full variable reference, e.g. '{{GetUser.data.user.id}}'
  displayLabel: string;      // human-readable label shown in picker, e.g. 'data.user.id'
  valueType:    'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';
}
```

New branches to add:
- **`graphqlQuery` / `graphqlMutation`** branch: emits hints for `data`, `errors`, `latencyMs`, `httpStatus`, `operationName`, plus one hint per `extractionRule` (variableName → `valueType: 'unknown'`)
- **`graphqlSubscription`** branch: emits hints for `messages` (array), `messageCount` (number), `firstMessage` (object), `lastMessage` (object), `latencyMs` (number)
- **`graphqlIntrospect`** branch: emits hints for `sdl` (string), `typeCount` (number), `fieldCount` (number), `schemaHash` (string), `queryTypeName` (string)
- Source category for all: `'GraphQL Steps'` (distinct from `'HTTP Steps'`, `'WebSocket Steps'`)

**`countWorkflowDesignerVariables.ts` update**: this utility counts how many exported variables a workflow design contains (used for the variable counter badge in the toolbar). Add cases for all five GraphQL node types:
- `graphqlQuery` / `graphqlMutation`: count = 5 (standard outputs) + `extractionRules.length`
- `graphqlSubscription`: count = 5 (messages, messageCount, firstMessage, lastMessage, latencyMs)
- `graphqlIntrospect`: count = 5 (sdl, typeCount, fieldCount, schemaHash, queryTypeName)
- `graphqlAssert`: count = 0 (assert nodes consume variables, they don't produce them)

**Canvas node rendering** (`workflowNodeFactory.ts` additions):
```typescript
case 'graphqlQuery': return {
  label: 'GraphQL Query',
  icon: 'GqlQ',    // purple Q badge
  color: 'var(--workflow-node-purple)',
  data: { label: 'GraphQL Query', endpoint: '', query: 'query {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlMutation': return {
  label: 'GraphQL Mutation',
  icon: 'GqlM',    // amber M badge
  color: 'var(--workflow-node-amber)',
  data: { label: 'GraphQL Mutation', endpoint: '', query: 'mutation {
  
}',
          variables: '{}', headers: [], timeoutMs: 30000,
          extractionRules: [], outputBindings: [] } as GraphqlQueryNodeData,
};
case 'graphqlSubscription': return {
  label: 'GraphQL Subscription',
  icon: 'GqlS',    // teal S badge
  color: 'var(--workflow-node-teal)',
  data: { label: 'GraphQL Subscription', endpoint: '', subscriptionQuery: 'subscription {
  
}',
          variables: '{}', headers: [], stopAfterMessages: 10,
          extractionRules: [], outputBindings: [] } as GraphqlSubscriptionNodeData,
};
case 'graphqlIntrospect': return {
  label: 'GraphQL Introspect',
  icon: 'GqlI',    // blue I badge
  color: 'var(--workflow-node-blue)',
  data: { label: 'GraphQL Introspect', endpoint: '', headers: [],
          timeoutMs: 30000, outputBindings: [] } as GraphqlIntrospectNodeData,
};
case 'graphqlAssert': return {
  label: 'GraphQL Assert',
  icon: 'GqlA',    // green/red A badge
  color: 'var(--workflow-node-green)',
  data: { label: 'GraphQL Assert', sourceVariable: '',
          assertions: [], failBehavior: 'error' } as GraphqlAssertNodeData,
};
```

---

#### 4E — Demo Lessons (12 planned)

Lessons are registered under `protocolsDomain` → `graphql` category (new category, alongside existing `websocket` and `sse`). They share the existing lesson infrastructure (`useDemoHub`, `DemoHubContext`, lesson step engine).

**Lesson registration** (`src/features/demo-player/lessons/protocols/graphql-lessons.ts`):

| # | Lesson title | Steps | Est. time | Key concepts covered |
|---|---|---|---|---|
| 1 | Your First GraphQL Query | 7 | 3 min | Endpoint input, introspect, write query, execute, read response |
| 2 | Variables & Arguments | 8 | 3 min | Variables panel, `$id: ID!` syntax, query reuse with different values |
| 3 | Mutations — Create, Update, Delete | 9 | 4 min | Mutation syntax, input types, optimistic UI preview, error handling |
| 4 | Schema Exploration | 7 | 3 min | Type browser, search, click-to-insert, SDL view, field documentation |
| 5 | Subscriptions — Real-Time Data | 10 | 4 min | WS connection, subscribe, live log, pause/filter, disconnect |
| 6 | Authentication & Headers | 6 | 3 min | Connection profiles, Bearer token, API key, environment variable secrets |
| 7 | Query Builder — Visual Operations | 9 | 4 min | Builder tab, checkbox selection, arguments, aliases, directives, "Edit in Editor" |
| 8 | Collections & History | 8 | 3 min | Save operation, folders, history groups, double-click to re-run |
| 9 | Code Generation & Export | 6 | 2 min | Language selector, TypeScript types, copy/download, cURL snippet |
| 10 | Performance Tracing | 7 | 3 min | Enable tracing, waterfall view, slow resolver identification, complexity badge |
| 11 | Workflow Integration | 8 | 4 min | Add graphqlQuery node, wire to graphqlAssert, run workflow, inspect results |
| 12 | Schema Diff & Breaking Changes | 7 | 3 min | Save snapshot, modify schema, compute diff, BREAKING change badge |

**`preAction` guard requirements** (mandatory per demo-player-lessons rules — all stateful steps need guards):

| Lesson | Stateful steps requiring `preAction` | Guard responsibility |
|---|---|---|
| 1 | Steps 2–7 | Ensure connection is set to the test endpoint; restore introspected schema if absent |
| 2 | Steps 2–8 | Ensure a valid parameterized query is in the editor; restore introspected schema |
| 3 | Steps 2–9 | Ensure mutation operation is loaded; ensure `$id` variable is set to last created ID |
| 4 | Steps 2–7 | Ensure introspection has completed (schema tree populated) |
| 5 | Steps 2–10 | Ensure subscription is set up and in the correct state (connected/paused) |
| 6 | Steps 2–6 | Ensure the selected auth profile is active on the connection |
| 7 | Steps 2–9 | Ensure builder tab is active; restore selection state from `localStorage` key |
| 8 | Steps 2–8 | Ensure at least one operation is saved in history |
| 9 | Steps 2–6 | Ensure an introspected schema and an operation are loaded |
| 10 | Steps 2–7 | Ensure a query with Apollo Tracing response is pre-loaded in the response panel |
| 11 | Steps 2–8 | Ensure workflow has the `graphqlQuery` node added and configured |
| 12 | Steps 2–7 | Ensure at least one snapshot is saved in the Changelog tab |

**Lessons 6–12 expanded step detail**:

| Lesson 6 — Authentication & Headers (6 steps) |
|---|
| Step 1: Navigate to Connection settings → "Auth" tab (observe available auth types) |
| Step 2: Select "Bearer Token", paste `{{authToken}}` env var in the token field |
| Step 3: Open the Environment panel, set `authToken` to a test JWT value |
| Step 4: Execute a query — observe `Authorization: Bearer <token>` in the request metadata |
| Step 5: Switch to "API Key" auth, set header name `X-API-Key`, value `{{apiKey}}` |
| Step 6: Execute again — observe header changed in request metadata |

| Lesson 7 — Query Builder (9 steps) |
|---|
| Step 1: Click the "Builder" sub-tab in the editor area |
| Step 2: Expand the `Query` root — observe all available fields |
| Step 3: Check 3 fields — observe generated SDL update live |
| Step 4: Click "Select All" in the builder toolbar (scope: current level) |
| Step 5: Expand a nested object field — add child fields, observe inline fragment handling |
| Step 6: Click on an argument input for a required argument — fill in a test value |
| Step 7: Set an alias on a field — observe alias: fieldName in SDL |
| Step 8: Click "Edit in Editor" — SDL is copied to Monaco editor; builder deactivates |
| Step 9: Edit the SDL in the editor; observe one-way sync (builder does not re-parse) |

| Lesson 8 — Collections & History (8 steps) |
|---|
| Step 1: Execute any query — confirm it appears in History panel with timestamp |
| Step 2: Click a history entry — observe query loaded into editor (not executed) |
| Step 3: Double-click the entry — observe query loads AND executes immediately |
| Step 4: From response panel, click "Save to Collection" — pick or create a folder |
| Step 5: Open Collections panel — verify the saved item appears in the correct folder |
| Step 6: Drag the item to a different folder — confirm it moves |
| Step 7: Click "Export" — download the collections JSON file |
| Step 8: Delete the collection, then import from the downloaded file — verify restore |

| Lesson 9 — Code Generation (6 steps) |
|---|
| Step 1: Select a query with nested fields — ensure schema is introspected |
| Step 2: Open Code Gen panel — default target is `typescript-graphql-request` |
| Step 3: Check "Include TypeScript types" — observe interface definitions appear above the function |
| Step 4: Switch to `curl` target — observe valid curl command with `-H` Authorization header |
| Step 5: Switch to `python-gql` — observe `client.execute(gql(...))` pattern |
| Step 6: Click "Download" — verify a `.ts` file downloads named from the operation |

| Lesson 10 — Performance Tracing (7 steps) |
|---|
| Step 1: Observe the complexity badge next to Execute button (e.g. "Cost: ~14") |
| Step 2: Add a list field to the query — watch complexity badge increase |
| Step 3: Execute a query against an Apollo Server with tracing enabled |
| Step 4: Click the "Tracing" tab in the response panel — observe waterfall |
| Step 5: Hover a slow bar — read exact duration in tooltip |
| Step 6: Click "Sort by duration" — observe slowest resolvers float to top |
| Step 7: Execute 3 more times — observe histogram strip appears at bottom of response panel |

| Lesson 11 — Workflow Integration (8 steps) |
|---|
| Step 1: Navigate to Workflow Designer — create a new blank workflow |
| Step 2: Drag "GraphQL Query" from node palette — observe purple Q node on canvas |
| Step 3: Click the node — open config panel; fill endpoint + write a simple query |
| Step 4: Add a "GraphQL Assert" node — wire it after the query node |
| Step 5: In the Assert panel Source tab — pick `{{GetUser.latencyMs}}` from variable picker |
| Step 6: Add assertion: `$` lt `500` — "Latency must be under 500ms" |
| Step 7: Run the workflow — observe both nodes turn green |
| Step 8: Change assertion to `lt 1` — re-run, observe assert node turns red with failure detail |

| Lesson 12 — Schema Diff (7 steps) |
|---|
| Step 1: In Schema Explorer, click "Save snapshot" — enter label "baseline" |
| Step 2: Observe the Changelog tab now shows the snapshot entry |
| Step 3: Simulate a schema change (switch to a different endpoint with a modified schema) |
| Step 4: Re-introspect — observe the "Schema changed — view diff?" toast |
| Step 5: Click the toast — observe the diff view opens with side-by-side SDL |
| Step 6: Observe the BREAKING badge count and the specific removed/changed field |
| Step 7: Click "Export diff as JSON" — verify the download contains all change entries |

**Lesson step selectors** (`src/shared/selectors.ts` additions — new `GQL` namespace):
```typescript
export const GQL = {
  // Connection bar
  ENDPOINT_INPUT:      '[data-testid="gql-endpoint-input"]',
  INTROSPECT_BTN:      '[data-testid="gql-introspect-btn"]',
  EXECUTE_BTN:         '[data-testid="gql-execute-btn"]',
  CANCEL_BTN:          '[data-testid="gql-cancel-btn"]',
  CONNECTION_STATUS:   '[data-testid="gql-connection-status"]',
  // Editor
  EDITOR_CONTAINER:    '[data-testid="gql-editor-container"]',
  VARIABLES_PANEL:     '[data-testid="gql-variables-panel"]',
  HEADERS_PANEL:       '[data-testid="gql-headers-panel"]',
  // Response
  RESPONSE_VIEWER:     '[data-testid="gql-response-viewer"]',
  RESPONSE_ERRORS_TAB: '[data-testid="gql-response-errors-tab"]',
  TRACING_TAB:         '[data-testid="gql-tracing-tab"]',
  TRACING_WATERFALL:   '[data-testid="gql-tracing-waterfall"]',
  // Schema Explorer
  SCHEMA_EXPLORER:     '[data-testid="gql-schema-explorer"]',
  SCHEMA_SEARCH:       '[data-testid="gql-schema-search"]',
  SCHEMA_TYPE_ITEM:    '[data-testid="gql-schema-type-item"]',
  // Subscription Log
  SUBSCRIPTION_LOG:    '[data-testid="gql-subscription-log"]',
  SUBSCRIPTION_PAUSE:  '[data-testid="gql-subscription-pause"]',
  SUBSCRIPTION_FILTER: '[data-testid="gql-subscription-filter"]',
  // Query Builder
  BUILDER_TAB:         '[data-testid="gql-builder-tab"]',
  BUILDER_FIELD_ROW:   '[data-testid="gql-builder-field-row"]',
  BUILDER_EDIT_BTN:    '[data-testid="gql-builder-edit-btn"]',
  // History & Collections
  HISTORY_PANEL:       '[data-testid="gql-history-panel"]',
  HISTORY_ENTRY:       '[data-testid="gql-history-entry"]',
  COLLECTIONS_PANEL:   '[data-testid="gql-collections-panel"]',
  SAVE_TO_COLLECTION:  '[data-testid="gql-save-to-collection"]',
  // Code gen
  CODE_GEN_PANEL:      '[data-testid="gql-code-gen-panel"]',
  CODE_GEN_LANG_BTN:   '[data-testid="gql-code-gen-lang-btn"]',
  CODE_GEN_COPY:       '[data-testid="gql-code-gen-copy"]',
  // Environments
  ENV_BADGE:           '[data-testid="gql-env-badge"]',
  ENV_MODAL:           '[data-testid="gql-env-modal"]',
  // Schema diff & snapshots (Lesson 12)
  SNAPSHOT_BTN:        '[data-testid="gql-snapshot-btn"]',
  CHANGELOG_TAB:       '[data-testid="gql-changelog-tab"]',
  DIFF_BTN:            '[data-testid="gql-diff-btn"]',
  DIFF_VIEW:           '[data-testid="gql-diff-view"]',
  BREAKING_BADGE:      '[data-testid="gql-breaking-badge"]',
  // Query builder toolbar (Lesson 7)
  BUILDER_SELECT_ALL:  '[data-testid="gql-builder-select-all"]',
  BUILDER_DESELECT:    '[data-testid="gql-builder-deselect"]',
  BUILDER_ARG_INPUT:   '[data-testid="gql-builder-arg-input"]',
  BUILDER_ALIAS_INPUT: '[data-testid="gql-builder-alias-input"]',
  // Code gen (Lesson 9)
  CODE_GEN_DOWNLOAD:   '[data-testid="gql-code-gen-download"]',
  CODE_GEN_TYPES_OPT:  '[data-testid="gql-code-gen-types-option"]',
  // Performance tracing (Lesson 10)
  COMPLEXITY_BADGE:    '[data-testid="gql-complexity-badge"]',
  TRACING_SORT_BTN:    '[data-testid="gql-tracing-sort-btn"]',
  HISTOGRAM_STRIP:     '[data-testid="gql-histogram-strip"]',
  // Mock server
  MOCK_TOGGLE:         '[data-testid="gql-mock-toggle"]',
  MOCK_ENDPOINT_URL:   '[data-testid="gql-mock-endpoint-url"]',
  // Workflow node config panels (Lesson 11)
  WF_QUERY_PANEL:      '[data-testid="gql-wf-query-panel"]',
  WF_ASSERT_PANEL:     '[data-testid="gql-wf-assert-panel"]',
  WF_IMPORT_BTN:       '[data-testid="gql-wf-import-collections-btn"]',
  WF_EXTRACTION_TABLE: '[data-testid="gql-wf-extraction-table"]',
  WF_OUTPUT_TABLE:     '[data-testid="gql-wf-output-table"]',
};
```

---

#### 4F — Gallery Workflow Templates + E2E Coverage

**Gallery templates** (added to `src/features/workflow/data/emptyCanvasTemplates.ts`):

Four GraphQL-themed quick-start workflows available from the empty canvas gallery:

| Template name | Nodes | Description |
|---|---|---|
| `graphql-health-check` | Start → graphqlIntrospect → graphqlQuery → graphqlAssert → End | Verifies schema is reachable, runs a sentinel query, asserts response time < 500ms |
| `graphql-e-commerce-flow` | Start → graphqlMutation (create order) → graphqlSubscription (watch status) → graphqlAssert → End | Creates an order, subscribes to status updates until `COMPLETE`, asserts final status |
| `graphql-schema-watchdog` | Schedule (existing `scheduleTrigger` node) → graphqlIntrospect → condition (existing `condition` node, checks hash changed) → logDebug (existing `logDebug` node) → End | Polls schema on a cron schedule; logs a warning if the schema hash changes |
| `graphql-user-crud` | Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | Full user lifecycle: create → read → verify → delete |

**Variable wiring between nodes** (how data flows in each template):

`graphql-health-check` wiring:
- `graphqlIntrospect` (label: "Introspect API") outputs `schemaHash` → bound to workflow var `apiSchemaHash`
- `graphqlQuery` (label: "Sentinel Query") outputs `latencyMs` → bound to `sentinelLatency`; outputs `data` → bound to `sentinelData`
- `graphqlAssert` (label: "Assert Health") source: `sentinelLatency`; assertion: `$` lt `500`; failBehavior: `error`

`graphql-e-commerce-flow` wiring:
- `graphqlMutation` (label: "Create Order") outputs `data.createOrder.id` (via extraction rule: `$.createOrder.id`) → var `orderId`
- `graphqlSubscription` (label: "Watch Order Status") variables: `{ "orderId": "{{orderId}}" }`; stopCondition: `$.data.orderStatus.status == 'COMPLETE'`; outputs `lastMessage` → var `finalStatus`
- `graphqlAssert` source: `finalStatus`; assertion: `$.data.orderStatus.status` eq `COMPLETE`

`graphql-schema-watchdog` wiring:
- `graphqlIntrospect` (label: "Check Schema") outputs `schemaHash` → var `currentHash`
- `condition` node: expression `{{currentHash}} !== {{lastKnownHash}}`; true branch → `logDebug`; false branch → End
- Template ships with `lastKnownHash` as an empty string workflow variable (user fills it after first run)

`graphql-user-crud` wiring:
- `graphqlMutation` (label: "Create User") extraction rule: `$.createUser.id` → var `createdUserId`
- `graphqlQuery` (label: "Fetch User") variables: `{ "id": "{{createdUserId}}" }`; outputs `data` → var `fetchedUser`
- `graphqlAssert` (label: "Verify User") source: `fetchedUser`; assertion: `$.user.id` eq `{{createdUserId}}`
- `graphqlMutation` (label: "Delete User") variables: `{ "id": "{{createdUserId}}" }`

**Docker test server** (used by E2E tests in 4F-5, 4F-6):

A minimal GraphQL test server is required for E2E tests that hit a real endpoint. This server runs in Docker alongside the Playwright test suite:
- Image: `node:22-alpine` with Apollo Server 4 + `@faker-js/faker`
- Port: `4010` (GraphQL endpoint: `http://localhost:4010/graphql`, WS: `ws://localhost:4010/graphql`)
- Schema: exposes `Query.user(id: ID!): User`, `Mutation.createOrder(input: OrderInput!): Order`, `Subscription.orderStatus(orderId: ID!): OrderStatus`
- Apollo Tracing: enabled (for Lesson 10 E2E)
- Configuration: `e2e/docker-compose.yml` with service `graphql-test-server`
- Pre-test setup hook in `playwright.config.ts`: `globalSetup: './e2e/global-setup.ts'` which starts Docker Compose and waits for the health endpoint `GET /health` → 200
- APQ: enabled on the test server (for Phase 3 APQ E2E)

**E2E test files** (Playwright, `e2e/` directory):

| File | Scenarios covered |
|---|---|
| `e2e/graphql-query-execution.spec.ts` | Query executes, variables interpolated, response rendered, errors displayed |
| `e2e/graphql-subscriptions.spec.ts` | WS subscription connects, messages appear in log, filter works, disconnect |
| `e2e/graphql-schema-explorer.spec.ts` | Introspect renders type tree, search finds field, click-to-insert works |
| `e2e/graphql-query-builder.spec.ts` | Field selection generates SDL, argument filled, directive toggle, "Edit in Editor" |
| `e2e/graphql-collections.spec.ts` | Save to collection, rename folder, drag-drop, export/import round-trip |
| `e2e/graphql-code-gen.spec.ts` | TypeScript + cURL targets generate valid output |
| `e2e/graphql-workflow-nodes.spec.ts` | Health check workflow runs; `graphqlAssert` fails correctly on bad response |
| `e2e/graphql-lessons.spec.ts` | First 3 lessons complete without error (auto-play mode) |
| `e2e/graphql-schema-diff.spec.ts` | Snapshot saved; re-introspect triggers diff toast; diff view shows BREAKING changes; "Export diff JSON" downloads correctly |
| `e2e/graphql-mock-server.spec.ts` | Mock mode enabled; query returns mock data from test server schema; fixed resolver override returns configured value; latency slider adds correct delay |

---

## 4. Architecture

### 4.1 Directory Structure

```
src/features/graphql/
├── GraphqlStudioPage.tsx          # Main page component (tab content)
├── components/
│   ├── GraphqlEditor.tsx          # Monaco editor with monaco-graphql mode
│   ├── GraphqlSchemaExplorer.tsx  # Type browser sidebar (tree + search)
│   ├── GraphqlVariablesPanel.tsx  # Monaco JSON editor for variables
│   ├── GraphqlHeadersPanel.tsx    # Key-value headers with {{var}} support
│   ├── GraphqlResponseViewer.tsx  # Formatted JSON response + metadata
│   ├── GraphqlSubscriptionLog.tsx # Live subscription message stream
│   ├── GraphqlQueryBuilder.tsx    # Visual field selector (Phase 2)
│   ├── GraphqlConnectionBar.tsx   # URL + auth + introspect/execute buttons
│   ├── GraphqlHistoryPanel.tsx    # Operation history sidebar
│   ├── GraphqlCollections.tsx     # Saved collections with folders (Phase 3)
│   ├── GraphqlEnvironments.tsx    # Environment variable management
│   ├── GraphqlFileUpload.tsx      # File variable picker (Phase 2)
│   ├── GraphqlTracingView.tsx     # Apollo Tracing waterfall (Phase 2)
│   ├── GraphqlSchemaDiff.tsx      # Schema diff viewer: side-by-side SDL + change list (Phase 3)
│   ├── GraphqlMockPanel.tsx       # Mock server control panel: resolver overrides + latency (Phase 3)
│   ├── GraphqlQueryConfigPanel.tsx     # Workflow node config panel for graphqlQuery + graphqlMutation (nodeType prop; no separate mutation file) (Phase 4)
│   ├── GraphqlSubscriptionConfigPanel.tsx  # Workflow node config panel for graphqlSubscription (Phase 4)
│   ├── GraphqlIntrospectConfigPanel.tsx    # Workflow node config panel for graphqlIntrospect (Phase 4)
│   └── GraphqlAssertConfigPanel.tsx        # Workflow node config panel for graphqlAssert (Phase 4)
├── hooks/
│   ├── useGraphqlState.ts         # Main state management hook
│   ├── useGraphqlSchema.ts        # Schema introspection + caching + polling
│   ├── useGraphqlExecution.ts     # Query/mutation execution + @defer/@stream
│   ├── useGraphqlSubscription.ts  # Subscription lifecycle (connect/messages/disconnect/reconnect)
│   ├── useGraphqlQueryBuilder.ts  # Visual query builder state (selectedFields, args, aliases, directives, fragments) — Phase 2
│   ├── useGraphqlHistory.ts       # Operation history persistence
│   ├── useGraphqlCollections.ts   # Collection + folder CRUD (add/update/delete/reorder)
│   ├── useGraphqlMockServer.ts    # Mock server enable/disable, custom resolvers, sync to proxy — Phase 3
│   └── useGraphqlEnvironments.ts  # Environment variable resolution
├── types/
│   └── graphql.ts                 # GraphQL-specific types (re-exports from src/shared/types/graphql.ts)
└── utils/
    ├── graphqlClient.ts           # HTTP + WS transport (fetch + graphql-ws + graphql-sse)
    ├── schemaParser.ts            # Introspection result → navigable tree
    ├── queryBuilder.ts            # Visual builder → SDL generation
    ├── codeGenerator.ts           # Generate client code snippets (TypeScript/Python/cURL)
    ├── monacoGraphqlSetup.ts      # Monaco language registration + schema binding
    ├── multipartParser.ts         # @defer/@stream multipart response parser
    ├── preRequestScriptRunner.ts  # Sandboxed pre/post-request script executor (rf.* API)
    ├── schemaDiff.ts              # @graphql-inspector/core wrapper → GraphqlSchemaDiffResult (Phase 3)
    ├── schemaSnapshot.ts          # Snapshot capture + IndexedDB storage/retrieval (Phase 3)
    └── apqClient.ts               # APQ: SHA-256 hash via crypto.subtle + two-step retry logic (Phase 3)

src/features/demo-player/lessons/protocols/
└── graphql-lessons.ts             # 12 demo lesson definitions for the GraphQL Studio (Phase 4)

# Workflow engine files modified in Phase 4:
src/features/workflow/
├── types/workflow.ts              # +GraphqlQueryNodeData, +GraphqlSubscriptionNodeData, +GraphqlIntrospectNodeData, +GraphqlAssertNodeData, +helper types
├── utils/workflowNodeFactory.ts   # +factory cases for all 5 graphql node types
├── utils/workflowVariableHints.ts # +graphqlQuery/Mutation/Subscription/Introspect hint branches
├── utils/countWorkflowDesignerVariables.ts  # +graphqlAssert extraction rule counting
└── engine/graphRunner.ts          # +execution branches for all 5 graphql node types
```

### 4.2 Transport Layer (Proxy Server)

```
src-server/routes/graphql/
├── index.ts                       # Route registration
├── query.ts                       # POST /api/graphql/query (+ multipart for @defer)
├── introspect.ts                  # POST /api/graphql/introspect
├── subscribe.ts                   # WS upgrade /api/graphql/subscribe (Phase 2)
├── sse.ts                         # GET /api/graphql/sse — SSE subscription relay (Phase 2)
├── upload.ts                      # POST /api/graphql/upload (multipart file upload, Phase 2)
├── batch.ts                       # POST /api/graphql/batch (array of operations, Phase 3)
└── mock.ts                        # POST /api/graphql/mock + /mock/config + GET /mock/status (Phase 3)
```

**Note on schema diff**: `schemaDiff.ts` runs entirely client-side using `@graphql-inspector/core`. There is no `/api/graphql/schema-diff` proxy route — the diff computation happens in the browser and requires no server interaction.

**Why proxy?** (Same rationale as WebSocket/Kafka/SSE Studios)
- Bypass CORS restrictions on target GraphQL endpoints
- Handle mTLS/cert validation server-side (skip-cert-verify option)
- Normalize subscription protocol differences (`graphql-ws` vs `subscriptions-transport-ws`)
- Stream `@defer`/`@stream` multipart responses through to client
- Handle file uploads (multipart form-data → target server)
- Enable Tauri IPC transport compatibility (same API surface)
- Add request/response logging for debugging

### 4.3 Shared Types

```typescript
// src/shared/types/graphql.ts

export interface GraphqlConnection {
  id: string;
  name: string;
  endpoint: string;
  wsEndpoint?: string;       // subscription endpoint (default: swap http(s) → ws(s) from endpoint URL)
  headers: Record<string, string>;
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  schemaPollingInterval?: number;  // ms between schema re-fetches; 0 = disabled (default: 30000)
  createdAt: number;               // Unix ms — used for sorting profiles in the profile switcher dropdown
  updatedAt: number;               // Unix ms — updated whenever the user edits the connection
  // Phase 2 — subscription transport selection
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  sseMode?: 'distinct' | 'single';  // only relevant when subscriptionTransport is 'sse'; default: 'distinct'
  // Phase 2 — query complexity estimator thresholds
  complexityThreshold?: number;  // cost badge turns red above this value (default: 500)
  complexityListMultiplier?: number; // list field cost multiplier (default: 10)
  complexityMaxDepth?: number;   // depth beyond which sub-tree cost doubles (default: 10)
  // Phase 2 — subscription log
  subscriptionBufferSize?: number; // max messages in memory (default: 5000)
  // Phase 2 — file upload
  maxFileSize?: number;            // client-side per-file size limit in bytes (default: 50 * 1024 * 1024 = 50 MB)
  // Phase 3 — history
  historyMaxItems?: number;        // ring buffer size for operation history (default: 100, range: 10–500)
  // Phase 3 — APQ
  apqEnabled?: boolean;            // enable Automatic Persisted Queries (default: false)
  apqUnsupportedDetected?: boolean; // true after server-not-supported detection; disables APQ toggle UI
}

// Phase 1 — represents a single editor tab in GraphqlStudioPage
export interface GraphqlOperationTab {
  id: string;
  label: string;              // operation name from AST, or "Untitled" for anonymous operations
  modelUri: string;           // Monaco model URI — unique per tab (e.g. "graphql://operation/{id}")
  operationType?: 'query' | 'mutation' | 'subscription'; // derived from AST; undefined = not yet parsed
  variables: string;          // JSON string for the Variables panel
  headers: GraphqlHeaderRow[]; // per-tab header overrides (in addition to connection-level headers)
  unsavedChanges: boolean;    // true when query/variables/headers changed since last save/load
  connectionId?: string;      // which connection profile this tab is using (undefined = none)
}

export interface GraphqlHeaderRow {
  id: string;
  key: string;
  value: string;              // {{var}} supported; resolved at runtime
  enabled: boolean;
}

export interface GraphqlAuth {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  token?: string;             // bearer token value
  username?: string;          // basic auth
  password?: string;          // basic auth
  headerName?: string;        // apiKey / custom header name
  headerValue?: string;       // apiKey / custom header value
  oauth2?: {                  // oauth2 client_credentials flow
    tokenUrl: string;
    clientId: string;
    clientSecret: string;     // stored as masked env var reference e.g. {{oauth_secret}}
    scope?: string;
    audience?: string;
  };
}

export interface GraphqlOperation {
  id: string;
  name?: string;
  query: string;
  variables?: string;        // JSON string
  operationType: 'query' | 'mutation' | 'subscription';
}

export interface GraphqlResponse {
  data?: unknown;
  errors?: GraphqlError[];
  extensions?: Record<string, unknown>;
  latencyMs: number;
  httpStatus: number;
  httpHeaders: Record<string, string>;
  timestamp: number;
}

export interface GraphqlError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphqlSchemaInfo {
  sdl: string;
  types: GraphqlTypeNode[];
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  fetchedAt: number;
}

export interface GraphqlTypeNode {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  description?: string;
  fields?: GraphqlFieldNode[];
  enumValues?: string[];
  interfaces?: string[];
  possibleTypes?: string[];
}

export interface GraphqlFieldNode {
  name: string;
  type: string;              // formatted type string e.g. "[User!]!"
  description?: string;
  args?: GraphqlArgNode[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphqlArgNode {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string;
}

export interface GraphqlHistoryItem {
  id: string;
  operation: GraphqlOperation;
  response: GraphqlResponse;
  connectionId: string;
  timestamp: number;           // denormalized from response.timestamp for fast sorting/indexing without deserializing the full response
  latencyMs: number;           // denormalized from response for fast display in history list without parsing response
}

// Phase 1 — named environment containing resolved key-value variable pairs
export interface GraphqlEnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  masked?: boolean;            // true = display as ••••• in the UI (for secrets/tokens)
}

export interface GraphqlEnvironment {
  id: string;
  name: string;                // e.g. "Staging", "Production", "Local Dev"
  variables: GraphqlEnvironmentVariable[];
  isActive: boolean;           // only one environment per workspace can be active at a time
  createdAt: number;
  updatedAt: number;
}

// Phase 2 — individual message received on a live subscription (WS or SSE)
export interface GraphqlSubscriptionMessage {
  id:          string;          // unique within this subscription session (UUID or sequential int as string)
  sessionId:   string;          // ties message to the active subscription session (shared across all messages in one subscribe call)
  index:       number;          // sequential 1-based counter since subscribe() was called
  direction:   'in' | 'out';   // 'in' = server push (`next`); 'out' = client send (e.g. `ping`)
  timestampMs: number;          // absolute Unix ms when this frame was received
  offsetMs:    number;          // ms elapsed since subscribe() was called
  data:        unknown;         // parsed JSON body of the `next` frame payload
  errors?:     GraphqlError[];  // present if the `next` frame contains an `errors` array
  transport:   'graphql-transport-ws' | 'graphql-ws' | 'sse';
}

// Phase 2 — result shape emitted by multipartParser.ts for @defer / @stream responses
export interface IncrementalDeliveryResult {
  type:       'initial' | 'patch';
  patchIndex: number;
  path?:      Array<string | number>;   // undefined for the initial chunk; array path for patches
  data?:      unknown;                  // the patched fragment or list item data
  errors?:    GraphqlError[];           // partial errors for this chunk only
  merged:     unknown;                  // fully merged accumulated result up to this point
  hasNext:    boolean;                  // false when the final chunk has been received
}

export interface GraphqlCollectionFolder {
  id: string;
  name: string;
  parentId?: string;           // undefined = root
  createdAt: number;
}

export interface GraphqlCollectionItem {
  id: string;
  name: string;
  description?: string;        // user-written notes for this operation
  folderId?: string;           // undefined = root collection
  operation: GraphqlOperation;
  connectionId?: string;       // optional — saved connection context
  scripts?: GraphqlScriptConfig;  // per-item pre/post-request scripts (Phase 3)
  isPinned?: boolean;
  tags?: string[];             // user-defined tags for filtering/grouping
  createdAt: number;
  updatedAt: number;
}

export interface GraphqlScriptConfig {
  preRequest?: string;         // JavaScript source for pre-request script (sandboxed)
  postResponse?: string;       // JavaScript source for post-response script (sandboxed)
  timeout?: number;            // max execution time ms (default: 5000)
  enabled?: boolean;           // false = scripts defined but not executed (default: true)
}

export interface RfResponseContext {
  httpStatus:  number;
  httpHeaders: Record<string, string>;
  data:        unknown;
  errors?:     GraphqlError[];
  latencyMs:   number;
}

// The `rf` object injected into pre-request and post-response scripts
export interface RfContext {
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  response?: RfResponseContext;  // undefined in pre-request; populated in post-response
  assert(condition: boolean, message?: string): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  // Operation metadata (read-only, populated before script runs)
  operation: {
    name: string | undefined;        // current operation name (undefined for anonymous operations)
    type: 'query' | 'mutation' | 'subscription';
    variables: Record<string, unknown>;  // parsed variables object (read-only snapshot)
  };
}

export interface GraphqlCodeGenOptions {
  target: 'typescript-graphql-request' | 'typescript-urql' | 'typescript-apollo' |
          'typescript-fetch' | 'python-gql' | 'curl' | 'httpie';
  includeTypes: boolean;          // prepend TypeScript interface definitions
  useEnvVarsForHeaders: boolean;  // replace {{var}} with process.env / os.environ / $VAR
  includeErrorHandling: boolean;  // wrap client call in try/catch (TS) or try/except (Python);
                                  // adds GraphQL errors check (if result.errors throw/raise)
}

export interface GraphqlSchemaSnapshot {
  id: string;
  connectionId: string;
  sdl: string;
  typesCount: number;
  capturedAt: number;
  label?: string;              // user-assigned label e.g. "v2.3 — before migration"
}

export interface GraphqlSchemaDiffChange {
  criticality: 'BREAKING' | 'DANGEROUS' | 'SAFE';
  path: string;                // e.g. "Query.user" or "Order.items[first: Int]"
  description: string;         // human-readable change description
  oldValue?: string;
  newValue?: string;
}

export interface GraphqlSchemaDiffResult {
  changes: GraphqlSchemaDiffChange[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
}

export type MockResolver =
  | { type: 'random' }
  | { type: 'fixed';  value: unknown }
  | { type: 'script'; code: string };  // JS arrow function body: "() => new Date().toISOString()"

export interface GraphqlMockConfig {
  connectionId: string;
  enabled: boolean;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver
  globalLatencyMs: number;    // added to every mock response (0 = no delay)
  seed?: number;              // random seed for deterministic mock data generation
}

export interface GraphqlAPQConfig {
  enabled: boolean;
  hashAlgorithm: 'sha256';    // only SHA-256 is defined in APQ spec v1
}

export interface GraphqlEnvironment {
  id: string;
  name: string;               // e.g. "Production", "Staging", "Local"
  variables: Record<string, string>;  // key → value (values can reference other vars: {{other}})
  isActive: boolean;
}

// ── Phase 4 — Workflow Node Types ─────────────────────────────────────────────
// These types live in src/features/workflow/types/workflow.ts alongside WsConnectNodeData etc.

export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  variableName: string;   // name under which the extracted value is stored in workflow vars
  jsonPath: string;       // JSONPath applied to the response `data` object
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP endpoint; {{var}} supported
  query: string;                 // GraphQL operation text (query or mutation)
  variables: string;             // JSON string; {{var}} interpolated at runtime
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  timeoutMs: number;             // default 30000
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlOutputBinding[];
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;              // HTTP or WS endpoint; wss:// derived via deriveWsEndpoint() if needed
  subscriptionQuery: string;     // must be a `subscription { }` operation
  variables: string;             // JSON string
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  stopAfterMessages?: number;    // stop after collecting N messages (0 = unlimited)
  stopAfterMs?: number;          // stop after N ms of wall time
  stopCondition?: string;        // JSONPath expression on latest message: stop when truthy
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  minTypeCount?: number;          // error if schema type count is below this value
  requiredTypes?: string[];       // error if any of these type names are absent from schema
  requiredFields?: Array<{ typeName: string; fieldName: string }>; // error if field not found on type
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlWorkflowAssertion {
  id: string;
  jsonPath: string;              // applied to the value of sourceVariable
  operator: 'eq' | 'neq' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'matches_regex';
  expectedValue?: string;        // stringified; omitted for 'exists' / 'not_exists'
  description?: string;          // human-readable label shown in workflow run timeline
}

export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  sourceVariable: string;        // name of the workflow variable to assert on (from a prior node's output)
  assertions: GraphqlWorkflowAssertion[];
  failBehavior: 'error' | 'warn'; // 'error' halts the workflow; 'warn' continues with a warning badge
}
```

### 4.4 Tab Registration

```typescript
// In src/app/utils/appTabUtils.ts — add to Tab union and PROTOCOLS_TABS set
type Tab = ... | 'graphql';

// PROTOCOLS_TABS.add('graphql');
```

### 4.5 Workflow Node Registration

```typescript
// New workflow node types
type WorkflowNodeType = ... 
  | 'graphqlQuery' 
  | 'graphqlMutation' 
  | 'graphqlSubscription' 
  | 'graphqlIntrospect' 
  | 'graphqlAssert';
```

### 4.6 UI Layout (Three-Panel Design)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Connection Bar: [URL input] [Auth ▾] [Headers ▾] [▶ Execute] [⟳]  │
├───────────┬─────────────────────────────────┬───────────────────────┤
│           │  Operation Editor (Monaco)      │                       │
│  Schema   │  ┌───────────────────────────┐  │  Response Viewer      │
│  Explorer │  │ query GetUser($id: ID!) { │  │  ┌─────────────────┐  │
│           │  │   user(id: $id) {         │  │  │ { "data": {     │  │
│  [Types]  │  │     name                  │  │  │   "user": {     │  │
│  [Search] │  │     email                 │  │  │     "name": ... │  │
│           │  │   }                       │  │  │   }             │  │
│           │  │ }                         │  │  │ } }             │  │
│           │  └───────────────────────────┘  │  └─────────────────┘  │
│           │  ┌─Variables──┬──Headers──────┐  │  [200 OK] [145ms]    │
│           │  │ {          │ Authorization │  │  [Tracing] [Headers] │
│           │  │   "id": 1  │ Bearer {{t}}  │  │                       │
│           │  │ }          │               │  │                       │
│           │  └────────────┴───────────────┘  │                       │
├───────────┴─────────────────────────────────┴───────────────────────┤
│ Tabs: [Op 1] [Op 2] [Op 3] [+]    | History ▾ | Collections ▾      │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**
- Left sidebar: Schema Explorer (collapsible, like Kafka Topics panel)
- Center: Editor (top) + Variables/Headers tabs (bottom) — resizable split
- Right: Response viewer (collapsible, auto-shows on execute)
- Bottom bar: Operation tabs + History/Collections access
- Follows existing resizable split-panel pattern from SSE Studio

---

## 5. Implementation Phases

### Phase 1 — MVP (Core Editor + Execution)
**Estimated scope**: ~16 files, ~2800 LOC

**New client dependencies**: `graphql`, `monaco-graphql`, `graphql-language-service`  
**New server dependencies**: `graphql` (already in the project)

#### 1A — Foundation

| # | Task | Priority |
|---|------|----------|
| 1A-1 | Create `src/features/graphql/` directory structure: all subdirectories (`components/`, `hooks/`, `utils/`, `types/`) with empty index files | P0 |
| 1A-2 | Define all Phase 1 shared types in `src/shared/types/graphql.ts`: `GraphqlConnection`, `GraphqlAuth`, `GraphqlOperation`, `GraphqlResponse`, `GraphqlError`, `GraphqlSchemaInfo`, `GraphqlTypeNode`, `GraphqlFieldNode`, `GraphqlArgNode`, `GraphqlEnvironment` | P0 |
| 1A-3 | Register `graphql` tab in `src/app/utils/appTabUtils.ts` (`PROTOCOLS_TABS.add('graphql')`) and render `<GraphqlStudioPage />` in `App.tsx` | P0 |
| 1A-4 | Add `GRAPHQL = { ... }` test selector namespace to `src/shared/selectors.ts` (connection bar, editor, response viewer, schema explorer, variables panel) | P0 |
| 1A-5 | `GraphqlStudioPage.tsx`: three-panel layout (Schema Explorer | Editor + Variables/Headers bottom split | Response Viewer) with resizable panels; operation tab bar; follows existing SSE Studio panel pattern | P0 |

#### 1B — Monaco Editor Integration

| # | Task | Priority |
|---|------|----------|
| 1B-1 | `monacoGraphqlSetup.ts`: lazy-load `monaco-graphql` Web Worker on first tab activation; `initializeMode()` with `validateVariables: true`; `api.setSchemaConfig()` binding; per-tab model create/dispose lifecycle | P0 |
| 1B-2 | `GraphqlEditor.tsx`: Monaco editor with `graphql` language; `⌘Enter` / `Ctrl+Enter` shortcut fires execute; `F1` opens command palette; editor height fills available space with min-height | P0 |
| 1B-3 | Multi-tab operations: up to 8 tabs; tab label = operation name extracted from AST (or "Untitled"); `[+]` add tab; `×` close tab (confirm if unsaved changes); `⌘W` close shortcut | P1 |
| 1B-4 | Operation name selector: parse `DocumentNode` for multiple named `OperationDefinitionNode`; show "Executing: [name ▾]" dropdown in connection bar when >1 operations defined; single operation = no dropdown | P1 |
| 1B-5 | `GraphqlVariablesPanel.tsx`: Monaco editor in JSON mode; derive JSON Schema from `VariableDefinitionNode[]` and register via `setDiagnosticsOptions` for inline variable type validation; debounce 300ms on query change | P0 |
| 1B-6 | `GraphqlHeadersPanel.tsx`: key-value row editor with `{{var}}` placeholder support; reuse key-value component from existing WebSocket/SSE Studio header panels | P0 |
| 1B-7 | Define `GraphqlOperationTab` and `GraphqlHeaderRow` types in `src/shared/types/graphql.ts`; `unsavedChanges` flag set on every query/variables/headers keystroke, cleared on save/load; tab label derives operation name from `graphql.parse(query).definitions[0].name.value` (or "Untitled" if anonymous/invalid) | P1 |

#### 1C — Schema Explorer

| # | Task | Priority |
|---|------|----------|
| 1C-1 | `POST /api/graphql/introspect` proxy route: forward the standard introspection query to the upstream endpoint; return raw introspection JSON; support `skipTlsVerify` option | P0 |
| 1C-2 | `schemaParser.ts`: `buildClientSchema(introspectionData)` + `printSchema()` → full SDL; map type nodes to `GraphqlTypeNode[]`; filter `__`-prefixed built-in types and built-in scalars; extract root type names | P0 |
| 1C-3 | `useGraphqlSchema.ts`: trigger introspection on connect; cache result in `localStorage` keyed by endpoint URL; polling via `setInterval` (respects `schemaPollingInterval`, clears on unmount/blur); SHA-256 hash change detection; feed introspection JSON to `monacoGraphqlSetup.ts` on every schema update | P0 |
| 1C-4 | `GraphqlSchemaExplorer.tsx`: left sidebar type list (grouped by kind: Object, Input, Enum, Interface, Union, Scalar) with filter bar; right detail panel showing field table (name, type, args, description); `[Introspect ⟳]` button | P0 |
| 1C-5 | Click-to-insert: clicking a field name in Schema Explorer calls `editor.executeEdits()` to insert the field name at the current Monaco cursor position | P1 |
| 1C-6 | Schema search: live text filter across type names, field names, and descriptions; results show `TypeName.fieldName` with description excerpt; Escape clears filter | P1 |
| 1C-7 | Schema SDL tab: Monaco read-only GraphQL mode rendering the full SDL; "Copy SDL" button; "Download .graphql" file button | P1 |
| 1C-8 | Introspection failure error handling: detect HTTP errors (401, 403, 5xx), introspection-disabled response (HTTP 200 but error in body mentioning "introspection"/"disabled"), network failure; display per-scenario banners from Section 12.1; yellow "introspection disabled" banner allows continued manual use of the editor | P1 |
| 1C-9 | Client-side pre-execution validation: (a) `JSON.parse(variables)` fail → disable Execute, red border on Variables panel; (b) `graphql.validate(schema, graphql.parse(query))` after schema introspected → Monaco squiggles + `⚠ N errors` badge on Execute button (advisory, not blocking); debounce both checks at 300–500ms | P1 |

#### 1D — Execution Engine

| # | Task | Priority |
|---|------|----------|
| 1D-1 | `POST /api/graphql/query` proxy route: forward `{ query, variables, operationName }` to upstream endpoint; inject auth headers; support `skipTlsVerify`; return `{ data, errors, extensions }` + latency + HTTP status + response headers | P0 |
| 1D-2 | `graphqlClient.ts` HTTP transport: `executeQuery(operation, connection) → Promise<GraphqlResponse>`; `buildAuthHeaders(GraphqlAuth)` (Bearer, Basic `btoa`, API Key); `{{var}}` interpolation in URL and headers; `AbortController` signal forwarding | P0 |
| 1D-3 | `useGraphqlExecution.ts`: state machine `idle → loading → success | error`; store `AbortController` in state; Escape key + `[Cancel]` button both call `abort()`; measure latency with `performance.now()` | P0 |
| 1D-4 | `GraphqlResponseViewer.tsx`: Monaco JSON read-only viewer for Response tab; HTTP Headers tab; Metadata tab (HTTP status badge, latency ms, response size, content-type); "Copy" button; "Expand all" / "Collapse all" toggles | P0 |
| 1D-5 | Error handling: HTTP-level errors → colored banner with message + suggestion (Section 12.1 matrix); GraphQL `errors[]` → Monaco markers via `setModelMarkers` at `locations[].line/column`; partial data display (show `data` + `errors` simultaneously) | P1 |
| 1D-6 | Auth config popover UI: `Type` dropdown (None / Bearer / Basic / API Key / OAuth 2.0 / Custom); per-type fields (Bearer: masked token input; Basic: username + password; API Key: header name + value; OAuth 2.0: read-only Phase 3 message); all sensitive values stored under `GraphqlConnection` in `localStorage`; `!` warning when sensitive value stored in plain text (not a `{{var}}` reference) | P1 |

#### 1E — Connection Management & State

| # | Task | Priority |
|---|------|----------|
| 1E-1 | `GraphqlConnectionBar.tsx`: URL input with recent-endpoints autocomplete dropdown (last 10 stored in `localStorage`); auth type badge dropdown; `[Execute ▶]` + `[Introspect ⟳]` buttons; TLS skip toggle (⚠ icon); schema polling active indicator (green pulse dot) | P0 |
| 1E-2 | Connection profiles in `useGraphqlState.ts`: `GraphqlConnection[]` persisted in `localStorage`; "Save as profile" button (prompts for name); profile switcher dropdown; delete profile | P1 |
| 1E-3 | `useGraphqlState.ts`: top-level state hook managing operation tabs, active connection ID, active environment ID; persists tab content (query, variables, headers), active connection, recent endpoints to `localStorage` | P0 |
| 1E-4 | `useGraphqlEnvironments.ts`: manage `GraphqlEnvironment[]` in `localStorage`; `resolveVars(str, env)` replaces `{{key}}` references; one active environment at a time; warn on unresolved vars | P0 |
| 1E-5 | `GraphqlEnvironments.tsx`: environment manager modal — left panel = environment list; right panel = key-value table; masked values toggle (eye icon); active environment switcher; import/export environments as JSON | P1 |
| 1E-6 | Schema polling configuration UI: toggle (on/off) + interval input in connection settings popover; "Polling active" indicator shows time-to-next-poll countdown | P1 |

### Phase 2 — Subscriptions + Query Builder
**Estimated scope**: ~20 files, ~4500 LOC

**New client dependencies**: `graphql-ws`, `subscriptions-transport-ws`, `graphql-sse`, `meros`, `extract-files`, `jsonpath-plus`  
**New server dependencies**: `graphql-ws`, `subscriptions-transport-ws`, `busboy` (all already listed in Section 6)

#### 2A — WebSocket Subscriptions

| # | Task | Priority |
|---|------|----------|
| 2A-1 | Add `WS /api/graphql/subscribe` proxy route: WebSocket upgrade, subprotocol negotiation (`graphql-transport-ws` / `graphql-ws`), bidirectional frame relay, subscription multiplexing by `id` | P0 |
| 2A-2 | Implement `graphql-ws` Client integration in `graphqlClient.ts`: `subscribe(operation) → AsyncIterator<ExecutionResult>` using the modern subprotocol | P0 |
| 2A-3 | Implement `subscriptions-transport-ws` legacy SubscriptionClient integration in `graphqlClient.ts` | P1 |
| 2A-4 | Protocol auto-detection in `graphqlClient.ts`: attempt `graphql-transport-ws`; on close code `4406`/`4400` retry with `graphql-ws` legacy subprotocol; surface permanent failure on `1000` or other codes | P1 |
| 2A-5 | Subscription state machine in `useGraphqlSubscription.ts`: `idle → connecting → connected → subscribing → active → reconnecting → error | disconnected` with full lifecycle events | P0 |
| 2A-6 | Auto-reconnect with exponential backoff: delay = `min(1000 × 2^attempt, 30_000)` ms ± 20% jitter; max 5 attempts; abort on permanent close codes `4400`, `4401`, `4499` | P1 |
| 2A-7 | Connection status indicator in connection bar: colored pill showing current state label + message count when `active`; "Stop Reconnecting" cancel button when `reconnecting` | P1 |
| 2A-8 | `connection_init_payload` auth: `buildConnectionParams(auth)` returns an object passed as `connectionParams` in `connection_init` frame; handles `bearer`, `basic`, `apiKey` auth types; `4401` close code maps to permanent `error` state (no retry) | P1 |
| 2A-9 | `wsEndpoint` URL derivation: `deriveWsEndpoint(httpEndpoint)` in `graphqlClient.ts` — `https://` → `wss://`, `http://` → `ws://`; fallback used when `GraphqlConnection.wsEndpoint` is not explicitly set; `subscriptionTransport` and `sseMode` fields persisted on `GraphqlConnection` | P2 |

#### 2B — SSE Subscriptions

| # | Task | Priority |
|---|------|----------|
| 2B-1 | Add `graphql-sse` to Phase 2 npm client dependencies | P1 |
| 2B-2 | Implement SSE subscription transport in `graphqlClient.ts` using `graphql-sse` `createClient({ url, fetchFn })`; expose same `subscribe(operation) → AsyncIterator` interface as WS clients | P1 |
| 2B-3 | Add `GET /api/graphql/sse` proxy route: relay upstream SSE stream, forward `Last-Event-ID` for resumability, set `Content-Type: text/event-stream; charset=utf-8` + `Cache-Control: no-cache`, handle CORS | P1 |
| 2B-4 | SSE mode detection: default to SSE when URL path ends in `/stream`; manual transport override dropdown (WebSocket modern / WebSocket legacy / SSE) in connection settings | P1 |

#### 2C — Subscription UI

| # | Task | Priority |
|---|------|----------|
| 2C-1 | `GraphqlSubscriptionLog.tsx` — virtualized scrolling message list (index, direction badge, operation name, relative timestamp +Ns, delivery latency, collapsible JSON body with syntax highlighting) | P0 |
| 2C-2 | Sticky stats bar: total messages, error count, rolling 5s messages/sec, connected duration stopwatch | P1 |
| 2C-3 | Log toolbar: Pause/Resume toggle (buffering new messages when paused), Clear, Export JSON download | P1 |
| 2C-4 | Inline filter bar (toggle): full-text or JSONPath expression filter across message bodies; live filtering with match count `Showing N/M messages` | P1 |
| 2C-5 | Assertion panel (right sidebar toggle): user defines JSONPath assertions evaluated against each incoming message; pass/fail badge per message row + aggregate footer `N/M assertions pass` | P2 |

#### 2D — Incremental Delivery (`@defer` / `@stream`)

| # | Task | Priority |
|---|------|----------|
| 2D-1 | `multipartParser.ts`: use `meros` to split `multipart/mixed` stream into boundary-separated parts; apply incremental patches to accumulated result via path-based merge; emit `{ type, patchIndex, path, merged }` events | P1 |
| 2D-2 | Update `POST /api/graphql/query` proxy route: detect `Content-Type: multipart/mixed` in upstream response; pass through chunked body without buffering (`Transfer-Encoding: chunked` preserved); normalize boundary string | P1 |
| 2D-3 | Update `GraphqlResponseViewer.tsx` for incremental delivery: shimmer/skeleton on deferred fields while patch pending; dissolve + green flash when patch arrives; `@stream` lists show items appending in real time | P1 |
| 2D-4 | Chunk tracker toolbar above response JSON: `Chunk N of ? received` → `All N chunks received (Xms total)` when `hasNext: false`; per-chunk hover timing (`Chunk 2: +340ms`) | P2 |
| 2D-5 | `hasIncrementalDirective(query)` utility in `graphqlClient.ts`: `graphql.parse()` + `graphql.visit()` checks for `@defer`/`@stream` `DirectiveNode`; returns `false` on parse error; used by `useGraphqlExecution.ts` to set `Accept: multipart/mixed` header conditionally | P1 |

#### 2E — File Upload

| # | Task | Priority |
|---|------|----------|
| 2E-1 | `GraphqlFileUpload.tsx`: "Files" tab inside Variables bottom panel; drag-and-drop + browse file picker; file list (name, MIME, size, remove); auto-injects `null` placeholder into Variables JSON; max file size warning (configurable, default 50 MB) | P1 |
| 2E-2 | Client-side multipart construction: `extract-files` extracts `File` objects from variables map; builds `FormData` with `operations`, `map`, and file entries per graphql-multipart-request-spec | P1 |
| 2E-3 | `POST /api/graphql/upload` proxy route: `busboy` parses incoming FormData; reconstructs equivalent multipart request targeting upstream; streams file bytes without memory buffering | P1 |
| 2E-4 | Upload progress indicator: proxy sends `X-Upload-Progress: {bytesUploaded}/{totalBytes}` chunked lines before the JSON result; client reads response as `ReadableStream` to parse progress lines; per-file progress bar fills in real time | P2 |
| 2E-5 | Client-side file size validation on selection (before upload): check `file.size` against configurable `maxFileSize` (default 50 MB) and hard cap (200 MB) immediately on drag-drop or browse pick; rejected files shown in red error state on file row; Execute button disabled while any file has a size error | P1 |

#### 2F — Visual Query Builder

| # | Task | Priority |
|---|------|----------|
| 2F-1 | `useGraphqlQueryBuilder.ts`: builder state management (`selectedFields` path map, `argValues`, `aliases`, `directives`, `fragments`); actions: toggleField, setArgValue, setAlias, addDirective, addFragment, reset | P1 |
| 2F-2 | `queryBuilder.ts`: SDL generator — recursively builds selection sets from state; inlines args as literals or `$varName` references with auto-generated variable definitions; appends directives, aliases, fragment spreads + definitions | P1 |
| 2F-3 | `GraphqlQueryBuilder.tsx`: field selector tree — checkbox/⊕ toggle, expand arrow for Object types, partial-select `−` indicator, type badge (blue scalar, purple object, amber enum, teal interface), deprecated badge, hover description tooltip | P1 |
| 2F-4 | Argument inputs: accordion per selected field; per-arg input widget matched to arg type (text input, number input, boolean toggle, enum dropdown, `$varRef` switch); type hint shown next to each input | P1 |
| 2F-5 | Two-step schema search: text input filters fields across all types → click result auto-expands tree to field's root path + updates breadcrumb; Escape returns to unfiltered root view | P1 |
| 2F-6 | Fragment panel (right column, collapsible): `[+ New Fragment]` with name input + type selector; fragment field-selector; `[Use]` inserts `...FragmentName` spread; unused fragments highlighted amber | P2 |
| 2F-7 | Directive toggles (`@skip` / `@include`): hover button per field row; popover to choose or create Boolean variable; directive indicator inline on field row label; auto-adds variable to Variables panel | P2 |
| 2F-8 | Alias support: inline alias text input on hover/focus of a selected field; field row updates to `alias: fieldName`; validated (no spaces, no reserved words) | P2 |
| 2F-9 | "Edit in Editor" escape hatch: button in builder toolbar promotes current generated SDL into Monaco editor and deactivates the builder (one-way sync only) | P1 |
| 2F-10 | Union/Interface inline fragment support: when a field's return type is Union or Interface, render child fields grouped under concrete type headers; `selectedFields` map uses `__on_TypeName` path segment convention; SDL generator emits `... on TypeName { ... }` selection sets; interface common fields shown above concrete type groups | P2 |
| 2F-11 | `QueryBuilderState` persistence: serialize and store state in `localStorage` keyed by `${tabId}:builderState` on every state change (debounced 500ms); restore on tab load; "Select All" / "Deselect All" toolbar buttons scoped to current breadcrumb level | P2 |

#### 2G — Performance & Tracing

| # | Task | Priority |
|---|------|----------|
| 2G-1 | `GraphqlTracingView.tsx`: Apollo Tracing waterfall Gantt chart from `extensions.tracing`; horizontal bars (position = startOffset, width = duration); labels `ParentType.fieldName`; color-coded green/amber/red by duration; sortable by start time / duration / path; hover tooltip; click row highlights response field | P2 |
| 2G-2 | Query complexity estimator: pre-execution AST cost calculation (scalar +1, object +2, list × configurable multiplier, depth penalty); cost badge near Execute button (green/amber/red); configurable threshold; confirmation dialog when cost > 2× threshold | P2 |
| 2G-3 | Response time histogram: track P50/P95/P99 latency in-memory across ≥3 executions of the same operation; 7-bucket mini histogram in collapsible strip at bottom of response panel; resets on query text change | P2 |
| 2G-4 | Complexity estimator configuration: add "Performance" tab to connection settings popover with `threshold` input (default 500), `listMultiplier` input (default 10), `maxDepth` input (default 10); values persisted on `GraphqlConnection`; cost badge and confirmation dialog use these values | P2 |
| 2G-5 | Histogram same-query detection: normalize query via `print(parse(query))` and SHA-256 hash the result (`crypto.subtle`); group latency samples by hash; named operations additionally key by `operationName`; reset samples when hash changes | P2 |

### Phase 3 — Collections + Code Gen
**Estimated scope**: ~18 files, ~3800 LOC

**New client dependencies**: `@graphql-inspector/core`  
**New server dependencies**: none beyond Phase 1–2 (uses existing `graphql` + `@graphql-tools/*` already listed)

#### 3A — Collections & History

| # | Task | Priority |
|---|------|----------|
| 3A-1 | `useGraphqlHistory.ts`: IndexedDB-backed ring buffer (max 100/configurable); FIFO eviction; keyed by `connectionId + timestamp`; load/save/clear/search operations | P0 |
| 3A-2 | `GraphqlHistoryPanel.tsx`: full-height sidebar with recency groups (Today/Yesterday/7 days/Older), operation type badge, status icon, hover preview, click-to-load, double-click-to-execute, context menu | P0 |
| 3A-3 | `useGraphqlCollections.ts`: IndexedDB-persisted collection + folder CRUD (add, update, delete, reorder, move); drag-and-drop reorder within folders; pin/unpin | P1 |
| 3A-4 | `GraphqlCollections.tsx`: folder tree (expand/collapse, inline rename, right-click context menu), item list (run/duplicate/delete), global search bar, "Save current operation" shortcut from response panel | P1 |
| 3A-5 | Export/import collections: serialize to `_exportMeta` + `collections[]` JSON format; import via file picker with validation; merge vs replace import mode | P1 |
| 3A-6 | History entry "Save to Collection" flow: prompt for collection + folder + name; pre-fills name from operation name | P1 |

#### 3B — Pre-Request / Post-Response Scripts

| # | Task | Priority |
|---|------|----------|
| 3B-1 | `preRequestScriptRunner.ts`: `new Function`-based sandbox with scope shadowing (`window`, `document`, `globalThis`, `process`, `require`, `eval` → `undefined`); async support; configurable timeout (default 5s) via `Promise.race` | P2 |
| 3B-2 | Script editor UI: Monaco in JavaScript mode (120px resizable) inside collection item detail panel; custom `rf.*` completions via `registerCompletionItemProvider`; "Test Script" dry-run button | P2 |
| 3B-3 | Script console panel: capture and display `rf.log()` / `rf.warn()` / `rf.error()` output + assertion failures + timeout errors; color-coded; clear button | P2 |
| 3B-4 | Script template library: 5 built-in templates (OAuth2 refresh, JWT decode, inject tenant, assert no errors, extract ID); insertable via dropdown in editor toolbar | P2 |
| 3B-5 | `GraphqlScriptConfig` per collection item: store `preRequest`, `postResponse`, `timeout` on `GraphqlCollectionItem`; badge indicator `[Script]` on item rows that have a script set | P2 |
| 3B-6 | Script error propagation: if `rf.assert` fails or script throws → abort request with inline error message in response panel; if post-response script fails → show as warning (non-blocking) | P2 |

#### 3C — Code Generation

| # | Task | Priority |
|---|------|----------|
| 3C-1 | `codeGenerator.ts`: AST walker producing TypeScript interface types (operation result + variables) from `DocumentNode` + `GraphqlSchemaInfo`; handles nested objects, lists, optional fields, enums | P1 |
| 3C-2 | TypeScript targets: `typescript-graphql-request` (async function), `typescript-urql` (`useQuery`/`useMutation` hook), `typescript-apollo` (`useQuery`/`useMutation` hook), `typescript-fetch` (native fetch) | P1 |
| 3C-3 | Shell + Python targets: `curl` (full `curl -X POST ...` command with header flags), `httpie` (`http POST ...` command), `python-gql` (`gql()` + `client.execute()` call) | P1 |
| 3C-4 | Code gen UI: language selector tabs (7 options), options checkboxes (include types, use `{{env}}` vars, include error handling), Monaco read-only output panel, Copy + Download buttons | P1 |
| 3C-5 | "Include TypeScript types" option: when checked, prefix the output with generated `interface` + variable type definitions | P1 |
| 3C-6 | `{{env}}` variable substitution in generated code: replace `{{varName}}` references in URL/headers with `process.env.VAR_NAME` (TypeScript) or `os.environ["VAR_NAME"]` (Python) or `$VAR_NAME` (shell) | P2 |

#### 3D — Schema Diff & Validation

| # | Task | Priority |
|---|------|----------|
| 3D-1 | `schemaSnapshot.ts`: capture `GraphqlSchemaSnapshot` (SDL + type count + timestamp + optional label); store in IndexedDB per connection (max 20, FIFO eviction); load/save/delete/list snapshots | P2 |
| 3D-2 | "Save snapshot" button in Schema Explorer toolbar + "Changelog" tab showing snapshot list (timestamp, label, type count, diff button) | P2 |
| 3D-3 | `schemaDiff.ts`: wrap `@graphql-inspector/core` `diff()` to produce `GraphqlSchemaDiffResult` with `BREAKING` / `DANGEROUS` / `SAFE` change classification | P2 |
| 3D-4 | `GraphqlSchemaDiff.tsx`: side-by-side SDL diff (red deleted / green added line highlights), change list panel with severity badges, summary counts, severity filter, "Export diff JSON" + "Download SDL" buttons | P2 |
| 3D-5 | Automatic diff toast: when `useGraphqlSchema` detects schema hash change on refresh, show toast "Schema changed — view diff?" linking to diff view against the most recent snapshot | P2 |

#### 3E — Mock Server

| # | Task | Priority |
|---|------|----------|
| 3E-1 | `src-server/routes/graphql/mock.ts`: `POST /api/graphql/mock` — execute against in-memory `mockSchema`; `POST /api/graphql/mock/config` — configure SDL + resolvers + latency; `GET /api/graphql/mock/status` | P2 |
| 3E-2 | Server-side mock execution: `@graphql-tools/mock` `addMocksToSchema()` with dynamic resolver map built from `GraphqlMockConfig`; global latency via `await delay(ms)` before `execute()` | P2 |
| 3E-3 | `useGraphqlMockServer.ts`: hook managing mock enable/disable, custom resolvers (per typeName.fieldName), latency, seed; syncs config to server via `POST /api/graphql/mock/config` | P2 |
| 3E-4 | `GraphqlMockPanel.tsx`: toggle switch in connection settings (endpoint pill turns amber with `[MOCK]` label when active); type tree with resolver dropdown per field (Random / Fixed / Script); latency slider; seed input | P2 |
| 3E-5 | Fixed resolver UI: inline JSON value input per field with type validation | P2 |
| 3E-6 | Script resolver UI: mini Monaco editor (1–3 lines) per field; evaluated as `() => value` arrow function by the server | P2 |

#### 3F — Advanced Query Features

| # | Task | Priority |
|---|------|----------|
| 3F-1 | `apqClient.ts`: SHA-256 hash via `crypto.subtle` (no extra package); query normalization via `parse` + `print`; two-step APQ flow (hash-only → retry with full query on `PERSISTED_QUERY_NOT_FOUND`) | P2 |
| 3F-2 | APQ UI: toggle in connection settings; request metadata shows `APQ: {hash}` with `[Cache miss]` / `[Cache hit]` indicator; retry is transparent to user | P2 |
| 3F-3 | Query batching: "Batch" checkbox per operation tab; `Send Batch (N)` button in connection bar when ≥2 checked; sends `[{query, variables}, ...]` to `POST /api/graphql/batch` proxy route | P2 |
| 3F-4 | Batch result UI: N stacked response cards (one per operation); "Batch of N" header with aggregate timing | P2 |
| 3F-5 | Request deduplication in `useGraphqlExecution.ts`: in-flight request `Map<hash, AbortController>`; duplicate detection shows amber `[Duplicate in flight]` badge with three-choice dropdown (Wait/Cancel/Send anyway) | P2 |
| 3F-6 | Deduplication "Wait and merge": share the single in-flight `Promise<GraphqlResponse>` with the waiting caller — both callers get the same response, 0 extra network requests | P2 |

#### 3A — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3A-7 | History max-items configuration UI: "History" tab in connection settings popover with numeric input (10–500), "Clear all history" button with confirmation; connection-level setting stored in `GraphqlConnection.historyMaxItems`; global default in app settings | P2 |

#### 3B — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3B-7 | `RfContext` + `RfResponseContext` type definitions in `src/features/graphql/types/graphql.ts`; post-response script non-blocking error handling (amber `⚠ Post-script error` indicator); script scope isolation guarantee (fresh `RfContext` per execution) | P1 |

#### 3C — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3C-7 | TypeScript enum generation: emit string literal union (`type Status = 'ACTIVE' \| 'INACTIVE'`) per enum used in the selection; nullable field handling (`field?: T \| null` vs. `field: T`); anonymous operation fallback names (`QueryResult` / `MutationResult` / `SubscriptionResult`); no-schema warning banner with `any` result type | P1 |

#### 3E — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3E-7 | Mock schema source UI: "Use introspected schema" / "Custom SDL" radio in `GraphqlMockPanel`; Monaco SDL editor for custom SDL; disable mock toggle when neither source is available; `useGraphqlMockServer.ts` sync triggers (debounced 300ms on resolver changes, on-blur for SDL, immediate on toggle) | P1 |

#### 3F — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 3F-7 | APQ non-supported server detection: if first hash-only request returns non-APQ error → fall back to full query, show `[APQ unsupported]` badge, auto-disable APQ for this connection with toast, cache detection result in `localStorage` per `connectionId`; batch individual error cards: each batched operation shows its own success/error state, `Batch: N passed / M failed` summary row | P2 |

### Phase 4 — Workflow Integration + Lessons
**Estimated scope**: ~22 files, ~3800 LOC

**New client dependencies**: none (reuses `graphql-ws`, `graphql-sse`, `graphql` from Phases 1–2)  
**New server dependencies**: none (reuses `/api/graphql/query`, `/api/graphql/introspect`, `/api/graphql/subscribe` proxy routes from Phases 1–2)

#### 4A — Node Type Definitions

| # | Task | Priority |
|---|------|----------|
| 4A-1 | Add `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert` to `WorkflowNodeType` union in `workflow.ts` | P0 |
| 4A-2 | Define shared helper types in `workflow.ts`: `GraphqlNodeHeaderRow`, `GraphqlExtractionRule`, `GraphqlOutputBinding`, `GraphqlSubscriptionOutputBinding`, `GraphqlIntrospectOutputBinding`, `GraphqlWorkflowAssertion`, `GraphqlAssertNodeData` | P0 |
| 4A-3 | Define `GraphqlQueryNodeData` interface (used for both `graphqlQuery` + `graphqlMutation`): endpoint, query, variables, headers, auth, skipTlsVerify, timeoutMs, extractionRules, outputBindings | P0 |
| 4A-4 | Define `GraphqlSubscriptionNodeData` interface: endpoint, subscriptionQuery, variables, headers, auth, subscriptionTransport, stopAfterMessages, stopAfterMs, stopCondition, extractionRules, outputBindings | P0 |
| 4A-5 | Define `GraphqlIntrospectNodeData` interface: endpoint, headers, auth, skipTlsVerify, minTypeCount, requiredTypes, requiredFields, outputBindings | P1 |
| 4A-6 | Define `GraphqlAssertNodeData` interface: sourceVariable, assertions (`GraphqlWorkflowAssertion[]`), failBehavior | P1 |
| 4A-7 | Append all five new node types to `WorkflowNodeData` union type in `workflow.ts` | P0 |

#### 4B — Graph Runner Execution Logic

| # | Task | Priority |
|---|------|----------|
| 4B-1 | Implement `graphqlQuery` + `graphqlMutation` branch in `graphRunner.ts`: resolve `{{var}}` in endpoint/variables/headers, POST to `/api/graphql/query`, apply extraction rules via `jsonpath-plus`, bind outputs; surface GraphQL `errors` array as node error | P0 |
| 4B-2 | Implement `buildGraphqlHeaders(rows, auth, env)` shared helper in `graphRunner.ts` — merges enabled header rows with resolved `{{var}}` values + auth headers from `buildAuthHeaders()` | P0 |
| 4B-3 | Implement `graphqlSubscription` branch: derive WS endpoint via `deriveWsEndpoint()`, create `graphql-ws` (or SSE) client, subscribe, collect messages until first stop condition (count / ms / JSONPath condition) is met; expose `messages[]`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` via output bindings | P1 |
| 4B-4 | Implement `graphqlIntrospect` branch: POST introspection to `/api/graphql/introspect`; use `buildClientSchema` + `printSchema` from `graphql` package; validate `minTypeCount`, `requiredTypes`, `requiredFields`; SHA-256 hash SDL; bind `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` outputs | P1 |
| 4B-5 | Implement `graphqlAssert` branch: resolve `sourceVariable` from workflow vars; apply each `GraphqlWorkflowAssertion` using `jsonpath-plus` + `evaluateAssertionOp`; collect failures; halt or warn based on `failBehavior`; log failure details to run trace | P1 |
| 4B-6 | Implement `applyGraphqlOutputBindings(bindings, values, vars)` helper — mirrors existing `applyOutputBindings` pattern but for GraphQL field names | P0 |
| 4B-7 | Unit tests for all five execution branches: `graphRunner.graphqlQuery.test.ts`, `graphRunner.graphqlSubscription.test.ts`, `graphRunner.graphqlAssert.test.ts` — mock `httpFetch`, `graphql-ws` client, `buildClientSchema` | P1 |

#### 4C — Node Configuration Panel UI

| # | Task | Priority |
|---|------|----------|
| 4C-1 | `GraphqlQueryConfigPanel.tsx` — 6-tab panel (Operation, Variables, Headers, Auth, Extraction, Output); Monaco GraphQL editor in Operation tab with height 200px; "Import from Collections" button opens collection picker modal | P0 |
| 4C-2 | Mutation node uses `GraphqlQueryConfigPanel.tsx` with `nodeType="graphqlMutation"` prop — no separate file created; the `nodeType` prop changes the default query template to `mutation { }` and the amber color accent. This is NOT a new file — update the existing `GraphqlQueryConfigPanel.tsx` to accept and handle `nodeType`. | P0 |
| 4C-3 | `GraphqlSubscriptionConfigPanel.tsx` — 5-tab panel (Subscription, Stop Conditions, Headers & Auth, Extraction, Output); Stop Conditions tab: radio (N messages / N seconds / JSONPath condition); transport dropdown | P1 |
| 4C-4 | `GraphqlIntrospectConfigPanel.tsx` — 3-tab panel (Endpoint, Schema Validation, Output); Schema Validation tab: min type count input, required types tag input, required fields `TypeName.fieldName` chips | P1 |
| 4C-5 | `GraphqlAssertConfigPanel.tsx` — 3-tab panel (Source, Assertions, Behavior); Source tab: variable picker dropdown populated from upstream node output bindings via `workflowVariableHints`; Assertions tab: editable table with JSONPath + operator + expected + description + "Run test" button | P1 |
| 4C-6 | Add all five config panel components to the workflow designer's node properties panel switch statement | P0 |
| 4C-7 | Add `data-testid` attributes to all interactive elements in config panels (using `GQL.*` constants from `selectors.ts`) | P1 |

#### 4D — Output Bindings and Variable Chain

| # | Task | Priority |
|---|------|----------|
| 4D-1 | Add `graphqlQuery`/`graphqlMutation` branch to `workflowVariableHints.ts`: expose `data`, `errors`, `latencyMs`, `httpStatus` + named extraction rule variables; source category `'GraphQL Steps'` | P0 |
| 4D-2 | Add `graphqlSubscription` branch to `workflowVariableHints.ts`: expose `messages`, `messageCount`, `firstMessage`, `lastMessage`, `latencyMs` | P1 |
| 4D-3 | Add `graphqlIntrospect` branch to `workflowVariableHints.ts`: expose `sdl`, `typeCount`, `fieldCount`, `schemaHash`, `queryTypeName` | P1 |
| 4D-4 | Add `graphqlAssert` node to `countWorkflowDesignerVariables.ts` (count extraction rules toward variable total) | P1 |
| 4D-5 | Add factory cases for all 5 node types in `workflowNodeFactory.ts`: `nodeTypes` map + `createWorkflowNode` switch; default `GraphqlQueryNodeData` with `query: 'query {
  
}'`, empty arrays; `GraphqlSubscriptionNodeData` default with `stopAfterMessages: 10`; assign distinct canvas colors (purple for query, amber for mutation, teal for subscription, blue for introspect, green for assert) | P0 |
| 4D-6 | Canvas node card renderer: Q/M/S/I/A badge icons for each graphql node type; show endpoint host (truncated); show last-run status badge and latency | P1 |

#### 4E — Demo Lessons

| # | Task | Priority |
|---|------|----------|
| 4E-1 | Create `src/features/demo-player/lessons/protocols/graphql-lessons.ts` — lesson registry file with all 12 lesson definitions | P1 |
| 4E-2 | Register `graphql` category in `protocolsDomain` lesson catalog (alongside `websocket`, `sse`) | P1 |
| 4E-3 | Lesson 1 "Your First GraphQL Query" (7 steps): endpoint input → introspect → observe schema → write query → execute → read response → save to history | P1 |
| 4E-4 | Lesson 2 "Variables & Arguments" (8 steps): write parameterized query → open Variables panel → fill `$id` var → execute with value A → re-run with value B → compare results | P1 |
| 4E-5 | Lesson 3 "Mutations" (9 steps): write `mutation` → input type fields → execute create → observe response → execute update → execute delete → show idempotency | P1 |
| 4E-6 | Lesson 4 "Schema Exploration" (7 steps): open Schema Explorer → browse types → search for field → read documentation → click-to-insert → SDL view → export SDL | P1 |
| 4E-7 | Lesson 5 "Subscriptions" (10 steps): write subscription → click Subscribe → observe live messages → pause → use filter → resume → view assertion panel → disconnect | P1 |
| 4E-8 | Lessons 6–9 (Auth, Query Builder, Collections, Code Gen) — 4 lesson files, 6–9 steps each | P2 |
| 4E-9 | Lessons 10–12 (Performance Tracing, Workflow Integration, Schema Diff) — 3 lesson files, 7–8 steps each | P2 |
| 4E-10 | Add `GQL.*` selector constants to `src/shared/selectors.ts` — full namespace covering all lesson-interactive elements | P1 |
| 4E-11 | Unit tests for all 12 lesson files (`graphql-lessons.test.ts`): step count, IDs, `estimatedMinutes`, `preAction` guards for stateful steps | P1 |

#### 4F — Gallery Templates and E2E

| # | Task | Priority |
|---|------|----------|
| 4F-1 | Gallery template `graphql-health-check`: Start → graphqlIntrospect → graphqlQuery → graphqlAssert (latency < 500ms) → End; registered in `emptyCanvasTemplates.ts` | P2 |
| 4F-2 | Gallery template `graphql-e-commerce-flow`: Start → graphqlMutation (create order) → graphqlSubscription (collect until `COMPLETE`) → graphqlAssert → End | P2 |
| 4F-3 | Gallery template `graphql-schema-watchdog`: Schedule → graphqlIntrospect → condition (hash changed?) → logDebug → End | P2 |
| 4F-4 | Gallery template `graphql-user-crud`: Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify) → graphqlMutation (delete) → End | P2 |
| 4F-5 | E2E test `e2e/graphql-query-execution.spec.ts`: query executes against local Docker test server; variables interpolated; response rendered; GraphQL errors surface correctly | P1 |
| 4F-6 | E2E test `e2e/graphql-workflow-nodes.spec.ts`: health-check workflow runs end-to-end; `graphqlAssert` fails correctly when latency threshold exceeded; all variable bindings resolved | P1 |
| 4F-7 | E2E test `e2e/graphql-lessons.spec.ts`: first 3 lessons complete auto-play without errors (smoke test) | P2 |
| 4F-8 | Test scenario file `docs/plan/graphql-workflow-nodes-test-scenarios.md`: manual test scenarios for all 5 node types with exact click-by-click steps and expected results | P1 |
| 4F-9 | E2E test `e2e/graphql-schema-diff.spec.ts`: save snapshot, re-introspect with modified schema, diff toast shown, BREAKING badge count correct, "Export diff JSON" downloads | P2 |
| 4F-10 | E2E test `e2e/graphql-mock-server.spec.ts`: mock mode ON, query returns data, fixed resolver returns configured value, latency slider adds delay, mock mode OFF restores real endpoint | P2 |
| 4F-11 | `e2e/docker-compose.yml` + `e2e/global-setup.ts`: Docker Compose definition for `graphql-test-server` (Apollo Server 4 on port 4010 with tracing + APQ); `globalSetup` starts and awaits health check before tests | P1 |

#### 4B / 4C — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4B-8 | Add `JSON.parse` try-catch for variables in `graphqlQuery`, `graphqlMutation`, `graphqlSubscription` branches — return `{ status: 'error', message: '...' }` on parse failure rather than throwing | P0 |
| 4B-9 | Add abort-before-start guard in `graphqlSubscription` branch: check `ctx.abortSignal?.aborted` before creating the WS client; return early if already aborted | P1 |
| 4C-8 | Config panel validation: endpoint non-empty, query non-empty, valid JSON in Variables tab, valid identifiers in extraction/output variable names; tab headers show red dot on validation error | P1 |

#### 4D — Additional Tasks

| # | Task | Priority |
|---|------|----------|
| 4D-7 | `countWorkflowDesignerVariables.ts`: add cases for all 5 GraphQL node types per the spec (5 standard + `extractionRules.length` for query/mutation; 5 for subscription; 5 for introspect; 0 for assert) | P1 |

---

## 6. Dependencies (npm packages)

### Required (Phase 1)
```json
{
  "graphql": "^16.x",
  "monaco-graphql": "^1.x",
  "graphql-language-service": "^5.x"
}
```
**Note**: `@monaco-editor/react` (v4.7.0) is already installed. `monaco-graphql` adds GraphQL language support to the existing Monaco instance.

### Phase 2
```json
{
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "graphql-sse": "^2.x",
  "meros": "^1.x",
  "extract-files": "^13.x"
}
```
**Notes**:
- `subscriptions-transport-ws` is the deprecated Apollo legacy package needed for backward-compat with Apollo Server ≤v3. It uses the WebSocket subprotocol `graphql-ws` (note the naming swap — the modern `graphql-ws` npm package uses subprotocol `graphql-transport-ws`).
- `graphql-sse` implements the GraphQL over SSE transport spec (by the same author as `graphql-ws`). Required for 2B SSE subscriptions. The server must also use `graphql-sse` server-side.
- `meros` streams and splits `multipart/mixed` HTTP responses — required for `@defer`/`@stream` support (2D).
- `extract-files` extracts `File` / `Blob` objects from GraphQL variables for the file upload multipart spec (2E).

### Phase 3
```json
{
  "@graphql-tools/mock": "^9.x",
  "@graphql-tools/schema": "^10.x",
  "@graphql-tools/utils": "^10.x",
  "@graphql-inspector/core": "^5.x"
}
```
**Notes**:
- `@graphql-tools/mock` generates realistic fake resolvers from a schema — powers the mock server (3E).
- `@graphql-tools/schema` builds executable schemas from SDL + resolvers — required by the mock server.
- `@graphql-tools/utils` provides schema utilities (merging, pruning, filtering) used throughout Phase 3.
- `@graphql-inspector/core` is the industry-standard GraphQL diff library (used by Hive, GitHub's GraphQL, Hasura) — required for schema diff + breaking change detection (3D).

### Server-side (src-server) — all phases
```json
{
  "graphql": "^16.x",
  "graphql-ws": "^6.x",
  "subscriptions-transport-ws": "^0.11.x",
  "ws": "^8.x",
  "busboy": "^1.x"
}
```
**Note**: `ws` is already installed for WebSocket proxy. `busboy` handles multipart file upload parsing. `subscriptions-transport-ws` is needed server-side to proxy legacy Apollo subscription connections to upstream servers.

---

## 7. Registration Checklist

Following the established protocol pattern (WebSocket/Kafka/SSE):

- [ ] `src/features/graphql/` — Feature directory with page + components + hooks
- [ ] `src/shared/types/graphql.ts` — Shared TypeScript types
- [ ] `GraphqlStudioPage.tsx` — Main page component
- [ ] Register tab `'graphql'` in `src/app/utils/appTabUtils.ts`
- [ ] Render in `App.tsx` conditional on tab
- [ ] `src-server/routes/graphql/` — Proxy server routes
- [ ] `src/features/graphql/utils/graphqlClient.ts` — Frontend transport client (HTTP + WebSocket)
- [ ] `src/shared/selectors.ts` — Add `GRAPHQL = { ... }` test selectors
- [ ] Workflow nodes: `graphqlQuery`, `graphqlMutation`, `graphqlSubscription`, `graphqlIntrospect`, `graphqlAssert`
- [ ] Node config components with `InsertVarField` + `variableHints`
- [ ] Demo lessons registered in `src/features/demo-player/lessons/index.ts`
- [ ] Storage persistence via existing localStorage/IndexedDB patterns
- [ ] E2E test selectors + Playwright tests

---

## 8. Competitive Differentiation

What makes RedfireForge's GraphQL Studio unique vs. standalone tools:

| Feature | Postman | Apollo Studio | GraphiQL | Altair | **RedfireForge** |
|---------|---------|--------------|----------|--------|-----------------|
| Integrated test runner | ✅ | ❌ | ❌ | ❌ | ✅ (workflow engine + SLA) |
| Multi-protocol in one app | ✅ | ❌ | ❌ | ❌ | ✅ (WS+Kafka+SSE+GraphQL) |
| Workflow automation | ✅ (Flows) | ❌ | ❌ | ❌ | ✅ (DAG workflows) |
| SLA evaluation on responses | ❌ | ❌ | ❌ | ❌ | ✅ |
| Desktop native | ❌ | ❌ | ❌ | ✅ (Electron 200MB+) | ✅ (Tauri ~15MB) |
| Demo/Training system | ❌ | ❌ | ❌ | ❌ | ✅ (interactive lessons) |
| Schema diff + breaking changes | ✅ (paid) | ✅ (paid) | ❌ | ❌ | ✅ (built-in free) |
| `@defer`/`@stream` support | ❌ | ✅ | Partial | ❌ | ✅ |
| Pre-request scripts | ✅ | ✅ (scripting) | ❌ | ✅ | ✅ |
| File upload (multipart) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Cross-protocol workflows | ❌ | ❌ | ❌ | ❌ | ✅ (GraphQL→Kafka→WS in one flow) |
| Open source | ❌ | ❌ | ✅ | ✅ | ✅ |
| Free (no account required) | ❌ (free tier) | ❌ (account) | ✅ | ✅ | ✅ |

**Unique value proposition**: The only tool that lets you build **cross-protocol automated test workflows** combining GraphQL + WebSocket + Kafka + SSE nodes with SLA evaluation — all in a lightweight native desktop app with interactive training.

---

## 9. Design Decisions

### Editor Choice: Monaco with `monaco-graphql`
- **Why**: Project already uses `@monaco-editor/react` (v4.7.0) — zero new editor dependency
- **`monaco-graphql`** provides: syntax highlighting, autocomplete, validation, hover docs, jump-to-definition
- **Schema binding**: Feed introspected schema into `monaco-graphql` worker for live validation
- **Alternative considered**: CodeMirror 6 + `cm6-graphql` (used by GraphiQL) — rejected because it adds a second editor library to the bundle
- **Multi-model**: Each operation tab gets its own Monaco model (same pattern as multi-file editors)

### Subscription Protocol: `graphql-ws` primary
- **Why**: Modern spec-compliant protocol, maintained by The Guild
- **npm package**: `graphql-ws` (the npm package name) uses the WebSocket subprotocol **`graphql-transport-ws`**
- **Legacy**: `subscriptions-transport-ws` (the npm package) uses the WebSocket subprotocol **`graphql-ws`** — this naming is intentionally confusing; the package and subprotocol names are swapped between the two generations
- **Detection algorithm**: Attempt WebSocket handshake advertising subprotocol `graphql-transport-ws` (modern). If server closes with `4406` (subprotocol not acceptable) or `4400` (bad request), retry advertising subprotocol `graphql-ws` (legacy `subscriptions-transport-ws`). Close code `1000` (normal closure) is ambiguous and must not trigger a retry.
- **SSE fallback**: If server responds to HTTP POST with `Content-Type: text/event-stream`, switch to SSE transport

### Proxy vs Direct
- **Decision**: Always proxy through `src-server` (port 3001) by default
- **Why**: CORS bypass, TLS handling, protocol normalization, file upload relay, Tauri compatibility
- **Direct mode**: Optional toggle for local development when CORS isn't an issue
- **Tauri**: Uses same IPC proxy pattern as WebSocket/Kafka (`invoke('graphql_query', {...})`)

### Incremental Delivery (`@defer`/`@stream`)
- **Decision**: Support from Phase 2
- **Why**: Increasingly adopted (Apollo Router, Yoga, Hive Gateway all support it)
- **Implementation**: Parse `multipart/mixed` response with boundary splitting; progressively merge into response JSON
- **UX**: Show partial response immediately with loading indicators on deferred fields

### State Management
- **Decision**: Custom hook (`useGraphqlState`) with localStorage persistence
- **Why**: Matches existing pattern (`useWebsocketState`, `useKafkaState`)
- **No Redux/Zustand**: Keep consistent with other protocol studios
- **Persistence**: Active operation tabs + environments + recent endpoints saved to localStorage

### File Upload
- **Decision**: Follow `graphql-multipart-request-spec` (used by Apollo, Yoga, Altair)
- **Implementation**: Client constructs FormData with operations + file map; proxy relays to target
- **UX**: Files selected via drag-drop or file picker in Variables panel

---

## 10. Success Criteria

### Phase 1 (MVP)
- [ ] Execute a GraphQL query against any public endpoint (e.g., GitHub API, SpaceX API) — receives `data` in Response panel
- [ ] Execute a mutation — response includes the created/updated resource
- [ ] Introspect schema and browse types/fields/arguments in Schema Explorer
- [ ] Autocomplete in the editor suggests fields, arguments, and types from the introspected schema
- [ ] Inline error diagnostics shown for invalid queries (syntax errors, unknown fields) before execution (client-side `graphql.validate()`)
- [ ] GraphQL errors (`errors[]` in 200 response) highlighted in editor with location markers at the correct line/column
- [ ] Partial response (data + errors simultaneously) shows both in the Response panel
- [ ] HTTP-level errors (401, 403, 5xx, CORS) show the correct error banner from Section 12.1
- [ ] Multi-tab: open 3 separate operations, switch between them without losing content; tab label shows operation name from AST
- [ ] `⌘Enter` (or `Ctrl+Enter`) executes the current operation; Escape cancels it
- [ ] Click-to-insert inserts the field name at the current editor cursor position
- [ ] Schema search finds types and fields by name in <100ms for a 500-type schema
- [ ] Environment variable `{{token}}` set in an environment resolves in the Authorization header; unresolved `{{unknownVar}}` shows `!` warning icon on the header row
- [ ] Connection profile saved, page reloaded — profile loads correctly with endpoint + auth; profile list is sorted by most-recently-used
- [ ] Operations (query text, variables) persist across page reloads
- [ ] Schema polling: schema automatically re-fetched after the configured interval (verify by changing the upstream schema)
- [ ] Invalid JSON in Variables panel: Execute button is disabled and "Invalid JSON" error shown on the Variables panel
- [ ] Auth popover: setting Bearer token → Authorization header appears in outgoing request; switching to API Key type → custom header name/value appear in request
- [ ] Server with introspection disabled: yellow "Introspection disabled" banner shown; editor still usable for manual operations
- [ ] Pre-execution `graphql.validate()`: querying a field that doesn't exist on the schema shows a Monaco squiggle immediately (before execution) with `⚠ 1 error` badge on Execute button

### Phase 2
- [ ] WebSocket subscription (modern `graphql-transport-ws`) connects, receives live `next` messages, and displays them in the subscription log
- [ ] Legacy Apollo subscription server (`graphql-ws` subprotocol) is auto-detected via close code `4406`/`4400` and reconnected successfully with `subscriptions-transport-ws`
- [ ] SSE subscription connects (via `graphql-sse`) and receives data in the same subscription log UI as WS
- [ ] Auto-reconnect triggers on unexpected WebSocket disconnect; exponential backoff countdown visible; recovers within the backoff window (≤30s)
- [ ] Authenticated WebSocket subscription: Bearer token from connection auth flows through `connection_init_payload` (`connectionParams`); subscription data reflects authorized user; `4401` close code → permanent error state (no retry)
- [ ] `subscriptionTransport` manual override: selecting "SSE" in connection settings routes the subscription through the SSE proxy instead of WebSocket; selecting "WebSocket (legacy)" forces `graphql-ws` subprotocol
- [ ] `@defer` / `@stream` partial responses render incrementally — deferred fields show skeleton placeholder then fill in on patch arrival; chunk tracker shows `All N chunks received (Xms total)`
- [ ] Combining `@defer` and file upload in the same operation triggers a pre-execution validation error ("cannot combine")
- [ ] File upload mutation executes end-to-end: file selected in Files tab → multipart POST → proxy relays without buffering → server confirms
- [ ] Upload progress indicator fills correctly as the proxy reports bytes transferred
- [ ] Visual query builder generates syntactically valid GraphQL SDL from point-and-click field selection (verified by `graphql.parse()` without throwing)
- [ ] Union/Interface field in query builder: expanding a Union type shows concrete type groups; selecting a field under a concrete type generates correct `... on TypeName { fieldName }` inline fragment in SDL
- [ ] Two-step schema search finds any field by name across all types and auto-expands the tree to its root path
- [ ] Fragment created in builder is correctly inlined in generated SDL as spread + definition; unused fragments show amber warning
- [ ] Subscription log JSONPath assertion `$.data.order.status == "SHIPPED"` correctly hides messages where status is not "SHIPPED"; pass/fail badges update live per message
- [ ] Apollo Tracing waterfall renders when `extensions.tracing` is present; resolver bars are color-coded by duration; sort-by-duration shows slowest resolver first
- [ ] Query complexity badge appears before execution with correct color; a deeply nested query (depth > `maxDepth`) shows red badge; a query costing > 2× threshold shows a confirmation dialog
- [ ] SSE subscription reconnects after a simulated network drop: `Last-Event-ID` is forwarded; no messages are skipped after reconnect; `reconnecting` state is shown in the status pill
- [ ] File exceeding `maxFileSize` (e.g. 51 MB against a 50 MB limit) is rejected immediately at selection time with an inline error; the Execute button stays disabled until the oversized file is removed
- [ ] Query builder state persists across page reload: complex selection (3+ fields with arguments) is restored in the builder after refresh; generated SDL matches pre-reload state
- [ ] A query containing `@defer` automatically triggers multipart response handling; deferred fields show skeleton then fill in; a query without `@defer` does NOT send `Accept: multipart/mixed`

### Phase 3
- [ ] Operation history auto-saves every execution and displays in recency groups (Today / Yesterday / Last 7 days)
- [ ] History entry loads into the editor with one click; double-click loads and immediately executes
- [ ] Collections are organized in folders with drag-and-drop reorder and persist across reloads
- [ ] "Save to Collection" flow from response panel saves operation with correct folder and name
- [ ] Collections export to JSON file; imported file restores all folders and items correctly
- [ ] Import with "Merge" mode keeps existing collections and inserts new items; import with "Replace" mode deletes existing collections first
- [ ] Pre-request script runs before execution — `rf.setHeader` value appears in the outgoing request
- [ ] `rf.assert(false)` in pre-request script blocks the request and shows error in script console
- [ ] Post-response script failure is non-blocking: response is displayed and an amber `⚠ Post-script error` indicator appears on the item row
- [ ] Code generator produces runnable TypeScript (`typescript-graphql-request`), Python (`python-gql`), and cURL snippets for any introspected operation
- [ ] "Include TypeScript types" option prepends correct interface definitions for the selected fields; nullable fields use `?: T | null`; enum fields use string literal union types
- [ ] Code gen with no schema introspected: output uses `any` result type; warning banner "Schema not introspected" is shown
- [ ] Schema snapshot saved and diff computed correctly: `@graphql-inspector/core` reports `BREAKING` for a removed field
- [ ] Snapshot-vs-snapshot comparison: selecting two historical snapshots in the Changelog tab computes and displays their diff correctly
- [ ] Mock server active — simple query returns mock data when pointed at `localhost:3001/api/graphql/mock`; "Use introspected schema" mode loads the active connection's SDL automatically
- [ ] Fixed mock resolver returns the configured value; latency slider adds correct delay
- [ ] APQ enabled — first request is a cache miss; identical second request shows `[Cache hit]` and is hash-only
- [ ] APQ with unsupported server: client falls back to full query, shows `[APQ unsupported]` badge, auto-disables APQ for this connection
- [ ] Batch of 2 operations returns 2 result cards with correct data each; if one fails its card shows an error state while the other shows success

### Phase 4
- [ ] `graphqlQuery` workflow node: executes a query against the proxy, resolves `{{var}}` in endpoint/variables/headers, returns `data` + `latencyMs` in output bindings accessible as `{{nodeLabel.data.fieldName}}` in downstream nodes
- [ ] `graphqlMutation` workflow node: executes a mutation identically to `graphqlQuery`; canvas card shows amber M badge
- [ ] GraphQL errors in query/mutation node: when response contains a `errors[]` array, node enters error state and the run timeline shows the GraphQL error message (not just HTTP error)
- [ ] JSONPath extraction rule in query node: `$.user.id` correctly extracts the nested value and stores it in the named variable; downstream `graphqlQuery` node uses that variable in its variables JSON
- [ ] `graphqlSubscription` workflow node: connects via WebSocket (`graphql-transport-ws`), collects messages until `stopAfterMessages` is reached, exposes `messages[]` and `messageCount` as output bindings
- [ ] `graphqlSubscription` stop condition: `stopCondition` JSONPath expression stops collection when first matching message is received
- [ ] `graphqlIntrospect` workflow node: fetches schema, outputs `typeCount` and `schemaHash`; `requiredTypes` validation fails the node correctly when a specified type is absent; `timeoutMs` is respected (node errors on timeout)
- [ ] `graphqlAssert` workflow node: evaluates JSONPath assertions against an upstream variable; assertion failure with `failBehavior: 'error'` halts the workflow and shows failure detail; `failBehavior: 'warn'` continues with warning badge
- [ ] `graphqlAssert` `gte`/`lte` operators work correctly: `latencyMs gte 0` passes; `latencyMs lt 1` fails when actual latency > 1ms
- [ ] Invalid JSON in `graphqlQuery` variables: node enters error state with "Invalid JSON in variables" message rather than crashing the workflow
- [ ] `graphqlSubscription` already-aborted abort signal: node returns error immediately without opening WebSocket connection
- [ ] "Import from Collections" in `GraphqlQueryConfigPanel`: operation saved in Phase 3 collections can be loaded into a workflow node without re-typing; empty-state is shown when no collections exist
- [ ] `'GraphQL Steps'` variable category appears in the variable picker of downstream nodes, showing `data`, `errors`, `latencyMs` from prior graphql nodes
- [ ] `countWorkflowDesignerVariables` counts GraphQL nodes correctly: query node with 2 extraction rules contributes 7 variables (5 standard + 2 extraction)
- [ ] Health-check gallery template loads from empty canvas gallery; variable wiring is pre-configured (`{{sentinelLatency}}` flows to assert node); runs end-to-end against local Docker test server
- [ ] E-commerce gallery template: mutation extraction rule wires `orderId` to subscription variables; subscription stops on `COMPLETE` condition; assert verifies final status
- [ ] Demo lesson 1 "Your First GraphQL Query" completes in auto-play mode: all 7 steps execute with visible ripple animations and correct narration
- [ ] Demo lessons 1–5 are navigable: Restart → play through each step → preAction guards recover state correctly on forward-skip
- [ ] Demo lessons 6–12 are playable: each lesson's steps are navigable, narration is visible, and key interactions complete without error

### Performance
- [ ] Schema introspection < 2s for schemas with ≤500 types
- [ ] Query execution overhead < 100ms (proxy round-trip only)
- [ ] Monaco editor loads within 500ms (lazy-loaded GraphQL worker)

---

## 11. Public GraphQL APIs for Testing

| API | Endpoint | Auth | Features | Subscriptions |
|-----|----------|------|----------|---------------|
| Countries | `https://countries.trevorblades.com/graphql` | None | Simple schema, continents/countries/languages | ❌ |
| Rick and Morty | `https://rickandmortyapi.com/graphql` | None | Characters/episodes/locations, pagination | ❌ |
| Star Wars (SWAPI) | `https://swapi-graphql.netlify.app/.netlify/functions/index` | None | Classic demo API, films/people/planets | ❌ |
| GitHub GraphQL | `https://api.github.com/graphql` | Bearer token | Rich schema, mutations, real data | ❌ |
| SpaceX (unofficial) | `https://spacex-production.up.railway.app/graphql` | None | Launches/rockets/missions | ❌ |
| GraphQL Pokémon | `https://graphql-pokemon2.vercel.app/` | None | Simple, no auth | ❌ |
| Hasura Cloud (demo) | Varies | None | Real-time subscriptions, CRUD mutations | ✅ |
| GraphQL WS Demo | Self-hosted (Docker) | None | Subscriptions via `graphql-ws` | ✅ |

### 11.1 Local Test Server (Docker)

For development and E2E testing, the project ships a local GraphQL test server defined in `e2e/docker-compose.yml` (detailed fully in Section 3.4 4F). Summary:

```yaml
# e2e/docker-compose.yml  (authoritative — see Section 3.4 4F for full spec)
services:
  graphql-test-server:
    image: node:22-alpine
    ports:
      - "4010:4010"    # http://localhost:4010/graphql + ws://localhost:4010/graphql
    command: npx tsx /app/server.ts
```

The pre-test setup hook (`e2e/global-setup.ts`) starts the server and waits for `GET http://localhost:4010/health → 200` before Playwright begins.

Features of the test server:
- **Queries**: `user(id: ID!): User`
- **Mutations**: `createUser`, `updateUser`, `deleteUser`, `createOrder(input: OrderInput!): Order`
- **Subscriptions**: `orderStatus(orderId: ID!): OrderStatus`
- **File upload**: `uploadAvatar(file: Upload!)`
- **`@defer`/`@stream`**: Supports incremental delivery
- **Apollo Tracing**: Returns resolver timing (`extensions.tracing`) for Lesson 10 E2E
- **APQ**: Enabled (for Phase 3 APQ E2E tests)
- **Latency simulation**: Configurable delays per resolver via query param `?latency=N`

---

## 12. Error Handling UX

GraphQL has two error layers — HTTP-level errors and GraphQL-level errors inside a 200 response — both must be handled visibly.

### 12.1 HTTP-Level Errors

| Scenario | Display |
|----------|---------|
| Network unreachable | Red banner: "Cannot connect to endpoint — check URL and network" |
| 401 Unauthorized | Red banner: "Authentication failed — token missing or expired. Update in connection settings." |
| 403 Forbidden | Red banner: "Access denied — token is valid but lacks required permissions for this operation." |
| 5xx server error | Red banner + raw response body shown in Response panel |
| CORS blocked (direct mode) | Yellow banner: "CORS blocked — switch to Proxy mode or enable CORS on server" |
| TLS/cert error | Red banner with option to "Skip TLS verification" (toggle in connection settings) |

### 12.2 GraphQL-Level Errors (200 with `errors` array)

- **Error icon** in Response panel header (⚠ instead of ✓)
- **Errors tab** appears automatically when `errors` array is non-empty
- **Error location markers** — if `locations` is present, highlight the corresponding line(s) in the Monaco editor using error squiggles
- **Path highlighting** — if `path` is present, show which field in the response tree caused the error
- **`extensions.code` display** — show error codes like `UNAUTHENTICATED`, `NOT_FOUND`, `RATE_LIMITED` prominently
- **Partial data** — still display `data` even alongside errors (GraphQL allows partial success)

### 12.3 Subscription Errors

- **Connection close codes** — display WebSocket close code + reason in the message log (e.g., `4400 Bad Request`)
- **`next` payload errors** — surface `errors` array within subscription messages (same treatment as query errors)
- **Auto-reconnect failed** — show retry count and "Give up" option after 5 failed attempts
- **Protocol mismatch** — if server rejects `graphql-transport-ws`, show a "Try legacy protocol?" prompt

---

## 13. Environment Variable Management

### 13.1 Environment Structure

See `GraphqlEnvironment` in Section 4.3 Shared Types for the full interface definition.

### 13.2 Variable Resolution Order

Variables are resolved in this precedence order (highest wins):

1. **Operation-level variables** (set in Variables panel — raw JSON, not `{{var}}` syntax)
2. **Per-tab overrides** (not persisted — scratch values set in the Environments tab of a session)
3. **Active environment variables** (persisted per named environment)
4. **Global defaults** (e.g. `{{baseUrl}}` from connection profile)

### 13.3 `{{var}}` Interpolation Scope

The `{{var}}` syntax is supported in:
- **Endpoint URL** field (e.g. `{{baseUrl}}/graphql`)
- **Headers** values (e.g. `Authorization: Bearer {{accessToken}}`)
- **Variable values** in the Variables JSON panel (e.g. `"userId": "{{currentUserId}}"`)
- **Pre-request scripts** via `rf.getEnv('varName')`

It is **not** applied to the query/operation text itself — GraphQL variables serve that purpose.

### 13.4 UI: Environment Manager

- Accessible from a dropdown badge in the connection bar (e.g. `[Staging]`)
- Environment editor modal: list of named environments on the left, key-value table on the right
- Masked values: toggle visibility per variable (for secrets like tokens)
- Import/export environments as JSON (compatible with Postman environment format)
- Quick-switch between environments without losing the current operation

---

## 14. Pre-Request Script API Reference

Pre-request scripts run in a sandboxed context before each operation execution. The `rf` (RedfireForge) helper object is the scripting API.

### 14.1 Available API

```typescript
// Environment variable access
rf.getEnv(key: string): string | undefined
rf.setEnv(key: string, value: string): void

// HTTP utilities (for fetching tokens, etc.)
await rf.fetch(url: string, options?: RequestInit): Response

// Logging (visible in the script console below the editor)
rf.log(...args: unknown[]): void
rf.warn(...args: unknown[]): void
rf.error(...args: unknown[]): void

// Assertions (fail fast if preconditions aren't met)
rf.assert(condition: boolean, message?: string): void

// Request mutation (headers only — query is immutable)
rf.setHeader(name: string, value: string): void
rf.removeHeader(name: string): void

// Operation metadata (read-only)
rf.operation.name: string | undefined  // current operation name (undefined for anonymous operations)
rf.operation.type: 'query' | 'mutation' | 'subscription'
rf.operation.variables: object         // parsed variables object (read-only)
```

### 14.2 Common Patterns

```javascript
// Pattern 1: Refresh OAuth token before request
const stored = rf.getEnv('accessToken');
const expiry = parseInt(rf.getEnv('tokenExpiry') || '0');
if (Date.now() > expiry) {
  const resp = await rf.fetch('{{authUrl}}/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: rf.getEnv('clientId') ?? '',
      client_secret: rf.getEnv('clientSecret') ?? '',
    }),
  });
  const data = await resp.json();
  rf.setEnv('accessToken', data.access_token);
  rf.setEnv('tokenExpiry', String(Date.now() + data.expires_in * 1000));
}
rf.setHeader('Authorization', `Bearer ${rf.getEnv('accessToken')}`);

// Pattern 2: Inject per-tenant header
rf.setHeader('X-Tenant-ID', rf.getEnv('tenantId'));

// Pattern 3: Assert precondition
rf.assert(!!rf.getEnv('userId'), 'userId environment variable must be set');
```

### 14.3 Post-Response Script API

Post-response scripts run after the response is received:

```typescript
// Response access
rf.response.httpStatus: number
rf.response.data: unknown        // parsed JSON data (from `data` field)
rf.response.errors: GraphqlError[] | undefined
rf.response.latencyMs: number
rf.response.headers: Record<string, string>

// Chaining — extract values into env vars for subsequent operations
// Note: rf.response.data is typed as unknown; cast to access fields safely
rf.setEnv('createdUserId', (rf.response.data as any).createUser.id);

// Assertions
rf.assert(rf.response.errors === undefined, 'Expected no GraphQL errors');
rf.assert(rf.response.latencyMs < 500, 'Response took too long');
```

---

## 15. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ Enter` / `Ctrl Enter` | Execute operation |
| `⌘ K` | Focus schema search (schema explorer) — note: `⌘K` is Monaco's chord prefix; only intercept when editor is **not** focused |
| `⌘ Shift F` | Format / prettify operation |
| `⌘ /` | Toggle line comment |
| `⌘ Shift I` | Trigger schema introspection |
| `⌘ T` | New operation tab — note: conflicts with "new browser tab" in web (non-Tauri) mode; Tauri intercepts it correctly |
| `⌘ W` | Close current tab |
| `⌘ ]` / `⌘ [` | Next / previous tab |
| `⌘ B` | Toggle schema explorer sidebar |
| `F1` | Monaco command palette |
| `⌘ Shift C` | Open code generator |
| `⌘ Shift H` | Open operation history |
| `⌘ L` | Clear response |
| `Escape` | Cancel in-progress execution |
| `⌘ Z` / `⌘ Shift Z` | Undo / redo in editor |

---

## 16. Mockup Reference

The `mockups/` directory contains seven HTML mockups illustrating key screens:

| File | Screen | Phase |
|------|--------|-------|
| `graphql-studio-main.html` | Three-panel main editor view: schema explorer + Monaco editor + response viewer | Phase 1 |
| `graphql-schema-explorer.html` | Full-screen schema browser: type list + field detail table + SDL panel | Phase 1 |
| `graphql-subscription-testing.html` | Subscription editor + live message stream + test assertions + stats | Phase 2 |
| `graphql-test-runner.html` | Test collections sidebar + results table with SLA badges + assertion detail panel | Phase 3 |
| `graphql-workflow-testing.html` | Workflow canvas with GraphQL nodes + properties panel + run timeline | Phase 4 |
| `graphql-query-builder.html` | Visual field selector: schema tree + field checkbox grid + live query preview | Phase 2 |
| `graphql-code-generation.html` | Code generation panel: operation + target language selector + generated output + collections | Phase 3 |

All mockups use the Catppuccin Mocha dark theme (`#1e1e2e` base) consistent with the rest of the app.

---

## 17. Phase Status Tracker

| Phase | Status | Start | Complete |
|-------|--------|-------|----------|
| Phase 1 — MVP | Not Started | — | — |
| Phase 2 — Subscriptions + Builder | Not Started | — | — |
| Phase 3 — Collections + Code Gen | Not Started | — | — |
| Phase 4 — Workflow + Lessons | Not Started | — | — |

---

## 18. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `monaco-graphql` bundle size | Medium | Tree-shake, lazy-load the GraphQL worker only when tab is active |
| Subscription protocol fragmentation | Medium | Auto-detect protocol; provide manual override in connection settings |
| Public test APIs going down | Low | Local Docker test server as primary; public APIs as secondary |
| Schema introspection disabled on production APIs | Medium | Allow manual schema upload (SDL file or paste) as alternative |
| `@defer`/`@stream` not widely adopted yet | Low | Feature is additive; basic query/mutation works without it |
| File upload spec variations across servers | Medium | Stick to standard `graphql-multipart-request-spec`; document known server quirks |
| Monaco editor memory with many tabs | Medium | Dispose unused models; limit to 8 tabs (same as WebSocket Studio) |
| `@defer`/`@stream` spec not finalized (multiple format versions in the wild) | High | Version-aware parser; connection-level format selector; default to latest alpha; document supported versions — see Section 23.2.3 |
| `subscriptions-transport-ws` deprecated and unmaintained (no updates since 2022) | Medium | Implement as P2 legacy compat; consider vendoring minimal client code (~200 lines); document as legacy support — see Section 23.2.1 |
| No `src-server/` proxy routes exist yet for GraphQL subscription/upload | High | Must scaffold proxy server routes before Phase 2 work; this is a prerequisite task not in the original plan — see Section 23.7 |
| Apollo Tracing format (`extensions.tracing`) deprecated by Apollo | Low | Support both legacy and emerging OpenTelemetry formats; tracing waterfall is format-agnostic visualization — see Section 23.2.5 |
| Query builder scope creep (11 tasks with complex P2 items) | High | Ship MVP builder (6 tasks) first; defer fragments/directives/unions to post-2.1 iteration — see Section 23.6 |

---

## 19. Testing Strategy

### Unit Tests
- `schemaParser.test.ts` — introspection result → navigable type tree
- `queryBuilder.test.ts` — field selection → valid SDL output
- `codeGenerator.test.ts` — operation → TypeScript/cURL/Python snippets
- `multipartParser.test.ts` — chunked response → merged JSON
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation, env mutation, abort on rf.assert failure
- `graphqlClient.test.ts` — HTTP transport, WS transport, protocol detection, auth header injection
- `useGraphqlExecution.test.ts` — hook behavior for query/mutation lifecycle
- `useGraphqlSubscription.test.ts` — connection states, message buffering, reconnect logic
- `useGraphqlSchema.test.ts` — introspection caching, polling interval, stale detection
- `useGraphqlHistory.test.ts` — save/load/clear history, max-items FIFO eviction, recency grouping, search filter, max 100 items enforcement
- `useGraphqlQueryBuilder.test.ts` — toggleField adds/removes from selectedFields; SDL generator produces valid document; alias/directive/fragment state mutations; reset clears all state
- `useGraphqlCollections.test.ts` — add/update/delete items and folders, pin/unpin, drag-and-drop reorder, persistence round-trip
- `useGraphqlMockServer.test.ts` — mock enable/disable, custom resolver CRUD, config sync to server, reset to defaults
- `useGraphqlEnvironments.test.ts` — variable resolution precedence order, `{{var}}` interpolation
- `codeGenerator.test.ts` — each target language produces syntactically valid output; TypeScript types match selected fields; variables interface includes all operation variables
- `schemaDiff.test.ts` — removed field is `BREAKING`; added optional field is `SAFE`; changed type is `BREAKING`; zero changes for identical schemas
- `schemaSnapshot.test.ts` — capture saves to IndexedDB; max-20 FIFO eviction; load/delete round-trip
- `apqClient.test.ts` — SHA-256 hash is deterministic for same query; normalized whitespace produces same hash; two-step flow fires full query on `PERSISTED_QUERY_NOT_FOUND`; cache-hit path sends hash-only
- `preRequestScriptRunner.test.ts` — rf.* API, sandbox isolation (window/document undefined), env mutation, abort on rf.assert failure, script timeout at configured limit

### E2E Tests (Playwright)
- `e2e/graphql-basic.spec.ts` — connect, introspect, execute query, verify response
- `e2e/graphql-mutations.spec.ts` — execute mutation, verify state change
- `e2e/graphql-subscriptions.spec.ts` — subscribe, receive messages, unsubscribe
- `e2e/graphql-schema-explorer.spec.ts` — search types, click-to-insert
- `e2e/graphql-collections.spec.ts` — save, organize, re-run operations
- `e2e/graphql-variables.spec.ts` — variable interpolation, environment variables
- `e2e/graphql-file-upload.spec.ts` — upload file via multipart
- `e2e/graphql-workflow-nodes.spec.ts` — workflow with GraphQL nodes executes

### Test Scenarios (docs/plan/future/graphql/test-scenarios/)
- `graphql-editor-test-scenarios.md`
- `graphql-schema-explorer-test-scenarios.md`
- `graphql-subscriptions-test-scenarios.md`
- `graphql-workflow-nodes-test-scenarios.md`
- `graphql-collections-test-scenarios.md`
- `graphql-file-upload-test-scenarios.md`
- `graphql-code-generation-test-scenarios.md`
- `graphql-pre-request-scripts-test-scenarios.md`

---

## 20. Phase 1A Re-evaluation History

A record of all bugs found and fixed during the iterative Phase 1A re-evaluation rounds.

### Round 1 (2026-06-17) — 7 bugs fixed

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-1A-1 | `graphql-studio.css` | Unsaved-changes dot was blue (`--gql-accent`) — mockup specifies amber | Changed `.gql-tab-dot` background to `var(--gql-warning)` |
| BUG-1A-2 | `GraphqlStudioPage.tsx` | "+" add-tab button disappeared at `MAX_TABS`, giving no feedback | Button always renders; `disabled` + tooltip when at limit |
| BUG-1A-3 | `GraphqlStudioPage.tsx` | Bottom panel `role="tabpanel"` missing `aria-labelledby` (WCAG 1.3.1) | Added `id` to tab buttons; dynamic `aria-labelledby` on panel |
| BUG-1A-4 | `GraphqlStudioPage.tsx` | Right-pane `role="tabpanel"` missing `aria-labelledby` | Same pattern as BUG-1A-3 |
| BUG-1A-5 | `GraphqlStudioPage.tsx` | Main tab bar `role="tablist"` missing `aria-label` | Added `aria-label="Query tabs"` |
| BUG-1A-6 | `graphql-studio.css` | `.gql-tab-close:hover` used hardcoded `#ef5350` red | Replaced with `var(--gql-danger)` + `color-mix` |
| BUG-1A-7 | `graphql-studio.css` | `.gql-bottom-tab-badge` color was hardcoded `#fff`, broken on light theme | Changed to `var(--bg-primary)` |

### Round 2 (2026-06-17) — 4 bugs fixed

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-1A-R2-1 | `GraphqlEditor.tsx` | Monaco editor did not auto-focus when switching tabs; required a click to type | Added `useEffect` on `modelPath` → `editor.focus()` via `requestAnimationFrame` |
| BUG-1A-R2-2 | `GraphqlStudioPage.tsx` | Close button on the last remaining tab was visible but silently did nothing | Close button only renders when `tabs.length > 1` |
| BUG-1A-R2-3 | `GraphqlStudioPage.tsx` | Tab `<button>` accessible name was polluted by nested span text | Added explicit `aria-label` on the button; `aria-hidden` on inner spans |
| BUG-1A-R2-4 | `GraphqlStudioPage.tsx` | `gql-tab--unsaved` CSS class was dead code (no style rule) | Removed from JSX |

### Round 3 (2026-06-17) — 3 bugs fixed

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-1A-R3-1 | `GraphqlStudioPage.tsx` | Invisible close buttons on inactive tabs were in the keyboard Tab order | `tabIndex` changed to `isActive \|\| isConfirming ? 0 : -1` |
| BUG-1A-R3-2 | `graphql-studio.css` | Several error-state rules used hardcoded danger hex (`#f38ba8`, `#ef5350`, `rgba(243, 139, 168, ...)`) | Replaced with `var(--gql-danger)` / `color-mix(in srgb, var(--gql-danger) N%, transparent)` |
| BUG-1A-R3-3 | `GraphqlHeadersPanel.tsx` | Header row inputs had non-unique `aria-label` values across rows | Labels now include row index or key name (e.g. `"Header 1 name"`, `"Authorization header value"`) |

### Round 4 (2026-06-17) — 3 bugs fixed

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-1A-R4-1 | `graphql-studio.css` | `.gql-tab` (main query tabs) had no `:focus-visible` ring — WCAG 2.4.7 violation | Added `.gql-tab:focus-visible { outline: 2px solid var(--gql-accent); outline-offset: -2px; }` |
| BUG-1A-R4-2 | `graphql-studio.css` | `.gql-bottom-tab` set `outline: none` with no replacement focus indicator — WCAG 2.4.7 violation | Added `.gql-bottom-tab:focus-visible { outline: 2px solid var(--gql-accent); outline-offset: -2px; }` |
| BUG-1A-R4-3 | `monacoGraphqlSetup.ts` | Stale `TODO(Phase 1B)` comment suggested replacing the regex operation extractor with `graphql.parse()` — misleading since Phase 1B is done; the regex is intentionally kept for keystroke-level error tolerance | Updated comment to document the intentional design choice |

---

## 21. References

- [GraphiQL Monorepo](https://github.com/graphql/graphiql) — 16.8k stars, official GraphQL IDE
- [Altair GraphQL Client](https://altairgraphql.dev/) — v8.5.4, Desktop/browser, environments, plugins, file upload
- [GraphQL Playground](https://github.com/graphql/graphql-playground) — Archived May 2026 (merged into GraphiQL)
- [Postman GraphQL](https://www.postman.com/graphql/) — Visual builder, schema introspection, subscriptions
- [Apollo GraphOS Explorer](https://www.apollographql.com/docs/graphos/explorer/) — Monaco-based, two-step search, operation collections, scripting
- [Hive (The Guild)](https://the-guild.dev/graphql/hive) — Schema registry, federation, observability, MIT licensed
- [Hoppscotch](https://hoppscotch.io/) — Open-source Postman alternative with GraphQL tab
- [graphql-ws](https://github.com/enisdenjo/graphql-ws) — Spec-compliant WebSocket subscriptions (`graphql-transport-ws` protocol)
- [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) — Legacy Apollo subscription protocol (deprecated)
- [graphql-sse](https://github.com/enisdenjo/graphql-sse) — GraphQL over Server-Sent Events transport spec
- [monaco-graphql](https://github.com/graphql/graphiql/tree/main/packages/monaco-graphql) — Monaco GraphQL language mode
- [cm6-graphql](https://github.com/graphql/graphiql/tree/main/packages/cm6-graphql) — CodeMirror 6 GraphQL extension (not used; reference only)
- [GraphQL Multipart Request Spec](https://github.com/jaydenseric/graphql-multipart-request-spec) — File upload standard
- [Incremental Delivery RFC](https://github.com/graphql/graphql-spec/blob/main/rfcs/DeferStream.md) — `@defer`/`@stream` specification
- [GraphQL Spec](https://spec.graphql.org/) — June 2018 + October 2021 editions
- [GraphQL Voyager](https://github.com/graphql-kit/graphql-voyager) — Visual schema relationship explorer
- [WebSocket Studio Plan](../websocket/websocket-studio-plan.md) — Pattern reference for connection management, proxy architecture, and tab layout

---

## 22. Phase 1 Comprehensive Re-evaluation History

A full-codebase audit of all Phase 1 files (1A–1E) conducted as a single pass to catch cross-phase issues.

### Comprehensive Round 1 (2026-06-17) — 9 bugs fixed

#### Pass 1: Code Quality + ARIA Structure (7 bugs)

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-P1-R1-1 | `GraphqlConnectionBar.tsx` | `gql-connection-url-wrap` had redundant `style={{ position: 'relative' }}` — CSS class already has this rule | Removed inline style |
| BUG-P1-R1-2 | `GraphqlSchemaExplorer.tsx` | Both Fields and SDL tabpanels in TypeDetail shared the same `id` (`gql-se-dtabpanel-${type.name}`). Both `aria-controls` attrs on the tab buttons also pointed to the same ID — fragile and ambiguous for assistive tech | Added `-fields`/`-sdl` suffix to panel IDs and updated `aria-controls` on each tab button accordingly |
| BUG-P1-R1-3 | `GraphqlSchemaExplorer.tsx` | "Implements:", "Implemented by:", and "Union of:" type names rendered as non-interactive `<span>`s despite being styled in teal like links. Field type refs in the same component ARE clickable buttons — inconsistent navigation UX | Changed spans to `<button type="button" className="gql-se-impl-link gql-se-impl-link--btn">` with `onClick={() => onSelectType(name)}` for types in `navigableTypes` |
| BUG-P1-R1-4 | `GraphqlSchemaExplorer.tsx` | UNION possible types listed in the Fields tab rendered as `<div>` (no click handler). Navigating from "Union of: TypeA" in the header worked, but clicking the same type name in the Fields list did nothing | Changed to `<button>` with `onClick={() => onSelectType(pt)}` for types in `navigableTypes` |
| BUG-P1-R1-5 | `graphql-studio.css` | No button-reset CSS for `.gql-se-impl-link--btn` (new button variant). No hover/focus-visible styles for navigable union types in the Fields tab | Added `.gql-se-impl-link--btn` (button reset + hover underline + focus-visible ring). Added `.gql-se-enum-value--type-btn` (pill button with hover/focus-visible) |
| BUG-P1-R1-6 | `src/shared/selectors.ts` | GQL namespace had 4 stale testid selectors that no longer matched the component's actual `data-testid` values (used old `gql-schema-*` prefix instead of `gql-se-*`): `SCHEMA_SEARCH`, `SCHEMA_TYPE_LIST`, `SCHEMA_TYPE_DETAIL`, `COPY_SDL_BTN` | Updated all 4 selectors + `SCHEMA_SDL_TAB`, `SCHEMA_SDL_VIEW`, `SNAPSHOT_BTN` to correct `gql-se-*` IDs |
| BUG-P1-R1-7 | `GraphqlSchemaExplorer.tsx` | `gql-se-type-entries` div had no `data-testid` — `GQL.SCHEMA_TYPE_LIST` selector had no element to target in the DOM | Added `data-testid="gql-se-type-list"` to the type entries div |

#### Pass 2: UX + A11y audit of ConnectionBar, ResponseViewer, ProfileModal (2 bugs)

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-P1-R2-2 | `GraphqlConnectionBar.tsx` | Profile badge `aria-label` was the generic string `"Connection profiles"` — did not communicate the saved count or action to screen readers (contrast: env badge had a descriptive dynamic aria-label matching its title) | Changed to dynamic `aria-label` mirroring the `title` text: `"N saved profiles — click to manage"` / `"No saved profiles — click to save current connection"` |
| BUG-P1-R2-3 | `GraphqlConnectionBar.tsx` | Schema polling config button only had a `title` attribute — no `aria-label`. Screen readers prefer `aria-label` over `title` | Added `aria-label` mirroring the `title` value |

### Comprehensive Round 2 (2026-06-17) — 3 bugs fixed

Full re-audit of Phase 1 modals (`GraphqlProfileModal`, `GraphqlEnvModal`) and schema explorer edge cases.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-P1-R3-1 | `GraphqlProfileModal.tsx` + `graphql-studio.css` | The profile modal panel had `style={{ outline: 'none' }}` as an inline style — the project rule requires all styling to live in CSS, not inline. The env modal panel (also `tabIndex={-1}`) had the same problem but was never given the suppress rule at all, so focused programmatically it would show a full-panel browser focus ring | Removed inline `style` from `GraphqlProfileModal`; added `.gql-profile-modal:focus { outline: none }` and `.gql-env-modal:focus { outline: none }` to CSS |
| BUG-P1-R3-2 | `GraphqlEnvModal.tsx` | Env name button (`gql-env-name-display`) accessible name was just the env name text. Screen readers would announce the name but nothing about the rename affordance. `title="Click to rename"` is a tooltip-only attribute that screen readers don't always expose | Added `aria-label={\`Rename \${selectedEnv.name}\`}` so screen readers announce "Rename Staging, button" |
| BUG-P1-R3-3 | `GraphqlEnvModal.tsx` | "Set Active" button had no context about which environment would be activated — screen readers would only announce "Set Active, button" with no env name | Added `aria-label={\`Set \${selectedEnv.name} as active environment\`}` |

### Comprehensive Round 3 (2026-06-17) — 1 bug fixed

Full re-audit of `GraphqlAuthPopover`, `GraphqlHeadersPanel`, and `GraphqlResponseViewer`.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-P1-R4-1 | `GraphqlAuthPopover.tsx` | **Critical A11y:** `PasswordInput` component set `data-testid={testId}` on the underlying `<input>` but did NOT set `id={testId}`. Three labels used `htmlFor` referencing those same values as if they were HTML `id` attributes: `htmlFor="gql-auth-bearer-input"` (Bearer Token label), `htmlFor="gql-auth-basic-pass"` (Basic Password label), `htmlFor="gql-auth-apikey-val"` (API Key Value label). Clicking any of these label texts did not focus the corresponding password input, breaking the standard form interaction. | Added `id={testId}` to the `<input>` inside `PasswordInput` — `testId` now doubles as both the HTML `id` and `data-testid`, no new prop required. |

### Comprehensive Round 4 (2026-06-17) — 2 bugs fixed

Full re-audit of `GraphqlStudioPage` keyboard shortcuts, `GraphqlProfileModal` event handling, and `useGraphqlExecution`.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-P1-R5-1 | `GraphqlProfileModal.tsx` | **Critical UX:** Profile modal registered its Escape key handler as `window.addEventListener('keydown', ...)` in the bubble phase — the same phase as the main page's global `Escape → cancel()` handler. `addEventListener` fires in registration order, and the page registers first (mounts first). So pressing Escape to dismiss the Profile modal ran the page's `cancel()` BEFORE the modal's handler could call `stopPropagation()`. Any in-flight GraphQL request was silently aborted. The env modal and auth popover correctly used `document.addEventListener(..., { capture: true })` to solve this — capture phase fires BEFORE bubble phase regardless of registration order. | Changed to `document.addEventListener('keydown', handler, { capture: true })` (and matching `removeEventListener` with `{ capture: true }`) — matches the `GraphqlEnvModal` / `GraphqlAuthPopover` pattern. |
| BUG-P1-R5-2 | `useGraphqlExecution.ts` | Misaligned comment on line 75: comment at 10-space indent, surrounding code at 6-space indent. | Fixed indentation to 6 spaces to match the code block. |

### Comprehensive Round 5 (2026-06-17) — CSS Linting Overhaul (33 bugs fixed)

Installed Stylelint, added `lint:css` script, silenced ESLint on `.css` files. Fixed 33 Stylelint errors across 11 CSS files: duplicate selectors (merged conflicting properties), empty CSS blocks (removed), `!important` overrides (removed where possible). Files fixed: `graphql-studio.css`, `index.css`, `base.css`, `catalog.css`, `csv-import.css`, `environment-manager.css`, `json-path-builder.css`, `requests.css`, `scenario-builder.css`, `settings.css`, `websocket-studio.css`, `workflow.css`. After fixes: `npm run lint:css` and `npx eslint .` both report **0 errors**.

### Comprehensive Round 6 (2026-06-17) — 8 bugs fixed

Full re-audit of all Phase 1 files focusing on UX correctness, cross-browser compatibility, and visual consistency.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-GQL-R6-1 | `GraphqlEnvModal.tsx` | **Cross-browser (Firefox)**: `handleExport()` called `URL.revokeObjectURL(url)` synchronously after `a.click()` and did not append the anchor to the document body. On Firefox, synchronous revocation aborts the download before the browser can start transferring the file. Same bug as BUG-1B-3 (schema SDL export) which was already fixed in `GraphqlSchemaExplorer.tsx`. | Applied the same fix: `document.body.appendChild(a)`, click, `document.body.removeChild(a)`, then `setTimeout(() => URL.revokeObjectURL(url), 150)`. |
| BUG-GQL-R6-2 | `GraphqlConnectionBar.tsx` | **Visual inconsistency**: Schema error badge used the raw Unicode `⚠` character: `⚠ Schema error`. The schema-loaded badge uses a proper SVG dot. All other warning indicators in the codebase (validation warning, variables error banner) use SVG icons. Raw Unicode glyphs render inconsistently across OS/font combinations. | Replaced `⚠` with the same SVG warning triangle (path + two lines) used throughout the component. |
| BUG-GQL-R6-3 | `GraphqlProfileModal.tsx` | **Misleading UX**: The two-click delete confirmation button changed its label to `✓ Confirm`. A checkmark (✓) conventionally signals "done" or "success" to users. On a destructive action (delete), it misleads users into thinking the deletion already succeeded rather than asking them to confirm it. Users hesitate or re-read trying to understand what the ✓ means. | Changed label to `Delete?` — a question mark is universally understood as a confirmation prompt, and "Delete?" clearly communicates the destructive nature of the action. |
| BUG-GQL-R6-4 | `GraphqlHeadersPanel.tsx` | **A11y inconsistency**: Key input used `aria-label={\`Header \${idx + 1} name\`}` (always index-based, e.g. "Header 1 name") while the value input, enable checkbox, and remove button all used `rowLabel` (the key name when available, e.g. "Authorization header value"). For a row with key "Authorization": checkbox → "Enable Authorization header", key input → "Header 1 name" (inconsistent!), value → "Authorization header value", remove → "Remove Authorization header". Screen reader users navigating by form field would get inconsistent context. | Changed key input `aria-label` to `\`${rowLabel} header name\`` — matches the format of all other row elements. |
| BUG-GQL-R6-5 | `GraphqlResponseViewer.tsx` + `GraphqlSchemaExplorer.tsx` | **A11y — Keyboard scrolling**: The response JSON body (`gql-rv-json-scroll`) and the schema SDL viewer (`gql-se-sdl-pre-wrap`) are scrollable `<div>` containers around non-interactive `<pre>` content. Without `tabIndex={0}`, keyboard-only users have no way to Tab to these areas and use arrow/Page keys to scroll through large responses or SDL definitions. | Added `tabIndex={0}` to both scrollable containers and added matching `:focus-visible` CSS rules (2px accent outline inset) to both `.gql-rv-json-scroll` and `.gql-se-sdl-pre-wrap`. |
| BUG-GQL-R6-6 | `graphql-studio.css` | **CSS code smell**: `.gql-polling-interval-input` used `padding: 4px 6px !important` and `font-size: 12px !important` to override the base `.gql-input` rule. `!important` bypasses the cascade and makes future overrides brittle. | Renamed the selector to `.gql-polling-popover .gql-polling-interval-input` — the extra specificity of the ancestor context naturally wins over the flat `.gql-input` rule without needing `!important`. |
| BUG-GQL-R6-7 | `GraphqlEnvModal.tsx` | **Code quality — Indentation**: The `<div ref={panelRef}` modal panel element was indented with 6 spaces (an extra level) instead of the standard 4. This broke the visual indentation pattern of the surrounding JSX tree. | Corrected to 4-space indentation matching all other JSX in the file. |
| BUG-GQL-R6-8 | `GraphqlSchemaExplorer.tsx` | **Visual inconsistency — Unicode icons**: Four interactive elements used raw Unicode characters instead of SVG icons: (a) `⬡` in the idle-state "Introspect Schema" CTA button, (b) `↺` in the `introspection-disabled` "Retry" button, (c) `↺` in the `error` "Retry" button, (d) `⟳` in the schema-loaded re-introspect icon button, and (e) `↓ SDL` in the Export SDL button. Unicode glyphs render differently across OS/browser/font combinations and don't respect the app's icon sizing system. | Replaced all five with inline SVG icons (refresh/download icons) matching the visual style used throughout the component. |

### Comprehensive Round 9 (2026-06-17) — 12 bugs fixed

Deep audit focusing on memory leaks, race conditions, cleanup gaps, and UX edge cases. 36 issues identified; 12 highest-priority fixed; remainder tracked for Phase 2.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-GQL-R9-1 | `useGraphqlSchema.ts` | **Poll recovery false positive — amber "Schema stale" badge persists after successful refresh**: After a transient poll failure set `pollErrorMessage`, a subsequent successful poll that found no SDL change hit `if (isPoll && !changed) return` and never cleared the error message. The badge stayed amber indefinitely. | Added `setState((s) => s.pollErrorMessage ? { ...s, pollErrorMessage: null } : s)` on the `isPoll && !changed` early-return path. |
| BUG-GQL-R9-2 | `useGraphqlSchema.ts` + `GraphqlStudioPage.tsx` | **Corrupted schema cache crashes Schema Explorer**: `loadCachedSchema` validated `schemaInfo` existence but not that `schemaInfo.types` was an array. Partial/corrupt cache entries caused `types.filter()` and `types.length` to throw, producing a white-screen crash. | Added `!Array.isArray(parsed.schemaInfo?.types)` guard in `loadCachedSchema`. Used optional chaining `schemaInfo?.types?.length` for `typesCount` prop. |
| BUG-GQL-R9-3 | `GraphqlStudioPage.tsx` | **Global shortcuts fire through open modals**: ⌘Enter executed queries and ⌘⇧I triggered introspection while Environment Manager or Profile modal was open, causing accidental side effects. | Added `profileModalOpenRef` / `envModalOpenRef` refs + DOM check for `[role="dialog"][aria-modal="true"]`. All shortcuts except Escape bail early when any dialog is open. |
| BUG-GQL-R9-4 | `useGraphqlExecution.ts` | **In-flight execution not aborted on unmount**: Navigating away from GraphQL Studio while a query was executing left the fetch running. The async completion then called `setState` on the unmounted component. | Added `useEffect(() => () => { abortCtrlRef.current?.abort(); }, [])` unmount cleanup. |
| BUG-GQL-R9-5 | `GraphqlStudioPage.tsx` | **Monaco models never disposed on tab close (memory leak)**: Closing a tab removed React state but left `inmemory://graphql/{id}` and `inmemory://graphql-vars/{id}` models (with undo stacks, markers) in Monaco's registry. Sessions with repeated open/close cycles accumulated memory. | Added `monaco.editor.getModel(uri)?.dispose()` for both query and vars URIs in `closeTab`, using a `monacoRef` to access the instance in the callback. |
| BUG-GQL-R9-8 | `GraphqlConnectionBar.tsx` | **Introspect not blocked for unresolved `{{var}}`**: R8 blocked Execute but not Introspect. Introspect sends an HTTP request to the same endpoint, producing the same confusing DNS error. | Added `endpointHasUnresolved` to `introspectDisabled` alongside `executeDisabled`. |
| BUG-GQL-R9-9 | `GraphqlResponseViewer.tsx` + `GraphqlSchemaExplorer.tsx` | **Copy feedback timers not cleaned on unmount**: `setTimeout(() => setCopied(false), 1500)` with no ref cleanup. Switching views shortly after copying caused `setState` on unmounted components. | Added `copyTimerRef` / `sdlCopyTimerRef` with `useEffect` unmount cleanup in both components. |
| BUG-GQL-R9-10 | `GraphqlEnvModal.tsx` | **Delete-confirm timer missing unmount cleanup**: The 2.5s confirm timeout from R8-8 was cleared on confirm but not when the modal unmounted. | Added `useEffect(() => () => { ... clearTimeout ... }, [])` cleanup. |
| BUG-GQL-R9-15 | `GraphqlStudioPage.tsx` + `graphql-studio.css` | **Partial success shows green Response tab badge**: HTTP 200 with both `data` and `errors` (partial success, common in GraphQL) showed the same green success dot as a clean response. | Added `.gql-right-tab-badge--warn` amber variant. Tab badge now shows amber when `response.errors.length > 0 && response.data != null`. |
| BUG-GQL-R9-16 | `GraphqlResponseViewer.tsx` | **Pure GQL error badge text still reads "200 OK"**: R8-18 changed the badge color to amber but the label still came from `statusBadgeLabel(httpStatus)`, creating a contradictory amber "200 OK". | When `isPureGqlError`, badge now reads "GraphQL Error" instead of the HTTP status label. |
| BUG-GQL-R9-21 | `GraphqlResponseViewer.tsx` | **Duplicate HTTP response header keys cause React key collision**: `key={key}` in the headers table. Servers may emit duplicate headers (e.g. `Set-Cookie`), causing React warnings and lost rows. | Changed to `key={\`${key}-${idx}\`}`. |
| BUG-GQL-R9-22 | `GraphqlEnvModal.tsx` | **FileReader import lacks `onerror` handler**: If the selected file was corrupted or unreadable, the read failed silently with no user feedback. | Added `reader.onerror = () => setImportError('Could not read the selected file')`. |

### Comprehensive Round 8 (2026-06-17) — 12 bugs fixed

Full re-audit by static analysis agent using read-only access to all Phase 1 components. Prioritised by user-facing impact.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-GQL-R8-1 | `GraphqlStudioPage.tsx` | **Critical regression — `executionStatusRef` referenced `status` (window.status) instead of `execStatus`**: The R7 fix for Escape-key cancel introduced a new bug: the `const executionStatusRef = useRef(status)` line captured the browser's global `window.status` string (which TypeScript accepted as a string comparison), not the destructured `execStatus` alias. The Escape guard (`=== 'loading'`) therefore never matched, making the R7 fix a no-op. | Changed to `useRef(execStatus)` and `executionStatusRef.current = execStatus`. |
| BUG-GQL-R8-2 | `useGraphqlSchema.ts` | **Functional — In-flight introspection can corrupt schema for the wrong endpoint**: When the user changed the endpoint quickly (or a poll fired while editing the URL), the async response from the old URL could return after the state was reset for the new URL, overwriting the new endpoint's state and localStorage cache with the stale schema. | Added a monotonic `introspectionSeqRef` counter. Each `runIntrospection` call captures `thisSeq` before the await; after each await, if `thisSeq !== introspectionSeqRef.current` the response is discarded. The counter is also bumped in the endpoint-change `useEffect`. |
| BUG-GQL-R8-3 | `useGraphqlExecution.ts` | **UX — Cancel wipes the last good response**: `execute()` always called `setResponse(null)` at the start. If the user ran a second query and pressed Cancel/Escape, the panel showed "No response yet" instead of the previous result. | Added `lastCompletedResponseRef` that snapshots the current `{status, response}` before clearing for a new execution. `cancel()`, `Aborted`, and `ctrl.signal.aborted` paths now restore from this ref instead of going to `idle`/null. |
| BUG-GQL-R8-4 | `GraphqlStudioPage.tsx` | **UX — Non-object variables JSON silently ignored**: Variables validation accepted any valid JSON (arrays, strings, null). Execution only sent variables when the parsed value was a non-array object. Users entering `["a"]` or `null` received no error and no variables were sent — server errors looked like app bugs. | Validation now requires `typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)`. Shows "Variables must be a JSON object — e.g. {\"id\": \"1\"}" for non-object values. |
| BUG-GQL-R8-8 | `GraphqlEnvModal.tsx` | **UX — Environment delete has no confirmation**: One misclick on the sidebar trash icon permanently deleted an environment and all its variables — no undo. | Implemented two-click confirm pattern matching `GraphqlProfileModal`. First click arms `confirmingDeleteId` and shows "Delete?" label with a 2.5s timeout. Second click executes the delete. Added `.gql-env-sidebar-delete--confirming` CSS for the armed state. |
| BUG-GQL-R8-9 | `useGraphqlSchema.ts` + `GraphqlConnectionBar.tsx` | **UX — Polling failures are silent while badge stays "Schema loaded"**: When a background poll failed (auth/network/parse error), the hook returned early without updating any state. The badge stayed green "Schema loaded" with no indication the schema was stale. | Added `pollErrorMessage: string | null` to `GraphqlSchemaState`. Poll failures now set it via `setState((s) => ({ ...s, pollErrorMessage: ... }))` without wiping the schema. Successful polls clear it. The connection bar shows an amber "Schema stale" badge (`.gql-schema-status--poll-warn`) with a tooltip when `pollErrorMessage` is set. |
| BUG-GQL-R8-10 | `GraphqlConnectionBar.tsx` | **UX — Execute not blocked when endpoint has unresolved `{{var}}`**: The R7 warning icon was display-only. Execute remained enabled, sending a literal `https://{{host}}/graphql` to the network and producing a confusing DNS error. | Moved `executeDisabled` computation to after `endpointHasUnresolved` is derived. Added `endpointHasUnresolved` as a blocking condition. The button is now disabled with a tooltip explaining why. |
| BUG-GQL-R8-11 | `GraphqlResponseViewer.tsx` | **UX — Empty state shows macOS-only `⌘ Enter` shortcut**: Windows and Linux users saw the wrong modifier key. | Changed to `{isMac ? '⌘' : 'Ctrl'}+Enter` using `navigator.platform` detection. |
| BUG-GQL-R8-14 | `graphql-studio.css` | **Layout — Connection bar clips controls on narrow widths**: `.gql-connection-url-wrap` had `flex: 1` but no `min-width: 0`, preventing it from shrinking. Many children had `flex-shrink: 0`. On narrow panels, right-side controls (Execute, schema badge, env) were pushed off-screen with no scroll. | Added `min-width: 0` to `.gql-connection-url-wrap` and `overflow-x: auto; scrollbar-width: thin` to `.gql-connection-bar`. |
| BUG-GQL-R8-17 | `GraphqlEnvModal.tsx` | **Consistency — Raw Unicode `⚠` in import error message**: The import error banner used the raw Unicode triangle character, inconsistent with the SVG-icon standard established elsewhere. | Replaced with the same SVG warning triangle used in headers/endpoint panels. Added `.gql-env-import-error-icon` CSS class and updated `.gql-env-import-error` to `display: flex; gap: 4px`. |
| BUG-GQL-R8-18 | `GraphqlResponseViewer.tsx` | **UX — HTTP 200 + GraphQL-only errors shows green "200 OK" badge**: A 2xx response carrying only `errors` and no `data` is effectively a failed operation, yet the badge was green. Novice users often interpret green as "success" and miss the error count. | Added `isPureGqlError` detection (2xx + errors + no data). Uses `.gql-status--gql-error` amber badge class instead of green. Partial responses (data + errors) remain green with the "Partial" sub-badge. |
| BUG-GQL-R8-19 | `GraphqlSchemaExplorer.tsx` | **UX — Schema search doesn't clear stale selection**: When the user searched/filtered and the selected type was no longer in the visible list, the detail panel continued showing that type with no highlighted row in the list. The kind filter already had this clear logic; search did not. | Added `useEffect` that watches `filteredTypes` and calls `setSelectedTypeName(null)` if `selectedTypeName` is not in the filtered set. |

### Comprehensive Round 7 (2026-06-17) — 8 bugs fixed

Full re-audit by static analysis agent using read-only access to all Phase 1 components. Prioritised by user-facing impact.

| ID | Component | Bug | Fix |
|----|-----------|-----|-----|
| BUG-GQL-R7-1 | `GraphqlStudioPage.tsx` | **UX — Escape wiped status dot after response**: The global `Escape → cancel()` keyboard shortcut was unconditional. After a successful or failed execution, pressing Escape reset `status` from `'success'`/`'error'` to `'idle'`, silently removing the green/red dot on the Response tab while the response body was still visible — misleading users about pass/fail. | Added `executionStatusRef` to track current status in the event handler closure. `cancel()` now only fires when `executionStatusRef.current === 'loading'`. |
| BUG-GQL-R7-2 | `useGraphqlSchema.ts` | **Functional — Monaco has no autocomplete after reload**: When a schema was restored from `localStorage` cache, `rawIntrospection` was explicitly set to `null` ("raw data is not cached"). Monaco's language service received `null` and had no schema for autocomplete or validation squiggles until the user manually re-introspected. | `rawIntrospection` is now cached alongside `schemaInfo` (with a 2 MB size guard). Both the lazy `useState` initializer and the endpoint-change `useEffect` restore it from cache. The `saveCachedSchema` call includes it when under the size limit. |
| BUG-GQL-R7-3 | `GraphqlStudioPage.tsx` + `GraphqlHeadersPanel.tsx` | **Data integrity — Header rows can have no `id` after deserialization**: `normalizeTab()` cast the raw headers array without ensuring each row had a stable `id`. On pre-existing localStorage data (from before the `id` field was introduced), rows deserialized with `id: undefined`, causing React duplicate-key warnings and broken row update/delete. | Exported `makeHeaderId()` from `GraphqlHeadersPanel.tsx`. `normalizeTab()` maps each header through `{ ...h, id: typeof h.id === 'string' && h.id ? h.id : makeHeaderId() }`. |
| BUG-GQL-R7-4 | `authUtils.ts` | **Bug — `btoa()` throws `InvalidCharacterError` for non-ASCII credentials**: Basic Auth encoding used `btoa()` directly. Any non-Latin character in username or password (accented letters, CJK, Cyrillic) throws a `DOMException`, silently dropping the Authorization header. | Changed to `btoa(unescape(encodeURIComponent(credentials)))` — the canonical Unicode-safe base64 encoding pattern. |
| BUG-GQL-R7-5 | `authUtils.ts` | **UX — OAuth 2.0 / Custom auth badge appears "unconfigured"**: `isAuthConfigured()` returned `false` for `oauth2` and `custom` types, so the badge stayed gray — indistinguishable from "No Auth". A user who explicitly chose OAuth 2.0 had no visual confirmation. | `isAuthConfigured()` now returns `true` for `oauth2` and `custom` types, so the badge turns blue. The comment explains these types don't auto-inject headers but the selection itself should be acknowledged. |
| BUG-GQL-R7-6 | `GraphqlConnectionBar.tsx` | **UX — No warning for unresolved `{{var}}` in endpoint URL**: Headers showed per-row warnings for unresolved vars; the endpoint URL input had no such warning. A request to `https://{{host}}/graphql` would fail with a cryptic network error. | Added `activeEnvironment` prop. Uses `findUnresolvedVars(endpoint, activeEnvironment)`. When vars are unresolved, a `.gql-endpoint-unresolved-icon` warning SVG appears with a tooltip listing the missing variable names. |
| BUG-GQL-R7-7 | `graphql-studio.css` | **CSS — `color: #12261c` hardcoded on `.gql-method-badge`**: On themes where `--gql-success` is a different hue, this hardcoded dark color could be off-tone. | Replaced with `color: color-mix(in srgb, var(--gql-success) 15%, #000)` — a dark color derived from the success token. |
| BUG-GQL-R7-8 | `graphql-studio.css` | **CSS — select chevron SVG uses hardcoded stroke `%237f8c9a`**: On the light theme, this gray was barely visible against the white surface. | Added `--gql-select-chevron` custom property to `.gql-studio` (dark default: `%23a8b8cc`). Added `[data-theme="light"] .gql-studio` override with darker stroke `%233f4f63`. `.gql-select` now references `var(--gql-select-chevron)`. |

### Comprehensive Round 10 (2026-06-17) — 11 bugs fixed

Full audit identified 29 new issues (0 Critical, 6 High, 13 Medium, 8 Low, 2 Cosmetic). 11 highest-impact fixes implemented:

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R10-1 | `GraphqlStudioPage.tsx` | **High — ⌘Enter bypasses unresolved endpoint var check**: `handleExecute()` only checked `varsError` and `endpoint.trim()`, not unresolved `{{var}}` refs. The Execute button was disabled but the keyboard shortcut still fired, sending requests to literal `{{host}}` URLs. | Added `findUnresolvedVars(endpoint, activeEnvironment).length > 0` early-return guard in `handleExecute`. |
| BUG-GQL-R10-2 | `GraphqlStudioPage.tsx` | **High — ⌘⇧I bypasses unresolved endpoint var check for introspect**: The Introspect button was disabled for unresolved vars (R9-8) but the global keyboard shortcut called `introspect()` with no guard. | Added `endpointRef` / `activeEnvironmentRef` and a `findUnresolvedVars` guard before the `introspectRef.current()` call in the keyboard handler. |
| BUG-GQL-R10-4 | `GraphqlStudioPage.tsx` | **High — MAX_TABS not enforced on localStorage load**: `loadTabs()` restored all persisted tabs with no `slice`. Manual edits or older builds could produce 10+ tabs, overflowing the UI. | Added `normalized.slice(0, MAX_TABS)` in `loadTabs()`. Excess tabs are silently dropped. |
| BUG-GQL-R10-6 | `GraphqlResponseViewer.tsx` | **High — JSON.stringify crash in render**: `useMemo` called `JSON.stringify(payload, null, 2)` with no try/catch. BigInt, circular structures, or exotic values could white-screen the right pane. | Wrapped in try/catch; fallback shows a human-readable error comment. |
| BUG-GQL-R10-10 | `GraphqlSchemaExplorer.tsx` | **Medium — Zero-field types show blank panel**: OBJECT/INTERFACE/INPUT_OBJECT types with empty `fields: []` rendered a blank detail tab with no explanation. | Added empty-state message "This type has no fields defined" when all field/enum/union arrays are empty (non-SCALAR). |
| BUG-GQL-R10-13 | `GraphqlStudioPage.tsx` | **Medium — Closing tab doesn't cancel in-flight execution**: User could close a tab mid-request; the response would arrive for a disposed model, causing confusing "ghost" execution. | In `closeTab`, if the closed tab owns the in-flight execution (`responseModelUriRef` matches), `cancel()` is called. |
| BUG-GQL-R10-16 | `GraphqlProfileModal.tsx` | **Medium — Profile modal Escape doesn't restore focus**: Keyboard users landed on `<body>` after closing profiles via Escape (env modal restored focus correctly). | Added `restoreFocusToTrigger()` with `requestAnimationFrame` targeting `[data-testid="gql-profile-badge"]` in the Escape handler. |
| BUG-GQL-R10-18 | `GraphqlResponseViewer.tsx` | **Medium — httpHeaders could be undefined from malformed proxy**: `Object.keys(response.httpHeaders)` throws if the field is null/undefined from a malformed proxy response. | Added defensive `?? {}` fallback in both the main component and the `MetadataTab` sub-component. |
| BUG-GQL-R10-22 | `GraphqlStudioPage.tsx` | **Low — Space on tab close scrolls page**: The close button `onKeyDown` handler handled Space but didn't call `preventDefault()`, so the browser's default scroll action also fired. | Added `e.preventDefault()` before `closeTab` in the Space/Enter handler. |
| BUG-GQL-R10-26 | `GraphqlConnectionBar.tsx` | **Low — commitPollingInterval reads stale pollingEnabled from closure**: The function read `pollingEnabled` and `localIntervalSeconds` from the render closure instead of refs, unlike `closePollingPopoverViaRef`. | Changed to read `pollingEnabledRef.current` and `localIntervalSecondsRef.current`. |
| BUG-GQL-R10-29 | `GraphqlConnectionBar.tsx` | **Cosmetic — Execute button aria-label doesn't mention unresolved vars**: When disabled due to unresolved endpoint vars, screen readers heard generic "Execute operation" with no explanation. | Added `endpointHasUnresolved` branch to both `aria-label` and `title` attributes. |

### Comprehensive Round 11 (2026-06-17) — 10 bugs fixed

Audit identified 23 new issues (2 Critical, 3 High, 10 Medium, 6 Low, 2 Cosmetic). Includes 1 regression from R10-13. 10 highest-impact fixes implemented:

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R11-1 | `GraphqlStudioPage.tsx` | **Critical — R10-13 regression: `closeTab` reads stale `executing`**: `closeTab`'s `useCallback` deps are `[tabs, confirmingCloseTabId]` — `executing` is captured at first render. When execution starts, the closure still sees `executing === false`, so `cancel()` never fires on tab close. | Added `executingRef` + `cancelForCloseRef` refs declared before `closeTab`; reads `executingRef.current` and calls `cancelForCloseRef.current()`. |
| BUG-GQL-R11-2 | `GraphqlEnvModal.tsx` | **Critical — env var cross-contamination on environment switch**: Under React batching, the sync effect's `setLocalVars` triggers the flush effect, which could persist the old env's vars to the new env's ID before the sync completes. | Added `skipFlushForEnvSwitchRef` guard: sync effect sets `true`, flush effect skips one cycle and resets to `false`. |
| BUG-GQL-R11-6 | `GraphqlResponseViewer.tsx` | **Medium — MetadataTab status mismatch with status bar**: Status bar showed amber "GraphQL Error" for HTTP 2xx + errors-only, but MetadataTab showed green "200 OK" for the same response. | Extracted `isPureGqlError` logic into `MetadataTab`; mirrors status bar color/label. |
| BUG-GQL-R11-10 | `GraphqlStudioPage.tsx` | **Medium — ⌘Enter during execution restarts request**: Power users pressing ⌘Enter during a loading request would silently abort and restart instead of no-op. | Added `if (executing) return` guard at the start of `handleExecute`; added `executing` to `useCallback` deps. |
| BUG-GQL-R11-11 | `GraphqlConnectionBar.tsx` | **Medium — Introspect aria-label missing unresolved vars**: Screen readers heard "Introspect schema" on a disabled button without explanation for the unresolved vars reason. | Added `endpointHasUnresolved` branch to both `aria-label` and `title`. |
| BUG-GQL-R11-12 | `GraphqlSchemaExplorer.tsx` | **Medium — SDL copy unhandled rejection**: `navigator.clipboard.writeText` had no `.catch()`, causing an unhandled promise rejection in non-secure contexts or denied permissions. | Added `.catch(() => {})` matching ResponseViewer pattern. |
| BUG-GQL-R11-14 | `GraphqlStudioPage.tsx` | **Medium — Model disposal uses wrong URI**: `closeTab` used `buildModelUri(tabId)` instead of `closedTab.modelUri`. Persisted tabs could have a divergent `modelUri`, causing Monaco models to leak. | Changed to `mc.Uri.parse(closedTab.modelUri)` and added `closedTab` null guard. |
| BUG-GQL-R11-15 | `useGraphqlExecution.ts` | **Medium — Cross-hook state update inside setStatus updater**: `setResponse` was called inside a `setStatus` updater function. Under React concurrent features, this causes unpredictable ordering. | Added `statusRef` / `responseRef` for synchronous reads; snapshot and batch state updates separately. |
| BUG-GQL-R11-16 | `GraphqlVariablesPanel.tsx` | **Low — handleBeforeMount recreated every render**: Unlike `GraphqlEditor.tsx` which hoists to module scope, `VariablesPanel` created a new inline function per render, potentially causing Monaco re-init work. | Hoisted `handleBeforeMount` to module scope (same pattern as `GraphqlEditor.tsx`). |
| BUG-GQL-R11-18 | — | **Cancelled** — Profile modal close button already had `type="button"` at line 169. Audit false positive. | No change needed. |

### Comprehensive Round 12 (2026-06-17) — 9 bugs fixed

Final polish audit identified 22 new issues (0 Critical, 2 High, 9 Medium, 8 Low, 3 Cosmetic) plus 1 R11-6 regression (missing CSS). R11 fixes verified correct except styling gap. 9 fixes implemented:

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R12-1 | `graphql-studio.css` | **Medium — R11-6 MetadataTab amber CSS missing**: R11-6 added `gql-status--gql-error` class logic to `MetadataTab` but no CSS rule existed for `.gql-rv-meta-status.gql-status--gql-error` — label showed "GraphQL Error" text in default unstyled color. | Added `.gql-rv-meta-status.gql-status--gql-error` rule with amber background/color matching `.gql-rv-status-badge` variant. |
| BUG-GQL-R12-2 | `GraphqlConnectionBar.tsx` | **Low — Introspect button title doesn't update during introspection or unresolved vars**: `aria-label` correctly switched states but `title` was static. | Added `introspecting` branch to `title` matching the `aria-label` pattern. |
| BUG-GQL-R12-6 | `GraphqlConnectionBar.tsx`, `GraphqlStudioPage.tsx` | **Medium — Empty query allows Execute (silent no-op)**: Execute was enabled with empty query; clicking did nothing with no feedback. | Added `queryEmpty` prop to connection bar; included in `executeDisabled`; added early-return guard in `handleExecute`; added descriptive `aria-label`/`title`. |
| BUG-GQL-R12-7 | `GraphqlStudioPage.tsx` | **Medium — Operation normalization marks tab as unsaved**: Automatic `selectedOperation` sync (stale/missing op name) used `updateActiveTab` which always sets `unsavedChanges: true`, causing amber dot and two-click close for a non-user edit. | Replaced with direct `setTabs` call that patches only `selectedOperation` without touching `unsavedChanges`. |
| BUG-GQL-R12-12 | `GraphqlResponseViewer.tsx` | **Low — MetadataTab shows green for partial success (data+errors)**: Status bar and tab badge showed amber but Metadata tab showed green "200 OK". | Added `isPartialSuccess` detection; shows amber "Partial Success" label matching status bar semantics. |
| BUG-GQL-R12-14 | `GraphqlConnectionBar.tsx` | **Low — extractOperations duplicate names cause React key collision**: Malformed documents with duplicate operation names produced key warnings in the `<select>`. | Changed `key={name}` to `key={\`${name}-${idx}\`}`. |
| BUG-GQL-R12-17 | `graphql-studio.css` | **Low — Auth popover close button missing `:focus-visible`**: Keyboard users couldn't see focus on the auth popover's close control. | Added `.gql-auth-popover-close:focus-visible` rule with accent outline. |
| BUG-GQL-R12-18 | `GraphqlConnectionBar.tsx` | **Low — Polling switch missing `aria-label`**: The `role="switch"` button had `aria-checked` but no accessible name. | Added `aria-label="Enable schema polling"`. |
| BUG-GQL-R12-22 | `graphql-studio.css` | **Cosmetic — Profile modal close button missing `:focus-visible`**: Keyboard users couldn't see focus on the profile modal's close control. | Added `.gql-profile-modal__close:focus-visible` rule with accent outline. |

### Comprehensive Round 13 (2026-06-17) — 4 bugs fixed

Audit identified 18 new issues (0 Critical, 3 High, 9 Medium, 4 Low, 2 Cosmetic). All R12 fixes verified correct. 4 highest-impact fixes implemented; 2 audit items cancelled as false positives:

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R13-1 | `useGraphqlExecution.ts` | **High — setState after unmount in execution hook**: Navigating away during an in-flight request aborts it, but the async catch/success handlers still call `setStatus`/`setResponse` → React "can't update unmounted component" warnings. | Added `mountedRef`; guard every `setStatus`/`setResponse` call in the async IIFE with `if (!mountedRef.current) return`; clear ref on unmount. |
| BUG-GQL-R13-2 | `useGraphqlSchema.ts` | **High — setState after unmount in schema hook**: Introspection requests (manual and polls) have no unmount guard — same class of issue as R13-1. | Added `mountedRef`; expanded both `thisSeq` guards to also check `mountedRef.current`; added `!mountedRef.current` guard in catch block; cleanup effect sets `mountedRef.current = false`. |
| BUG-GQL-R13-6 | `GraphqlStudioPage.tsx` | **Medium — Schema view forced on cache hydration**: The auto-switch effect triggered on any `idle → loaded` transition including cache load on mount, pulling returning users to the Schema tab unexpectedly. | Changed to track `introspecting` flag: only auto-switches when `introspecting` transitions `true → false` with `schemaStatus === 'loaded'` (i.e. only after manual introspect success). |
| BUG-GQL-R13-14 | `graphql-studio.css` | **Low — Missing `:focus-visible` on 4 controls**: Env modal close, polling popover close, profile Load, and profile Delete buttons all had `:hover` but no `:focus-visible` rule. | Added matching `:focus-visible` rules with `var(--gql-accent)` outline for all four. |
| BUG-GQL-R13-12 | — | **Cancelled** — `useQueryValidation` timer IS cleaned up by effect cleanup's `clearTimeout`; false positive. | No change needed. |
| BUG-GQL-R13-15 | — | **Cancelled** — `data != null` and `data !== undefined && data !== null` are semantically equivalent in JS; false positive. | No change needed. |

### Comprehensive Round 14 (2026-06-17) — 4 bugs fixed

Audit identified 7 new issues (0 Critical, 1 High, 3 Medium, 3 Low). All R13 fixes verified correct (with minor gaps addressed below). 4 fixes implemented; 3 lower-severity items deferred (R14-4 narrow mountedRef race in schema setState, R14-6 useQueryValidation debounce unmount, R14-7 confirmTimer defensive guard):

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R14-1 | `GraphqlStudioPage.tsx` | **High — Auto-switch false positive on endpoint change during introspect**: R13-6's `prevIntrospectingRef` correctly prevents auto-switch on cache hydration, but if the user changes the endpoint URL while introspection is in-flight, the new endpoint's cached schema triggers `introspecting: true→false` + `schemaStatus: 'loaded'` → unexpected auto-switch to Schema showing the wrong endpoint's schema. | Added `introspectStartEndpointRef` to capture the endpoint when `introspecting` transitions `false→true`. Auto-switch now additionally requires `endpoint === introspectStartEndpointRef.current`. |
| BUG-GQL-R14-2 | `GraphqlStudioPage.tsx` | **Medium — Vars debounce race with Execute**: Variables validation uses a 300ms debounce, but `handleExecute` gates on the debounced `varsError` state. User can fix invalid JSON and Execute within 300ms (blocked), or break JSON and Execute within 300ms (proceeds with no variables silently). | Added synchronous JSON validation directly in `handleExecute` — parses the variables string, rejects non-object/array/invalid JSON. The debounced `varsError` is kept for the UI badge only. |
| BUG-GQL-R14-3 | `GraphqlStudioPage.tsx` | **Medium — Double-click Execute race**: `handleExecute` checks `executing` (React state), but between first click and re-render there's a window where a second click passes the guard and aborts+restarts the request. | Added `executingRef.current` check (already maintained by closeTab logic) alongside the `executing` state check, closing the synchronous race window. |
| BUG-GQL-R14-5 | `useGraphqlExecution.ts` | **Low — cancel() missing mountedRef guard**: `cancel()` calls `setStatus`/`setResponse` unconditionally. While no current code path calls it after unmount, `closeTab` could invoke `cancelForCloseRef.current()` during teardown. | Added `if (!mountedRef.current) return` guard after aborting, matching the async completion paths from R13-1. |

### Comprehensive Round 15 (2026-06-17) — 6 bugs fixed

Audit identified 6 new issues (0 Critical, 2 Medium, 2 Low, 2 Cosmetic). R14-2 and R14-5 verified correct; R14-1 and R14-3 had follow-up gaps addressed below. All 6 fixed:

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R15-1 | `GraphqlStudioPage.tsx` | **Medium — R14-3 double-execute guard incomplete**: `executingRef` only mirrors React state (lags by one render), so two rapid clicks/⌘Enter in the same tick can still both pass the guard and start overlapping requests. | Added dedicated `executionLockRef` set synchronously at the top of `handleExecute` before calling `execute()`. Cleared automatically when `executing` goes `false`. |
| BUG-GQL-R15-2 | `GraphqlStudioPage.tsx` | **Medium — R14-1 env-resolution gap**: `introspectStartEndpointRef` tracked the raw template string only. If the user changes the active environment or an env-var value during introspection (while the template is unchanged), the new endpoint's cached schema triggers a false auto-switch. | Now captures and compares the fully resolved endpoint (`resolveVars(endpoint, activeEnvironment)`) instead of the raw template. |
| BUG-GQL-R15-3 | `GraphqlStudioPage.tsx` | **Low — ⌘⇧I bypasses introspecting guard**: The Introspect button is disabled while `introspecting`, but the keyboard shortcut had no equivalent check, allowing stacked introspection requests. | Added `introspectingRef` and an early `return` in the keyboard handler when introspection is already in flight. |
| BUG-GQL-R15-4 | `GraphqlStudioPage.tsx` | **Low/Cosmetic — Vars banner shows wrong message for non-object JSON**: When variables are valid JSON but not an object (e.g. `"hello"` or `[]`), the banner says "Invalid JSON" instead of the actual validation error. | Banner now renders the actual `varsError` message (e.g. "Variables must be a JSON object") instead of hardcoded "Invalid JSON". |
| BUG-GQL-R15-5 | `GraphqlSchemaExplorer.tsx` | **Low (a11y) — Schema explorer buttons missing aria-labels**: Empty-state Introspect and Retry buttons had no `aria-label`, causing screen readers to announce generic "button". | Added dynamic `aria-label` to all three empty-state action buttons (idle, introspection-disabled, error). |
| BUG-GQL-R15-6 | `GraphqlStudioPage.tsx` | **Cosmetic — Stale `varsError` in handleExecute dependency array**: `varsError` was listed in `handleExecute`'s `useCallback` deps but never read inside (R14-2 replaced it with synchronous validation). Causes unnecessary callback churn. | Removed `varsError` from the dependency array. |

### Comprehensive Round 16 (2026-06-17) — 2 bugs fixed

Audit identified only 2 new issues with plausible user-facing impact. All R15 fixes verified correct with no regressions. Full dependency array audit of GraphqlStudioPage.tsx revealed no stale closures. The codebase is converging on stability.

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R16-1 | `GraphqlStudioPage.tsx` | **Medium — Stale varsError after tab switch**: Variables validation is debounced (300ms), but when switching tabs, the old tab's `varsError` persists for up to 300ms — the error banner shows the wrong message, and Execute appears disabled even though the new tab's variables are valid. | Validate synchronously on tab switch (detected via `prevVarsTabIdRef`); only debounce when the user is typing within the same tab. |
| BUG-GQL-R16-2 | `GraphqlResponseViewer.tsx` | **Medium — Large response freezes the UI**: Responses above ~512KB produce hundreds of thousands of syntax-highlighted `<span>` elements, freezing the main thread during tokenization and DOM mounting. Common with list queries or bulk exports on internal APIs. | Added a 512KB threshold — responses above it render as plain text in the `<pre>` block, skipping `tokenizeJson()` entirely. Copy still works. Syntax highlighting is preserved for normal-sized responses. |

### Comprehensive Round 17 (2026-06-17) — 2 bugs fixed

Audit identified only 2 new issues with plausible user-facing impact. All R16 fixes verified correct with no regressions. Full user-journey walkthrough (10 scenarios), CSS class completeness check, and dependency array audit all passed clean.

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R17-1 | `GraphqlStudioPage.tsx`, `monacoGraphqlSetup.ts` | **High — Stale Monaco schema after endpoint change or introspection failure**: The `rawIntrospection` effect feeds schema data to monaco-graphql but never clears it when the schema becomes null (endpoint change, introspection failure). The query editor keeps suggesting fields from the previous endpoint's schema, giving users false confidence in wrong field names. | Added `clearGraphqlSchema()` to `monacoGraphqlSetup.ts` (calls `setSchemaConfig([])`) and extended the effect to call it when `rawIntrospection` becomes null. |
| BUG-GQL-R17-2 | `GraphqlStudioPage.tsx` | **Medium — Endpoint URL not persisted across reload**: Tabs, auth, polling, TLS, and environments are all persisted to localStorage, but the endpoint URL was not. After a page reload, endpoint reverts to the app-level base URL (or empty), while tabs/queries restore — the next Execute/Introspect silently hits the wrong server. | Added `ENDPOINT_STORAGE_KEY` (`gql_endpoint_v1`), restore on mount (with fallback to `resolvedBaseUrl`), and persist on every change. The `resolvedBaseUrl` sync effect still overrides when the app env changes and the user hasn't manually edited the URL. |

### Comprehensive Round 18 (2026-06-17) — 1 bug fixed

Audit identified only 1 new issue with plausible user-facing impact — a regression introduced by R17-2. All R17 fixes verified correct (R17-1 clearGraphqlSchema is solid). 8 new angles checked (duplicate env imports, tab label derivation, recent endpoint scaling, backgrounded polling, schema explorer navigation, non-JSON server responses, auth popover reset, header toggle persistence) — all clean. Profile + endpoint interaction verified correct.

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R18-1 | `GraphqlStudioPage.tsx` | **Medium — Endpoint persistence ignores env change on remount**: R17-2's endpoint restore always takes the saved value from localStorage. If the user switches the app env/microservice selector while GraphQL Studio is unmounted (or on full reload), the saved endpoint from the old env takes priority — Execute/Introspect silently hit the wrong server. The `prevBaseUrlRef` sync effect can't detect this because it initializes to the current `resolvedBaseUrl` on mount. | Added `ENDPOINT_BASE_STORAGE_KEY` (`gql_endpoint_base_v1`) to persist the last auto-synced base URL. On mount, if the saved endpoint equals the saved base URL (i.e. was auto-synced, not manually edited) and `resolvedBaseUrl` has changed, the new `resolvedBaseUrl` is used instead. The sync effect now also writes the base key whenever it auto-updates. |

### Comprehensive Round 19 (2026-06-17) — 2 bugs fixed

Audit identified 1 definite and 1 borderline issue — both fixed. All R18 fixes verified correct across 7 endpoint persistence scenarios (fresh, same-env restore, env-change restore, manual-edit restore, profile load). Full sweep of 7 new angles (cleared endpoint reload, prettify on malformed queries, Monaco mount failure, large SDL copy, localStorage full, special char endpoints, polling persistence) all passed.

| ID | Files | Issue & Impact | Fix |
|---|---|---|---|
| BUG-GQL-R19-1 | `GraphqlStudioPage.tsx` | **Medium — Profile load doesn't pin endpoint against env auto-sync**: Loading a connection profile sets the endpoint, but doesn't mark it as "manually set." If the profile's endpoint happens to equal the current env base URL, switching the app env silently overwrites the profile's endpoint with the new env's base URL — while auth from the profile remains, creating a mismatched connection. | On profile load, set `prevBaseUrlRef.current` to a sentinel value (`'\0profile-pinned'`) that can't match any `resolvedBaseUrl`, and remove `ENDPOINT_BASE_STORAGE_KEY` so remount also treats it as manual. |
| BUG-GQL-R19-2 | `GraphqlConnectionBar.tsx` | **Medium — Polling config hidden when schema not loaded**: The polling config button is rendered inside the `schemaStatus === 'loaded'` block. If polling is enabled and introspection subsequently fails or the endpoint changes, there's no UI to turn polling off — background requests continue with no user control. | Added a standalone polling config button that renders when `pollingEnabled && schemaStatus !== 'loaded'`, allowing users to access the polling popover to disable it regardless of schema state. |

---

## 23. Phase 2 Comprehensive Evaluation

> **Evaluation date**: 2026-06-17  
> **Evaluator**: AI-assisted competitive analysis + technical feasibility review  
> **Scope**: All 7 sub-phases (2A–2G), 44 total tasks, estimated ~20 files / ~4500 LOC

### 23.1 Executive Summary

Phase 2 as currently planned is **significantly overscoped**. It bundles 7 distinct feature areas (subscriptions, SSE, subscription UI, incremental delivery, file upload, visual query builder, performance tracing) totaling 44 tasks — roughly **3× the scope of Phase 1** (which itself required 19 re-evaluation rounds). This evaluation recommends splitting Phase 2 into **two sub-releases (2.0 and 2.1)**, re-prioritizing based on user value and competitive positioning, and addressing several technical risks identified through competitive research.

### 23.2 Competitive Landscape Analysis (June 2026)

#### 23.2.1 Subscription Testing

| Tool | WS Subscriptions | SSE | Protocol Auto-detect | Auth in WS | Reconnect | Message Assertions | Latency Stats |
|------|------------------|-----|---------------------|------------|-----------|-------------------|---------------|
| **Hoppscotch** | Excellent | Excellent | Yes | Yes | Basic | No | No |
| **Altair** | Good | No | No | Yes | No | No | No |
| **Postman** | Improved (v11) | Yes | No | Yes | Basic | Limited (scripts) | No |
| **Insomnia** | Basic/Limited | No | No | Limited | No | No | No |
| **Bruno** | No | No | No | No | No | No | No |
| **GraphiQL** | No | No | No | No | No | No | No |
| **RedfireForge (planned)** | Full (modern+legacy) | Yes | Yes (close-code based) | Yes (connectionParams) | Exponential backoff | JSONPath live assertions | Yes (msg/sec, P50/P95) |

**Takeaway**: Hoppscotch leads in subscription testing but lacks structured assertions and latency metrics. RedfireForge's planned subscription feature would be **best-in-class** with the assertion panel and stats bar. The protocol auto-detection (close code `4406`/`4400` → legacy fallback) is a genuine differentiator that no competitor offers.

**Risk**: `subscriptions-transport-ws` (the legacy Apollo package) is **deprecated and unmaintained** since 2022. While backward compatibility is valuable for teams with Apollo Server ≤v3, the maintenance burden is real. Recommend implementing as P2 (not P0/P1) and documenting it as "legacy compat" with a deprecation notice.

#### 23.2.2 Visual Query Builder

| Tool | Visual Builder | Bidirectional Sync | Fragments | Directives | Union/Interface | Args UI |
|------|---------------|-------------------|-----------|-----------|----------------|---------|
| **Bruno** | Yes (sidebar) | Yes (editor ↔ builder) | No | No | Inline fragments | Basic |
| **GraphQL Editor** | Yes (block-based) | Yes (visual ↔ code) | No | No | No | No |
| **gqlvis** | Yes (queries only) | No | No | No | No | Basic |
| **Altair** | No | N/A | N/A | N/A | N/A | N/A |
| **Postman** | No | N/A | N/A | N/A | N/A | N/A |
| **Hoppscotch** | No | N/A | N/A | N/A | N/A | N/A |
| **RedfireForge (planned)** | Yes (3-column) | One-way (builder → editor) | Yes (create/use/unused warning) | Yes (@skip/@include/@defer) | Yes (inline fragments) | Full (type-matched widgets) |

**Takeaway**: Bruno is the current leader with bidirectional sync, but its builder is limited (no fragments, no directives, max 7 levels). RedfireForge's planned builder is the most ambitious — but also the most complex to implement. The 11-task spec includes P2 features (fragments, directives, aliases, union support, persistence) that could easily double the estimated LOC.

**Recommendation**: Ship a **Minimum Viable Builder** (2F-1 through 2F-5 + 2F-9) first, then iterate. Fragment and directive support (2F-6, 2F-7, 2F-8) are low-usage features that add significant complexity. Bruno doesn't have them and is still considered best-in-class.

**Bruno's key insight**: Their builder is limited to 7 nesting levels and doesn't support complex list input arguments — these are reasonable constraints that keep the implementation manageable. Consider adopting similar pragmatic limits.

#### 23.2.3 Incremental Delivery (`@defer` / `@stream`)

| Tool | @defer Support | @stream Support | Skeleton UI | Chunk Tracker | Multipart Parser |
|------|---------------|----------------|-------------|---------------|-----------------|
| **Apollo Studio** | Yes (paid) | Yes (paid) | Yes | Basic | Built-in |
| **Hoppscotch** | No | No | No | No | No |
| **Altair** | No | No | No | No | No |
| **Postman** | No | No | No | No | No |
| **GraphiQL** | Partial (plugin) | No | No | No | No |
| **RedfireForge (planned)** | Yes | Yes | Yes (shimmer) | Yes (per-chunk timing) | `meros` |

**Takeaway**: This is a strong differentiator — **no free tool supports `@defer`/`@stream` with good UX**. Apollo Studio does but requires a paid account. However, the specification is **still not finalized** (June 2026):

- The `graphql` JS reference implementation is at v17.0.0-alpha.9 for the format
- Apollo Client ships 3 different incremental delivery handlers (`Defer20220824Handler`, `GraphQL17Alpha2Handler`, `GraphQL17Alpha9Handler`) because the wire format keeps changing
- The GraphQL over HTTP spec RFC for incremental delivery is still draft

**Risk**: Implementing against an unstable spec means potential rework when the spec finalizes. The `meros` library handles the multipart parsing, but the **patch merge semantics** (how to apply `path`-based patches to the accumulated result) have changed across spec versions.

**Recommendation**: Keep `@defer`/`@stream` at P1 priority but **design the multipart parser to be version-aware**. Support the latest spec version (alpha.9 format) as default, with a connection-level "incremental delivery format" dropdown for servers running older versions. This future-proofs against spec changes.

#### 23.2.4 File Upload

| Tool | Multipart Upload | Drag-and-Drop | Progress | Size Validation | Multi-file |
|------|-----------------|--------------|----------|----------------|------------|
| **Altair** | Yes (spec-compliant) | No | No | No | Yes (dot notation) |
| **Postman** | Yes | Yes | No | No | Yes |
| **Hoppscotch** | No | No | No | No | No |
| **Bruno** | No | No | No | No | No |
| **Insomnia** | Limited | No | No | No | No |
| **RedfireForge (planned)** | Yes (spec-compliant) | Yes | Yes (streaming) | Yes (client-side) | Yes |

**Takeaway**: Altair is the reference implementation for file upload UX. RedfireForge's plan goes further with drag-and-drop, progress indicators, and client-side size validation. The `graphql-multipart-request-spec` is **stable and mature** (v1.0.0 since 2019, widely implemented across Go/Node/Python/Ruby/.NET servers).

**Recommendation**: Solid plan. Keep as-is. The progress indicator (2E-4, P2) is a nice-to-have that can ship separately.

#### 23.2.5 Performance & Tracing

| Tool | Apollo Tracing Waterfall | OpenTelemetry Viz | Query Complexity | Latency Histogram |
|------|------------------------|-------------------|-----------------|-------------------|
| **Apollo Studio** | Yes (deprecated format) | Yes (via GraphOS) | Yes | Yes (paid) |
| **Altair** | No | No | No | No |
| **Hoppscotch** | No | No | No | No |
| **GraphiQL** | No | No | No | No |
| **RedfireForge (planned)** | Yes (waterfall Gantt) | No | Yes (AST-based) | Yes (in-memory) |

**CRITICAL FINDING**: The plan references `extensions.tracing` (Apollo Tracing format) which is **officially deprecated** by Apollo. Modern GraphQL servers use **OpenTelemetry** for performance tracing, which exports trace data to external observability platforms (Jaeger, SigNoz, Grafana Tempo) rather than embedding it in the GraphQL response.

However, many existing servers (especially Apollo Server ≤v3, GraphQL Yoga, Mercurius) still emit the legacy `extensions.tracing` format. This is analogous to how browsers still support legacy web APIs.

**Recommendation**:
1. **Keep the Apollo Tracing waterfall** (2G-1) but rename it "Tracing Waterfall" and document it as supporting the legacy `extensions.tracing` format
2. **Add OpenTelemetry integration consideration** as a Phase 3+ item — parse `extensions.opentelemetry` or `extensions.tracing` (whichever is present)
3. The query complexity estimator (2G-2) is valuable and unique — keep it. No free tool does client-side cost estimation.
4. The latency histogram (2G-3) is a nice-to-have; defer to Phase 2.1

### 23.3 Technical Risk Assessment

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| **`@defer`/`@stream` spec instability** | High | Rework when spec finalizes; patch merge format may change | Version-aware parser; default to latest alpha; connection-level format override |
| **`subscriptions-transport-ws` unmaintained** | Medium | No security patches; may break with newer Node/browser versions | Implement as P2 legacy compat; advise users to migrate servers to `graphql-ws` |
| **Proxy server routes missing** | High | 4 sub-phases (2A, 2B, 2D, 2E) require new Express routes in `src-server/` which doesn't exist in the current codebase | Must scaffold `src-server/routes/graphql/` before starting subscription or upload work; this is a hidden dependency |
| **Tauri WebSocket support** | Medium | WS subscriptions through Tauri's IPC proxy are architecturally different from browser native WebSocket | Design `graphqlClient.ts` transport layer with Tauri IPC adapter; test both platforms early |
| **Query Builder scope creep** | High | 11 tasks including union/interface fragments, directives, persistence — could easily become 2000+ LOC component tree | Ship MVP builder (6 tasks) first; iterate on advanced features |
| **Monaco bundle growth** | Medium | Adding `graphql-ws`, `subscriptions-transport-ws`, `graphql-sse`, `meros`, `extract-files` adds ~150KB gzipped | Lazy-load subscription/upload code paths; code-split by feature |
| **Apollo Tracing deprecation** | Low | `extensions.tracing` may disappear from future server versions | Support both `extensions.tracing` and `extensions.opentelemetry`; graceful fallback |
| **Browser WebSocket subprotocol handling** | Low | Safari/Firefox may handle subprotocol negotiation differently | Use `graphql-ws` client library (handles cross-browser quirks internally) |

### 23.4 Dependency Audit

| Package | Plan Version | Latest (June 2026) | Status | Bundle Impact | Notes |
|---------|-------------|---------------------|--------|---------------|-------|
| `graphql-ws` | `^6.x` | `6.0.8` | Active, MIT | ~12KB gzip | Zero-dependency; modern protocol only. Maintained by The Guild. |
| `subscriptions-transport-ws` | `^0.11.x` | `0.11.0` | **Deprecated** (no updates since 2022) | ~15KB gzip | Legacy Apollo protocol. Consider vendoring or wrapping to avoid dependency on unmaintained package. |
| `graphql-sse` | `^2.x` | `2.5.x` | Active, MIT | ~8KB gzip | Same author as `graphql-ws` (The Guild). SSE transport spec compliant. |
| `meros` | `^1.x` | `1.3.x` | Active, MIT | ~3KB gzip | Zero-dependency multipart parser. Used by Relay, Urql. Stable since 2020. |
| `extract-files` | `^13.x` | `13.0.0` | Stable, MIT | ~2KB gzip | Mature; no changes needed. Used by `apollo-upload-client`. |

**Total new bundle impact**: ~40KB gzipped (acceptable for code-split lazy loading)

**Missing from plan**: No `jsonpath-plus` dependency listed for 2C-5 assertion panel and 2G-1 tracing waterfall path extraction. The project already uses `src/shared/utils/jsonPath.ts` — verify it covers the needed operations or add `jsonpath-plus` to the dependency list.

### 23.5 Recommended Phase Split

The original Phase 2 scope (~4500 LOC, 44 tasks) is too large for a single development cycle. Recommend splitting into two increments:

#### Phase 2.0 — Subscriptions + File Upload (Core Protocol Parity)
**Estimated**: ~16 files, ~2600 LOC, 22 tasks

| Sub-phase | Tasks | Priority | Rationale |
|-----------|-------|----------|-----------|
| **2A — WebSocket Subscriptions** | 2A-1 through 2A-9 | P0–P2 | Core protocol feature; biggest competitive gap vs Hoppscotch |
| **2B — SSE Subscriptions** | 2B-1 through 2B-4 | P1 | Same transport abstraction; small incremental effort after 2A |
| **2C — Subscription UI** | 2C-1 through 2C-4 | P0–P1 | Required to surface subscription data; assertion panel (2C-5) deferred to 2.1 |
| **2E — File Upload** | 2E-1 through 2E-3, 2E-5 | P1 | Independent of subscriptions; high user demand; Altair already has this |

**Why this grouping**: These features share the proxy server infrastructure (new routes in `src-server/`), share the transport abstraction (`graphqlClient.ts`), and together bring RedfireForge to **protocol parity** with Hoppscotch and Altair. They also enable cross-protocol testing workflows (the app's unique value proposition).

#### Phase 2.1 — Query Builder + Performance (Developer Productivity)
**Estimated**: ~11 files, ~2550 LOC, 22 tasks

| Sub-phase | Tasks | Priority | Rationale |
|-----------|-------|----------|-----------|
| **2F — Visual Query Builder** | 2F-1 through 2F-5, 2F-9 (MVP) | P1 | Competitive with Bruno; defer 2F-6/7/8/10/11 to post-2.1 |
| **2D — Incremental Delivery** | 2D-1 through 2D-5 | P1 | Depends on execution engine maturity; spec more stable by then |
| **2G — Performance & Tracing** | 2G-1 through 2G-2 | P2 | Nice-to-have; defer histogram (2G-3/4/5) to Phase 3 |
| **2C-5** — Subscription Assertions | 1 task | P2 | Deferred from 2.0; requires assertion engine shared with test runner |
| **2E-4** — Upload Progress | 1 task | P2 | Nice-to-have polish for file upload |

**Why this grouping**: These features are about **developer productivity and advanced UX** rather than core protocol support. They can ship independently and benefit from the execution engine stability established in Phase 2.0.

### 23.6 Detailed Task-by-Task Evaluation

#### 2A — WebSocket Subscriptions (9 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2A-1 | P0 | WS proxy route is a **hard prerequisite** for all subscription work. Must handle subprotocol negotiation, bidirectional relay, and multiplexing. | High — `src-server/` routes don't exist in current codebase | Scaffold `src-server/routes/graphql/` directory structure first. Consider Express + `ws` library (already in project deps). |
| 2A-2 | P0 | Modern `graphql-ws` client integration. Well-documented library with browser + Node support. | Low | Straightforward — `graphql-ws` v6.0.8 has clean `createClient()` API. Use `subscribe()` → `AsyncIterator` pattern as specified. |
| 2A-3 | P1 | Legacy `subscriptions-transport-ws` client. Package is deprecated (no updates since 2022). | Medium — may have unfixed bugs; no security patches | Implement but document as "legacy compatibility". Consider a thin adapter wrapping the deprecated package rather than deep integration. Explore vendoring the minimal client code (~200 lines) to avoid depending on an unmaintained package. |
| 2A-4 | P1 | Protocol auto-detection via close codes. Clever approach — no competitor does this. | Low | Well-specified. Close codes `4406`/`4400` are documented in the `graphql-ws` protocol spec. Add a 2-second timeout for the initial `connection_ack` to detect non-responsive servers. |
| 2A-5 | P0 | Subscription state machine (`idle → connecting → ... → error`). Core hook architecture. | Low | 7-state FSM is well-specified. Use `useReducer` for state machine pattern (matches existing `useWebsocketState` in the project). |
| 2A-6 | P1 | Exponential backoff reconnect. Standard pattern. | Low | Use the formula as specified. Add `AbortController` integration so disconnecting during backoff cancels the timer cleanly. |
| 2A-7 | P1 | Connection status pill in connection bar. UI component. | Low | Reuse the existing connection bar badge pattern from `GraphqlConnectionBar.tsx`. Add `data-testid` selectors to `GQL` namespace. |
| 2A-8 | P1 | `connection_init` auth via `connectionParams`. | Low | `buildConnectionParams(auth)` is a simple mapping from `GraphqlAuth` to a plain object. `4401` → permanent error is correct per spec. |
| 2A-9 | P2 | `wsEndpoint` URL derivation helper. | Low | Simple string replacement (`https→wss`, `http→ws`). Already typed on `GraphqlConnection`. |

**Verdict**: Well-specified. 2A-1 is the critical path blocker. Recommend starting with 2A-1 + 2A-2 + 2A-5 as the first sprint.

#### 2B — SSE Subscriptions (4 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2B-1 | P1 | Add `graphql-sse` dependency. Trivial. | None | — |
| 2B-2 | P1 | SSE transport via `graphql-sse` `createClient()`. Same author as `graphql-ws`. | Low | Clean API mirroring WS transport. The `subscribe()` interface is intentionally identical. |
| 2B-3 | P1 | SSE proxy route. Simpler than WS (no upgrade handshake). | Low | Standard SSE relay. Forward `Last-Event-ID` for resumability. |
| 2B-4 | P1 | SSE mode auto-detection (URL path `/stream` heuristic). | Low | Reasonable heuristic. The manual transport override dropdown is the fallback. |

**Verdict**: Clean, small scope. Naturally follows 2A since it shares the transport abstraction.

#### 2C — Subscription UI (5 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2C-1 | P0 | Virtualized subscription log. Core UI for displaying messages. | Medium — virtualization is complex for variable-height JSON bodies | Use `react-window` or `@tanstack/virtual` (both already used in similar patterns in the project). Consider a fixed-height collapsed view with expand-on-click for JSON bodies. The mockup shows this pattern. |
| 2C-2 | P1 | Sticky stats bar (total, errors, msg/sec, duration). | Low | Simple derived state from the message buffer. Rolling 5s window for msg/sec is straightforward with a timestamp ring buffer. |
| 2C-3 | P1 | Log toolbar (Pause/Resume/Clear/Export). | Low | Standard toolbar pattern. Export as JSONL (one object per line) for large logs. |
| 2C-4 | P1 | Inline filter bar with JSONPath or full-text search. | Medium — JSONPath evaluation on every message in real-time could be expensive | Pre-filter with full-text `includes()` first; only apply JSONPath when the filter starts with `$.`. Cache compiled JSONPath expressions. Use the project's existing `src/shared/utils/jsonPath.ts` engine. |
| 2C-5 | P2 | Assertion panel with per-message pass/fail badges. | Medium — requires assertion engine integration | **Defer to Phase 2.1**. This is essentially building a mini test runner for subscription messages. Reuse `evaluateFieldOperator` from the existing validation engine rather than building a new assertion evaluator. |

**Verdict**: 2C-1 through 2C-4 are essential and well-scoped. 2C-5 is a significant feature that should be deferred.

#### 2D — Incremental Delivery (5 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2D-1 | P1 | Multipart parser using `meros`. | **High** — spec instability | `meros` handles the multipart boundary splitting, but the **patch merge semantics** (how `path` + `data` patches are applied to the accumulated result) have changed across GraphQL spec versions. Design the merge function to be pluggable. Document which spec version is supported (recommend alpha.9 / latest). |
| 2D-2 | P1 | Proxy route for `multipart/mixed` passthrough. | Medium | Must NOT buffer the response — stream chunks as they arrive. Set `Transfer-Encoding: chunked` and `Content-Type: multipart/mixed; boundary="-"`. |
| 2D-3 | P1 | Response viewer with skeleton/shimmer on deferred fields. | **High** — complex UI state | Requires tracking which response paths are pending vs resolved. The shimmer → fill animation needs to handle deeply nested objects and list items. Consider a progressive disclosure approach: show the accumulated JSON with `/* pending */` placeholders, then animate the replacement. |
| 2D-4 | P2 | Chunk tracker toolbar. Nice-to-have UI chrome. | Low | Defer to Phase 2.1. The response viewer (2D-3) provides the essential functionality. |
| 2D-5 | P1 | `hasIncrementalDirective()` utility for conditional `Accept` header. | Low | Straightforward `graphql.parse()` + `graphql.visit()` check. |

**Verdict**: High complexity, high differentiation. Recommend deferring to Phase 2.1 when the spec is more stable and the execution engine is more mature.

#### 2E — File Upload (5 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2E-1 | P1 | Files tab in Variables panel with drag-and-drop. | Low | Standard `dragenter/dragover/drop` event handling + `<input type="file">`. The auto-injection of `null` into Variables JSON is a nice touch that matches the spec exactly. |
| 2E-2 | P1 | Client-side multipart construction using `extract-files`. | Low | Well-documented pattern. `extract-files` + `FormData` construction is ~30 lines of code. |
| 2E-3 | P1 | Upload proxy route with `busboy`. | Medium | `busboy` streams file bytes without buffering — important for large files. Must reconstruct the multipart request targeting the upstream server. |
| 2E-4 | P2 | Upload progress indicator. | Medium — requires streaming proxy progress reporting | Defer to Phase 2.1. The `X-Upload-Progress` header approach is non-standard; consider using `ReadableStream` with a `TransformStream` that counts bytes instead. |
| 2E-5 | P1 | Client-side file size validation. | Low | Check `file.size` on selection. Straightforward. |

**Verdict**: Well-specified, moderate complexity. The core (2E-1/2/3/5) can ship independently. Progress indicator (2E-4) is polish.

#### 2F — Visual Query Builder (11 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2F-1 | P1 | Builder state management hook. Core architecture. | Medium | Complex state shape (`selectedFields` path map, `argValues`, `aliases`, `directives`, `fragments`). Design for extensibility but ship with minimal state (selectedFields + argValues only). |
| 2F-2 | P1 | SDL generator from state. Core algorithm. | Medium | Recursive selection set building with variable auto-generation. The hardest part is handling nested objects, list types, and required vs optional args correctly. |
| 2F-3 | P1 | Field selector tree component. Core UI. | Medium | The checkbox + expand/collapse tree is the most complex React component. Needs efficient re-renders for large schemas (500+ types). Consider `React.memo` on tree nodes. |
| 2F-4 | P1 | Argument inputs with type-matched widgets. | Medium | Need to map GraphQL input types to form widgets (text, number, boolean, enum dropdown, `$varRef` toggle). Recursive for `INPUT_OBJECT` types. |
| 2F-5 | P1 | Two-step schema search. | Low | Search across all types/fields, auto-expand tree to result path. Reuse the existing schema explorer search logic. |
| 2F-6 | **P2** | Fragment panel. | **High** | Fragment management (create, name, select fields, insert spread, unused detection) is a mini-feature on its own. **Defer to post-2.1.** Bruno doesn't have this and is still considered excellent. |
| 2F-7 | **P2** | Directive toggles (`@skip`/`@include`). | **High** | Requires variable auto-creation, popover UI per field, and complex SDL generation changes. **Defer to post-2.1.** |
| 2F-8 | **P2** | Alias support. | Medium | Inline text input per field. Simpler than fragments/directives but still adds complexity. **Defer to post-2.1.** |
| 2F-9 | P1 | "Edit in Editor" escape hatch. | Low | One-way SDL promotion to Monaco. Essential for the builder to be useful without being feature-complete. |
| 2F-10 | **P2** | Union/Interface inline fragment support. | **High** | Complex selection model with `__on_TypeName` path convention. **Defer to post-2.1.** |
| 2F-11 | **P2** | Builder state persistence. | Medium | localStorage keyed by tab ID. **Defer to post-2.1** until the state shape is stable. |

**Verdict**: Ship MVP builder (2F-1 through 2F-5 + 2F-9 = 6 tasks) in Phase 2.1. Defer advanced features (2F-6/7/8/10/11 = 5 tasks) to a later iteration. This matches Bruno's pragmatic approach — their builder works great without fragments, directives, or union support.

#### 2G — Performance & Tracing (5 tasks)

| Task | Priority | Evaluation | Risk | Recommendation |
|------|----------|------------|------|----------------|
| 2G-1 | P2 | Apollo Tracing waterfall from `extensions.tracing`. | Medium — **format is deprecated** | Rename to "Tracing Waterfall". Support both `extensions.tracing` (legacy Apollo) and future `extensions.opentelemetry` (emerging standard). The Gantt chart visualization is valuable regardless of the source format. |
| 2G-2 | P2 | Query complexity estimator. | Low | AST-based cost calculation (scalar +1, object +2, list × multiplier, depth penalty) is straightforward with `graphql.visit()`. The cost badge is a unique differentiator — **no free tool has this**. |
| 2G-3 | P2 | Response time histogram. | Low | In-memory P50/P95/P99 across ≥3 executions. Use the project's existing `src/shared/utils/percentiles.ts` utilities. |
| 2G-4 | P2 | Complexity configuration UI. | Low | Inputs in connection settings popover. |
| 2G-5 | P2 | Histogram query detection via normalized hash. | Low | `print(parse(query))` → SHA-256 via `crypto.subtle`. |

**Verdict**: All P2 priority. Ship in Phase 2.1. The complexity estimator (2G-2) is the highest-value item — consider promoting to P1.

### 23.7 Missing Items (Not in Current Plan)

| Item | Priority | Rationale |
|------|----------|-----------|
| **Proxy server scaffolding** | P0 (prerequisite) | 4 sub-phases require new Express routes in `src-server/routes/graphql/` but no task covers creating the route directory, adding Express middleware, or registering routes. This is a hidden dependency. |
| **Tauri IPC adapters for WS/SSE** | P1 | The plan mentions Tauri compatibility but doesn't specify how WS subscriptions work through the Tauri IPC bridge. Need `invoke('graphql_subscribe', {...})` Rust command and IPC message relay. |
| **`graphqlClient.ts` transport abstraction** | P0 | Plan references this file but no task explicitly creates the unified transport layer that abstracts HTTP/WS/SSE/Tauri behind a common interface. 2A-2, 2A-3, 2B-2 all add to it but there's no "create `graphqlClient.ts`" task. |
| **Connection-level incremental delivery format selector** | P1 | Per Section 23.2.3 — the `@defer`/`@stream` wire format isn't standardized. Need a dropdown in connection settings to select between format versions. |
| **OpenTelemetry trace parsing** | P2 (future) | Apollo Tracing is deprecated. Plan should acknowledge OpenTelemetry as the future standard and reserve space for `extensions.opentelemetry` parsing. |
| **Subscription message export format** | P1 | 2C-3 says "Export JSON download" but doesn't specify the format. Recommend JSONL (one message per line) for streaming-friendly large exports, with an array wrapper option for small exports. |
| **`localStorage` → `storage.ts` migration** | P1 | Phase 1 uses direct `localStorage` calls in several hooks/utils. Phase 2 should migrate to the project's `src/utils/storage.ts` abstraction for Tauri compatibility. Existing hooks: `useGraphqlConnectionProfiles`, `useGraphqlEnvironments`, `useRecentEndpoints`, `tabPersistence.ts`. |

### 23.8 Updated Risk Assessment (Additions to Section 18)

| Risk | Impact | Mitigation |
|------|--------|------------|
| `@defer`/`@stream` spec not finalized (multiple format versions) | High | Version-aware parser; connection-level format selector; default to latest alpha; document supported versions |
| `subscriptions-transport-ws` deprecated and unmaintained | Medium | Implement as P2 legacy compat; consider vendoring minimal client code (~200 lines) to avoid external dependency on dead package |
| No `src-server/` routes exist yet | High | Must scaffold server routes before Phase 2 subscription/upload work; this is a prerequisite task not listed in the plan |
| Tauri WS/SSE subscription support requires Rust IPC commands | Medium | Design transport abstraction early; test on both platforms in Phase 2.0 |
| Apollo Tracing format (`extensions.tracing`) deprecated by Apollo | Low | Support both legacy and emerging formats; tracing waterfall is format-agnostic visualization |
| Query builder complexity (11 tasks, P2 items) | High | Ship MVP builder (6 tasks) first; defer fragments/directives/unions to post-2.1 iteration |
| Virtual scroll for subscription messages with variable-height JSON | Medium | Use fixed-height collapsed rows with expand-on-click; avoids complex dynamic-height virtualization |

### 23.9 Effort Estimates (Revised)

| Sub-phase | Original LOC Est. | Revised LOC Est. | Files | Sprint |
|-----------|-------------------|------------------|-------|--------|
| **2A — WS Subscriptions** | (bundled) | ~800 | 4 | Phase 2.0 |
| **2B — SSE Subscriptions** | (bundled) | ~300 | 2 | Phase 2.0 |
| **2C — Subscription UI (2C-1→4)** | (bundled) | ~600 | 3 | Phase 2.0 |
| **2E — File Upload (core)** | (bundled) | ~500 | 3 | Phase 2.0 |
| Proxy server scaffolding | 0 (missing) | ~400 | 4 | Phase 2.0 (prerequisite) |
| **Phase 2.0 subtotal** | — | **~2600** | **16** | — |
| **2F — Query Builder (MVP)** | (bundled) | ~1200 | 4 | Phase 2.1 |
| **2D — Incremental Delivery** | (bundled) | ~600 | 3 | Phase 2.1 |
| **2G — Perf & Tracing (2G-1→2)** | (bundled) | ~400 | 2 | Phase 2.1 |
| **2C-5 — Sub Assertions** | (bundled) | ~200 | 1 | Phase 2.1 |
| **2E-4 — Upload Progress** | (bundled) | ~150 | 1 | Phase 2.1 |
| **Phase 2.1 subtotal** | — | **~2550** | **11** | — |
| **Phase 2 total** | ~4500 | **~5150** | **27** | — |

The revised total is ~15% higher than the original estimate, primarily due to the missing proxy server scaffolding and the expanded query builder scope. This further supports the case for splitting into two increments.

### 23.10 Implementation Order (Recommended)

```
Phase 2.0 (Protocol Parity)
├─ Sprint 1: Proxy Server + Transport Layer
│   ├─ NEW: Scaffold src-server/routes/graphql/ (subscribe, sse, upload)
│   ├─ NEW: Create graphqlClient.ts transport abstraction
│   └─ 2A-9: wsEndpoint derivation helper
├─ Sprint 2: WebSocket Subscriptions
│   ├─ 2A-1: WS proxy route
│   ├─ 2A-2: graphql-ws client integration
│   ├─ 2A-5: useGraphqlSubscription state machine
│   └─ 2A-4: Protocol auto-detection
├─ Sprint 3: Subscription UI + SSE
│   ├─ 2C-1: Subscription log (virtualized)
│   ├─ 2C-2: Stats bar
│   ├─ 2C-3: Log toolbar
│   ├─ 2B-1→4: SSE transport (shares UI with WS)
│   └─ 2A-6→8: Reconnect, status pill, auth
├─ Sprint 4: File Upload
│   ├─ 2E-1: Files tab UI
│   ├─ 2E-2: Multipart construction
│   ├─ 2E-3: Upload proxy route
│   ├─ 2E-5: Client-side validation
│   └─ 2C-4: Subscription filter bar
└─ Sprint 5: Polish + Testing
    ├─ 2A-3: Legacy protocol compat
    ├─ Unit tests for all new hooks/utils
    └─ localStorage → storage.ts migration

Phase 2.1 (Developer Productivity)
├─ Sprint 6: Query Builder MVP
│   ├─ 2F-1: Builder state hook
│   ├─ 2F-2: SDL generator
│   ├─ 2F-3: Field selector tree
│   ├─ 2F-4: Argument inputs
│   └─ 2F-5: Schema search
├─ Sprint 7: Incremental Delivery
│   ├─ 2D-1: Multipart parser
│   ├─ 2D-2: Proxy passthrough
│   ├─ 2D-3: Response viewer shimmer
│   ├─ 2D-5: @defer detection
│   └─ 2F-9: "Edit in Editor" escape hatch
└─ Sprint 8: Performance + Polish
    ├─ 2G-1: Tracing waterfall
    ├─ 2G-2: Complexity estimator
    ├─ 2C-5: Subscription assertions
    ├─ 2E-4: Upload progress
    └─ Unit tests + E2E tests
```

### 23.11 Deferred Items (Post Phase 2.1)

These tasks from the original Phase 2 plan should be deferred until the MVP features are stable and user feedback is collected:

| Task | Original Priority | Reason for Deferral |
|------|------------------|---------------------|
| 2F-6 — Fragment panel | P2 | High complexity; Bruno succeeds without it |
| 2F-7 — Directive toggles | P2 | Requires variable auto-creation; complex SDL changes |
| 2F-8 — Alias support | P2 | Medium complexity; low usage frequency |
| 2F-10 — Union/Interface inline fragments | P2 | Very complex selection model; most schemas don't need it |
| 2F-11 — Builder state persistence | P2 | Wait until state shape is stable |
| 2G-3 — Response time histogram | P2 | Nice-to-have; latency data already shown in response viewer |
| 2G-4 — Complexity configuration UI | P2 | Ship with hardcoded defaults first; add config later |
| 2G-5 — Histogram query detection | P2 | Depends on 2G-3 |
| 2D-4 — Chunk tracker toolbar | P2 | Nice-to-have; response viewer provides essential info |

### 23.12 Key Competitive Differentiators After Phase 2

If Phase 2.0 + 2.1 ship as recommended, RedfireForge's GraphQL Studio will be the **only free tool** that offers:

1. **Subscription protocol auto-detection** (modern `graphql-transport-ws` → legacy `graphql-ws` fallback via close codes) — no competitor does this
2. **Live subscription message assertions** with JSONPath rules and per-message pass/fail badges — Hoppscotch has no assertion support
3. **`@defer`/`@stream` incremental delivery** with skeleton UI — only Apollo Studio (paid) has this
4. **Client-side query complexity estimation** with cost badge — unique feature, no competitor
5. **Visual query builder** with type-matched argument widgets — on par with Bruno, better than Altair/Postman
6. **Cross-protocol in one app** (GraphQL + WebSocket + Kafka + SSE) — only Hoppscotch comes close (no Kafka), Postman has it all but is paid/bloated
7. **File upload with drag-and-drop + client-side validation** — matches Altair, exceeds Hoppscotch/Postman
8. **Native desktop** (Tauri ~15MB) vs Altair (Electron ~200MB+) vs Hoppscotch (Electron)


### 23.13 Phase 2 Re-evaluation Round 2 (2026-06-17)

> **Scope**: Cross-referenced Phase 2 plan (2A–2G) against existing WebSocket/SSE/Kafka studio architectures, mockup UIs, shared types, selectors, success criteria, and testing strategy. Found **28 additional gaps** not caught in the initial evaluation.

#### 23.13.1 Architecture Alignment — Phase 1 vs Phase 2 Transport Model

**CRITICAL FINDING**: Phase 1 and Phase 2 use fundamentally different server architectures, and the plan does not acknowledge or bridge this gap.

| Concern | Phase 1 (actual) | Phase 2 (planned) | Existing WS/Kafka Studios |
|---------|-----------------|-------------------|--------------------------|
| Query transport | `gqlFetch` → `httpFetch` → Vite `/__proxy` plugin (direct) | `POST /api/graphql/query` (Express route) | Kafka: always Express `/api/kafka/*`; SSE: direct `fetch` |
| Server routes | **None** — no `src-server/routes/graphql/` | WS subscribe, SSE, upload, batch, multipart | WS: `/api/ws/*` (6 routes); Kafka: `/api/kafka/*` (12+ routes) |
| Auth injection | Client-side `buildAuthHeaders()` → headers on `POST` | WS: `connection_init_payload`; HTTP: same as Phase 1 | WS: both client-side + proxy `resolvedAuth`; Kafka: always server-side |
| TLS handling | `skipTlsVerify` → `/__proxy` passthrough | Same + WS proxy needs TLS config | WS: server-side TLS via `ws` options |
| Streaming | Not needed (request-response only) | Required for SSE, `@defer`/`@stream` | SSE Studio: `fetch` + `ReadableStream`; WS: native `WebSocket` or cursor poll |

**Recommended resolution**: Phase 2 should adopt a **dual-path architecture**:
1. **HTTP queries/mutations**: Keep Phase 1's `gqlFetch` → `/__proxy` model (proven, working)
2. **WS subscriptions**: Choose between extending `/api/ws/*` proxy (reuse existing infra) or creating new `/api/graphql/subscribe` (cleaner separation). Decision should be a new prerequisite task.
3. **SSE subscriptions**: Direct browser `fetch` + `ReadableStream` (matching SSE Studio pattern) when no auth headers needed; proxy route when auth required
4. **`@defer`/`@stream`**: Direct browser `fetch` with streaming body — `httpFetch` in `httpClient.ts` calls `.text()` which **buffers the entire response** and cannot support incremental delivery. Must use raw `fetch` + `meros` parsing.

#### 23.13.2 httpClient.ts Streaming Limitation

`httpClient.ts` (`httpFetch`) reads response bodies with `.text()`, which buffers the complete response before returning. This is **incompatible** with:

- **2B — SSE Subscriptions**: Requires `ReadableStream` chunked reading (SSE Studio's `useSseConnection` pattern)
- **2D — `@defer`/`@stream`**: Requires `multipart/mixed` streaming via `meros`

**New prerequisite task needed**: Add a `fetchStream()` function to `httpClient.ts` (or a dedicated `streamingFetch.ts`) that returns the raw `Response` object for streaming consumption, with the same auth/TLS/proxy routing logic. Reference: SSE Studio's approach in `useSseConnection.ts`.

#### 23.13.3 Existing Protocol Studio Reuse Opportunities

The re-evaluation found **significant reuse opportunities** that the plan doesn't call out:

| Component / Hook | Source | Reuse for Phase 2 | Effort saved |
|-----------------|--------|-------------------|-------------|
| `@tanstack/react-virtual` virtual list pattern | `WebSocketMessageLog.tsx`, `SseMessageLog.tsx` | 2C-1 `GraphqlSubscriptionLog` | ~200 LOC |
| `useWebSocketReconnect` exponential backoff | `useWebSocketReconnect.ts` | 2A-6 reconnect logic | ~100 LOC |
| `wsAuthResolve` auth resolution for connections | `wsAuthResolve.ts` | 2A-8 `connectionParams` auth | ~50 LOC |
| WS proxy service ring buffer + cursor model | `websocket-service.ts` | 2A-1 proxy approach (if chosen) | ~300 LOC |
| SSE event parser | `sseParser.ts` | 2B-2 SSE transport (if custom needed) | ~80 LOC |
| Filter bar pattern (text/regex/jsonpath) | `WebSocketMessageLog.controls.tsx` | 2C-4 subscription filter | ~150 LOC |
| Metrics/stats hook | `useWebSocketMetrics.ts` | 2C-2 stats bar | ~100 LOC |
| Detail panel / JSON syntax highlighting | `WsFrameDetail.tsx` | 2C-1 message body display | ~100 LOC |

**Recommendation**: Before building `GraphqlSubscriptionLog`, extract shared primitives from `WebSocketMessageLog` (virtual list base, filter bar, detail panel) into `src/shared/components/protocol-log/`. This avoids duplicating ~1000 LOC of proven UI code.

#### 23.13.4 Existing WS Studio graphql-ws Support

WS Studio already has **partial graphql-over-WS support** that Phase 2 should leverage:
- Auto-sends `connection_init` on connect (`buildGqlWsInitAction`)
- Parses WS frames into `protocolMeta` with graphql-specific fields (`buildGqlWsMeta`)
- Recognizes `graphql-ws` as a protocol mode

This is **framing/display only** — it does NOT implement the subscription lifecycle (`subscribe` → `next` → `complete`). Phase 2's `useGraphqlSubscription` hook is genuinely new work, but the frame-level parsing can be referenced.

#### 23.13.5 Success Criteria Gaps (Criteria Without Implementation Tasks)

The following Phase 2 success criteria from Section 10 are **not backed by any task in 2A–2G**:

| # | Success Criterion (§10 Phase 2) | Missing Task |
|---|---|----|
| 8 | "Combining `@defer` and file upload in the same operation triggers a pre-execution validation error" | **No task exists**. Need new task in 2D or 2E: pre-execution check that `hasIncrementalDirective(query) && hasFileUploads(files)` → show inline error + disable Execute. |
| — | Subscribe/Disconnect button for subscription operations | **No task specifies the Subscribe/Disconnect buttons in the connection bar**. 2A-7 covers a status pill, but no task covers swapping Execute → Subscribe when `operationType === 'subscription'`, or adding a Disconnect button. |
| — | Subscription view integration into `GraphqlStudioPage` | **No task describes how the subscription log replaces/augments the response viewer** when operating in subscription mode. Currently the right pane is Response/Schema tabs; subscriptions need a third "Subscription Log" tab or automatic switching. |
| — | `subscriptionBufferSize` settings UI | Type exists on `GraphqlConnection` (line 23), but **no task creates a UI to configure it**. Needs a numeric input in connection settings. |
| — | SSE reconnect with `Last-Event-ID` | Criterion 18 expects SSE reconnect with `Last-Event-ID` forwarding. Task 2B-3 mentions it, but **no dedicated SSE reconnect logic task** exists — it's assumed the shared FSM (2A-5) handles it, but SSE reconnect semantics differ from WS (no close codes, uses `retry:` field). |

#### 23.13.6 Mockup-vs-Task Gaps

**Subscription mockup** (`graphql-subscription-testing.html`) elements not covered by tasks:

| Mockup Element | Status |
|---|---|
| `WS` badge (changes to `SSE` for SSE transport) | Not specified — add to 2A-7 |
| "Disconnect" button (red, distinct from Execute) | **No task** — need new task |
| Editor header showing "SUBSCRIPTION" badge + op name + "Subscribed 2m 34s ago" | Not in 2C — add duration to editor header |
| Avg Latency stat (mockup shows `142ms`) | Plan 2C-2 has `msg/sec` but **not avg latency** — add to 2C-2 |
| "Tests Pass 4/5" stat | Covered by 2C-5 footer (deferred) |
| "8 older messages (click to expand)" collapse | Not in 2C-1 — implied by virtualization but not specified |
| Protocol version in bottom status bar | Not in 2C tasks — minor |
| SLA label ("< 500ms per message") | Not in 2C-5 — **assertion SLA mode not tasked** |

**Query Builder mockup** (`graphql-query-builder.html`) elements not covered by tasks:

| Mockup Element | Status |
|---|---|
| **Editor / Builder / Test Runner / Schema** sub-tabs at top | **No integration task** — how does the Builder tab activate? Where does it render? |
| Operation type switcher (query/mutation/subscription pills) | Implied in 2F-1 state but **no UI component task** for the switcher |
| "Copy SDL" button in toolbar | Not in 2F tasks (2F-9 is "Edit in Editor" only) |
| "Execute" button in builder toolbar | Not in 2F tasks — should it reuse `handleExecute` from page? |
| "Format (⌘⇧F)" button in preview panel | Not in 2F tasks |
| Auto-generated **Variables** preview strip below the generated query | Not in 2F tasks — plan says variables are "auto-generated from arguments" but no task creates this UI |
| **Selection Summary** panel (selected fields count, depth, args, est. complexity) | Not in 2F tasks — partially overlaps with 2G-2 complexity but is a distinct summary UI |
| `@defer` directive toggle (mockup shows it alongside `@skip`/`@include`) | 2F-7 only covers `@skip`/`@include` — **`@defer` not specified** |
| Keyboard shortcuts status bar (Space toggle, → expand, ⌘↵ execute) | Not in 2F tasks |
| Schema badge showing field count ("E-Commerce API (156 fields)") | Not in 2F tasks |

#### 23.13.7 Missing Shared Types for Phase 2

Types that Phase 2 tasks reference or imply but are **not defined in `src/shared/types/graphql.ts`**:

| Type | Needed By | Definition |
|------|-----------|------------|
| `QueryBuilderState` | 2F-1, 2F-11 | `{ selectedFields: Map<string, boolean>, argValues: Map<string, string>, aliases: Map<string, string>, directives: DirectiveApplication[], fragments: FragmentDefinition[], operationType: 'query'\|'mutation'\|'subscription', operationName: string }` |
| `FieldSelectionPath` | 2F-1, 2F-3 | `string` (dot-separated path like `user.orders.nodes.id`) or a typed path array |
| `DirectiveApplication` | 2F-7 | `{ fieldPath: string, directive: '@skip'\|'@include'\|'@defer', variable: string }` |
| `FragmentDefinition` | 2F-6 | `{ name: string, onType: string, fields: string[], isUsed: boolean }` |
| `GraphqlSubscriptionAssertion` | 2C-5 | `{ id: string, jsonPath: string, operator: string, expected: unknown, description: string }` |
| `GraphqlSubscriptionSession` | 2A-5 | `{ id: string, state: SubscriptionState, transport: string, startedAt: number, messages: GraphqlSubscriptionMessage[], stats: SubscriptionStats }` |
| `SubscriptionStats` | 2C-2 | `{ totalMessages: number, errorCount: number, avgLatencyMs: number, msgsPerSec: number, connectedDurationMs: number }` |
| `ApolloTracingData` | 2G-1 | `{ version: number, startTime: string, endTime: string, duration: number, parsing: { duration: number }, validation: { duration: number }, execution: { resolvers: ResolverTrace[] } }` |
| `ResolverTrace` | 2G-1 | `{ path: (string\|number)[], parentType: string, fieldName: string, returnType: string, startOffset: number, duration: number }` |
| `FileUploadSlot` | 2E-1 | `{ id: string, file: File, variablePath: string, sizeBytes: number, mimeType: string, error?: string }` |

#### 23.13.8 Missing Selectors

Phase 2 components need these `data-testid` selectors added to `src/shared/selectors.ts` under the `GQL` namespace:

**Subscription (2A–2C)**:
- `SUBSCRIBE_BTN` — replaces Execute when operationType is 'subscription'
- `DISCONNECT_BTN` — disconnect active subscription
- `CONNECTION_STATUS` — WS/SSE status pill with state label
- `SUBSCRIPTION_LOG` — message list container
- `SUBSCRIPTION_MSG_ROW` — individual message row
- `SUBSCRIPTION_PAUSE_BTN` — pause/resume toggle
- `SUBSCRIPTION_CLEAR_BTN` — clear log
- `SUBSCRIPTION_EXPORT_BTN` — export messages
- `SUBSCRIPTION_FILTER_INPUT` — filter text input
- `SUBSCRIPTION_STATS` — stats bar container
- `SUBSCRIPTION_STATS_TOTAL` — total message count
- `SUBSCRIPTION_STATS_LATENCY` — avg latency display
- `SUBSCRIPTION_STATS_RATE` — messages/sec rate

**Query Builder (2F)**:
- `BUILDER_TAB` — Builder sub-tab in top navigation
- `BUILDER_OP_TYPE` — operation type switcher
- `BUILDER_OP_NAME` — operation name input
- `BUILDER_FIELD_TREE` — field selector tree container
- `BUILDER_FIELD_ROW` — individual field row
- `BUILDER_FIELD_CHECK` — field checkbox
- `BUILDER_ARG_INPUT` — argument value input
- `BUILDER_SEARCH` — search input
- `BUILDER_BREADCRUMB` — type navigation breadcrumb
- `BUILDER_PREVIEW` — generated SDL preview
- `BUILDER_COPY_SDL` — copy generated SDL
- `BUILDER_EDIT_IN_EDITOR` — promote SDL to Monaco editor
- `BUILDER_EXECUTE` — execute generated query

**File Upload (2E)**:
- `FILES_TAB` — Files sub-tab in bottom panel
- `FILES_DROPZONE` — drag-and-drop zone
- `FILES_BROWSE_BTN` — file browser trigger
- `FILES_LIST` — file list container
- `FILES_ROW` — individual file row
- `FILES_REMOVE_BTN` — remove file button
- `FILES_SIZE_ERROR` — size validation error

**Incremental Delivery (2D)**:
- `DEFER_SKELETON` — skeleton placeholder for deferred field
- `CHUNK_TRACKER` — chunk progress indicator

**Performance (2G)**:
- `TRACING_TAB` — tracing view tab
- `TRACING_WATERFALL` — resolver waterfall chart
- `TRACING_SORT` — sort toggle
- `HISTOGRAM_STRIP` — latency histogram

#### 23.13.9 New Tasks to Add (Phase 2 Plan Closure)

Based on all gaps identified, the following **new tasks** should be added to the Phase 2 plan:

**Prerequisites (new sub-phase 2-PRE)**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2-PRE-1 | **Architecture decision: WS transport model** — decide between extending existing `/api/ws/*` proxy (reuse ring buffer + cursor polling) vs new `/api/graphql/subscribe` WS upgrade route (cleaner GraphQL semantics). Document decision in §9. | P0 | 2.0 |
| 2-PRE-2 | **Create `graphqlClient.ts` transport abstraction** — unified interface for HTTP query (`gqlFetch`), WS subscription (`graphql-ws` client), SSE subscription (`graphql-sse` client), with Tauri IPC adapter. All three transports implement `subscribe(operation) → AsyncIterator`. | P0 | 2.0 |
| 2-PRE-3 | **Add `fetchStream()` to `httpClient.ts`** — streaming fetch variant that returns raw `Response` for `ReadableStream` consumption (SSE, `@defer`/`@stream`). Includes same auth/TLS/proxy routing as `httpFetch()` but does not call `.text()`. | P0 | 2.0 |
| 2-PRE-4 | **Scaffold `src-server/routes/graphql/`** — directory, Express router, route registration in `webhook-server.ts`. Empty route files for `subscribe.ts`, `sse.ts`, `upload.ts`. | P0 | 2.0 |
| 2-PRE-5 | **Tauri WS subscription IPC** — decide whether Tauri uses Rust WS commands (like `ws_connect`/`ws_send`) or always proxies through localhost:3001. Add Tauri adapter to `graphqlClient.ts`. | P1 | 2.0 |
| 2-PRE-6 | **Install Phase 2 npm dependencies** — `graphql-ws@^6.x`, `graphql-sse@^2.x`, `meros@^1.x`, `extract-files@^13.x`. Add `subscriptions-transport-ws@^0.11.x` only if legacy support is confirmed. | P0 | 2.0 |
| 2-PRE-7 | **Migrate Phase 1 `localStorage` calls to `storage.ts`** — update `useGraphqlConnectionProfiles`, `useGraphqlEnvironments`, `useRecentEndpoints`, `tabPersistence.ts` to use async storage abstraction for Tauri compatibility. | P1 | 2.0 |

**Page Integration (new sub-phase 2-INT)**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2-INT-1 | **Subscribe/Disconnect buttons in connection bar** — when `operationType === 'subscription'`, swap Execute → Subscribe (green) + show Disconnect (red) when active. Reuse `handleExecute` callback pattern. | P0 | 2.0 |
| 2-INT-2 | **Subscription mode routing in right pane** — add "Subscription Log" tab to `GqlRightPane` (alongside Response/Schema). Auto-switch to Subscription Log when a subscription is active. Show "No active subscription" empty state when idle. | P0 | 2.0 |
| 2-INT-3 | **Builder sub-tab integration** — add "Builder" view mode to `GraphqlStudioPage` (Editor / Builder toggle in the left pane header). Builder replaces the Monaco editor when active. Schema required for Builder to render. | P1 | 2.1 |
| 2-INT-4 | **Files sub-tab in bottom panel** — add "Files" tab to `GqlBottomPanel` (alongside Variables/Headers). Only visible when a file upload has been configured or the mutation includes an `Upload` scalar. | P1 | 2.0 |

**Validation (new tasks in existing sub-phases)**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2D-6 | **`@defer` + file upload mutual exclusion** — in `useGraphqlExecution`, check `hasIncrementalDirective(query) && fileSlots.length > 0` before execution. Show inline error "Cannot combine @defer/@stream with file upload" and disable Execute. Add to pre-execution validation chain. | P1 | 2.1 |
| 2C-2+ | **Avg latency stat in stats bar** — add `avgLatencyMs` to stats (mockup shows "142ms"). Calculate from `offsetMs` differences between consecutive messages. | P1 | 2.0 |

**Builder UI (new tasks in 2F)**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2F-12 | **Builder toolbar UI** — operation type switcher (query/mutation/subscription pills), operation name input, schema badge ("42 types, 156 fields"), Copy SDL button, Execute button (reuses page handler). | P1 | 2.1 |
| 2F-13 | **Auto-generated variables preview** — read-only JSON strip below the generated SDL showing variables derived from argument values (e.g. `{ "userId": "{{currentUserId}}", "orderFirst": 10 }`). Edit button opens Variables panel. | P2 | Post-2.1 |
| 2F-14 | **Selection summary panel** — right-column section showing: selected field count, nesting depth, argument count, variables needed, estimated complexity (reuses 2G-2 engine). | P2 | Post-2.1 |

**Selectors & Types (new tasks)**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2-SEL-1 | **Add all Phase 2 selectors to `selectors.ts`** — subscription (13), builder (13), file upload (7), incremental delivery (2), performance (4) = 39 new constants in `GQL` namespace. See §23.13.8 for full list. | P1 | 2.0 |
| 2-TYPE-1 | **Add Phase 2 types to `graphql.ts`** — `QueryBuilderState`, `FieldSelectionPath`, `GraphqlSubscriptionSession`, `SubscriptionStats`, `ApolloTracingData`, `ResolverTrace`, `FileUploadSlot`. See §23.13.7 for definitions. | P1 | 2.0/2.1 |

**Shared Component Extraction**:

| # | Task | Priority | Sub-phase |
|---|------|----------|-----------|
| 2-SHARED-1 | **Extract shared protocol log primitives** from `WebSocketMessageLog.tsx` and `SseMessageLog.tsx` into `src/shared/components/protocol-log/` — virtual list base component, filter bar, detail panel, JSON syntax highlighter, export utility. `GraphqlSubscriptionLog` should compose these. Saves ~1000 LOC of duplication. | P1 | 2.0 |

#### 23.13.10 Plan Inconsistencies Fixed

| Issue | Location | Fix |
|------|----------|-----|
| Duplicate `useGraphqlHistory.test.ts` entry | §19 lines 4277/4279 | **Fixed** — merged into single entry |
| §19 E2E naming: `graphql-basic.spec.ts` vs §4F `graphql-query-execution.spec.ts` | §19 line 4285, §4F task 4F-5 | Flagged — reconcile when Phase 4 is planned |
| Plan §2A doc says `subscriptions-transport-ws` uses "subprotocol `graphql-ws`" but tasks say "legacy subprotocol" | §9 line 3879 | Correct as-is — the naming IS intentionally confusing (package name ≠ subprotocol name). Plan correctly documents this. |
| `subscriptionBufferSize` typed on `GraphqlConnection` but no configuration UI task | §4.3 line 23 | Added to §23.13.5 as missing task |
| Plan says `POST /api/graphql/query` proxy route but Phase 1 uses `gqlFetch` → `/__proxy` | §2A-1, §3.1 | Added to §23.13.1 — must resolve transport model |

#### 23.13.11 Updated Task Count Summary

| Category | Original Plan | After First Evaluation (§23) | After Re-evaluation |
|----------|--------------|------------------------------|---------------------|
| 2A–2G tasks | 44 | 44 (no changes, just re-prioritized) | 44 |
| New prerequisite tasks | 0 | 1 (proxy scaffolding flagged) | 7 (2-PRE-1→7) |
| New integration tasks | 0 | 0 | 4 (2-INT-1→4) |
| New validation/UI tasks | 0 | 0 | 5 (2D-6, 2C-2+, 2F-12→14) |
| New selector/type tasks | 0 | 0 | 2 (2-SEL-1, 2-TYPE-1) |
| Shared extraction task | 0 | 0 | 1 (2-SHARED-1) |
| **Total Phase 2 tasks** | **44** | **44** | **63** |

#### 23.13.12 Revised Phase Split (Updated)

**Phase 2.0** — Protocol Parity (28 tasks):
- 2-PRE-1→7 (7 prerequisite tasks)
- 2A-1→9 (9 WS subscription tasks)
- 2B-1→4 (4 SSE tasks)
- 2C-1→4 + 2C-2+ (5 subscription UI tasks)
- 2E-1→3, 2E-5 (4 file upload core tasks)
- 2-INT-1, 2-INT-2, 2-INT-4 (3 integration tasks)
- 2-SEL-1 (selectors)
- 2-SHARED-1 (shared extraction)

**Phase 2.1** — Developer Productivity (20 tasks):
- 2F-1→5, 2F-9, 2F-12 (7 builder MVP tasks)
- 2D-1→3, 2D-5, 2D-6 (5 incremental delivery tasks)
- 2G-1, 2G-2 (2 performance tasks)
- 2-INT-3 (builder integration)
- 2C-5 (subscription assertions)
- 2E-4 (upload progress)
- 2-TYPE-1 (shared types)

**Deferred** (15 tasks):
- 2F-6→8, 2F-10→11, 2F-13→14 (7 builder advanced tasks)
- 2G-3→5 (3 performance advanced tasks)
- 2D-4 (chunk tracker)
- 2A-3 (legacy protocol — move to 2.0 Sprint 5 if time permits)
- Remaining: 3 tasks moved based on dependency resolution

#### 23.13.13 Architecture Decision Record: WS Transport Model

This decision must be made **before Phase 2 implementation begins** (task 2-PRE-1):

**Option A: Extend existing `/api/ws/*` proxy**
- Pros: Reuse 300+ LOC of `WebSocketProxyService` (ring buffer, cursor polling, TLS, idle GC); proven architecture; no new server code
- Cons: Not GraphQL-aware (no subprotocol negotiation); polling latency (200ms); doesn't handle `graphql-transport-ws` `connection_init`/`subscribe`/`next` protocol semantics
- Verdict: Works for "dumb relay" but **misses the protocol-aware features** that make Phase 2 subscription testing valuable

**Option B: New `/api/graphql/subscribe` WS upgrade route**
- Pros: GraphQL-aware (subprotocol negotiation, `connection_init` auth relay, subscription multiplexing); clean separation; can log `subscribe`/`next`/`complete` frames semantically
- Cons: More code (~400 LOC new route); parallel infrastructure to WS proxy; must handle TLS separately
- Verdict: **Recommended** — the protocol-awareness is core to Phase 2's value proposition (auto-detection, auth relay, message semantics)

**Option C: Hybrid — browser-direct when possible, proxy when auth/TLS required**
- Matches WS Studio's 3-mode transport: `direct` (browser native WS), `proxy` (Express relay), `native` (Tauri)
- Pros: Best latency for direct connections; proxy only when needed; mirrors proven WS Studio pattern
- Cons: Most complex to implement; must handle all three paths in `useGraphqlSubscription`
- Verdict: **Best long-term approach** — adopt WS Studio's `route()` pattern for transport selection

**Recommendation**: **Option C** (hybrid) with the following transport routing:

```
Browser + no auth + no TLS skip → Direct WebSocket (browser native)
Browser + auth headers or TLS    → Proxy via /api/graphql/subscribe
Tauri                            → Tauri WS commands (or localhost:3001 proxy)
SSE                              → Direct fetch + ReadableStream (no proxy needed)
SSE + auth                       → /api/graphql/sse proxy relay
```

This matches the established WS Studio pattern and maximizes latency performance while providing auth/TLS support through the proxy when needed.

### 23.14 Phase 2 Re-evaluation Round 3 (2026-06-17)

> **Scope**: Cross-referenced the Phase 2 plan against the current codebase (all new Phase 1 files, `graphql.ts`, `selectors.ts`, `httpClient.ts`, `gqlFetch.ts`, `schemaParser.ts`, `tabPersistence.ts`, `src-server/` directory tree, and E2E test suite). Found **15 additional gaps** beyond Rounds 1–2.

#### 23.14.1 Phase 1 Closure Item: StrictMode Tab Persistence Bug Fixed

**RESOLVED**: `GraphqlStudioPage.tsx` flush-on-unmount and persist-on-change effects were patched with two guards:
1. `if (loadedRef.current && tabsRef.current.length > 0)` — prevents the fake-unmount cleanup from wiping `localStorage` before the restore effect has applied its async `setTabs()` update.
2. `if (tabs.length === 0) return;` — prevents scheduling a save with the empty initial state during StrictMode remount.

These guards are now committed. Phase 2 tab management (subscription tab, builder tab) **must preserve these guards** when extending `GraphqlStudioPage.tsx`.

#### 23.14.2 `httpClient.ts` + `gqlFetch.ts` Have No Streaming Capability

**CRITICAL FINDING**: Code review confirms that every response-body read in `httpClient.ts` calls `.text()`, which fully buffers the response before returning. Additionally, `gqlFetch.ts`'s TLS-skip code path (`fetch('/__proxy')`) also buffers via `.json()`:

```
src/shared/utils/httpClient.ts  — line 70:  await resp.text()
                                  line 189: await response.text()
                                  line 248: await response.text()
                                  line 364: await response.text()
src/features/graphql/utils/gqlFetch.ts — line 49: await resp.json()
```

This **blocks both 2B (SSE subscriptions) and 2D (`@defer`/`@stream`)** which both require reading a `ReadableStream` chunk-by-chunk without buffering.

**New required task (added to 2-PRE-3, expanded)**:
- Add `fetchStream(url, options): Promise<Response>` to `httpClient.ts` that returns the raw `Response` without calling `.text()` — callers get the `ReadableStream` body for themselves.
- Add `gqlFetchStream(url, headers, body, signal?, skipTlsVerify?): Promise<Response>` to `gqlFetch.ts` (or a new `gqlStreamFetch.ts`) that handles the TLS-skip routing logic and returns the raw `Response` for streaming consumption. The TLS-skip proxy path must also be updated to stream (use a separate `/__proxy-stream` route or add a streaming flag to the existing route).

**Impact on sprint order**: 2-PRE-3 must land **before** Sprint 3 (SSE) and Sprint 7 (Incremental Delivery).

#### 23.14.3 `src-server/routes/graphql/` Directory Does Not Exist

**Confirmed via `ls src-server/routes/`**: Only `websocket/` and `kafka/` route subdirectories exist. The `graphql/` directory has never been scaffolded.

```
src-server/routes/
  kafka-routes.ts
  kafka-trigger-routes.ts
  websocket-mock-routes.ts
  websocket-routes.ts
  websocket/
    websocket-mock-service.ts
    websocket-service.ts
    ...
  (NO graphql/ directory)
```

Task 2-PRE-4 is confirmed critical-path work for Phase 2.0 Sprint 1. Nothing in 2A, 2B, or 2E can be built without it.

#### 23.14.4 Missing Phase 2 Types in `graphql.ts`

Code review confirms that `src/shared/types/graphql.ts` already has `GraphqlSubscriptionMessage` and `IncrementalDeliveryResult`, but **all 10 remaining types from §23.13.7 are absent**:

| Type | Needed By | Present? |
|------|-----------|---------|
| `QueryBuilderState` | 2F-1, 2F-11 | ❌ |
| `FieldSelectionPath` | 2F-1, 2F-3 | ❌ |
| `DirectiveApplication` | 2F-7 | ❌ |
| `FragmentDefinition` | 2F-6 | ❌ |
| `GraphqlSubscriptionAssertion` | 2C-5 | ❌ |
| `GraphqlSubscriptionSession` | 2A-5 | ❌ |
| `SubscriptionStats` | 2C-2 | ❌ |
| `ApolloTracingData` | 2G-1 | ❌ |
| `ResolverTrace` | 2G-1 | ❌ |
| `FileUploadSlot` | 2E-1 | ❌ |
| `GraphqlSubscriptionMessage` | 2A-5 | ✅ already in file |
| `IncrementalDeliveryResult` | 2D-1 | ✅ already in file |

Task 2-TYPE-1 is still outstanding. These types must be added before Phase 2 hooks/components can be typed correctly.

#### 23.14.5 Missing Phase 2 Selectors in `selectors.ts`

Code review confirms that `src/shared/selectors.ts` GQL namespace has **only 1 of the 39 Phase 2 selectors** from §23.13.8:

```
COMPLEXITY_BADGE: '[data-testid="gql-complexity-badge"]'  ✅ (Phase 2G)
```

All 38 remaining selectors for subscriptions, query builder, file upload, incremental delivery, and performance are absent. Task 2-SEL-1 is outstanding — it should be completed **at the start of Phase 2.0** so E2E test authors can reference constants immediately.

#### 23.14.6 Phase 1 `localStorage` Calls Not Yet Migrated to `storage.ts`

**Confirmed via grep**: All four hooks flagged in §23.7 still use raw `localStorage`:

| File | Usage |
|------|-------|
| `src/features/graphql/utils/tabPersistence.ts` | `localStorage.getItem`, `localStorage.setItem`, `localStorage.removeItem` (lines 110, 126–129, 134, 141, 157–159) |
| `src/features/graphql/hooks/useGraphqlConnectionProfiles.ts` | Raw `localStorage` |
| `src/features/graphql/hooks/useGraphqlEnvironments.ts` | Raw `localStorage` |
| `src/features/graphql/hooks/useRecentEndpoints.ts` | Raw `localStorage` |

**Note**: The StrictMode fix from §23.14.1 uses `loadedRef` and `tabsRef` patterns that interact with `tabPersistence.ts` synchronously. Migrating to async `storage.ts` will require careful refactoring of `GraphqlStudioPage.tsx` to await the load call and to handle the async save in the unmount cleanup (async cleanup is not supported in `useEffect` — requires `useRef` timer + fire-and-forget). **Add this complexity note to 2-PRE-7**.

#### 23.14.7 `graphqlClient.ts` Transport Abstraction Does Not Exist

Task 2-PRE-2 is confirmed outstanding. Currently the codebase has:
- `gqlFetch.ts` — HTTP POST only, returns buffered `HttpResponse`
- No unified interface for WS/SSE/streaming transports

The file `src/features/graphql/utils/graphqlClient.ts` (or equivalent) needs to be created from scratch. Its interface should be designed before Sprint 2 begins.

**Recommended interface shape** (not in the plan yet):

```typescript
interface GraphqlTransport {
  execute(op: GraphqlOperation, opts: ExecuteOptions): Promise<GraphqlResponse>;
  subscribe(op: GraphqlOperation, opts: SubscribeOptions): AsyncIterableIterator<GraphqlSubscriptionMessage>;
  cancel(): void;
  readonly state: 'idle' | 'connecting' | 'active' | 'error' | 'closed';
}
```

All three transports (HTTP query, WS subscription, SSE subscription) implement `GraphqlTransport`. `GraphqlStudioPage` calls `createTransport(connection)` which selects the right implementation based on `operationType` and `subscriptionTransport`.

#### 23.14.8 No Playwright Mock Server for GraphQL-WS Protocol

The E2E suite has extensive WS tests (`ws-mock-server.spec.ts`, `ws-protocols-graphql.spec.ts`) using a generic WebSocket mock server, but **there is no fixture that speaks the `graphql-transport-ws` subscription protocol** (`connection_ack`, `subscribe`, `next`, `complete`, `error` message types).

Phase 2 E2E tests (graphql subscriptions) cannot be written without a protocol-aware mock server. The existing `e2e/helpers.ts` should be extended, or a new `e2e/fixtures/graphqlWsMockServer.ts` fixture should be created.

**New task** (addition to Sprint 5):

| # | Task | Priority |
|---|------|----------|
| 2-E2E-1 | **Scaffold `e2e/fixtures/graphqlWsMockServer.ts`** — Playwright `test.extend` fixture that starts a local `ws` server implementing the `graphql-transport-ws` protocol. Supports `connection_ack`, delivering `next` messages on demand, `complete`, and `error` close codes (`4400`/`4406`). Used by all subscription E2E tests. | P1 |

#### 23.14.9 `schemaParser.ts` Argument Type Lookup Pattern Not Documented

For task 2F-4 (argument inputs with type-matched widgets), the query builder must render form widgets for each argument. When an argument type is an `INPUT_OBJECT` (e.g. `CreateUserInput!`), the builder must recursively render its fields as nested widgets.

The current `GraphqlArgNode.type` is a **formatted string only** (e.g. `"CreateUserInput!"`). The builder must look up the `INPUT_OBJECT` type by unwrapping the type string and calling `schemaInfo.types.find(t => t.name === baseTypeName)`.

**This works with the current data model** — no schema type changes are needed. But the plan doesn't document the lookup algorithm. Add to 2F-4:

> **Implementation note**: To render nested `INPUT_OBJECT` argument widgets, unwrap the `GraphqlArgNode.type` string (strip `!`, `[`, `]`) to get the base type name, then look up in `schemaInfo.types`. The type's `kind === 'INPUT_OBJECT'` guard confirms it needs nested widget rendering. Maximum recursion depth: 3 levels (guard against self-referential input types).

#### 23.14.10 `useWebSocketFilters` Extraction as 2-SHARED-1 Pattern Reference

As part of Phase 1 refactoring (this session), `useWebSocketFilters.ts` was extracted from `useWebSocketStudio.ts`. This extraction established the **extraction pattern** for task 2-SHARED-1.

When extracting shared protocol-log primitives for `GraphqlSubscriptionLog`, use the same pattern:
1. Identify all filter/state logic in `WebSocketMessageLog.tsx` and `SseMessageLog.tsx`
2. Extract into `src/shared/components/protocol-log/useProtocolLogFilters.ts`
3. The virtual list base, filter bar, stats hook, and detail panel become shared components
4. `GraphqlSubscriptionLog` composes these — no code duplication

Reference: `src/features/websocket/useWebSocketFilters.ts` for extraction pattern.

#### 23.14.11 Connection Bar Subscription Controls Not Fully Tasked

§23.13.6 notes the mockup shows a `WS`/`SSE` badge swap and a `Disconnect` button, and task 2-INT-1 covers the Subscribe/Disconnect button swap. However, when the subscription is active, the connection bar needs **additional subscription-specific indicators** not fully tasked anywhere:

| UI Element | Needed Task | Status |
|---|---|---|
| WS/SSE protocol badge (replaces GQL method badge during subscription) | Add to 2A-7 | Flagged in §23.13.6 |
| Disconnect button (red, distinct from Cancel) | 2-INT-1 | Covered |
| Subscribe button (green, replaces Execute) | 2-INT-1 | Covered |
| Connection duration display ("Subscribed 2m 34s") | **Not tasked** | ❌ |
| Reconnect attempt counter during backoff | **Not tasked** | ❌ |
| Protocol label in status pill (e.g. "graphql-transport-ws") | Add to 2A-7 | Flagged in §23.13.6 |

**New sub-tasks for 2A-7**:
- Add connection duration timer (start time recorded when `state → active`; display as "Xm Ys")
- Add reconnect attempt counter in status pill during `reconnecting` state (e.g. "Reconnecting… (attempt 2/5)")

#### 23.14.12 `subscriptions-transport-ws` Vendoring Decision Unresolved

The plan (§23.2.1, 2-PRE-6) says "consider vendoring minimal client code (~200 lines) to avoid external dependency on unmaintained package" but makes no firm decision. This creates ambiguity for Sprint 1.

**Decision required before Phase 2.0 begins**: Choose one of:
- **Option A**: Include `subscriptions-transport-ws@0.11.0` in `package.json` as a direct dependency with a comment noting it's legacy-compat only.
- **Option B**: Vendor the minimal WS protocol client code directly in `src/features/graphql/utils/legacyWsClient.ts` (~150 lines for the message protocol; zero external dependency).
- **Option C**: Skip legacy protocol support in Phase 2.0; add in Phase 2.1 after modern protocol is stable.

**Recommendation**: **Option C** for Phase 2.0, **Option A** for Phase 2.1. Rationale: most teams have already migrated to `graphql-transport-ws`; implementing legacy compat before the modern client is stable inverts the priority. Document this in 2-PRE-6.

#### 23.14.13 Phase 2.0 Unit Test Coverage Strategy Not Specified

Phase 1 established a >90% coverage requirement enforced by CI. The plan's Sprint 5 says "unit tests for all new hooks/utils" but doesn't specify:
- Which files need test files
- Coverage targets per file
- Mock strategy for `graphql-ws` client (subscription protocol requires mocking the WS connection)

**New task** (Sprint 5 addition):

| # | Task | Priority |
|---|------|----------|
| 2-TEST-1 | **Unit test scaffolding for Phase 2.0 hooks** — Create test files for: `graphqlClient.ts` (mock transport adapters), `useGraphqlSubscription.ts` (mock WS + state machine transitions), `GraphqlSubscriptionLog.tsx` (virtual list rendering with mock messages), `useSubscriptionStats.ts` (rolling window math), `graphqlUpload.ts` (FormData construction). Maintain >90% branch coverage. | P1 |

#### 23.14.14 Updated Task Count Summary

| Category | After Round 2 | After Round 3 |
|----------|--------------|---------------|
| 2A–2G tasks | 44 | 44 |
| Prerequisites (2-PRE) | 7 | 7 (2-PRE-3 expanded) |
| Integration tasks (2-INT) | 4 | 4 (2A-7 expanded) |
| Validation/UI tasks | 5 | 5 |
| Selector/Type tasks | 2 | 2 |
| Shared extraction (2-SHARED) | 1 | 1 |
| E2E fixture tasks | 0 | **1** (2-E2E-1) |
| Unit test scaffolding | 0 | **1** (2-TEST-1) |
| **Total Phase 2 tasks** | **63** | **65** |

#### 23.14.15 Phase 2.0 Pre-Implementation Checklist (Updated)

Before writing the first line of Phase 2.0 code, all of the following must be done:

- [ ] **2-PRE-1**: Architecture decision documented (WS transport model — Option C recommended)
- [ ] **2-PRE-2**: `graphqlClient.ts` interface designed and typed (see §23.14.7 for recommended shape)
- [ ] **2-PRE-3**: `fetchStream()` in `httpClient.ts` + `gqlFetchStream()` in `gqlFetch.ts` (see §23.14.2)
- [ ] **2-PRE-4**: `src-server/routes/graphql/` directory scaffolded (see §23.14.3)
- [ ] **2-PRE-5**: Tauri WS IPC decision documented
- [ ] **2-PRE-6**: `subscriptions-transport-ws` vendor/skip decision made (see §23.14.12 — recommend Option C)
- [ ] **2-PRE-7**: `localStorage` → `storage.ts` migration for 4 Phase 1 hooks (see §23.14.6)
- [ ] **2-TYPE-1**: 10 missing Phase 2 types added to `graphql.ts` (see §23.14.4)
- [ ] **2-SEL-1**: 38 missing Phase 2 selectors added to `selectors.ts` (see §23.14.5)
- [ ] **2-E2E-1**: `e2e/fixtures/graphqlWsMockServer.ts` fixture scaffolded (see §23.14.8)

### 23.15 Phase 2 Re-evaluation Round 4 (2026-06-17)

> **Scope**: Deep code audit of existing WebSocket/SSE studio implementations (`useWebSocketStudio.ts`, `useWebSocketReconnect.ts`, `useWebSocketMetrics.ts`, `WebSocketMessageLog.tsx`, `useSseConnection.ts`, `wsAuthResolve.ts`), server entry point (`webhook-server.ts`, `websocket-routes.ts`), the Docker GraphQL test server (`docker/websocket/graphql/`), subscription and query-builder mockup HTML files, and vite proxy config. Found **16 additional gaps and 5 significant reuse opportunities** not documented in prior rounds.

#### 23.15.1 CRITICAL: Docker GraphQL Subscription Server Already Exists

**NEW FINDING**: `docker/websocket/graphql/` contains a fully functional `graphql-transport-ws` subscription server already used by `e2e/ws-protocols-graphql.spec.ts` (WP-12–WP-15). The server exposes:
- `Query { hello: String }`
- `Subscription { messageAdded: Message }` — push-based via `POST /publish`
- `Subscription { countdown(from: Int!): Int }` — finite countdown stream
- `GET /health` health check

**Impact on 2-E2E-1**: Task 2-E2E-1 (Round 3) needs to be corrected. The Docker server already exists — no new server is needed. Phase 2.0 E2E tests only need:
1. A new spec file `e2e/graphql-subscriptions.spec.ts` that targets the **GraphQL Studio page** (not WS Studio)
2. Extension of the Docker server with `POST /graphql` for query/mutation tests (currently missing)
3. Apollo Tracing support on the Docker server for Phase 2G E2E tests

**Revised 2-E2E-1**:

| # | Task | Priority |
|---|------|----------|
| 2-E2E-1 | **Create `e2e/graphql-subscriptions.spec.ts`** — Playwright tests for GraphQL Studio subscription UI using the existing `docker/websocket/graphql/` server. Subscribe button, real-time log, stats bar, disconnect. Requires `E2E_WITH_DOCKER=1`. | P1 |
| 2-E2E-2 | **Extend Docker GraphQL server** — Add `POST /graphql` HTTP endpoint (query/mutation), Apollo Tracing headers, and File Upload support. Needed for Phase 2E and 2G E2E tests. | P1 |

#### 23.15.2 IMPORTANT: `2-PRE-3` Scope Correction — SSE Does NOT Need `fetchStream()`

Round 3 stated that `fetchStream()` is needed for both SSE (2B) and `@defer`/`@stream` (2D). **This is incorrect for SSE.**

Code review of `src/features/sse/useSseConnection.ts` (lines 157–180) shows that `useSseConnection` already uses `fetch()` directly (not `httpFetch`) and reads the body as a `ReadableStream` via `response.body.getReader()`. Phase 2B's `graphql-sse` client integration uses the same pattern — `graphql-sse` accepts a custom `fetchFn` and handles streaming internally.

**Corrected scope for 2-PRE-3**:
- `fetchStream()` is only needed for **Phase 2D** (`@defer`/`@stream` multipart parsing via `meros`)
- Phase 2B (SSE) uses the established `fetch() + getReader()` pattern from `useSseConnection.ts` — no new `httpClient.ts` function needed
- Update 2-PRE-3 description: "Add `fetchStream(url, options): Promise<Response>` to `httpClient.ts` for Phase 2D multipart streaming only. SSE (Phase 2B) uses the established `fetch() + getReader()` pattern from `useSseConnection.ts`."

**Impact**: Phase 2B Sprint 3 can begin without 2-PRE-3 completing. 2-PRE-3 only blocks Sprint 7 (2D).

#### 23.15.3 Five Major Reuse Opportunities Identified

Code review found existing hooks/components that Phase 2 can reuse verbatim or with minor adaptation:

| Existing Asset | Location | Phase 2 Task | Reuse Pattern | LOC Saved |
|---|---|---|---|---|
| `useWebSocketReconnect` (exponential backoff + jitter, max attempts, `scheduleReconnectRef`) | `src/features/websocket/useWebSocketReconnect.ts` | 2A-6 | Import directly into `useGraphqlSubscription`. All parameters (interval, multiplier, max attempts) are configurable via props. | ~120 |
| `wsAuthResolve.ts` (`resolveAuthForConnect`, `appendAuthQueryParams`, `resolveEffectiveAuth`) | `src/features/websocket/wsAuthResolve.ts` | 2A-8 | `buildConnectionParams(auth)` can call `resolveEffectiveAuth(auth)` and map to `connectionParams` object. Already imported by `useSseConnection`. | ~60 |
| `useWebSocketMetrics` (rolling 60s histogram, msg/sec rate, bytes in/out, 1s sample interval) | `src/features/websocket/useWebSocketMetrics.ts` | 2C-2 | The stats bar hook can be a thin wrapper calling the same `WsMetricsSnapshot` accumulator pattern. `SubscriptionStats` type (added in Round 3) maps directly to `WsMetricsSnapshot` fields. | ~80 |
| `useVirtualizer` from `@tanstack/react-virtual` | Already in project (used by `WebSocketMessageLog.tsx`, `SseMessageLog.tsx`) | 2C-1 | `GraphqlSubscriptionLog` uses `useVirtualizer` exactly like `WebSocketMessageLog`. Zero new dependencies. | ~30 |
| `useSseConnection.ts` `fetch() + getReader()` streaming pattern | `src/features/sse/useSseConnection.ts` lines 157–180 | 2B-2 | `graphql-sse` `createClient({ fetchFn })` accepts the same native `fetch`. The SSE subscription transport in `graphqlClient.ts` can mirror `useSseConnection`'s streaming loop verbatim. | ~100 |

**Add to 2-SHARED-1 description**: Note these five specific reuse targets explicitly so implementors don't recreate them.

#### 23.15.4 `webhook-server.ts` Route Registration Pattern Identified

Code review confirms the server entry pattern for 2-PRE-4:

```typescript
// webhook-server.ts — add after existing createWebSocketMockRouter line:
import { createGraphqlRouter } from './routes/graphql-routes.js';
app.use(createGraphqlRouter({ onLog: broadcastLog }));
```

The router factory pattern `createXxxRouter({ onLog })` is consistent across Kafka, WebSocket, and WebSocket Mock routers. Phase 2's `createGraphqlRouter` should follow the same signature. The `onLog: broadcastLog` callback pipes server events to the SSE log stream consumed by the frontend's activity log.

**Add to 2-PRE-4**: Specify that `createGraphqlRouter` must accept `{ onLog?: (line: LogLine) => void }` to match the established pattern and wire into `broadcastLog`.

#### 23.15.5 Subscription Mockup — "⚙ Protocol" Settings Button Not Tasked

The subscription mockup (`graphql-subscription-testing.html`, line 117) shows a `⚙ Protocol` button in the connection bar. This button presumably opens a protocol-specific settings panel covering:
- WS/SSE transport selector
- Legacy protocol compat toggle
- `subscriptionBufferSize` config
- `connectionParams` custom JSON

**No task** covers this button or its settings panel. §23.13.5 flagged `subscriptionBufferSize` as untasked; this button is the natural home for all subscription-specific settings.

| # | New Task | Priority |
|---|----------|----------|
| 2A-10 | **Protocol settings popover** in connection bar: gear icon opens a popover with transport selector (Auto/graphql-transport-ws/graphql-ws/SSE), buffer size input, and custom `connectionParams` JSON editor. Triggered only when schema is loaded or endpoint is set. Persisted on `GraphqlConnection`. | P1 |

#### 23.15.6 Subscription Mockup — Status Bar Protocol Version Not Tasked

The mockup status bar (bottom of `graphql-subscription-testing.html`) shows: `"Protocol: graphql-ws v6.0"`. No task specifies displaying the detected protocol version in the subscription status bar or status pill.

**Add to 2A-7**: After protocol detection, record the resolved transport string and library version (e.g. `graphql-transport-ws` + `graphql-ws@6.0.8` version from `package.json`). Display in the connection status pill as `"graphql-transport-ws v6"`.

#### 23.15.7 Query Builder Mockup — Alias Panel is in Right Column, Not Inline

Task 2F-8 spec says: *"inline alias text input on hover/focus of a selected field"*. The mockup (`graphql-query-builder.html`, lines 518–528) shows the "Field Aliases" section in the **right options panel**, not inline on field rows. The panel lists selected fields with `fieldName → alias...` input pairs.

**Correction to 2F-8**: Implement aliases in the right options panel (matching the mockup), not as inline hover inputs on tree nodes. This reduces complexity (no hover-triggered DOM mutation) and matches user expectations (right-column settings area).

#### 23.15.8 Query Builder Mockup — Builder Keyboard Shortcuts Not Tasked

The query builder status bar (bottom of `graphql-query-builder.html`) shows:
```
⌘K Search   Space Toggle field   → Expand type   ⌘↵ Execute
```

No task covers keyboard navigation in the field selector tree. For the builder to be usable without a mouse (and to match the competitive bar with Bruno), keyboard support is essential.

| # | New Task | Priority |
|---|----------|----------|
| 2F-15 | **Builder keyboard navigation**: `Space` toggles field selection at focused row; `→`/`←` expand/collapse object type; `↑`/`↓` move focus between rows; `⌘K` focuses the schema search input; `⌘↵` triggers Execute; `Escape` clears search and returns to root view. Implemented via `onKeyDown` on the field tree container with `aria-activedescendant` for screen reader support. | P1 |

#### 23.15.9 Query Builder Mockup — `@defer` in Directives Panel

The mockup directives panel (line 531–544 of `graphql-query-builder.html`) shows `@defer` as a toggle alongside `@skip` and `@include`. Task 2F-7 only covers `@skip`/`@include`.

`@defer` on a field in the query builder is a different behavior than `@skip`/`@include` — it signals to the server to return that field incrementally. It doesn't take a Boolean variable; it takes an optional `label` string.

**Add to 2F-7** (even though deferred to post-2.1): When `@defer` support is added, the directive toggle popover must show:
- `@skip(if: $var)` and `@include(if: $var)` — same Boolean variable pattern
- `@defer(label: "optionalLabel")` — no variable; optional label text input; only valid when `operationType !== 'subscription'` and `hasIncrementalDelivery` is true

#### 23.15.10 Query Builder Mockup — "Find Field Path" is in Right Panel

Task 2F-5 describes *"two-step schema search"* as a standalone component. The mockup shows it in the right options panel under **"Find Field Path"** — a distinct search that finds all root-to-field paths for a named field across the schema (e.g. `Query → user → orders → nodes → tracking → trackingNumber`). This is different from the tree's own search filter (which filters the left column).

**Clarification for 2F-5**: There are two distinct search behaviors:
1. **Tree filter search** (left column header): filters the field tree to show only fields matching the text — quick narrow-down for large schemas
2. **"Find Field Path"** (right panel): given a field name, lists all root paths reaching that field across the full schema — helps users discover deeply nested fields

Both should be implemented. The current 2F-5 spec mixes both. Split into:
- 2F-5a: Tree filter search (left column, real-time filter, auto-expands matching nodes)
- 2F-5b: "Find Field Path" panel (right column, path discovery, click-to-select path)

#### 23.15.11 Subscription Mockup — Assertions Panel is Left Column, Not Right Sidebar

Task 2C-5 defers the assertion panel to Phase 2.1 but describes it as a "right sidebar toggle". The mockup (`graphql-subscription-testing.html`, lines 147–183) shows the assertions panel in the **left column** below the Monaco editor (same vertical space as the editor pane), not as a sidebar. The panel shows per-assertion rows with ✓/✗ and aggregate details.

**Correction to 2C-5**: The assertion panel renders in the editor section (left pane), below the subscription query, not as a sidebar. When enabled, the editor is split: query above, assertions below (resizable). This is consistent with the mockup layout and avoids adding a third pane column.

#### 23.15.12 Updated Task Count Summary

| Category | After Round 3 | After Round 4 |
|----------|--------------|---------------|
| 2A–2G tasks | 44 | **46** (2A-10, 2F-15 added; 2F-5 split into 2F-5a/b) |
| Prerequisites (2-PRE) | 7 | 7 (2-PRE-3 scope corrected) |
| Integration tasks (2-INT) | 4 | 4 |
| Validation/UI tasks | 5 | 5 (2C-5 layout corrected) |
| Selector/Type tasks | 2 | 2 |
| Shared extraction (2-SHARED) | 1 | 1 (reuse opportunities added to description) |
| E2E fixture tasks | 1 (2-E2E-1) | **2** (2-E2E-1 revised + 2-E2E-2 added) |
| Unit test scaffolding | 1 (2-TEST-1) | 1 |
| **Total Phase 2 tasks** | **65** | **67** |

#### 23.15.13 Revised Phase 2.0 Sprint Plan (Accounting for Reuse)

Updated based on confirmed reuse opportunities and Docker server discovery:

```
Phase 2.0 (Protocol Parity) — revised sprint plan
├─ Sprint 1: Server Infrastructure + Transport Interface
│   ├─ 2-PRE-4: Scaffold src-server/routes/graphql/ + register in webhook-server.ts
│   ├─ 2-PRE-2: Create graphqlClient.ts transport abstraction + interface
│   ├─ 2-PRE-6: Install graphql-ws, graphql-sse, meros, extract-files
│   └─ 2-TYPE-1 + 2-SEL-1: Add Phase 2 types + selectors (done in Round 3 ✅)
│
├─ Sprint 2: WebSocket Subscriptions (modern protocol)
│   ├─ 2A-1: WS proxy route /api/graphql/subscribe
│   ├─ 2A-2: graphql-ws client in graphqlClient.ts
│   ├─ 2A-5: useGraphqlSubscription state machine
│   ├─ 2A-6: Reconnect — reuse useWebSocketReconnect directly
│   └─ 2A-9: wsEndpoint URL derivation
│
├─ Sprint 3: Subscription UI + SSE
│   ├─ 2C-1: GraphqlSubscriptionLog (useVirtualizer — zero new dep)
│   ├─ 2C-2: Stats bar (adapt useWebSocketMetrics pattern)
│   ├─ 2C-3: Log toolbar (Pause/Resume/Clear/Export)
│   ├─ 2C-4: Filter bar (reuse WebSocketFilterBar pattern)
│   ├─ 2B-1→4: SSE transport (reuse useSseConnection fetch pattern)
│   ├─ 2A-7+2A-10: Status pill + Protocol settings popover
│   └─ 2A-8: connectionParams auth (reuse wsAuthResolve.ts)
│
├─ Sprint 4: File Upload + Integration
│   ├─ 2E-1→3, 2E-5: Files tab, multipart construction, upload proxy
│   ├─ 2-INT-1: Subscribe/Disconnect button swap
│   ├─ 2-INT-2: Subscription Log tab in right pane
│   └─ 2-INT-4: Files sub-tab in bottom panel
│
└─ Sprint 5: Legacy Compat + Testing
    ├─ 2A-3: subscriptions-transport-ws legacy compat (if approved — see §23.14.12)
    ├─ 2-PRE-7: localStorage → storage.ts migration (4 Phase 1 hooks)
    ├─ 2-SHARED-1: Extract shared protocol-log primitives
    ├─ 2-TEST-1: Unit test scaffolding for all new hooks
    ├─ 2-E2E-1: graphql-subscriptions.spec.ts against Docker server
    └─ 2-E2E-2: Extend Docker GraphQL server (HTTP + tracing + upload)
```

### 23.16 Sprint 1 Re-evaluation (2026-06-17)

> **Scope**: Cross-check Sprint 1 tasks (2-PRE-2, 2-PRE-4, 2-PRE-6) against codebase reality before implementation. Found 6 additional gaps to resolve.

#### 23.16.1 Architecture Decision (2-PRE-1) — Recorded

**Decision**: **Option C — Hybrid transport** (from §23.14.13). Routing:

| Context | Transport |
|---|---|
| `operationType === 'query' \| 'mutation'` | HTTP (`gqlFetch` → `httpFetch`) — Phase 1 path, unchanged |
| `operationType === 'subscription'`, `auto`, browser, no auth, no TLS skip | Direct `graphql-transport-ws` (browser native WebSocket) |
| `operationType === 'subscription'`, browser, has auth headers or `skipTlsVerify` | Proxied via `/api/graphql/subscribe` |
| `operationType === 'subscription'`, Tauri | Localhost proxy via port 3001 (same as other studio protocols) |
| `subscriptionTransport === 'sse'` | `graphql-sse` direct fetch + ReadableStream |
| `subscriptionTransport === 'sse'`, has auth headers | Proxied via `/api/graphql/sse` |

#### 23.16.2 `GraphqlAuth` ≠ `AuthConfig` — Needs Bridge

**GAP**: `wsAuthResolve.ts` takes `AuthConfig` (WS Studio type with `'none'` and `'inherit'` variants). Phase 2's WS `connection_init` needs `buildConnectionParams(auth: GraphqlAuth)` which uses the different `GraphqlAuth` type. A bridge function is required.

`GraphqlAuth` does not have `'none'` (absence = no auth) or `'inherit'` types. The bridge maps `GraphqlAuth` → plain object for `connectionParams`:
```
bearer  → { Authorization: "Bearer <token>" }
basic   → { Authorization: "Basic <base64>" }
apiKey  → { [headerName]: headerValue }
oauth2  → { Authorization: "Bearer <access_token>" }  (token must be pre-fetched)
custom  → { [headerName]: headerValue }
```

**Add `buildConnectionParams(auth: GraphqlAuth | undefined): Record<string, unknown>` to `authUtils.ts`.**

#### 23.16.3 `deriveWsEndpoint` Missing From `graphqlClient.ts` Task

Task 2A-9 says add `deriveWsEndpoint` to `graphqlClient.ts`. Implement it in Sprint 1 (trivial utility, zero deps) so it is available immediately for Sprint 2.

#### 23.16.4 `useGraphqlExecution.ts` NOT Migrated in Sprint 1 — By Design

`useGraphqlExecution.ts` calls `gqlFetch` directly and is working. Migrating it to `graphqlClient.ts` in Sprint 1 would risk breaking Phase 1 functionality with zero user-visible gain. **Sprint 1 creates `graphqlClient.ts` as a new foundation; the migration of `useGraphqlExecution` happens in Sprint 2** when subscriptions make the polymorphism necessary.

#### 23.16.5 Server Routes Must Use ESM `.js` Import Extensions

The `src-server/` code uses `"type": "module"` in its own package context (imports have `.js` extensions). New route files in `src-server/routes/graphql/` must use `import ... from './something.js'` even when importing `.ts` source files. Verify pattern from `websocket-routes.ts`.

#### 23.16.6 Sprint 1 Deliverables Summary

| Deliverable | File | Status |
|---|---|---|
| Phase 2 npm packages | `package.json` | 2-PRE-6 |
| GraphQL transport interface + HTTP impl + stubs | `src/features/graphql/utils/graphqlClient.ts` | 2-PRE-2 |
| `buildConnectionParams` WS auth bridge | `src/features/graphql/utils/authUtils.ts` | 2-PRE-2 addon |
| `deriveWsEndpoint` utility | `src/features/graphql/utils/graphqlClient.ts` | 2A-9 early |
| Server route stubs (subscribe, sse, upload) | `src-server/routes/graphql/` | 2-PRE-4 |
| Route registration | `src-server/webhook-server.ts` | 2-PRE-4 |
| Unit tests (>90% coverage) | `graphqlClient.test.ts`, route tests | 2-TEST-1 |
