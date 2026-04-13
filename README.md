# RedfireForge — Redfire Performance Workbench

> *Fire. Measure. Validate.*

A desktop & web API performance testing tool built with React + TypeScript + Vite + Tauri. Define HTTP tests visually, execute them with configurable concurrency, validate responses, and analyze results — all from a native desktop application or a browser.

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
- [Branching Strategy & Versioning](#branching-strategy--versioning)
- [Development Workflow](#development-workflow)
- [CI/CD & Multi-Platform Releases](#cicd--multi-platform-releases)
- [Data Persistence](#data-persistence)

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **npm** (or yarn/pnpm)
- **Rust** (for desktop builds only — install via [rustup](https://rustup.rs/))

### Desktop App (Recommended)

```bash
npm install
npm run tauri:dev     # launches the native desktop window with hot-reload
```

### Desktop Build (Production — Local)

```bash
npm run tauri:build
```

This builds for your current OS only:
- **macOS**: `RedfireForge.app` and `.dmg` in `src-tauri/target/release/bundle/`
- **Windows**: `.msi` and `.exe` installers
- **Linux**: `.deb` and `.AppImage` packages

End users do **not** need Rust installed — the build produces a standalone native binary with all dependencies bundled.

### Desktop Build (All Platforms — CI/CD)

To build for all three platforms, push a version tag to GitHub:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the GitHub Actions workflow (`.github/workflows/release.yml`) which builds on macOS, Windows, and Linux runners simultaneously and creates a draft GitHub Release with all installers attached:

| Platform | Artifacts |
|---|---|
| **macOS ARM64** (Apple Silicon) | `.app`, `.dmg` |
| **macOS x64** (Intel) | `.app`, `.dmg` |
| **Linux x64** | `.deb`, `.AppImage` |
| **Windows x64** | `.msi`, `.exe` |

You can also trigger builds manually from the Actions tab using "Run workflow."

### Web Mode (Browser)

The app still runs as a standalone web app for development or environments where a desktop install isn't possible:

```bash
npm install
npm run dev
```

The app starts at `http://localhost:5173`. A built-in Vite server-side proxy (`/__proxy`) handles outbound HTTP requests to avoid CORS issues.

### Build Web for Production

```bash
npm run build
npm run preview   # serves the production build locally
```

### Stop

Press `Ctrl+C` in the terminal running the dev command.

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
│   ├── executor.ts          # HTTP execution engine (sequential, batch & pool modes)
│   ├── validator.ts         # Response validation (full, selective, unordered)
│   └── metrics.ts           # Summary statistics computation
├── hooks/
│   └── useTestExecution.ts  # React hook wrapping the executor
├── components/
│   ├── JsonPathBuilder.tsx  # Visual JSON path selector for validation
│   ├── ExportCenter.tsx     # Multi-select data export modal
│   └── ImportCenter.tsx     # Import with per-item conflict resolution
├── utils/
│   ├── storage.ts           # Dual-mode persistence (Tauri fs / localStorage)
│   ├── httpClient.ts        # Dual-mode HTTP client (Tauri native / Vite proxy)
│   ├── platform.ts          # Runtime platform detection (Tauri vs browser)
│   ├── tauriStore.ts        # Tauri file-system storage backend
│   ├── curlParser.ts        # cURL command → test config parser
│   ├── fileSaver.ts         # Native save dialog (Tauri dialog / File System Access API)
│   └── export.ts            # JSON & CSV export utilities
└── types/
    └── index.ts             # Shared TypeScript interfaces

src-tauri/
├── tauri.conf.json          # Tauri app configuration (window, bundle, plugins)
├── Cargo.toml               # Rust dependencies
├── capabilities/
│   └── default.json         # Plugin permissions (fs, http, dialog, shell)
└── src/
    ├── main.rs              # Tauri entry point
    └── lib.rs               # Plugin registration (fs, http, dialog, shell)
```

### Desktop vs Web Mode

The app detects at runtime whether it's running inside Tauri or a browser:

| Capability | Desktop (Tauri) | Web (Browser) |
|---|---|---|
| **Storage** | JSON files in `$APPDATA/redfireforge/` via Tauri `fs` plugin | `localStorage` (~5 MB) |
| **HTTP requests** | Native HTTP client via Tauri `http` plugin — no CORS | Vite dev proxy (`/__proxy`) |
| **File save dialogs** | Native OS file picker via Tauri `dialog` plugin | File System Access API / browser download |
| **Cross-browser data** | Shared — data lives on disk | Isolated per browser |

---

## UI Configuration Guide

### Settings

Open **Settings** (⚙ button in the sidebar) to configure your testing infrastructure.

#### Environments & Microservices

| Concept | Purpose |
|---|---|
| **Environment** | A deployment target (e.g., `t01`, `d01`, `p01`) |
| **Microservice** | A service you test (e.g., `sales-product-autoassign`) |
| **Base URL** | Per-environment URL for each microservice |

**How to configure:**

1. Click **⚙ Settings** at the bottom of the sidebar.
2. Under **Environments**, type a name and click **Add** to create environments.
3. Under **Microservices**, type a name and click **Add** to create services.
4. For each microservice, click **Configure** to expand the environment table. Mark environments as **Deployed** (checkbox), then click **Edit** next to each to enter the base URL. Press **Save** or hit Enter to confirm.
5. Close the Settings modal when done.

#### Global Auth Profiles

Define reusable authentication configurations at the global level that Feature Groups can inherit from.

1. Scroll to **Global Auth Profiles** in Settings.
2. Enter a profile name (e.g., `prod-oauth`, `qa-basic`) and click **+ Add Profile**.
3. Configure the auth type and credentials (OAuth2, Basic, Bearer, API Key, Digest).
4. Click **Verify** to test the credentials (OAuth2 acquires a real token).
5. In a Feature Group, set auth to **Inherit from Global Profile** and select the profile from the dropdown.

Multiple profiles support different environments (dev, QA, prod) without duplicating auth configuration across Feature Groups.

#### Storage

The **Storage** section shows current data usage.

- Click the **Total usage** row to expand a per-key breakdown with usage bars.
- **Max stored runs** controls how many test runs are kept (1–500, default 50). Oldest runs are auto-deleted when the limit is exceeded.
- Response bodies are automatically truncated to 2 KB each to conserve storage.

#### Export Center

The **Export** section in Settings opens the **Export Center** — a modal that lets you pick exactly what data to export as a single JSON file.

**How to use:**

1. Open **Settings** → scroll to **Export** → click **Open Export Center**.
2. Five collapsible sections appear: **Environments**, **Microservices**, **Global Auth Profiles**, **Feature Groups**, and **Test Runs**.
3. Check individual items or use the **All / None** buttons per section.
4. Use **Select All / Clear All** at the top for bulk operations.
5. A live summary in the footer shows exactly what the export will contain (counts of environments, microservices, scenarios, tests, runs, and total requests).
6. Click **Export JSON** to save the file. A native "Save As" dialog appears.
7. Click **Close** to return to Settings.

When exporting microservices, any referenced environments are automatically included even if not explicitly checked. Global Auth Profiles referenced by selected Feature Groups are also auto-included.

#### Import Center

The **Import** button in Settings opens the **Import Center** for importing previously exported JSON files with full conflict resolution.

**How to use:**

1. Open **Settings** → scroll to **Export & Import** → click **Import Data**.
2. Select a JSON file. The Import Center parses it and shows all items grouped by type.
3. Each item is checked for conflicts by **ID** and **name**:
   - **NEW** — no conflict; will be added directly.
   - **ID MATCH** / **NAME MATCH** — a conflict was detected. Choose an action per item:
     - **Skip** — don't import this item.
     - **Overwrite** — replace the existing item with the incoming one.
     - **Keep Both** — import as a new copy with fresh IDs (including all nested scenario/test IDs for Feature Groups).
4. Expand any item to see a side-by-side comparison of incoming vs. existing data.
5. Use bulk actions (**All**, **None**, **Skip all**, **Overwrite all**, **Keep both all**) per section.
6. A live summary bar shows what will be added, overwritten, or skipped.
7. Click **Import** to apply.

The Import Center can be maximized for large imports using the ⊞ button.

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

**Feature Group Authentication:**

Click the **Auth** button on a Feature Group to configure authentication that all scenarios and tests in the group can inherit. This is the lowest priority in the inheritance chain.

**Creating a Scenario:**

1. Inside a Feature Group, type a name and click **+ Scenario**.
2. Optionally set **Scenario-level authentication** — it can inherit from the Feature Group or define its own. Tests within the scenario can inherit this auth.

**Drag-and-Drop:**

Reorder and move scenarios and tests using the `⠿` drag handle:

- **Move scenarios between Feature Groups** — drag a scenario's `⠿` handle and drop it onto another Feature Group's scenario list. A blue indicator line shows where it will be inserted.
- **Reorder scenarios** — drag a scenario within the same Feature Group to change its order.
- **Move tests between scenarios** — drag a test's `⠿` handle and drop it into a different scenario (even across Feature Groups).
- **Reorder tests** — drag a test within the same scenario to change its order.
- **Drop zones** — "Drop here" zones appear at the end of lists and in empty containers when dragging.

Note: When moving a scenario or test to a different parent, its auth inheritance chain updates to follow the new parent.

**Import / Export:**

- **Import**: Click **Import** on a Feature Group to import scenarios from a JSON file. Conflict detection warns if scenarios or tests with the same name already exist, with an option to proceed or cancel.
- **Export**: Click **Export** on a Feature Group, Scenario, or individual Test to save it as JSON using a native file dialog.
- **Naming convention**: All exported files follow a consistent format: `{environment}-{microservice}-{level}-{name}-{timestamp}.json`.

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
| **Inherit from Scenario** | — | Uses the parent scenario's auth; if the scenario also inherits, walks up to the Feature Group |
| **No Auth** | — | No authentication |
| **Basic Auth** | Username, Password | Sends `Authorization: Basic <base64>` header |
| **Bearer Token** | Token, Prefix | Sends `Authorization: Bearer <token>` with customizable prefix |
| **API Key** | Key Name, Key Value, Location | Sends as a custom header or query parameter |
| **Digest Auth** | Username, Password | HTTP Digest authentication |
| **OAuth2 Client Credentials** | Token URL, Client ID, Client Secret | Acquires a real token at runtime via client credentials flow |

**Auth Inheritance Chain** (lowest → highest priority):

```
Global Auth Profile  →  Feature Group Auth  →  Scenario Auth  →  Test Auth
    (lowest)                                                       (highest)
```

- A **Test** set to "Inherit" resolves auth from its Scenario; if the Scenario also inherits, it walks up to the Feature Group, and then to the Global Auth Profile.
- A **Scenario** set to "Inherit from Feature" uses the Feature Group's auth config.
- A **Feature Group** set to "Inherit from Global Profile" uses a named Global Auth Profile defined in Settings.
- Each level can override by selecting its own auth type (Basic, Bearer, OAuth2, etc.).

**Auth Verification:**

Click the **Verify Auth** button (available at Feature, Scenario, and Test levels) to validate credentials:
- **OAuth2**: Actually calls the Token URL to acquire a token. On success, shows a token preview with expiration and scope.
- **Other types**: Confirms required fields are filled and shows a config summary.

**Secret Visibility Toggle:**

OAuth2 Client Secret fields include an eye icon toggle to show/hide the value.

**Color-Coded Auth Badges:**

Auth badges are color-coded by level for quick visual identification:

| Color | Meaning |
|---|---|
| **Purple (solid)** | Auth configured at Feature Group level |
| **Blue (solid)** | Auth configured at Scenario level |
| **Purple (outline)** | Scenario inheriting from Feature |
| **Green (solid)** | Test using its own auth |
| **Blue (outline)** | Test inheriting from Scenario |
| **Purple (outline)** | Test inheriting from Feature |
| **Gray (outline)** | No auth |

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

**Fetch Response & Host Override:**

Above the sample JSON area, a single row provides:

- **Fetch Response** button — sends the current test request and populates the sample JSON with the actual API response. Auth credentials are applied automatically based on the inheritance chain.
- **Host Override** checkbox + input — when enabled, replaces the hostname in the test URL with a different base URL for the fetch only (does not modify the test). Click **Use Settings** to quickly fill in the configured base URL. The override value is preserved when toggling off/on.

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

| Mode | Concurrency | How It Works |
|---|---|---|
| **Sequential** | Fixed to 1 | Executes one request at a time, in order. No parallelism — useful for testing exact request sequences or when the target service cannot handle concurrent load. |
| **Batch** | N | Fires N requests simultaneously, waits for **all N** to complete, then fires the next N. Simple and predictable, but idle slots wait for the slowest request. |
| **Continuous Pool** | N | Maintains exactly N requests in-flight at all times. When **any single** request completes, a new one starts immediately. Maximizes throughput with zero idle time. |

**Configuration:**

| Field | Description |
|---|---|
| **Concurrency** | Number of parallel requests (1–100). Automatically disabled and fixed to 1 when Sequential mode is selected. |
| **Total Transactions** | Total number of requests to execute. Automatically adjusts upward if less than the number of selected tests (each runs at least once). |
| **Test Distribution (Weights)** | Set relative weights per test. A test with weight `2` runs roughly twice as often as one with weight `1`. Set to `0` to skip a test without deselecting it. |

**Running a Test:**

1. Select one or more Scenarios using the checkboxes.
2. Adjust concurrency, total transactions, and weights.
3. Click **▶ Run Test**.
4. A live progress bar shows completion percentage, current TPS, average response time, and error rate. A tag next to "Progress" shows the execution mode, concurrency, and total transactions (e.g., `Batch · C:2 · T:160 · 2 parallel, wait for all, repeat`).
5. Click **■ Stop** to abort early.
6. When complete, results auto-navigate to the Results tab.

All runner settings (concurrency, transactions, selected scenarios, weights, host mode, execution mode, skip validation) are **persisted across sessions**.

### Results Dashboard

Navigate to the **Results** tab (third tab).

**Layout:**

- **Row 1**: "Results" heading, context tags (environment, microservice, host, execution mode with `C:` and `T:`), and action buttons (Refresh, Export JSON, Export CSV, Delete) aligned to the far right.
- **Row 2**: Full-width dropdown listing historical runs filtered by the selected environment/microservice. Each entry shows timestamp, service, environment, request count, and TPS.

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
| Native desktop app | Built with Tauri — native window, file system storage, no CORS issues |
| Dual-mode (desktop + web) | Runs as desktop app or browser SPA; auto-detects environment |
| Dark / light mode | Toggle between dark and light themes; preference persisted |
| Hierarchical test organization | Feature Group → Scenario → Test |
| Visual test builder | Point-and-click editor for URL, headers, body, auth, validation |
| cURL import/export | Paste cURL to create tests; generate cURL with live OAuth2 tokens |
| Multiple auth schemes | None, Inherit, Basic, Bearer Token, API Key, Digest, OAuth2 Client Credentials |
| Global auth profiles | Named reusable auth configurations in Settings; Feature Groups can inherit from them |
| Auth inheritance chain | Global Profile → Feature → Scenario → Test with visual color-coded badges (purple/blue/green) |
| Auth verification | Verify credentials at any level; OAuth2 acquires a real token |
| Full & selective validation | Deep JSON compare, specific path checks, unordered arrays |
| Visual JSON path builder | Click fields in a sample JSON tree to build validation rules |
| Smart path remapping | Auto-detects and remaps JSON paths when structure differs |
| Sequential, batch & pool execution | Three execution modes: one-at-a-time, parallel batches, or continuous pool |
| Dynamic host replacement | Swap hostnames at runtime via Settings or custom URL |
| Fetch host override | Override hostname when fetching sample responses in the Validation tab, with enable/disable toggle |
| Skip validation toggle | Disable response checks for raw throughput testing |
| Weighted test distribution | Control relative frequency of each test |
| Live progress monitoring | Real-time TPS, response times, and error rates during runs |
| Persistent configuration | All settings saved across sessions (file system in desktop, localStorage in browser) |
| Results filtering | Filter runs by environment and microservice |
| Rich metrics dashboard | TPS/TPM/TPH/TPD, percentiles, error rates, response distribution |
| JSON & CSV export | Export results with native file picker dialog |
| Export Center | Selectively export any combination of environments, microservices, global auth profiles, features, and runs |
| Import Center | Import exported JSON files with per-item conflict detection (ID/name match), side-by-side comparison, and resolution (skip, overwrite, keep both) |
| Import conflict detection | Feature Group, Scenario, and Test imports warn on duplicates with confirmation dialogs |
| Consistent export naming | All exports follow `{env}-{svc}-{level}-{name}-{timestamp}.json` naming convention |
| Storage management | Monitor usage, configure max runs, auto-prune old data, graceful quota-exceeded recovery |
| Collapsible sidebar | Toggle sidebar visibility from anywhere, including modals |
| Drag-and-drop | Move and reorder scenarios between Feature Groups and tests between scenarios via drag handles |
| Feature presence indicator | Sidebar color-codes items with/without Feature Groups |
| Native HTTP (desktop) | Tauri HTTP plugin bypasses CORS — no proxy needed |
| CORS proxy (web) | Built-in Vite server proxy for browser mode |
| Cross-platform builds | macOS (ARM + Intel), Windows, Linux via GitHub Actions CI/CD |
| Hot-reload development | `npm run tauri:dev` gives instant UI updates in the desktop window |

---

## Branching Strategy & Versioning

### Branch Model (Git Flow)

```
master          ← stable releases      (v1.0.0)
  └─ release/*  ← release candidates   (v1.0.0-beta.1)
  └─ develop    ← integration branch   (v1.0.0-alpha.1)
       └─ feature/*  ← feature work    (v1.0.0-dev.1)
```

| Branch | Purpose | Version tag | Merge target |
|---|---|---|---|
| `master` | Production-ready releases | `1.0.0` | — |
| `release/<ver>` | Stabilisation & QA before release | `1.0.0-beta.N` | `master` |
| `develop` | Integration of completed features | `1.0.0-alpha.N` | `release/*` |
| `feature/<name>` | Individual feature development | `1.0.0-dev.N` | `develop` |

### Version Bump Script

A single script updates the version across all three config files (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) and applies the correct pre-release tag based on the current branch:

```bash
# On master — stable release
./scripts/version.sh minor              # 0.1.0 → 0.2.0

# On develop — alpha build
./scripts/version.sh minor --pre 1      # 0.1.0 → 0.2.0-alpha.1

# On release/0.2.0 — beta build
./scripts/version.sh minor --pre 1      # 0.1.0 → 0.2.0-beta.1
./scripts/version.sh minor --pre 2      # 0.1.0 → 0.2.0-beta.2

# On feature/* — dev build
./scripts/version.sh patch --pre 1      # 0.1.0 → 0.1.1-dev.1
```

### Typical Release Flow

```
1.  feature/xyz  →  develop             (merge feature)
2.  develop: ./scripts/version.sh minor --pre 1    → 0.2.0-alpha.1
3.  develop  →  release/0.2.0           (create release branch)
4.  release/0.2.0: ./scripts/version.sh minor --pre 1  → 0.2.0-beta.1
5.  (QA & bug fixes on release branch)
6.  release/0.2.0  →  master            (merge to master)
7.  master: ./scripts/version.sh minor  → 0.2.0
8.  git tag v0.2.0
```

The version is displayed in the app header as a badge (e.g., `v0.1.0`, `v0.2.0-alpha.1`).

---

## Development Workflow

### Day-to-Day Development

Use the Tauri dev mode for the best experience:

```bash
npm run tauri:dev
```

This launches the native desktop window with **hot-reload** — any changes to React components, styles, or logic are reflected instantly in the desktop window. No manual rebuild needed.

| Command | What it does | Use when |
|---|---|---|
| `npm run tauri:dev` | Desktop app with hot-reload | Day-to-day development (recommended) |
| `npm run dev` | Browser-only at `localhost:5173` | Quick UI tweaks, no Rust needed |
| `npm run tauri:build` | Production build for current OS | Testing the final binary locally |

### Making Changes

1. Edit files in `src/` (React/TypeScript) — changes appear instantly in the desktop window via hot-reload.
2. Edit files in `src-tauri/` (Rust/config) — Tauri automatically recompiles the Rust backend (~15-20 sec).
3. When satisfied, build a local production binary with `npm run tauri:build` (~45 sec).
4. To release for all platforms, push a version tag (see CI/CD below).

### Project Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (browser-only mode) |
| `npm run build` | Build the web frontend for production |
| `npm run preview` | Serve the production web build locally |
| `npm run tauri:dev` | Launch desktop app with hot-reload |
| `npm run tauri:build` | Build desktop app for current OS |
| `npm run lint` | Run ESLint |
| `./scripts/version.sh` | Bump version across all config files |

---

## CI/CD & Multi-Platform Releases

### Automated Builds

The project includes a GitHub Actions workflow (`.github/workflows/release.yml`) that builds installers for all platforms:

| Platform | Runner | Artifacts |
|---|---|---|
| **macOS ARM64** (Apple Silicon) | `macos-latest` | `.app`, `.dmg` |
| **macOS x64** (Intel) | `macos-latest` | `.app`, `.dmg` |
| **Linux x64** | `ubuntu-22.04` | `.deb`, `.AppImage` |
| **Windows x64** | `windows-latest` | `.msi`, `.exe` |

### How to Release

1. Commit and push your changes:

```bash
git add .
git commit -m "your changes"
git push origin main
```

2. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. GitHub Actions automatically:
   - Builds on all 4 platform targets in parallel (~5-10 min)
   - Creates a **draft GitHub Release** with all installers attached
4. Go to the GitHub Releases page, review the draft, and click **Publish**.

You can also trigger a build manually from the **Actions** tab → **Build & Release** → **Run workflow** (no tag required).

### End-User Installation

End users download the installer for their OS from the GitHub Releases page. No development tools required — the installers are fully standalone:

- **macOS**: Open the `.dmg`, drag `RedfireForge.app` to Applications
- **Windows**: Run the `.msi` or `.exe` installer
- **Linux**: Install the `.deb` package or run the `.AppImage` directly

---

## Data Persistence

### Desktop Mode (Tauri)

Data is stored as individual JSON files in the OS application data directory:

- **macOS**: `~/Library/Application Support/com.redfireforge.desktop/`
- **Windows**: `%APPDATA%/com.redfireforge.desktop/`
- **Linux**: `~/.local/share/com.redfireforge.desktop/`

This means data persists across browsers and is shareable via file copy.

### Web Mode (Browser)

All data is stored in the browser's **localStorage**:

| Key | Content |
|---|---|
| `perf-test-feature-groups` | Feature Groups, Scenarios, and Tests |
| `perf-test-environments` | Environment definitions |
| `perf-test-microservices` | Microservice definitions and base URLs |
| `perf-test-global-auth` | Global Auth Profile definitions |
| `perf-test-runs` | Historical test run results (auto-pruned, response bodies truncated to 2 KB) |
| `perf-test-runner-config` | Runner settings (concurrency, weights, host mode, execution mode, etc.) |
| `perf-test-max-runs` | Maximum number of stored runs (default 50, configurable 1–500) |
| `perf-test-selected-env` | Currently selected environment ID |
| `perf-test-selected-svc` | Currently selected microservice ID |
| `perf-test-theme` | Theme preference (`dark` or `light`) |

**Storage limits:** localStorage is typically capped at ~5 MB per origin. The Storage section in Settings shows current usage and per-key breakdown. If a test run cannot be saved due to a full quota, a confirmation banner appears offering to automatically remove old runs to make room. To reset all data manually, clear localStorage for the site in your browser's DevTools (Application → Storage → Clear site data).
