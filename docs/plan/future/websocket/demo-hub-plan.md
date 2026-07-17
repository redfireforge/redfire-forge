# Demo Hub — WebSocket Demo Lessons Plan

> **Created:** 2026-06-14
> **Branch:** `feature/demo-hub-ws-lessons` (to be created)
> **Lessons (v2):** `src/features/demo-player/lessons/` — **used by Learning Hub UI**
> **Suites (v1 legacy):** `src/features/demo-player/suites/` — wired to `DemoPlayer.tsx`, NOT the Learning Hub
> **Selectors:** `src/shared/selectors.ts` (WS, DEMO constants)
> **Unit tests:** `src/features/demo-player/*.test.ts`, `lessons/protocols/ws-lessons.test.ts`

---

## Architecture: Two Systems

| System | Directory | Registry | UI Component | Status |
|---|---|---|---|---|
| **Lessons (v2)** | `lessons/` | `allDomains` in `lessons/index.ts` | `DemoHub.tsx` → Learning Hub cards | **Active** — what users see |
| **Suites (v1)** | `suites/` | `allDemoSuites` in `suites/index.ts` | `DemoPlayer.tsx` | **Legacy — deprecate after v2 migration** |

The Learning Hub UI shows **4 domain cards**:
- **Protocols** — 2 lessons ✅ Available (ws-basics, ws-auth-transport)
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

> **Note:** `protocolsDomain` already defines `categories`: `kafka`, `websocket`, `sse`. New lessons should set `category` accordingly (e.g. `category: 'sse'` for SSE Studio, `category: 'websocket'` for all WS lessons).

---

## Phase Status Tracker

### Protocols Domain (Active — 2/11 lessons shipped)

| # | Lesson | Status | Steps | Source E2E | Priority | Docker |
|---|---|---|---|---|---|---|
| 1 | WS Basics | ✅ Shipped | ~8 | ws-core-connect | — | No |
| 2 | Auth & Transport | ✅ Shipped | ~8 | ws-core-connect, ws-protocols-transport | — | No |
| **3** | **Console & Debugging** | 🔲 Not started | ~8 | ws-protocols-console | **P1** | No |
| **4** | **Filtering, Diff & Schema** | 🔲 Not started | ~8 | ws-filter-diff-schema-test | **P2** | No |
| **5** | **Tabs & Multi-Connection** | 🔲 Not started | ~8 | ws-tabs-persistence | **P3** | No |
| **6** | **Mock Server** | 🔲 Not started | ~7 | ws-mock-server | **P4** | No |
| **7** | **SSE Studio** | 🔲 Not started | ~7 | sse-studio | **P5** | No |
| **8** | **Load Testing** | 🔲 Not started | ~7 | ws-load-test | **P6** | No |
| **10** | **Socket.IO** | 🔲 Not started | ~7 | ws-protocols-socketio | **P8** | 🐳 Yes |
| **11** | **STOMP / RabbitMQ** | 🔲 Not started | ~7 | ws-protocols-stomp | **P9** | 🐳 Yes |
| **12** | **GraphQL Subscriptions** | 🔲 Not started | ~7 | ws-protocols-graphql | **P10** | 🐳 Yes |

### Workflows Domain (Coming Soon → Available when lesson 9 ships)

| # | Lesson | Status | Steps | Source E2E | Priority |
|---|---|---|---|---|---|
| **9** | **WS Workflow Builder** | 🔲 Not started | ~8 | ws-workflow-runner | **P7** |

### API Testing & Test Harness Domains

No WS-specific lessons planned. These domains will be populated with HTTP/harness lessons in future branches.

**Current:** 2 lessons in Protocols | **Target:** 11 lessons in Protocols + 1 in Workflows = 12 total (9 standalone + 3 Docker-dependent)

### Legacy Suites (v1) — 6 suites in `suites/`

These exist but are NOT shown in the Learning Hub. They may be migrated or deprecated:

| Suite | File | Steps | Overlaps with |
|---|---|---|---|
| WebSocket Basics | `websocket-basics.ts` | 9 | Lesson 1 (ws-basics) |
| Auth & Transport | `auth-transport.ts` | 10 | Lesson 2 (ws-auth-transport) |
| Console & Debugging | `console-debugging.ts` | 8 | Planned lesson 3 |
| Filtering, Diff & Schema | `filtering-diff-schema.ts` | 8 | Planned lesson 4 |
| SSE Studio | `sse-studio.ts` | 7 | Planned lesson 7 |
| API Test Runner | `api-testing.ts` | 8 | Future API Testing domain |

### v1 Deprecation Plan

Once all 12 v2 lessons are shipped and verified:
1. Delete `src/features/demo-player/suites/` directory (7 files: 6 suites + index.ts)
2. Delete v1 player files: `DemoPlayer.tsx`, `DemoPlayerPanel.tsx`, `DemoSuitePicker.tsx`, `useDemoPlayer.ts`
3. Delete `types-v1.ts` (contains `DemoSuite`, `DemoPlayerState`, v1 `DemoActionContext`)
4. Remove any v1 imports/routes from parent components (e.g. app layout, sidebar)
5. Run `npx tsc --noEmit` + full test suite to confirm clean removal
6. Update demo-related test files that reference v1 components

---

## Lesson 3: Console & Debugging (P1)

**Why:** The Console tab is the most powerful debugging tool — slash commands, structured events, category filtering. Currently exists as a v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/ws-console.ts`
**Export:** `wsConsoleLesson`
**Icon:** � | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (derived from ws-protocols-console E2E + v1 suite `console-debugging.ts`)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `console-intro` | The Console Tab | `[data-testid="right-tab-console"]` | — |
| 2 | `console-lifecycle` | Lifecycle Events | Connect → see lifecycle entries appear | WP-C01 |
| 3 | `console-categories` | Category Filter | `[data-testid="ws-console-category"]` dropdown — lifecycle/command/system/handshake | WP-C02 |
| 4 | `console-send` | /send Command | Type `/send hello` → message appears in Events | WP-C03 |
| 5 | `console-help` | /help Command | Type `/help` → see all available commands | WP-C04 |
| 6 | `console-clear` | /clear Command | Type `/clear` → console clears | WP-C05 |
| 7 | `console-search` | Search Console | Console search bar — independent from Events search | WF-35/36 |
| 8 | `console-views` | Structured vs Raw | Toggle between structured table and raw text view | — |

---

## Lesson 4: Filtering, Diff & Schema (P2)

**Why:** Power-user features for analyzing WS traffic — search modes, compare messages, validate against schemas. Currently exists as v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/ws-filtering.ts`
**Export:** `wsFilteringLesson`
**Icon:** 🔍 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (derived from ws-filter-diff-schema E2E + v1 suite `filtering-diff-schema.ts`)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `filter-search` | Search Modes | Text / Regex / JSONPath mode pills | WF-01–04 |
| 2 | `filter-bar` | Filter Bar | Toggle filter bar → size, time, content-type filters | WF-06–10 |
| 3 | `filter-badges` | Active Filter Count | Badge shows how many filters active | WF-11 |
| 4 | `filter-preset` | Save & Apply Presets | Save current filters as a named preset | WF-12–14 |
| 5 | `diff-compare` | Compare Mode | Select two messages → side-by-side diff | WF-15–20 |
| 6 | `diff-detail` | Diff from Detail Panel | Use Diff ↑/↓ buttons in detail panel | WF-21–22 |
| 7 | `schema-add` | Add a JSON Schema | Schema tab → add/edit/delete schemas | WF-24–26 |
| 8 | `schema-validate` | Live Validation Badges | Messages show ✅/❌ badges against active schema | WF-28–30 |

---

## Lesson 5: Tabs & Multi-Connection (P3)

**Why:** Multi-tab is the core WS Studio workflow. Every user needs to understand independent connections, tab lifecycle, and URL history.

**File:** `src/features/demo-player/lessons/protocols/ws-tabs.ts`
**Export:** `wsTabsLesson`
**Icon:** 📑 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (derived from ws-tabs-persistence E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `tabs-intro` | Your Connection Tab Bar | `CONN_TAB_ADD` area | WT-01 |
| 2 | `tabs-add` | Add a New Tab | `CONN_TAB_ADD` | WT-01 |
| 3 | `tabs-rename` | Rename a Tab | Tab label (dbl-click) | WT-05 |
| 4 | `tabs-independent` | Independent Connections | Connect in Tab 1, switch to Tab 2 — still disconnected | WT-02 |
| 5 | `tabs-history` | URL History Dropdown | `[data-testid="url-history-trigger"]` | WT-11/WT-13 |
| 6 | `tabs-bookmark` | Bookmark a Connection | Bookmark star in tab bar | WT-19 |
| 7 | `tabs-keyboard` | Keyboard Navigation | Arrow keys, Home/End, F2 rename (tip overlay) | WT-39–42 |
| 8 | `tabs-close` | Close a Tab | `[data-testid="conn-tab-close-*"]` — shows confirm if connected | WT-04 |

**Selectors needed (add to `selectors.ts` → `WS` object):**
```ts
// Connection tabs — additions
CONN_TAB_BAR:      '[data-testid="conn-tab-bar"]',
CONN_TAB_CLOSE:    '[data-testid^="conn-tab-close-"]',
URL_HISTORY:       '[data-testid="url-history-trigger"]',
URL_HISTORY_DD:    '[data-testid="url-history-dropdown"]',
```

> **Note:** `right-tab-console` and `right-tab-loadtest` data-testids exist in the UI but are also missing from `selectors.ts`. Add them when implementing Lessons 3 and 8:
> ```ts
> RIGHT_TAB_CONSOLE: '[data-testid="right-tab-console"]',
> RIGHT_TAB_LOADTEST:'[data-testid="right-tab-loadtest"]',
> ```

---

## Lesson 6: Mock Server (P4)

**Why:** Zero-dependency, self-contained demo — users can start a mock server and test without Docker or external services. Perfect "first 5 minutes" experience.

**File:** `src/features/demo-player/lessons/protocols/ws-mock-server.ts`
**Export:** `wsMockServerLesson`
**Icon:** 🏗️ | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (derived from ws-mock-server E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `mock-intro` | Built-in Mock Server | `MODE_MOCK` toggle | MS-01 |
| 2 | `mock-start` | Start the Mock Server | `MOCK_START_BTN` | MS-02 |
| 3 | `mock-status` | Server Status Indicator | Status indicator area | MS-03 |
| 4 | `mock-connect` | Connect to Your Mock | Switch to Client, connect to ws://localhost:9876 | MS-05 |
| 5 | `mock-echo` | Echo Mode — Messages Bounce Back | Send a message, see it echoed | MS-06 |
| 6 | `mock-broadcast` | Broadcast Mode | Switch to broadcast, send to all clients | MS-07 |
| 7 | `mock-stop` | Stop the Server | `MOCK_STOP_BTN` — client disconnects automatically | MS-09 |

**Selectors:** Already in `selectors.ts` — `MOCK_START_BTN`, `MOCK_STOP_BTN`, `MODE_MOCK`.

---

## Lesson 7: SSE Studio (P5)

**Why:** SSE is a distinct protocol with its own Studio page. Users need to know how to find it, connect, and monitor events. Currently exists as v1 suite but not in Learning Hub.

**File:** `src/features/demo-player/lessons/protocols/sse-studio.ts`
**Export:** `sseStudioLesson`
**Icon:** 📡 | **Est. time:** 2 min | **initialTab:** `sse-studio`
**Category:** `sse`

### Steps (derived from sse-studio E2E + v1 suite `sse-studio.ts`)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `sse-nav` | Navigate to SSE Studio | Protocols → SSE tab in sub-nav | SE-01 |
| 2 | `sse-connect` | Connect to an SSE Endpoint | URL input + Connect button | SE-03 |
| 3 | `sse-events` | Live Event Stream | Events appear with type badges (message/update/alert) | SE-05 |
| 4 | `sse-detail` | Event Detail Panel | Click a row → see full payload | SE-06 |
| 5 | `sse-filter` | Search & Type Filter | Text search + event type dropdown | SE-09/10 |
| 6 | `sse-bookmark` | Bookmark Events | Star an event for later reference | SE-11 |
| 7 | `sse-console` | SSE Console | Console tab — lifecycle events, /help, /clear | SE-15 |

---

## Lesson 8: Load Testing (P6)

**Why:** Showcases power-user value — constant/ramp/burst profiles, live metrics dashboard, latency histogram, and export. Differentiates the app from simple WS clients.

**File:** `src/features/demo-player/lessons/protocols/ws-load-testing.ts`
**Export:** `wsLoadTestingLesson`
**Icon:** 📊 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Category:** `websocket`

### Steps (derived from ws-load-test E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `lt-intro` | Load Test Tab | `[data-testid="right-tab-loadtest"]` | WL-01 |
| 2 | `lt-template` | Message Template | Template textarea — supports `{{i}}`, `{{timestamp}}` placeholders | WL-03 |
| 3 | `lt-profile` | Load Profile — Constant, Ramp, Burst | Profile selector dropdown | WL-04 |
| 4 | `lt-duration` | Duration & Rate Settings | Duration presets, rate input | WL-05 |
| 5 | `lt-run` | Run the Load Test | Start button — live counter updates | WL-07 |
| 6 | `lt-metrics` | Live Metrics Dashboard | Results panel — total, rate, latency percentiles, histogram | WL-12–14 |
| 7 | `lt-export` | Export Results & Start Over | Export JSON button, New Test button | WL-15 |

**Selectors needed (add to `selectors.ts` → `WS` object):**
```ts
// Load Test — verify actual testid names in LoadTestPanel.tsx before adding
RIGHT_TAB_LOADTEST:'[data-testid="right-tab-loadtest"]',
LT_START_BTN:      '[data-testid="lt-start-btn"]',
LT_PROFILE_SELECT: '[data-testid="lt-profile-select"]',
LT_EXPORT_BTN:     '[data-testid="lt-export-btn"]',
```

---

## Lesson 9: WS Workflow Builder (P7)

**Why:** Advanced feature — shows how WS testing integrates with the visual workflow designer and test harness. Multi-step flows: Connect → Send → Receive → Assert.

**File:** `src/features/demo-player/lessons/workflows/ws-workflow.ts`
**Export:** `wsWorkflowLesson`
**Icon:** 🔀 | **Est. time:** 4 min | **initialTab:** `workflow-designer`
**Domain:** `workflowDomain` (set `available: true` when this ships)

### Steps (derived from ws-workflow-runner E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `wf-intro` | Workflow Designer | Canvas area — Start node visible | WR-01 |
| 2 | `wf-palette` | Find WS Nodes | Palette search → type "WS" → 4 blocks appear | WR-02 |
| 3 | `wf-add-connect` | Add a WS Connect Node | Click WS Connect in palette → node on canvas | WR-03 |
| 4 | `wf-config` | Configure the Connection | Double-click → URL, Connection ID, Timeout, Headers | WR-04/05 |
| 5 | `wf-add-send` | Add WS Send Node | Add Send node, wire from Connect, set message | WR-06/07 |
| 6 | `wf-quick-test` | Quick Test | Click Quick Test → see execution step-by-step | WR-12 |
| 7 | `wf-results` | View Results | Node Output/Logs tabs — per-step execution details | WR-13 |
| 8 | `wf-harness` | Run in Test Harness | Feature Groups → WS transport → run → Results with CONNECT badge | WR-24/25 |

**Selectors needed (add to `selectors.ts` — new `WF` export or extend `WS`):**
```ts
// Workflow Designer — verify actual testid/class names in WorkflowDesigner before adding
WF_PALETTE_SEARCH: '[data-testid="wf-palette-search"]',  // verify
WF_QUICK_TEST_BTN: '[data-testid="wf-quick-test-btn"]',  // verify
WF_CANVAS:         '[data-testid="wf-canvas"]',           // verify
```

> **Note:** The `lessons/workflows/` directory doesn't exist yet — create it when implementing this lesson.

---

## Implementation Checklist (per lesson)

For each new lesson:

- [ ] Create lesson file in `src/features/demo-player/lessons/protocols/ws-*.ts` (or `lessons/workflows/` for Workflow domain)
- [ ] Add any new selectors to `src/shared/selectors.ts`
- [ ] Register in `src/features/demo-player/lessons/index.ts` → `protocolsDomain.lessons[]` (or `workflowDomain.lessons[]`)
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
| Tab Keyboard Nav (WT-39–42) | Covered as tip in Lesson 5 step 7; too simple for standalone |
| Tab Drag Reorder (WT-36–38) | Self-explanatory; mentioned as tip in Lesson 5 |

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

## Lesson 10: Socket.IO Protocol (P8 — Docker)

**Why:** Socket.IO is the most popular real-time framework. Showing auto-detection, event names, and namespaces demonstrates deep protocol support.

**File:** `src/features/demo-player/lessons/protocols/ws-socketio.ts`
**Export:** `wsSocketIoLesson`
**Icon:** 🔌 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/socketio/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:3100/socket.io/?EIO=4&transport=websocket`
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Requires Docker` badge on lesson card

### Steps (derived from ws-protocols-socketio E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `sio-prereq` | Start the Socket.IO Server | Prerequisite gate — docker command + check | — |
| 2 | `sio-protocol` | Select Socket.IO Protocol | `protocol-select` dropdown → Socket.IO | WP-04 |
| 3 | `sio-connect` | Connect — Auto-Detection | Connect to endpoint → protocol badge shows "Socket.IO" | WP-04 |
| 4 | `sio-event-name` | Event Name Field | `sio-event-name` input — Socket.IO events have names (not just data) | — |
| 5 | `sio-send` | Send a Named Event | Type event name + payload → send | — |
| 6 | `sio-events` | Events Tab — SIO Framing | Events show Socket.IO frame type (message/ack/error) | — |
| 7 | `sio-console` | Console — Protocol Events | Console shows SIO-specific lifecycle (connect, disconnect, reconnect) | WP-C01 |

---

## Lesson 11: STOMP / RabbitMQ (P9 — Docker)

**Why:** Enterprise messaging with RabbitMQ is a key differentiator. Shows SUBSCRIBE/SEND/UNSUBSCRIBE commands and destination-based routing.

**File:** `src/features/demo-player/lessons/protocols/ws-stomp.ts`
**Export:** `wsStompLesson`
**Icon:** 📬 | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/stomp/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:15674/ws` (credentials: `guest` / `guest`)
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Requires Docker`

### Steps (derived from ws-protocols-stomp E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `stomp-prereq` | Start RabbitMQ + STOMP | Prerequisite gate — docker command + check | — |
| 2 | `stomp-protocol` | Select STOMP Protocol | `protocol-select` → STOMP | WP-05 |
| 3 | `stomp-connect` | Connect to RabbitMQ | URL + auth (guest/guest) → CONNECTED frame | WP-05 |
| 4 | `stomp-subscribe` | Subscribe to a Queue | STOMP command selector → SUBSCRIBE, destination `/queue/demo` | — |
| 5 | `stomp-send` | Send a Message | STOMP command → SEND, destination + body | — |
| 6 | `stomp-receive` | Receive via Subscription | Events tab shows MESSAGE frame from the subscription | — |
| 7 | `stomp-console` | Console — STOMP Frames | Console shows CONNECTED, SUBSCRIBE, MESSAGE, ERROR frames | WP-C01 |

---

## Lesson 12: GraphQL Subscriptions (P10 — Docker)

**Why:** GraphQL-WS subscriptions are increasingly popular. Shows the subscribe/unsubscribe flow with live data push — impressive for demos.

**File:** `src/features/demo-player/lessons/protocols/ws-graphql.ts`
**Export:** `wsGraphqlLesson`
**Icon:** ◈ | **Est. time:** 3 min | **initialTab:** `websocket-studio`
**Container:** `docker compose -f docker/websocket/graphql/docker-compose.yml up -d`
**Endpoint:** `ws://localhost:4100/graphql`
**Category:** `websocket` (Protocols domain)
**Tag:** `🐳 Requires Docker`

### Steps (derived from ws-protocols-graphql E2E)

| # | Step ID | Title | Highlight | Source |
|---|---|---|---|---|
| 1 | `gql-prereq` | Start the GraphQL Server | Prerequisite gate — docker command + check | — |
| 2 | `gql-protocol` | Select GraphQL-WS Protocol | `protocol-select` → GraphQL-WS | WP-06 |
| 3 | `gql-connect` | Connect | Connect → protocol badge "GraphQL-WS", connection_init exchange | WP-06 |
| 4 | `gql-subscribe` | Write a Subscription Query | Operation name + query textarea → `subscription { onMessage { id text } }` | — |
| 5 | `gql-start` | Start Subscription | Send → subscribe operation starts, op ID shown | — |
| 6 | `gql-receive` | Receive Live Data | Events tab shows `next` payloads pushed from server | — |
| 7 | `gql-console` | Console — GraphQL Frames | Console shows connection_init, connection_ack, subscribe, next, complete | WP-C01 |

---

## Docker Demo Implementation Checklist

In addition to the standard per-lesson checklist:

- [ ] Create `src/features/demo-player/utils/checkEndpoint.ts` + unit test
- [ ] Create `src/features/demo-player/components/PrerequisiteGate.tsx` + unit test
- [ ] Add `🐳 Requires Docker` badge styling to lesson card CSS
- [ ] Capture fallback screenshots for all 3 lessons (7 steps each = 21 PNGs)
- [ ] Store in `public/demo-screenshots/ws-socketio/`, `ws-stomp/`, `ws-graphql/`
- [ ] Test each lesson in both modes: live (containers up) and fallback (containers down)
- [ ] Verify "Check Again" button correctly detects when container starts
- [ ] Verify lesson cards show Docker badge; non-Docker lessons do not

---

## Success Criteria

- [ ] 11 lessons in `protocolsDomain.lessons[]` + 1 in `workflowDomain.lessons[]` = 12 total
- [ ] ~90 total steps across all lessons
- [ ] Every lesson plays start-to-finish without errors
- [ ] Docker lessons work in both live and fallback-screenshot modes
- [ ] Protocols domain card shows "11 lessons"
- [ ] Workflows domain card shows "1 lesson" (not "Coming Soon")
- [ ] All spotlight highlights point to visible, existing elements
- [ ] Step descriptions are understandable by first-time users
- [ ] No hardcoded selector strings — all via `selectors.ts`
- [ ] Unit test coverage ≥ 90% for demo-player module
