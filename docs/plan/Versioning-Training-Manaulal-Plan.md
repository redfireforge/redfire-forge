# Versioning Training Manuals — Plan

## Overview

The Versioning subsystem spans **7 phases** (all implemented, 375+ unit tests) covering version history, diffing, restore, export/import, and audit logging across 6 entity types. This training manual suite provides comprehensive coverage from beginner walkthroughs to advanced cross-feature scenarios.

**Every manual uses existing Gallery samples as starting points.** Rather than asking users to build from scratch, each walkthrough imports a Gallery sample (Request, Test, Workflow, or Catalog) and then demonstrates versioning features on it. This ensures:
- All API endpoints are real, public, and working
- Examples are consistent across training manuals
- Users can reproduce any walkthrough by importing from the Gallery

---

## Public APIs Used (All Working, No Auth Required)

All training manual examples use these verified public APIs — the same ones already used by Gallery samples:

| API | Base URL | Used For | Gallery Samples Using It |
|-----|----------|----------|--------------------------|
| **JSONPlaceholder** | `https://jsonplaceholder.typicode.com` | CRUD operations (posts, users, comments, todos) | 8 request samples, 15+ workflow samples, 3 test samples |
| **PokéAPI** | `https://pokeapi.co/api/v2` | Deeply nested JSON, contract testing | 2 request samples, 2 workflow samples, 1 test sample |
| **REST Countries** | `https://restcountries.com/v3.1` | Search/filter, rich data | 1 request sample, 1 workflow sample, 1 test sample |
| **DummyJSON** | `https://dummyjson.com` | Auth flows, pagination, e-commerce data | 3 request samples, 4 test samples |
| **Dog CEO** | `https://dog.ceo/api` | Simple hello-world API, image URLs | 1 request sample |
| **Open Library** | `https://openlibrary.org` | Large payloads, real search | 1 request sample, 1 workflow sample |

> **Rule:** No private/mock APIs. Every URL in every training manual must return a real response when called. Training manuals reference Gallery sample IDs so users can import the exact starting configuration.

---

## Gallery Integration Strategy

### How Versioning Samples Fit in the Gallery

Versioning training manuals do **NOT** get their own Gallery domain. Instead, they leverage **existing Gallery samples** across all 5 domains as starting points:

> **Discoverability:** All 10 Gallery samples used by versioning manuals are tagged with `versioning-tutorial`. Users can filter by this tag in the Gallery's **Tag** dropdown, or simply type "versioning" in the search bar to find all relevant samples instantly.

| Training Manual | Gallery Sample Used as Starting Point | Gallery Domain | Sample ID |
|-----------------|--------------------------------------|----------------|-----------|
| Workflow Easy | Create → Extract → Verify | Workflows | `sample-workflow-001` |
| Workflow Diff | Webhook Trigger (then evolve) | Workflows | `sample-workflow-webhook` |
| Workflow Advanced | Sub-Workflow Orchestrator (complex, 9 nodes) | Workflows | `sample-workflow-sub-workflow` |
| Test Easy | User API Smoke Test (3 scenarios) | Tests | `test-user-api-smoke` |
| Test Diff | E-Commerce Full Suite (6 scenarios) | Tests | `test-ecommerce-full` |
| Baselines Easy | Product Listing Check (run multiple times) | Tests | `test-product-listing` |
| Baselines Comparison | Auth Flow Validation (compare runs) | Tests | `test-auth-flow` |
| Request Easy | Get All Users (iterate configuration) | Requests | `req-get-all-users` |
| Request Diff | Create a New Post (evolve GET→POST) | Requests | `req-create-post` |
| Audit Easy | *(No sample — uses Settings → Environments directly)* | — | — |
| Audit Export | *(No sample — uses Settings → Environments directly)* | — | — |
| FG Easy | User API Smoke Test (restructure the FG) | Tests | `test-user-api-smoke` |
| FG Medium | Country Search Suite (sprint evolution) | Tests | `test-country-search` |
| Script Easy | *(Script Library — created in workflow editor)* | — | — |
| Script Impact | *(Script Library — referenced by multiple workflows)* | — | — |
| Cross-Feature | Combines: E-Commerce Full Suite + Webhook Trigger + Get All Users | Multiple | Multiple |

### Training Manual → Gallery Walkthrough Pattern

Every training manual that uses a Gallery sample follows this consistent pattern:

```
Step 1 — Open the Gallery
  Open the Gallery from the sidebar. Navigate to the [Requests/Tests/Workflows] tab.

Step 2 — Import the Sample
  Find "[Sample Name]" (ID: sample-id). Click "Import" to load it into your workspace.
  
Step 3 — Verify the Sample Works
  [For requests] Click Send. Verify status 200/201.
  [For tests] Run the test suite. Verify all assertions pass.
  [For workflows] Click Run. Verify the workflow completes successfully.

Step 4 — Begin Versioning Walkthrough
  Now that you have a working [request/test/workflow], let's explore versioning...
```

This ensures every user starts from the same known-good state.

### Existing Gallery Samples — Public API Verification

Each Gallery sample already uses working public APIs. The versioning manuals reference these exact configurations:

**Workflow Samples (jsonplaceholder.typicode.com):**
- `sample-workflow-001`: Create Post → Check Status → Delay → Get Post → Verify User
- `sample-workflow-webhook`: Webhook → Check Inventory → Process Order / Alert
- `sample-workflow-sub-workflow`: Fetch Users → Set Variables → Sub-Workflow → Log → Condition

**Test Samples:**
- `test-user-api-smoke`: GET /users, GET /users/1, GET /users/1/posts (jsonplaceholder)
- `test-product-listing`: GET /products, GET /products/1 (dummyjson.com)
- `test-ecommerce-full`: products, search, categories, cart, users (dummyjson.com)
- `test-auth-flow`: POST /auth/login, GET /auth/me (dummyjson.com)
- `test-country-search`: /v3.1/name/germany, /v3.1/alpha/DEU, /v3.1/region/europe (restcountries.com)

**Request Samples:**
- `req-get-all-users`: GET /users (jsonplaceholder)
- `req-create-post`: POST /posts with JSON body (jsonplaceholder)
- `req-get-pokemon`: GET /api/v2/pokemon/pikachu (pokeapi.co)
- `req-search-countries`: GET /v3.1/name/germany (restcountries.com)

---

## Directory Structure

```
docs/training-manuals/versioning/
  versioning.html                                       ← Master overview (all 7 phases, architecture, concepts)
  workflow/
    workflow-version-history-easy.html                   ← V-Phase 1: Basic workflow snapshots & restore
    workflow-version-diff-medium.html                    ← V-Phase 1: Multi-tab diff (Nodes/Edges/Variables/Services)
    workflow-version-advanced.html                       ← V-Phase 1: Bulk operations, export/import, undo persistence
  test/
    test-definition-history-easy.html                    ← V-Phase 2: Test versioning basics
    test-definition-diff-medium.html                     ← V-Phase 2: 5-tab diff, selective restore
    run-baselines-easy.html                              ← V-Phase 4: Creating baselines from runs
    run-baselines-comparison-medium.html                 ← V-Phase 4: Trend charts, regression detection
  request/
    request-definition-history-easy.html                 ← V-Phase 5: Request versioning basics
    request-definition-diff-medium.html                  ← V-Phase 5: 4-tab diff (Overview/Headers/Body/Auth)
  catalog/
    environment-audit-log-easy.html                      ← V-Phase 3: Viewing audit entries, filtering
    environment-audit-export-medium.html                 ← V-Phase 3: JSON/CSV export, 500-entry management
    feature-group-history-easy.html                      ← V-Phase 6: Per-feature-group changelog
    feature-group-history-medium.html                    ← V-Phase 6: Structure comparison, restore operations
  advanced/
    script-library-versioning-easy.html                  ← V-Phase 7: Script snapshots & restore
    script-library-impact-medium.html                    ← V-Phase 7: Impact analysis (which workflows use this?)
  cross-entity/
    cross-feature-versioning-advanced.html               ← Cross-cutting: Version strategies across all entity types
```

**Total: 17 manuals** (1 overview + 16 feature manuals)

---

## Manual Descriptions

### 1. `versioning.html` — Master Overview
- **Purpose:** Umbrella guide — introduces the versioning architecture, common UI patterns, and links to all sub-manuals
- **Covers:**
  - What gets versioned (6 entity types: Workflow, Test Definition, Request Definition, Script Library, Environment/Service Audit, Run Baselines)
  - Fingerprinting & automatic snapshot triggers — cyrb53 hash for workflows, canonical JSON for tests/requests/scripts
  - Max version limits per entity type (Workflow: 30, Test: 20, Request: 15, Script: 15, Audit: 500, Baselines: 10)
  - Common UI patterns: Version Panel → Diff Modal → Restore → Export
  - Shared concepts: fingerprint deduplication, auto-save vs manual save, inline rename, FIFO eviction
  - Version data storage (localStorage / Tauri store persistence)
  - Undo/redo integration with version history
  - Quick-reference table mapping entity → phase → max versions → diff tabs
  - Export/import version data: `VersionExportOptions` (4 checkboxes: responseVersions, rulesVersions, definitionVersions, structureLog)
- **Architecture diagram:** Show the data flow from user action → fingerprint check → snapshot → version list → diff/restore
- **Reference table:**

| Entity | Max | Fingerprint | Auto-Save | Diff Tabs | Restore | Export |
|--------|-----|-------------|-----------|-----------|---------|--------|
| Workflow | 30 | cyrb53 | On save | Nodes, Edges, Variables, Services | Full | ✅ |
| Test Definition | 20 | Canonical JSON | On change | Overview, Headers, Body, Auth, Extractions | Full | ✅ |
| Request Definition | 15 | Canonical JSON | On change | Overview, Headers, Body, Auth | Partial patch | ✅ |
| Script Library | 15 | Canonical JSON | On edit | Overview, Code | Full | ✅ |
| Audit Log | 500 | — | Automatic | Inline old→new | N/A | JSON/CSV |
| Run Baselines | 10 | — | Manual mark | Metric + Scenario deltas | No | ✅ |

---

### 2. `workflow-version-history-easy.html` — Workflow Snapshots (Easy)
- **Phase:** V-Phase 1
- **Prerequisites:** Basic workflow editor familiarity
- **Gallery Starting Sample:** `sample-workflow-001` — "Create → Extract → Verify" (Workflows tab)
- **Real-world scenario:** *"Evolving an Order Processing Workflow"*
  - Import the "Create → Extract → Verify" sample from the Gallery (6 nodes using `jsonplaceholder.typicode.com/posts`)
  - The workflow already works: Create Post → Check Status (201?) → Delay → Get Post → Verify User
  - Evolve it: add a notification node, change variables, rewire edges — observe version snapshots
- **Step-by-step walkthrough:**
  1. **Import the sample** — Open Gallery → Workflows → find "Create → Extract → Verify" (`sample-workflow-001`). Click "Import". The workflow loads into the editor with 6 nodes.
  2. **Verify it works** — Click Run. The workflow executes: creates a post on JSONPlaceholder, checks status 201, waits 1s, fetches post details, verifies userId. All green.
  3. **Save the workflow** — Click Save. Observe the first version is automatically created (toolbar badge shows "1"). The `computeWorkflowFingerprint()` function hashes nodes/edges/variables/services via cyrb53.
  4. **Make changes** — Add a 7th node: `HTTP Request (Send Notification)` pointing to `https://jsonplaceholder.typicode.com/posts` with POST body: `{"title": "Order Complete", "body": "Post {{postId}} verified", "userId": 1}`. Connect it after the Verify node.
  5. **Save again** — Version count increments to 2. The fingerprint differs from version 1 (new node + new edge).
  6. **Open Version History** — Click the clock/history icon in the toolbar. The `WorkflowVersionPanel` slides in showing 2 entries with timestamps.
  7. **Browse versions** — Each entry shows: timestamp, auto-generated label, node count (6 vs 7), edge count. Hover to see fingerprint.
  8. **Restore version 1** — Click "Restore" on the first version. The workflow reverts to the original 6-node state. The notification node disappears.
  9. **Verify undo safety** — Before restoring, the system automatically takes an undo snapshot. Press Ctrl+Z to undo the restore if needed.
  10. **Rename a version** — Double-click the version label → type "Original Gallery Sample" → press Enter.
- **Key concepts:** Auto-save triggers on explicit save, 30-version cap with FIFO eviction, fingerprint dedup prevents duplicate snapshots, undo snapshot before restore
- **Exercises:**
  1. Make 5 more changes and saves. Verify the version list grows to 7 entries (newest first).
  2. Make a change but DON'T actually change any nodes/edges/variables — just click Save. Does a new version appear? (No — fingerprint dedup)
  3. Close and reopen the browser tab. Are versions still there? (Yes — localStorage persistence)

### 3. `workflow-version-diff-medium.html` — Multi-Tab Diff (Medium)
- **Phase:** V-Phase 1
- **Prerequisites:** workflow-version-history-easy
- **Gallery Starting Sample:** `sample-workflow-webhook` — "Webhook Trigger" (Workflows tab)
- **Real-world scenario:** *"Webhook Order Processing — Adding Fraud Detection"*
  - Import the "Webhook Trigger" sample (6 nodes: Webhook → Check Inventory → Condition → Process Order / Out of Stock Alert → End)
  - This workflow uses `jsonplaceholder.typicode.com` for inventory checks and order processing
  - Evolve it: add a fraud detection script node, new variables, reroute edges
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Workflows → "Webhook Trigger" (`sample-workflow-webhook`). Import. Save immediately to create Version 1.
  2. **Evolve the workflow** — Add a `Script Node (Fraud Score Check)` between "Check Inventory" and the condition. Add variable `{{fraudThreshold}}` = `85`. Remove the direct edge from inventory→condition, add edges inventory→fraud→condition. Save (Version 2).
  3. **Open Version History** — Two versions visible.
  4. **Select two versions** — Check the checkbox on Version 1 and Version 2. The "Compare" button activates.
  5. **Open Diff Modal** — Click "Compare". The `WorkflowVersionDiff` modal opens with 4 tabs.
  6. **Nodes Tab** — Shows: 1 node added (Fraud Score Check) in green. The existing 6 nodes shown in gray (unchanged). Click the added node to see its config details.
  7. **Edges Tab** — Shows: 1 edge removed (inventory→condition) in red, 2 edges added (inventory→fraud, fraud→condition) in green.
  8. **Variables Tab** — Shows: `fraudThreshold` added (green) with value `85`. Original webhook variables (`orderId`, `customerId`, `totalAmount`) unchanged.
  9. **Services Tab** — No service changes (all still using `jsonplaceholder.typicode.com`).
  10. **Interpret indicators** — Green = added, Red = removed, Yellow = modified. Each modified node expands to show property-level json-diff-kit comparison.
- **Key concepts:** Multi-select comparison (max 2 checkboxes), tab-based structural diff, change categorization (added/removed/modified), per-node config diff using json-diff-kit, diff indicators color coding
- **Exercises:**
  1. Modify an existing node's URL (don't add/remove nodes). Compare versions — the node should appear in the "Modified" section with property-level diff showing old URL → new URL.
  2. Change a variable's value (not name). Verify the Variables tab shows it as "modified" with old→new values.
  3. Try comparing version 1 with version 1 — the diff should show zero changes across all tabs.

### 4. `workflow-version-advanced.html` — Bulk Operations & Export (Advanced)
- **Phase:** V-Phase 1
- **Prerequisites:** workflow-version-diff-medium
- **Gallery Starting Sample:** `sample-workflow-sub-workflow` — "Sub-Workflow Orchestrator" (Workflows tab)
- **Real-world scenario:** *"Complex Orchestrator — Long-lived Version Management"*
  - Import the "Sub-Workflow Orchestrator" sample (9 nodes: Fetch Users → Set Variables → Sub-Workflow → Log → Condition → Success/Failure → End)
  - This is one of the most complex Gallery workflows — ideal for demonstrating version cap management
  - Simulate iterative development: 10+ versions spanning node additions, variable tuning, retry config changes
- **Step-by-step walkthrough:**
  1. **Build complex workflow** — Create 12-node CI/CD pipeline. Save after each major change (add nodes, configure, wire). Accumulate 10+ versions.
  2. **Review version timeline** — Open Version History. Scroll through all versions. Identify the "before staging deploy" version by reading change summaries (e.g., "2 nodes added, 1 variable changed").
  3. **Rename key versions** — Double-click labels to name milestones: "MVP Pipeline", "Added Staging", "Prod Ready", "Post Hotfix".
  4. **Bulk delete old versions** — Select 5+ checkboxes on older versions. Click "Delete Selected". Confirm. Version count drops.
  5. **Export version history** — Click "Export" in the Version Panel. The entire version history (all snapshots) is included in the exported JSON. Inspect the file: `workflow.versions[]` array with full node/edge/variable/service snapshots per version.
  6. **Import into new workflow** — Create a new empty workflow. Import the exported file. Toggle the "Include Version History" checkbox. Verify all named versions appear.
  7. **Observe 30-version cap** — Make rapid saves to push past 30. The oldest (first) version is automatically evicted (FIFO). Named/renamed versions are NOT exempt from eviction.
  8. **Undo persistence** — Make changes → Ctrl+Z works across page refreshes. The undo stack (last 10 snapshots) persists in localStorage key `perf-test-wf-undo-{workflowId}`. Debounced at 500ms to prevent excessive writes.
  9. **Cross-session restore** — Close the browser. Reopen. Open the workflow. Version history is intact. Undo stack is intact. Restore a version from 3 sessions ago.
- **Key concepts:** Bulk selection and deletion, export/import with version data (`stripWorkflowVersions()` / `countWorkflowVersions()`), 30-version FIFO cap rotation, undo persistence across sessions (localStorage, debounced 500ms), version naming as documentation
- **Exercises:**
  1. Export a workflow with 10 versions. Import it with "Include Version History" unchecked. Verify zero versions appear in the new workflow.
  2. Export the same workflow. Open the JSON file. Count the `versions` array length. Does it match the panel count?
  3. Create a workflow, save it once, undo with Ctrl+Z, then press Ctrl+Y to redo. Verify the workflow state matches the saved version exactly.

---

### 5. `test-definition-history-easy.html` — Test Versioning Basics (Easy)
- **Phase:** V-Phase 2
- **Prerequisites:** Basic test editor familiarity
- **Gallery Starting Sample:** `test-user-api-smoke` — "User API Smoke Test" (Tests tab)
- **Real-world scenario:** *"User API Smoke Test — Iterative Refinement"*
  - Import the "User API Smoke Test" from the Gallery (3 scenarios against `jsonplaceholder.typicode.com`: list users, get one, fetch posts)
  - Iteratively refine: add headers, change assertions, modify URL paths, add extractions
  - Each modification auto-creates a version snapshot
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Tests → "User API Smoke Test" (`test-user-api-smoke`). Import. It creates a FeatureGroup with 3 scenarios.
  2. **Open a test** — Open "Get All Users" scenario (GET `https://jsonplaceholder.typicode.com/users`). This is already configured with status 200 assertion and arrayLength = 10.
  3. **Save the test** — First version auto-created. The test's `definitionVersions[]` array now has 1 entry.
  4. **Modify headers** — Add `Accept: application/json` header. Save. Version 2 created. Change summary: "1 header added".
  5. **Modify URL** — Change to `https://jsonplaceholder.typicode.com/users/1` (single user). Save. Version 3. Change summary: "URL changed".
  6. **Add extractions** — Add extraction: `$.email` → `userEmail`. Save. Version 4 created. Change summary: "1 extraction added".
  7. **Open History tab** — In the Test Editor modal, click the "History" tab. Badge shows "4". List shows all versions newest-first.
  8. **Verify restored state** — Headers tab: empty. Auth tab: None. Extractions: empty. URL unchanged.
  9. **Rename versions** — Name version 4 "Final with extractions" and version 1 "Initial bare test".
- **Key concepts:** 20-version limit with FIFO eviction, test definition fingerprinting via canonical JSON (sorted keys), auto-save on meaningful changes (no-op if identical), History tab badge count, change summary auto-generation
- **Data model reference:**
  ```typescript
  interface TestDefinitionVersion {
    id: string;
    timestamp: number;
    label?: string;
    changeSummary?: string; // "URL changed, 2 headers added"
    snapshot: Omit<Scenario, 'id' | 'validation'>;
  }
  ```
- **Exercises:**
  1. Save the test without making any changes. Does a new version appear? (No — fingerprint dedup via canonical JSON prevents duplicates.)
  2. Change only the URL path from `/users/1` to `/users/2`. Save. What does the change summary say? ("URL changed")
  3. Reach the 20-version cap. Make one more change. Verify the oldest version was evicted.

### 6. `test-definition-diff-medium.html` — 5-Tab Diff (Medium)
- **Phase:** V-Phase 2
- **Prerequisites:** test-definition-history-easy
- **Gallery Starting Sample:** `test-ecommerce-full` — "E-Commerce Full Suite" (Tests tab)
- **Real-world scenario:** *"E-Commerce Test Suite — Comprehensive Configuration Evolution"*
  - Import the "E-Commerce Full Suite" (6 scenarios against `dummyjson.com`: products, search, categories, cart, users)
  - Pick one scenario and evolve: change method from GET to POST, add JSON body with search filters, add auth, add extractions
  - Compare the original vs evolved version across all 5 diff tabs
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Tests → "E-Commerce Full Suite" (`test-ecommerce-full`). Import. Creates a FeatureGroup with 6 scenarios targeting `dummyjson.com`.
  2. **Open "Search Products" scenario** — This is a GET request to `https://dummyjson.com/products/search?q=phone`. Save to create Version A.
  3. **Open History** — Two versions. Check both checkboxes. Click "Compare".
  4. **Overview Tab** — Shows: name unchanged, URL changed (with old→new), method changed (GET→POST), body type changed (none→json).
  5. **Headers Tab** — Shows header-level diff. `Accept: application/json` unchanged (gray). Any new headers in green.
  6. **Body Tab** — Shows: Version A had no body (empty), Version B has full JSON body. The entire body appears as "added" (green). Uses json-diff-kit for structured comparison.
  7. **Auth Tab** — Shows: Version A had no auth, Version B has Bearer Token. Auth type transition displayed with old→new values.
  8. **Extractions Tab** — Shows: 1 extraction added (`$[0].id → firstPostId`) in green. Extractions listed with JSONPath and variable name.
  9. **Tab badges** — Each tab shows a change count badge (e.g., "Headers (0)", "Body (1)", "Auth (1)", "Extractions (1)"). Tabs with changes are highlighted.
- **Key concepts:** `SnapshotDiffResult` with field-level granularity (nameChanged, urlChanged, methodChanged, headersAdded/Removed/Modified, bodyChanged, authChanged, extractionsAdded/Removed/Modified), 5-tab diff modal (`TestDefinitionVersionDiff.tsx`), json-diff-kit for structured body comparison, `VersionCheckboxGroup` for export/import with 3 checkboxes
- **Exercises:**
  1. Add 3 headers to a test, then remove 2 and modify 1. Compare versions. Verify the Headers tab shows: 2 removed (red), 1 modified (yellow), 0 added.
  2. Change only the auth token value (keep type as Bearer). Does the Auth tab show a change? (Yes — the token value differs.)
  3. Export the test with "Include Definition Versions" checked. Import into another scenario. Verify version history travels with the test.

---

### 7. `environment-audit-log-easy.html` — Audit Log Basics (Easy)
- **Phase:** V-Phase 3
- **Prerequisites:** Environment/Service configuration familiarity
- **Real-world scenario:** *"Multi-Environment Setup — Tracking Configuration Changes"*
  - Create 3 environments: `dev`, `staging`, `production`
  - Create 2 microservices: `user-service`, `order-service`
  - Configure different base URLs per environment
  - Create auth profiles: "Dev API Key", "Prod OAuth Token"
  - Track all changes in the audit log
- **Step-by-step walkthrough:**
  1. **Create environments** — Navigate to Settings → Environments. Create `dev`, `staging`, `production`. Each creation is auto-logged.
  2. **Create microservices** — Add `user-service` (dev URL: `http://localhost:3001`, staging: `https://staging.api.example.com/users`, prod: `https://api.example.com/users`). Each URL assignment is logged.
  3. **Create auth profiles** — Add "Dev API Key" (API Key type) and "Prod OAuth Token" (OAuth2 type). Each creation is logged.
  4. **Open Audit Log** — Navigate to Settings → Preferences → Audit Log panel. See a chronological list of all changes.
  5. **Browse entries** — Each entry shows: timestamp, action icon (+/~/×/→), entity type badge (Environment/Microservice/AuthProfile), entity name, action description.
  6. **Filter by entity type** — Use the dropdown to show only "Microservice" entries. The list narrows to service-related changes.
  7. **Filter by action** — Switch filter to "Created" to see only creation events. Then "Updated" for modifications.
  8. **Search** — Type "user-service" in the search bar. Only entries mentioning `user-service` appear.
  9. **Inspect field-level changes** — Click on an "Updated" entry for `user-service`. See inline diff: `baseUrl: "http://localhost:3001" → "http://localhost:3002"`. The `computeChanges()` function detects per-field old→new.
- **Key concepts:** 500-entry cap (FIFO eviction), automatic logging via convenience loggers (`logEnvironmentCreated`, `logMicroserviceUpdated`, etc.), entity types: `environment`, `microservice`, `authProfile`, actions: `created`, `updated`, `deleted`, `renamed`, field-level change detection via `computeChanges(oldObj, newObj, fields?)`
- **Data model reference:**
  ```typescript
  interface AuditEntry {
    id: string;
    timestamp: number;
    entityType: 'environment' | 'microservice' | 'authProfile';
    entityId: string;
    entityName: string;
    action: 'created' | 'updated' | 'deleted' | 'renamed';
    changes?: AuditChange[]; // field-level diffs
  }
  interface AuditChange {
    field: string;
    oldValue: any;
    newValue: any;
  }
  ```
- **Exercises:**
  1. Rename an environment from `dev` to `development`. Check the audit log — what action type is recorded? ("renamed")
  2. Delete a microservice. Verify the deletion event appears with action "deleted".
  3. Make 10 rapid changes. Verify they all appear in order (newest first).

### 8. `environment-audit-export-medium.html` — Export & Management (Medium)
- **Phase:** V-Phase 3
- **Prerequisites:** environment-audit-log-easy
- **Real-world scenario:** *"Sprint Retrospective — Exporting Configuration Change History"*
  - A team has been modifying environments and services over a 2-week sprint
  - Before the retrospective, export the audit log to share with the team
  - Use CSV for spreadsheet analysis, JSON for programmatic review
  - Demonstrate 500-entry rotation and log management
- **Step-by-step walkthrough:**
  1. **Accumulate entries** — Make 20+ environment/service changes across different entity types. Rename services, change URLs, create/delete auth profiles.
  2. **Export to JSON** — Click "Export JSON". A file downloads with all audit entries. Inspect schema: array of `AuditEntry` objects with `entityType`, `action`, `changes[]`.
  3. **Export to CSV** — Click "Export CSV" (`auditLogToCsv()` utility). Open in Excel/Google Sheets. Columns: Timestamp, Entity Type, Entity Name, Action, Changes. Changes field shows formatted `field: oldValue → newValue`.
  4. **Analyze in spreadsheet** — Filter by entity type. Count changes per service. Identify the most-changed configuration.
  5. **Manage rotation** — With 500-entry cap, make changes until the cap is reached. Observe the oldest entry disappear when a new one is added.
  6. **Search for specific changes** — Type a service name in the search box. Filter to "Updated" actions. Review all base URL changes for that service.
  7. **Clear audit log** — Click "Clear All" with confirmation dialog. Verify the log is empty. New changes start a fresh log.
- **Key concepts:** `auditLogToCsv()` export utility, `formatAction()` and `formatEntityType()` display helpers, 500-entry FIFO rotation, search and filter combined, clear with confirmation, JSON export preserves full `AuditChange` objects
- **Exercises:**
  1. Export both JSON and CSV. Open the CSV in a spreadsheet. Verify the row count matches the JSON array length.
  2. Make exactly 500 changes (or use the JSON to see the count). Make 1 more change. Export JSON. Is the oldest entry gone?
  3. After clearing the log, create a new environment. Verify the audit log has exactly 1 entry.

---

### 9. `run-baselines-easy.html` — Creating Baselines (Easy)
- **Phase:** V-Phase 4
- **Prerequisites:** Running tests and viewing results
- **Gallery Starting Sample:** `test-product-listing` — "Product Listing Check" (Tests tab)
- **Real-world scenario:** *"API Performance Baseline — Pre-Release Benchmark"*
  - Import the "Product Listing Check" from the Gallery (2 scenarios against `dummyjson.com`: list products, get single product)
  - Run it multiple times, establish a performance baseline before a simulated API upgrade
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Tests → "Product Listing Check" (`test-product-listing`). Import. 2 scenarios targeting `dummyjson.com`.
  2. **Run the test** — Execute the test suite. Verify both scenarios pass (status 200, valid product data).
  3. **Mark as baseline** — In the results panel, click "Mark as Baseline" (`markAsBaseline()`). Provide a label: "Pre-v2.0 Release".
  4. **Verify baseline** — The run now shows a baseline badge/star icon. The `BaselineMark` stores: `{ runId, label: "Pre-v2.0 Release", markedAt }`.
  5. **Run the same test again** — Execute again. Compare the new run's metrics against the baseline.
  6. **Create multiple baselines** — Run the test 3 more times. Mark different runs as baselines with labels: "Morning Peak", "Off-Peak Hours".
  7. **Observe 10-baseline cap** — Baselines are capped at 10 per test. Mark more baselines and observe the oldest being evicted.
  8. **Unmark a baseline** — Click "Unmark Baseline" (`unmarkBaseline()`) on one of the marked runs. It reverts to a regular run.
  9. **Rename a baseline** — Double-click the label → change "Pre-v2.0 Release" to "Production Benchmark v1.9".
- **Key concepts:** `BaselineMark` lightweight index (`{ runId, label?, markedAt }`), 10-baseline cap, baselines reference runs stored in IndexedDB, `markAsBaseline()`, `unmarkBaseline()`, `renameBaseline()`, `isBaseline()` helper, baseline labeling for documentation
- **Exercises:**
  1. Mark a run as baseline, then delete that run. What happens to the baseline mark? (The mark exists but references a missing run.)
  2. Create 10 baselines. Mark an 11th. Which one is evicted?
  3. Run the same test at different times of day. Mark both as baselines with descriptive labels. Compare response times.

### 10. `run-baselines-comparison-medium.html` — Trends & Regression (Medium)
- **Phase:** V-Phase 4
- **Prerequisites:** run-baselines-easy
- **Gallery Starting Sample:** `test-auth-flow` — "Auth Flow Validation" (Tests tab)
- **Real-world scenario:** *"Post-Deployment Regression Detection — Auth API"*
  - Import the "Auth Flow Validation" from Gallery (3 scenarios against `dummyjson.com`: login success, login failure, profile fetch)
  - Establish baseline, then run multiple times to simulate post-deployment performance changes
- **Step-by-step walkthrough:**
  1. **Import and establish baseline** — Gallery → Tests → "Auth Flow Validation" (`test-auth-flow`). Import. Run. Mark as baseline "Pre-Deploy v2.0".
  2. **Run multiple times** — Execute 5 more runs to build trend data (response times will naturally vary with network conditions).
  3. **Open comparison view** — Select the baseline and a recent run. Click "Compare".
  4. **Review `RunComparison`** — The comparison shows `metricDeltas[]` for each metric:
     - **Avg Response Time**: baseline 145ms → current 275ms, delta +130ms (+89.7%), `regressed: true`
     - **P50**: baseline 150ms → current 280ms, delta +130ms (+86.7%), `regressed: true`
     - **P95**: baseline 320ms → current 520ms, delta +200ms (+62.5%), `regressed: true`
     - **Error Rate**: baseline 0.5% → current 2.3%, delta +1.8pp, `regressed: true`
     - **TPS**: baseline 45 → current 38, delta -7 (-15.6%), `regressed: true`
  5. **Scenario-level breakdown** — `scenarioDeltas[]` shows per-scenario metrics. Identify which specific test scenario regressed most.
  6. **Regression alerts** — `RegressionAlert[]` shows severity: `warning` (10-25% regression) or `critical` (>25% regression). P50 at +87% = critical.
  7. **Review thresholds** — Default thresholds: P50 ±15%, P95 ±10%, P99 ±15%, Avg ±10%, Error Rate ±1pp, TPS ±10%.
  8. **Trend over multiple runs** — View the trend chart showing response time over the last 10 runs. The spike after deployment is visually clear.
- **Key concepts:** `RunComparison` with `metricDeltas[]` and `scenarioDeltas[]`, `MetricDelta` (baseline/current/delta/deltaPercent/improved/regressed flags), `RegressionAlert` with severity levels, default regression thresholds, trend visualization, per-scenario breakdown
- **Data model reference:**
  ```typescript
  interface MetricDelta {
    metric: string;
    baselineValue: number;
    currentValue: number;
    delta: number;
    deltaPercent: number;
    improved: boolean;
    regressed: boolean;
  }
  interface RegressionAlert {
    metric: string;
    threshold: number;
    actual: number;
    severity: 'warning' | 'critical';
  }
  ```
- **Exercises:**
  1. Create a baseline and run 5 tests. Identify which run had the best and worst P95. What's the delta between them?
  2. Find a run where TPS improved but response time regressed. Is this possible? (Yes — higher throughput can increase latency under load.)
  3. Calculate the percentage thresholds that would have caught a 12% P50 regression. (Default P50 threshold is 15%, so 12% would NOT trigger an alert.)

---

### 11. `request-definition-history-easy.html` — Request Versioning (Easy)
- **Phase:** V-Phase 5
- **Prerequisites:** Request editor familiarity
- **Gallery Starting Sample:** `req-get-all-users` — "Get All Users" (Requests tab)
- **Real-world scenario:** *"REST API Development — Iterating on Request Configuration"*
  - Import "Get All Users" from the Gallery (GET `https://jsonplaceholder.typicode.com/users`, status 200 assertion, arrayLength = 10)
  - Evolve through 6 iterations: add pagination, switch to single user, add headers, add auth, change URL
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Requests → "Get All Users" (`req-get-all-users`). Click "Send Request" to import and execute. Status 200, returns 10 users.
  2. **Iteration 1** — Add query param `?_limit=5`. Save. Version 1 created. Change summary: "URL changed".
  3. **Iteration 2** — Add header `Accept: application/json`. Save. Version 2. Summary: "1 header added".
  4. **Iteration 3** — Switch to POST, add body: `{"name": "John Doe", "email": "john@example.com"}`. Save. Version 3. Summary: "method changed, body added".
  5. **Iteration 4** — Add Bearer auth with token `{{apiToken}}`. Save. Version 4. Summary: "auth type changed".
  6. **Open History sidebar** — In the Request Editor, click the "History" tab. See 4 versions with timestamps and summaries.
  7. **Restore version 1** — Click Restore on version 1. Request reverts to GET with `?_limit=10`, no auth, no body. The restore uses `restoreFromVersion()` which returns a `Partial<RequestItem>` patch.
  8. **Also explore Response Version Panel** — Save some response snapshots. The `ResponseVersionPanel` shows response body + validation rules versions (manual save).
  9. **Also explore Rules Version Panel** — Save validation rules. The `RulesVersionPanel` shows rules-only snapshots with duplicate fingerprint detection.
- **Key concepts:** 15-version limit, request fingerprinting via canonical JSON, `restoreFromVersion()` returns `Partial<RequestItem>` patch (selective restore), 3 version panels on requests: Definition History, Response Versions, Rules Versions, change summary auto-generation
- **Exercises:**
  1. Restore an old version, then restore a newer version. Verify the full round-trip preserves all fields.
  2. Save the request without changes. Verify no new version is created (fingerprint dedup).
  3. Delete a version from the middle of the list. Verify the remaining versions are intact.

### 12. `request-definition-diff-medium.html` — 4-Tab Diff (Medium)
- **Phase:** V-Phase 5
- **Prerequisites:** request-definition-history-easy
- **Gallery Starting Sample:** `req-create-post` — "Create a New Post" (Requests tab)
- **Real-world scenario:** *"API Evolution — Comparing Request Configuration Versions"*
  - Import "Create a New Post" (POST `https://jsonplaceholder.typicode.com/posts`, JSON body, Content-Type header, status 201 assertion)
  - Version A: The original imported POST request
  - Version B: Evolved to PUT with different body structure, add auth, modify headers
  - Use the 4-tab diff to understand exactly what changed
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Requests → "Create a New Post" (`req-create-post`). Import. It's already configured: POST `https://jsonplaceholder.typicode.com/posts`, body: `{"title": "My New Post", "body": "This is the content.", "userId": 1}`, header: `Content-Type: application/json`. Save as Version A.
  2. **Evolve to Version B** — Change method to PUT, URL to `/posts/1`, modify body to `{"title": "Updated Post", "body": "Changed content.", "userId": 1}`, add header `X-Request-ID: 12345`, add Bearer auth. Save.
  3. **Compare A vs B** — Open History, check both, click Compare.
  4. **Overview Tab** — URL: old → new (highlighted), Method: GET → POST (highlighted), Body Type: none → json (highlighted).
  5. **Headers Tab** — `Accept: application/json` unchanged (gray). `X-Custom: v1` removed (red). `X-Version: 2` added (green). Header count: from 2 to 2 (but different headers).
  6. **Body Tab** — Version A: empty body. Version B: full JSON body. Entire body section appears as "added" content. For two versions with different JSON bodies, json-diff-kit shows inline property-level diffs.
  7. **Auth Tab** — API Key → Bearer Token. Full auth configuration change displayed with old type/value and new type/value.
- **Key concepts:** `SnapshotDiffResult` (nameChanged, urlChanged, methodChanged, headersAdded/Removed/Modified, bodyChanged, bodyTypeChanged, authChanged, formDataChanged), 4-tab diff modal (`RequestDefinitionVersionDiff`), `deleteVersion()` and `renameVersion()` CRUD on version list
- **Exercises:**
  1. Change only a single header value (keep the same key). Verify the Headers tab shows it as "Modified" (yellow) not added/removed.
  2. Switch between form-data and JSON body types. Compare. The Body tab should show both the body type change and the content change.
  3. Export the request with "Include Definition Versions" checked. Import into a different workspace. Verify the history traveled.

---

### 13. `feature-group-history-easy.html` — FG Changelog (Easy)
- **Phase:** V-Phase 6
- **Prerequisites:** Feature group structure familiarity
- **Gallery Starting Sample:** `test-user-api-smoke` — "User API Smoke Test" (Tests tab)
- **Real-world scenario:** *"Organizing a Test Suite — Tracking Structural Changes"*
  - Import the "User API Smoke Test" (creates a Feature Group with 3 scenarios: Get All Users, Get User by ID, Get User Posts)
  - Restructure: add new tests, rename scenarios, move tests between feature groups, copy tests
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Tests → "User API Smoke Test" (`test-user-api-smoke`). Import. Creates a Feature Group with 3 scenarios targeting `jsonplaceholder.typicode.com`.
  2. **Add a test** — Add "Update User" scenario (PUT `/users/1`). The structure log records: `{ action: "scenario-added", entityName: "Update User" }`.
  3. **Rename a test** — Rename "List Users" to "Search Users". Log records: `{ action: "scenario-renamed", entityName: "Search Users", detail: "from List Users" }`.
  4. **Move a test** — Move "Delete User" to another feature group. Two log entries: `scenario-moved-out` in the source FG, `scenario-moved-in` in the target FG.
  5. **Copy a test** — Copy "Create User" to another FG. Log records: `{ action: "test-copied", entityName: "Create User" }`.
  6. **Rename the feature group** — Rename "User Management Tests" to "User API Tests". Log records: `{ action: "fg-renamed", entityName: "User API Tests", detail: "from User Management Tests" }`.
  7. **Open changelog** — View the feature group's Structure Change Log. See all 6+ entries with timestamps, action icons (+/−/~/→), and entity names.
  8. **Understand per-FG scoping** — Each feature group has its own isolated `structureLog[]` array (max 50 entries). Changes to FG "A" don't appear in FG "B"'s log.
- **Key concepts:** `structureLog[]` array on `FeatureGroup` entity, 50-entry cap per FG, action types: `scenario-added/removed/renamed/moved-in/moved-out`, `test-added/removed/renamed/moved-in/moved-out/copied`, `fg-renamed`, `actionLabel()`, `actionIcon()`, `actionClass()` display helpers, per-FG isolation
- **Exercises:**
  1. Add 5 tests then remove 3. How many log entries total? (8 — 5 added + 3 removed.)
  2. Move a test out and back in. How many entries? (2 — moved-out + moved-in.)
  3. Check if log entries have scenario names. Rename the scenario after logging. Does the old log entry update? (No — it captured the name at the time of the action.)

### 14. `feature-group-history-medium.html` — Structure Comparison (Medium)
- **Phase:** V-Phase 6
- **Prerequisites:** feature-group-history-easy
- **Gallery Starting Sample:** `test-country-search` — "Country Search Suite" (Tests tab)
- **Real-world scenario:** *"Sprint Planning — Reviewing Test Suite Evolution"*
  - Import the "Country Search Suite" (4 scenarios against `restcountries.com`: search by name, by code, by region, plus 404 edge case)
  - Simulate sprint work: add new scenarios, remove deprecated ones, rename for clarity, move between FGs
- **Step-by-step walkthrough:**
  1. **Import the sample** — Gallery → Tests → "Country Search Suite" (`test-country-search`). Import. Feature group has 4 scenarios targeting `restcountries.com`.
  2. **Simulate sprint work** — Add 2 new scenarios (search by currency, search by language). Remove 1 (deprecated 404 edge case). Rename "Search by Name" to "Name Search - Germany".
  3. **Review the changelog** — Open FG changelog. The log now has 7 entries showing the sprint's structural evolution.
  4. **Trace change causality** — Each entry has a timestamp. Sort by time to see the sequence of changes. Identify patterns (e.g., "all additions happened on Monday, removals on Friday").
  5. **Restore considerations** — Structure changes are logged but NOT restorable — the changelog is informational. To undo a structural change, manually reverse it.
  6. **Export structure log** — Use `stripStructureLog()` during export to optionally exclude the log for cleaner exports. Use "Include Structure Log" checkbox in the export dialog.
  7. **Clear old entries** — Delete individual log entries with `deleteLogEntry()` or clear all with `clearLog()`.
  8. **Cross-FG view** — Check both the source and target FGs after a move. Both have corresponding log entries (moved-out and moved-in).
- **Key concepts:** Structure change log is informational (no restore — unlike version history), `stripStructureLog()` for export, `clearLog()` and `deleteLogEntry()` management, cross-FG tracking for move operations, 50-entry cap per FG
- **Exercises:**
  1. Move a scenario between 3 different FGs. Check each FG's log. How many entries total? (4 — original FG has 1 moved-out, middle FG has 1 moved-in + 1 moved-out, final FG has 1 moved-in.)
  2. Export a FG with "Include Structure Log" unchecked. Import it. Verify the log is empty in the imported FG.
  3. Reach the 50-entry cap. Add another entry. Verify the oldest is evicted.

---

### 15. `script-library-versioning-easy.html` — Script Snapshots (Easy)
- **Phase:** V-Phase 7
- **Prerequisites:** Script library familiarity (workflow script nodes)
- **Real-world scenario:** *"Shared Data Transformer — Evolving a Reusable Script"*
  - Create a script library function that transforms API responses (e.g., flatten nested JSON, format dates, calculate aggregates)
  - Iteratively improve: add error handling, support new data formats, optimize performance
  - Track each iteration in version history
- **Step-by-step walkthrough:**
  1. **Create a script** — Name: "JSON Flattener". Description: "Flattens nested JSON objects into dot-notation keys". Code:
     ```javascript
     function flatten(obj, prefix = '') {
       return Object.keys(obj).reduce((acc, key) => {
         const fullKey = prefix ? `${prefix}.${key}` : key;
         if (typeof obj[key] === 'object' && obj[key] !== null) {
           Object.assign(acc, flatten(obj[key], fullKey));
         } else {
           acc[fullKey] = obj[key];
         }
         return acc;
       }, {});
     }
     return flatten(input);
     ```
  2. **Save** — First version auto-created. The script's `versions[]` array now has 1 entry.
  3. **Add error handling** — Wrap in try/catch, add null checks, handle arrays. Save. Version 2 created. Change summary auto-generated based on `ScriptLibraryDiffResult`: `codeChanged: true`.
  4. **Optimize** — Replace recursion with iterative approach. Save. Version 3.
  5. **Open version panel** — Click History in the script editor. See 3 versions newest-first.
  6. **Restore version 1** — Click Restore. The script reverts to the simple recursive version without error handling.
  7. **Rename versions** — Name them: "v1 Basic", "v2 Error Handling", "v3 Optimized".
- **Key concepts:** 15-version limit, code-level snapshots (name + description + code), canonical JSON fingerprint for dedup, `autoSaveVersion()` checks `hasChanged()`, `ScriptLibraryDiffResult` (nameChanged, descriptionChanged, codeChanged, oldCode, newCode), `restoreFromVersion()` returns updated `ScriptLibrary`
- **Exercises:**
  1. Change only the description (not the code). Does a new version appear? (Yes — description is part of the fingerprint.)
  2. Rename the script. Does a new version appear? (Yes — name is part of the snapshot.)
  3. Restore an old version, then immediately save. Does a new version appear? (No — the restored state matches the old fingerprint, and if it matches the current latest, dedup prevents it.)

### 16. `script-library-impact-medium.html` — Impact Analysis (Medium)
- **Phase:** V-Phase 7
- **Prerequisites:** script-library-versioning-easy
- **Real-world scenario:** *"Shared Auth Token Refresher — Modifying a Library Used by Multiple Workflows"*
  - Script library "Auth Token Refresher" is used by 4 workflows: "User Registration Flow", "Payment Processing", "Order Management", "Admin Dashboard Health Check"
  - Before modifying the script, check impact analysis to understand the blast radius
  - Make a breaking change and understand which workflows need retesting
- **Step-by-step walkthrough:**
  1. **Create shared script** — "Auth Token Refresher" that handles OAuth token refresh logic.
  2. **Use in multiple workflows** — Reference this script in 3+ workflow script nodes. Each node's `data.libraryIds` array includes this library's ID.
  3. **Open version panel** — Click History on the script. At the top, see "Used by" section listing all workflows that reference this library.
  4. **Impact analysis detail** — `findLibraryUsages(workflows, libraryId)` returns `LibraryUsage[]`:
     ```typescript
     [
       { workflowId: "wf-1", workflowName: "Payment Processing", nodeId: "n-5", nodeLabel: "Refresh Token" },
       { workflowId: "wf-2", workflowName: "Order Management", nodeId: "n-3", nodeLabel: "Auth Check" },
       { workflowId: "wf-3", workflowName: "Admin Health Check", nodeId: "n-1", nodeLabel: "Get Token" }
     ]
     ```
  5. **Make a change** — Modify the token refresh logic. Save. New version created.
  6. **Diff between versions** — Compare old vs new. The `ScriptLibraryVersionDiff` shows 2 tabs:
     - **Overview Tab**: name unchanged, description changed (highlighted), code status (changed/unchanged).
     - **Code Tab**: Side-by-side code diff via json-diff-kit. Line additions in green, removals in red.
  7. **Document impact** — The "Used by" list serves as a retesting checklist. All 3 workflows need verification after this change.
  8. **Restore safely** — If the new version breaks things, restore the previous version knowing exactly which workflows will be affected.
- **Key concepts:** `findLibraryUsages()` scans all workflows for `node.data.libraryIds` references, `LibraryUsage` interface (workflowId, workflowName, nodeId, nodeLabel), 2-tab diff (Overview + Code), impact analysis as a pre-change safety check, cross-workflow dependency tracking
- **Exercises:**
  1. Remove a workflow that uses the library. Does the impact analysis update? (Yes — it dynamically scans current workflows.)
  2. Create a second script node in the same workflow referencing the same library. How many usages show? (2 — one per node, even in the same workflow.)
  3. Delete all usages. Verify the "Used by" section shows "No workflows reference this library."

---

### 17. `cross-feature-versioning-advanced.html` — Cross-Cutting Strategies (Advanced)
- **Phase:** All phases combined
- **Prerequisites:** All easy/medium manuals
- **Gallery Starting Samples:** Multiple — `test-ecommerce-full`, `sample-workflow-webhook`, `req-get-all-users`
- **Real-world scenario:** *"E-Commerce Platform Release — Full Versioning Lifecycle"*
  - Import from Gallery: "E-Commerce Full Suite" test (6 scenarios, `dummyjson.com`), "Webhook Trigger" workflow (`jsonplaceholder.typicode.com`), "Get All Users" request (`jsonplaceholder.typicode.com`)
  - Use ALL versioning features together across these imported samples to manage a release cycle
- **Step-by-step walkthrough:**
  1. **Pre-release snapshot** — Save all workflows (creates workflow versions). Save all tests (creates test definition versions). Mark current test run as baseline "Pre-Release v3.0".
  2. **Development phase** — Make changes across all entities. Each change auto-creates versions:
     - Modify workflow "Order Processing": add retry logic node → auto-version (Nodes tab diff shows 1 node added)
     - Update test "Create Order": change expected status from 200 to 201 → auto-version (Overview tab diff shows expectation change)
     - Update request "POST /orders": add new header `X-Idempotency-Key` → auto-version (Headers tab diff shows 1 header added)
     - Modify shared script "Response Validator": add new validation rule → auto-version (impact analysis shows 3 workflows affected)
     - Change staging environment base URL → audit log records the change
  3. **Change audit trail** — Open Audit Log. Filter to the last week. See all environment/service changes. Export as CSV for the team.
  4. **Regression detection** — Run all tests. Compare against the "Pre-Release v3.0" baseline. Check `RegressionAlert[]` for any critical regressions (P50 > 15%, Error Rate > 1pp).
  5. **Cross-entity traceability** — A test is failing. Trace the cause:
     - Check request version diff: was the URL changed? ✅ URL unchanged
     - Check test definition diff: was the expected response changed? ✅ Expectations unchanged  
     - Check audit log: was the environment base URL changed? ❌ Changed 2 days ago!
     - Root cause: environment config change broke the test
  6. **Export/import for backup** — Export entire scenario with ALL version data:
     - ✅ Include Response Versions
     - ✅ Include Rules Versions
     - ✅ Include Definition Versions
     - ✅ Include Structure Log
     - Verify `countVersions()` shows correct counts before export
  7. **Version hygiene** — Clean up:
     - Delete unnamed/untitled versions in workflows (keep labeled milestones)
     - Ensure script library versions are labeled with change descriptions
     - Verify audit log hasn't hit 500-cap (export before clearing if needed)
  8. **Team collaboration patterns:**
     - Version naming convention: `[Sprint-XX] Description` (e.g., "[Sprint-42] Added retry logic")
     - Baseline naming: `[YYYY-MM-DD] Pre-Release vX.Y` or `[YYYY-MM-DD] Post-Deploy vX.Y`
     - Export versions before major refactors (safety net)
     - Use audit log CSV in sprint retrospectives to review infrastructure changes
- **Key concepts:** Holistic versioning strategy across 6 entity types, cross-entity change traceability (debugging failures via version diffs + audit log), `VersionExportOptions` with 4 checkboxes, regression detection workflow (baseline → run → compare → investigate), version naming conventions for team collaboration, version cap management (30/20/15/15/500/10), export as backup strategy

---

## Implementation Priority

| Priority | Manuals | Rationale | Est. Lines/Manual | Status |
|----------|---------|-----------|-------------------|--------|
| **P1** | versioning.html, workflow-version-history-easy, workflow-version-diff-medium, workflow-version-advanced | Most-used feature, foundation for all others | 350–450 | ✅ Done |
| **P2** | test-definition-history-easy, test-definition-diff-medium, request-definition-history-easy | Core editor versioning — daily workflow | 250–350 | ✅ Done |
| **P3** | script-library-versioning-easy, script-library-impact-medium | Unique impact analysis feature — differentiator | 250–300 | ✅ Done |
| **P4** | environment-audit-log-easy, environment-audit-export-medium, run-baselines-easy, run-baselines-comparison-medium | Supporting infrastructure features | 250–300 | ✅ Done |
| **P5** | feature-group-history-easy, feature-group-history-medium, request-definition-diff-medium | Completion & advanced scenarios | 250–350 | ✅ Done |
| **P6** | cross-feature-versioning-advanced | Capstone manual — requires all others | 400–500 | ✅ Done |

### Real-World Example Scenarios Summary

Each manual imports a Gallery sample as its starting point, ensuring working public APIs and reproducible walkthroughs:

| Manual | Gallery Sample | Sample ID | Live API |
|--------|---------------|-----------|----------|
| Workflow Easy | Create → Extract → Verify | `sample-workflow-001` | jsonplaceholder.typicode.com |
| Workflow Diff | Webhook Trigger | `sample-workflow-webhook` | jsonplaceholder.typicode.com |
| Workflow Advanced | Sub-Workflow Orchestrator | `sample-workflow-sub-workflow` | jsonplaceholder.typicode.com |
| Test Easy | User API Smoke Test | `test-user-api-smoke` | jsonplaceholder.typicode.com |
| Test Diff | E-Commerce Full Suite | `test-ecommerce-full` | dummyjson.com |
| Baselines Easy | Product Listing Check | `test-product-listing` | dummyjson.com |
| Baselines Comparison | Auth Flow Validation | `test-auth-flow` | dummyjson.com |
| Request Easy | Get All Users | `req-get-all-users` | jsonplaceholder.typicode.com |
| Request Diff | Create a New Post | `req-create-post` | jsonplaceholder.typicode.com |
| Audit Easy | *(Settings → Environments)* | — | — |
| Audit Export | *(Settings → Environments)* | — | — |
| FG Easy | User API Smoke Test | `test-user-api-smoke` | jsonplaceholder.typicode.com |
| FG Medium | Country Search Suite | `test-country-search` | restcountries.com |
| Script Easy | *(Script Library — created in workflow editor)* | — | — |
| Script Impact | *(Script Library — referenced by workflows)* | — | — |
| Cross-Feature | E-Commerce + Webhook + Get All Users | Multiple | dummyjson.com + jsonplaceholder |

---

## Format & Style

- All manuals in **HTML** format (matching existing training manual style in `docs/training-manuals/`)
- Print-friendly with `@page { size: A4; margin: 20mm 18mm; }` and `.page-break` dividers
- Dark code blocks (`background: #1a1a2e; color: #a8dadc;`), table-based reference sections
- Every manual includes:
  - Cover page with emoji + title + subtitle + version (RedfireForge v0.5.6)
  - Prerequisites section
  - Real-world scenario introduction (concrete, relatable use case)
  - Concepts section (theory with data model references)
  - **Step-by-step walkthrough** (numbered steps with exact UI actions, per CONVENTIONS.md)
  - Code snippets showing actual TypeScript interfaces and JSON payloads
  - Tips & callouts (`.callout`, `.callout-tip`)
  - Self-practice exercises section (3 exercises per manual)
  - Related manuals cross-references
- Styling matches existing manuals: `h1 { color: #e63946 }`, `h2 { color: #1d3557; border-bottom: 2px solid #e63946 }`, `h3 { color: #457b9d }`, badges (`.badge-easy`, `.badge-medium`, `.badge-advanced`)
- File naming follows CONVENTIONS.md: `<topic>-<difficulty>.html`

---

## Source Code References

| Phase | Utility | Component | Hook | Tests | Key Functions |
|-------|---------|-----------|------|-------|---------------|
| V1 | `workflowVersioning.ts` (230 lines) | `WorkflowVersionPanel.tsx` (201 lines), `WorkflowVersionDiff.tsx` (263 lines) | `useWorkflowVersioning.ts` (101 lines) | 108 | `computeWorkflowFingerprint()`, `createWorkflowVersion()`, `addVersionToList()`, `generateChangeSummary()`, `computeVersionDiff()`, `stripWorkflowVersions()`, `countWorkflowVersions()` |
| V2 | `testDefinitionVersioning.ts` (200 lines) | `TestDefinitionVersionPanel.tsx`, `TestDefinitionVersionDiff.tsx` | — | 62 | `createSnapshot()`, `computeSnapshotFingerprint()`, `hasChanged()`, `generateChangeSummary()`, `autoSaveVersion()`, `computeSnapshotDiff()`, `countDefinitionVersions()`, `stripDefinitionVersions()` |
| V3 | `auditLog.ts` (204 lines) | `AuditLogPanel.tsx` | — | 42 | `loadAuditLog()`, `addAuditEntry()`, `computeChanges()`, `auditLogToCsv()`, `logEnvironmentCreated/Deleted/Renamed()`, `logMicroserviceCreated/Deleted/Updated()`, `logAuthProfileCreated/Deleted/Updated/Renamed()` |
| V4 | `runBaselines.ts` (365 lines) | (comparison view) | — | 27 | `markAsBaseline()`, `unmarkBaseline()`, `renameBaseline()`, `isBaseline()`, `compareRuns()`, `detectRegressions()` |
| V5 | `requestDefinitionVersioning.ts` (212 lines) | `RequestDefinitionVersionPanel.tsx`, `RequestDefinitionVersionDiff.tsx` | — | 32 | `createSnapshot()`, `hasChanged()`, `autoSaveVersion()`, `restoreFromVersion()`, `deleteVersion()`, `renameVersion()`, `countRequestDefinitionVersions()` |
| V6 | `structureChangeLog.ts` (152 lines) | (FG history panel) | — | 36 | `addLogEntry()`, `actionLabel()`, `actionIcon()`, `actionClass()`, `stripStructureLog()`, `clearLog()`, `deleteLogEntry()` |
| V7 | `scriptLibraryVersioning.ts` (221 lines) | `ScriptLibraryVersionPanel.tsx`, `ScriptLibraryVersionDiff.tsx` | — | 60 | `autoSaveVersion()`, `hasChanged()`, `computeDiff()`, `findLibraryUsages()`, `restoreFromVersion()`, `deleteVersion()`, `renameVersion()` |
| Export | `scenarioImportExport.ts` (185 lines) | `VersionCheckboxGroup`, `ExportOptionsPopover`, `ImportVersionModal` | — | — | `stripVersions()`, `countVersions()`, `wrapExport()`, `unwrapImport()`, `reIdScenarios()` |
| Shared | `versionUtils.ts` (12 lines) | `ResponseVersionPanel.tsx`, `RulesVersionPanel.tsx`, `CatalogVersionDiff.tsx` | — | — | `buildRulesSnapshot()` |
