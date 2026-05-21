# Tier 3 Phase 3A — Visual Test Scenarios

> **Full Validation Engine in Rust — Manual Testing Guide**
> Created: 2026-05-21
>
> **Purpose:** Step-by-step visual test guide for manually verifying that the Rust validation engine
> produces identical results to the JS engine across all validation modes, assertion types, and edge cases.
>
> **How to use:** Work through each scenario sequentially. Every scenario has **Prerequisites**, **Steps**,
> and **Expected Results** sections. Check the box when each test passes.
>
> **Do NOT mark as done** — test each one yourself and check off manually.

---

## Before You Start

### How to Navigate

| Destination | Path |
|---|---|
| **Feature Groups** | Activity bar → **Harness** → sub-nav **Feature Groups** |
| **Test Runner** | Activity bar → **Harness** → sub-nav **Test Runner** |
| **Results Dashboard** | Activity bar → **Harness** → sub-nav **Results** |
| **Environments** | Activity bar → **Environments** |
| **After a run** | Click **View Full Results →** in the completion banner |

### Environment Setup

1. Build and launch the Tauri desktop app: `npm run tauri:dev`
2. Wait for the app window to appear — **"RedfireForge — Redfire Performance Workbench"** title bar
3. Open browser DevTools (Cmd+Opt+I) → **Console** tab — keep this visible for errors
4. Confirm Rust executor is available:
   - Open DevTools Console
   - You should NOT see any `"Rust executor not available"` warnings during test runs

### Prerequisite: Create Test Environment

1. Go to **Environments** (activity bar)
2. Create environment **"Test-3A"** with base URL pointing to any live REST API you have access to
   (e.g., `https://jsonplaceholder.typicode.com` or your own test API)
3. Select **Test-3A** as the active environment in the header dropdown

### Prerequisite: Create Test Scenarios

Create the following scenarios in a Feature Group called **"Phase 3A Validation Tests"**:

**Scenario A — Happy Path (GET)**
- Method: `GET`
- URL: `/posts/1` (or any endpoint that returns a JSON object with known fields)
- No authentication

**Scenario B — List Endpoint (GET)**
- Method: `GET`
- URL: `/posts` (or any endpoint that returns a JSON array)
- No authentication

**Scenario C — Error Endpoint**
- Method: `GET`
- URL: `/posts/99999` (or any URL that returns 404)
- No authentication

**Scenario D — POST with Body**
- Method: `POST`
- URL: `/posts`
- Body: `{"title": "test", "body": "hello", "userId": 1}`
- Header: `Content-Type: application/json`

> **Note:** The exact URLs depend on your test API. Adjust paths to match endpoints that
> return known response structures. The key is having: one that succeeds with a JSON object,
> one that returns an array, one that returns an error, and one POST.

### How to Confirm Rust Executor is Being Used

When running a test on the Tauri desktop app:
- The Rust path is auto-selected when: (a) running on desktop/Tauri, (b) not in workflow mode,
  (c) no sub-workflow resolver, (d) no OAuth2 auth scenarios
- All scenarios above use no auth → Rust executor will be used
- If you see results appearing, the Rust executor handled validation (JS fallback would also work
  but we want to confirm Rust)

### How to Add an Assertion (referenced by all Part 4 scenarios)

This is the standard flow for adding any assertion — all Part 4 scenarios reference this:

1. Open a test scenario → click **Edit** to open the Edit Test modal
2. Click the **Validation** tab in the modal tab bar
3. In the **Assertions** section at the top, click the **+ Add** button
4. A dropdown menu appears with 4 categories: **Response**, **Field Validation**, **Array & Structure**, **Schema & Advanced**
5. Optionally type in the **Filter assertions…** search box to narrow the list
6. Click the desired assertion type (e.g., **Status Code**, **Response Time SLA**, etc.)
7. A new assertion row appears — fill in the fields described in each scenario below
8. Click **Save** in the modal footer to save changes

### How to Negate an Assertion

- Each assertion row has a **NOT** button (appears right after the type badge like `STATUS`, `TIME`, etc.)
- Click **NOT** once to enable negation (the row highlights with a negated style)
- Click **NOT** again to disable negation
- Tooltip when inactive: *"Click to negate this assertion (NOT)"*
- Tooltip when active: *"Negated — click to remove NOT"*

---

## Part 1: Validation Mode — None

### Scenario 1.1: No Body Validation — Pass on HTTP 200

**Goal:** Confirm that `mode: none` skips body validation entirely and passes based on HTTP status.

#### Steps

1. Open **Scenario A** (Happy Path GET) → click **Edit**
2. Click the **Validation** tab
3. In the **Body Validation** section, select the radio button **No Body Validation** (mode: `none`)
4. In the **Assertions** section, make sure there are no assertions (remove any with the **×** button)
5. Click **Save**
6. Go to **Harness** (activity bar) → **Test Runner** (sub-nav)
7. Select **Scenario A** and click **▶ Run Test** (single execution, 1 iteration)
8. Wait for completion

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] `validationMode` tag shows **none** (or no validation tag)
- [ ] No failure details — the result row has no validation error messages
- [ ] Click on the result row → **Response Detail Modal** opens
- [ ] The modal shows the response body but NO failure table (no validations ran)
- [ ] HTTP status shows `200` in the detail

---

### Scenario 1.2: No Body Validation — Fail on HTTP 404

**Goal:** Confirm that `mode: none` fails on bad HTTP status (no status assertion).

#### Steps

1. Open **Scenario C** (Error Endpoint, returns 404) → click **Edit**
2. Click the **Validation** tab → select **No Body Validation** radio
3. Remove all assertions (click **×** on each row)
4. Click **Save**, then run the test

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure detail shows path `(http)` with expected `"2xx"` and actual `"HTTP 404"` (or the API's error message text)
- [ ] Click row → Response Detail Modal shows the HTTP failure
- [ ] No body validation failures (mode is none)

---

### Scenario 1.3: No Body Validation — Pass on HTTP 404 WITH Status Assertion

**Goal:** Confirm that a passing status assertion on 404 makes the test pass when mode is none.

#### Steps

1. Open **Scenario C** → Edit → **Validation** tab
2. Select **No Body Validation**
3. Click **+ Add** → under **Response** category → click **Status Code**
4. In the new assertion row, type `404` in the expected input field
5. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] The status assertion passed (expected 404, got 404)
- [ ] No `(http)` overlay failure (status assertion suppresses the HTTP overlay)
- [ ] No body validation failures

---

## Part 2: Validation Mode — Full JSON Match

### Scenario 2.1: Full Match — Exact Body Match Passes

**Goal:** Confirm `mode: full` with exact expected JSON passes.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select the **Full JSON Match** radio button
3. A textarea labeled **Expected JSON Response** appears below
4. To get the correct expected value:
   - Temporarily switch to **Selective Fields** mode
   - Click **Fetch Response** to make a live request
   - Copy the response body shown in the response preview
   - Switch back to **Full JSON Match**
   - Paste the copied JSON into the **Expected JSON Response** textarea
5. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] `validationMode` shows **full**
- [ ] No failure details
- [ ] Click row → Response Detail Modal → no failures table

---

### Scenario 2.2: Full Match — Mismatch Produces Failures

**Goal:** Confirm `mode: full` reports deep comparison failures.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select **Full JSON Match**
3. In **Expected JSON Response**, paste a modified version of the response:
   - Change one string field value (e.g., change the `"title"` value to `"WRONG TITLE"`)
   - Change one number field value (e.g., change `"userId": 1` to `"userId": 999`)
   - Add a field that doesn't exist in the response (e.g., `"extraField": true`)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure details show multiple entries with:
  - Each failure has a `path` (e.g., `title`, `userId`)
  - Each failure shows `expected` vs `actual` values
  - Missing/extra keys reported correctly
- [ ] Click row → Response Detail Modal → failure table shows all mismatches
- [ ] Paths are dot-notation (e.g., `data.name`, `items[0].price`)

---

### Scenario 2.3: Full Match — Invalid Expected JSON

**Goal:** Confirm malformed expected JSON produces a parse error failure, not a crash.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select **Full JSON Match**
3. In **Expected JSON Response**, type invalid JSON: `{ broken json here`
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure detail shows path `(parse)` with expected `"valid JSON"` and actual containing `"parse error"`
- [ ] No crash or unhandled error in the console
- [ ] Only one failure entry (the parse error)

---

## Part 3: Validation Mode — Selective Fields

### Scenario 3.1: Selective — Simple Field Matching via Data Mapper

**Goal:** Confirm selective field validation with basic operators through the Data Mapper UI.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select the **Selective Fields** radio button
3. The selective mode controls appear: **Unordered array matching** checkbox, **Fetch Response** button, and **⚡ Data Mapper** button
4. Click **Fetch Response** — wait for the response to load in the preview below
5. Click **⚡ Data Mapper** to open the mapping modal (title: *"Response Body → Validation Rules"*)
6. In the Data Mapper modal:
   - The left panel shows **Response Body** (source tree from the fetched JSON)
   - The right panel shows **Validation Fields** (target)
   - **Drag** a string field (e.g., `title`) from the source to the target panel
   - After dropping, an **operator pill** appears on the target node — click it to open the operator picker
   - Select **equals** — the expected value auto-fills from the sample
   - **Drag** a number field (e.g., `userId`) → set operator to **greater_than** → set value to `0` (below actual value)
   - **Drag** another string field → set operator to **contains** → set value to a substring of the actual
7. Click **Save** in the Data Mapper modal footer to save mappings
8. Back in the Validation tab, you should see a **Validation Rules (3)** summary
9. Click **Save** in the Edit Test modal, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] `validationMode` shows **selective**
- [ ] No failure details
- [ ] All three field validations passed silently

---

### Scenario 3.2: Selective — Field Mismatch

**Goal:** Confirm selective validation reports correct failures on mismatch.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab → select **Selective Fields**
2. Click **Fetch Response**, then click **⚡ Data Mapper**
3. In the Data Mapper:
   - Map a string field → set operator to **equals** → manually change the expected value to `"nonexistent"` (wrong value)
   - Map a number field → set operator to **less_than** → set value to `0` (below the actual, so actual > 0 fails "less_than 0")
4. Click **Save** in Data Mapper, then **Save** in Edit Test modal, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure details show 2 entries:
  - First: path = the string field path, expected = `"equals nonexistent"`, actual = the real value
  - Second: path = the number field path, expected = `"less_than 0"`, actual = the real number
- [ ] Click row → Response Detail Modal → both failures visible in the table

---

### Scenario 3.3: Selective — Unordered Array Matching

**Goal:** Confirm `unorderedArrays: true` matches array elements regardless of index.

#### Steps

1. Open **Scenario B** (List Endpoint, returns array) → Edit → **Validation** tab → select **Selective Fields**
2. Check the **☐ Unordered array matching** checkbox (label: *"ignore array item positions, match by value instead"*)
3. Click **Fetch Response** to load the sample
4. Click **⚡ Data Mapper** and map fields from array elements, but use **different indices**
   than where they actually appear:
   - e.g., if item at `[0]` has `title: "X"`, map `[1].title` → equals `"X"`
5. Click **Save** in Data Mapper, then **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — unordered matching found the item at a different index
- [ ] No failure details
- [ ] Now uncheck **Unordered array matching** and re-run:
- [ ] Test shows **Failed** (red ✗) — ordered matching can't find the value at the wrong index

---

### Scenario 3.4: Selective — Path Remapping (tryRemapPaths)

**Goal:** Confirm auto path remapping when the response structure differs from expected paths.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab → select **Selective Fields**
2. Click **Fetch Response**, then click **⚡ Data Mapper**
3. Add fields with paths that include an extra root prefix:
   - If the response is `{"id": 1, "title": "..."}`, manually edit a mapping path to `$.post.id` → equals `1`
   - (The path `post.id` doesn't exist — the actual root key might be different)
4. Click **Save**, then run

#### Expected Results

- [ ] If `tryRemapPaths` can find a better mapping (e.g., stripping `post.`), the failure
  details should show the **remapped** paths with correct actual values
- [ ] If no remapping is possible, failures show `actual: "undefined"` for all fields

---

## Part 4: Assertions

> **Reminder:** To add any assertion, use the flow described in [How to Add an Assertion](#how-to-add-an-assertion-referenced-by-all-part-4-scenarios) above:
> Click **+ Add** → browse or search the categories → click the assertion type.

### Scenario 4.1: Status Code Assertion — Exact Match

**Goal:** Confirm status code assertions work in Rust.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select **No Body Validation** radio
3. Click **+ Add** → category **Response** → click **Status Code**
4. In the new `STATUS` row, type `200` in the expected input (placeholder: *"200, 2xx, 200-299"*)
5. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] Status assertion evaluated and passed

---

### Scenario 4.2: Status Code Assertion — Range Match

**Goal:** Confirm status range patterns work.

#### Steps

1. Same scenario (Scenario A with Status Code assertion)
2. Edit the status assertion expected to `2xx`
3. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)

#### Then:

4. Edit → change expected to `200-299` → Save → Run

- [ ] Test shows **Passed** (green ✓)

5. Edit → change expected to `4xx` → Save → Run (Scenario A returns 200)

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure path shows `(status)` with expected `"4xx"` and actual `"200"`

---

### Scenario 4.3: Response Time SLA Assertion

**Goal:** Confirm response time threshold assertions.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Remove other assertions → Click **+ Add** → category **Response** → click **Response Time SLA**
3. In the new `TIME` row, type `10000` in the max input (unit shows `ms`)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — 10 seconds is a generous threshold

#### Then:

5. Edit → change max to `1` (1ms — virtually impossible to pass)
6. Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(responseTime)` with expected `"≤ 1ms"` and actual showing the real time (e.g., `"235ms"`)

---

### Scenario 4.4: Header Assertion

**Goal:** Confirm header assertions work in Rust.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → category **Response** → click **Response Header**
3. In the new `HEADER` row:
   - Type `content-type` in the header name input (placeholder: *"Header name"*)
   - Select `contains` from the operator dropdown (options: `equals`, `contains`, `regex`, `exists`)
   - Type `json` in the value input (placeholder: *"Expected value"*)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — most APIs return `application/json`

#### Then:

5. Edit → change value to `xml` (mismatch) → Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(header:content-type)` with actual containing the real content-type value

---

### Scenario 4.5: Regex Match Assertion

**Goal:** Confirm regex pattern matching on response body fields.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → category **Field Validation** → click **Regex Match**
3. In the new `REGEX` row:
   - Type a JSON path for a string field in the path input (e.g., `$.title`)
   - Alternatively, click the **⎆** path picker button (requires a fetched sample first)
   - Type a regex pattern that matches the actual value (e.g., `^[a-zA-Z ]+$` for a text title)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)

#### Then:

5. Edit → change pattern to something that won't match (e.g., `^[0-9]+$` for a text field)
6. Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure path shows `(regex:$.title)` with expected `"matches /^[0-9]+$/"` and actual showing the real value (truncated to 200 chars max)

---

### Scenario 4.6: Numeric Compare Assertion

**Goal:** Confirm numeric comparison assertions.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → category **Field Validation** → click **Numeric Compare**
3. In the new `NUMBER` row:
   - Type a JSON path for a number field (e.g., `$.userId`) or use the **⎆** picker
   - Select `greater than (>)` from the comparison dropdown
   - Type `0` in the value input
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — userId is 1, which is > 0

#### Then:

5. Edit → change value to `999999` (much larger than actual) → Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(numeric:$.userId)` with expected `"> 999999"` and actual showing the real value (e.g., `"1"`)

---

### Scenario 4.7: Field Exists Assertion

**Goal:** Confirm field existence checks.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → category **Field Validation** → click **Field Exists**
3. In the new `EXISTS` row:
   - Type `$.title` in the JSON path input or use the **⎆** picker
   - Select `exists` from the dropdown (options: `exists`, `does not exist`)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — the `title` field exists

#### Then:

5. Edit → change jsonPath to `$.nonexistent_field_xyz` → Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(existence:$.nonexistent_field_xyz)` with expected `"field exists"` and actual `"field not found"`

---

### Scenario 4.8: Type Check Assertion

**Goal:** Confirm type checking on response body fields.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → category **Field Validation** → click **Type Check**
3. In the new `TYPE` row:
   - Type `$.userId` in the JSON path input or use the **⎆** picker
   - Select `number` from the type dropdown (options: `string`, `number`, `boolean`, `array`, `object`, `null`)
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — userId is a number

#### Then:

5. Edit → change type to `string` (userId is a number, not a string) → Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(typeCheck:$.userId)` with expected `"type string"` and actual `"type number"`

---

### Scenario 4.9: Custom Predicate (JS Fallback)

**Goal:** Confirm that custom predicates are evaluated by JS post-hoc (not Rust).

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → **Response** → **Status Code** → type `200` (this goes to Rust)
3. Click **+ Add** → **Schema & Advanced** → **Custom Predicate**
4. In the new `CUSTOM` row:
   - Type expression: `$.body.userId === 1` in the expression input (placeholder: *"$gt($count($.body.offers), 0)"*)
   - Optionally type a description: `Check userId is 1`
5. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓) — both assertions pass
- [ ] The status assertion was handled by Rust
- [ ] The custom predicate was evaluated by JS in the passthrough merge step
- [ ] No errors in the console about custom assertions

#### Then:

6. Edit → change custom expression to `$.body.userId === 99999` (will fail)
7. Save → Run

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure details include the custom assertion failure
- [ ] The status assertion (Rust) still passed — only the custom (JS) failed
- [ ] `passed` is `false` because custom failure was merged

---

### Scenario 4.10: Multiple Assertions — Mixed Pass/Fail

**Goal:** Confirm all assertion failures are collected, not short-circuited.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Remove any existing assertions, then add these (via **+ Add** for each):
   - **Status Code** (under Response): expected `200` → will PASS
   - **Response Time SLA** (under Response): max `10000` → will PASS
   - **Numeric Compare** (under Field Validation): path `$.userId`, operator `greater than (>)`, value `999999` → will FAIL
   - **Regex Match** (under Field Validation): path `$.title`, pattern `^[0-9]+$` → will FAIL (title is text)
   - **Field Exists** (under Field Validation): path `$.nonexistent`, select `exists` → will FAIL
3. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure details show **exactly 3 failures** (numeric, regex, existence)
- [ ] Status and response time assertions are NOT in the failure list (they passed)
- [ ] All three failure paths are distinct: `(numeric:$.userId)`, `(regex:$.title)`, `(existence:$.nonexistent)`
- [ ] Click row → Response Detail Modal → all 3 failures visible in the table

---

### Scenario 4.11: Negated Assertion

**Goal:** Confirm the NOT button inverts pass/fail logic on assertions.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Click **+ Add** → **Status Code** → type `200`
3. Click the **NOT** button on the status assertion row (it should highlight/activate)
   - This means: "assert status is NOT 200" — should fail since it IS 200
4. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows path `(status)` with expected `"NOT (assertion to fail)"` and actual `"assertion passed (negated → fail)"`

#### Then:

5. Edit → change expected to `404`, keep NOT active
   - This means: "assert status is NOT 404" — should pass since it's 200 (not 404)
6. Save → Run

- [ ] Test shows **Passed** (green ✓)

---

## Part 5: Assertion + Validation Combination

### Scenario 5.1: Assertions + Selective Fields Together

**Goal:** Confirm assertions and selective field validation both run and merge results.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab
2. Select **Selective Fields** radio
3. Click **Fetch Response**, then click **⚡ Data Mapper**
4. Map one field with **equals** → correct value → **Save** the mapper
5. Back in the Validation tab, add assertions via **+ Add**:
   - **Status Code**: `200`
   - **Response Time SLA**: max `10000`
6. Click **Save** in Edit Test modal, then run

#### Expected Results

- [ ] Test shows **Passed** (green ✓)
- [ ] Both assertions and selective field validations passed
- [ ] `validationMode` shows **selective**

---

### Scenario 5.2: Passing Status Assertion on 404 Enables Body Validation

**Goal:** Confirm that a passing status assertion allows body validation to run even on 404.

#### Steps

1. Open **Scenario C** (404 endpoint) → Edit → **Validation** tab
2. Select **Selective Fields** (or **Full JSON Match**)
3. Click **+ Add** → **Status Code** → type `404` (will pass since response IS 404)
4. If using Selective Fields:
   - Click **Fetch Response** (the 404 response will be fetched)
   - Click **⚡ Data Mapper** and map a field from the 404 response body → **Save**
5. Click **Save** in Edit Test modal, then run

#### Expected Results

- [ ] Status assertion passes (404 matches expected 404)
- [ ] Body validation runs (because `statusAsserted = true` and status passed → `statusOk = true`)
- [ ] Overall result depends on body validation correctness
- [ ] No `(http)` overlay failure (status assertion suppresses it)

---

### Scenario 5.3: HTTP 500 Without Status Assertion — Body Validation Skipped

**Goal:** Confirm the HTTP failure overlay drops body validation failures.

#### Steps

1. Create a scenario pointing to an endpoint that returns HTTP 500
   (or temporarily modify Scenario C URL to hit a 500 endpoint)
2. Edit → **Validation** tab → select **Selective Fields**
3. Click **Fetch Response** and set up some field mappings in the **⚡ Data Mapper**
4. Do NOT add a status assertion
5. Click **Save**, then run

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Only ONE failure: path `(http)` with expected `"2xx"` and actual `"HTTP 500"` (or the error message text)
- [ ] Body validation failures are NOT shown (they're dropped when HTTP fails without status assertion)
- [ ] `validationMode` still shows **selective** (mode was configured, just not evaluated)

---

## Part 6: Parameterized/Batch Execution

### Scenario 6.1: Multiple Scenarios in Pool Mode

**Goal:** Confirm Rust validation works across multiple scenarios in batch.

#### Steps

1. Create 3 scenarios in the same Feature Group:
   - **Test 1**: GET, valid URL, add **Status Code** assertion `200` → should pass
   - **Test 2**: GET, valid URL, add **Numeric Compare** assertion with impossible value (e.g., `$.userId > 999999`) → should fail
   - **Test 3**: GET, 404 URL, no assertions → should fail (HTTP overlay)
2. Select all 3 in the Test Runner (check their checkboxes)
3. Set execution mode to **Pool**, concurrency to `2`
4. Click **▶ Run Test**, wait for completion

#### Expected Results

- [ ] Results show 3 entries total
- [ ] Test 1: **Passed** (green ✓)
- [ ] Test 2: **Failed** (red ✗) with numeric assertion failure at path `(numeric:...)`
- [ ] Test 3: **Failed** (red ✗) with `(http)` failure
- [ ] Each result has independent validation results
- [ ] Pass/fail counts in summary: 1 passed, 2 failed

---

### Scenario 6.2: Load Profile with Validation

**Goal:** Confirm validation runs correctly under sustained load.

#### Steps

1. Open **Scenario A** and configure:
   - **Selective Fields** mode with 2 correct field mappings (via **⚡ Data Mapper**)
   - Assertions (via **+ Add**): **Status Code** `200` + **Response Time SLA** max `30000`
2. In the Test Runner, set execution mode to **Load Profile**:
   - Duration: `10` seconds
   - Concurrency: `5`
   - Profile: `Constant` (sustained)
3. Click **▶ Run Test**

#### Expected Results

- [ ] Test completes after ~10 seconds
- [ ] Live progress panel shows validation results streaming in
- [ ] `Validation Failures` counter in live metrics shows `0` (all should pass)
- [ ] After completion, results show all entries as Passed
- [ ] `validationMode` shows **selective** for every result
- [ ] Summary shows 0 failed validations

---

## Part 7: Edge Cases

### Scenario 7.1: Empty Response Body

**Goal:** Confirm Rust handles empty/no body without crashing.

#### Steps

1. Create a scenario hitting an endpoint that returns empty body (e.g., 204 No Content,
   or a DELETE that returns empty)
2. Edit → **Validation** tab → select **Full JSON Match** → paste `{}` in Expected JSON
3. Add a **Status Code** assertion matching the actual status (e.g., `204`)
4. Click **Save**, then run

#### Expected Results

- [ ] Test completes without crash
- [ ] If body is empty and expected is `{}`, validation shows appropriate mismatch or parse handling
- [ ] No unhandled errors in console

---

### Scenario 7.2: Large Response Body

**Goal:** Confirm Rust validation handles large responses (body cap truncation).

#### Steps

1. Create a scenario hitting an endpoint that returns a large JSON array (100+ items)
   (e.g., `https://jsonplaceholder.typicode.com/comments`)
2. Edit → **Validation** tab → select **Selective Fields**
3. Click **Fetch Response**, then click **⚡ Data Mapper**
4. Map a field from the first element (e.g., `$[0].name` → **equals** → correct value)
5. Add a **Status Code** assertion: `200`
6. Click **Save**, then run

#### Expected Results

- [ ] Test completes successfully
- [ ] Selective field validation works on the response (validation runs before body truncation)
- [ ] No timeout or memory issues
- [ ] Response Detail Modal shows the (potentially truncated) body

---

### Scenario 7.3: Network Error (Unreachable Host)

**Goal:** Confirm Rust handles network errors correctly.

#### Steps

1. Create a scenario with URL pointing to an unreachable host:
   `http://192.0.2.1:9999/test` (TEST-NET address, will timeout)
2. Edit → **Validation** tab → select **Selective Fields** and add some fields
3. In the Test Runner, set timeout to `3` seconds (to avoid waiting too long)
4. Click **▶ Run Test**

#### Expected Results

- [ ] Test shows **Failed** (red ✗)
- [ ] Failure shows `(http)` path with expected `"2xx"` and actual `"network error"` or the timeout error message
- [ ] `httpStatus` is `0` in the result
- [ ] Body validation was skipped (network error → no body)
- [ ] No crash or hang

---

### Scenario 7.4: Special Characters in Field Values

**Goal:** Confirm Rust handles UTF-8, special characters, HTML entities in validation.

#### Steps

1. Create a POST scenario that echoes back special characters:
   - Body: `{"name": "日本語テスト", "html": "<script>alert('xss')</script>"}`
2. Edit → **Validation** tab → select **Selective Fields**
3. Click **Fetch Response**, then click **⚡ Data Mapper**
4. Map the fields with the exact expected values (including special chars)
5. Click **Save**, then run

#### Expected Results

- [ ] Field validation correctly compares UTF-8 strings
- [ ] No encoding issues in the failure details
- [ ] Special characters display correctly in the Response Detail Modal

---

## Part 8: Results Persistence & Export

### Scenario 8.1: Results Saved with Validation Data

**Goal:** Confirm test results with validation details are persisted and loadable.

#### Steps

1. Run **Scenario A** with:
   - **Selective Fields** validation with 2 field mappings (one correct, one with wrong expected value to cause failure)
   - **Status Code** assertion: `200` (will pass)
2. After completion, note the results (which fields passed/failed)
3. Navigate away from Results Dashboard (click a different page in the sidebar)
4. Navigate back to Results Dashboard
5. Find the run and click to open it

#### Expected Results

- [ ] All results are still present after navigation
- [ ] Pass/fail status preserved
- [ ] `validationMode` tags preserved
- [ ] Failure details (path, expected, actual) preserved
- [ ] Clicking a result row still opens Response Detail Modal with correct failure table

---

### Scenario 8.2: CSV Export Includes Validation

**Goal:** Confirm CSV export has validation columns.

#### Steps

1. Run a test with mixed pass/fail validation results (e.g., from Scenario 8.1)
2. Open Results Dashboard → select the run
3. Click the **Export CSV** button (in the run detail header)
4. Open the downloaded CSV file in a text editor or spreadsheet

#### Expected Results

- [ ] CSV has these column headers: `Scenario`, `Data Row ID`, `Data Row Label`, `URL`, `Method`, `HTTP Status`, `Response Time (ms)`, **`Validation`**, **`Passed`**, **`Failure Path`**, **`Expected`**, **`Actual`**, `Error Message`, `Timestamp`
- [ ] `Passed` column shows `true` or `false`
- [ ] `Validation` column shows `none`, `full`, or `selective`
- [ ] For failed results with multiple failure details, there are **multiple rows** per result (one row per failure), each with the same scenario/URL but different `Failure Path`, `Expected`, `Actual` values
- [ ] For passed results, `Failure Path`, `Expected`, `Actual` columns are empty

---

## Part 9: Rust vs JS Parity Verification

### Scenario 9.1: Selective Fields — Verify vs Run Comparison

**Goal:** Verify that the editor Verify (JS) and actual run (Rust) produce identical validation results.

> **Note:** The **Verify** button is only available in **Selective Fields** mode. It makes a **live HTTP
> request** and runs JS-side validation against the live response — it does NOT use a stored sample.

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab → select **Selective Fields**
2. Click **Fetch Response** to get sample
3. Click **⚡ Data Mapper** → map 3 fields with a mix of operators (equals, greater_than, contains) → **Save**
4. Add 3 assertions via **+ Add**: **Status Code** `200`, **Numeric Compare** on a number field, **Field Exists** on a known field
5. Click the **Verify** button (below the rules summary)
   - Verify scope should be **All** (default)
   - Verify makes a live request and shows results: **PASSED** or **FAILED** with a discrepancy table
6. Note the verify results (pass/fail for each field and assertion)
7. Click **Save** in Edit Test modal
8. Run the actual test (which uses the Rust executor)
9. Compare the actual run results with the Verify results

#### Expected Results

- [ ] Editor Verify (JS) and actual run (Rust) show the same pass/fail for every field
- [ ] Same failure details (path, expected, actual strings match)
- [ ] If any discrepancy exists, it's a parity bug between Rust and JS engines

---

### Scenario 9.2: Full Mode — Side by Side Comparison

**Goal:** Verify Rust deep_compare matches JS deep comparison.

> **Note:** The Verify button is NOT available in Full JSON Match mode. Instead, compare
> results between a JS-only run (web browser) and a Rust run (desktop app).

#### Steps

1. Open **Scenario A** → Edit → **Validation** tab → **Full JSON Match**
2. Paste a slightly modified expected JSON (change 2 values, add 1 extra key)
3. **Run 1 (Rust):** Run the test on the Tauri desktop app → note the failure details
4. **Run 2 (JS):** If you have the web version running (`npm run dev` on port 5173),
   open the same test in the browser and run it → note the failure details
5. Compare the two sets of failure details

#### Expected Results

- [ ] Same number of failures
- [ ] Same paths in failures
- [ ] Same expected/actual values in each failure
- [ ] Order of failures may differ (not significant)

---

## Part 10: Performance Observation

### Scenario 10.1: High-Volume Validation Performance

**Goal:** Observe that Rust validation doesn't degrade under load.

#### Steps

1. Open **Scenario A** and configure complex validation:
   - **Selective Fields** mode with 5+ field mappings (via **⚡ Data Mapper**)
   - 5 assertions (via **+ Add**): **Status Code** `200`, **Response Time SLA** max `30000`, **Numeric Compare**, **Regex Match**, **Field Exists**
2. In the Test Runner, set execution mode to **Load Profile**: duration `30` seconds, concurrency `10`
3. Click **▶ Run Test** and watch the Live Progress Panel during execution

#### Expected Results

- [ ] Results stream in smoothly without UI freezing
- [ ] `Validation Failures` counter updates in real-time
- [ ] TPS (transactions per second) remains stable throughout the run
- [ ] No "Maximum call stack" or memory errors in console
- [ ] Response Detail Modal opens quickly even after hundreds of results

---

## Quick Reference: Assertion Types vs UI

| Assertion Type | Menu Label | Badge | Path Format | What Passes | What Fails |
|---|---|---|---|---|---|
| Status | Status Code | `STATUS` | `(status)` | HTTP status matches pattern | Status doesn't match |
| Response Time | Response Time SLA | `TIME` | `(responseTime)` | `responseTimeMs ≤ maxMs` | Exceeds threshold |
| Header | Response Header | `HEADER` | `(header:{name})` | Header exists/matches | Missing or mismatch |
| Regex | Regex Match | `REGEX` | `(regex:{jsonPath})` | Pattern matches value | No match (actual truncated to 200 chars) |
| Numeric | Numeric Compare | `NUMBER` | `(numeric:{jsonPath})` | Comparison passes | Comparison fails or non-numeric |
| Existence | Field Exists | `EXISTS` | `(existence:{jsonPath})` | Path exists (even if null) | Path not found |
| Type Check | Type Check | `TYPE` | `(typeCheck:{jsonPath})` | Value type matches | Type mismatch |
| Array Length | Array Length | `ARRAY` | `(arrayLength:{jsonPath})` | Length comparison passes | Wrong length or not array |
| Array Contains | Array Contains | `CONTAINS` | `(arrayContains:{jsonPath})` | Mode (any/all/only/none) passes | Mode fails |
| Each | Each Element | `EACH` | `(each:{jsonPath})` | All elements pass operator | Any element fails |
| Contains Subset | Contains Subset | `SUBSET` | `(containsSubset:{jsonPath})` | Subset found in value | Subset mismatch |
| JSON Schema | JSON Schema | `SCHEMA` | `(jsonSchema#N:{path})` | Response matches schema | Schema violations |
| Body Size | Body Size | `SIZE` | `(bodySize)` | Size within threshold | Exceeds threshold |
| Date | Date Compare | `DATE` | `(date:{jsonPath})` | Date comparison passes | Date mismatch or invalid |
| Date Precise | Date Precise | `DATE⁺` | `(datePrecise:{jsonPath})` | Truncated comparison passes | Truncated mismatch |
| Custom | Custom Predicate | `CUSTOM` | _(JS only — not in Rust)_ | Expression evaluates truthy | Expression is falsy |

---

## Checklist Summary

| Part | Scenarios | Focus |
|------|-----------|-------|
| 1 | 1.1 – 1.3 | Validation mode: none |
| 2 | 2.1 – 2.3 | Validation mode: full |
| 3 | 3.1 – 3.4 | Validation mode: selective |
| 4 | 4.1 – 4.11 | All assertion types |
| 5 | 5.1 – 5.3 | Assertion + validation combinations |
| 6 | 6.1 – 6.2 | Batch/load execution |
| 7 | 7.1 – 7.4 | Edge cases |
| 8 | 8.1 – 8.2 | Persistence & export |
| 9 | 9.1 – 9.2 | Rust vs JS parity |
| 10 | 10.1 | Performance |
| **Total** | **30 scenarios** | |
