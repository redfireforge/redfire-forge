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

These scenarios require a running Redpanda broker. Start it once before running the suite.

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
- ☐ Subtitle below that heading: *"Configure broker profiles, manage connections, and browse live topics from one place."*
- ☐ Left panel heading **"Clusters"**, subtitle *"Multiple saved profiles · fast switch · live health"*, and a **Disconnected** badge pill in the top-right corner
- ☐ Body: paragraph **"No clusters configured yet"**, helper text *"Add your first Kafka cluster to enable topic browsing and workflow integration."*, and a blue **"Create First Cluster"** button
- ☐ Below the empty-state card: a "Disconnected" status label, and five action buttons — **Test Connection / Connect / Disconnect / Refresh Status / Clear Error** — all **disabled** (greyed out)
- ☐ **Auto-connect** checkbox *"Auto-connect the selected cluster on startup"* is visible (unchecked by default)
- ☐ Right panel heading: **"Create Cluster"**, placeholder text (italic): *"Select a saved cluster and click Edit, or click New Cluster to start configuring one."*
- ☐ The overall Clusters panel badge changes to **disconnected** (once status can be checked)
- ☐ Topic Explorer placeholder (when cluster selected but not connected): *"Connect the selected cluster to browse topics and verify startup restoration behavior."*
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

**Steps:**
1. After connecting (SC-08), scroll down to **Topic Explorer**
2. Observe the topic list

**Expected:**
- ☐ Topic Explorer heading shows `Kafka / Topics` and the selected cluster name
- ☐ Topics table shows columns: **Topic**, **Partitions**, **Type**
- ☐ At minimum, the topic `redfireforge.results.summary` appears with type **App** and **1** partition
- ☐ A status line shows `1 of 1 topic shown` and `Internal topics hidden`
- ☐ Domain filter chips appear: **"All Topics"** and **"redfireforge"**
- ☐ **"Include internal topics"** checkbox is enabled and unchecked by default
- ☐ Checking **"Include internal topics"** immediately adds `__consumer_offsets` to the list (type **Internal**, **3** partitions) — status line changes to `2 of 2 topics shown` and `Including internal topics`
- ☐ Unchecking it again hides `__consumer_offsets` and restores the original count

---

## SC-11 — Search / Filter Topics

**Prerequisites:** SC-10 complete (topics visible)

**Steps:**
1. In the Topic Explorer search box (placeholder: "Search topics, prefixes, domains, tags"), type `debug`
2. Observe the list
3. Clear the search box
4. If domain chips are visible (e.g., "all", "redfireforge"), click a non-"all" chip

**Expected:**
- ☐ Typing `results` (or `redfireforge`) filters the list to show only matching topics
- ☐ Clearing the search restores the full list
- ☐ Clicking the **"redfireforge"** domain chip filters to only topics with the `redfireforge` prefix (e.g., `redfireforge.results.summary`)
- ☐ Clicking **"All Topics"** restores all topics
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
- ☐ Topic Explorer search box goes back to disabled, **Refresh Topics** disabled
- ☐ Topic list is replaced by the placeholder: *"Connect the selected cluster to browse topics and verify startup restoration behavior."*

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
- ☐ The Topic Explorer breadcrumb immediately changes to "Cluster: Production Mirror" and shows the placeholder: *"Connect the selected cluster to browse topics..."* (not connected)
- ☐ Clicking the **Local Dev (Redpanda)** card:
  - Switches selection: "Selected: Local Dev (Redpanda)"
  - Topic Explorer breadcrumb changes to "Cluster: Local Dev (Redpanda)"
  - If Local Dev was previously connected, topics re-appear (the backend connection persists in-session)
- ☐ Clicking **Production Mirror** again:
  - Switches selection back; Topic Explorer shows placeholder (Production Mirror is not connected)
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
- ☐ Topics load automatically in the Topic Explorer
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

