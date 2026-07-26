# Workflow Palette Redesign — Impact Analysis & Remediation Plan

> **Date:** 2026-07-25
> **Status:** ✅ Fully Implemented
> **Scope:** Protocol-colored canvas nodes + palette layout redesign (Option 2) + demo lesson remediation + Fit View optimization

---

## Part A: Protocol-Colored Canvas Nodes (IMPLEMENTED)

### What Changed

Protocol nodes on the workflow canvas now have distinct, soft accent colors instead of all sharing the same teal `--cat-integration` color.

| Protocol | Border Color | Hex | Visual |
|----------|-------------|-----|--------|
| HTTP | Indigo (unchanged) | `--cat-action` | Action category color |
| Kafka | Muted gold | `#b5944f` | Warm, distinguishable from teal |
| WebSocket | Soft lavender | `#8a82bf` | Cool purple-blue |
| GraphQL | Soft teal-cyan | `#4da8b5` | Shifted hue from base teal |
| gRPC | Soft steel blue | `#5f8fb5` | Calm, professional |

**Design constraints:**
- No red/pink tones — avoids confusion with test fail states (red border = fail)
- Low saturation — colors are harmonious, not jarring
- Same hue family — all cool tones that work together

### Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Added `--proto-kafka`, `--proto-ws`, `--proto-gql`, `--proto-grpc` tokens (dark + light); added `--cat-triggers/actions/logic/data/flow` category accent tokens |
| `src/styles/workflow.css` | Updated `border-color`, `background`, `box-shadow`, icon badge, and label `strong` colors for each protocol group; added palette rail CSS |
| `src/features/workflow/utils/workflowDesignerUtils.ts` | Updated `getNodeMiniMapColor()` for protocol-specific minimap colors |

### Demo Lesson Impact: NONE

**Zero breakage.** The audit confirmed:
- No lesson references `--cat-integration`, `--proto-*`, or `wf-node-icon-badge` CSS variables
- No DOM structure or selectors changed — only visual styling
- All `data-testid` selectors remain identical
- Run-state colors (green=pass, red=fail, blue=running) are untouched
- Narration text doesn't reference specific border colors

---

## Part B: Palette Layout Redesign (IMPLEMENTED — Option 2)

### Previous Layout

Accordion-based: 5 collapsible categories (Triggers, Actions, Logic, Data, Flow), each with collapsible subgroups (HTTP, Kafka, WebSocket, GraphQL, gRPC).

### Chosen Design: Option 2 — Vertical Icon Rail + Protocol Chips

**Implemented in:** `src/features/workflow/components/canvas/WorkflowPalette.tsx`

The palette was completely refactored from the accordion layout to a vertical icon rail design:

- **Left rail** — 5 category icons (Triggers, Actions, Logic, Data, Flow) with colored accent indicators and `data-rail` attributes for demo lesson navigation
- **Protocol chips** — When Actions category is selected, horizontal protocol filter chips (HTTP, Kafka, WebSocket, GraphQL, gRPC) appear above the block list
- **Global search** — Searches across ALL categories regardless of the active rail selection, with results grouped by category
- **Blocks/Requests/Catalog tabs** — Preserved at the top of the palette

### Files Changed

| File | Change |
|------|--------|
| `src/features/workflow/components/canvas/WorkflowPalette.tsx` | Complete refactor: accordion → vertical rail + chips layout |
| `src/features/workflow/components/canvas/WorkflowPalette.test.tsx` | Tests updated for rail interaction pattern |
| `src/styles/workflow.css` | Added `.wf-palette-rail-*`, `.wf-palette-chip*`, `.wf-palette-proto-*` CSS classes |
| `src/index.css` | Added `--cat-triggers/actions/logic/data/flow` accent color tokens |
| `packages/demo-hub/src/lessons/wf-demo-helpers.ts` | `revealPaletteBlock` refactored: uses `selectPaletteRailCategory()` instead of old accordion expand |
| `packages/demo-hub/src/lessons/wf-demo-helpers.test.ts` | Tests updated for rail button interaction |

### Demo Lesson Interaction Audit

The audit identified exactly how each of the 18 workflow-related lessons interacts with the palette:

#### Interaction Taxonomy

| Pattern | Description | Count |
|---------|-------------|-------|
| **Real click** | `ctx.click(WF.PAL_*)` — lesson clicks the palette block directly | 3 lessons |
| **Spotlight + programmatic** | `querySelector(WF.PAL_*)` for spotlight ring, then `addWorkflowNodeWithPreset` for actual node add | 8 lessons |
| **Search + spotlight** | `ctx.fill(WF.PAL_SEARCH, ...)` to filter, then spotlight result | 2 lessons |
| **No palette** | Seeded workflow, no palette interaction in actions | 5 lessons |

#### Risk Assessment by Lesson

##### HIGH RISK — Direct Palette Block Clicks (3 lessons)

These `ctx.click(WF.PAL_*)` calls will **break** if the target block is not rendered in the DOM (e.g., behind a collapsed/unselected category in the new layout):

| Lesson | File | Selectors Clicked |
|--------|------|-------------------|
| `ws-workflow-builder` | `protocols/ws-workflow-builder.ts` | `WF.PAL_WS_CONNECT`, `WF.PAL_WS_SEND`, `WF.PAL_WS_RECEIVE` |
| `gql-workflow-integration` | `protocols/graphql-lesson-helpers/lesson11-workflow-integration.ts` | `WF.PAL_GQL_QUERY`, `WF.PAL_GQL_ASSERT` |
| `gql-workflow-mutation` | `protocols/graphql-lesson-helpers/lesson18-workflow-mutation.canvas.ts` | `WF.PAL_GQL_MUTATION` (visible delete demo — always real click) |

**Failure mode:** `ctx.click()` throws or silently fails because the palette block is not in the DOM (lazy-mounted behind a collapsed category/tab).

##### MEDIUM RISK — Spotlight-Only (8 lessons)

These use `document.querySelector(WF.PAL_*)` with null-safety — they won't crash, but the spotlight ring **won't appear** if the block isn't rendered:

| Lesson | File | Selectors Spotlighted |
|--------|------|-----------------------|
| `wf-first-workflow` | `workflow/wf-first-workflow.ts` | `WF.PAL_HTTP` |
| `wf-variables-extraction` | `workflow/wf-variables-extraction.ts` | `WF.PAL_HTTP` |
| `wf-conditional-logic` | `workflow/wf-conditional-logic.ts` | `WF.PAL_CONDITION`, `WF.PAL_LOG_DEBUG`, `WF.PAL_SWITCH` |
| `wf-loops-parallel` | `workflow/wf-loops-parallel.ts` | `WF.PAL_LOOP`, `WF.PAL_HTTP`, `WF.PAL_FORK`, `WF.PAL_JOIN` |
| `wf-error-handling` | `workflow/wf-error-handling.ts` | `WF.PAL_ERROR_HANDLER` |
| `wf-protocol-nodes` | `workflow/wf-protocol-nodes.ts` | `WF.PAL_KAFKA_PRODUCE`, `WF.PAL_GRPC_UNARY`, `WF.PAL_WS_CONNECT`, `WF.PAL_GQL_QUERY` |
| `grpc-workflow-integration` | `protocols/grpc-workflow-integration-steps.ts` | `WF.PAL_GRPC_UNARY`, `WF.PAL_GRPC_ASSERT` |
| `grpc-workflow-runner` | `protocols/grpc-workflow-runner-steps.ts` | `WF.PAL_GRPC_UNARY`, `WF.PAL_GRPC_ASSERT` |

**Failure mode:** Silent — demo works but the palette spotlight is invisible. Viewer misses the visual cue.

##### SEARCH DEPENDENCY (2 lessons)

gRPC lessons use `ctx.fill(WF.PAL_SEARCH, 'grpc')` to filter the palette before spotlighting blocks. The search input must remain functional and keep the same selector:

| Lesson | File | Search Usage |
|--------|------|-------------|
| `grpc-workflow-integration` | `protocols/grpc-workflow-integration-steps.ts` | `ctx.fill(WF.PAL_SEARCH, 'grpc')` + `waitFor(WF.PAL_GRPC_UNARY)` |
| `grpc-workflow-integration` | `protocols/grpc-workflow-integration.ts` | Same pattern in setup |

##### NO RISK — No Palette Interaction (5 lessons)

| Lesson | File |
|--------|------|
| `wf-debug-console` | `workflow/wf-debug-console.ts` |
| `wf-version-services` | `workflow/wf-version-services.ts` |
| `kafka-workflow-produce` | `protocols/kafka-workflow-produce.ts` |
| `kafka-workflow-consume-wait` | `protocols/kafka-workflow-consume-wait.ts` |
| `gql-workflow-runner` | `protocols/graphql-workflow-runner.ts` |

---

### Remediation Plan (ALL PHASES COMPLETE)

#### Phase 1: Create `revealPaletteBlock(ctx, blockType)` Helper ✅

**File:** `packages/demo-hub/src/lessons/wf-demo-helpers.ts`

A single helper function that:
1. Resets to the Blocks tab (`resetWfPaletteToBlocks`)
2. Clears any active search filter
3. Clicks the correct rail category button via `selectPaletteRailCategory()`
4. Scrolls the target block into view
5. Returns the block element for spotlighting

**Implementation:** `PALETTE_BLOCK_MAP` (35 entries) maps every `WF.PAL_*` selector to its `{ category, subGroup }`, and `selectPaletteRailCategory()` clicks the `.wf-palette-rail-btn[data-rail="..."]` element.

**Mapping table** (block type → category + protocol):

| Block Selector | Category | Protocol |
|---------------|----------|----------|
| `WF.PAL_HTTP` | Actions | HTTP |
| `WF.PAL_CONDITION` | Logic | — |
| `WF.PAL_SWITCH` | Logic | — |
| `WF.PAL_LOOP` | Logic | — |
| `WF.PAL_FORK` | Flow | — |
| `WF.PAL_JOIN` | Flow | — |
| `WF.PAL_ERROR_HANDLER` | Flow | — |
| `WF.PAL_LOG_DEBUG` | Data | — |
| `WF.PAL_KAFKA_PRODUCE` | Actions | Kafka |
| `WF.PAL_WS_CONNECT` | Actions | WebSocket |
| `WF.PAL_GQL_QUERY` | Actions | GraphQL |
| `WF.PAL_GQL_MUTATION` | Actions | GraphQL |
| `WF.PAL_GQL_SUBSCRIPTION` | Actions | GraphQL |
| `WF.PAL_GQL_INTROSPECT` | Actions | GraphQL |
| `WF.PAL_GQL_ASSERT` | Logic | — (no subGroup) |
| `WF.PAL_GRPC_UNARY` | Actions | gRPC |
| `WF.PAL_GRPC_SERVER_STREAM` | Actions | gRPC |
| `WF.PAL_GRPC_ASSERT` | Logic | — (no subGroup) |
| `WF.PAL_WS_SEND` | Actions | WebSocket |
| `WF.PAL_WS_RECEIVE` | Actions | WebSocket |
| `WF.PAL_KAFKA_CONSUME` | Actions | Kafka |
| `WF.PAL_KAFKA_WAIT` | Actions | Kafka |

#### Phase 2: Update High-Risk Lessons (3 lessons) ✅

All direct `ctx.click(WF.PAL_*)` calls now use `revealPaletteBlock` first:

| Lesson | Changes |
|--------|---------|
| `ws-workflow-builder` | 3 action clicks + 3 preAction scrolls: WS_CONNECT, WS_SEND, WS_RECEIVE |
| `gql-workflow-integration` (helper lesson11) | 2 clicks with manual scrollIntoView: GQL_QUERY, GQL_ASSERT |
| `gql-workflow-mutation` (helper lesson18 canvas) | 5 click points: 3 in `addLesson18PaletteNode` (hybrid), 1 fallback in `ensureLesson18DeleteNode`, 1 in `demonstrateLesson18DeleteNodeAdded` |

#### Phase 3: Update Medium-Risk Lessons (8 lessons) ✅

All `document.querySelector(WF.PAL_*)` spotlights now use `revealPaletteBlock` first:

| Lesson file | Spotlight count |
|--------|----------------|
| `wf-first-workflow` | 1 (PAL_HTTP) |
| `wf-variables-extraction` | 1 (PAL_HTTP) |
| `wf-conditional-logic` | 3 (PAL_CONDITION, PAL_LOG_DEBUG, PAL_SWITCH) |
| `wf-loops-parallel` | 4 (PAL_LOOP, PAL_HTTP, PAL_FORK, PAL_JOIN) |
| `wf-error-handling` | 1 (PAL_ERROR_HANDLER) |
| `wf-protocol-nodes` | 5 — 4 in `PALETTE_TOUR_BLOCKS` loop + 1 direct (PAL_KAFKA_PRODUCE) |
| `grpc-workflow-integration-steps` | 2 (PAL_GRPC_UNARY, PAL_GRPC_ASSERT) |
| `grpc-workflow-runner-steps` | 2 (PAL_GRPC_UNARY, PAL_GRPC_ASSERT) |

#### Phase 4: Verify Palette Search ✅

**Verified:**
- `WF.PAL_SEARCH` → `.wf-palette-search` targets the search `<input>`
- Search filters globally across ALL categories — not scoped to current rail selection
- `waitFor(WF.PAL_GRPC_UNARY)` resolves after search filters
- gRPC lessons correctly clear search in preAction before block interactions

**Issue found & fixed:**
When search is active, `filteredBlocks` removes non-matching blocks from the DOM entirely.
`revealPaletteBlock` could fail if called while a search filter hides the target block.

**Fix:** Added search-clear logic to `revealPaletteBlock` — clicks `.wf-palette-search-clear` if present.

#### Phase 5: Validation (Code Review + Tests + Checklist) ✅

**5a — Code audit:** PALETTE_BLOCK_MAP (35/35), selector cross-check (17/17), zero unguarded patterns.

**5b — Automated tests:** `tsc -b --noEmit` clean + 156 scoped tests passing (4 test files).

**5c — Manual playthrough (user):** Pending — priority order:
1. `ws-workflow-builder` (high risk, 3 real clicks)
2. `gql-workflow-integration` / lesson11 (high risk, 2 real clicks)
3. `gql-workflow-mutation` / lesson18 (high risk, complex hybrid)
4. `wf-protocol-nodes` (medium risk, 4-block tour — most visible to users)
5. `wf-first-workflow` (medium risk, foundational lesson)
6. Remaining 6 lessons

**5d — E2E smoke (merge gate only):**
Per project conventions, E2E is only required at PR/merge time.

---

### Complete `WF.PAL_*` Selector Inventory

All palette block selectors used across demo lessons:

| Selector | Used by (lesson count) | Interaction Type |
|----------|----------------------|------------------|
| `WF.PALETTE` | 3 | Container spotlight |
| `WF.PAL_TAB_BLOCKS` | 1 (helper) | Tab click |
| `WF.PAL_SEARCH` | 2 | Search input fill |
| `WF.PAL_HTTP` | 3 | Spotlight |
| `WF.PAL_CONDITION` | 1 | Spotlight |
| `WF.PAL_LOG_DEBUG` | 1 | Spotlight |
| `WF.PAL_SWITCH` | 1 | Spotlight |
| `WF.PAL_LOOP` | 1 | Spotlight |
| `WF.PAL_FORK` | 1 | Spotlight |
| `WF.PAL_JOIN` | 1 | Spotlight |
| `WF.PAL_ERROR_HANDLER` | 1 | Spotlight |
| `WF.PAL_KAFKA_PRODUCE` | 1 | Spotlight |
| `WF.PAL_GRPC_UNARY` | 3 | Spotlight + waitFor |
| `WF.PAL_GRPC_SERVER_STREAM` | 1 | waitFor only |
| `WF.PAL_GRPC_ASSERT` | 2 | Spotlight |
| `WF.PAL_WS_CONNECT` | 2 | Spotlight + **click** |
| `WF.PAL_WS_SEND` | 1 | **Click** |
| `WF.PAL_WS_RECEIVE` | 1 | **Click** |
| `WF.PAL_GQL_QUERY` | 3 | Spotlight + **click** |
| `WF.PAL_GQL_MUTATION` | 1 | **Click** |
| `WF.PAL_GQL_ASSERT` | 2 | **Click** |
| `WF.PAL_GQL_SUBSCRIPTION` | 1 | Spotlight only |

**Defined but unused:** `PAL_TAB_REQUESTS`, `PAL_TAB_CATALOG`, `PAL_KAFKA_CONSUME/TRIGGER/WAIT`, `PAL_WS_TRIGGER`, `PAL_GQL_INTROSPECT`

---

### Timeline & Status

| Phase | Effort | Status |
|-------|--------|--------|
| Part A: Protocol-colored nodes | 2 hours | ✅ Complete |
| Part B: Palette layout redesign (Option 2) | 4 hours | ✅ Complete |
| Phase 1: `revealPaletteBlock` helper | 2 hours | ✅ Complete |
| Phase 2: High-risk fixes (3 lessons) | 1 hour | ✅ Complete |
| Phase 3: Medium-risk fixes (8 lessons) | 2 hours | ✅ Complete |
| Phase 4: Search verification + fix | 30 min | ✅ Complete |
| Phase 5: Validation (code + tests) | 1 hour | ✅ Complete |
| Part C: CustomSelect double-box fix | 1 hour | ✅ Complete |
| Part D: Excessive Fit View optimization | 2 hours | ✅ Complete |
| **Total** | **~14.5 hours** | **All code phases done** |

Files modified: 20+ (palette component, CSS, helpers, 11 lesson files, 8+ CSS files, test files, plan doc).
Manual 1x playthrough and E2E smoke are user responsibilities at merge time.

---

## Part C: CustomSelect "Double-Box" Styling Fix (IMPLEMENTED)

### Problem

`CustomSelect` (`.cs-trigger`) renders its own border via `src/styles/base.css`. When a parent wrapper class (e.g., `.data-source-toolbar-select`, `.env-auth-select`) also applied box-drawing styles (border, background, padding), two nested borders appeared — a "double-box" visual bug.

### Solution

For every affected selector, box-drawing styles were moved from the parent wrapper class to a descendant selector targeting `.cs-trigger` within that wrapper. The wrapper retains only layout properties (width, flex, font-size).

### Files Changed

| File | Selectors Fixed |
|------|----------------|
| `src/styles/scenario-builder.css` | `.data-source-toolbar-select` |
| `src/styles/environment-manager.css` | `.env-auth-select` |
| `src/styles/catalog.css` | `.ceb-server-select`, `.sw-pinput` (neutralize for CustomSelect) |
| `src/styles/websocket-studio.css` | `.ws-message-direction-filter`, `.ws-validation-filter`, `.ws-schema-direction-select` |
| `src/styles/shared-data-sources.css` | `.shared-ds-fetch-method`, `.shared-ds-fetch-auth-type` |
| `src/styles/graphql-studio.css` | `.gql-advsettings-select` |
| `src/styles/sse-studio.css` | `.sse-type-filter` |
| `src/styles/workflow.css` | `.wf-toolbar-env-select` |

---

## Part D: Excessive Fit View Optimization (IMPLEMENTED)

### Problem

All 8 workflow demo lessons called `fitCanvasCentered()` too frequently — in `ensureSeededWorkflow()` on every step entry (even when the workflow was already displayed), and multiple times within single action steps. This caused jarring, repeated canvas movement that distracted the viewer.

### Solution

1. **`ensureSeededWorkflow()`** — Modified in all 8 lessons to only call `fitCanvasCentered()` when `state === 'selected'` (the system had to switch to this workflow from another). When `state === 'ready'` (workflow already displayed), the fit is skipped.

2. **Action step fits** — Reduced multiple `fitCanvasCentered()` calls within single action steps to occur only at the most impactful moment (e.g., after all nodes in a segment are connected, not after each individual node).

### Files Changed

| Lesson File | Changes |
|-------------|---------|
| `wf-first-workflow.ts` | Removed unconditional `fitCanvasCentered()` from preAction of steps 4, 5, 6 |
| `wf-variables-extraction.ts` | `ensureSeededWorkflow`: fit only on `selected` state |
| `wf-conditional-logic.ts` | `ensureSeededWorkflow`: fit only on `selected`; step 4: 3→1 fits; step 5: 2→1 fits |
| `wf-loops-parallel.ts` | `ensureSeededWorkflow`: fit only on `selected`; steps 3-6: removed redundant fits |
| `wf-error-handling.ts` | `ensureSeededWorkflow`: fit only on `selected` |
| `wf-protocol-nodes.ts` | `ensureSeededWorkflow`: fit only on `selected`; step 3: 3→1 fits; step 4 preAction: removed fit |
| `wf-version-services.ts` | `ensureSeededWorkflow`: fit only on `selected`; kept necessary post-tab-switch fits |
| `wf-debug-console.ts` | `ensureSeededWorkflow`: fit only on `selected` |

---

### Checklist (Pre-Merge Gate)

```text
Workflow palette redesign — full scope:
[x] Part A: Protocol-colored canvas nodes
[x] Part B: Palette layout redesign (Option 2 — vertical icon rail + protocol chips)
[x] Phase 1: revealPaletteBlock helper created + 11 unit tests
[x] Phase 2: 3 high-risk lessons updated (ws-builder, gql-11, gql-18)
[x] Phase 3: 8 medium-risk lessons updated (spotlight calls)
[x] Phase 4: Palette search verified + search-clearing fix added
[x] Phase 5a: Code audit — PALETTE_BLOCK_MAP (35/35), selector cross-check (17/17), zero unguarded patterns
[x] Phase 5b: tsc clean + all scoped tests passing
[x] Part C: CustomSelect double-box styling fix (10 selectors across 8 CSS files)
[x] Part D: Excessive Fit View optimization (8 workflow lessons)
[ ] Manual 1x playthrough — all modified workflow lessons (user)
[ ] E2E smoke — at merge gate only
```
