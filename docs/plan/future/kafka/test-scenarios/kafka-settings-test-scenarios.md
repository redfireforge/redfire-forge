# Kafka Settings — Visual Test Scenarios

> **Covers:** Phases 1–3 — Core Transport, Client State, and Settings UX
> **Created:** 2026-06-03
> **Purpose:** Step-by-step manual guide for verifying Kafka cluster management, connections, topic browsing, auth/TLS config, and the AppHeader connection indicator.
>
> Work through each scenario top-to-bottom. Check the box ☐ when the expected result is confirmed. Do **not** pre-check items — verify each one yourself first.

---

## Before You Start

### Navigation

| Destination | How to get there |
|---|---|
| **Kafka Settings** | Click ⚙️ **Settings** in the left activity bar → **Kafka** tab |
| **AppHeader** | The top bar — the "Kafka" status pill appears there once a cluster is configured |

### Docker: Start the Plaintext Broker

These scenarios require a running Redpanda broker. You can start everything in one command or manually.

**Option A — Automated (recommended):**

```bash
# From the repo root — starts Docker, seeds all test data
docker/kafka/e2e/run-all-smoke.sh --seed-only plaintext
```

**Option B — Manual:**

```bash
# From the repo root
cd docker/kafka/plaintext
docker compose up -d

# Wait for the broker to be healthy (~10 seconds)
docker compose ps      # Status should show "healthy" for redfireforge-redpanda
```

- **Kafka broker:** `localhost:19092`
- **Redpanda Console (optional UI):** http://localhost:18080

### Start the Local Server

In a separate terminal:

```bash
npm run server
```

- Server listens at `http://127.0.0.1:3001`
- Keep this running for all connection-related scenarios (SC-08 through SC-15)

### Start the Web App

In another terminal:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Scenario Summary

| # | Scenario | Docker needed | Server needed |
|---|---|---|---|
| SC-01 | Empty state on first visit | No | No |
| SC-02 | Open cluster creation form | No | No |
| SC-03 | Create a plaintext cluster | No | No |
| SC-04 | Cluster appears in the list | No | No |
| SC-05 | Select a cluster | No | No |
| SC-06 | Edit cluster name (Cluster ID must not change) | No | No |
| SC-07 | Add a second broker address | No | No |
| SC-08 | Connect to broker | ✅ Yes | ✅ Yes |
| SC-09 | AppHeader shows "connected" indicator | ✅ Yes | ✅ Yes |
| SC-10 | Topic browser populates after connect | ✅ Yes | ✅ Yes |
| SC-11 | Search / filter topics | ✅ Yes | ✅ Yes |
| SC-12 | Disconnect from broker | ✅ Yes | ✅ Yes |
| SC-13 | AppHeader shows "disconnected" | No | No |
| SC-14 | Test Connection button | ✅ Yes | ✅ Yes |
| SC-15 | Connect error → diagnostic banner | ✅ Yes | ✅ Yes |
| SC-16 | Create cluster with SASL/PLAIN auth | No | No |
| SC-17 | Enable TLS on a cluster | No | No |
| SC-18 | Add a second cluster and switch between them | No | No |
| SC-19 | Delete a cluster | No | No |
| SC-20 | Auto-connect on startup toggle | No | No |
| SC-21 | Also verify in Tauri (desktop parity) | ✅ Yes | N/A |
| SC-22 | Export and import cluster configurations | No | No |
| SC-23 | SASL/SCRAM end-to-end: connect, produce, consume on secure broker (web) | ✅ Yes | ✅ Yes |
| SC-24 | SASL/SCRAM end-to-end via Tauri native transport (desktop) | ✅ Yes | N/A |

---

## SC-01 — Empty State on First Visit

**Prerequisites:** No Kafka clusters saved (fresh app / cleared localStorage)

To reset: open browser DevTools → Console → run:
```js
localStorage.removeItem('perf-test-kafka-clusters-v1');
localStorage.removeItem('perf-test-kafka-selected-cluster-id');
location.reload();
```

**Steps:**
1. Go to **Settings → Kafka**

**Expected:**
- ☐ Page heading (above the two-panel area): **"Kafka Cluster Studio"**
- ☐ Subtitle below that heading: *"Configure broker profiles and manage connections."*
- ☐ Left panel heading **"Clusters"**, subtitle *"Saved profiles · fast switch · live health"*, and a **Disconnected** badge pill in the top-right corner
- ☐ Body: paragraph **"No clusters configured yet"**, helper text *"Add your first Kafka cluster to enable topic browsing and workflow integration."*, and a blue **"Create First Cluster"** button
- ☐ Right panel heading: **"Create Cluster"**, placeholder text (italic): *"Select a saved cluster and click Edit, or click New Cluster to start configuring one."*
- ☐ **Note:** The action buttons (Test Connection / Connect / Disconnect / Refresh Status / Clear Error) and the Auto-connect checkbox are **not visible** in the empty state — they appear only after at least one cluster has been saved and selected
- ☐ AppHeader does **not** show a "Kafka" pill (indicator is hidden when no clusters are configured)

---

## SC-02 — Open Cluster Creation Form

**Steps:**
1. On the Kafka settings page (empty state from SC-01)
2. Click **"Create First Cluster"**

**Expected:**
- ☐ Right panel title changes from nothing to **"Create Cluster"**
- ☐ Subtitle: "Configure a new Kafka connection profile"
- ☐ A **Cancel** button appears top-right of the form
- ☐ Fields visible: **Cluster Name** (pre-filled "New Kafka Cluster"), **Cluster ID** (auto-generated like `kafka-cluster-<timestamp>`), **Client ID** (auto-generated), **Connection Timeout (ms)** (placeholder `10000`), **Request Timeout (ms)** (placeholder `10000`)
- ☐ **Bootstrap Brokers** section shows one broker row pre-filled with `127.0.0.1:19092`, an **Add Broker** button, and a greyed-out **Remove** button (can't remove the last broker)
- ☐ **Authentication** dropdown shows "No authentication" selected with options: SASL / PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
- ☐ **TLS / SSL** section shows "Enable TLS" checkbox (unchecked) and a **pre-checked but greyed-out** "Verify server certificate" checkbox (the verify checkbox is only interactive once TLS is enabled)
- ☐ A **Save Cluster** button is visible at the bottom

---

## SC-03 — Create a Plaintext Cluster

**Steps:**
1. Open the creation form (as in SC-02)
2. Clear "Cluster Name" and type: `Local Dev`
3. Observe the **Cluster ID** field — it **auto-updates** as you type, converting the name to a slug (e.g., `local-dev`). This is the creation-time behavior only.
4. Leave broker as `127.0.0.1:19092`
5. Leave Authentication as "No authentication"
6. Leave TLS unchecked
7. Click **Save Cluster**

**Expected:**
- ☐ While typing `Local Dev` in the Cluster Name field, the Cluster ID field shows `local-dev` (live slug conversion)
- ☐ The form closes (editor panel resets)
- ☐ The cluster list in the left panel now shows one card: **Local Dev**
- ☐ The card shows the broker address `127.0.0.1:19092` below the name
- ☐ The cluster is automatically selected (highlighted card)
- ☐ **Test Connection / Connect** buttons are now **enabled**
- ☐ AppHeader shows a **"Kafka"** pill (with red dot if the backend server is not running, grey dot once status can be checked)

---

## SC-04 — Cluster Appears in the List

**Steps:**
1. After SC-03 save completes, observe the cluster list in the Clusters left panel

**Expected:**
- ☐ The cluster card shows:
  - Name: **Local Dev** with a **Failed** badge (if backend server isn't running) or **Idle** label (if server is running but not connected)
  - Broker address `127.0.0.1:19092` below the name
  - Authentication mode *"No authentication"* on a third line
- ☐ An **Edit** button appears in the bottom-right of the card
- ☐ A selection summary row shows: *"Selected: Local Dev · No authentication"*
- ☐ The **"+ New"** button appears in the top-right of the Clusters heading
- ☐ The cluster card badge reflects the current backend state:
  - **Idle** — server running, broker reachable, not yet connected
  - **Failed** — server not running OR status check returned an error (background poll fires shortly after save)

---

## SC-05 — Select a Cluster

**Prerequisites:** At least one cluster exists

**Steps:**
1. If multiple clusters exist, click a different cluster card than the currently selected one
2. Click the cluster row (name/broker area, not the Edit button)

**Expected:**
- ☐ The clicked cluster card gets a **highlighted** (selected) border/background
- ☐ **Connect / Test Connection** buttons become enabled
- ☐ The selection summary row below the list updates: *"Selected: \<ClusterName\> · \<AuthMode\>"*
- ☐ The Topic Explorer's breadcrumb **"Cluster: \<ClusterName\>"** (next to *Kafka / Topics*) updates immediately to reflect the selected cluster
- ☐ The AppHeader pill aria-label updates to show the selected cluster name
- ☐ The editor panel (right panel) closes if it was open — right panel reverts to the *"Create Cluster"* placeholder

---

## SC-06 — Edit Cluster Name (Cluster ID Must Not Change)

**Steps:**
1. Click **Edit** on the "Local Dev" cluster card
2. Note the current value of **Cluster ID** (e.g., `local-dev`)
3. Change **Cluster Name** to `Local Dev (Redpanda)`
4. Observe the **Cluster ID** field — it should **not** auto-update (Cluster ID only auto-slugs during *initial creation*, not on subsequent edits)
5. Click **Save Cluster**

**Expected:**
- ☐ The cluster card now shows the new name: **Local Dev (Redpanda)**
- ☐ The Cluster ID in the form (if you click Edit again) is unchanged — still `local-dev`
- ☐ This confirms the "stable identity" behavior: editing a saved cluster's name never mutates its ID

---

## SC-07 — Add a Second Broker Address

**Steps:**
1. Click **Edit** on a cluster
2. In the **Bootstrap Brokers** section, click **Add Broker**
3. Type `127.0.0.1:19093` in the new broker row
4. Click **Save Cluster**
5. Click **Edit** again to verify

**Expected:**
- ☐ Two broker rows appear when clicking Add Broker
- ☐ The **Remove** button on the first row becomes **enabled** (can't remove the last one, but two rows → both removable)
- ☐ After save, the cluster card shows both broker addresses (comma-separated or listed)
- ☐ After editing again, both broker rows are present

**Clean up:** Remove the second broker (click Remove → Save) to keep the cluster with `127.0.0.1:19092` only.

---

## SC-08 — Connect to Broker

**Prerequisites:** Docker broker running (`docker compose up -d`), server running (`npm run server`)

**Steps:**
1. Select the **Local Dev (Redpanda)** cluster (broker: `127.0.0.1:19092`)
2. Click **Connect**

**Expected:**
- ☐ Immediately after clicking: the badge briefly shows **testing** state and the status text shows **"Testing connection..."** (this is the connecting in-progress state, may be visible for 1–3 seconds)
- ☐ After connection succeeds: badge changes to **Connected** (green pill) on both the Clusters panel and the cluster card
- ☐ Status text below the selection row changes to **"Connected to local-dev"** (cluster ID shown)
- ☐ **Disconnect** button becomes enabled; **Connect** button becomes disabled
- ☐ Topic Explorer's **"Include internal topics"** checkbox becomes enabled
- ☐ Topic Explorer **Refresh Topics** button becomes enabled
- ☐ Search Topics box becomes enabled
- ☐ Topics load immediately — at least one topic appears in the table

---

## SC-09 — AppHeader Shows "Connected" Indicator

**Prerequisites:** SC-08 complete (connected to broker)

**Steps:**
1. Look at the top header bar

**Expected:**
- ☐ A **"Kafka"** pill/button is visible in the AppHeader (right side of the top bar, near the theme toggle)
- ☐ The pill has a **green dot** (connected state)
- ☐ Hover over the pill → tooltip shows `<ClusterName> — Connected`
- ☐ Clicking the pill navigates directly to **Settings → Kafka**

---

## SC-10 — Topic Browser Populates After Connect

> **Note:** The topic browser is located in **Protocols → Kafka → Topics** tab, not in the Settings page. After connecting in Settings, navigate to **Protocols** in the left activity bar, then click the **Topics** tab to see topics.

**Steps:**
1. After connecting (SC-08), click **Protocols** in the left activity bar
2. The **Kafka** domain tab is auto-shown; click the **Topics** tab
3. Observe the topic list

**Expected:**
- ☐ Topics table shows columns: **TOPIC**, **PARTS**, **REPL**, **TRAFFIC**, **CGS**, **HEALTH**
- ☐ With the seeded data set, at least 37 topics are visible
- ☐ Domain filter chips appear at the top: **All**, plus chips per namespace prefix (e.g. **orders**, **redfireforge**, **users**, etc.)
- ☐ Filter dropdowns: **Health** (All/Healthy/Warning/Unknown), **Parts** (Any/1–4/5–12/12+), **Retention** (Any/< 1 day/1–7 days/> 7 days)
- ☐ **Internal** toggle chip is visible; clicking it adds `__consumer_offsets` and other internal topics
- ☐ **Recently Active** and **Lagging Consumers** special chips appear (disabled until a topic is selected and detail loaded)

---

## SC-11 — Search / Filter Topics

> **Note:** Search and filtering are in **Protocols → Kafka → Topics** tab.

**Prerequisites:** SC-10 complete (topics visible in Protocols → Kafka → Topics)

**Steps:**
1. In the topic search box (placeholder: "Search topics…"), type `redfireforge`
2. Observe the list
3. Clear the search box
4. Click a domain chip (e.g., **orders**)

**Expected:**
- ☐ Typing `redfireforge` filters the list to show only topics with that prefix
- ☐ Clearing the search restores the full list
- ☐ Clicking the **orders** domain chip filters to only `orders.*` topics
- ☐ Clicking **All** restores all topics
- ☐ Domain chip filtering and text search can be combined

---

## SC-12 — Disconnect from Broker

**Steps:**
1. Click **Disconnect**

**Expected:**
- ☐ The badge on the Clusters panel changes back to **disconnected**
- ☐ The cluster card label returns to **Idle**
- ☐ Status text changes back to **"Disconnected"**
- ☐ **Connect** button becomes enabled again; **Disconnect** becomes disabled
- ☐ In **Protocols → Kafka → Topics**, the topic list shows a guard/placeholder when not connected

---

## SC-13 — AppHeader Shows "Disconnected"

**Prerequisites:** SC-12 complete

**Steps:**
1. Look at the AppHeader

**Expected:**
- ☐ The "Kafka" pill now has a **grey dot** (disconnected)
- ☐ Hover tooltip: `<ClusterName> — Disconnected`

---

## SC-14 — Test Connection Button

**Prerequisites:** Docker broker running, server running

**Steps:**
1. Select the **Local Dev (Redpanda)** cluster (disconnected state)
2. Click **Test Connection**

**Expected:**
- ☐ The badge briefly shows a **testing** state (same as when clicking Connect)
- ☐ On success: badge changes to **Connected**, status text shows **"Connected to local-dev"**, and the **Disconnect** button becomes enabled
- ☐ "Test Connection" and "Connect" both result in a persistent connected state — they are equivalent in effect

> **Note:** "Test Connection" and "Connect" produce the same outcome (persistent connection). The distinction may be in how failures are surfaced (future versions may add probe-only semantics).

---

## SC-15 — Connect Error → Diagnostic Banner

> **Two failure modes** are tested here with different error messages:
> - **Broker stopped, server running** → `KAFKA_NETWORK_ERROR` / "Failed to fetch" / "Connection check failed"
> - **Server stopped, broker status irrelevant** → `KAFKA_NETWORK_ERROR` / "Server returned 502 Bad Gateway — is the backend server running?"

### Scenario A: Kafka Broker Stopped (Server Running)

**Prerequisites:** `npm run server` running; Docker broker **stopped**

```bash
# Stop the broker
cd docker/kafka/plaintext && docker compose stop
```

**Steps:**
1. Select the **Local Dev (Redpanda)** cluster (in Idle/Disconnected state)
2. Click **Connect**

**Expected:**
- ☐ Connection attempt starts immediately: cluster panel badge changes to **testing**, status text shows **"Testing connection..."**
- ☐ Within seconds the attempt fails: AppHeader pill changes to a **red dot** with aria-label `Local Dev (Redpanda) — Error`
- ☐ Cluster panel header badge changes to **"Error"** (red pill)
- ☐ Cluster card badge changes to **"Failed"** (amber pill)
- ☐ A **KAFKA_NETWORK_ERROR** diagnostic block appears in the Clusters panel with:
  - Bold heading: **"Network / broker reachability issue"**
  - Code label: **"KAFKA_NETWORK_ERROR"**
  - Detail: *"Failed to fetch"*
  - Advisory: *"Verify broker hostnames, ports, Docker exposure, and local network reachability."*
- ☐ Status text transitions from "Failed to fetch" → **"Connection check failed"** (after a background status re-check)
- ☐ **Clear Error** button: enabled immediately after the error fires; may become **disabled** once the background status poller overwrites the error state with "Connection check failed"
- ☐ If Clear Error is enabled: clicking it dismisses the error banner and resets state to Disconnected/Idle

### Scenario B: Backend Server Stopped

**Prerequisites:** Docker broker running; `npm run server` **not** running (kill it)

**Steps:**
1. Select the **Local Dev (Redpanda)** cluster
2. Click **Connect**

**Expected:**
- ☐ Same visual error sequence (testing → Error badge / Failed card)
- ☐ Error detail reads: **"Server returned 502 Bad Gateway — is the backend server running?"** (Vite proxy 502)
- ☐ Advisory: *"Verify broker hostnames, ports, Docker exposure, and local network reachability."*

**Clean up:** Restart Docker (if stopped): `docker compose up -d`; restart server: `npm run server`

---

## SC-16 — Create Cluster with SASL/PLAIN Auth

**Steps:**
1. Click **"+ New"** to open the creation form
2. Set **Cluster Name** to `Secure Dev`
3. Set broker to `127.0.0.1:19092`
4. In **Authentication**, select **SASL / PLAIN** from the dropdown
5. Verify two new fields appear: **Username** and **Password**
6. Type `admin` in Username, `admin-secret` in Password
7. Click **Save Cluster**

**Expected:**
- ☐ When SASL / PLAIN is selected, Username and Password fields appear immediately
- ☐ After save, the cluster card appears in the list showing a security profile label (e.g., "SASL/PLAIN" or "Authenticated")
- ☐ Clicking Edit on the cluster shows the auth fields pre-filled (username shown, password shown as masked `••••••`)

---

## SC-17 — Enable TLS on a Cluster

**Steps:**
1. Click **Edit** on any cluster
2. In the **TLS / SSL** section, check **"Enable TLS"**
3. Observe the "Verify server certificate" checkbox

**Expected:**
- ☐ When "Enable TLS" is checked, the **"Verify server certificate"** checkbox becomes **enabled** (it was greyed out before; it is pre-checked, so it stays checked when it becomes interactive)
- ☐ "Verify server certificate" is **checked** (pre-checked) — no extra click needed
- ☐ Five additional TLS fields appear below the checkboxes:
  - **TLS Server Name** (placeholder: `kafka.local`)
  - **CA PEM** (placeholder: `-----BEGIN CERTIFICATE-----`)
  - **Client Certificate PEM** (placeholder: `-----BEGIN CERTIFICATE-----`)
  - **Client Private Key PEM** (placeholder: `-----BEGIN PRIVATE KEY-----`)
  - **Key Passphrase** (placeholder: `Optional key passphrase`)
- ☐ Save the cluster → Edit again → TLS checkbox remains checked and all TLS fields are present

---

## SC-18 — Add a Second Cluster and Switch Between Them

**Steps:**
1. Ensure **Local Dev (Redpanda)** cluster exists
2. Click **"+ New"** button
3. Set Name to `Production Mirror`, broker to `prod-kafka:9092` (does not need to be reachable)
4. Note: as you type "Production Mirror", the **Cluster ID** field auto-updates to `production-mirror` (creation-time slug only)
5. Click **Save Cluster**
6. Click the **Local Dev (Redpanda)** cluster row
7. Click the **Production Mirror** cluster row

**Expected:**
- ☐ Both clusters are listed in the left panel in creation order
- ☐ After saving, the new cluster is **automatically selected** ("Selected: Production Mirror")
- ☐ The new cluster's card shows **Idle** badge (not Connected) and broker address `prod-kafka:9092`
- ☐ After switching to Production Mirror, navigating to **Protocols → Kafka → Topics** shows a guard/placeholder (Production Mirror is not connected)
- ☐ Clicking the **Local Dev (Redpanda)** card:
  - Switches selection: "Selected: Local Dev (Redpanda)"
  - If Local Dev was previously connected, navigating to Protocols → Kafka → Topics shows topics again (the backend connection persists in-session)
- ☐ Clicking **Production Mirror** again:
  - Switches selection back; Protocols → Kafka → Topics shows guard (Production Mirror is not connected)
- ☐ Switching clusters does **not** auto-disconnect the previously connected cluster — its backend connection persists until you click Disconnect explicitly

---

## SC-19 — Delete a Cluster

**Steps:**
1. Click **Edit** on the **Production Mirror** cluster
2. At the bottom of the edit form, a **Save Cluster** button and a **Delete Cluster** button appear side-by-side
3. Click **Delete Cluster**
4. An **inline confirmation** appears within the form: heading *"Delete this cluster?"*, a **Confirm Delete** button, and a **Cancel** button
5. Click **Confirm Delete**

**Expected:**
- ☐ "Delete Cluster" button is in the edit form — it only appears when editing a saved cluster (not during initial creation)
- ☐ Clicking "Delete Cluster" does **not** delete immediately — it first shows an inline confirmation row below the save button
- ☐ Clicking "Confirm Delete" removes the cluster from the list
- ☐ The edit panel closes and the right panel reverts to the *"Create Cluster"* placeholder
- ☐ If the deleted cluster was the selected one, selection **auto-switches to another available cluster** (or clears if none remain)
- ☐ AppHeader pill updates to reflect the newly selected cluster (or the previously connected cluster if one is still active)

---

## SC-20 — Auto-Connect on Startup Toggle

**Steps:**
1. Select the **Local Dev (Redpanda)** cluster
2. Click **Disconnect** to ensure the cluster is in Idle state before the test
3. Find **"Auto-connect the selected cluster on startup"** checkbox at the bottom of the Clusters panel
4. Check the checkbox
5. Reload the page (open `http://localhost:5173/?tab=kafka-settings` directly, or press `Cmd+R` / `Ctrl+R`)

**Expected:**
- ☐ The checkbox becomes checked
- ☐ Helper text below the checkbox: *"Restores the saved cluster selection and attempts a connection once when Kafka settings load."*
- ☐ After page reload, the app opens directly on the Kafka settings tab (if navigated via `?tab=kafka-settings`)
- ☐ The **previously selected cluster is automatically restored** ("Selected: Local Dev (Redpanda)")
- ☐ A connection attempt fires automatically: status badge briefly shows **testing** state → then **Connected** (if Docker and server are running)
- ☐ Status text shows **"Connected to local-dev"** without manually clicking Connect
- ☐ Navigate to **Protocols → Kafka → Topics** — topics load automatically (they are available since auto-connect connected on load)
- ☐ The "Auto-connect" checkbox persists across reloads (saved to localStorage)

> **Note:** Auto-connect fires once when the Kafka settings tab first loads during a session — it does not re-fire on tab switches within the same session.

---

## SC-21 — Also Verify in Tauri (Desktop Parity — Phase 9)

If you have the Tauri desktop app built:

```bash
npm run tauri:dev
```

Re-run these key scenarios in the desktop window:

| Scenario | What to check |
|---|---|
| SC-03 (Create cluster) | Form works identically |
| SC-08 (Connect) | Connection succeeds via **Tauri native transport** (no Vite proxy needed) |
| SC-09 (Header indicator) | Same 4 states (connected / connecting / error / disconnected) |
| SC-10 (Topics) | Topics load correctly via native path |
| SC-15 (Error) | Error banner displays correctly |
| SC-20 (Auto-connect) | Auto-connect fires on app window open |

> **Note:** In Tauri mode, Kafka broker calls go directly via the native rdkafka transport (Rust). The UI surface is identical — what differs is the underlying transport path. If a scenario passes in browser mode but fails in Tauri mode, file it as a Phase 9 parity regression.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No clusters configured yet" after refresh | Check localStorage key `perf-test-kafka-clusters-v1` in DevTools |
| Connect hangs forever | Confirm Docker is running: `docker compose ps` in `docker/kafka/plaintext/` |
| Topics list is empty | Verify the broker is connected; only `redfireforge.results.summary` exists by default. To create more topics, use Redpanda Console at http://localhost:18080 |
| Server not reachable | Confirm `npm run server` is running and listening on port 3001 |
| Kafka pill missing from header | Pill only appears when at least one cluster is configured |

---

## SC-22 — Export and Import Cluster Configurations

**Prerequisites:** At least one cluster configured (e.g., the "Local Dev (Redpanda)" cluster from SC-03)
**Docker needed:** No
**Server needed:** No

---

### Part A — Export

**Steps:**

1. Navigate to **Settings → Kafka**
2. Verify the **↓ Export** button is visible in the Clusters panel header (next to ↑ Import and + New)
3. Click **↓ Export**
4. A file download dialog appears (or file auto-downloads) with a filename like `kafka-clusters-2026-06-03.json`
5. Open / inspect the downloaded file

**Expected:**

- ☐ Export button is visible in the Clusters panel header
- ☐ Export button is **disabled** when no clusters are configured (test by clearing clusters first)
- ☐ Download filename matches pattern `kafka-clusters-<YYYY-MM-DD>.json`
- ☐ File content is valid JSON with structure:
  ```json
  {
    "version": 1,
    "exportedAt": <timestamp>,
    "clusters": [
      {
        "clusterId": "local-dev",
        "name": "Local Dev (Redpanda)",
        "brokers": ["127.0.0.1:19092"],
        ...
      }
    ]
  }
  ```
- ☐ All fields from the cluster config are present (`auth`, `tls`, `clientId`, timestamps)
- ☐ Passwords (if configured) are included in the export (the file should be kept secure)

---

### Part B — Import (merge into existing clusters)

**Steps:**

1. With the exported file from Part A, add a second cluster (e.g., "Test Cluster B") so you have 2 clusters total
2. Open DevTools Console and manually remove one cluster to simulate a partial-state scenario:
   ```js
   const key = 'perf-test-kafka-clusters-v1';
   const data = JSON.parse(localStorage.getItem(key));
   data.splice(0, 1); // remove first cluster
   localStorage.setItem(key, JSON.stringify(data));
   location.reload();
   ```
3. Verify only one cluster remains in the list
4. Click **↑ Import** in the Clusters panel header
5. Select the exported `kafka-clusters-<date>.json` file from Part A
6. Observe the import feedback message

**Expected:**

- ☐ Import button is always visible (not disabled when no clusters exist)
- ☐ File picker opens filtered to `.json` files
- ☐ After import: a green feedback banner appears in the Clusters panel: **"Imported 1 cluster."** (the previously-removed cluster is restored)
- ☐ The existing cluster (Test Cluster B) is **preserved** — import merges, does not wipe
- ☐ The restored cluster appears in the cluster list
- ☐ The dismiss button (×) on the feedback banner closes it

---

### Part C — Import error handling

**Steps:**

1. Create a text file named `bad.json` with contents: `{ "not": "valid kafka config" }`
2. Click **↑ Import** and select `bad.json`

**Expected:**

- ☐ Red feedback banner appears: **"Imported 0 clusters, 1 skipped (invalid)."** (or similar)
- ☐ No clusters are modified or removed

**Steps:**

1. Create a file with invalid JSON: `{ broken json`
2. Click **↑ Import** and select it

**Expected:**

- ☐ Red feedback banner appears: **"Import failed: invalid JSON file."**
- ☐ No clusters are modified

---

## SC-23 — SASL/SCRAM End-to-End: Connect, Produce, Consume on Secure Broker (Web)

> **Purpose:** Verify that the full Kafka lifecycle (connect → list topics → produce → consume → disconnect) works through the web server-proxy transport with **SASL/SCRAM-SHA-256** authentication on a real broker. This is the end-to-end TLS/Auth test for the normal (browser) path.

### Prerequisites: Start the Secure Broker

The secure Docker profile runs a Redpanda instance with SASL enabled on port **19093**. An init container creates two users and seeds topics.

```bash
# From the repo root
cd docker/kafka/secure
docker compose up -d

# Wait for both containers to complete (broker + init)
docker compose ps
# redfireforge-redpanda-secure      → healthy
# redfireforge-redpanda-secure-init → exited (0)
```

Wait for the init container to exit with code 0 before proceeding (~15–20 seconds).

**Credentials:**

| User | Password | Mechanism | Role |
|---|---|---|---|
| `admin` | `admin-secret` | SCRAM-SHA-256 | Superuser |
| `redfireforge-app` | `app-password` | SCRAM-SHA-256 | Application (ACLs on all topics/groups) |

**Pre-created topics:** `redfireforge.debug.consume` (3 partitions), `redfireforge.results.summary` (3 partitions)

Ensure the local server is running: `npm run server`

---

### Part A — Create and Connect a SCRAM-SHA-256 Cluster

**Steps:**
1. Navigate to **Settings → Kafka**
2. Click **"+ New"** to open the cluster creation form
3. Set **Cluster Name** to `Secure Dev (SCRAM)`
4. Set broker to `127.0.0.1:19093` (the secure broker port)
5. In **Authentication**, select **SCRAM-SHA-256** from the dropdown
6. In the **Username** field, type `redfireforge-app`
7. In the **Password** field, type `app-password`
8. Leave **TLS / SSL** unchecked (the secure Docker profile uses SASL without TLS encryption)
9. Click **Save Cluster**
10. Select the newly created cluster
11. Click **Connect**

**Expected:**
- ☐ When SCRAM-SHA-256 is selected, Username and Password fields appear immediately
- ☐ After save, the cluster card appears in the list
- ☐ Clicking Connect → status transitions: **Idle → testing → Connected**
- ☐ Status text shows **"Connected to secure-dev-scram"** (or the generated cluster ID)
- ☐ **Connected** badge appears (green) on the cluster card
- ☐ AppHeader Kafka pill shows **"Connected"**
- ☐ No auth error — the SCRAM-SHA-256 handshake succeeds

---

### Part B — List Topics on Secure Broker

**Steps:**
1. After connecting (Part A), observe the Topic Explorer panel on the right

**Expected:**
- ☐ Topics load successfully — at least `redfireforge.debug.consume` and `redfireforge.results.summary` are visible
- ☐ The Topic Explorer shows the same columns (Name, Partitions) as the plaintext broker
- ☐ No authentication errors appear in the topic list

---

### Part C — Produce a Message via Message Studio

**Steps:**
1. Navigate to **Protocols → Kafka → Publish** tab
2. Set **Topic** to `redfireforge.debug.consume`
3. Set **Key** to `scram-test-key`
4. Add a header: key = `source`, value = `scram-manual-test`
5. Set body to:
   ```json
   {"test": "scram-auth", "from": "manual-ui-test", "timestamp": "now"}
   ```
6. Click **"Send Once"**

**Expected:**
- ☐ Send succeeds — green result block: **"✓ Sent 1 message to redfireforge.debug.consume"**
- ☐ Result shows partition number and offset
- ☐ No auth error — SCRAM credentials are passed through to the broker by the server

---

### Part D — Consume the Message Back

**Steps:**
1. Switch to **Protocols → Kafka → Consume** tab
2. Set **Topic** to `redfireforge.debug.consume`
3. Set **Start Position** to **Earliest**
4. Set **Key Match** to `scram-test-key` (to filter for our specific message)
5. Click **"Consume Once"**

**Expected:**
- ☐ At least 1 message appears in the results table
- ☐ The message has key `scram-test-key` and body containing `"test": "scram-auth"`
- ☐ Click the row → detail pane shows headers including `source: scram-manual-test`
- ☐ The full produce → consume round-trip works through SASL/SCRAM authentication

---

### Part E — Invalid Credentials → Auth Error

**Steps:**
1. Click **Disconnect** on the secure cluster
2. Click **Edit** on the `Secure Dev (SCRAM)` cluster
3. Change the **Password** to `wrong-password`
4. Click **Save Cluster**
5. Click **Connect**

**Expected:**
- ☐ Connection fails — error banner appears
- ☐ Error code: **"KAFKA_AUTH_FAILED"** (or similar auth-specific error)
- ☐ Error message clearly indicates an **authentication failure** — NOT a generic network/timeout error
- ☐ Advisory text mentions verifying credentials

**Clean up:** Edit the cluster back to the correct password (`app-password`) or delete it.

---

### Part F — Disconnect

**Steps:**
1. If connected, click **Disconnect**

**Expected:**
- ☐ Clean disconnect — badge reverts to **Idle**
- ☐ No lingering errors

### Docker Clean Up

```bash
cd docker/kafka/secure && docker compose down
```

---

## SC-24 — SASL/SCRAM End-to-End via Tauri Native Transport (Desktop)

> **Purpose:** Verify the same SASL/SCRAM-SHA-256 lifecycle (connect → topics → produce → consume → disconnect) works through the **Tauri native rdkafka transport** on the desktop app. This ensures TLS/auth parity between the web server-proxy path and the native desktop path.

### Prerequisites

- Secure Docker broker running (same as SC-23): `cd docker/kafka/secure && docker compose up -d`
- Tauri desktop app built and running: `npm run tauri:dev`
- The desktop app does **not** need the `npm run server` backend — it connects directly to Kafka via the Rust rdkafka library

---

### Part A — Create and Connect a SCRAM-SHA-256 Cluster in Tauri

**Steps:**
1. In the Tauri desktop window, navigate to **Settings → Kafka**
2. Click **"+ New"** to open the cluster creation form
3. Set **Cluster Name** to `Secure Dev Tauri`
4. Set broker to `127.0.0.1:19093`
5. In **Authentication**, select **SCRAM-SHA-256**
6. Set **Username** to `redfireforge-app`, **Password** to `app-password`
7. Leave TLS / SSL unchecked
8. Click **Save Cluster** → select the cluster → click **Connect**

**Expected:**
- ☐ Connection succeeds via native rdkafka transport — **Connected** badge appears
- ☐ No "server not reachable" error — Tauri connects directly, no server-proxy needed
- ☐ AppHeader pill shows **"Connected"**

---

### Part B — Topics and Produce via Tauri

**Steps:**
1. Navigate to **Protocols → Kafka → Topics** tab
2. Observe topic list
3. Switch to **Publish** tab
4. Set Topic to `redfireforge.debug.consume`, Key to `tauri-scram-key`
5. Set body to `{"test": "tauri-scram", "transport": "native"}`
6. Click **"Send Once"**

**Expected:**
- ☐ Topics load (same topics as SC-23 Part B)
- ☐ Produce succeeds with partition/offset result
- ☐ No auth errors — the native Rust SCRAM handshake works

---

### Part C — Consume via Tauri

**Steps:**
1. Switch to **Consume** tab
2. Set Topic to `redfireforge.debug.consume`, Start Position to **Earliest**, Key Match to `tauri-scram-key`
3. Click **"Consume Once"**

**Expected:**
- ☐ Message with key `tauri-scram-key` appears in results
- ☐ Body contains `"transport": "native"` confirming the Tauri round-trip
- ☐ Full produce → consume lifecycle works through native SCRAM-SHA-256

---

### Part D — Invalid Credentials in Tauri

**Steps:**
1. Disconnect → Edit the cluster → change Password to `wrong-password` → Save → Connect

**Expected:**
- ☐ Connection fails with an **auth failure error** — same user-facing message as SC-23 Part E
- ☐ Error classification matches the web server-proxy path (not a generic timeout)

---

### Part E — Cross-Transport Parity Check

**Steps:**
1. Fix the password back to `app-password` in the Tauri app
2. Connect and produce a message with key `tauri-cross-check`
3. Open the **web browser** app (http://localhost:5173) with the server running
4. Connect to the same secure broker in the web UI (SC-23 cluster or create a new one)
5. Consume with Key Match `tauri-cross-check`

**Expected:**
- ☐ The message produced via Tauri native transport is **visible** when consumed via the web server-proxy transport
- ☐ Message content, key, headers are identical — transport is transparent to the data

**Clean up:** Disconnect in both apps. Stop the secure broker: `cd docker/kafka/secure && docker compose down`

