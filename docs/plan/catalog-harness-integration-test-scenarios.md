# Catalog Enhancement — Visual Test Scenarios

> Manual verification checklist for each phase of the Catalog Enhancement Plan (v3).
> **Test API:** Swagger Petstore (public demo API)

---

## Test API: Swagger Petstore

**Spec URL:** `https://petstore3.swagger.io/api/v3/openapi.json`
**Live API Base:** `https://petstore3.swagger.io/api/v3`

### Key Endpoints for Testing

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/pet/findByStatus?status=available` | List pets by status | No |
| GET | `/pet/{petId}` | Get pet by ID | No |
| POST | `/pet` | Add a new pet | OAuth2 (optional) |
| GET | `/store/inventory` | Get store inventory | API Key |
| GET | `/user/{username}` | Get user by username | No |

### Additional Test Specs

| API | Import URL | Endpoints | Auth |
|-----|------------|-----------|------|
| XKCD | `https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/xkcd.com/1.0.0/openapi.yaml` | 2 | None |
| Petstore v2 | `https://petstore.swagger.io/v2/swagger.json` | 19 | Optional |
| TVmaze | `https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/tvmaze.com/1.0/openapi.yaml` | ~30 | None |

---

## Verification Summary

| Phase | Name | Scenarios | Status |
|-------|------|-----------|--------|
| 1 | API Info on Exported Requests | 15 | ✅ Complete |
| 1b | Single Endpoint Export | 8 | ✅ Complete |
| 2 | Coverage Badges in Catalog | 9 | ✅ Complete |
| 3 | Ensure catalogMeta with Version | 9 | ✅ Complete |
| 4 | Version Info in Export Modal | 6 | ✅ Complete |
| 5 | Request Versioning System | 21 | ✅ Implemented |
| 6 | Requests ↔ Harness Integration | 21 | ✅ Implemented |

---

## Phase 1: API Info on Exported Requests

**Status: ✅ Complete**

### Manual Verification Steps

#### 1. Start the dev server

```bash
npm run dev
```

#### 2. Import a spec and export to Requests

1. Go to **Catalog** tab
2. Click **Import** button
3. Select **"From URL"** tab
4. Paste: `https://petstore3.swagger.io/api/v3/openapi.json`
5. Click **Fetch** → **Import**
6. Click **"Export to Requests"**
7. Select a target collection and some endpoints
8. Click **Export**

#### 3. Verify API Info button appears

1. Go to **Requests** tab
2. Select one of the exported requests (e.g., "Find pet by ID")
3. Look next to the request name
4. You should see an **"ⓘ API Info"** button

#### 4. Verify API Reference panel

Click the **"ⓘ API Info"** button. The panel should show:

| Section | Expected Content |
|---------|------------------|
| **Endpoint** | Operation ID (e.g., `getPetById`), Path (e.g., `GET /pet/{petId}`) |
| **Source** | Spec name (e.g., `Swagger Petstore - OpenAPI 3.0`) |
| **Description** | Endpoint description from spec |
| **Tags** | Tag badges (e.g., `pet`) |
| **Parameters** | Table with Name, In, Type, Required, Description |
| **Responses** | Table with Status Code (200, 400, 404) and Description |
| **Security** | Security scheme if endpoint requires auth (e.g., `api_key`, `petstore_auth`) |

#### 5. Verify toggle behavior

1. Click the **"ⓘ API Info"** button → panel opens, button shows "active" state
2. Click the button again → panel closes, button returns to normal
3. Click **"×"** close button in panel header → panel closes

### Test Scenarios Checklist

| # | Scenario | Pass |
|---|----------|------|
| 1.1 | API Info button hidden for manually created requests | ☐ |
| 1.2 | API Info button visible for exported requests | ☐ |
| 1.3 | Panel opens when button clicked | ☐ |
| 1.4 | Panel shows Operation ID | ☐ |
| 1.5 | Panel shows endpoint path with method | ☐ |
| 1.6 | Panel shows source spec name | ☐ |
| 1.7 | Panel shows description (if endpoint has one) | ☐ |
| 1.8 | Panel shows tags as badges | ☐ |
| 1.9 | Panel shows parameters table | ☐ |
| 1.10 | Panel shows responses table | ☐ |
| 1.11 | Panel shows security (for secured endpoints) | ☐ |
| 1.12 | Panel shows deprecated warning (for deprecated endpoints) | ☐ |
| 1.13 | Close button (×) closes panel | ☐ |
| 1.14 | Button shows active state when panel open | ☐ |
| 1.15 | Clicking button again closes panel | ☐ |

---

## Phase 1b: Single Endpoint Export

**Status: ✅ Complete**

### Manual Verification Steps

#### 1. Import a spec

1. Go to **Catalog** tab
2. Import Petstore spec (if not already imported)

#### 2. Test single endpoint export

1. Click on an endpoint to expand it (e.g., `GET /pet/{petId}`)
2. Click **"Try it out"** to open the test panel
3. Look at the Execute bar — you should see:
   - **Execute** button (green)
   - **cURL** button
   - **Export to Requests** button (blue)
4. Click **"Export to Requests"**
5. The export modal should open with **only this endpoint selected**

#### 3. Verify modal behavior

1. In the modal, verify only the clicked endpoint is selected
2. Select a target collection (or create new)
3. Select environments
4. Click **Export**
5. Go to **Requests** tab
6. Verify only that single endpoint was exported

#### 4. Verify with sample values

1. Go back to **Catalog** tab, open the same endpoint
2. Fill in parameter values (e.g., `petId = 123`)
3. Click **"Export to Requests"**
4. Export and verify the exported request has parameter values filled in

### Test Scenarios Checklist

| # | Scenario | Pass |
|---|----------|------|
| 1b.1 | Export to Requests button appears in Execute bar | ☐ |
| 1b.2 | Button only visible when endpoint is expanded (Try it out mode) | ☐ |
| 1b.3 | Clicking button opens export modal | ☐ |
| 1b.4 | Modal pre-selects only the clicked endpoint | ☐ |
| 1b.5 | Other endpoints in modal are unchecked | ☐ |
| 1b.6 | Can still select additional endpoints in modal | ☐ |
| 1b.7 | Export creates request with catalogMeta | ☐ |
| 1b.8 | Sample values (params, headers, body) are included when checked | ☐ |

---

## Phase 2: Coverage Badges in Catalog

**Status: ✅ Complete**

### Manual Verification Steps

#### 1. Import a spec

1. Go to **Catalog** tab
2. Import Petstore spec (if not already imported)

#### 2. Export SOME endpoints to Requests

1. Click **"Export to Requests"** button (next to "Endpoints" tab)
2. Select a target collection (or create new)
3. **Uncheck some endpoints** — export only 3-4, not all 19
4. Click **Export**

#### 3. Verify badge appears on exported endpoints

1. Stay in **Catalog** tab (or switch back to it)
2. Look at the endpoint headers
3. Exported endpoints should show a blue **"IN REQUESTS"** pill badge
4. Badge appears in the header row, between the summary text and the deprecated/lock icons

#### 4. Verify badge NOT shown on unexported endpoints

1. Find an endpoint you did NOT export
2. Verify there is **no** "IN REQUESTS" badge on it

#### 5. Verify badge count with multiple exports

1. Export the same endpoint again to a **different** collection
2. Return to **Catalog** tab
3. The badge should now show **"IN REQUESTS (2)"** for that endpoint
4. Endpoints exported only once show **"IN REQUESTS"** (no count)

#### 6. Verify badge updates after deletion

1. Go to **Requests** tab
2. Delete one of the exported requests
3. Return to **Catalog** tab
4. The badge count should decrease (or disappear if count reaches 0)

#### 7. Verify cross-spec isolation

1. Import a second spec (e.g., XKCD)
2. Verify badges only appear for endpoints from the correct spec
3. XKCD endpoints should NOT show Petstore badges

### Test Scenarios Checklist

| # | Scenario | Pass |
|---|----------|------|
| 2.1 | No badge on unexported endpoint | ☐ |
| 2.2 | Blue "IN REQUESTS" badge visible on exported endpoint | ☐ |
| 2.3 | Badge shows count when exported multiple times (e.g., "IN REQUESTS (2)") | ☐ |
| 2.4 | Badge shows no count when exported once (just "IN REQUESTS") | ☐ |
| 2.5 | Badge has correct styling (blue pill, primary color) | ☐ |
| 2.6 | Badge positioned in endpoint header row (after summary) | ☐ |
| 2.7 | Badge updates when request is deleted from Requests tab | ☐ |
| 2.8 | Badges only appear for endpoints matching the current spec (no cross-spec) | ☐ |
| 2.9 | Badge has hover tooltip showing count | ☐ |

---

## Phase 3: Ensure catalogMeta with Version

**Status: ✅ Complete**

### Manual Verification Steps

#### 1. Import a spec with a known version

1. Go to **Catalog** tab
2. Import Petstore v3: `https://petstore3.swagger.io/api/v3/openapi.json`
3. Note the spec version (e.g., `1.0.27`)

#### 2. Export an endpoint to Requests

1. Click **"Export to Requests"**
2. Select any endpoint (e.g., `GET /pet/{petId}`)
3. Export to a collection

#### 3. Inspect the exported request's catalogMeta

1. Open browser DevTools (F12)
2. Go to **Application** → **Local Storage**
3. Find the requests/collections storage key
4. Locate the exported request object
5. Inspect the `catalogMeta` field

#### 4. Verify all required fields are present

The `catalogMeta` object should contain:

```json
{
  "catalogEntryId": "<uuid of the catalog entry>",
  "catalogEndpointId": "<uuid of the endpoint within the spec>",
  "catalogVersion": "1.0.27",
  "operationId": "getPetById",
  "description": "Returns a single pet",
  "originalPath": "/pet/{petId}",
  "tags": ["pet"],
  "parameters": [
    { "name": "petId", "in": "path", "required": true, "type": "integer" }
  ],
  "expectedResponses": [
    { "statusCode": "200", "description": "successful operation" },
    { "statusCode": "400", "description": "Invalid ID supplied" },
    { "statusCode": "404", "description": "Pet not found" }
  ],
  "security": ["api_key", "petstore_auth"],
  "sourceSpec": "Swagger Petstore - OpenAPI 3.0 1.0.27"
}
```

#### 5. Verify with a different spec

1. Import XKCD spec: `https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/xkcd.com/1.0.0/openapi.yaml`
2. Export an endpoint
3. Verify `catalogEntryId` is different from Petstore's
4. Verify `catalogVersion` is `"1.0.0"`

#### 6. Verify catalogEndpointId is unique per endpoint

1. Export two different endpoints from the same spec
2. Inspect both in localStorage
3. Verify they have the same `catalogEntryId` but different `catalogEndpointId` values

### Test Scenarios Checklist

| # | Scenario | Pass |
|---|----------|------|
| 3.1 | `catalogMeta` object exists on exported request | ☐ |
| 3.2 | `catalogEntryId` is a valid UUID matching the catalog entry | ☐ |
| 3.3 | `catalogEndpointId` is a valid UUID matching the endpoint | ☐ |
| 3.4 | `catalogVersion` contains the spec version string (e.g., "1.0.27") | ☐ |
| 3.5 | `sourceSpec` contains entry name + version (e.g., "Swagger Petstore 1.0.27") | ☐ |
| 3.6 | `parameters` array contains endpoint parameter metadata | ☐ |
| 3.7 | `expectedResponses` array contains response codes and descriptions | ☐ |
| 3.8 | Different endpoints from same spec share `catalogEntryId` but differ in `catalogEndpointId` | ☐ |
| 3.9 | Different specs produce different `catalogEntryId` values | ☐ |

---

## Phase 4: Version Info in Export Tab

**Status: ✅ Complete**

### Manual Verification Steps

#### 1. Setup: Export some endpoints first

1. Start the dev server: `npm run dev`
2. Go to **Catalog** tab
3. Import the Petstore spec (URL: `https://petstore.swagger.io/v2/swagger.json`)
4. Click **"Export to Requests"** tab
5. Select a few endpoints and export them
6. This creates "previously exported" endpoints

#### 2. Open Export to Requests tab again

1. Go back to **Catalog** tab
2. Click the **"Export to Requests"** tab (it's now a regular tab, not a modal)

#### 3. Verify version badges

Look at the **Version** column in the endpoint table:

| Endpoint Status | Expected Badge |
|-----------------|----------------|
| Never exported | **NEW** (green pill badge) |
| Previously exported | **from 1.0.7** (gray pill badge with border) |

#### 4. Verify new endpoints summary

1. Look at the **Collection Name** label at the top of the left panel
2. If there are new endpoints, should show green **"N new endpoints"** badge next to the label
3. If all endpoints are exported, should show **"all previously exported"** in muted text

#### 5. Verify mixed state

1. Export only a few endpoints (not all)
2. Go back to Export tab
3. Verify the exported ones show "from 1.0.7" and the rest show "NEW"
4. The new count badge should show the correct number

### Test Scenarios Checklist

| # | Scenario | Pass |
|---|----------|------|
| 4.1 | NEW badge (green pill) for never-exported endpoints | ☐ |
| 4.2 | "from vX.Y.Z" badge (gray pill) for exported endpoints | ☐ |
| 4.3 | Mixed badges show correctly — some NEW, some exported | ☐ |
| 4.4 | Collection Name label shows "N new endpoints" count badge | ☐ |
| 4.5 | Shows "all previously exported" when all endpoints have been exported | ☐ |
| 4.6 | Badge styling correct (NEW = green, exported = gray + border) | ☐ |
| 4.7 | Version column displays in both inline tab and modal (single-endpoint export) | ☐ |
| 4.8 | Exporting, then returning to Export tab, updates badges correctly | ☐ |

---

## Phase 5: Request Versioning System

**Status: ✅ Implemented (6 sub-phases: 5A–5F)**

### Sub-Phase 5A: Type System

#### Manual Verification
- Confirm `npx tsc -b --noEmit` passes after type additions
- No runtime verification needed (type-only changes)

---

### Sub-Phase 5B: Version-Aware Export Pipeline

#### Manual Verification Steps

##### 1. First export (creates initial spec version)

1. Start the dev server: `npm run dev`
2. Go to **Catalog** tab
3. Import Petstore v2: `https://petstore.swagger.io/v2/swagger.json`
4. Click **"Export to Requests"** tab
5. Select a few endpoints (e.g., "Find pet by ID", "Finds Pets by status")
6. Export them

##### 2. Verify first spec version exists

1. Go to **Requests** tab, open an exported request
2. Click **"API Info"** → verify `Spec Version` shows `1.0.7`
3. (Advanced) In DevTools → Local Storage → `perf-test-requests`, search for `specVersions` — should be an array with 1 entry

##### 3. Simulate spec update and re-export

1. Import a different version of the spec (e.g., Petstore v3: `https://petstore3.swagger.io/api/v3/openapi.json`)
   - Or: download Petstore, change version field, re-import as file
2. Go to **"Export to Requests"** tab
3. Export the same endpoints again

##### 4. Verify merge behavior

1. Go to **Requests** tab
2. The same request should now have 2 spec versions (NOT a duplicate request)
3. Toast should show "Updated N requests, added M new"

---

### Sub-Phase 5C: Version Switcher UI

#### Manual Verification Steps

##### 1. Open a multi-version request

1. Open a request that was re-exported (has 2+ spec versions from 5B)

##### 2. Verify version switcher appears

1. Look at the request name bar (top of editor)
2. A **version switcher dropdown** should appear between the name and the API Info button
3. It should show the current version label (e.g., "v1.0.7")

##### 3. Test switching

1. Select a different version from the dropdown
2. The request's URL, headers, params should update to match that version
3. Select the original version → it should switch back

##### 4. Verify single-version requests

1. Open a request with only 1 spec version (or no spec versions)
2. No version switcher should appear

---

### Sub-Phase 5D: Version Comparison

#### Manual Verification Steps

##### 1. Open compare modal

1. On a multi-version request, click the **"Compare"** button next to the version switcher

##### 2. Verify diff display

1. Select two different versions (left and right dropdowns)
2. The diff table should show:
   - Green rows for added fields (new headers, params)
   - Red rows for removed fields
   - Amber rows for modified fields (URL change, etc.)
3. If versions are identical → "No differences" message

---

### Sub-Phase 5E: Workflow Integration

#### Manual Verification Steps

##### 1. Add versioned request to workflow

1. Go to **Workflow** tab
2. Drag a multi-version request onto the canvas

##### 2. Verify version mode UI in node config

1. Click on the HTTP node → opens node config modal
2. Below the **Label** field, look for **"Spec Version"** dropdown
3. Should show:
   - "Latest (tracks active version)" — selected by default
   - "Pinned — v1.0.0" (shows the version label)
4. Only visible when the node has `sourceSpecVersionId` (i.e., came from a versioned request)

##### 3. Test pinned mode

1. Select "Pinned" from the dropdown → save
2. Run the workflow → it should use the pinned version's URL/headers
3. Update the source request to a newer spec version → the pinned node still uses the old version

##### 4. Test latest mode resolution

1. Set version mode to "Latest" → save
2. If the source request's active version has changed since the node was created:
   - The resolved scenario should use the latest URL/method/headers
3. `resolveNodeSpecVersion` utility handles this before execution

##### 5. Detect newer version available

1. When a node is pinned to an older version and the source request has a newer active version
2. `detectNewerVersion` returns the newer version info

---

### Sub-Phase 5F: Harness Integration

#### Manual Verification Steps

##### 1. Create test from versioned request

1. Create a scenario from a versioned request
2. The scenario should have `sourceSpecVersionId` and `sourceSpecVersionLabel`

##### 2. Verify version label in Test Runner

1. Go to **Test Runner** tab
2. In the scenario selector, scenarios with versioned tests should show a **purple version badge** (e.g., "v1.0.7")
3. If tests in a scenario have multiple versions, the badge shows the first + count (e.g., "v1.0.0 +1")

---

### Test Scenarios Checklist (All Sub-Phases)

| # | Sub-Phase | Scenario | Pass |
|---|-----------|----------|------|
| 5A.1 | Types | `SpecVersion` type compiles correctly | ☐ |
| 5A.2 | Types | `RequestItem` accepts `specVersions` and `activeSpecVersionId` | ☐ |
| 5A.3 | Types | Backward compatible — works without `specVersions` | ☐ |
| 5B.1 | Export | First export creates `specVersions[0]` with correct snapshot | ☐ |
| 5B.2 | Export | Re-export adds second version (no duplicate) | ☐ |
| 5B.3 | Export | Merge correctly identifies existing requests by `catalogEndpointId` | ☐ |
| 5B.4 | Export | New endpoints create new requests | ☐ |
| 5B.5 | Export | Toast shows "Updated N, added M" | ☐ |
| 5C.1 | Switcher | Hidden when 0-1 versions | ☐ |
| 5C.2 | Switcher | Shows dropdown when 2+ versions | ☐ |
| 5C.3 | Switcher | Switching updates URL, headers, params | ☐ |
| 5C.4 | Switcher | Switching back restores original | ☐ |
| 5D.1 | Compare | Compare modal opens | ☐ |
| 5D.2 | Compare | Shows added/removed/modified changes | ☐ |
| 5D.3 | Compare | "No differences" for identical versions | ☐ |
| 5E.1 | Workflow | Version mode dropdown appears for versioned nodes | ☐ |
| 5E.2 | Workflow | Default is "latest" mode | ☐ |
| 5E.3 | Workflow | Pinned mode uses specific version snapshot | ☐ |
| 5E.4 | Workflow | Latest mode resolves to active version at execution | ☐ |
| 5E.5 | Workflow | `detectNewerVersion` finds newer version for pinned nodes | ☐ |
| 5F.1 | Harness | Scenario has `sourceSpecVersionId` | ☐ |
| 5F.2 | Harness | Version label badge shown in Test Runner ScenarioSelector | ☐ |
| 5F.3 | Harness | Multiple versions show "v1.0.0 +1" format | ☐ |

---

## Phase 6: Requests ↔ Harness Integration

**Status: ✅ Implemented (7 sub-phases: 6A–6G, 43 unit tests across 6 files)**

**Design: One-time snapshot promotion — tests are independent after creation**

### Sub-Phase 6A: Promotion Utility

#### Manual Verification
- Covered by integration-level tests in 6B/6C (utility is pure logic)

---

### Sub-Phase 6B: Send to Harness Dialog

#### Manual Verification Steps

##### 1. Setup

1. Start dev server: `npm run dev`
2. Import a spec and export some endpoints to Requests
3. Go to **Testing** → **Feature Groups** → create at least one Feature Group

##### 2. Find "Send to Harness" button

1. Go to **Requests** tab
2. Select any request (spec-exported or manually created)
3. Look for **"Send to Harness"** button in the name bar

##### 3. Open modal and explore

1. Click **"Send to Harness"**
2. Modal should show:
   - Target Feature Group dropdown (+ "Create New")
   - Target Test Scenario dropdown (+ "Create New")
   - Preview: name, method, resolved URL, auth
   - Quick validation options: "No validation" / "Check status 200"
   - Origin info: "Test will be independent after creation"
3. Cancel → modal closes

##### 4. Promote to existing group

1. Open modal → select existing Feature Group and Test Scenario
2. Click **"Send to Harness"**
3. Should navigate to **Feature Groups** tab
4. Find the target group → new test should appear

##### 5. Promote with new group

1. Open modal → "Create New" group → enter name
2. "Create New" scenario → enter name
3. Click **"Send to Harness"**
4. New group and scenario should be created

---

### Sub-Phase 6C: State Bridge

#### Manual Verification Steps

##### 1. Verify persistence

1. After promoting, refresh the page
2. Go to **Feature Groups** → promoted test should still be there

##### 2. Verify resolved fields

1. Open the promoted test in the test editor
2. URL should be **absolute** (not relative, not `{{baseUrl}}`)
3. Auth should be **concrete** (not `inherit`)
4. Method, headers, body should match source request

##### 3. Verify "IN HARNESS" badge

1. Go to **Requests** tab
2. The source request should show a subtle **"IN HARNESS"** badge

##### 4. Verify confirmation toast

1. Promote any request to Harness
2. A **green toast** should appear: "Sent to Harness — Test 'name' created"
3. Toast auto-dismisses after ~4 seconds

##### 5. Verify "Open test editor after creation"

1. Open Send to Harness modal for any request
2. Click **Next** to go to preview step
3. Check the **"Open test editor after creation"** checkbox
4. Click **"Send to Harness"**
5. Should auto-navigate to **Feature Groups** AND open the **Test Editor Modal** for the newly created test
6. Close the editor, the test should be visible in the list

---

### Sub-Phase 6D: Origin Badge

#### Manual Verification Steps

##### 1. Verify in Feature Groups

1. Go to **Feature Groups** tab
2. Find a promoted test
3. Should show origin badge: "From: GET /users (Petstore API v1.0.7)"

##### 2. Verify clickable navigation

1. Click the origin badge on a promoted test
2. Should **navigate to the Requests tab** and select the source request
3. If the source request was deleted, a **warning toast** should appear: "Source request not found"

##### 3. Verify in Test Runner

1. Go to **Test Runner** tab
2. In scenario selector, promoted tests should show a small version label

---

### Sub-Phase 6E: Batch Promotion

#### Manual Verification Steps

##### 1. Setup

1. Have a collection with multiple folders and requests

##### 2. Batch promote

1. Right-click on the collection in Requests sidebar
2. Select **"Send to Harness"**
3. Dialog shows collection tree with checkboxes
4. Preview: "Will create 1 Feature Group, N Test Scenarios, M tests"
5. Confirm

##### 3. Verify

1. Go to **Feature Groups**
2. New Feature Group with collection name should exist
3. TestScenarios should map to folders, tests to requests

---

### Sub-Phase 6F: Catalog → Harness Direct Path

#### Manual Verification Steps

##### 1. Find the button

1. Go to **Catalog** tab → select spec → **Endpoints** tab
2. On an endpoint card, find **"Send to Harness"** button

##### 2. Promote directly

1. Click **"Send to Harness"**
2. Same modal as 6B should open
3. Select target → confirm → navigates to Feature Groups

---

### Sub-Phase 6G: "Try It Out" → Promote

#### Manual Verification Steps

##### 1. Try It Out

1. Go to **Catalog** → select an endpoint → "Try It Out" area
2. Send a request → get a 200 response

##### 2. Save as Test

1. Look for **"Save as Test"** button near the response
2. Click it → Send to Harness modal opens
3. On the preview step, **"Check status 200"** should be **pre-selected** (auto-preset)
4. Complete the flow → promoted test should have status-200 validation

##### 3. Compare with regular "Send to Harness"

1. Click the regular **"Send to Harness"** button (not "Save as Test")
2. On the preview step, **"No validation"** should be selected by default

---

### Test Scenarios Checklist (All Sub-Phases)

| # | Sub-Phase | Scenario | Pass |
|---|-----------|----------|------|
| 6A.1 | Utility | Converts request with correct method/URL/headers | ☐ |
| 6A.2 | Utility | Resolves relative URL to absolute | ☐ |
| 6A.3 | Utility | Resolves `inherit` auth to concrete | ☐ |
| 6A.4 | Utility | Sets sourceRequestId for origin badge | ☐ |
| 6A.5 | Utility | `status-200` preset creates correct validation | ☐ |
| 6B.1 | Dialog | "Send to Harness" button visible | ☐ |
| 6B.2 | Dialog | Modal shows Feature Groups + "Create New" | ☐ |
| 6B.3 | Dialog | Quick validation presets work | ☐ |
| 6B.4 | Dialog | Confirm navigates to Feature Groups | ☐ |
| 6C.1 | Bridge | Promoted test persists after refresh | ☐ |
| 6C.2 | Bridge | URL is absolute, auth is concrete | ☐ |
| 6C.3 | Bridge | "IN HARNESS" badge appears on source request | ☐ |
| 6C.4 | Bridge | Toast confirmation appears after promotion | ☐ |
| 6C.5 | Bridge | "Open test editor" checkbox opens editor after creation | ☐ |
| 6D.1 | Badge | Origin badge shows in Feature Groups | ☐ |
| 6D.2 | Badge | Clicking origin badge navigates to source request | ☐ |
| 6D.3 | Badge | Clicking badge for deleted request shows warning toast | ☐ |
| 6D.4 | Badge | Version label shows in Test Runner | ☐ |
| 6E.1 | Batch | Context menu "Send to Harness" on collection | ☐ |
| 6E.2 | Batch | Maps collection → FeatureGroup, folders → TestScenarios | ☐ |
| 6E.3 | Batch | Checkbox selection works | ☐ |
| 6F.1 | Catalog | "Send to Harness" on endpoint cards | ☐ |
| 6F.2 | Catalog | Direct catalog → harness promotion works | ☐ |
| 6G.1 | Try Out | "Save as Test" after 200 response | ☐ |
| 6G.2 | Try Out | Created test has status-200 validation (auto-preset) | ☐ |
| 6G.3 | Try Out | Regular "Send to Harness" defaults to "No validation" | ☐ |

---

## Notes

- Run `npm run dev` before testing
- For storage inspection: DevTools → Application → Local Storage
- Mark scenarios with ✓ when passed, ✗ when failed

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-17 | Phase 5 deferred items completed: 5E.4 (pinned/latest toggle UI), 5E.5 (resolveNodeSpecVersion utility + 8 tests), 5F.3 (version badge in Test Runner). Updated 5E/5F scenarios. |
| 2026-05-17 | Phase 6 gap fixes: toast confirmation, openEditorAfter, clickable origin badge, auto-preset status-200. Added 4 new manual scenarios (26 total for Phase 6). |
| 2026-05-17 | Phase 6 implemented: 7 sub-phases (6A–6G), 43 unit tests, full Requests ↔ Harness bridge with single/batch/catalog promotion paths |
| 2026-05-17 | Phase 6 scenarios redesigned: snapshot model, removed version sync, added batch/catalog/try-it-out paths. 7 sub-phases, 21 scenarios. |
| 2026-05-17 | Phase 6 scenarios detailed: 5 sub-phases (6A–6E) with 18 manual verification scenarios |
| 2026-05-17 | Phase 5 implemented: 6 sub-phases (5A–5F), 27 new unit tests, version merge/switcher/compare UI |
| 2026-05-17 | Phase 5 scenarios detailed: 6 sub-phases (5A–5F) with 21 manual verification scenarios |
| 2026-05-17 | Phase 4 complete: Version badges (NEW/exported) in Export tab, new-count summary, 10 unit tests |
| 2026-05-17 | Rewrote to match Catalog Enhancement Plan v3 (6 phases). Removed old contract testing scenarios. |
| 2026-05-17 | Phase 3 complete: catalogMeta with catalogEntryId, catalogEndpointId, catalogVersion |
| 2026-05-17 | Phase 2 complete: Coverage Badges with "IN REQUESTS" pill badge |

---

_Last Updated: 2026-05-17_
