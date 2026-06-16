# Demo Hub — WebSocket Demo Lessons Plan

> **Created:** 2026-06-14
> **Updated:** 2026-06-16 — Lesson 21 added: Local TLS Echo Server (Docker) with 3-phase TLS education (skip-cert, CA cert, mTLS); generate-client-cert.sh + docker-compose.mtls.yml + nginx-mtls.conf added; 9 E2E tests pass; all 8 steps live-validated with Playwright MCP; dockerCommand updated to include idempotent cert generation
> **Branch:** `feature/websocket-demo-hub`
> **Lessons (v2):** `src/features/demo-player/lessons/` — **used by Learning Hub UI**
> **Suites (v1 legacy):** ~~`src/features/demo-player/suites/`~~ — **DELETED** (all 5 v1 files removed 2026-06-15)
> **Selectors:** `src/shared/selectors.ts` (WS, SSE, WF, DEMO constants)
> **Unit tests:** `src/features/demo-player/lessons/protocols/ws-lessons.test.ts`

---

## Architecture: Two Systems

| **System** | Directory | Registry | UI Component | Status |
|---|---|---|---|
|---|
| **Lessons (v2)** | `lessons/` | `allDomains` in `lessons/index.ts` | `DemoHub.tsx` → Learning Hub cards | **Active** — what users see |
| **Suites (v1)** | ~~`suites/`~~ | ~~`allDemoSuites`~~ | ~~`DemoPlayer.tsx`~~ | **✅ Deleted 2026-06-15** |

The Learning Hub UI shows **4 domain cards**:
- **Protocols** — 21 lessons ✅ All shipped (17 standalone + 4 Docker)
- **API Testing** — Coming Soon (`available: false`)
- **Workflows** — Coming Soon (`available: false`)
- **Test Harness** — Coming Soon (`available: false`)

### Key files
- Domain definitions: `src/features/demo-player/lessons/index.ts` → `protocolsDomain.lessons[]`
- Lesson files: `src/features/demo-player/lessons/protocols/ws-*.ts`
- Setup helpers: `src/features/demo-player/lessons/setup-helpers.ts` (shared `wsSetup` / `wsCleanup` hooks)
- Domain card UI: `src/features/demo-player/DomainSelector.tsx`
- Lesson player: `src/features/demo-player/DemoHub.tsx`
- Selectors: `src/shared/selectors.ts` — `WS.*` and `DEMO.*` constants

### `useDemoWorkflowBridge` — window bridges for demo lessons

`src/app/hooks/useDemoWorkflowBridge.ts` exposes helper functions on `window` so demo lesson setup/cleanup callbacks can manipulate React workflow state without being inside the React component tree.

**Bridges exposed:**
- `window.__wfDeleteByName(name: string)` — finds a workflow by name in `useWorkflows().workflows` and removes it. Used by Lesson 8 setup/cleanup to remove stale "WS Echo Demo" copies.
- `window.__wfInsertWorkflow(wf: Workflow)` — calls `useWorkflows().insert(wf)` to add a new workflow to React state. Exposed only when the hook receives an `insert` callback (introduced for Lesson 20 seeding). *(Added 2026-06-15)*

**Hook signature:**
```typescript
export function useDemoWorkflowBridge(
  workflows: Array<{ id: string; name: string }>,
  remove: (id: string) => void,
  insert?: (wf: Workflow) => void,  // optional — only needed when lessons seed workflows
): void
```

**`App.tsx` call site:**
```typescript
useDemoWorkflowBridge(wfHook.workflows, wfHook.remove, wfHook.insert);
```

> **Note:** `protocolsDomain` already defines `categories`: `kafka`, `websocket`, `sse`. New lessons should set `category` accordingly (e.g. `category: 'sse'` for SSE Studio, `category: 'websocket'` for all WS lessons).

---

## Phase Status Tracker

### Recommended Learning Path

The lesson order follows a **learner-first progression** — not the E2E test file structure:

1. **Mock Server** → zero-friction start, instant success in 30 seconds ✅
2. **WS Basics** → fundamentals with a running server to connect to ✅
3. **Console & Debugging** → teach debugging BEFORE multi-tab (so users debug well from the start) ✅
4. **Tabs & Multi-Connection** → scale up to real workflows, already armed with debugging skills ✅
5. **Auth & Transport** → intermediate: TLS, headers, subprotocols (connection configuration) ✅
6. **Filtering, Diff & Schema** → power-user analysis tools (needs comfort with message flow first) ✅
7. **Load Testing** → stress testing capstone of the WS core arc ✅
8. **Workflow Builder** → visual automation (hands-on build: Connect → Send → Receive → Quick Test) ✅
9. **SSE Studio** → "there's more than WebSocket" — natural transition to other protocols ✅
10–12. **Docker tier** → Socket.IO → STOMP → GraphQL ✅
13–20. **Phase 2 tier** → Advanced Mock → Workspace → Reliability → Session Recording → Power User → SSE Advanced → TLS → Workflow Runner ✅

### Protocols Domain (Active — 20/20 lessons shipped)

| # | Lesson | Status | Steps | Source E2E | Priority | Docker |
|---|---|---|---|---|---|---|
| **1** | **Mock Server** | ✅ Shipped | 7 | ws-mock-server | **P1** | No |
| 2 | WS Basics | ✅ Shipped | 9 | ws-core-connect | — | No |
| **3** | **Console & Debugging** | ✅ Shipped | 9 | ws-protocols-console | **P2** | No |
| **4** | **Tabs & Multi-Connection** | ✅ Shipped | 8 | ws-tabs-persistence | **P3** | No |
| 5 | Auth & Transport | ✅ Shipped | 9 | ws-core-connect, ws-protocols-transport | — | No |
| **6** | **Filtering, Diff & Schema** | ✅ Shipped | 9 | ws-filter-diff-schema-test | **P4** | No |
| **7** | **Load Testing** | ✅ Shipped | 7 | ws-load-test | **P5** | No |
| **8** | **Workflow Builder** | ✅ Shipped | 11 | — (hands-on build) | **P7** | No |
| **9** | **SSE Studio** | ✅ Shipped | 7 | sse-studio | **P6** | No |
| **10** | **Socket.IO** | ✅ Shipped | 9 | ws-protocols-socketio | **P8** | 🐳 Yes |
| **11** | **STOMP / RabbitMQ** | ✅ Shipped | 8 | ws-protocols-stomp | **P9** | 🐳 Yes |
| **12** | **GraphQL Subscriptions** | ✅ Shipped | 7 | ws-protocols-graphql | **P10** | 🐳 Yes |
| **13** | **Advanced Mock Server** | ✅ Shipped | 8 | ws-mock-server-advanced | **P1** | No |
| **14** | **Workspace: Profiles, Templates & Env Vars** | ✅ Shipped | 8 | ws-workspace | **P2** | No |
| **15** | **Reliability: Auto-Reconnect & Stats** | ✅ Shipped | 7 | ws-reliability | **P3** | No |
| **16** | **Session Recording & Replay** | ✅ Shipped | 7 | ws-session-recording | **P4** | No |
| **17** | **Power User: Tabs & Keyboard** | ✅ Shipped | 7 | ws-power-user | **P5** | No |
| **18** | **SSE Advanced Features** | ✅ Shipped | 7 | sse-studio-advanced | **P6** | No |
| **19** | **Secure WebSocket (wss:// & TLS)** | ✅ Shipped | 7 | ws-tls | **P7** | No |
| **20** | **Run WS Workflow in Harness** | ✅ Shipped | 6 | ws-test-runner | **P8** | No |
| **21** | **Local TLS Echo Server (Docker)** | ✅ Shipped | 8 | ws-tls-local-demo | **P9** | 🐳 Yes |

> **All 21 lessons shipped.** Docker lessons 10–12 + 21 use `PrerequisiteGate` component + `checkEndpoint` utility with auto-polling. The `tag` field and `dockerEndpoint`/`dockerCommand` fields are implemented on `DemoLesson`.

### Workflows Domain (Not used — Workflow Builder moved to Protocols domain)

> Lesson 8 (Workflow Builder) was placed in the Protocols domain under the `websocket` category rather than creating a separate Workflows domain. This keeps all WS-related lessons together and avoids a single-lesson domain.

### API Testing & Test Harness Domains

No WS-specific lessons planned. These domains will be populated with HTTP/harness lessons in future branches.

**Current:** 21/21 lessons shipped | All Docker lessons live | v1 code deleted | All Phase 2 lessons shipped | Phase 3 (mTLS) shipped in Lesson 21

### Legacy Suites (v1) — ✅ DELETED 2026-06-15

All v1 files were removed as dead code after confirming `App.tsx` only imports `DemoHub` (v2):

| Deleted File | Overlapped with |
|---|---|
| `types-v1.ts` | `types.ts` (v2) |
| `useDemoPlayer.ts` | `useDemoHub.ts` (v2) |
| `DemoPlayer.tsx` | `DemoHub.tsx` (v2) |
| `DemoPlayerPanel.tsx` | `DemoHub.tsx` (v2) |
| `DemoSuitePicker.tsx` | `LessonList.tsx` (v2) |
| `suites/` (entire folder) | All 12 v2 lessons |

### v1 Deprecation Plan — ✅ COMPLETED 2026-06-15

All steps completed:
1. ✅ Deleted `src/features/demo-player/suites/` directory (6 suites + index.ts)
2. ✅ Deleted v1 player files: `DemoPlayer.tsx`, `DemoPlayerPanel.tsx`, `DemoSuitePicker.tsx`, `useDemoPlayer.ts`
3. ✅ Deleted `types-v1.ts`
4. ✅ Confirmed `App.tsx` only uses `DemoHub` — no v1 imports
5. ✅ `npx tsc --noEmit` — 0 errors
6. ✅ Removed `v2` labels from header comments in remaining files

> **Note:** `useDemoProgress.ts` storage key `'redfire-demo-progress-v2'` was intentionally kept unchanged to avoid breaking saved lesson progress.

---

## Lesson 1: Mock Server (P1)

**Why:** Zero-friction start — users start a built-in mock server and see WebSocket in action within 30 seconds. No Docker, no external services, no setup. The perfect "first 5 minutes" experience.

**File:** `src/features/demo-player/lessons/protocols/ws-mock-server.ts`
**Export:** `wsMockServerLesson`
**Icon:** 🏗️ | **Est. time:** 2 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (8 steps — shipped)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `mock-intro` | Welcome — Meet Mock Mode | `MODE_MOCK` toggle | WM-01 |
| 2 | `mock-start` | Start the Mock Server | `MOCK_START_BTN` | WM-03 |
| 3 | `mock-status` | Server Status | `MOCK_STATUS_LABEL` | WM-05 |
| 4 | `mock-connect` | Connect to Your Server | `CONNECT_BTN` (preAction fills ws://localhost:9876) | WM-19 |
| 5 | `mock-echo` | Echo — Messages Bounce Back | `SEND_BTN` (preAction fills JSON greeting) | WM-14 |
| 6 | `mock-broadcast` | Broadcast Mode | `MOCK_BROADCAST_BTN` (preAction fills broadcast input) | WM-09 |
| 7 | `mock-stop` | Stop the Server | `MOCK_STOP_BTN` | WM-07 |

**Selectors:** `MOCK_START_BTN`, `MOCK_STOP_BTN`, `MODE_MOCK`, `MOCK_STATUS_LABEL`, `MOCK_CLIENT_COUNT`, `MOCK_BROADCAST_INPUT`, `MOCK_BROADCAST_BTN`, `MOCK_FALLBACK_SELECT`.
**No setup** (mock IS the setup). **Cleanup:** disconnect → stop mock → switch to client.

> **Note:** Lesson 2 (WS Basics) and Lesson 5 (Auth & Transport) are already shipped. See `ws-basics.ts` (9 steps) and `ws-auth-transport.ts` (9 steps) for details.

---

## Lesson 3: Console & Debugging (P2)

**Why:** The Console tab is the most powerful debugging tool — slash commands, structured events, category filtering. Currently exists as a v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/ws-console.ts`
**Export:** `wsConsoleLesson`
**Icon:** 🔧 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (9 steps — shipped)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `console-intro` | The Console Tab | `RIGHT_TAB_CONSOLE` | WC-C01 |
| 2 | `console-connect` | /connect Command | `CONSOLE_CMD_INPUT` — types `/connect ws://localhost:9876` + Enter | WP-C01 |
| 3 | `console-lifecycle` | Lifecycle Events | `CONSOLE_ENTRY` — observe lifecycle entries from connection | WP-C01 |
| 4 | `console-categories` | Category Filter | `CONSOLE_CATEGORY` — selects "lifecycle" | WP-C05 |
| 5 | `console-send` | /send Command | `CONSOLE_CMD_INPUT` — types `/send {"demo":"console command"}` + Enter | WP-C02 |
| 6 | `console-help` | /help Command | `CONSOLE_CMD_INPUT` — types `/help` + Enter | WC-C06 |
| 7 | `console-clear` | /clear Command | `CONSOLE_CLEAR` — informational step | WC-C06 |
| 8 | `console-search` | Search Console | `CONSOLE_SEARCH` — fills "connect" | WF-35/36 |
| 9 | `console-views` | Structured vs Raw View | `CONSOLE_VIEW_RAW` — clicks Raw view | WP-C04 |

**Selectors added:** `RIGHT_TAB_CONSOLE`, `CONSOLE_CMD_INPUT`, `CONSOLE_CATEGORY`, `CONSOLE_SEARCH`, `CONSOLE_VIEW_STRUCTURED`, `CONSOLE_VIEW_RAW`, `CONSOLE_CLEAR`, `CONSOLE_COUNT`, `CONSOLE_ENTRY`.
**Setup:** `wsSetup` (start mock server, switch to client mode). **Cleanup:** `wsCleanup` (disconnect, clear, stop mock).

### Implementation Notes
- Originally planned 8 steps with setup-time connection. Changed to 9 steps with explicit `/connect` step because:
  1. Using `/connect` as a step is pedagogically better — it teaches the console command
  2. Setup-time `ctx.fill` + `ctx.click(CONNECT_BTN)` was unreliable due to React state timing
  3. The `/connect` command approach is self-contained and works reliably via keyboard event dispatch
- Console command submission uses `document.querySelector` + `dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))` — same pattern as the CommandLine `onKeyDown` handler
- Step console-categories includes `preAction` that resets category filter to "all" before showing the `/send` step

---

## Lesson 4: Tabs & Multi-Connection (P3) ✅ Shipped

**Why:** Multi-tab is the core WS Studio workflow. Every user needs to understand independent connections, tab lifecycle, and URL history.

**File:** `src/features/demo-player/lessons/protocols/ws-tabs.ts`
**Export:** `wsTabsLesson`
**Icon:** 📑 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (8 steps — shipped)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `tabs-intro` | Your Connection Tab Bar | `CONN_TAB_BAR` | None (informational) |
| 2 | `tabs-add` | Add a New Tab | `CONN_TAB_ADD` | Clicks + button; verify: `CONN_TAB_LAST` |
| 3 | `tabs-switch` | Switch Between Tabs | `CONN_TAB_FIRST` | Clicks first tab |
| 4 | `tabs-connect` | Connect in This Tab | `CONSOLE_CMD_INPUT` | preAction: clicks Console tab; fills `/connect ws://localhost:9876` + Enter |
| 5 | `tabs-independent` | Tabs Are Independent | `CONN_TAB_LAST` | Clicks last tab via `querySelectorAll` |
| 6 | `tabs-rename` | Rename a Tab | `CONN_TAB_FIRST` | preAction: switches to first tab; dblclick → fills "Echo Server" via native setter → Enter |
| 7 | `tabs-history` | URL History | `CONN_TAB_HISTORY` | Clicks ▾ dropdown to show, clicks again to close |
| 8 | `tabs-close` | Close a Tab | `CONN_TAB_LAST` | Finds close button on last tab via `querySelectorAll`, clicks it |

**Selectors added to `selectors.ts` → `WS` object:**
```ts
CONN_TAB_BAR:        '[data-testid="conn-tab-bar"]',
CONN_TAB_ADD:        '[data-testid="conn-tab-add"]',
CONN_TAB_FIRST:      '[data-testid="conn-tab-bar"] [role="tab"]:first-child',
CONN_TAB_LAST:       '[data-testid="conn-tab-bar"] > [role="tab"]:not(:has(~ [role="tab"]))',
CONN_TAB_CLOSE:      '[data-testid^="conn-tab-close-"]',
CONN_TAB_RENAME:     '[data-testid^="conn-tab-rename-"]',
CONN_TAB_HISTORY:    '[data-testid="conn-tab-history-trigger"]',
CONN_TAB_HISTORY_DD: '[data-testid="conn-tab-history-dropdown"]',
```

**Setup:** `tabsSetup` — waits 500ms for tab bar render, disconnects active connections, calls `closeExtraTabs()` to ensure exactly 1 tab, then runs `wsSetup` (start mock + switch to client).
**Cleanup:** `tabsCleanup` — closes extra tabs, disconnects, clears events, stops mock, switches to client.

### Implementation Notes
- **Step order differs from original plan:** Reordered to follow a logical demo flow — add tab first, switch, connect, then show independence, rename, history, and close. Removed bookmark/keyboard steps (too granular for a demo) in favor of focused tab lifecycle.
- **`CONN_TAB_LAST` selector:** Cannot use `:last-child` because the tab bar has non-tab children (add button, history wrapper). Uses CSS4 `:has()` — `[role="tab"]:not(:has(~ [role="tab"]))` — to select the last tab sibling. Supported in all modern browsers.
- **Action fallback for last tab:** Steps 5 and 8 use `querySelectorAll` + array indexing instead of `document.querySelector(CONN_TAB_LAST)` for extra reliability.
- **Tab persistence cleanup:** Tabs persist to storage via `loadWsTabState()`/`saveWsTabState()`. Custom `tabsSetup` runs `closeExtraTabs()` before `wsSetup` to clean leftover tabs from previous demo runs.
- **Rename uses native setter:** `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + `input`/`change` events to work with React's controlled input pattern.
- **Close button visibility:** Close buttons only render when `tabs.length > 1`. The `closeExtraTabs` helper correctly exits when 1 tab remains.
- **Unit tests:** 24 tests covering structure, concept, all 8 steps, actions, highlights, setup, cleanup (137 total in ws-lessons.test.ts).

---

## Lesson 5: Auth & Transport (Shipped)

> Shipped as `ws-auth-transport.ts` (9 steps). See source file for details.

### Steps (9 steps — shipped)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `auth-intro` | Authentication Overview | `LEFT_TAB_AUTH` | Click Auth tab |
| 2 | `auth-type-selector` | Choose an Auth Type | `AUTH_TYPE_SELECT` | Select "Bearer Token" |
| 3 | `auth-bearer` | Enter a Bearer Token | `AUTH_PANEL` | Fill demo JWT token via native setter |
| 4 | `auth-callout` | Browser Transport Callout | `AUTH_CALLOUT` | (highlight only) |
| 5 | `auth-connect-setup` | Set Up the Connection | `URL_INPUT` | Switch to Connect, fill ws://localhost:9876 |
| 6 | `auth-connect` | Connect with Auth | `CONNECT_BTN` | Click Connect, verify `STATUS_CONNECTED` |
| 7 | `auth-compose-send` | Send an Authenticated Message | `LEFT_TAB_COMPOSE` | Switch to Compose, fill + send JSON, verify `MESSAGE_ROW` |
| 8 | `auth-events` | Verify in Events | `RIGHT_TAB_EVENTS` | Click Events tab |
| 9 | `auth-protocol` | Protocol Selector | `PROTOCOL_SELECT` | Switch to Connect (highlight only) |

**Selectors:** `AUTH_TYPE_SELECT`, `AUTH_TYPE_DROPDOWN`, `AUTH_PANEL`, `AUTH_PANE_INPUTS`, `AUTH_CALLOUT`, `PROTOCOL_SELECT`.
**Setup:** `authSetup` — disconnects, clears events, resets auth to "No Auth", then runs `wsSetup` (start mock + switch to client). Auth reset ensures Bearer selection is visible on replay.
**Cleanup:** `wsAuthCleanup` — disconnect, clear events, reset auth, stop mock, switch to client.

### Implementation Notes
- **Custom setup for replay idempotency:** Unlike basic `wsSetup`, `authSetup` resets auth type to "No Auth" before starting. Without this, replaying the lesson would show Bearer already selected — making step 2 a visual no-op.
- **`pauseAfter: true` on all steps:** Added for consistency with lessons 1–4. Without it, the demo auto-plays through all 9 steps without pausing, which is too fast for learning.
- **Token fill uses native setter:** Step 3 uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + `input`/`change` events to work with React's controlled input pattern.
- **Step 7 highlight changed:** Changed from `SEND_BTN` to `LEFT_TAB_COMPOSE` — the Send button is disabled until text is entered (by preAction), so highlighting it before fill creates a confusing spotlight on a disabled button.
- **Proxy transport verified visually:** The status bar shows "Proxy" badge when connected with Bearer auth, confirming the transport routing works correctly.
- **Unit tests:** 137 total in ws-lessons.test.ts (up from 135) — added pauseAfter and compose highlight tests.

---

## Lesson 6: Filtering, Diff & Schema (P4)

**Why:** Power-user features for analyzing WS traffic — search modes, compare messages, validate against schemas. Currently exists as v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/ws-filtering.ts`
**Export:** `wsFilteringLesson`
**Icon:** 🔍 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (implemented)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `filter-search` | Search Modes | Search mode pills | Fills "greeting" → shows 4/9 matches |
| 2 | `filter-direction` | Direction Filter | Direction dropdown | Selects "Sent" filter |
| 3 | `filter-bar` | Advanced Filters | Filter toggle button | Opens size/time/content-type bar |
| 4 | `diff-compare` | Compare Mode | Compare button | Activates compare banner |
| 5 | `diff-view` | View the Diff | Compare banner | Clicks 2 messages → opens diff modal |
| 6 | `diff-close` | Close the Diff | Diff close button | Closes diff modal |
| 7 | `schema-add` | Add a JSON Schema | Schema tab | Creates greeting schema + enables validation |
| 8 | `schema-validate` | Live Validation Badges | Events tab | Shows ✓/✗ badges + validation filter |

### Implementation Notes

- **Dropped `filter-badges` and `filter-preset` steps:** `filter-badges` was redundant with the filter bar step. `filter-preset` uses `window.prompt()` which blocks the demo — replaced with a direction filter step instead.
- **Dropped `diff-detail` step:** Quick diff (prev/next) buttons require specific adjacent message conditions. Replaced with explicit diff-view and diff-close steps for a cleaner demo flow.
- **Added `filter-direction` step:** Demonstrates the direction dropdown (sent/received/bookmarked filter) — a simple but powerful feature.
- **Custom setup:** Connects to mock server and sends 4 varied JSON messages (greeting, status, greeting, error) to provide content for search/compare/schema features.
- **Custom cleanup:** Gracefully handles open diff modal, compare mode, and filter bar — closes all before standard cleanup.
- **Schema step uses native setter pattern:** React controlled inputs for schema name and textarea require `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set` + event dispatch.
- **29 new unit tests added** to `ws-lessons.test.ts` (total: 166 tests, all passing).
- **New selectors added** to `selectors.ts`: 20+ selectors for search, filter, compare, diff, and schema features.

---

## Lesson 7: Load Testing (P5) ✅ Shipped

**Why:** Showcases power-user value — constant/ramp/burst profiles, live metrics dashboard, latency histogram, and export. Differentiates the app from simple WS clients.

**File:** `src/features/demo-player/lessons/protocols/ws-load-testing.ts`
**Export:** `wsLoadTestingLesson`
**Icon:** 📊 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (7 steps — shipped)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `lt-intro` | Load Test Tab | `WS.LT_TAB` | Click Load Test tab |
| 2 | `lt-template` | Message Template | `WS.LT_TEMPLATE` | `ctx.fill()` — fills JSON template with `{{counter}}`, `{{timestamp}}` |
| 3 | `lt-profile` | Load Profile | `WS.LT_PROFILE_SELECT` | (highlight only — shows constant/ramp/burst options) |
| 4 | `lt-settings` | Rate & Duration | `WS.LT_SETTINGS` | `ctx.fill()` rate=5 msg/s, duration=2s |
| 5 | `lt-run` | Run the Test | `WS.LT_START_BTN` | Click Start, wait 3s for test to complete |
| 6 | `lt-results` | Results Dashboard | `WS.LT_RESULTS` | (observation — metrics, latency, chart) |
| 7 | `lt-export` | Export Results | `WS.LT_EXPORT_BTN` | (highlight only) |

**Selectors added to `selectors.ts` → `WS` object (24 total):**
```ts
LT_TAB, LT_PANEL, LT_TEMPLATE, LT_PROFILE_SELECT, LT_RATE, LT_DURATION,
LT_SETTINGS, LT_START_BTN, LT_STOP_BTN, LT_STATUS, LT_PROGRESS,
LT_RESULTS, LT_TOTAL, LT_SUCCESS, LT_FAILED, LT_RATE_ACTUAL,
LT_LATENCY_P50, LT_LATENCY_P95, LT_LATENCY_P99, LT_CHART,
LT_EXPORT_BTN, LT_NEW_TEST_BTN, LT_ERROR, LT_HISTOGRAM
```

**Setup:** disconnect → clear → wsSetup (mock server) → connectToMock → switch to Load Test tab
**Cleanup:** stop running test → clear results → switch to events → wsCleanup

### Implementation Notes
- **`ctx.fill()` instead of manual native setter:** Original implementation used manual `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + event dispatch on textarea and inputs. This didn't reliably update React state. Switched to `ctx.fill()` which already handles both `HTMLInputElement` and `HTMLTextAreaElement` with proper native setter + input/change event dispatch.
- **`{{counter}}` not `{{i}}`:** Original plan used `{{i}}` in the template example, but the actual Load Test UI uses `{{counter}}` as the placeholder variable name. Updated concept body and step descriptions to match.
- **Rate and duration fill:** Both rate (5) and duration (2) use `ctx.fill()` with CSS selectors for the input fields inside the settings area. The Start button requires both a connected WebSocket AND a non-empty template to become enabled.
- **Test runs in 2 seconds:** With rate=5 and duration=2, the test sends ~10 messages total. The 3-second wait in step 5 allows the test to complete and results to render.
- **Visually verified:** All 7 steps play correctly — template fills, rate/duration set, test runs producing 9 messages, results dashboard shows metrics (total, success, rate, latency), export button highlighted.

---

## Lesson 8: WS Workflow Builder (P7) ✅ Shipped

**Why:** Hands-on build lesson that introduces the visual workflow designer. Users create a full WS workflow (Connect → Send → Receive) from scratch, configure each node, and run it. Demonstrates deep integration of WS testing with drag-and-drop automation.

**File:** `src/features/demo-player/lessons/protocols/ws-workflow-builder.ts`
**Export:** `wsWorkflowBuilderLesson`
**Icon:** 🔀 | **Est. time:** 3 min | **initialTab:** `workflow`
**Category:** `websocket` (in Protocols domain, not a separate Workflows domain)

### Steps (11 steps — shipped)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `wf-create` | Create a New Workflow | `WF.TOOLBAR` | Creates blank workflow |
| 2 | `wf-palette` | Node Palette | `WF.PALETTE` | (observation) |
| 3 | `wf-add-connect` | Add WS Connect Node | `WF.CANVAS` | Drags WS Connect from palette |
| 4 | `wf-config-connect` | Configure Connect | `WF.WS_CONNECT_CFG` | Fills URL ({{wsUrl}}) |
| 5 | `wf-define-variable` | Define wsUrl Variable | `WF.VARIABLES_BTN` | Opens variables panel, adds wsUrl |
| 6 | `wf-add-send` | Add WS Send Node | `WF.CANVAS` | Drags WS Send |
| 7 | `wf-config-send` | Configure Send | `WF.WS_SEND_CFG` | Fills message payload |
| 8 | `wf-add-receive` | Add WS Receive Node | `WF.CANVAS` | Drags WS Receive |
| 9 | `wf-config-receive` | Configure Receive | `WF.WS_RECEIVE_CFG` | Sets timeout |
| 10 | `wf-quick-test` | Quick Test | `WF.QUICK_TEST_BTN` | Runs the workflow in the Designer |
| 11 | `wf-runner-variable` | Workflow Runner Variable | `WF.VARIABLES_BTN` | Shows variable override before running |

**Selectors added to `selectors.ts` → `WF` export (18 total):**
```ts
DESIGNER, TOOLBAR, TOOLBAR_SELECT, QUICK_TEST_BTN, PALETTE, CANVAS,
CONTROLS, NODE_CONFIG, CFG_CLOSE, CONSOLE, EXEC_SUMMARY, TPL_BROWSE,
WS_CONNECT_CFG, WS_SEND_CFG, WS_RECEIVE_CFG, SERVICES_BTN,
VARIABLES_BTN
```

**Setup:** Simple 300ms delay (no workflow needs to be loaded)
**Cleanup:** Close any open node config modals; delete "WS Echo Demo" workflow via `__wfDeleteByName`

### Implementation Notes
- **Hands-on build (not observation-only):** Original plan described an observation-only lesson. Revised to be a hands-on build: user creates a full WS workflow. Lessons 10–12 demonstrate how well the builder handles protocol-specific nodes.
- **Placed in Protocols domain:** Original plan had this in a separate `workflowDomain` and `lessons/workflows/` directory. Moved to `lessons/protocols/ws-workflow-builder.ts` under `category: 'websocket'` to keep all WS-related lessons together. This avoids a single-lesson Workflows domain.
- **Concept page with SVG diagram:** The concept includes a Mermaid-style SVG showing Palette → Canvas (Connect → Send → Receive) → Run panel with Quick Test and Debug buttons.
- **`wf-runner-variable` step:** Added to demonstrate variable overrides in the Workflow Runner — this sets up the user for Lesson 20 (running the workflow in the Test Harness).
- **11 steps vs. original 9:** Two steps added (variable definition + runner variable) to complete the hands-on flow.

---

## Lesson 9: SSE Studio (P6) ✅ Shipped

**Why:** SSE is a distinct protocol with its own Studio page. Users need to know how to find it, connect, and monitor events. Currently exists as v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/sse-studio.ts`
**Export:** `sseStudioLesson`
**Icon:** 📡 | **Est. time:** 2 min | **initialTab:** `sse-studio`
**Category:** `sse`

### Steps (7 steps — shipped)

| # | Step ID | Title | Highlight | Action |
|---|---|---|---|---|
| 1 | `sse-nav` | Navigate to SSE Studio | `SSE.NAV_TAB` | (highlight — already on SSE Studio via initialTab) |
| 2 | `sse-connect` | Connect to an SSE Endpoint | `SSE.CONNECT_BTN` | preAction: fill URL `http://localhost:3001/api/sse-test`; action: click Connect |
| 3 | `sse-events` | Live Event Stream | `SSE.EVENT_ROW` | (observation — events stream in with type badges) |
| 4 | `sse-detail` | Event Detail Panel | `SSE.DETAIL_PANEL` | Click first event row to open detail |
| 5 | `sse-filter` | Search & Filter | `SSE.SEARCH_INPUT` | Fill "greeting" in search to filter events |
| 6 | `sse-console` | SSE Console | `SSE.CONSOLE_TAB` | Click console tab to show lifecycle events |
| 7 | `sse-disconnect` | Disconnect | `SSE.DISCONNECT_BTN` | Click Disconnect button |

**Selectors added to `selectors.ts` → `SSE` export (17 total):**
```ts
NAV_TAB, URL_INPUT, CONNECT_BTN, DISCONNECT_BTN, STATUS,
EVENT_LIST, EVENT_ROW, EVENT_TYPE_BADGE, DETAIL_PANEL,
SEARCH_INPUT, TYPE_FILTER, CONSOLE_TAB, CONSOLE_OUTPUT,
BOOKMARK_BTN, CLEAR_BTN, EXPORT_BTN, EVENT_COUNT
```

**Setup:** Switch to SSE Studio tab, disconnect any active SSE, clear events, wait 500ms
**Cleanup:** Disconnect active SSE connection, clear events

### Implementation Notes
- **`initialTab: 'sse-studio'`:** SSE Studio is a separate top-level tab (`activeTab === 'sse-studio'`), not a sub-tab of Protocols. The lesson sets `initialTab` to navigate directly.
- **SSE test endpoint:** Uses `http://localhost:3001/api/sse-test` from webhook-server.ts, which sends events every 1 second with types: message/update/status.
- **Step 6 changed from "Bookmark Events" to "SSE Console":** The plan originally had a bookmark step, but the SSE Console tab is more distinctive and educational.
- **SVG diagram cosmetic error:** The concept page diagram uses `orient: "auto-start-auto"` which triggers a console warning — cosmetic only, doesn't affect functionality.
- **Visually verified:** All 7 steps play correctly — navigates to SSE, connects to localhost:3001, events stream with type badges, detail panel opens, search filters to "greeting", console tab shows lifecycle, disconnect works.

---

---

## Lesson 9: SSE Studio (P6) ✅ Shipped

**Why:** SSE is a distinct protocol with its own Studio page. Users need to know how to find it, connect, and monitor events. Currently exists as v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/sse-studio.ts`
**Export:** `sseStudioLesson`
**Icon:** 📡 | **Est. time:** 2 min | **initialTab:** `sse-studio`
**Category:** `sse`

## Implementation Checklist (per lesson)

For each new lesson:

- [ ] Create lesson file in `src/features/demo-player/lessons/protocols/ws-*.ts` (or `lessons/workflows/` for Workflow domain)
- [ ] Add any new selectors to `src/shared/selectors.ts`
- [ ] Register in `src/features/demo-player/lessons/index.ts` → `protocolsDomain.lessons[]` (or `workflowDomain.lessons[]`)
- [ ] **Array order matters** — lessons render in registration order. Follow the learning path: Mock → Basics → Console → Tabs → Auth → Filtering → Load → SSE → Docker lessons
- [ ] Update domain card lesson count (UI auto-counts from `lessons.length`)
- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] Run unit tests: `npx vitest run src/features/demo-player/`
- [ ] Visual test: open Learning Hub in browser, click domain card, play through all steps
- [ ] Verify spotlight ring highlights correct element at each step
- [ ] Verify step descriptions are clear for first-time users
- [ ] Verify domain card shows updated lesson count (e.g. "8 lessons" for Protocols)

---

## Not Planned as Standalone Demos

| Feature | Reason |
|---|---|
| Session Replay (WT-28–31) | Better as organic addition when feature matures; niche audience |
| Tab Keyboard Nav (WT-39–42) | Covered as tip in Lesson 4 step 7; too simple for standalone |
| Tab Drag Reorder (WT-36–38) | Self-explanatory; mentioned as tip in Lesson 4 |

---

# Advanced Tier — Docker-Dependent Demos (Optional)

These lessons showcase protocol-specific features that require Docker containers. They use a **prerequisite check pattern** so they always work — either live or as a guided slideshow with fallback screenshots.

## Docker Setup Guide (for users without Docker)

When a user clicks a 🐳 Docker lesson and Docker is not available, the PrerequisiteGate shows a **3-step setup guide** before the demo content:

### Step 1: Install Docker

| Platform | Install |
|---|---|
| **macOS** | [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) — drag to Applications, launch, wait for whale icon in menu bar |
| **Windows** | [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) — requires WSL 2, run installer, restart |
| **Linux** | `curl -fsSL https://get.docker.com | sh` then `sudo systemctl start docker` |

> **Verify:** Open a terminal and run `docker --version` — you should see `Docker version 24.x+`

### Step 2: Start the Protocol Server

Each Docker demo needs one container. Copy-paste the command shown in the lesson:

```bash
# Socket.IO (Lesson 10)
cd <project-root>
docker compose -f docker/websocket/socketio/docker-compose.yml up -d

# STOMP / RabbitMQ (Lesson 11)
cd <project-root>
docker compose -f docker/websocket/stomp/docker-compose.yml up -d

# GraphQL-WS (Lesson 12)
cd <project-root>
docker compose -f docker/websocket/graphql/docker-compose.yml up -d

# Or start ALL protocol servers at once:
cd <project-root>
docker compose -f docker/websocket/docker-compose.all.yml up -d
```

> **First run:** Docker will pull images (~30s–2min depending on network). Subsequent starts are instant.

### Step 3: Verify & Play

Click **"Check Again"** in the lesson — the status indicator turns green when the server is ready. Then proceed with the live interactive demo.

> **When done:** Stop containers with `docker compose -f docker/websocket/docker-compose.all.yml down` or leave them running for future demos.

### UI Implementation

The PrerequisiteGate component renders this guide as a styled card with:
- **Platform auto-detection** — highlights the relevant install instructions (macOS/Windows/Linux)
- **Copy button** on each docker command
- **Live status indicator** — polls `checkEndpoint()` every 3 seconds while the guide is visible
- **"Start All Servers"** shortcut button (copies the `docker-compose.all.yml` command)
- **"Skip — Use Screenshots"** link at the bottom for users who can't install Docker

---

## Prerequisite Check Pattern

```
User clicks lesson → setup() runs →
  checkEndpoint(url) probes the container port →
    ✅ Reachable → proceed with live interactive demo
    ❌ Not reachable → show "Setup Required" concept slide:
       - Docker Setup Guide (install + start + verify)
       - Copy-pasteable docker compose command for this specific lesson
       - "Check Again" button (re-runs checkEndpoint)
       - "Continue with screenshots" toggle (uses fallbackImage per step)
```

**Key principle:** The lesson never dead-ends. Users without Docker still get the full guided tour via annotated screenshots.

### Infrastructure Required

**File:** `src/features/demo-player/utils/checkEndpoint.ts`

```ts
/** Try a WebSocket handshake — resolve true if open, false on error/timeout */
export async function checkEndpoint(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); resolve(false); }, timeoutMs);
    ws.onopen = () => { clearTimeout(timer); ws.close(); resolve(true); };
    ws.onerror = () => { clearTimeout(timer); resolve(false); };
  });
}
```

**File:** `src/features/demo-player/components/PrerequisiteGate.tsx`

A reusable component shown as the concept slide when `setup()` detects the container is down:
- Docker command in a code block with copy button
- Animated status indicator (checking → ready / not ready)
- "Check Again" button
- "Continue with screenshots" fallback toggle

### Fallback Screenshots

Stored in `public/demo-screenshots/<lesson-id>/` — one PNG per step, captured from a live session.
Referenced via `fallbackImage` field on each `DemoStep`.

---

## Lesson 10: Socket.IO Protocol (P8 — Docker) ✅ Shipped

**Why:** Socket.IO is the most popular real-time framework. Showing auto-detection, event names, and namespaces demonstrates deep protocol support.

**File:** `src/features/demo-player/lessons/protocols/ws-socketio.ts`
**Export:** `wsSocketIoLesson`
**Icon:** 🔌 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/socketio/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:3100/socket.io/?EIO=4&transport=websocket`
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Docker`

### Steps (9 steps — shipped)

| # | Step ID | Title | Highlight |
|---|---|---|---|
| 1 | `sio-intro` | Connect Panel — Pre-Configured | `LEFT_TAB_CONNECT` |
| 2 | `sio-enter-url` | Enter the Socket.IO URL | `URL_INPUT` |
| 3 | `sio-select-protocol` | Select Socket.IO Protocol | `PROTOCOL_SELECT` |
| 4 | `sio-connect` | Connect — Auto-Handshake | `RIGHT_TAB_EVENTS` |
| 5 | `sio-compose-event` | Event Name Field | `SIO_EVENT_NAME` |
| 6 | `sio-send` | Send a Named Event | `SEND_BTN` |
| 7 | `sio-namespace` | Socket.IO Namespaces | `SIO_NAMESPACE` |
| 8 | `sio-inspect-params` | Engine.IO URL Parameters | `URL_INPUT` |
| 9 | `sio-disconnect` | Disconnect | `DISCONNECT_BTN` |

---

## Lesson 11: STOMP / RabbitMQ (P9 — Docker) ✅ Shipped

**Why:** Enterprise messaging with RabbitMQ is a key differentiator. Shows the two-step handshake (WebSocket transport + STOMP CONNECT frame), destination-based routing (SUBSCRIBE + SEND), and how RedfireForge decodes every frame type.

**File:** `src/features/demo-player/lessons/protocols/ws-stomp.ts`
**Export:** `wsStompLesson`
**Icon:** 📬 | **Est. time:** 4 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/stomp/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:15674/ws` (credentials: `guest` / `guest`)
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Docker`

### Key Design Decisions

1. **Two-step handshake shown as separate steps:** STOMP on WebSocket requires first opening the WS transport, THEN sending a STOMP CONNECT frame with credentials. This is the most distinctive difference from raw WebSocket and Socket.IO — it's worth showing explicitly.

2. **`stomp-login` / `stomp-passcode` UI fields:** RabbitMQ requires credentials in the STOMP CONNECT frame (`login:guest\npasscode:guest`). The standard STOMP compose UI only has `command` and `destination`. Two new input fields (`[data-testid="stomp-login"]`, `[data-testid="stomp-passcode"]`) are added to `useWebSocketCompose.tsx`, visible only when command is `CONNECT`. These fields are added to the frame headers during send.

3. **`preAction` on compose steps:** STOMP compose fields (`[data-testid="stomp-compose-fields"]`) are only in DOM when the Compose tab is active. Steps that highlight compose fields use `preAction` to navigate to Compose before the spotlight phase.

4. **No STOMP DISCONNECT frame in step 8:** We use the WebSocket Disconnect button (simpler for demo). The narration acknowledges that production STOMP clients should send a DISCONNECT frame first.

### Steps (8 steps — shipped)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `stomp-intro` | Connect Panel — Pre-Configured | `WS.LEFT_TAB_CONNECT` | URL + Protocol pre-filled by setup |
| 2 | `stomp-protocol` | What "Protocol: STOMP" Does | `WS.PROTOCOL_SELECT` | Explains frame structure |
| 3 | `stomp-connect-ws` | The Two-Step Handshake | `WS.RIGHT_TAB_EVENTS` | Click Connect + send STOMP CONNECT frame |
| 4 | `stomp-handshake` | Handshake in the Events Tab | `WS.RIGHT_TAB_EVENTS` | Observation: SYS + CONNECT + CONNECTED |
| 5 | `stomp-subscribe` | Subscribe to /queue/demo | `STOMP_COMPOSE_FIELDS` | SUBSCRIBE command → destination |
| 6 | `stomp-send` | Send a Message — Watch the Echo | `WS.SEND_BTN` | SEND + body → MESSAGE echo |
| 7 | `stomp-frames` | Events Tab — Decoded STOMP Frames | `WS.RIGHT_TAB_EVENTS` | All frame types visible |
| 8 | `stomp-disconnect` | Clean Disconnect | `WS.DISCONNECT_BTN` | ctx.click for visual ripple |

### New Selectors (add to `selectors.ts` → `WS`)

```ts
STOMP_COMPOSE_FIELDS: '[data-testid="stomp-compose-fields"]',
STOMP_COMMAND:        '[data-testid="stomp-command"]',
STOMP_DESTINATION:    '[data-testid="stomp-destination"]',
STOMP_LOGIN:          '[data-testid="stomp-login"]',      // NEW — added to useWebSocketCompose.tsx
STOMP_PASSCODE:       '[data-testid="stomp-passcode"]',   // NEW — added to useWebSocketCompose.tsx
STOMP_MODE_BADGE:     '[data-testid="stomp-mode-badge"]',
```

### UI Change Required: `useWebSocketCompose.tsx`

Add `stomp-login` and `stomp-passcode` inputs to the STOMP compose bar, visible only when `stompCommand === 'CONNECT'`:

```tsx
{isStompMode && stompCommand === 'CONNECT' && (
  <div className="ws-stomp-auth-fields" data-testid="stomp-auth-fields">
    <input ... data-testid="stomp-login" placeholder="Login (e.g. guest)" />
    <input ... type="password" data-testid="stomp-passcode" placeholder="Passcode" />
  </div>
)}
```

Encoding update in the send handler:
```typescript
if (stompCommand === 'CONNECT' || stompCommand === 'STOMP') {
  headers['accept-version'] = '1.2';
  if (input) headers['host'] = input;
  if (stompLogin.trim()) headers['login'] = stompLogin.trim();
  if (stompPasscode.trim()) headers['passcode'] = stompPasscode.trim();
}
```

### Concept Diagram

```
Browser                   RabbitMQ (web-stomp :15674)
  |                                  |
  |  HTTP Upgrade → WebSocket        |
  |--------------------------------->|
  |  101 Switching Protocols         |
  |<---------------------------------|
  |                                  |
  |  CONNECT\nhost:...\nlogin:guest  |  ← STOMP frame (step 2)
  |--------------------------------->|
  |  CONNECTED\nversion:1.2          |
  |<---------------------------------|
  |                                  |
  |  SUBSCRIBE\ndestination:/queue/  |  ← subscribe (step 3)
  |--------------------------------->|
  |                                  |
  |  SEND\ndestination:/queue/demo   |  ← publish (step 4)
  |  \n{"hello":"..."}               |
  |--------------------------------->|
  |  MESSAGE\n←/queue/demo           |  ← delivered back
  |  \n{"hello":"..."}               |
  |<---------------------------------|
  |                                  |
  |  DISCONNECT\n\n\0                |  ← graceful close
  |--------------------------------->|
```

### Key Terms

- **STOMP Frame** — The message unit: `COMMAND\nheader1:value1\n\nbody\0`. Newline-separated headers, null-byte terminated.
- **Destination** — A routing address like `/queue/demo` or `/topic/news`. Queues deliver once; topics broadcast to all subscribers.
- **SUBSCRIBE** — Registers interest in a destination. The broker sends a `MESSAGE` frame for each new message on that destination.
- **CONNECT / CONNECTED** — The STOMP-level handshake after the WebSocket transport opens. Includes credentials and heartbeat negotiation.
- **Heartbeat (♥)** — A single `\n` character sent periodically. The `heart-beat` header in CONNECT negotiates the interval.

### Setup / Cleanup

**Setup:** `stompSetup` — disconnect if needed, clear log, ensure client mode, fill URL (`ws://localhost:15674/ws`), select `stomp` protocol, pre-set STOMP command to `SEND`.

**Cleanup:** `stompCleanup` — disconnect, clear log, reset protocol to `raw`, reset STOMP command to `SEND`, ensure client mode.

---

## Lesson 12: GraphQL Subscriptions (P10 — Docker) ✅ Shipped

**Why:** GraphQL-WS subscriptions are increasingly popular. Shows the automatic connection_init/ack handshake, the subscribe/complete lifecycle, and how RedfireForge decodes every frame type.

**File:** `src/features/demo-player/lessons/protocols/ws-graphql.ts`
**Export:** `wsGraphqlLesson`
**Icon:** ◈ | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/graphql/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:4100/graphql`
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Docker`

### Key Design Decisions

1. **Use `countdown(from: 5)` subscription:** The server exposes two subscriptions — `messageAdded` (requires HTTP POST /publish to generate data) and `countdown(from: Int!)` (auto-generates 6 values: 5,4,3,2,1,0 at 500ms intervals, then `complete`). The countdown is far better for a demo: it's self-contained, visually compelling, and completes in ~3 seconds without any external trigger.

2. **Subprotocol is required:** Unlike STOMP or Socket.IO, GraphQL-WS requires the `graphql-transport-ws` WebSocket subprotocol in the `Sec-WebSocket-Protocol` header. The server rejects connections without it. The setup fills both the protocol selector (`graphql-ws`) AND the Subprotocols field (`graphql-transport-ws`). The lesson description explains this two-field pattern.

3. **`connection_init` is automatic:** Unlike STOMP where you manually send a CONNECT frame, the RedfireForge app auto-sends `connection_init` immediately after the WebSocket opens when protocol=GraphQL-WS. The user just clicks Connect — the handshake happens automatically.

4. **Step 5 action waits for full countdown:** The action in `gql-subscribe` clicks Send then waits 3800ms for the full countdown to complete (6 values × 500ms + buffer). By the time `pauseAfter: true` pauses the demo, ALL data is already visible in Events — the description can immediately reference the completed result.

5. **No manual `complete` needed:** After `countdown(from: 5)`, the server sends `complete` automatically. The Events tab shows the full story: `connection_init`, `connection_ack`, `subscribe`, `next`×6, `complete`.

6. **preAction on Compose steps:** `gql-compose-fields` is only in the DOM when the Compose tab is active. Steps 4 and 5 use `preAction` to navigate to Compose before the spotlight phase.

### Steps (7 steps — shipped; `gql-receive` merged into `gql-frames` 2026-06-15)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `gql-intro` | Connect Panel — Pre-Configured | `WS.LEFT_TAB_CONNECT` | URL + Protocol + Subprotocol pre-filled by setup |
| 2 | `gql-protocol` | What "Protocol: GraphQL-WS" Does | `WS.PROTOCOL_SELECT` | Auto connection_init, op IDs, next/error/complete decoding |
| 3 | `gql-connect` | Connect — Automatic Handshake | `WS.RIGHT_TAB_EVENTS` | Click Connect, auto connection_init sent, connection_ack received |
| 4 | `gql-compose` | GraphQL-WS Compose Fields | `WS.GQL_COMPOSE_FIELDS` | preAction: Compose tab; shows operation name, variables, op ID counter |
| 5 | `gql-subscribe` | Start a Countdown Subscription | `WS.SEND_BTN` | preAction: fill query; action: Send, wait 3.8s for countdown, switch to Events |
| 6 | `gql-frames` | Full Lifecycle in the Events Log | `WS.RIGHT_TAB_EVENTS` | Covers entire lifecycle: handshake + subscribe + next×6 + complete |
| 7 | `gql-disconnect` | Disconnect | `WS.DISCONNECT_BTN` | preAction: Connect tab; ctx.click for visual ripple |

> **Design note:** Originally planned as 8 steps with separate `gql-receive` and `gql-frames`. Merged into one `gql-frames` step (2026-06-15) — two consecutive Events-tab observation steps with identical spotlights provided no extra value.

### New Selectors (add to `selectors.ts` → `WS`)

```ts
GQL_COMPOSE_FIELDS:   '[data-testid="gql-compose-fields"]',
GQL_OPERATION_NAME:   '[data-testid="gql-operation-name"]',
GQL_VARIABLES:        '[data-testid="gql-variables"]',
GQL_OP_ID:            '[data-testid="gql-op-id"]',
SUBPROTOCOLS_INPUT:   '[aria-label="Subprotocols"]',
```

### Concept Diagram (updated — aligned 2026-06-15)

```
Browser                      GraphQL-WS Server (:4100)
  |                                   |
  |  HTTP Upgrade → WebSocket         |
  |  Sec-WebSocket-Protocol:          |
  |  graphql-transport-ws             |
  |---------------------------------->|
  |  101 Switching Protocols          |
  |<----------------------------------|
  |                                   |
  |  {"type":"connection_init"}       |  ← auto-sent by RedfireForge
  |---------------------------------->|
  |  {"type":"connection_ack"}        |
  |<----------------------------------|
  |                                   |
  |  {"type":"subscribe","id":"1",    |  ← Compose → Send
  |   "payload":{"query":             |
  |   "subscription{countdown(5)}"}}  |
  |---------------------------------->|
  |  {"type":"next","id":"1",         |  ← streamed data (×6)
  |   "payload":{"data":              |
  |   {"countdown":5}}}               |
  |<----------------------------------|
  |  (4, 3, 2, 1, 0 follow…)          |
  |  {"type":"complete","id":"1"}     |  ← server-sent end of stream
  |<----------------------------------|
```

### Key Terms

- **`graphql-transport-ws`** — The WebSocket subprotocol ID agreed on connect. Different from the protocol mode selector; this goes in the `Sec-WebSocket-Protocol` request header.
- **`connection_init` / `connection_ack`** — The GraphQL-WS handshake: client announces intent, server acknowledges. Auto-handled by RedfireForge when protocol = GraphQL-WS.
- **`subscribe`** — The operation start frame. Carries the `id` (for tracking), `query`, and optional `variables`.
- **`next`** — A data delivery frame. Each `next` carries one GraphQL result in `payload.data`. Multiple `next` frames stream a subscription.
- **`complete`** — Server-sent end-of-stream marker. After `complete`, no more `next` frames for that operation ID.
- **Operation ID** — A client-assigned string that tags every frame for a given subscription. RedfireForge shows "Op #N" and increments after each send.

### Setup / Cleanup

**Setup:** `gqlSetup` — disconnect if needed, clear log, ensure client mode, fill URL (`ws://localhost:4100/graphql`), fill Subprotocols (`graphql-transport-ws`), select `graphql-ws` protocol.

**Cleanup:** `gqlCleanup` — disconnect if needed, clear log, reset protocol to `raw`, clear subprotocols field, ensure client mode.

---

## Docker Demo Implementation Checklist — ✅ COMPLETED

All items completed when Docker lessons (10–12) were shipped:

- [x] Create `src/features/demo-player/utils/checkEndpoint.ts` + unit test
- [x] Create `src/features/demo-player/components/PrerequisiteGate.tsx` + unit test
- [x] Add `tag?: string` field to `DemoLesson` interface in `types.ts`
- [x] Add `dockerEndpoint` and `dockerCommand` fields to `DemoLesson`
- [x] Add `🐳 Docker` badge styling to lesson card CSS
- [x] `PrerequisiteGate` polls `checkEndpoint()` every 3 seconds and unlocks Start Demo when server is ready
- [ ] Capture fallback screenshots (21 PNGs) — not done; fallback gracefully shows concept slide
- [ ] "Continue with screenshots" toggle — not implemented; PrerequisiteGate blocks until server ready

---

## Lesson 8 Bug Fixes (Post-Ship)

Five bugs were discovered and fixed after initial shipping of Lesson 8 (WS Workflow Builder):

| # | Bug | Fix |
|---|---|---|
| 1 | Concept page bullets rendered as inline text (missing blank line before lists) | Added `\n\n` between section headers and bullet lists in `ws-workflow-builder.ts` |
| 2 | Step 8 timeout — `ctx.fill()` on WS Receive Config timeout input failed | Replaced generic CSS selector with `ctx.fill(WF.WS_RECEIVE_CFG + ' input[type="number"]', '5000')` |
| 3 | Duplicate workflow nodes on repeated lesson runs | Added `window.__wfDeleteByName` call in both `workflowSetup` and `workflowCleanup` |
| 4 | `window.__wfDeleteByName` not exposed at runtime | Added `useEffect` to `App.tsx` to expose the delete helper |
| 5 | `[data-testid="exec-summary"]` missing from production `WorkflowExecSummary.tsx` | Added `data-testid="exec-summary"` to root div of `WorkflowExecSummary.tsx` |

All 5 bugs fixed; 3/3 Quick Test passes in 0.2s verified visually.

---

## Load Test UI Enhancements

Implemented after initial feature-branch work on the WebSocket Demo Hub:

### Format Button (Badge Style)

- **File:** `src/styles/websocket-studio.css` — `.ws-lt-format-btn`
- **Change:** Converted from plain rectangular button to pill badge (border-radius: 999px, font-weight 600, subtle bg color)
- **States:** Idle → `{ } Format` (muted pill); Ok → `✓ Formatted` (green pill with tinted bg); Err → `✗ Invalid JSON` (red pill with tinted bg)

### Message Template Textarea Height

- **File:** `src/styles/websocket-studio.css` — `.ws-lt-textarea`
- **Change:** `min-height` increased from `44px` to `96px` (approx 4 rows worth), giving users more visible space for longer templates

### Latency Distribution Alignment

- **File:** `src/styles/websocket-studio.css` — `.ws-lt-latency-section`
- **Change:** Added `display: flex; flex-direction: column; align-items: flex-start` so "Latency Distribution" title and histogram align to the left edge, vertically consistent with the latency cards above

### Import JSON Button

- **Files:** `src/features/websocket/useWebSocketLoadTest.ts`, `src/features/websocket/WebSocketLoadTest.tsx`
- **Hook change:** Added `loadResult(imported: WsLoadTestResult): void` to `UseWebSocketLoadTestReturn` interface and implementation — sets state to `done` and injects the imported result
- **Component change:** Added `Import JSON` button in the results action bar (alongside Run Again / New Test / Export JSON), hidden `<input type="file" accept=".json">` ref, and `handleImportResult` callback that reads and parses the file then calls `loadTest.loadResult()`
- **Use case:** User exports a load test result, shares it with a colleague, who can import it directly to view the full results dashboard (latency, histogram, sparkline, metrics)

---

## Success Criteria

- [x] 20 lessons shipped in `protocolsDomain.lessons[]` (17 standalone + 3 Docker)
- [x] 157 total steps across 20 lessons (7+9+9+8+9+9+7+11+7+9+8+7+8+8+7+7+7+7+7+6)
- [x] Every lesson plays start-to-finish without errors
- [x] Docker lessons work in live mode (containers up); PrerequisiteGate blocks until ready
- [x] Protocols domain card shows "20 lessons"
- [x] All spotlight highlights point to visible, existing elements (or graceful fallback to Guide mode)
- [x] Step descriptions are understandable by first-time users
- [x] No hardcoded selector strings — all via `selectors.ts`
- [x] 860 unit tests passing for demo-player module (653 ws-lessons.test.ts + 207 other)
- [x] v1 code deleted; `npx tsc --noEmit` — 0 errors
- [x] Lesson 20: workflow seeded automatically via `__wfInsertWorkflow` — no dependency on Lesson 8
- [ ] Fallback screenshot mode (21 PNGs) — not implemented
- [ ] "Continue with screenshots" toggle for offline Docker use — not implemented

---

## Coverage Gap Analysis vs. Test Scenarios

The 8 test-scenario files document ~150 scenarios. The 12 demo lessons cover the core happy paths. The following features are tested by E2E/manual scenarios but **not yet covered by a demo lesson**.

### Gap → Proposed Lesson Mapping

Each gap area is assigned to a proposed Phase 2 lesson (13–20) or deferred:

| Feature Area | Test Scenarios | → Proposed Lesson |
|---|---|---|
| **Mock Server Rules** | WM-10–18 (response rules, reorder, delay, templates, enable/disable) | **✅ L13** Advanced Mock Server |
| **Saved Connection Profiles** | WC-25–29 (save, load, delete, import/export, duplicate, paste JSON) | **✅ L14** Workspace & Profiles |
| **Message Templates** | WC-31–35 (save, load, delete, persist, dropdown) | **✅ L14** Workspace & Profiles |
| **Environment Variables in URLs** | WC-40–43 (`{{wsBaseUrl}}`, env selector, unresolved warning) | **✅ L14** Workspace & Profiles |
| **Auto-Reconnect** | WC-36–39 (settings, triggers, close with code, banner) | **✅ L15** Reliability & Stats |
| **Stats Tab** | WT-32–35 (live metrics, sparkline, per-tab, zeroes on disconnect) | **✅ L15** Reliability & Stats |
| **Connection History detail** | WT-11–15 (URL history, row details, global history, clear) | **✅ L15** Reliability & Stats |
| **Session Recording & Replay** | WT-24–31 (record, stop, save, import, play, pause, exit) | **✅ L16** Session Recording |
| **Tab Drag Reorder** | WT-36–38 (drag feedback, position preserved) | **✅ L17** Power User Tips |
| **Tab Keyboard Nav** | WT-39–42 (arrow, Enter, Delete/F2 rename) | **✅ L17** Power User Tips |
| **Auth + Tab/Console Persistence** | WT-43–45 (auth draft, console settings, split pane) | **✅ L17** Power User Tips |
| **SSE Bookmarks** | SE-11 (star message, filter Bookmarked) | **✅ L18** SSE Advanced |
| **SSE Auto-Reconnect** | SE-12 (reconnect settings, retry banner) | **✅ L18** SSE Advanced |
| **SSE Last-Event-ID** | SE-13 (browser sends `Last-Event-ID` header on reconnect) | **✅ L18** SSE Advanced |
| **SSE Stats Footer** | SE-14 (event count, bytes, elapsed, reconnect count) | **✅ L18** SSE Advanced |
| **TLS / wss:// + TLS panel UI** | WP-16–18, WP-30 (`wss://echo.websocket.org`, rejectUnauthorized) | **✅ L19** Secure WebSocket |
| **Workflow Test Harness & Runner** | WR-14–28 (Harness transport, WS test scenarios, assertions, results page) | **✅ L20** Run WS Workflow in Harness |
| **Auth with Socket.IO / STOMP / GraphQL** | WP-A04–A06 | Deferred — extend L10/11/12 steps |
| **Tauri Native Transport** | WP-19–23 (tokio-tungstenite, Rust commands, desktop TLS) | Deferred — desktop-only track |
| **mTLS** | WP-21 (cert files, rustls) | Deferred — requires cert infrastructure |

---

## Phase 2 Lessons — Lessons 13–20 ✅ All Shipped

> **Status:** ✅ All shipped (2026-06-15). Lessons 13–20 completed on branch `feature/websocket-demo-hub`.
> **Phase 1 pre-requisite:** All 12 Phase 1 lessons shipped first.

### Phase 2 Lesson Overview

| # | Lesson | Features | Docker? | Steps | Priority |
|---|---|---|---|---|---|
| **13** | **Advanced Mock Server** | Rules, reorder, delay, template vars, enable/disable, preview | No | 8 | P1 ✅ |
| **14** | **Workspace: Profiles, Templates & Env Vars** | Saved profiles, message templates, env var interpolation | No | 8 | P2 ✅ |
| **15** | **Reliability: Auto-Reconnect & Stats** | Auto-reconnect settings, stats tab (sparkline), close-with-code, URL history | No | 7 | P3 ✅ |
| **16** | **Session Recording & Replay** | Record session, save file, import, replay with timing, exit | No | 7 | P4 ✅ |
| **17** | **Power User: Tabs & Keyboard** | Drag reorder, keyboard nav (arrow/Delete/F2), auth per-tab, split pane | No | 7 | P5 ✅ |
| **18** | **SSE Advanced Features** | Bookmarks, auto-reconnect, Last-Event-ID, stats footer | No | 7 | P6 ✅ |
| **19** | **Secure WebSocket (wss:// & TLS)** | TLS panel, `rejectUnauthorized` toggle, proxy-only banner, public wss:// echo | No | 7 | P7 ✅ |
| **20** | **Run WS Workflow in Harness** | Workflow Runner: pick, variables, run, completion banner, results | No | 6 | P8 ✅ |

**Deferred (no lesson slot yet):**
- Auth with protocols (WP-A04–A06) → extend L10/11/12 with a new step each
- Tauri Native Transport (WP-19–23) → separate desktop-only demo track
- mTLS (WP-21) → infrastructure-gated; add to L19 when cert tooling exists

> **All Phase 2 lessons shipped.** The deferred items above remain out-of-scope for this branch.

---

### Lesson 13: Advanced Mock Server (P1 — Phase 2)

**Why:** Lesson 1 only shows echo + broadcast. Rule-based routing is the real power of mock mode — matching patterns, prioritising responses, adding delays, using template variables.

**File:** `src/features/demo-player/lessons/protocols/ws-mock-server-advanced.ts`
**Export:** `wsMockServerAdvancedLesson` | **initialTab:** `websocket-studio` (mock mode)
**Source:** WM-10–18

**Proposed steps (~8):**

| # | Step ID | Title | Highlights |
|---|---|---|---|
| 1 | `mock-adv-intro` | Rules Engine Overview | Rules panel intro |
| 2 | `mock-adv-add-rule` | Add a Response Rule | Pattern + response fields |
| 3 | `mock-adv-priority` | Rule Priority & Reorder | Drag rule card to reorder |
| 4 | `mock-adv-delay` | Per-Rule Delay | Delay field — simulate latency |
| 5 | `mock-adv-template` | Template Variables in Responses | `{{timestamp}}`, `{{uuid}}` |
| 6 | `mock-adv-toggle` | Enable / Disable a Rule | Toggle without deleting |
| 7 | `mock-adv-preview` | Rule Test Preview | Preview response before connecting |
| 8 | `mock-adv-e2e` | End-to-End: Rule Triggers Live | Connect + send matching message |

---

### Lesson 14: Workspace — Profiles, Templates & Env Vars (P2 — Phase 2) ✅ Shipped

**Why:** Power users save connections for different environments. Profiles + templates + env vars are the "remember my work" triad that makes RedfireForge a daily driver, not just a demo tool.

**File:** `src/features/demo-player/lessons/protocols/ws-workspace.ts`
**Export:** `wsWorkspaceLesson` | **initialTab:** `websocket-studio`
**Source:** WC-25–29, WC-31–35, WC-40–43

**Design notes:**
1. **"Saved" is a top-level studio mode** (`mode-saved`), not a left sidebar tab. The lesson starts in Client mode and uses "Save as Profile" in the Connect panel as the entry point — this is the natural discovery path for users.
2. **Profile save flow:** Client mode → Connect tab → fill URL → "Save as Profile" → profile editor modal opens pre-filled → add name → save. The profile then appears in Saved mode.
3. **Profile load flow:** Saved mode → select profile card → "Load & Connect" button → switches to Client mode with draft applied.
4. **Templates exist in the Compose panel** — a dropdown trigger "Templates ▾" that opens a save/load dropdown. Requires connected state to send, but saving a template works anytime.
5. **Env vars** use `{{varName}}` in the URL field. Built-in variables (`{{wsBaseUrl}}`, `{{host}}`, `{{envName}}`) auto-resolve from the selected environment. The env-preview row shows resolved URL below the input; unresolved variables trigger a warning badge.
6. **No Docker required** — all features work with the built-in mock server.
7. **preAction on compose/template steps**: The compose panel UI (`template-trigger`, `template-save-name`) is only in the DOM when the Compose left tab is active. Steps that spotlight these elements use `preAction` to navigate to Compose first.

### Steps (8 steps)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `ws-profile-intro` | The Saved Mode | `WS.MODE_SAVED` | preAction: click Saved mode; show the profiles panel (may be empty or populated) |
| 2 | `ws-profile-save` | Save a Connection Profile | `WS.SAVE_AS_PROFILE_BTN` | preAction: switch to Client + Connect tab + fill URL; action: click Save as Profile → fill name in modal → save |
| 3 | `ws-profile-load` | Load a Saved Profile | `WS.SAVED_CONNECTIONS` | preAction: switch to Saved mode; action: click first profile card's "Load & Connect" → switches to Client mode with draft applied |
| 4 | `ws-template-intro` | Message Templates | `WS.TEMPLATE_TRIGGER` | preAction: ensure Compose tab; spotlight the Templates dropdown |
| 5 | `ws-template-save` | Save a Template | `WS.TEMPLATE_SAVE_BTN` | preAction: Compose tab + fill message; action: type template name → save |
| 6 | `ws-template-load` | Load a Template | `WS.TEMPLATE_TRIGGER` | action: open dropdown → click saved template → text appears in compose |
| 7 | `ws-env-intro` | Environment Variables in URLs | `WS.ENV_PREVIEW` | preAction: Client + Connect tab + fill `{{wsBaseUrl}}/ws`; spotlight the resolved-URL preview row |
| 8 | `ws-env-warn` | Unresolved Variable Warning | `WS.ENV_UNRESOLVED_WARN` | preAction: fill URL with `{{unknownVar}}/ws`; spotlight the warning badge |

### Selectors used (added to `src/shared/selectors.ts`)

```
MODE_SAVED:           '[data-testid="mode-saved"]'
SAVED_CONNECTIONS:    '[data-testid="saved-connections"]'
SAVED_EMPTY:          '[data-testid="saved-empty"]'
NEW_PROFILE_BTN:      '[data-testid="new-profile-btn"]'
SAVE_AS_PROFILE_BTN:  '[data-testid="save-as-profile-btn"]'
PROFILE_EDITOR_MODAL: '[data-testid="profile-editor-modal"]'
PROFILE_NAME_INPUT:   '[data-testid="profile-name-input"]'
PROFILE_URL_INPUT:    '[data-testid="profile-url-input"]'
PROFILE_SAVE_BTN:     '[data-testid="profile-save-btn"]'
EXPORT_BTN:           '[data-testid="export-btn"]'
IMPORT_BTN:           '[data-testid="import-btn"]'
TEMPLATE_TRIGGER:     '[data-testid="template-trigger"]'
TEMPLATE_SAVE_NAME:   '[data-testid="template-save-name"]'
TEMPLATE_SAVE_BTN:    '[data-testid="template-save-btn"]'
ENV_PREVIEW:          '[data-testid="env-preview"]'
ENV_UNRESOLVED_WARN:  '[data-testid="env-unresolved-warning"]'
```

---

### Lesson 15: Reliability — Auto-Reconnect & Stats (P3 — Phase 2) ✅ Shipped

**Why:** Production WebSockets drop. Auto-reconnect is essential; the Stats tab shows health at a glance. Close-with-code enables controlled disconnects for testing error handling.

**File:** `src/features/demo-player/lessons/protocols/ws-reliability.ts`
**Export:** `wsReliabilityLesson` | **initialTab:** `websocket-studio`
**Source:** WC-36–39, WT-32–35, WT-11–15

**Design notes:**
1. **Requires mock server** — the lesson uses the built-in mock echo server for live connection demos.
2. **Natural flow** — connect first, show stats while connected, show reconnect settings, demonstrate close-with-code, observe stats reset.
3. **Auto-reconnect can't be fully demoed** — stopping the mock server while connected would trigger reconnect banners, but this disrupts the lesson flow. Instead, the lesson explains the settings and highlights the reconnect UI without forcing a live reconnect. The close-with-code step demonstrates controlled disconnect (code 1001 = Going Away).
4. **Stats panel** shows msg/s (with sparkline), bytes in/out, frame types. Latency and uptime are on the Connect panel status bar.
5. **Close-with-code** uses the disconnect caret dropdown with presets (1000 Normal, 1001 Going Away, etc.).

### Steps (7 steps)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `rel-connect` | Connect to the Mock Server | `WS.RIGHT_TAB_EVENTS` | preAction: Client + Connect tab + fill URL; action: Connect → switch to Events |
| 2 | `rel-stats-tab` | The Stats Tab | `WS.RIGHT_TAB_STATS` | action: switch to Stats tab; spotlight live metric cards |
| 3 | `rel-stats-live` | Live Metrics & Sparkline | `WS.STATS_MSG_RATE` | action: send burst of 5 messages to populate sparkline; switch to Stats |
| 4 | `rel-reconnect-settings` | Auto-Reconnect Settings | `WS.RECONNECT_SETTINGS` | preAction: Connect tab; explain max attempts, interval, backoff |
| 5 | `rel-close-code` | Close with Code / Reason | `WS.DISCONNECT_CARET` | preAction: Connect tab; action: open caret dropdown → fill code 1001 + reason → close |
| 6 | `rel-stats-zero` | Stats After Disconnect | `WS.RIGHT_TAB_STATS` | action: switch to Stats; rates dropped to 0, sparkline flat |
| 7 | `rel-history` | URL History | `WS.URL_HISTORY_TRIGGER` | preAction: Connect tab; action: open URL history dropdown showing recent connection |

### Selectors used (added to `src/shared/selectors.ts`)

```
RECONNECT_SETTINGS:   '[data-testid="reconnect-settings"]'
RECONNECT_TOGGLE:     '[data-testid="auto-reconnect-toggle"]'
RECONNECT_MAX:        '[data-testid="max-reconnect-attempts"]'
RECONNECT_INTERVAL:   '[data-testid="reconnect-interval-ms"]'
RECONNECT_BACKOFF:    '[data-testid="backoff-multiplier"]'
RECONNECT_BANNER:     '[data-testid="reconnect-banner"]'
RECONNECT_CANCEL:     '[data-testid="cancel-reconnect-btn"]'
RECONNECT_FAILED:     '[data-testid="reconnect-failed"]'
RETRY_NOW_BTN:        '[data-testid="retry-now-btn"]'
DISCONNECT_CARET:     '[data-testid="disconnect-caret"]'
CLOSE_CODE_DROPDOWN:  '[data-testid="close-code-dropdown"]'
CLOSE_CODE_INPUT:     '[data-testid="close-code-input"]'
CLOSE_REASON_INPUT:   '[data-testid="close-reason-input"]'
CLOSE_WITH_CODE_BTN:  '[data-testid="close-with-code-btn"]'
RIGHT_TAB_STATS:      '[data-testid="right-tab-stats"]'
STATS_PANE:           '[data-testid="ws-studio-stats-pane"]'
STATS_PANEL:          '[data-testid="stats-panel"]'
STATS_MSG_RATE:       '[data-testid="stats-msg-rate"]'
STATS_BYTES_IN:       '[data-testid="stats-bytes-in"]'
STATS_BYTES_OUT:      '[data-testid="stats-bytes-out"]'
STATS_FRAMES:         '[data-testid="stats-frames"]'
STATUS_BAR:           '[data-testid="status-bar"]'
STATUS_BADGE:         '[data-testid="status-badge"]'
LATENCY:              '[data-testid="latency"]'
UPTIME:               '[data-testid="uptime"]'
URL_HISTORY_TRIGGER:  '[data-testid="url-history-trigger"]'
URL_HISTORY_DROPDOWN: '[data-testid="url-history-dropdown"]'
```

---

### Lesson 16: Session Recording & Replay (P4 — Phase 2) ✅ Shipped

**Why:** Record a live session, share the file with a teammate, and replay it at the original pace. Zero setup required — anyone can replay without a running server.

**File:** `src/features/demo-player/lessons/protocols/ws-session-recording.ts`
**Export:** `wsSessionRecordingLesson` | **initialTab:** `websocket-studio`
**Source:** WT-24–31

**Design notes:**
1. **Recording controls live in the Events toolbar** (second action row), not in the tab bar or Connect panel. The `● Rec`, `■ Stop`, `Import`, and `▶ Play` buttons appear conditionally based on recording state.
2. **File format is JSON** (`ws-recording-v1`), not `.wsr`. Exported filenames are `ws-recording-<ISO-timestamp>.json`.
3. **Import triggers file picker** which can't be automated in a demo. The lesson uses a synthetic File blob injected via DataTransfer to programmatically load a pre-built recording.
4. **Replay bar** appears below the toolbar with play/pause toggle, speed selector (1×/2×/5×/10×/Max), progress counter, and Exit button. Compose panel is hidden during replay.
5. **Requires connected state** for recording (messages are captured from live traffic). Replay does not require a connection.

### Steps (7 steps)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `rec-intro` | The Rec Button | `WS.REC_START_BTN` | preAction: connect to mock; switch to Events; spotlight Rec button |
| 2 | `rec-start` | Start Recording | `WS.REC_STOP_BTN` | action: click Rec → Stop button appears (red pulse) |
| 3 | `rec-capture` | Send During Recording | `WS.SEND_BTN` | preAction: Compose tab; action: send 3 messages; switch to Events |
| 4 | `rec-stop` | Stop & Save | `WS.REC_START_BTN` | action: click Stop → file downloads; Rec/Import reappear |
| 5 | `rec-import` | Import a Recording | `WS.REPLAY_START_BTN` | action: inject synthetic recording via hidden file input; ▶ Play appears |
| 6 | `rec-play` | Replay at Original Pace | `WS.REPLAY_BAR` | action: click Play → messages replay with timing; replay bar shows |
| 7 | `rec-exit` | Exit Replay | `WS.REPLAY_EXIT` | action: click Exit → messages cleared; Rec/Import return |

### Selectors used (added to `src/shared/selectors.ts`)

```
REC_START_BTN:       '[data-testid="start-recording-btn"]'
REC_STOP_BTN:        '[data-testid="stop-recording-btn"]'
REC_IMPORT_BTN:      '[data-testid="import-recording-btn"]'
REC_FILE_INPUT:      '[data-testid="recording-file-input"]'
REC_IMPORT_ERROR:    '[data-testid="import-error"]'
REPLAY_START_BTN:    '[data-testid="start-replay-btn"]'
REPLAY_BAR:          '[data-testid="replay-bar"]'
REPLAY_PLAYPAUSE:    '[data-testid="replay-playpause-btn"]'
REPLAY_SPEED:        '[data-testid="replay-speed-select"]'
REPLAY_PROGRESS:     '[data-testid="replay-progress"]'
REPLAY_EXIT:         '[data-testid="replay-exit-btn"]'
```

---

### Lesson 17: Power User — Tabs & Keyboard (P5 — Phase 2) ✅ Shipped

**Why:** Experienced users never reach for the mouse if they can help it. Tab drag-reorder, keyboard shortcuts, and workspace persistence turn RedfireForge into a keyboard-first tool.

**File:** `src/features/demo-player/lessons/protocols/ws-power-user.ts`
**Export:** `wsPowerUserLesson` | **initialTab:** `websocket-studio`
**Source:** WT-36–45

**Design notes:**
1. **Lesson 4 (ws-tabs) covers basics** (add, switch, rename, history, close). This lesson goes deeper: keyboard shortcuts, drag reorder, and persistence.
2. **Drag reorder uses native HTML5 DnD** — cannot be reliably automated via demo actions. The step shows the tabs and explains drag capability.
3. **Keyboard dispatch**: Arrow keys, F2, Delete are dispatched directly via `KeyboardEvent` on focused tab elements.
4. **Auth persistence** is per-tab (each `WsConnectionTabContent` owns its own draft). Split pane width is global but persists across navigation.
5. **Requires 3 tabs**: Setup creates 3 tabs so keyboard nav and reorder have visible targets.

### Steps (7 steps)

| # | Step ID | Title | Highlight | Notes |
|---|---|---|---|---|
| 1 | `pu-setup-tabs` | Three Tabs Ready | `WS.CONN_TAB_BAR` | preAction: create 3 tabs, rename them |
| 2 | `pu-drag-reorder` | Drag to Reorder | `WS.CONN_TAB_BAR` | explain drag; show opacity + inset feedback |
| 3 | `pu-kbd-arrow` | Arrow Key Navigation | `WS.CONN_TAB_BAR` | action: dispatch ArrowRight to focus next tab |
| 4 | `pu-kbd-rename` | F2 to Rename | `WS.CONN_TAB_RENAME` | action: dispatch F2, type name, commit |
| 5 | `pu-kbd-delete` | Delete to Close | `WS.CONN_TAB_BAR` | action: dispatch Delete on focused tab |
| 6 | `pu-auth-persist` | Auth Persists per Tab | `WS.LEFT_TAB_AUTH` | action: set Bearer token, switch tabs, switch back |
| 7 | `pu-pane-persist` | Shell Tabs Persist per Tab | `WS.CONN_TAB_BAR` | action: switch shell tabs in tab 1 vs tab 2, verify |

### Selectors used (existing in `src/shared/selectors.ts`)

```
CONN_TAB_BAR, CONN_TAB_ADD, CONN_TAB_FIRST, CONN_TAB_LAST,
CONN_TAB_CLOSE, CONN_TAB_RENAME, CONN_TAB_HISTORY,
LEFT_TAB_AUTH, LEFT_TAB_CONNECT, RIGHT_TAB_EVENTS, RIGHT_TAB_CONSOLE
```

---

### Lesson 18: SSE Advanced Features (P6 — Phase 2) ✅ Shipped

**Why:** Lesson 8 (SSE Studio) covers the happy path. Bookmarks, auto-reconnect, Last-Event-ID, and the stats footer are the features that matter in production SSE integrations.

**File:** `src/features/demo-player/lessons/protocols/sse-studio-advanced.ts`
**Export:** `sseStudioAdvancedLesson` | **initialTab:** `sse-studio`
**Source:** SE-11–14

#### Design notes

- **Builds on Lesson 8** — Lesson 8 covers connect, event stream, event detail, search, console, disconnect. This lesson covers the remaining advanced features.
- **SSE mock endpoint** — Uses `http://localhost:3001/api/sse-test` which sends periodic events (message/update/status types rotating, each with incremental `id` for Last-Event-ID).
- **Bookmarks are in-memory only** — cleared when `clearEvents()` is called. The star button uses `aria-label` not `data-testid`, so we click via `.sse-bookmark-btn` on the first event row.
- **Stats footer shows**: Events, Showing, Last-Event-ID, Uptime, Types breakdown. Does NOT show total bytes or reconnect count (those metrics are per-row or in console only).
- **Auto-reconnect** — toggle checkbox + read-only info (retry interval, max retries). Not editable — values come from config defaults and server `retry:` field.
- **Last-Event-ID** — visible in status strip, stats footer, and event detail panel. On reconnect, sent as HTTP header (visible in Console handshake entry).
- **No Docker required** — uses the dev server's built-in `/api/sse-test` endpoint.

#### Finalized steps (7)

| # | Step ID | Title | Highlights | Notes |
|---|---|---|---|---|
| 1 | `sse-adv-intro` | Pick Up Where Lesson 8 Left Off | `SSE.STUDIO` | preAction: connect + wait for events; action: none (orientation) |
| 2 | `sse-adv-bookmark` | Bookmark an Event | `SSE.EVENT_ROW` | action: click ★ on first event row via `.sse-bookmark-btn` |
| 3 | `sse-adv-bookmark-filter` | Filter to Bookmarked Events | `SSE.BOOKMARK_FILTER` | action: click bookmark filter to show only starred; preAction clears after showing |
| 4 | `sse-adv-stats` | Stats Footer | `SSE.STATUS_BAR` | action: none — highlight footer showing Events, Showing, Uptime, Types |
| 5 | `sse-adv-reconnect` | Auto-Reconnect | `SSE.LEFT_TAB_CONNECT` | preAction: switch to Connect tab; action: toggle auto-reconnect checkbox |
| 6 | `sse-adv-last-event-id` | Last-Event-ID | `SSE.STATE_LABEL` | preAction: switch to Events tab; action: highlight status strip showing Last-Event-ID |
| 7 | `sse-adv-clear` | Clear & Export | `SSE.CLEAR_BTN` | action: click Export, then click Clear |

### Selectors used (existing in `src/shared/selectors.ts`)

```
STUDIO, URL_INPUT, CONNECT_BTN, STATE_LABEL,
LEFT_TAB_CONNECT, LEFT_TAB_AUTH,
RIGHT_TAB_EVENTS, RIGHT_TAB_CONSOLE,
MESSAGE_LOG, EVENT_ROW, EVENT_DETAIL,
SEARCH_INPUT, TYPE_FILTER, BOOKMARK_FILTER,
EXPORT_BTN, CLEAR_BTN, STATUS_BAR
```

---

### Lesson 19: Secure WebSocket — wss:// & TLS (P7 — Phase 2) ✅ Shipped

**Why:** Real-world WebSocket APIs use `wss://`. Showing the TLS panel, the `rejectUnauthorized` toggle, and a live public echo over `wss://` demonstrates that RedfireForge works in secure production contexts.

**File:** `src/features/demo-player/lessons/protocols/ws-tls.ts`
**Export:** `wsTlsLesson` | **initialTab:** `websocket-studio`
**Source:** WP-16–18, WP-30

#### Design notes

- **TLS panel is on the Connect tab**, not the Auth tab. It only appears when the URL starts with `wss://`.
- **No transport dropdown** — transport is chosen automatically: Direct (browser, no headers/overrides), Proxy (browser with headers or TLS overrides), or Native (Tauri always).
- **Proxy notice banner** (`tls-proxy-notice`) is shown inside the TLS panel only when: expanded + browser + no TLS overrides yet. It disappears once skip-cert is toggled or a CA is pasted — because that forces proxy mode.
- **Mock server only supports ws://** — lesson uses `wss://echo.websocket.org` for live demo. This is network-dependent.
- **No Docker required** — self-signed cert demo is explain-only (toggle + describe). Docker `wss://localhost:8766` stack exists for manual testing but not in this lesson.
- **Step order matters**: proxy banner must be shown BEFORE toggling skip-cert, since the banner disappears after.
- Added TLS selectors to `selectors.ts` for stable automation.

#### Finalized steps (7)

| # | Step ID | Title | Highlights | Notes |
|---|---|---|---|---|
| 1 | `tls-intro` | wss:// vs ws:// | `WS.URL_INPUT` | preAction: set `wss://echo.websocket.org` to trigger TLS panel |
| 2 | `tls-panel` | TLS Configuration Panel | `WS.TLS_TOGGLE` | action: expand TLS panel; shows proxy notice banner |
| 3 | `tls-connect` | Connect Over TLS | `WS.CONNECT_BTN` | action: connect to public echo; verify connected |
| 4 | `tls-send` | Send & Receive Over TLS | `WS.SEND_BTN` | action: send message, see echo response |
| 5 | `tls-skip-cert` | Skip Certificate Validation | `WS.TLS_SKIP_CERT` | preAction: disconnect; action: toggle skip-cert checkbox |
| 6 | `tls-certs` | CA Certificate & mTLS | `WS.TLS_BODY` | highlight PEM textareas (CA, client cert, client key) |
| 7 | `tls-transport` | Transport Modes & Desktop TLS | `WS.STATUS_BAR` | concept step: explain Direct/Proxy/Native differences |

### Selectors added to `src/shared/selectors.ts`

```
TLS_PANEL, TLS_TOGGLE, TLS_BODY, TLS_INDICATOR,
TLS_PROXY_NOTICE, TLS_SKIP_CERT,
TLS_CA_CERT, TLS_CLIENT_CERT, TLS_CLIENT_KEY,
TRANSPORT_BADGE
```

---

### Lesson 20: Run WS Workflow in Harness (P8 — Phase 2) ✅ Shipped

**Why:** Lesson 8 (Workflow Builder) builds the WS Echo Demo workflow in the Designer. This lesson shows how to run that same workflow in the Test Harness Workflow Runner — where runs are tracked, variables can be overridden before each run, and results are persisted to the Results Dashboard.

**File:** `src/features/demo-player/lessons/protocols/ws-test-runner.ts`
**Export:** `wsTestRunnerLesson` | **`initialTab` intentionally NOT set** — see Design notes
**Source:** WR-14–28

#### Design notes

- **Hands-on demo, not a tour.** The original plan described a 7-step guided tour through all 5 Harness sub-tabs. The actual implementation is a 6-step hands-on demo: the lesson seeds the "WS Echo Demo" workflow, the user picks it, inspects variables, runs it, reads the completion banner, and navigates to Results.
- **`initialTab` intentionally omitted.** The `useDemoShortcuts` auto-exit hook fires when `activeTab !== initialTab`. This lesson navigates from `workflow-runner` → `results` on the final step. If `initialTab: 'workflow-runner'` were set, arriving on the results tab would trigger auto-exit. Instead, setup navigates to the Workflow Runner tab directly.
- **Workflow seeding.** Lesson 20 requires "WS Echo Demo" to exist in the workflow list. Rather than forcing users to complete Lesson 8 first, setup automatically seeds the workflow via `__wfInsertWorkflow` (a window bridge exposed by `useDemoWorkflowBridge`). Setup always calls `__wfDeleteByName('WS Echo Demo')` first to avoid duplicates, then inserts a fresh copy via `createWsEchoDemoWorkflow()`.
- **`createWsEchoDemoWorkflow()` factory** — creates a minimal 4-node workflow: `Start → WsConnect ({{wsUrl}}) → WsSend → WsReceive`. `schemaVersion: 6`, `connectionId: 'ws1'`, `wsUrl: 'ws://localhost:9876'` (pre-set to mock server).
- **`useDemoWorkflowBridge` extension.** To support `__wfInsertWorkflow`, the hook was extended with an optional `insert?: (wf: Workflow) => void` parameter. `App.tsx` now passes `wfHook.insert` as the third argument. The bridge exposes it on `window.__wfInsertWorkflow` and cleans it up on unmount. See the bridge section in the implementation notes below.
- **Mock server required.** Setup starts the mock server at `ws://localhost:9876` before navigating to the Workflow Runner. Cleanup stops it.
- **No live navigation to Harness activity bar icon.** The lesson navigates within the app using `ctx.navigateToTab` (tab identifiers), not by clicking the Harness icon in the sidebar activity bar.

#### Finalized steps (6)

| # | Step ID | Title | Highlights | Notes |
|---|---|---|---|---|
| 1 | `wfhr-open` | The Workflow Runner Tab | `.sub-nav-tab[data-tab="workflow-runner"]` | (orientation — setup already navigated here) |
| 2 | `wfhr-pick` | Select WS Echo Demo | `.workflow-run-picker` | action: select "WS Echo Demo" from picker; note: workflow was seeded by setup automatically |
| 3 | `wfhr-variables` | Initial Variables | `.variables-editor` | (observation — wsUrl = ws://localhost:9876 pre-set) |
| 4 | `wfhr-run` | ▶ Run Workflow | `.run-workflow-btn` | action: ctx.click → workflow executes against mock server; verify completion banner |
| 5 | `wfhr-complete` | Completion Banner | `.completion-section .btn-primary` | action: ctx.click "View Full Results →" → navigates to results tab |
| 6 | `wfhr-results` | Results Dashboard | `.results-run-filter-tabs` | (observation — "Workflow Runs" tab filtered, ⚡ WS Echo Demo entry visible) |

#### `createWsEchoDemoWorkflow()` factory (implementation detail)

```typescript
function createWsEchoDemoWorkflow(): Record<string, unknown> {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: 'WS Echo Demo',
    schemaVersion: 6,
    variables: { wsUrl: 'ws://localhost:9876' },
    services: [], hostProfiles: [], authProfiles: [],
    nodes: [
      { id: startId,   type: 'start',     position: { x: 250, y: 50  }, data: { label: 'Start', inputVariables: {} } },
      { id: connectId, type: 'wsConnect', position: { x: 250, y: 160 }, data: { label: 'WS Connect', url: '{{wsUrl}}', connectionId: 'ws1', ... } },
      { id: sendId,    type: 'wsSend',    position: { x: 250, y: 270 }, data: { label: 'WS Send', connectionId: 'ws1', message: '...', ... } },
      { id: receiveId, type: 'wsReceive', position: { x: 250, y: 380 }, data: { label: 'WS Receive', connectionId: 'ws1', timeoutMs: 5000, ... } },
    ],
    edges: [ /* start→connect, connect→send, send→receive */ ],
    createdAt: now, updatedAt: now,
  };
}
```

#### `useDemoWorkflowBridge` changes

The hook `src/app/hooks/useDemoWorkflowBridge.ts` was extended to support workflow seeding:

```typescript
export function useDemoWorkflowBridge(
  workflows: Array<{ id: string; name: string }>,
  remove: (id: string) => void,
  insert?: (wf: Workflow) => void,   // ← NEW optional parameter
): void {
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wfDeleteByName = (name: string) => {
      const wf = workflows.find((w) => w.name === name);
      if (wf) remove(wf.id);
    };
    if (insert) {
      (window as unknown as Record<string, unknown>).__wfInsertWorkflow = insert;  // ← NEW
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
      delete (window as unknown as Record<string, unknown>).__wfInsertWorkflow;    // ← NEW cleanup
    };
  }, [workflows, remove, insert]);
}
```

`App.tsx` call site: `useDemoWorkflowBridge(wfHook.workflows, wfHook.remove, wfHook.insert)` (third arg added).

#### Setup / Cleanup

**Setup (`harnessRunSetup`):**
1. Call `__wfDeleteByName('WS Echo Demo')` if bridge available (idempotent — no-op if doesn't exist)
2. Call `__wfInsertWorkflow(createWsEchoDemoWorkflow())` if bridge available
3. `POST /api/ws/mock/start` to `localhost:3001` (start mock server)
4. `ctx.navigateToTab('workflow-runner')` (navigate to Workflow Runner tab)

**Cleanup (`harnessRunCleanup`):**
1. `POST /api/ws/mock/stop` to `localhost:3001` (stop mock server)
2. `ctx.navigateToTab('workflow-runner')` (return to Workflow Runner tab)

---

---

## Lesson 21: Local TLS Echo Server (Docker) — Phase 3 (P9)

**Why:** The Lesson 19 TLS demo uses `wss://echo.websocket.org` (external, unreliable). This lesson replaces the external dependency with a **real local Docker stack** and extends TLS education to three phases: skip-cert validation, CA certificate chain validation, and Mutual TLS (mTLS) with client certificates.

**File:** `src/features/demo-player/lessons/protocols/ws-tls-local.ts`
**Export:** `wsTlsLocalLesson`
**Tag:** 🐳 Docker | **Est. time:** 8 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Three-Phase TLS Education

| Phase | Step IDs | Approach | Server Port | Use Case |
|-------|----------|----------|-------------|----------|
| 1 | 1–3 | Skip certificate validation (`rejectUnauthorized: false`) | 8766 | Local dev, quick iteration |
| 2 | 4–5 | CA Certificate (paste root CA PEM, full chain validation) | 8766 | Staging / internal PKI |
| 3 | 6–8 | Mutual TLS (client cert + key, nginx `ssl_verify_client on`) | 8768 | High-security APIs, client identity |

### Docker Stack

| Service | File | Port | Description |
|---------|------|------|-------------|
| `ws-echo-tls` (jmalloc/echo-server) | `docker-compose.tls.yml` | 8767 (health) | Plain WS echo, Phase 1+2 backend |
| `ws-tls-proxy` (nginx) | `docker-compose.tls.yml` | 8766 (wss) | TLS termination with self-signed cert |
| `ws-echo-mtls` (jmalloc/echo-server) | `docker-compose.mtls.yml` | 8769 (health) | Plain WS echo, Phase 3 backend |
| `ws-mtls-proxy` (nginx) | `docker-compose.mtls.yml` | 8768 (wss+mTLS) | TLS+client-cert verification |

### Certificate Infrastructure

| Script | Output | Purpose |
|--------|--------|---------|
| `./generate-cert.sh` | `certs/ca.crt`, `certs/ca.key`, `certs/server.crt`, `certs/server.key` | Root CA + server leaf cert |
| `./generate-client-cert.sh` | `certs/client.crt`, `certs/client.key` | Client leaf cert (signed by CA, `clientAuth` EKU) |

The lesson **embeds the cert content** directly in `ws-tls-local.ts` so the demo auto-pastes them into the TLS panel without manual file copy.

### Steps (8 steps)

| # | Step ID | Title | Phase | Highlight |
|---|---------|-------|-------|-----------|
| 1 | `local-tls-url` | Phase 1 — The Local TLS Server | 1 | TLS panel (appears on wss:// URL) |
| 2 | `local-tls-skip-cert` | Skip Certificate Validation | 1 | Skip-cert checkbox → Proxy badge |
| 3 | `local-tls-connect` | Connect & Echo — Phase 1 Confirmed | 1 | Connect button + echo send |
| 4 | `local-tls-ca-intro` | Phase 2 — CA Certificate Validation | 2 | TLS body (CA cert textarea) |
| 5 | `local-tls-ca-connect` | Connect with CA Certificate | 2 | Connect button |
| 6 | `local-tls-mtls-intro` | Phase 3 — Mutual TLS (mTLS) | 3 | URL input (switch to 8768) |
| 7 | `local-tls-mtls-creds` | Client Certificate & Private Key | 3 | TLS body (client cert + key fields) |
| 8 | `local-tls-mtls-connect` | Connect via mTLS — Phase 3 Confirmed | 3 | Connect button |

### Setup / Cleanup

**Setup (`localTlsSetup`):**
1. Switch to Client mode
2. Disconnect and close extra tabs
3. Clear events
4. `resetAuth(ctx)` — auth type → "none" (prevents proxy trigger)
5. `clearCustomHeaders(ctx)` — remove all header rows (prevents proxy trigger)
6. Fill `wss://localhost:8766`, expand TLS panel, reset skip-cert, clear cert fields
7. **Clear URL** — so Step 1 shows the "wss:// → TLS panel appears" moment visually

**Cleanup (`localTlsCleanup`):**
1. Disconnect and clear events
2. Restore URL → expand TLS → reset state → clear URL

### PrerequisiteGate

- `dockerEndpoint: 'http://localhost:8767'` — health probe for Phase 1+2 stack
- `dockerCommand`: `cd docker/websocket && ./generate-cert.sh && ./generate-client-cert.sh && docker compose -f docker-compose.tls.yml -f docker-compose.mtls.yml up -d`
  - `generate-cert.sh` and `generate-client-cert.sh` are **idempotent** — they skip if certs already exist, so the full command is safe to run repeatedly.
- The gate auto-polls and unlocks when Docker is ready. Only Lesson 21 requires BOTH TLS and mTLS stacks.

### E2E Tests

**File:** `e2e/ws-tls-local-demo.spec.ts` (9 tests, 1 skipped when Docker UP)

| # | Test | Docker Required |
|---|------|-----------------|
| 1 | Lesson visible with 🐳 tag | No |
| 2 | PrerequisiteGate disables Start Demo (Docker DOWN) | No (skipped when UP) |
| 3 | `localTlsSetup` clears skip-cert and CA cert | TLS (8767) |
| 4 | `localTlsSetup` clears custom headers | TLS (8767) |
| 5 | skip-cert → Proxy transport → Connected 8766 | TLS (8767) |
| 6 | Echo round-trip over skip-cert TLS | TLS (8767) |
| 7 | CA cert → Proxy → Connected 8766 (no skip-cert) | TLS (8767) |
| 8 | Client cert+key → Proxy → Connected 8768 (mTLS) | TLS (8767) + mTLS (8769) |
| 9 | mTLS server rejects connection without client cert | mTLS (8769) |

**Verified 2026-06-16:** 8/8 pass (1 skipped), 0 flakes, Docker stacks confirmed:
- TLS: `Verify return code: 0 (ok)` via openssl
- mTLS: `Peer signature type: rsa_pss_rsae_sha256, Verify return code: 0 (ok)` via openssl

**Live Playwright Visual Validation 2026-06-16:** All 8 steps validated end-to-end through Playwright MCP:
- Step 1 (Phase 1 intro): URL `wss://localhost:8766` filled, TLS panel appeared ✓
- Step 2 (Skip cert): checkbox checked, Proxy transport badge confirmed ✓
- Step 3 (Phase 1 connect): Connected via skip-cert, echo `{ "phase": 1, "method": "skip-cert" }` round-trip ✓
- Step 4 (Phase 2 intro): Disconnected, CA cert pasted into textarea ✓
- Step 5 (Phase 2 connect): Connected via CA chain, echo `{ "phase": 2, "method": "ca-cert", "msg": "Chain validated!" }` ✓
- Step 6 (Phase 3 intro): URL switched to `wss://localhost:8768`, CA cert re-pasted ✓
- Step 7 (Client creds): Client cert + key pasted into mTLS fields ✓
- Step 8 (Phase 3 connect): Connected to mTLS server, echo `{ "phase": 3, "method": "mtls", "msg": "Both sides authenticated!" }` ✓

### Lesson 20 Post-Ship Bug Fixes

Six bugs were discovered and fixed after initial shipping of Lesson 20 (ws-test-runner):

| # | Bug | Fix |
|---|---|---|
| 1 | Concept body `*ad hoc exploration*` rendered with literal asterisks — renderer doesn't support single-asterisk italic | Removed asterisks, plain text instead |
| 2 | Step 2 description said "the workflow you built in **Lesson 9**" (wrong) | Changed to "Lesson 8" (Workflow Builder is Lesson 8 in the UI) |
| 3 | **Critical**: Workflow Runner shows "No workflows available" if user hasn't completed Lesson 8 | Added `createWsEchoDemoWorkflow()` factory + `__wfInsertWorkflow` window bridge; setup always seeds the workflow — step 2 now says "seeds it automatically in setup" |
| 4 | Initial implementation described as "Test Harness Tour" with 7-step navigation tour | Completely replaced with 6-step hands-on demo (pick → variables → run → completion → results) |
| 5 | `initialTab: 'scenarios'` set in original plan — would trigger auto-exit when reaching Results step | `initialTab` intentionally not set; setup navigates directly to workflow-runner |
| 6 | `useDemoWorkflowBridge` only had `__wfDeleteByName` — no insert capability | Extended with optional `insert` param + `__wfInsertWorkflow` window bridge |

All 6 bugs fixed; all 6 steps visually verified in browser (workflow ran, 3 requests, 0% errors, results visible).

---

### Well-Covered Areas

| Feature Area | Test Scenarios | Demo Lesson |
|---|---|---|
| Mock Server core | WM-01–09 | Lesson 1 (steps 1–7) |
| Connect / Disconnect | WC-04–05 | Lessons 1–9 |
| Send / Receive messages | WC-11–14 | Lessons 1, 3, 5 |
| Events log & message detail | WC-19–22 | Lessons 3–6 |
| Console commands | WC-C01–C09 | Lesson 3 (9 steps) |
| Multi-tab lifecycle | WT-01–10 | Lesson 4 (8 steps) |
| Auth (Bearer token, proxy) | WC-A01–A03 | Lesson 5 (9 steps) |
| Search / filter / diff / schema | WF-01–50 | Lesson 6 (9 steps) |
| Load testing | WL-01–15 | Lesson 7 (7 steps) |
| Workflow designer + Quick Test | WR-01–14 | Lesson 8 (11 steps) |
| SSE core | SE-01–10 | Lesson 9 (SSE, 7 steps) |
| Socket.IO protocol | WP-04–07 | Lesson 10 (9 steps) |
| STOMP protocol | WP-08–11 | Lesson 11 (8 steps) |
| GraphQL-WS protocol | WP-12–15 | Lesson 12 (7 steps) |
| Advanced Mock Server rules | WM-10–18 | Lesson 13 (8 steps) |
| Workspace: profiles, templates, env vars | WC-25–43 | Lesson 14 (8 steps) |
| Reliability: auto-reconnect & stats | WC-36–39, WT-32–35 | Lesson 15 (7 steps) |
| Session Recording & Replay | WT-24–31 | Lesson 16 (7 steps) |
| Power User: keyboard & tab tricks | WT-36–45 | Lesson 17 (7 steps) |
| SSE advanced: bookmarks, reconnect, LEI | SE-11–14 | Lesson 18 (7 steps) |
| TLS / wss:// | WP-16–18, WP-30 | Lesson 19 (7 steps) |
| Workflow Runner in Test Harness | WR-14–28 | Lesson 20 (6 steps) |
| Local TLS: skip-cert / CA cert / mTLS | WP-19–21 | Lesson 21 (8 steps, 🐳 Docker) |
