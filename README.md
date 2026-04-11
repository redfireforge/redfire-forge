# Performance Test UI

A browser-based performance testing tool built with React + TypeScript + Vite. Define HTTP tests visually, execute them with configurable concurrency, validate responses, and analyze results — all from a single-page application.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [UI Configuration Guide](#ui-configuration-guide)
  - [Settings](#settings)
  - [Sidebar Navigation](#sidebar-navigation)
  - [Feature Groups & Scenarios](#feature-groups--scenarios)
  - [Test Editor](#test-editor)
  - [Test Runner](#test-runner)
  - [Results Dashboard](#results-dashboard)
- [Feature Reference](#feature-reference)
- [Data Persistence](#data-persistence)

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** (or yarn/pnpm)

### Install & Run

```bash
npm install
npm run dev
```

The app starts at `http://localhost:5173` (default Vite port). A built-in Vite server-side proxy (`/__proxy`) handles all outbound HTTP requests to avoid CORS issues — no additional backend is needed.

### Build for Production

```bash
npm run build
npm run preview   # serves the production build locally
```

### Stop

Press `Ctrl+C` in the terminal running `npm run dev` (or `npm run preview`).

---

## Architecture Overview

```
src/
├── App.tsx                  # Root component: tabs, sidebar, settings modal
├── App.css                  # All application styles
├── pages/
│   ├── ScenarioBuilder.tsx  # Feature Groups → Scenarios → Tests editor
│   ├── TestRunner.tsx       # Configure & execute performance runs
│   └── ResultsDashboard.tsx # View & analyze historical test results
├── engine/
│   ├── executor.ts          # HTTP execution engine (batch & pool modes)
│   ├── validator.ts         # Response validation (full, selective, unordered)
│   └── metrics.ts           # Summary statistics computation
├── hooks/
│   └── useTestExecution.ts  # React hook wrapping the executor
├── components/
│   ├── JsonPathBuilder.tsx  # Visual JSON path selector for validation
│   └── ExportCenter.tsx     # Multi-select data export modal
├── utils/
│   ├── storage.ts           # LocalStorage persistence helpers
│   ├── curlParser.ts        # cURL command → test config parser
│   ├── fileSaver.ts         # Native "Save As" dialog (File System Access API)
│   └── export.ts            # JSON & CSV export utilities
└── types/
    └── index.ts             # Shared TypeScript interfaces
```

---

## UI Configuration Guide

### Settings

Open **Settings** (⚙ button in the sidebar) to configure your testing infrastructure.

#### Environments & Microservices

| Concept | Purpose |
|---|---|
| **Environment** | A deployment target (e.g., `t01`, `d01`, `p01`) |
| **Microservice** | A service you test (e.g., `sales-product-autoassign`) |
| **Base URL** | Per-environment URL for each microservice (e.g., `https://sales-product-autoassign.apps.gmna.test.cvca.atmosdt.gm.com`) |

**How to configure:**

1. Click **⚙ Settings** at the bottom of the sidebar.
2. Under **Environments**, type a name and click **Add** to create environments.
3. Under **Microservices**, type a name and click **Add** to create services.
4. For each microservice, click **Configure** to expand the environment table. Mark environments as **Deployed** (checkbox), then click **Edit** next to each to enter the base URL. Press **Save** or hit Enter to confirm.
5. Close the Settings modal when done.

#### Storage

The **Storage** section shows how much localStorage is being used.

- Click the **Total usage** row to expand a per-key breakdown with usage bars.
- **Max stored runs** controls how many test runs are kept (1–500, default 50). Oldest runs are auto-deleted when the limit is exceeded.
- Response bodies are automatically truncated to 2 KB each to conserve storage.

#### Export Center

The **Export** section in Settings opens the **Export Center** — a modal that lets you pick exactly what data to export as a single JSON file.

**How to use:**

1. Open **Settings** → scroll to **Export** → click **Open Export Center**.
2. Four collapsible sections appear: **Environments**, **Microservices**, **Feature Groups**, and **Test Runs**.
3. Check individual items or use the **All / None** buttons per section.
4. Use **Select All / Clear All** at the top for bulk operations.
5. A live summary in the footer shows exactly what the export will contain (counts of environments, microservices, scenarios, tests, runs, and total requests).
6. Click **Export JSON** to save the file. A native "Save As" dialog appears.
7. Click **Close** to return to Settings.

When exporting microservices, any referenced environments are automatically included even if not explicitly checked.

### Theme (Dark / Light Mode)

Click the sun/moon toggle button in the top-right corner of the header to switch between **dark mode** (default) and **light mode**. Your preference is persisted across sessions.

### Sidebar Navigation

The left sidebar organizes your data by environment or microservice.

- **Toggle visibility**: Click the floating `☰` / `✕` button (always visible, even over modals).
- **Switch view**: Use the **Env** / **Svc** toggle at the top of the sidebar.
- **Expand / Collapse**: Click the `▸` arrow next to an item to expand its children, or use **Expand All** / **Collapse All** buttons.
- **Selection**: Click an environment/microservice name to select it. The selected context filters what you see in Feature Groups, Test Runner, and Results. Click a child item (e.g., a microservice under an environment) to select both simultaneously.
- **Feature indicator**: Items with associated Feature Groups show a colored dot — green for items that have features, gray for those that don't.
- **Selected item highlight**: The currently selected child item shows a colored left border and bold text for clear identification.

### Feature Groups & Scenarios

Navigate to the **Feature Groups** tab (first tab).

**Hierarchy:**

```
Feature Group (e.g., "Vehicle Onboarding")
  └── Scenario (e.g., "Happy Path - New Vehicle")
        └── Test (e.g., "POST /vehicles/onboarding")
```

**Creating a Feature Group:**

1. Type a name in the "New Feature Group" input and click **+ New Feature Group**.
2. The group is automatically associated with the currently selected environment and microservice from the sidebar.

**Creating a Scenario:**

1. Inside a Feature Group, type a name and click **+ Scenario**.
2. Optionally set **Scenario-level authentication**. Tests within the scenario can inherit this auth.

**Import / Export:**

- **Import**: Click **Import** on a Feature Group to import from a JSON file.
- **Export**: Click **Export** on a Feature Group, Scenario, or individual Test to save it as JSON using a native file dialog.
- Feature Groups can be dragged between environments via drag-and-drop in the sidebar.

### Test Editor

Click **+ Add Test** inside a Scenario, or click an existing test to open the editor modal.

**Tabs:**

| Tab | Description |
|---|---|
| **Params** | URL and query parameters. Edit params visually or type the full URL. |
| **Body** | Request body (for POST/PUT/PATCH). |
| **Auth** | Authentication configuration (see auth types below). |
| **Headers** | Key-value header pairs. |
| **Validation** | Configure response validation (see below). |

**Authentication Types:**

Select from a dropdown menu (similar to Insomnia):

| Type | Fields | Description |
|---|---|---|
| **Inherit from Scenario** | — | Uses the parent scenario's auth config |
| **No Auth** | — | No authentication |
| **Basic Auth** | Username, Password | Sends `Authorization: Basic <base64>` header |
| **Bearer Token** | Token, Prefix | Sends `Authorization: Bearer <token>` with customizable prefix |
| **API Key** | Key Name, Key Value, Location | Sends as a custom header or query parameter |
| **Digest Auth** | Username, Password | HTTP Digest authentication |
| **OAuth2 Client Credentials** | Token URL, Client ID, Client Secret | Acquires a real token at runtime via client credentials flow |

**Input Modes:**

- **Builder** (default): Fill in fields visually.
- **cURL Import**: Paste a cURL command to auto-populate all fields (URL, method, headers, body, auth).
- **cURL Export**: Generates a ready-to-use cURL command from the current config. For OAuth2 tests, it **fetches a real access token** and embeds it in the command. For Digest auth, it generates `--digest -u` flags. For API Key in query mode, the key is appended to the URL. Use the **Refresh** button to get a new token.

**Response Validation Modes:**

| Mode | Behavior |
|---|---|
| **None** | No validation — only checks HTTP status. |
| **Full Match** | Deep-compares the entire response body against expected JSON. |
| **Selective** | Validates specific JSON paths. Supports **include** (check listed paths) or **exclude** (check all except listed paths). |

**Selective Validation Features:**

- **Visual JSON Path Builder**: Paste a sample JSON response, and a visual tree appears. Check/uncheck fields to build validation paths.
- **Unordered Array Matching**: Enable this to match array items regardless of their order (e.g., `offers[0]` can match `offers[3]` if field values match).
- **Smart Path Remapping**: If paths don't resolve (e.g., response wraps data in a key), the validator automatically tries common remapping strategies.

### Test Runner

Navigate to the **Test Runner** tab (second tab).

**Host Selection:**

Choose which hostname is used at runtime:

| Option | Behavior |
|---|---|
| **Original** | Uses the hardcoded URL from the test definition as-is. |
| **Settings** | Replaces the hostname/port with the base URL configured in Settings for the current environment/microservice. Disabled if no URL is configured. |
| **Custom** | Type a temporary base URL — useful for testing against a specific instance without changing Settings. |

**Options:**

- **Skip Validation**: Disables all response validation for the run. Useful for pure throughput testing.
- **Execution Mode**:

| Mode | How It Works |
|---|---|
| **Batch** | Fires N requests simultaneously, waits for **all N** to complete, then fires the next N. Simple and predictable, but idle slots wait for the slowest request. |
| **Continuous Pool** | Maintains exactly N requests in-flight at all times. When **any single** request completes, a new one starts immediately. Maximizes throughput with zero idle time. |

**Configuration:**

| Field | Description |
|---|---|
| **Concurrency** | Number of parallel requests (1–100). |
| **Total Transactions** | Total number of requests to execute. Automatically adjusts upward if less than the number of selected tests (each runs at least once). |
| **Test Distribution (Weights)** | Set relative weights per test. A test with weight `2` runs roughly twice as often as one with weight `1`. Set to `0` to skip a test without deselecting it. |

**Running a Test:**

1. Select one or more Scenarios using the checkboxes.
2. Adjust concurrency, total transactions, and weights.
3. Click **▶ Run Test**.
4. A live progress bar shows completion percentage, current TPS, average response time, and error rate.
5. Click **■ Stop** to abort early.
6. When complete, results auto-navigate to the Results tab.

All runner settings (concurrency, transactions, selected scenarios, weights, host mode, execution mode, skip validation) are **persisted across sessions**.

### Results Dashboard

Navigate to the **Results** tab (third tab).

**Run Selection:**

- A dropdown lists historical runs filtered by the selected environment/microservice.
- Each run shows its timestamp and basic stats.
- Context tags show: environment, microservice, host used (purple = configured URL, orange = hardcoded), and execution mode (Batch/Pool).

**Summary Metrics (Row 1):**

| Metric | Description |
|---|---|
| **TPS / TPM / TPH / TPD** | Throughput: transactions per second, minute, hour, day. |
| **Avg Response** | Mean response time across all requests. |
| **Min / Max** | Fastest and slowest individual request. |

**Summary Metrics (Row 2):**

| Metric | Description |
|---|---|
| **P95 / P99** | 95th and 99th percentile response times. |
| **Error Rate** | Percentage of requests that returned non-2xx status. |
| **Total Duration** | Wall-clock time from first to last request. |
| **Total Requests** | Number of requests executed. |
| **Validation Failures** | Count of requests that failed response validation. |

**Response Time Distribution:**

A bar chart shows the distribution of response times in histogram buckets.

**Request Details Table:**

- Filter by scenario, pass/fail status.
- Paginated view of individual requests showing method, URL, status, response time, and validation result.
- Expand a row to see the full response body and any validation failure details.
- Alternating row stripes for readability.

**Export:**

- **Export JSON**: Full run data as structured JSON.
- **Export CSV**: Flat table suitable for spreadsheets.
- All exports use a native "Save As" dialog with sensible default filenames.

---

## Feature Reference

| Feature | Description |
|---|---|
| Dark / light mode | Toggle between dark and light themes; preference persisted |
| Hierarchical test organization | Feature Group → Scenario → Test |
| Visual test builder | Point-and-click editor for URL, headers, body, auth, validation |
| cURL import/export | Paste cURL to create tests; generate cURL with live OAuth2 tokens |
| Multiple auth schemes | None, Inherit, Basic, Bearer Token, API Key, Digest, OAuth2 Client Credentials |
| Full & selective validation | Deep JSON compare, specific path checks, unordered arrays |
| Visual JSON path builder | Click fields in a sample JSON tree to build validation rules |
| Smart path remapping | Auto-detects and remaps JSON paths when structure differs |
| Batch & pool execution | Two concurrency models for different load profiles |
| Dynamic host replacement | Swap hostnames at runtime via Settings or custom URL |
| Skip validation toggle | Disable response checks for raw throughput testing |
| Weighted test distribution | Control relative frequency of each test |
| Live progress monitoring | Real-time TPS, response times, and error rates during runs |
| Persistent configuration | All settings saved to localStorage across sessions |
| Results filtering | Filter runs by environment and microservice |
| Rich metrics dashboard | TPS/TPM/TPH/TPD, percentiles, error rates, response distribution |
| JSON & CSV export | Export results with native file picker dialog |
| Export Center | Selectively export any combination of environments, microservices, features, and runs |
| Storage management | Monitor usage, configure max runs, auto-prune old data |
| Collapsible sidebar | Toggle sidebar visibility from anywhere, including modals |
| Drag-and-drop | Reassign Feature Groups to different environments |
| Feature presence indicator | Sidebar color-codes items with/without Feature Groups |
| CORS proxy | Built-in Vite server proxy eliminates CORS issues |

---

## Data Persistence

All data is stored in the browser's **localStorage**:

| Key | Content |
|---|---|
| `perf-test-feature-groups` | Feature Groups, Scenarios, and Tests |
| `perf-test-environments` | Environment definitions |
| `perf-test-microservices` | Microservice definitions and base URLs |
| `perf-test-runs` | Historical test run results (auto-pruned, response bodies truncated to 2 KB) |
| `perf-test-runner-config` | Runner settings (concurrency, weights, host mode, execution mode, etc.) |
| `perf-test-max-runs` | Maximum number of stored runs (default 50, configurable 1–500) |
| `perf-test-selected-env` | Currently selected environment ID |
| `perf-test-selected-svc` | Currently selected microservice ID |
| `perf-test-theme` | Theme preference (`dark` or `light`) |

**Storage limits:** localStorage is typically capped at ~5 MB per origin. The Storage section in Settings shows current usage and per-key breakdown. To reset all data, clear localStorage for the site in your browser's DevTools (Application → Storage → Clear site data).
