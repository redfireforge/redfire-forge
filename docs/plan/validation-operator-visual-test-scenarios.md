# Validation Operator — Visual Test Scenarios

> **Purpose:** Step-by-step manual test guide covering every feature from each implementation phase (P0–P9.4) of the Validation & Assertion Operator system.
>
> **How to use:** Work through each phase sequentially. Every scenario has **Setup**, **Steps**, and **Expected** sections. Check the box when each test passes.
>
> **Navigation to the Validation Mapper:**
> 1. Open RedfireForge (web: `npm run dev` → http://localhost:5173, or desktop app)
> 2. Go to **Testing** → **Scenarios**
> 3. Create or open a test scenario
> 4. Click **Edit** to open the **Test Editor**
> 5. Go to the **Validation** tab
> 6. Set **Body Validation** to **Selective Fields**
> 7. Click **Fetch Response** (or paste sample JSON) to populate the response body
> 8. Click **Visual Mapper** to open the Data Mapper Modal
>
> **Sample JSON for testing** (paste into the sample area if Fetch is unavailable):
> ```json
> {
>   "status": "active",
>   "count": 42,
>   "isActive": true,
>   "isDeleted": false,
>   "deletedAt": null,
>   "createdAt": "2026-01-15T10:30:00Z",
>   "name": "OnStar Premium Package",
>   "email": "test@example.com",
>   "tags": ["vip", "premium", "early-access"],
>   "metadata": {
>     "version": 2,
>     "internal": "_debug_flag"
>   },
>   "offers": [
>     {
>       "offerName": "EV Access - 8 Years",
>       "associatedOfferingCode": "ONZFCNCPR3MCAL4",
>       "rank": 1,
>       "isActive": true,
>       "productCode": "EV-ACC-8Y",
>       "duration": { "value": 365, "unit": "days" },
>       "price": 49.99
>     },
>     {
>       "offerName": "OnStar Safety Plan",
>       "associatedOfferingCode": "ONSAFE2024",
>       "rank": 2,
>       "isActive": true,
>       "productCode": "SAFE-24",
>       "duration": { "value": 180, "unit": "days" },
>       "price": 29.99
>     },
>     {
>       "offerName": "Premium Navigation",
>       "associatedOfferingCode": "NAV-PREM-01",
>       "rank": 3,
>       "isActive": false,
>       "productCode": "NAV-P",
>       "duration": { "value": 90, "unit": "days" },
>       "price": 15.50
>     }
>   ],
>   "errors": [],
>   "config": {
>     "retryCount": 3,
>     "timeout": 5000
>   },
>   "latitude": 40.7128,
>   "longitude": -74.0060
> }
> ```

---

## Phase 0 — Adapter Capability Framework

### P0-01: Capability-gated UI — Operator pills only appear for validation adapter

- [x] **Setup:** Open the Visual Mapper from the **Validation** tab (as described above).
- [x] **Steps:**
  1. Drag a source field (e.g., `status`) onto a target field.
  2. Observe that an **operator pill** (green `= equals`) appears between the arrow (←) and the source path on the target row.
- [x] **Expected:** Operator pill is visible, colored green, and clickable.

### P0-02: Operator pills are NOT shown for non-validation adapters

- [x] **Setup:** Open the Visual Mapper from the **Extraction** context (Test Editor → **Extract** tab → Visual Mapper).
- [x] **Steps:**
  1. Create a mapping by dragging a source field to a target.
  2. Inspect the target row.
  3. Right-click the mapped target field to open the context menu.
  4. Check the toolbar for the **Rules** button.
- [x] **Expected:** No operator pill appears. The row shows only `targetField ← sourcePath` without any operator badge. The right-click context menu shows **Rename…**, **Edit expression…**, and **Remove mapping** — but does NOT show "Set operator…" (operator actions are exclusive to the validation adapter). The **Rules** button does NOT appear in the toolbar, and no "Validation Rules" panel is shown at the bottom (the code editor/rules panel is exclusive to the validation adapter).

### P0-03: Array assertions gated by capability

- [x] **Setup:** In the Validation Mapper, locate an array node in the target tree (e.g., `offers`).
- [x] **Steps:**
  1. Right-click on the `offers` array node.
  2. Check the context menu.
- [x] **Expected:** The context menu shows **Array Assertions** section with descriptive options: "Check array size" (with example), "Must contain value", "Every item must match", "Contains JSON object". Each option shows a context-aware example using the node name.
- [x] **Additional fixes applied:**
  - Array assertion handlers (`onAddArrayAssertion`, `onUpdateArrayAssertion`, `onRemoveArrayAssertion`) correctly gated by `caps.arrayAssertions` (was incorrectly gated by `caps.operators`).
  - Context menu suppresses browser native right-click on all target nodes.
  - Unmapped non-array nodes no longer show an empty context menu box.
  - Only custom-origin fields show "Rename..." (fetched response fields do not).
  - Assertion value "1" is visible, editable, and styled with solid border and bold text.

### P0-04: Code editor gated by capability

- [x] **Setup:** Compare the Validation Mapper toolbar to the Extraction Mapper toolbar.
- [x] **Steps:**
  1. Open the Visual Mapper from the **Validation** tab. Look for the **Rules** button in the toolbar.
  2. Close the mapper. Open the Visual Mapper from the **Extract** tab. Look for the **Rules** button.
- [x] **Expected:** The **Rules** button is visible only in the validation context. It is **absent** in the extraction, variable binding, request body, and demo adapters — these adapters do not have validation rules to manage (`codeEditor` capability is `false`).

---

## Phase 1 — Field Operator Foundation (24 Operators)

### P1-01: Default operator on auto-map

- [x] **Setup:** Open the Validation Mapper with sample JSON loaded.
- [x] **Steps:**
  1. Click the **Auto-map** button in the toolbar.
  2. Accept the suggested mappings.
  3. Inspect the operator pills on the mapped fields.
- [x] **Expected:** All auto-mapped fields default to the `exists` operator (gray `∃ exists` pill), preventing false failures on type mismatches. Implemented via `autoMapDefaultOperator: 'exists'` in the validation adapter. Manually mapped fields still default to `equals`.

### P1-02: Equality operators (equals, not_equals)

- [x] **Setup:** Drag a source field (e.g. `planType`) to a target field.
- [x] **Steps:**
  1. After mapping, the field automatically shows a green `= equals` pill — no manual selection needed.
  2. Click the operator pill to open the picker. Switch to **≠ not equals**.
  3. Verify the pill changes to green `≠ not equals`.
- [x] **Expected:** Manual drag-drop mappings default to `equals` (green pill). Switching to `not_equals` also shows a green pill. Both operators work without requiring an explicit value input since the source reference provides the expected value.

### P1-03: Comparison operators (>, >=, <, <=)

- [x] **Setup:** Map a numeric field (e.g. `value`, `rank`) from source to target.
- [x] **Steps:**
  1. Click the operator pill. Select **> greater than** (amber).
  2. An inline value input appears automatically (with "Enter value" placeholder). Type a number.
  3. Press Enter to commit. Switch to **>= at least**. Verify pill color is amber.
  4. Switch to **< less than**, **<= at most**. Verify pill color is amber for all.
- [x] **Expected:** Each comparison operator shows an amber-colored pill with the correct symbol. Selecting a value-requiring operator auto-focuses the value input for immediate typing.

### P1-04: String operators (contains, not_contains, starts_with, ends_with, regex)

- [x] **Setup:** Map `name` from source to target.
- [x] **Steps:**
  1. Set operator to **⊃ contains** (purple). Enter value `"OnStar"`.
  2. Switch to **⊅ not contains**. Enter value `"expired"`.
  3. Switch to **⊳ starts with**. Enter value `"On"`.
  4. Switch to **⊲ ends with**. Enter value `"Package"`.
  5. Switch to **/r/ matches** (regex). Enter value `"^On.*Package$"`.
- [x] **Expected:** All five string operators show purple pills. Each allows a string value input.

### P1-05: Boolean operators (is_true, is_false)

- [ ] **Setup:** Map `isActive` from source to target.
- [ ] **Steps:**
  1. Set operator to **✓ is true** (red pill).
  2. Confirm no value input appears (is_true needs no value).
  3. Switch to **✗ is false** (red pill).
- [ ] **Expected:** Red pills. No value input field shown for either.

### P1-06: Existence operators (exists, not_exists)

- [ ] **Setup:** Map `metadata.version` from source to target.
- [ ] **Steps:**
  1. Set operator to **∃ exists** (gray pill).
  2. Confirm no value input.
  3. Switch to **∄ not exists** (gray pill).
- [ ] **Expected:** Gray pills with no value input.

### P1-07: Null operators (is_null, is_not_null, is_empty, is_not_empty)

- [ ] **Setup:** Map `deletedAt` from source to target. Also map `errors`.
- [ ] **Steps:**
  1. On `deletedAt`: set **∅ is null** (gray pill). Verify no value input.
  2. Switch to **⊙ not null**. Verify no value input.
  3. On `errors` (empty array): set **∅ is empty** (gray pill). Verify no value input.
  4. Switch to **⊙ not empty** (gray pill).
- [ ] **Expected:** Gray pills for all four. No value input needed.

### P1-08: Set membership operators (in, not_in)

- [ ] **Setup:** Map `status` from source to target.
- [ ] **Steps:**
  1. Set operator to **∈ in** (blue pill).
  2. Enter value: `"active", "pending", "approved"`.
  3. Switch to **∉ not in** (blue pill). Enter value: `"deleted", "banned"`.
- [ ] **Expected:** Blue pills. Value input accepts comma-separated quoted strings.

### P1-09: Between operator

- [ ] **Setup:** Map `offers[0].price` from source to target.
- [ ] **Steps:**
  1. Set operator to **↔ between** (amber pill).
  2. Enter value: `10, 100`.
- [ ] **Expected:** Amber pill. Value shows `10, 100` (min, max).

### P1-10: Close-to operator (approximate numeric)

- [ ] **Setup:** Map `latitude` from source to target.
- [ ] **Steps:**
  1. Set operator to **≈ close to** (amber pill).
  2. Enter value: `40.7, 0.1` (value, tolerance).
- [ ] **Expected:** Amber pill. Value shows `40.7, 0.1`.

### P1-11: Operator picker — search and categories

- [ ] **Setup:** Click any mapped field's operator pill.
- [ ] **Steps:**
  1. The **operator picker dropdown** opens with a search box and categorized sections.
  2. Verify categories: **Equality**, **Comparison**, **String**, **Boolean**, **Type**, **Existence**, **Set**.
  3. Type `"contain"` in search. Verify only matching operators appear (`contains`, `not_contains`, `array_length` may not match but collection items may).
  4. Clear search. All operators reappear.
- [ ] **Expected:** Searchable dropdown with grouped operators. Each operator shows icon + label + "value" hint (for operators requiring a value).

### P1-12: Operator pill color scheme on canvas lines

- [ ] **Setup:** Create several mappings with different operator types (equals, >=, contains, is_true, is_type, exists, in).
- [ ] **Steps:**
  1. Ensure **Lines** are visible (toolbar toggle).
  2. Observe the canvas connection lines between source and target panels.
- [ ] **Expected:** Mid-line badges appear color-coded: green (equality), amber (comparison), purple (string), red (boolean), teal (type), gray (existence), blue (set).

---

## Phase 2 — Type & Existence Assertions

### P2-01: Type-check operator (is_type)

- [ ] **Setup:** Map `count` from source to target.
- [ ] **Steps:**
  1. Set operator to **τ is type** (teal pill).
  2. An inline dropdown or value input appears.
  3. Enter/select `number`.
- [ ] **Expected:** Teal pill showing `τ isNumber`. The value is the expected type name.

### P2-02: Type-check for all types

- [ ] **Steps:** For each field, set `is_type` and enter the type:
  1. `name` → `is_type string` (teal pill, `τ isString`).
  2. `count` → `is_type number` (teal pill, `τ isNumber`).
  3. `isActive` → `is_type boolean` (teal pill, `τ isBoolean`).
  4. `offers` → `is_type array` (teal pill, `τ isArray`).
  5. `config` → `is_type object` (teal pill, `τ isObject`).
  6. `deletedAt` → `is_type null` (teal pill, `τ isNull`).
- [ ] **Expected:** All six type pills render with the correct type label in teal.

### P2-03: Existence assertion (existence assertion type)

- [ ] **Setup:** Open the **Rules** modal (toolbar → Rules button).
- [ ] **Steps:**
  1. Type the following DSL:
     ```
     metadata.version  exists
     _internal         not_exists
     ```
  2. Close the Rules modal.
  3. Observe the target tree.
- [ ] **Expected:** The target tree shows `metadata.version` with a gray `∃ exists` pill and a new virtual node `_internal` with `∄ not exists` pill (or the DSL rule is reflected in the rules summary).

---

## Phase 3 — Collection & Structural Assertions

### P3-01: Array length assertion (inline row)

- [ ] **Setup:** Locate `offers` (array node) in the target tree.
- [ ] **Steps:**
  1. Right-click on `offers`. Select **Add length assertion**.
  2. An inline assertion row appears beneath the array node: `LENGTH  =  [0]`.
  3. Change the comparison operator dropdown from `=` to `>=`.
  4. Click the value `0` and change it to `3`.
- [ ] **Expected:**
  - Row shows: `# LENGTH  >= at least  [3]  Edit  ×`.
  - The array node header updates to show `3 items · 1 assertion`.

### P3-02: Array contains assertion (4 modes: any, all, only, none)

- [ ] **Setup:** Right-click `offers` array → **Add contains assertion**.
- [ ] **Steps:**
  1. An inline assertion row appears: `∋ CONTAINS`.
  2. Click the value area and type `offerName = "EV Access - 8 Years"`.
  3. Observe the assertion row updates.
  4. Repeat, adding assertions with different modes if mode selection is available (any/all/only/none).
- [ ] **Expected:** The inline row shows the contains assertion with mode and value. Multiple contains assertions can coexist.

### P3-03: Each assertion (element-level)

- [ ] **Setup:** Right-click `offers` array → **Add each assertion**.
- [ ] **Steps:**
  1. An inline assertion row appears: `∀ EACH`.
  2. Set the field path to `rank` and operator to `>=` with value `0`.
- [ ] **Expected:** Row shows: `∀ EACH  rank  >=  [0]`. This asserts every `offers[*].rank >= 0`.

### P3-04: Subset assertion (deep partial match)

- [ ] **Setup:** Right-click `offers` array → **Add subset assertion**.
- [ ] **Steps:**
  1. An inline assertion row appears: `⊆ SUBSET`.
  2. Enter the expected JSON: `{"offerName": "OnStar Safety Plan"}`.
- [ ] **Expected:** Row shows: `⊆ SUBSET  {"offerName": "OnStar..."`. Truncated if long.

### P3-05: Multiple array assertions on one node

- [ ] **Setup:** Add all four assertion types to `offers`: length, contains, each, subset.
- [ ] **Steps:**
  1. Observe the array node header.
  2. Observe all four inline assertion rows stacked beneath the node.
- [ ] **Expected:**
  - Header: `3 items · 4 assertions`.
  - Four rows visible, each with its type pill, operator/value, and remove (×) button.
  - Removing one assertion (click ×) decrements the count.

### P3-06: Inline editing of assertion values

- [ ] **Setup:** Have a length assertion `>= 3` on `offers`.
- [ ] **Steps:**
  1. Click the value `3`. It becomes an editable input.
  2. Type `5` and press **Enter**. The value commits.
  3. Click the value again, type `2`, press **Escape**. The edit cancels (reverts to `5`).
- [ ] **Expected:** Enter commits, Escape cancels. Value updates persist across save.

### P3-07: Assertion row layout — value always visible

- [ ] **Setup:** Add a length assertion (`>= N`) to an array node (e.g., `offers`).
- [ ] **Steps:**
  1. Observe the assertion row: `# LENGTH  >=  [value]  ×`.
  2. Verify all elements are visible within the panel — the type pill, the `>=` select, the value display, and the remove button.
  3. Click the value to enter edit mode. Type a number and press Enter.
  4. Resize the mapper to a narrower width. Verify the row still fits.
- [ ] **Expected:** The assertion row lays out correctly within the panel width. The `>=` select dropdown is compact (max ~50px wide), the value display takes remaining flex space, and nothing overflows off-screen. The value is clickable and editable at all panel widths.

---

## Phase 4 — Code Editor Mode (DSL)

### P4-01: Open the Validation Rules Modal

- [ ] **Setup:** In the Validation Mapper, locate the toolbar.
- [ ] **Steps:**
  1. Click the **Rules** button in the toolbar.
  2. The **Validation Rules Modal** opens (default mode: docked at bottom).
- [ ] **Expected:** Modal appears with a Monaco code editor on the left. Header shows rule count.

### P4-02: Write DSL rules — field assertions

- [ ] **Steps:** Type the following in the editor:
  ```
  # Field assertions
  offers[0].associatedOfferingCode  equals  "ONZFCNCPR3MCAL4"
  offers[0].rank  >=  1
  offers[0].offerName  contains  "OnStar"
  offers[0].isActive  is_true
  offers[0].productCode  exists
  offers[0].duration.value  between  1, 365
  ```
- [ ] **Expected:** Each line is syntax-highlighted:
  - Paths in **cyan**.
  - Operators in their category color (green for equals, amber for >=, purple for contains, red for is_true, gray for exists).
  - Values in green (strings), amber (numbers).
  - Comments (`#`) in gray.

### P4-03: Write DSL rules — collection assertions

- [ ] **Steps:** Add these lines:
  ```
  # Collection assertions
  offers  length >=  3
  offers  contains_any  offerName = "EV Access - 8 Years"
  offers[*].rank  each >=  0
  ```
- [ ] **Expected:** Syntax highlighting applies. `length`, `contains_any`, `each` are recognized keywords.

### P4-04: DSL autocomplete

- [ ] **Steps:**
  1. On a new line, type `off` and trigger autocomplete (Ctrl+Space or wait).
  2. A suggestion list appears with paths starting with `off` (e.g., `offers`, `offers[0].offerName`).
  3. Select `offers[0].offerName`. The path auto-completes.
  4. Press Space. Type `cont` and trigger autocomplete.
  5. Operator suggestions appear: `contains`, `contains_any`, etc.
- [ ] **Expected:** Path completions from the JSON tree. Operator keyword completions.

### P4-05: DSL inline errors

- [ ] **Steps:**
  1. Type an invalid line: `nonexistent.path  equals  "foo"`.
  2. Observe: a red squiggle appears under `nonexistent.path` (unknown path).
  3. Type: `name  unknownOp  "bar"`.
  4. Observe: a red squiggle appears under `unknownOp` (unknown operator).
- [ ] **Expected:** Red underline markers for invalid paths and unknown operators.

### P4-06: Bi-directional sync — Visual → Code

- [ ] **Setup:** Close the Rules modal. In the visual mapper, create a mapping: drag `status` to target, set operator to `equals`, value `"active"`.
- [ ] **Steps:**
  1. Open the Rules modal again.
  2. Observe the editor content.
- [ ] **Expected:** The editor contains a line: `status  equals  "active"` (or equivalent), reflecting the visual mapping.

### P4-07: Bi-directional sync — Code → Visual

- [ ] **Setup:** In the Rules editor, add a new line: `count  >=  10`.
- [ ] **Steps:**
  1. Wait ~300ms for debounced sync.
  2. Close the Rules modal.
  3. Look at the target tree.
- [ ] **Expected:** The target field `count` now shows an amber `>=` pill with value `10`, created from the DSL.

### P4-08: Copy and paste DSL text

- [ ] **Steps:**
  1. In the Rules editor, select all (Ctrl+A) and copy (Ctrl+C).
  2. Clear the editor.
  3. Paste (Ctrl+V).
- [ ] **Expected:** All rules restore correctly. The parser re-validates on paste.

---

## Phase 5 — Live Validation Stage

### P5-01: Verify All

- [ ] **Setup:** Have several field mappings with operators set (e.g., `status equals "active"`, `count >= 10`, `isActive is_true`).
- [ ] **Steps:**
  1. Click **Verify All** in the toolbar.
  2. Observe the results.
- [ ] **Expected:**
  - Per-node inline badges appear: green ✓ for passing rules, red ✗ for failing.
  - Toolbar shows aggregated results: `N passed · M failed`.
  - Canvas connection lines change color: green for passed, red for failed.

### P5-02: Verify with a failing rule

- [ ] **Setup:** Set `count equals 999` (will fail since count is 42).
- [ ] **Steps:**
  1. Click **Verify All**.
  2. Observe the `count` node.
- [ ] **Expected:** Red ✗ badge on `count`. The toolbar shows 1 failed. Connection line for `count` turns red.

### P5-03: Fetch & Verify (live HTTP request)

- [ ] **Setup:** Ensure the test has a valid HTTP endpoint configured.
- [ ] **Steps:**
  1. Click **Fetch & Verify** in the toolbar.
  2. Wait for the HTTP response.
- [ ] **Expected:** The sample data updates with the live response. All rules re-evaluate against the fresh data. Results (✓/✗) update accordingly.

### P5-04: Auto-verify toggle

- [ ] **Setup:** Enable the **Auto** checkbox in the toolbar.
- [ ] **Steps:**
  1. Change an operator value (e.g., change `count >= 10` to `count >= 100`).
  2. Wait ~500ms.
  3. Observe the badges update automatically without clicking Verify.
- [ ] **Expected:** Badges and pass/fail counts update automatically after each edit when auto-verify is on.

### P5-05: Failure navigation

- [ ] **Setup:** Have 2+ failing rules and 5+ passing rules.
- [ ] **Steps:**
  1. Click the **failed count** in the toolbar. A dropdown of failed rules appears.
  2. Click a failed rule in the dropdown. The target tree scrolls to and highlights that node.
  3. Use **prev/next arrows** to navigate between failures.
- [ ] **Expected:** Each failure is scrolled into view and highlighted. Navigation cycles through all failures.

### P5-06: Filter by pass/fail

- [ ] **Setup:** After verification, have mixed pass/fail results.
- [ ] **Steps:**
  1. In the target panel filter dropdown, select **Passed**. Only passing nodes are visible.
  2. Switch to **Failed**. Only failing nodes are visible.
  3. Switch back to **All**.
- [ ] **Expected:** Filter correctly shows/hides nodes based on verification status.

### P5-07: DSL assertion evaluation in verify

- [ ] **Setup:** Open the Rules modal. Type:
  ```
  offers  length >=  3
  isActive  is_true
  count  >=  10
  ```
- [ ] **Steps:**
  1. Close the modal. Click **Verify All**.
  2. Observe the verify counts.
- [ ] **Expected:** All three DSL-originated assertions are counted in the pass/fail totals. The verify stats in both the toolbar and the Rules modal header show the correct total (field operator assertions + DSL assertions combined).

---

## Phase 6 — JSON Schema Validation

### P6-01: JSON Schema assertion via DSL

- [ ] **Setup:** Open the Rules modal.
- [ ] **Steps:**
  1. This phase is primarily engine-level (`jsonSchema` assertion type evaluated by Ajv).
  2. If the UI supports adding a JSON Schema assertion, add one for the `offers` array:
     ```json
     {
       "type": "array",
       "minItems": 1,
       "items": {
         "type": "object",
         "required": ["offerName", "rank"]
       }
     }
     ```
  3. Verify the schema validates against the sample data.
- [ ] **Expected:** Schema validation passes (✓). If the schema doesn't match the data, a clear error message indicates which constraint failed.

---

## Phase 7 — Expression Engine Enrichment (125 Functions)

### P7-01: Expression editor on a mapping

- [ ] **Setup:** Map `offers` (source) to a target field.
- [ ] **Steps:**
  1. Right-click the mapped target node. Select **Edit expression...** from the context menu.
  2. The **Expression Editor Modal** opens.
  3. In the expression input, type: `$count($.source.offers)`.
  4. Observe the **live preview** showing the result (e.g., `3`).
  5. Try other expressions:
     - `$sum($map($.source.offers, x => x.price))` → sum of all prices.
     - `$upper($.source.name)` → `"ONSTAR PREMIUM PACKAGE"`.
- [ ] **Expected:** Expression editor has a function catalog. Live preview evaluates the expression against sample data. Result updates as you type.

### P7-02: Expression Editor — Variable Name field (extraction adapter)

- [ ] **Setup:** Open the Visual Mapper from the **Extract** tab. Map a source field to create an extraction.
- [ ] **Steps:**
  1. Right-click the mapped target node → **Edit expression…** to open the Expression Editor.
  2. Observe the top of the modal: a **VARIABLE NAME** input field appears below the header, showing the current target path (e.g., `offers[0].associatedOfferingCode`).
  3. Click into the Variable Name field, clear it, and type `myVar`.
  4. Press **Enter** to commit the rename.
  5. Close the Expression Editor.
  6. Inspect the target tree — the field should now be named `myVar`.
  7. Re-open the Expression Editor for the same field. Verify the Variable Name field shows `myVar`.
- [ ] **Expected:** The Variable Name field is visible and editable in the Expression Editor for adapters that allow custom fields (extraction). Renaming via this field updates the target field name and all affected mappings. The field does NOT appear in the validation adapter Expression Editor (validation targets are fetched schema fields, not user-defined).

### P7-03: Expression Editor — stays within viewport

- [ ] **Setup:** Open the Expression Editor (either via right-click → Edit expression, or double-click a mapped node).
- [ ] **Steps:**
  1. Resize the browser window to a smaller height (e.g., 600px).
  2. Open the Expression Editor.
  3. Verify the modal stays fully within the viewport (no overflow past top or bottom edges).
  4. Try dragging the modal by its header.
- [ ] **Expected:** The Expression Editor modal is always fully visible within the viewport. It is portaled to `document.body` to escape CSS stacking context issues from ancestor elements with `backdrop-filter` or `transform`. The modal's `max-height` is clamped to `min(80vh, calc(100vh - 40px))`.

### P7-04: Expression function categories in catalog

- [ ] **Setup:** In the Expression Editor Modal, open the function catalog.
- [ ] **Steps:**
  1. Browse the 8 categories: **String** (31), **Math** (28), **Array** (16), **Object** (11), **Conditional** (11), **JSON** (15), **Date/Time** (8), **Encoding** (5).
  2. Click a function to see its signature and description.
  3. Click Insert to add it to the expression.
- [ ] **Expected:** All 125 functions are listed, organized by category, with descriptions.

---

## Phase 8 — Nice-to-Have Operators

### P8-01: Body size assertion

- [ ] **Setup:** Open the Rules modal.
- [ ] **Steps:**
  1. This is tested via the engine. In a test scenario, add a `bodySize` assertion with `operator: ">"`, `value: 100`, `unit: "bytes"`.
  2. Run the test.
- [ ] **Expected:** Assertion passes if the response body is larger than 100 bytes.

### P8-02: Date precision assertion

- [ ] **Setup:** Map `createdAt` from source to target.
- [ ] **Steps:**
  1. Set operator to a comparison (e.g., `<=`).
  2. Enter a reference date value.
  3. The `datePrecise` assertion type supports `day`, `hour`, `min`, `sec`, `ms` precision.
- [ ] **Expected:** Date comparison evaluates with the specified precision level.

### P8-03: Between operator (visual)

- [ ] **Setup:** Map `offers[0].price` to target.
- [ ] **Steps:**
  1. Set operator to **↔ between** (amber pill).
  2. Enter `10, 100`.
  3. Click **Verify All**.
- [ ] **Expected:** Passes (49.99 is between 10 and 100). Change to `50, 100` and re-verify: fails (49.99 < 50).

### P8-04: Close-to operator (visual)

- [ ] **Setup:** Map `latitude` to target.
- [ ] **Steps:**
  1. Set operator to **≈ close to** (amber pill).
  2. Enter `40.7, 0.1` (value=40.7, tolerance=0.1).
  3. Click **Verify All**.
- [ ] **Expected:** Passes (40.7128 is within 0.1 of 40.7). Change tolerance to `0.001` and re-verify: fails.

---

## Phase 9.1 — Universal Negation

### P9.1-01: Negate via operator picker

- [ ] **Setup:** Map `status` to target with `equals "active"`.
- [ ] **Steps:**
  1. Click the operator pill to open the picker.
  2. At the top, toggle the **Negate (NOT)** button. A checkmark appears.
  3. Close the picker.
- [ ] **Expected:** The operator pill now shows a red `NOT` badge or visual indicator alongside the green `= equals`. The mapping's `negate` flag is `true`.

### P9.1-02: Negate via context menu

- [ ] **Setup:** Map `isActive` to target with `is_true`.
- [ ] **Steps:**
  1. Right-click the `isActive` target node.
  2. Select **Negate (NOT)** from the context menu.
- [ ] **Expected:** The pill shows `NOT is_true`. Toggling again removes negation.

### P9.1-03: Negate in DSL code

- [ ] **Setup:** Open the Rules modal.
- [ ] **Steps:**
  1. Type: `status  NOT equals  "inactive"`.
  2. Close the modal and inspect the visual tree.
- [ ] **Expected:** The `status` field shows `NOT = equals` (negated) with value `"inactive"`. Syntax highlighting renders `NOT` in red.

### P9.1-04: NOT on array assertions in DSL

- [ ] **Steps:** In the Rules editor, type:
  ```
  offers  NOT length >=  10
  offers[*].rank  NOT each >=  100
  ```
- [ ] **Expected:** Negation applies to collection assertions. After verification, `NOT length >= 10` passes (because length is 3, which is NOT >= 10).

### P9.1-05: Verification with negation

- [ ] **Setup:** Set `count NOT equals 999`.
- [ ] **Steps:**
  1. Click **Verify All**.
- [ ] **Expected:** Passes (count is 42, which is NOT equal to 999). Green ✓ badge.

---

## Phase 9.2 — Lambda Expression Syntax

### P9.2-01: Lambda in expression editor

- [ ] **Setup:** Open the expression editor on a mapping.
- [ ] **Steps:**
  1. Type: `$filter($.source.offers, x => x.isActive)`.
  2. Observe the live preview.
- [ ] **Expected:** Preview shows an array of 2 offers (the ones with `isActive: true`). Lambda syntax `x => x.isActive` is parsed correctly.

### P9.2-02: Multi-param lambda

- [ ] **Steps:**
  1. In the expression editor, type: `$reduce($.source.offers, (acc, x) => $add(acc, x.price), 0)`.
  2. Observe the preview.
- [ ] **Expected:** Preview shows `95.48` (sum of all prices). Multi-param `(acc, x) => body` syntax works.

### P9.2-03: Lambda with higher-order functions

- [ ] **Steps:** Test various HOFs:
  1. `$map($.source.offers, x => x.offerName)` → `["EV Access - 8 Years", "OnStar Safety Plan", "Premium Navigation"]`.
  2. `$any($.source.offers, x => $gt(x.rank, 2))` → `true` (rank 3 exists).
  3. `$all($.source.offers, x => $gte(x.rank, 1))` → `true` (all ranks >= 1).
  4. `$sortBy($.source.offers, x => x.price)` → sorted by price ascending.
  5. `$find($.source.offers, x => $eq(x.offerName, "OnStar Safety Plan"))` → the matching offer object.
- [ ] **Expected:** Each function evaluates correctly with lambda syntax.

### P9.2-04: Comparison helper functions in lambdas

- [ ] **Steps:**
  1. `$filter($.source.offers, x => $gt(x.price, 20))` → 2 offers (49.99 and 29.99).
  2. `$filter($.source.offers, x => $lte(x.rank, 2))` → 2 offers (rank 1 and 2).
- [ ] **Expected:** `$gt`, `$gte`, `$lt`, `$lte`, `$eq`, `$neq` work correctly inside lambda bodies.

---

## Phase 9.3 — Custom Predicate Functions (ASSERT)

### P9.3-01: ASSERT keyword in DSL

- [ ] **Setup:** Open the Rules modal.
- [ ] **Steps:**
  1. Type: `ASSERT $gt($count($.body.offers), 0)`.
  2. Close and verify.
- [ ] **Expected:** The custom assertion evaluates. Since `$count(offers) = 3 > 0`, it passes (✓).

### P9.3-02: ASSERT with description comment

- [ ] **Steps:**
  1. Type: `ASSERT $gt($.body.count, 0)  // count must be positive`.
  2. Verify.
- [ ] **Expected:** Passes. The `// count must be positive` is treated as a description/comment.

### P9.3-03: ASSERT with complex expression

- [ ] **Steps:**
  1. Type:
     ```
     ASSERT $eq($sum($map($.body.offers, x => x.rank)), 6)
     ```
     (Sum of ranks: 1+2+3 = 6)
  2. Verify.
- [ ] **Expected:** Passes. Lambda and HOFs work inside ASSERT expressions.

### P9.3-04: NOT ASSERT (negated custom predicate)

- [ ] **Steps:**
  1. Type: `NOT ASSERT $isEmpty($.body.offers)`.
  2. Verify.
- [ ] **Expected:** Passes (offers is NOT empty). The negation inverts the predicate result.

### P9.3-05: ASSERT failure produces clear error

- [ ] **Steps:**
  1. Type: `ASSERT $gt($.body.count, 1000)`.
  2. Verify.
- [ ] **Expected:** Fails (✗). The error message indicates the assertion failed, showing the expression and the actual value.

---

## Phase 9.4 — Validation Rules Modal (3-Mode Layout + DSL Reference)

### P9.4-01: Rules modal — Docked mode (default)

- [ ] **Setup:** Click the **Rules** button in the toolbar.
- [ ] **Steps:**
  1. The modal opens at the bottom of the mapper (docked mode).
  2. A **resize handle** is visible at the top edge of the modal.
  3. Drag the resize handle upward to increase height (up to ~600px).
  4. Drag it down to decrease (minimum ~80px).
- [ ] **Expected:** Docked panel with resizable height. The mapper canvas shrinks/grows to accommodate.

### P9.4-02: Rules modal — Mode switching

- [ ] **Steps:**
  1. In the modal header, find the mode selector dropdown (shows "Bottom" by default).
  2. Change to **Floating**. The modal detaches and becomes a floating window.
  3. Change to **Full Screen**. The modal fills the entire mapper area.
  4. Change back to **Bottom**. The modal re-docks.
- [ ] **Expected:** Smooth transitions between all three modes. No layout glitches.

### P9.4-03: Floating mode — Drag and resize

- [ ] **Setup:** Switch the modal to **Floating** mode.
- [ ] **Steps:**
  1. Drag the header to reposition the floating window.
  2. Drag the corner resize grip to resize the window.
  3. Drag the right edge to resize width only.
- [ ] **Expected:** The floating window can be freely positioned and resized. Editor content remains intact.

### P9.4-04: Maximized mode

- [ ] **Setup:** Switch the modal to **Full Screen** mode.
- [ ] **Steps:**
  1. The modal fills the entire mapper area.
  2. The mapper canvas is hidden (CSS `:has()` selector hides it).
  3. The editor is fully visible with maximum space.
- [ ] **Expected:** Full-screen editor with no visible canvas. Switching back to another mode restores the canvas.

### P9.4-05: Mode persistence

- [ ] **Setup:** Switch to **Floating** mode.
- [ ] **Steps:**
  1. Close the Rules modal (× button or Escape).
  2. Re-open the Rules modal (click Rules in toolbar).
- [ ] **Expected:** The modal opens in **Floating** mode (persisted to `localStorage`).

### P9.4-06: DSL Reference Panel — Toggle

- [ ] **Setup:** Open the Rules modal.
- [ ] **Steps:**
  1. Locate the **Reference** button in the header.
  2. Click it to hide the reference panel. The editor takes full width.
  3. Click again to show the reference panel.
- [ ] **Expected:** The reference panel slides in/out. State persists across close/reopen.

### P9.4-07: DSL Reference Panel — 10 Categories

- [ ] **Steps:**
  1. With the reference panel open, observe the categories:
     - **Equality** (= icon, green)
     - **Comparison** (≶ icon, amber)
     - **String** (Aa icon, purple)
     - **Boolean & Null** (?! icon, red)
     - **Type & Existence** (T icon, cyan)
     - **Set Membership** (∈ icon, blue)
     - **Collection** ([] icon, teal)
     - **Custom Predicates** (λ icon, mauve)
     - **Modifiers** (¬ icon, red)
     - **Syntax Guide** (# icon, gray)
  2. Click each category to expand/collapse.
- [ ] **Expected:** All 10 categories are present with correct icon badges and colors. Default open: Equality, Comparison, String.

### P9.4-08: DSL Reference Panel — Search

- [ ] **Steps:**
  1. In the reference panel search box, type `"between"`.
  2. Only the Comparison section shows, filtered to the `between` entry.
  3. Clear the search. All sections reappear.
  4. Type `"ASSERT"`. Custom Predicates and Modifiers sections show.
- [ ] **Expected:** Search filters entries across all sections by keyword, description, syntax, and example.

### P9.4-09: DSL Reference Panel — Insert

- [ ] **Steps:**
  1. Place the cursor on an empty line in the DSL editor.
  2. In the reference panel, find the `equals` entry.
  3. Click the **Insert** (+) button.
- [ ] **Expected:** The example syntax (e.g., `offers[0].name  equals  "Premium"`) is inserted at the cursor position in the editor.

### P9.4-10: DSL Reference Panel — Copy

- [ ] **Steps:**
  1. In the reference panel, find the `contains` entry.
  2. Click the **Copy** button.
  3. Paste (Ctrl+V) into a text editor.
- [ ] **Expected:** The syntax template is copied to the clipboard.

### P9.4-11: DSL Reference Panel — Expand/Collapse All

- [ ] **Steps:**
  1. Click **Expand all** in the reference header.
  2. All 10 sections expand.
  3. Click **Collapse all**.
  4. All sections collapse.
- [ ] **Expected:** Bulk expand/collapse works for all categories.

### P9.4-12: Verify stats in modal header

- [ ] **Setup:** Have several rules in the DSL editor. Click **Verify All**.
- [ ] **Steps:**
  1. Observe the modal header.
  2. After verification completes, the header shows: **N passed** (green) / **M failed** (red).
- [ ] **Expected:** Verify stats appear in the Rules modal header matching the toolbar counts.

### P9.4-13: DSL assertions counted in verify totals

- [ ] **Setup:** Add mixed rules:
  ```
  status  equals  "active"
  count  >=  10
  offers  length >=  3
  isActive  is_true
  ASSERT $gt($.body.count, 0)
  ```
- [ ] **Steps:**
  1. Click **Verify All**.
  2. Count the total rules: 5 (3 field assertions + 1 collection + 1 custom).
  3. Check the verify stats.
- [ ] **Expected:** Stats show `5 passed` (assuming all pass). DSL-originated assertions (`length`, `ASSERT`) are counted alongside field operators.

### P9.4-14: Escape key behavior

- [ ] **Steps:**
  1. With the Rules modal open, press **Escape**.
  2. The modal closes.
  3. Re-open the modal. Trigger autocomplete (Ctrl+Space).
  4. With the suggest widget open, press **Escape**.
- [ ] **Expected:** First Escape closes the suggest widget only (modal stays open). Press Escape again to close the modal.

### P9.4-15: Portal stacking (z-index)

- [ ] **Setup:** Open the Rules modal in **Floating** mode.
- [ ] **Steps:**
  1. The floating modal renders within the mapper's modal overlay.
  2. Click outside the floating window but inside the Data Mapper Modal.
  3. The floating Rules window stays visible (not hidden behind other elements).
- [ ] **Expected:** Correct z-index stacking. The floating Rules window is always on top of the mapper content but within the modal boundary.

---

## Cross-Phase Integration Tests

### INT-01: Full workflow — Visual + DSL + Verify

- [ ] **Steps:**
  1. Open the Validation Mapper with sample JSON.
  2. Auto-map all fields. Change some operators visually (equals, >=, contains).
  3. Open the Rules modal. Observe that visual mappings appear as DSL.
  4. Add additional rules via DSL: `ASSERT $gt($.body.count, 0)`.
  5. Close the modal. Verify the visual tree reflects the DSL rules.
  6. Click **Verify All**. Check pass/fail for all rules.
  7. Enable **Auto-verify**. Change a value. Observe auto-re-verify.
- [ ] **Expected:** Complete round-trip: visual → code → verify. All modes stay in sync.

### INT-02: Negation + Lambda + ASSERT combined

- [ ] **Steps:**
  1. In the Rules editor:
     ```
     # Negated field assertion
     status  NOT equals  "deleted"

     # Lambda expression
     ASSERT $all($.body.offers, x => $gte(x.rank, 1))

     # Negated custom predicate
     NOT ASSERT $isEmpty($.body.tags)

     # Collection with negation
     offers  NOT length >=  100
     ```
  2. Verify all.
- [ ] **Expected:** All 4 rules pass. Negation, lambdas, ASSERT, and collection assertions all work together.

### INT-03: Type mismatch detection and quick-fix

- [ ] **Setup:** Map a string field (`name`) to target. Set operator to **> greater than** (expects numeric).
- [ ] **Steps:**
  1. Observe a **type mismatch warning** (indicator or tooltip) on the mapping.
  2. Look for a **quick-fix suggestion** (e.g., "Wrap with $parseInt" or "Change operator to contains").
- [ ] **Expected:** Type mismatch is detected. Quick-fix suggestions are actionable.

### INT-04: Save and reopen — persistence

- [ ] **Setup:** Create several mappings with mixed operators, array assertions, and DSL rules.
- [ ] **Steps:**
  1. Click **Save** in the Data Mapper Modal.
  2. Close the Test Editor.
  3. Re-open the Test Editor → Validation tab → Visual Mapper.
- [ ] **Expected:** All mappings, operators, operator values, negation flags, array assertions, and DSL rules are preserved exactly.

### INT-05: Unordered array matching option

- [ ] **Setup:** In the Data Mapper Modal footer, look for the **Unordered array matching** checkbox.
- [ ] **Steps:**
  1. Toggle the checkbox on.
  2. Save.
  3. Reopen and verify the checkbox state persists.
- [ ] **Expected:** The `unorderedArrays` option is saved and restored.

### INT-06: Schema drift detection after re-fetch

- [ ] **Setup:** Have a saved mapper with existing mappings.
- [ ] **Steps:**
  1. Re-open the mapper.
  2. If the source data schema has changed since the last save, a **Drift Banner** appears at the top.
  3. Click **Show Diff** to open the **Schema Diff Modal**.
  4. Review added/removed/renamed fields.
  5. Apply repair suggestions for broken mappings.
  6. Click **Accept & Update** to dismiss the drift.
- [ ] **Expected:** Drift detection, diff modal, and repair suggestions work correctly.

---

## Appendix A — All 24 Operators: Automated Test Reference

> **Test files:**
> - `src/engine/fieldOperatorEvaluation.comprehensive.test.ts` — 167 tests covering all 24 operators
> - `src/shared/components/data-mapper/adapters/validationAdapter.integration.test.ts` — 73 integration tests (adapter → verify pipeline)
>
> Use the sample JSON from the top of this document. The table below shows concrete examples for each operator.

### Equality Operators (green pills)

| Operator | Field | Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|-------|-------------|-------|------------|
| `equals` | `name` | _(auto from source)_ | `"OnStar Premium Package"` | ✅ | `name  equals  "OnStar Premium Package"` |
| `equals` | `count` | _(auto)_ | `42` | ✅ | `count  equals  42` |
| `not_equals` | `status` | _(auto)_ | If response has `"active"` but expected was `"inactive"` | ✅ | `status  not_equals  "inactive"` |

### Comparison Operators (amber pills)

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `greater_than` | `count` | `10` | `42` | ✅ | `count  >  10` |
| `greater_than` | `count` | `100` | `42` | ❌ | `count  >  100` |
| `greater_than_or_equal` | `count` | `42` | `42` | ✅ | `count  >=  42` |
| `less_than` | `offers[0].price` | `100` | `49.99` | ✅ | `offers[0].price  <  100` |
| `less_than_or_equal` | `offers[0].price` | `49.99` | `49.99` | ✅ | `offers[0].price  <=  49.99` |

### String Operators (purple pills)

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `contains` | `name` | `OnStar` | `"OnStar Premium Package"` | ✅ | `name  contains  "OnStar"` |
| `contains` | `name` | `Expired` | `"OnStar Premium Package"` | ❌ | `name  contains  "Expired"` |
| `not_contains` | `name` | `Expired` | `"OnStar Premium Package"` | ✅ | `name  not_contains  "Expired"` |
| `starts_with` | `email` | `test@` | `"test@example.com"` | ✅ | `email  starts_with  "test@"` |
| `ends_with` | `email` | `.com` | `"test@example.com"` | ✅ | `email  ends_with  ".com"` |
| `regex` | `email` | `^[\w.]+@[\w.]+\.[a-z]+$` | `"test@example.com"` | ✅ | `email  regex  "^[\\w.]+@[\\w.]+\\.[a-z]+$"` |

### Boolean Operators (red pills)

| Operator | Field | Sample Data | Pass? | DSL Syntax |
|----------|-------|-------------|-------|------------|
| `is_true` | `isActive` | `true` | ✅ | `isActive  is_true` |
| `is_true` | `isDeleted` | `false` | ❌ | `isDeleted  is_true` |
| `is_false` | `isDeleted` | `false` | ✅ | `isDeleted  is_false` |
| `is_false` | `isActive` | `true` | ❌ | `isActive  is_false` |

### Existence Operators (gray pills)

| Operator | Field | Sample Data | Pass? | DSL Syntax |
|----------|-------|-------------|-------|------------|
| `exists` | `name` | `"OnStar Premium Package"` | ✅ | `name  exists` |
| `exists` | `deletedAt` | `null` (null exists) | ✅ | `deletedAt  exists` |
| `exists` | `nonExistent` | _(missing)_ | ❌ | `nonExistent  exists` |
| `not_exists` | `nonExistent` | _(missing)_ | ✅ | `nonExistent  not_exists` |
| `is_null` | `deletedAt` | `null` | ✅ | `deletedAt  is_null` |
| `is_null` | `name` | `"OnStar..."` | ❌ | `name  is_null` |
| `is_not_null` | `name` | `"OnStar..."` | ✅ | `name  is_not_null` |
| `is_not_null` | `deletedAt` | `null` | ❌ | `deletedAt  is_not_null` |
| `is_empty` | `errors` | `[]` | ✅ | `errors  is_empty` |
| `is_empty` | `name` | `"OnStar..."` | ❌ | `name  is_empty` |
| `is_not_empty` | `name` | `"OnStar..."` | ✅ | `name  is_not_empty` |
| `is_not_empty` | `errors` | `[]` | ❌ | `errors  is_not_empty` |

### Type Check Operator (teal pill)

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `is_type` | `name` | `string` | `"OnStar..."` | ✅ | `name  is_type  "string"` |
| `is_type` | `count` | `number` | `42` | ✅ | `count  is_type  "number"` |
| `is_type` | `isActive` | `boolean` | `true` | ✅ | `isActive  is_type  "boolean"` |
| `is_type` | `offers` | `array` | `[...]` | ✅ | `offers  is_type  "array"` |
| `is_type` | `config` | `object` | `{...}` | ✅ | `config  is_type  "object"` |
| `is_type` | `deletedAt` | `null` | `null` | ✅ | `deletedAt  is_type  "null"` |

### Set Operators (blue pills)

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `in` | `status` | `["active","pending"]` | `"active"` | ✅ | `status  in  ["active","pending"]` |
| `in` | `status` | `["deleted","banned"]` | `"active"` | ❌ | `status  in  ["deleted","banned"]` |
| `not_in` | `status` | `["deleted","banned"]` | `"active"` | ✅ | `status  not_in  ["deleted","banned"]` |
| `not_in` | `status` | `["active","pending"]` | `"active"` | ❌ | `status  not_in  ["active","pending"]` |

### Range Operators (amber pills)

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `between` | `count` | `1, 100` | `42` | ✅ | `count  between  "1, 100"` |
| `between` | `count` | `1, 10` | `42` | ❌ | `count  between  "1, 10"` |
| `between` | `offers[0].price` | `10, 60` | `49.99` | ✅ | `offers[0].price  between  "10, 60"` |
| `close_to` | `latitude` | `40.7, 0.1` | `40.7128` | ✅ | `latitude  close_to  "40.7, 0.1"` |
| `close_to` | `latitude` | `40.0, 0.01` | `40.7128` | ❌ | `latitude  close_to  "40.0, 0.01"` |

### Negate Modifier (NOT)

| Base Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|---------------|-------|----------------|-------------|-------|------------|
| `NOT equals` | `name` | _(auto)_ | same as expected | ❌ | `name  NOT equals  "OnStar Premium Package"` |
| `NOT contains` | `name` | `Expired` | `"OnStar..."` | ✅ | `name  NOT contains  "Expired"` |
| `NOT is_true` | `isDeleted` | — | `false` | ✅ | `isDeleted  NOT is_true` |
| `NOT exists` | `name` | — | `"OnStar..."` | ❌ | `name  NOT exists` |

### Expression + Operator Combinations

| Expression | Operator | Result | Pass? | Notes |
|------------|----------|--------|-------|-------|
| `$contains($.name, "OnStar")` | _(auto: is_true)_ | `true` | ✅ | Boolean expression auto-assigns `is_true` |
| `$contains($.name, "xyz")` | _(auto: is_true)_ | `false` | ❌ | Expression returns `false` → `is_true` fails |
| `$upper($.name)` | `equals` | `"ONSTAR PREMIUM PACKAGE"` | ✅ | Expression transforms value, `equals` compares |
| `$sum([$.count, 10])` | `greater_than` `50` | `52` | ✅ | Expression computes value, operator validates |

> **Key rule:** When an expression returns a boolean (`true`/`false`) and no explicit operator is set, the system auto-assigns `is_true` — treating the expression as a pass/fail assertion. If you want a different behavior, set the operator explicitly.

---

## Summary Checklist

| Phase | Tests | Description |
|-------|-------|-------------|
| P0 | 4 | Adapter capability gating |
| P1 | 12 | 24 field operators, picker, colors |
| P2 | 3 | Type checks, existence assertions |
| P3 | 7 | Array length, contains, each, subset, inline layout |
| P4 | 8 | DSL editor, syntax, autocomplete, sync |
| P5 | 7 | Verify All, Fetch & Verify, auto-verify, filters |
| P6 | 1 | JSON Schema validation |
| P7 | 4 | Expression engine, variable rename, viewport fit, 125 functions |
| P8 | 4 | bodySize, datePrecise, between, close_to |
| P9.1 | 5 | Universal negation |
| P9.2 | 4 | Lambda syntax, HOFs |
| P9.3 | 5 | ASSERT keyword, custom predicates |
| P9.4 | 15 | 3-mode modal, DSL reference, verify stats |
| Integration | 6 | Cross-phase workflows |
| **Total** | **85** | |

### Automated Test Coverage

| Test File | Tests | Scope |
|-----------|-------|-------|
| `fieldOperatorEvaluation.test.ts` | 33 | Original unit tests |
| `fieldOperatorEvaluation.comprehensive.test.ts` | 167 | All 24 operators: pass, fail, edge cases, type coercion, boundaries |
| `validationAdapter.integration.test.ts` | 73 | Full pipeline: adapter serialize → operator evaluate for all operators, negate, expressions |
| `validationAdapter.test.ts` | 65 | Adapter unit tests |
| `useValidationVerify.test.ts` | 37 | Verify hook tests |
| **Total automated** | **375** | |
