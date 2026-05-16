# Validation Operator — Visual Test Scenarios

> **Purpose:** Step-by-step manual test guide covering every feature from each implementation phase (P0–P9.4) of the Validation & Assertion Operator system.
>
> **How to use:** Work through each phase sequentially. Every scenario has **Setup**, **Steps**, and **Expected** sections. Check the box when each test passes.
>
> **Navigation to the Validation Data Mapper:**
> 1. Open RedfireForge (web: `npm run dev` → http://localhost:5173, or desktop app)
> 2. Go to **Testing** → **Scenarios**
> 3. Create or open a test scenario
> 4. Click **Edit** to open the **Test Editor**
> 5. Go to the **Validation** tab
> 6. Set **Body Validation** to **Selective Fields**
> 7. Click **Fetch Response** (or paste sample JSON) to populate the response body
> 8. Click **Data Mapper** to open the Validation Data Mapper Modal
>
> **Note:** The same Data Mapper component is used in two contexts:
> - **Validation Data Mapper** — opened from the **Validation** tab. Supports operators, assertions, verification, DSL rules.
> - **Extraction Data Mapper** — opened from the **Extract** tab. Supports variable extraction only (no operators, no rules).
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

> **Context:** P0 tests compare the **Validation Data Mapper** (Validation tab → Data Mapper) vs the **Extraction Data Mapper** (Extract tab → Data Mapper) to verify capability gating.

### P0-01: Capability-gated UI — Operator pills only appear for validation adapter

- [x] **Setup:** Open the Validation Data Mapper (from the **Validation** tab, as described above).
- [x] **Steps:**
  1. Drag a source field (e.g., `status`) onto a target field.
  2. Observe that an **operator pill** (green `= equals`) appears between the arrow (←) and the source path on the target row.
- [x] **Expected:** Operator pill is visible, colored green, and clickable.

### P0-02: Operator pills are NOT shown for non-validation adapters

- [x] **Setup:** Open the Extraction Data Mapper (Test Editor → **Extract** tab → Data Mapper).
- [x] **Steps:**
  1. Create a mapping by dragging a source field to a target.
  2. Inspect the target row.
  3. Right-click the mapped target field to open the context menu.
  4. Check the toolbar for the **Rules** button.
- [x] **Expected:** No operator pill appears. The row shows only `targetField ← sourcePath` without any operator badge. The right-click context menu shows **Rename…**, **Edit expression…**, and **Remove mapping** — but does NOT show "Set operator…" (operator actions are exclusive to the validation adapter). The **Rules** button does NOT appear in the toolbar, and no "Validation Rules" panel is shown at the bottom (the code editor/rules panel is exclusive to the validation adapter).

### P0-03: Array assertions gated by capability

- [x] **Setup:** In the Validation Data Mapper, locate an array node in the target tree (e.g., `offers`).
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

- [x] **Setup:** Compare the Validation Data Mapper toolbar to the Extraction Data Mapper toolbar.
- [x] **Steps:**
  1. Open the Validation Data Mapper (from the **Validation** tab). Look for the **Rules** button in the toolbar.
  2. Close the mapper. Open the Extraction Data Mapper (from the **Extract** tab). Look for the **Rules** button.
- [x] **Expected:** The **Rules** button is visible only in the validation context. It is **absent** in the extraction, variable binding, request body, and demo adapters — these adapters do not have validation rules to manage (`codeEditor` capability is `false`).

---

## Phase 1 — Field Operator Foundation (24 Operators)

> **Context:** All P1 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper). Operators are exclusive to this context.

### P1-01: Default operator on auto-map

- [x] **Setup:** Open the Validation Data Mapper with sample JSON loaded.
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

- [x] **Setup:** Map `isActive` from source to target.
- [x] **Steps:**
  1. Set operator to **✓ is true** (red pill).
  2. Confirm no value input appears (is_true needs no value).
  3. Switch to **✗ is false** (red pill).
- [x] **Expected:** Red pills. No value input field shown for either.

### P1-06: Existence operators (exists, not_exists)

- [x] **Setup:** Map `metadata.version` from source to target.
- [x] **Steps:**
  1. Set operator to **∃ exists** (gray pill).
  2. Confirm no value input.
  3. Switch to **∄ not exists** (gray pill).
- [x] **Expected:** Gray pills with no value input.

### P1-07: Null operators (is_null, is_not_null, is_empty, is_not_empty)

- [x] **Setup:** Map `deletedAt` from source to target. Also map `errors`.
- [x] **Steps:**
  1. On `deletedAt`: set **∅ is null** (gray pill). Verify no value input.
  2. Switch to **⊙ not null**. Verify no value input.
  3. On `errors` (empty array): set **∅ is empty** (gray pill). Verify no value input.
  4. Switch to **⊙ not empty** (gray pill).
- [x] **Expected:** Gray pills for all four. No value input needed.

### P1-08: Set membership operators (in, not_in)

- [x] **Setup:** Map `status` from source to target.
- [x] **Steps:**
  1. Set operator to **∈ in** (blue pill).
  2. Enter value: `"active", "pending", "approved"`.
  3. Switch to **∉ not in** (blue pill). Enter value: `"deleted", "banned"`.
- [x] **Expected:** Blue pills. Value input accepts comma-separated quoted strings.

### P1-09: Between operator

- [x] **Setup:** Map `offers[0].price` from source to target.
- [x] **Steps:**
  1. Set operator to **↔ between** (amber pill).
  2. Two separate number inputs appear (min / max) separated by a dash.
  3. Enter min: `10`, press Enter to move to max, enter `100`.
- [x] **Expected:** Amber pill. Two-box input for min/max. Value stored as `10, 100`.

### P1-10: Close-to operator (approximate numeric)

- [x] **Setup:** Map `latitude` from source to target.
- [x] **Steps:**
  1. Set operator to **≈ close to** (amber pill).
  2. Two separate number inputs appear (value / tolerance) separated by a dash.
  3. Enter value: `40.7`, press Enter, enter tolerance: `0.1`.
- [x] **Expected:** Amber pill. Two-box input for value/tolerance. Value stored as `40.7, 0.1`.

### P1-11: Operator picker — search and categories

- [x] **Setup:** Click any mapped field's operator pill.
- [x] **Steps:**
  1. The **operator picker dropdown** opens with a search box and categorized sections.
  2. Verify categories: **Equality**, **Comparison**, **String**, **Boolean**, **Type**, **Existence**, **Set**.
  3. Type `"contain"` in search. Verify only matching operators appear (`contains`, `not_contains`, `array_length` may not match but collection items may).
  4. Clear search. All operators reappear.
- [x] **Expected:** Searchable dropdown with grouped operators. Each operator shows icon + label + "value" hint (for operators requiring a value).

### P1-12: Operator pill color scheme on canvas lines

- [x] **Setup:** Create several mappings with different operator types (equals, >=, contains, is_true, is_type, exists, in).
- [x] **Steps:**
  1. Ensure **Lines** are visible (toolbar toggle).
  2. Observe the canvas connection lines between source and target panels.
- [x] **Expected:** Mid-line badges appear color-coded: green (equality), amber (comparison), purple (string), red (boolean), teal (type), gray (existence), blue (set).

---

## Phase 2 — Type & Existence Assertions

> **Context:** All P2 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper).

### P2-01: Type-check operator (is_type)

- [x] **Setup:** Map `count` from source to target.
- [x] **Steps:**
  1. Set operator to **τ is type** (teal pill).
  2. A **dropdown** appears automatically with options: `string`, `number`, `boolean`, `object`, `array`, `null`.
  3. Select `number` from the dropdown — it commits immediately.
- [x] **Expected:** Teal pill showing the type value. Dropdown auto-opens when `is_type` is selected, no manual typing needed.

### P2-02: Type-check for all types

- [x] **Steps:** For each field, set `is_type` and select the type from the dropdown:
  1. `name` → select `string` (teal pill).
  2. `count` → select `number` (teal pill).
  3. `isActive` → select `boolean` (teal pill).
  4. `offers` → select `array` (teal pill).
  5. `config` → select `object` (teal pill).
  6. `deletedAt` → select `null` (teal pill).
- [x] **Expected:** All six type pills render with the correct type value in teal. Each selection commits immediately via dropdown.

### P2-03: Existence assertion (existence assertion type)

- [x] **Setup:** Open the **Rules** modal (toolbar → Rules button).
- [x] **Steps:**
  1. Type the following DSL:
     ```
     metadata.version  exists
     _internal         not_exists
     ```
  2. Click **Save** to apply changes and close the Rules modal.
  3. Observe the target tree.
- [x] **Expected:** The target tree shows `metadata.version` with a gray `∃ exists` pill and a new virtual node `_internal` with `∄ not exists` pill (or the DSL rule is reflected in the rules summary). Clicking **Cancel** instead discards changes and reverts to the state when the modal was opened.

---

## Phase 3 — Collection & Structural Assertions

> **Context:** All P3 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper). Array assertions are exclusive to this context.

### P3-01: Array length assertion (inline row)

- [x] **Setup:** Locate `offers` (array node) in the target tree.
- [x] **Steps:**
  1. Right-click on `offers`. Select **Check array size** from the ARRAY ASSERTIONS section.
  2. An inline assertion row appears beneath the array node: `LENGTH  >=  [1]`.
  3. Change the comparison operator dropdown to a different operator (e.g. `=`).
  4. Click the value `1` and change it to `3`.
- [x] **Expected:**
  - Row shows the updated assertion with operator and value.
  - The array node header updates to show assertion count.

### P3-02: Array contains assertion (4 modes: any, all, only, none)

- [x] **Setup:** Right-click `offers` array → **Contains value (exact match)**.
- [x] **Steps:**
  1. An inline assertion row appears: `∋ CONTAINS` with placeholder hint `"value" or {"key": "value"} — exact match`.
  2. Click the value area and type `{"offerName": "Connected Access - 8 Years"}` (must be valid JSON for object matching, or a quoted string for literal matching).
  3. Observe the assertion row updates and verify passes/fails.
  4. Repeat, adding assertions with different modes if mode selection is available (any/all/only/none).
- [x] **Expected:** The inline row shows the contains assertion with mode and value. Multiple contains assertions can coexist. Values use JSON format: `{"key": "value"}` for exact field matching, `"string"` for literal matching.

> **CONTAINS vs SUBSET:** CONTAINS does exact value comparison on matched properties. SUBSET does deep recursive partial matching — extra fields in the actual data are ignored. Use CONTAINS for simple value checks; use SUBSET when you need to match nested objects without specifying every field.

### P3-03: Each assertion (element-level)

- [x] **Setup:** Right-click `offers` array → **Every item must match**.
- [x] **Steps:**
  1. An inline assertion row appears: `∀ EACH` with placeholder hint `value (applied to each item)`.
  2. Set the field path to `rank` and operator to `>=` with value `0`.
- [x] **Expected:** Row shows: `∀ EACH  rank  >=  [0]`. This asserts every `offers[*].rank >= 0`.

### P3-04: Subset assertion (deep partial match)

- [x] **Setup:** Right-click `offers` array → **Contains object (deep partial match)**.
- [x] **Steps:**
  1. An inline assertion row appears: `⊆ SUBSET` with placeholder hint `{"key": "value", ...} — matches nested fields too`.
  2. Enter the expected JSON: `{"offerName": "OnStar Safety Plan"}`.
  3. Hover the SUBSET pill — tooltip shows "Has item matching partial object (nested)".
- [x] **Expected:** Row shows: `⊆ SUBSET  {"offerName": "OnStar..."`. Truncated if long. Unlike CONTAINS, SUBSET ignores extra fields in the actual data and matches nested structures recursively.

> **Example — when to use SUBSET instead of CONTAINS:**
>
> Given this response array:
> ```json
> "offers": [
>   {
>     "associatedOfferingCode": "CA2RCNCP08YUCMX",
>     "rank": 13,
>     "offerName": "Connected Access - 8 Years",
>     "productCode": "Connected Access",
>     "billingCadence": "Prepaid",
>     "planType": "Trial",
>     "duration": { "unit": "Years", "value": 8 }
>   }
> ]
> ```
>
> | Assertion | Value | Matches? | Why |
> |-----------|-------|----------|-----|
> | `∋ CONTAINS` | `{"offerName": "Connected Access - 8 Years"}` | Yes | Exact field match — the item has that exact field/value |
> | `⊆ SUBSET` | `{"offerName": "Connected Access - 8 Years"}` | Yes | Partial match — same result for flat objects |
> | `∋ CONTAINS` | `{"duration": {"unit": "Years"}}` | **No** | CONTAINS compares the entire `duration` object — `{"unit": "Years"}` ≠ `{"unit": "Years", "value": 8}` |
> | `⊆ SUBSET` | `{"duration": {"unit": "Years"}}` | **Yes** | SUBSET recursively matches — `{"unit": "Years"}` is a subset of `{"unit": "Years", "value": 8}` |
>
> **Rule of thumb:** Use CONTAINS for simple flat field checks. Use SUBSET when matching nested objects where the actual data has additional fields you don't care about.

### P3-05: Multiple array assertions on one node

- [x] **Setup:** Add all four assertion types to `offers`: length, contains, each, subset.
- [x] **Steps:**
  1. Observe the array node header.
  2. Observe all four inline assertion rows stacked beneath the node.
- [x] **Expected:**
  - Header: `3 items · 4 assertions`.
  - Four rows visible, each with its type pill, operator/value, and remove (×) button.
  - Removing one assertion (click ×) decrements the count.
- [x] **Unit tests:** `TargetTreeNode.test.tsx` — 8 tests covering multiple assertion rendering, header badge text (expanded/collapsed), singular/plural, remove button dispatch, and correct type pills.
- [x] **Bug fix applied:** Clicking an array parent node (e.g., `offers`) now correctly selects the mapping even when the operator is filtered by `PARENT_NODE_ALLOWED_OPS`. `TargetTreeNode.tsx` uses `rawMapping` (unfiltered) for click selection and `mapping` (filtered) for rendering details. This fixed the array suggestion bar not appearing when selecting parent nodes.

### P3-06: Inline editing of assertion values

- [x] **Setup:** Have a length assertion `>= 3` on `offers`.
- [x] **Steps:**
  1. Click the value `3`. It becomes an editable input.
  2. Type `5` and press **Enter**. The value commits.
  3. Click the value again, type `2`, press **Escape**. The edit cancels (reverts to `5`).
- [x] **Expected:** Enter commits, Escape cancels. Value updates persist across save.
- [x] **EACH editing:** For `EACH` assertions, clicking the value box shows the **full expression** (e.g., `rank >= 0`) — not just the raw value. Editing uses compound syntax: `fieldPath operator value`. On commit, the input is parsed back into its parts via `parseEachInput()`. This allows editing the field path, operator, and value all in one input.
- [x] **E2E verified:** `e2e/validation-rules-sync.spec.ts` — 5 Playwright tests confirm bidirectional sync between visual assertions and the Rules panel (DSL editor), including value editing, Save/Cancel preservation, and open→close→reopen persistence.

### P3-07: Assertion row layout — value always visible

- [x] **Setup:** Add a length assertion (`>= N`) to an array node (e.g., `offers`).
- [x] **Steps:**
  1. Observe the assertion row: `# LENGTH  >=  [value]  ×`.
  2. Verify all elements are visible within the panel — the type pill, the `>=` select, the value display, and the remove button.
  3. Click the value to enter edit mode. Type a number and press Enter.
  4. Resize the Validation Data Mapper to a narrower width. Verify the row still fits.
- [x] **Expected:** The assertion row lays out correctly within the panel width. The `>=` select dropdown is compact (max ~50px wide), the value display takes remaining flex space, and nothing overflows off-screen. The value is clickable and editable at all panel widths.
- [x] **Fixes applied:** Value display and input widths set to `min-width: 160px; flex: 1` so they never shrink when clicked or at narrow widths. Arrow key navigation works inside input fields (global keyboard hook now skips form controls).

---

## Phase 4 — Code Editor Mode (DSL)

> **Context:** All P4 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper → toolbar → Rules button to open the Rules modal with the DSL editor).

### P4-01: Open the Validation Rules Modal

- [x] **Setup:** In the Validation Data Mapper, locate the toolbar.
- [x] **Steps:**
  1. Click the **Rules** button in the toolbar.
  2. The **Validation Rules Modal** opens (default mode: docked at bottom).
- [x] **Expected:** Modal appears with a Monaco code editor on the left. Header shows rule count.
- [x] **Implementation:** `MapperToolbar.tsx` renders a capability-gated **Rules** button (`onToggleRulesView`). `ValidationRulesModal.tsx` provides the 3-mode panel (docked/floating/maximized) with Monaco editor, DSL reference panel, and header showing verify stats (passed/failed counts). `ValidationRulesModal.test.tsx` covers modal rendering, mode switching, Save/Cancel, and rule count display.

### P4-02: Write DSL rules — field assertions

- [x] **Steps:** Type the following in the editor:
  ```
  # Field assertions
  offers[0].associatedOfferingCode  equals  "ONZFCNCPR3MCAL4"
  offers[0].rank  >=  1
  offers[0].offerName  contains  "OnStar"
  offers[0].isActive  is_true
  offers[0].productCode  exists
  offers[0].duration.value  between  1, 365
  ```
- [x] **Expected:** Each line is syntax-highlighted:
  - Paths in **cyan**.
  - Operators in their category color (green for equals, amber for >=, purple for contains, red for is_true, gray for exists).
  - Values in green (strings), amber (numbers).
  - Comments (`#`) in gray.

### P4-03: Write DSL rules — collection assertions

- [x] **Steps:** Add these lines:
  ```
  # Collection assertions
  offers  length >=  3
  offers  contains_any  {"offerName": "EV Access - 8 Years"}
  offers[*].rank  each >=  0
  ```
- [x] **Expected:** Syntax highlighting applies. `length`, `contains_any`, `each` are recognized keywords.
- [x] **Note:** `contains_any` value must be valid **JSON** — use `{"field": "value"}` for object matching, or `"literal"` for primitive matching. The old `field = "value"` syntax does NOT work (it's treated as a raw string and won't match objects).

### P4-04: DSL autocomplete

- [x] **Steps:**
  1. On a new line, type `off` — suggestions auto-appear as you type (no shortcut needed).
  2. A suggestion list appears with paths containing `off` (e.g., `offers`, `offers[0].offerName`, `offers[0].associatedOfferingCode`).
  3. Select `offers[0].offerName` with Tab or Enter. The path auto-completes.
  4. Press Space. Type `cont` — operator suggestions auto-appear: `contains_any`, `contains_all`, etc.
  5. After selecting an operator, type a value — `true`/`false` suggestions appear for boolean operators, type names for `is_type`.
- [x] **Expected:** Path completions from the JSON tree. Operator keyword completions. Value suggestions contextual to operator.
- [x] **Implementation:** Autocomplete triggers **automatically while typing** via `quickSuggestions: { other: true }`. No manual shortcut needed — macOS intercepts `Ctrl+Space` (input source) and `Cmd+Space` (Spotlight), so relying on shortcuts is unreliable. Fallback shortcuts registered: `Cmd+I`, `Option+Space`, `Ctrl+Space` (Windows/Linux). The completion provider in `ValidationCodeEditor.tsx` uses a global `window.__REDFIRE_VALIDATION_PATHS` array (populated from `samplePaths` prop) to provide path suggestions at the first-word position, operator keywords after the path, and contextual values after the operator. Trigger characters `.` and `[` also activate suggestions for nested path navigation. Footer hint: "Auto-suggest while typing". E2E verified: `e2e/validation-dsl-roundtrip.spec.ts` confirms suggest widget appears with 12+ path suggestions after typing `of`.

### P4-05: DSL inline errors & pass/fail line decorations

- [x] **Steps — Parse Errors:**
  1. Type an invalid line: `name  unknownOp  "bar"`.
  2. Observe: the line gets a **red background highlight** and a **red gutter bar** (same visual treatment as failed verification lines), plus a **red squiggle underline** from Monaco error markers.
  3. The header shows the error count (e.g., "1 error").
  4. Click **Save**, close the Rules panel, then reopen it.
  5. Observe: the error line is **preserved** — it was not discarded during the save/reopen cycle. The red highlight and error count still display correctly.
- [x] **Expected:** Parse error lines get red background + red gutter bar + squiggly underline. Error lines survive Save → close → reopen round-trips.

- [x] **Steps — Pass/Fail Line Decorations (after Verify):**
  1. Write valid rules (e.g., `status  equals  "active"` and `nonexistent.path  equals  "foo"`).
  2. Close the Rules modal. Click **Verify All** in the toolbar.
  3. Re-open the Rules modal.
  4. Observe: each rule line has a **colored indicator bar** immediately to the left of the line number:
     - **Green bar** (3px) = rule passed
     - **Red bar** (3px) = rule failed
  5. Each line also has a **subtle background tint**: green for passed, red for failed.
  6. Hover over the indicator bar — a tooltip shows "Passed" or "Failed — Expected: X, Got: Y".
- [x] **Expected:** Per-line pass/fail decorations appear in the Monaco editor after verification. Failed lines show red background + red indicator bar with a diagnostic tooltip. Passed lines show green. The toolbar verify summary also shows parse error count (e.g., "13 / 1 failed / 1 error") in amber alongside the red failed count.
- [x] **Implementation:** `ValidationCodeEditor.tsx` accepts `errors: ParseError[]` and `lineResults: LineVerifyResult[]` props. Two separate `useEffect` hooks apply Monaco `deltaDecorations`: one for parse errors (red background + gutter with error message tooltip), one for verification results (pass/fail background + gutter). Both use `linesDecorationsClassName` (for the colored bar next to line numbers) and `className` (for the line background tint). `glyphMargin` is set to `false` so indicators sit tight against line numbers. CSS classes: `.dm-verify-glyph--pass`, `.dm-verify-glyph--fail`, `.dm-verify-line--pass`, `.dm-verify-line--fail` in `data-mapper.css`. The toolbar (`MapperToolbar.tsx`) displays `verifyParseErrorCount` in amber via `.dm-toolbar-verify-error`. Error line preservation is handled by `useValidationCodeSync.ts` via the `lastCodeHadErrors` ref — when the DSL contains parse errors, `syncVisualToCode` skips re-serialization from the visual model to avoid discarding error lines. The flush cleanup effect also sets `lastCodeHadErrors` when the Rules panel closes with a pending debounce. `ValidationRulesModal.tsx` syncs error props independently via `lastSyncedErrorsRef` so error indicators display on reopen. E2E verified: `e2e/validation-dsl-roundtrip.spec.ts` confirms red squiggle + red background on error lines, error lines surviving Save/reopen, and failed verification line highlighting.

### P4-06: Bi-directional sync — Visual → Code

- [x] **Setup:** Close the Rules modal. In the Validation Data Mapper, create a mapping: drag `status` to target, set operator to `equals`, value `"active"`.
- [x] **Steps:**
  1. Open the Rules modal again.
  2. Observe the editor content.
- [x] **Expected:** The editor contains a line: `status  equals  "active"` (or equivalent), reflecting the visual mapping.
- [x] **E2E verified:** `e2e/validation-rules-sync.spec.ts` confirms visual→code sync.

### P4-07: Bi-directional sync — Code → Visual

- [x] **Setup:** In the Rules editor, add a new line: `count  >=  10`.
- [x] **Steps:**
  1. Wait ~300ms for debounced sync.
  2. Close the Rules modal.
  3. Look at the target tree.
- [x] **Expected:** The target field `count` now shows an amber `>=` pill with value `10`, created from the DSL.
- [x] **E2E verified:** `e2e/validation-rules-sync.spec.ts` confirms code→visual sync.

### P4-08: Copy and paste DSL text

- [x] **Steps:**
  1. In the Rules editor, select all (`⌘ A`) and copy (`⌘ C`).
  2. Clear the editor.
  3. Paste (`⌘ V`).
- [x] **Expected:** All rules restore correctly. The parser re-validates on paste.
- [x] **Note:** Multi-line selection works with both mouse drag and `Shift+Up/Down` arrow keys. A guard in `onDidChangeCursorPosition` prevents React re-renders from interrupting active selection (checks `editor.getSelection().isEmpty()` before triggering side effects). Also, `useValidationRulesModal.ts` cleanup ensures `document.body.style.userSelect` is always reset on unmount, preventing lingering selection-disable from drag handlers.

---

## Phase 5 — Live Validation Stage

> **Context:** All P5 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper). Verification features (Verify All, Fetch & Verify, Auto-verify, filters) are exclusive to this context.

### P5-01: Verify All

- [x] **Setup:** Have several field mappings with operators set (e.g., `status equals "active"`, `count >= 10`, `isActive is_true`).
- [x] **Steps:**
  1. Click **Verify All** in the toolbar.
  2. Observe the results.
- [x] **Expected:**
  - Per-node inline badges appear: green ✓ for passing rules, red ✗ for failing.
  - Toolbar shows aggregated results: `N passed · M failed`.
  - Canvas connection lines change color: green for passed, red for failed.

### P5-02: Verify with a failing rule

- [x] **Setup:** Set `count equals 999` (will fail since count is 42).
- [x] **Steps:**
  1. Click **Verify All**.
  2. Observe the `count` node.
- [x] **Expected:** Red ✗ badge on `count`. The toolbar shows 1 failed. Connection line for `count` turns red.

### P5-03: Fetch & Verify (live HTTP request)

- [x] **Setup:** Ensure the test has a valid HTTP endpoint configured.
- [x] **Steps:**
  1. Click **Fetch & Verify** in the toolbar.
  2. Wait for the HTTP response.
- [x] **Expected:** The sample data updates with the live response. All rules re-evaluate against the fresh data. Results (✓/✗) update accordingly.

### P5-04: Auto-verify toggle

- [x] **Setup:** Enable the **Auto** checkbox in the toolbar.
- [x] **Steps:**
  1. Change an operator value (e.g., change `count >= 10` to `count >= 100`).
  2. Wait ~500ms.
  3. Observe the badges update automatically without clicking Verify.
- [x] **Expected:** Badges and pass/fail counts update automatically after each edit when auto-verify is on.

### P5-05: Failure navigation

- [x] **Setup:** Have 2+ failing rules and 5+ passing rules.
- [x] **Steps:**
  1. Click the **failed count** in the toolbar. A dropdown of failed rules appears.
  2. Click a failed rule in the dropdown. The target tree scrolls to and highlights that node.
  3. Use **prev/next arrows** to navigate between failures.
- [x] **Expected:** Each failure is scrolled into view and highlighted. Navigation cycles through all failures.

### P5-06: Filter by pass/fail

- [x] **Setup:** After verification, have mixed pass/fail results.
- [x] **Steps:**
  1. In the target panel filter dropdown, select **Passed**. Only passing nodes are visible.
  2. Switch to **Failed**. Only failing nodes are visible.
  3. Switch back to **All**.
- [x] **Expected:** Filter correctly shows/hides nodes based on verification status.

### P5-07: DSL assertion evaluation in verify

- [x] **Setup:** Open the Rules modal. Type:
  ```
  offers  length >=  3
  isActive  is_true
  count  >=  10
  ```
- [x] **Steps:**
  1. Close the modal. Click **Verify All**.
  2. Observe the verify counts.
- [x] **Expected:** All three DSL-originated assertions are counted in the pass/fail totals. The verify stats in both the toolbar and the Rules modal header show the correct total (field operator assertions + DSL assertions combined).

---

## Phase 6 — JSON Schema Validation

> **Context:** P6 tests are performed in the **Test Editor → Validation tab** (NOT inside the Data Mapper). JSON Schema is a Test Editor-level assertion.

### P6-01: JSON Schema assertion via Test Editor

- [x] **Setup:** Open a test scenario → click **Edit** → go to the **Validation** tab.
- [x] **Steps:**
  1. Click the **Add assertion** button (or "+" menu) and select **JSON Schema**.
  2. A schema editor row appears with buttons: **Paste Schema**, **Pretty**, **Minify**, **Generate from Response**.
  3. Paste the following schema into the textarea:
     ```json
     {
       "type": "object",
       "properties": {
         "offers": {
           "type": "array",
           "minItems": 1
         }
       }
     }
     ```
  4. Click **Pretty** to format it with indentation.
  5. Click **Verify**. Confirm the assertion passes (response body is an object with an `offers` array containing at least 1 item).
  6. Change `"minItems": 1` to `"minItems": 100` and click **Verify** again. Confirm the assertion now fails with a clear error message.
- [x] **Expected:** Schema validation passes when the response matches the schema, and fails with an informative error (including the violated constraint path) when it doesn't. The JSON Schema assertion is engine-level (evaluated by Ajv) and managed through the Test Editor Validation tab — not through the Validation Data Mapper DSL.

---

## Phase 7 — Expression Engine Enrichment (125 Functions)

> **Context:** P7-01, P7-03, P7-04 are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper). P7-02 is performed inside the **Extraction Data Mapper** (Extract tab → Data Mapper).

### P7-01: Expression editor on a mapping

- [x] **Setup:** Open the Validation Data Mapper. Map any single source field to a target (e.g., drag `count` → `count`). Any mapped field works.
- [x] **Steps:**
  1. Right-click the mapped target node. Select **Edit expression...** from the context menu.
  2. The **Expression Editor Modal** opens.
  3. In the expression input, type `$count($.` — the autocomplete dropdown appears showing available paths including parent/array nodes (e.g., `$.offers`, `$.config`) and leaf paths (e.g., `$.offers[0].associatedOfferingCode`). Select or type `$.offers)` to complete: `$count($.offers)`.
  4. Observe the **live preview** showing the result (e.g., `3`).
  5. Try other expressions:
     - `$sum($map($.offers, x => x.price))` → sum of all prices.
     - `$upper($.name)` → `"ONSTAR PREMIUM PACKAGE"`.
  6. **Note:** Paths in the Expression Editor use `$.fieldName` format (as shown in autocomplete). The hint below the input says "Type `$.` for source paths".
- [x] **Expected:** Expression editor has a function catalog. Live preview evaluates the expression against sample data. Result updates as you type.

### P7-02: Variable rename — inline click and Expression Editor (extraction adapter)

- [x] **Setup:** Open the Extraction Data Mapper (from the **Extract** tab). Map a source field to create an extraction.
- [x] **Steps — Inline rename (single click):**
  1. In the Target panel, observe mapped leaf field names (e.g., `associatedOfferingCode`). They display a dashed underline and turn blue on hover, indicating they are editable.
  2. Single-click the field name text. An inline text input appears with the current path selected.
  3. Type a new name (e.g., `myVar`) and press **Enter** to commit, or **Escape** to cancel.
  4. Inspect the target tree — the field is now named `myVar`.
- [x] **Steps — Expression Editor rename:**
  1. Right-click the mapped target node → **Edit expression…** to open the Expression Editor (or double-click the row).
  2. Observe the top of the modal: a **VARIABLE NAME** input field appears below the header, showing the current target path.
  3. Click into the Variable Name field, clear it, and type `myVar2`.
  4. Press **Enter** to commit the rename.
  5. Close the Expression Editor.
  6. Inspect the target tree — the field should now be named `myVar2`.
  7. Re-open the Expression Editor for the same field. Verify the Variable Name field shows `myVar2`.
- [x] **Expected:** Two ways to rename: (1) **Inline click** on the field name text for quick rename — available on any mapped leaf field in adapters with `allowCustomFields: true` (extraction, column mapping, webhook extraction, etc.). The field name shows a dashed underline + blue hover to indicate editability. (2) **Expression Editor** rename via the VARIABLE NAME input field. Both methods update the target field name and all affected mappings. Neither rename method is available in the validation adapter (validation targets are schema fields, not user-defined).

### P7-03: Expression Editor — viewport fit and resize

- [x] **Setup:** In the Validation Data Mapper, open the Expression Editor (right-click a mapped target node → Edit expression, or double-click a mapped node).
- [x] **Steps:**
  1. Resize the browser window to a smaller height (e.g., 600px).
  2. Open the Expression Editor.
  3. Verify the modal stays fully within the viewport (no overflow past top or bottom edges).
  4. Try dragging the modal by its header — it supports drag repositioning.
  5. Grab the bottom-right corner resize handle and drag to resize the modal.
  6. Verify the modal respects minimum size constraints (480px width, 320px height).
  7. Click **Full screen** to expand — verify resize handle disappears in fullscreen mode.
- [x] **Expected:** The Expression Editor modal is portaled to escape CSS stacking context issues. `max-height` is clamped to `min(80vh, calc(100vh - 40px))`. The modal supports **drag** (via header) and **resize** (via bottom-right handle, `resize: both`). Minimum size prevents collapsing too small. Resize is disabled in fullscreen mode.

### P7-04: Expression function categories in catalog

- [x] **Setup:** In the Validation Data Mapper Expression Editor Modal, open the function catalog.
- [x] **Steps:**
  1. Browse the 8 categories: **String** (31), **Math** (28), **Array** (16), **Object** (11), **Conditional** (11), **JSON** (15), **Date/Time** (8), **Encoding** (5).
  2. Click a function to see its signature and description.
  3. Click Insert to add it to the expression.
- [x] **Expected:** All 125 functions are listed, organized by category, with descriptions.

---

## Phase 8 — Nice-to-Have Operators

> **Context:** P8-01 and P8-02 are performed in the **Test Editor → Validation tab** (assertion rows). P8-03 and P8-04 are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper).

### P8-01: Body size assertion

- [x] **Setup:** Open the **Validation** tab in the Test Editor. Click **+ Add** → under **Response** category, select **Body Size**.
- [x] **Steps:**
  1. A `SIZE` assertion row appears with a **NOT** toggle, an **operator** dropdown (less than / at most / exactly / at least / more than / not equal), a **numeric value** input, and a **unit** dropdown (Bytes / KB / MB).
  2. Set operator to `more than`, value to `1024`, unit to `KB`.
  3. Optionally toggle **NOT** to negate the assertion.
  4. Click **Verify** or run the test.
- [x] **Expected:** Assertion passes if the response body is larger than 1024 KB (or fails if NOT is toggled). The UI shows the SIZE badge, operator, value, and unit inline.

### P8-02: Date precision assertion

- [x] **Setup:** In the **Test Editor → Validation tab**, click **+ Add** → select **Date Precise**. Fill in the JSON path `createdAt`.
- [x] **Steps:**
  1. Set operator to a comparison (e.g., `<=`).
  2. Enter a reference date value.
  3. The `datePrecise` assertion type supports `day`, `hour`, `min`, `sec`, `ms` precision.
- [x] **Expected:** Date comparison evaluates with the specified precision level.

### P8-03: Between operator (Validation Data Mapper)

- [x] **Setup:** In the Validation Data Mapper, map `offers[0].price` to target.
- [x] **Steps:**
  1. Set operator to **↔ between** (amber pill).
  2. Enter `10, 100`.
  3. Click **Verify All**.
- [x] **Expected:** Passes (49.99 is between 10 and 100). Change to `50, 100` and re-verify: fails (49.99 < 50).

### P8-04: Close-to operator (Validation Data Mapper)

- [x] **Setup:** In the Validation Data Mapper, map `latitude` to target.
- [x] **Steps:**
  1. Set operator to **≈ close to** (amber pill).
  2. Enter `40.7, 0.1` (value=40.7, tolerance=0.1).
  3. Click **Verify All**.
- [x] **Expected:** Passes (40.7128 is within 0.1 of 40.7). Change tolerance to `0.001` and re-verify: fails.

---

## Phase 9.1 — Universal Negation

> **Context:** All P9.1 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper).

### P9.1-01: Negate via operator picker

- [x] **Setup:** Open the Validation Data Mapper. Map `status` to target with `equals "active"`.
- [x] **Steps:**
  1. Click the operator pill to open the picker.
  2. At the top, toggle the **Negate (NOT)** button. A checkmark appears.
  3. Close the picker.
- [x] **Expected:** The operator pill now shows a red `NOT` badge or visual indicator alongside the green `= equals`. The mapping's `negate` flag is `true`.

### P9.1-02: Negate via context menu

- [x] **Setup:** In the Validation Data Mapper, map `isActive` to target with `is_true`.
- [x] **Steps:**
  1. Right-click the `isActive` target node.
  2. Select **Negate (NOT)** from the context menu.
- [x] **Expected:** The pill shows `NOT is_true`. Toggling again removes negation.

### P9.1-03: Negate in DSL code

- [x] **Setup:** In the Validation Data Mapper, open the Rules modal (toolbar → Rules).
- [x] **Steps:**
  1. Type: `offers[0].offerName  not_equals  "Connected Access - 8 Years"`.
  2. Close the modal and inspect the visual tree.
- [x] **Expected:** The `offers[0].offerName` field shows `≠ not equals` operator pill with value `"Connected Access - 8 Years"`. Alternatively, using `NOT equals` prefix syntax (`offers[0].offerName  NOT equals  "Connected Access - 8 Years"`) produces the same result — the `NOT` badge appears alongside the `= equals` pill, and syntax highlighting renders `NOT` in red.

### P9.1-04: NOT on array assertions in DSL

- [x] **Setup:** In the Validation Data Mapper, open the Rules modal.
- [x] **Steps:** In the Rules editor, type:
  ```
  offers  NOT length >=  10
  offers[*].rank  NOT each >=  100
  ```
- [x] **Expected:** Negation applies to collection assertions. After verification, `NOT length >= 10` passes (because length is 3, which is NOT >= 10).

### P9.1-05: Verification with negation

- [x] **Setup:** In the Validation Data Mapper, set `offers[0].offerName NOT equals "Cancelled Plan"` (via operator pill or DSL).
- [x] **Steps:**
  1. Click **Verify All** in the toolbar.
- [x] **Expected:** Passes (offerName is "Connected Access - 8 Years", which is NOT equal to "Cancelled Plan"). Green ✓ badge.

---

## Phase 9.2 — Lambda Expression Syntax

> **Context:** All P9.2 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper) using the Expression Editor (right-click a mapped target node → Edit expression…).

### P9.2-01: Lambda in expression editor

- [ ] **Setup:** Open the Validation Data Mapper. Map any field to target, then right-click → **Edit expression…** to open the Expression Editor.
- [ ] **Steps:**
  1. Type: `$filter($.source.offers, x => x.isActive)`.
  2. Observe the live preview.
- [ ] **Expected:** Preview shows an array of 2 offers (the ones with `isActive: true`). Lambda syntax `x => x.isActive` is parsed correctly.

### P9.2-02: Multi-param lambda

- [ ] **Setup:** In the Validation Data Mapper Expression Editor (same as P9.2-01).
- [ ] **Steps:**
  1. Type: `$reduce($.source.offers, (acc, x) => $add(acc, x.price), 0)`.
  2. Observe the preview.
- [ ] **Expected:** Preview shows `95.48` (sum of all prices). Multi-param `(acc, x) => body` syntax works.

### P9.2-03: Lambda with higher-order functions

- [ ] **Setup:** In the Validation Data Mapper Expression Editor.
- [ ] **Steps:** Test various HOFs:
  1. `$map($.source.offers, x => x.offerName)` → `["EV Access - 8 Years", "OnStar Safety Plan", "Premium Navigation"]`.
  2. `$any($.source.offers, x => $gt(x.rank, 2))` → `true` (rank 3 exists).
  3. `$all($.source.offers, x => $gte(x.rank, 1))` → `true` (all ranks >= 1).
  4. `$sortBy($.source.offers, x => x.price)` → sorted by price ascending.
  5. `$find($.source.offers, x => $eq(x.offerName, "OnStar Safety Plan"))` → the matching offer object.
- [ ] **Expected:** Each function evaluates correctly with lambda syntax.

### P9.2-04: Comparison helper functions in lambdas

- [ ] **Setup:** In the Validation Data Mapper Expression Editor.
- [ ] **Steps:**
  1. `$filter($.source.offers, x => $gt(x.price, 20))` → 2 offers (49.99 and 29.99).
  2. `$filter($.source.offers, x => $lte(x.rank, 2))` → 2 offers (rank 1 and 2).
- [ ] **Expected:** `$gt`, `$gte`, `$lt`, `$lte`, `$eq`, `$neq` work correctly inside lambda bodies.

---

## Phase 9.3 — Custom Predicate Functions (ASSERT)

> **Context:** All P9.3 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper → toolbar → Rules modal → DSL editor).

### P9.3-01: ASSERT keyword in DSL

- [ ] **Setup:** Open the Validation Data Mapper, then open the Rules modal (toolbar → Rules).
- [ ] **Steps:**
  1. Type: `ASSERT $gt($count($.body.offers), 0)`.
  2. Click **Save**, close the Rules modal, then click **Verify All** in the toolbar.
- [ ] **Expected:** The custom assertion evaluates. Since `$count(offers) = 3 > 0`, it passes (✓).

### P9.3-02: ASSERT with description comment

- [ ] **Setup:** In the Validation Data Mapper Rules modal DSL editor.
- [ ] **Steps:**
  1. Type: `ASSERT $gt($.body.count, 0)  // count must be positive`.
  2. Save and verify.
- [ ] **Expected:** Passes. The `// count must be positive` is treated as a description/comment.

### P9.3-03: ASSERT with complex expression

- [ ] **Setup:** In the Validation Data Mapper Rules modal DSL editor.
- [ ] **Steps:**
  1. Type:
     ```
     ASSERT $eq($sum($map($.body.offers, x => x.rank)), 6)
     ```
     (Sum of ranks: 1+2+3 = 6)
  2. Save and verify.
- [ ] **Expected:** Passes. Lambda and HOFs work inside ASSERT expressions.

### P9.3-04: NOT ASSERT (negated custom predicate)

- [ ] **Setup:** In the Validation Data Mapper Rules modal DSL editor.
- [ ] **Steps:**
  1. Type: `NOT ASSERT $isEmpty($.body.offers)`.
  2. Save and verify.
- [ ] **Expected:** Passes (offers is NOT empty). The negation inverts the predicate result.

### P9.3-05: ASSERT failure produces clear error

- [ ] **Setup:** In the Validation Data Mapper Rules modal DSL editor.
- [ ] **Steps:**
  1. Type: `ASSERT $gt($.body.count, 1000)`.
  2. Save and verify.
- [ ] **Expected:** Fails (✗). The error message indicates the assertion failed, showing the expression and the actual value.

---

## Phase 9.4 — Validation Rules Modal (3-Mode Layout + DSL Reference)

> **Context:** All P9.4 tests are performed inside the **Validation Data Mapper** (Validation tab → Data Mapper). The Rules modal is opened via the **Rules** button in the Validation Data Mapper toolbar.

### P9.4-01: Rules modal — Docked mode (default)

- [ ] **Setup:** Open the Validation Data Mapper. Click the **Rules** button in the toolbar.
- [ ] **Steps:**
  1. The modal opens at the bottom of the Validation Data Mapper (docked mode).
  2. A **resize handle** is visible at the top edge of the modal.
  3. Drag the resize handle upward to increase height (up to ~600px).
  4. Drag it down to decrease (minimum ~80px).
- [ ] **Expected:** Docked panel with resizable height. The mapper canvas shrinks/grows to accommodate.

### P9.4-02: Rules modal — Mode switching

- [ ] **Steps:**
  1. In the modal header, find the mode selector dropdown (shows "⬓ Bottom" by default).
  2. Change to **⧉ Floating**. The modal detaches and becomes a floating window.
  3. Change to **⬜ Full Screen**. The modal fills the entire mapper area.
  4. Change back to **⬓ Bottom**. The modal re-docks.
- [ ] **Expected:** Smooth transitions between all three modes. No layout glitches.

### P9.4-03: Floating mode — Drag and resize

- [ ] **Setup:** In the Validation Data Mapper Rules modal, switch to **Floating** mode.
- [ ] **Steps:**
  1. Drag the header to reposition the floating window.
  2. Drag the corner resize grip to resize the window.
  3. Drag the right edge to resize width only.
- [ ] **Expected:** The floating window can be freely positioned and resized. Editor content remains intact.

### P9.4-04: Maximized mode

- [ ] **Setup:** In the Validation Data Mapper Rules modal, switch to **Full Screen** mode.
- [ ] **Steps:**
  1. The modal fills the entire mapper area.
  2. The mapper canvas is hidden (CSS `:has()` selector hides it).
  3. The editor is fully visible with maximum space.
- [ ] **Expected:** Full-screen editor with no visible canvas. Switching back to another mode restores the canvas.

### P9.4-05: Mode persistence

- [ ] **Setup:** In the Validation Data Mapper Rules modal, switch to **Floating** mode.
- [ ] **Steps:**
  1. Close the Rules modal (Cancel button or Escape).
  2. Re-open the Rules modal (click Rules in toolbar).
- [ ] **Expected:** The modal opens in **Floating** mode (persisted to `localStorage`).

### P9.4-06: DSL Reference Panel — Toggle

- [ ] **Setup:** Open the Validation Data Mapper Rules modal (toolbar → Rules).
- [ ] **Steps:**
  1. Locate the **Reference** button in the header — it toggles the panel.
  2. Also locate the **edge toggle button** (`▸`/`◂`) on the vertical boundary between the code editor and the reference panel.
  3. Click the edge toggle to hide the reference panel. The editor takes full width. The toggle becomes wider (26px) and shows a vertical **"REF"** label with a `◂` chevron, with a subtle purple-accent border for discoverability.
  4. Click the edge toggle again to show the reference panel. It narrows back to 18px with just `▸`.
  5. Alternatively, use the header **Reference** button — both controls toggle the same state.
- [ ] **Expected:** The reference panel shows/hides. The edge toggle is always visible as a vertical strip — thin when the panel is open, wider with label when collapsed. State persists across close/reopen via `localStorage`.
- [ ] **Implementation:** `ValidationRulesModal.tsx` renders a `<button className="vr-ref-edge-toggle">` between the editor pane and the reference panel inside `vr-modal-body`. CSS class `vr-ref-edge-toggle--collapsed` applies when reference is hidden, widening the button and adding the vertical "REF" label. E2E test: `e2e/validation-rules-edge-toggle.spec.ts`.

### P9.4-07: DSL Reference Panel — Categories (Accordion)

- [ ] **Steps:**
  1. With the reference panel open, observe the categories:
     - **Equality** (= icon, green) — 2 operators
     - **Comparison** (≶ icon, amber) — 6 operators
     - **String** (Aa icon, purple) — 5 operators
     - **Boolean & Null** (?! icon, red) — 6 operators
     - **Type & Existence** (T icon, cyan) — 3 operators
     - **Set Membership** (∈ icon, blue) — 2 operators
     - **Collection** ([] icon, teal) — 4 operators
     - **Custom & Modifiers** (λ icon, mauve) — merged section covering ASSERT, NOT, syntax guide
  2. All sections start **collapsed** by default.
  3. Click a category to expand it. Only **one section opens at a time** (accordion behavior) — clicking a new section auto-closes the previous one.
  4. Operator entries are compact: name + description on one line, syntax below, with **Insert** (+) and **Copy** actions always visible inline.
  5. Operator content is indented relative to the section header.
- [ ] **Expected:** 8 categories (merged from original 10). Accordion mode — one open at a time. Compact layout with inline actions. Entry count badge shown next to each section header.
- [ ] **Implementation:** `DslReferencePanel.tsx` uses `useState<Set<string>>(() => new Set())` for collapsed-by-default. `toggleSection` clears all other open sections for accordion behavior. "Custom Predicates", "Modifiers", and "Syntax Guide" merged into "Custom & Modifiers".

### P9.4-08: DSL Reference Panel — Search

- [ ] **Steps:**
  1. In the reference panel search box, type `"between"`.
  2. Only the Comparison section shows, filtered to the `between` entry.
  3. Clear the search. All sections reappear.
  4. Type `"ASSERT"`. The Custom & Modifiers section shows.
- [ ] **Expected:** Search filters entries across all sections by keyword, description, syntax, and example.

### P9.4-09: DSL Reference Panel — Insert

- [ ] **Steps:**
  1. Place the cursor on an empty line in the DSL editor.
  2. In the reference panel, find the `equals` entry.
  3. Click the **Insert** (+) button (always visible inline, no hover required).
- [ ] **Expected:** The example syntax (e.g., `offers[0].name  equals  "Premium"`) is inserted at the cursor position in the editor.

### P9.4-10: DSL Reference Panel — Copy

- [ ] **Steps:**
  1. In the reference panel, find the `contains` entry.
  2. Click the **Copy** button (always visible inline next to Insert).
  3. Paste (`⌘ V`) into a text editor.
- [ ] **Expected:** The syntax template is copied to the clipboard.

### P9.4-11: DSL Reference Panel — Expand/Collapse All

- [ ] **Steps:**
  1. Click **Expand all** (▼) in the reference header.
  2. All 8 sections expand.
  3. Click **Collapse all** (▲).
  4. All sections collapse.
  5. Note: After using Expand All, clicking a single section still closes all others (accordion behavior resumes).
- [ ] **Expected:** Bulk expand/collapse works for all categories. The header also has a **close** (×) button that hides the reference panel (equivalent to the edge toggle or header Reference button).

### P9.4-12: Verify stats in modal header

- [ ] **Setup:** In the Validation Data Mapper, have several rules in the DSL editor. Click **Verify All** in the toolbar.
- [ ] **Steps:**
  1. Observe the modal header.
  2. After verification completes, the header shows: **● N rules** (green dot if no errors) / **● N passed** (green) / **● M failed** (red).
- [ ] **Expected:** Verify stats appear in the Rules modal header matching the toolbar counts. E2E verified: header shows `7 rules · 7 passed` after successful verification.

### P9.4-13: DSL assertions counted in verify totals

- [ ] **Setup:** In the Validation Data Mapper Rules modal DSL editor, add mixed rules:
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

- [ ] **Setup:** Open the Validation Data Mapper Rules modal.
- [ ] **Steps:**
  1. With the Rules modal open, press **Escape**.
  2. The modal closes (Cancel behavior — reverts unsaved edits).
  3. Re-open the modal. Start typing a path (e.g., `off`) to trigger the auto-suggest widget.
  4. With the suggest widget open, press **Escape**.
- [ ] **Expected:** First Escape closes the suggest widget only (modal stays open). Press Escape again to close the modal. Implementation: `handleKeyDown` checks for `.editor-widget.suggest-widget.visible` before closing.

### P9.4-15: Portal stacking (z-index)

- [ ] **Setup:** Open the Validation Data Mapper Rules modal in **Floating** mode.
- [ ] **Steps:**
  1. The floating modal renders within the Validation Data Mapper's modal overlay (portaled to closest `.dm-modal-overlay` or `.modal-overlay`).
  2. Click outside the floating window but inside the Validation Data Mapper Modal.
  3. The floating Rules window stays visible (not hidden behind other elements).
- [ ] **Expected:** Correct z-index stacking. The floating Rules window is always on top of the Validation Data Mapper content but within the modal boundary.
- [ ] **E2E verified:** `e2e/validation-rules-modal-zindex.spec.ts` confirms the modal is visible, interactive, and on top.

---

## Cross-Phase Integration Tests

> **Context:** All integration tests are performed inside the **Validation Data Mapper** (Test Editor → Validation tab → Data Mapper) unless explicitly stated otherwise.

### INT-01: Full workflow — Visual + DSL + Verify

- [ ] **Setup:** Open the Validation Data Mapper with sample JSON loaded.
- [ ] **Steps:**
  1. Auto-map all fields. Change some operators visually (equals, >=, contains).
  2. Open the Rules modal. Observe that visual mappings appear as DSL.
  3. Add additional rules via DSL: `ASSERT $gt($.body.count, 0)`.
  4. Close the modal. Verify the visual tree reflects the DSL rules.
  5. Click **Verify All**. Check pass/fail for all rules.
  6. Enable **Auto-verify**. Change a value. Observe auto-re-verify.
- [ ] **Expected:** Complete round-trip: visual → code → verify. All modes stay in sync.

### INT-02: Negation + Lambda + ASSERT combined

- [ ] **Setup:** Open the Validation Data Mapper Rules modal (toolbar → Rules).
- [ ] **Steps:**
  1. In the Rules DSL editor, type:
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

- [ ] **Setup:** In the Validation Data Mapper, map a string field (`name`) to target. Set operator to **> greater than** (expects numeric).
- [ ] **Steps:**
  1. Observe a **type mismatch warning** (indicator or tooltip) on the mapping.
  2. Look for a **quick-fix suggestion** (e.g., "Wrap with $parseInt" or "Change operator to contains").
- [ ] **Expected:** Type mismatch is detected. Quick-fix suggestions are actionable.

### INT-04: Save and reopen — persistence

- [ ] **Setup:** In the Validation Data Mapper, create several mappings with mixed operators, array assertions, and DSL rules.
- [ ] **Steps:**
  1. Click **Save** in the Validation Data Mapper Modal.
  2. Close the Test Editor.
  3. Re-open the Test Editor → Validation tab → Validation Data Mapper.
- [ ] **Expected:** All mappings, operators, operator values, negation flags, array assertions, and DSL rules are preserved exactly.

### INT-04b: Operator persistence through Rules modal save cycle (regression fix)

> **Bug history:** Operators set to `equals` (or any operator) were silently reverted when saving after the Rules modal had been opened. Root cause: a chain of 5 bugs caused data loss during the DSL round-trip:
> 1. `dslToModel()` stripped `equals` to `undefined` (treating it as an implicit default)
> 2. `handleUpdateValidationFields()` blindly overwrote mapping operators with `undefined` from the DSL round-trip
> 3. `serialize()` omitted operator when `undefined` instead of defaulting to `equals`
> 4. `deserialize()` left operator unset for fields without an explicit operator
> 5. `TargetTreeNode` operator picker sent `undefined` instead of `'equals'` when selecting equals
>
> **Fixed in:** `validationDsl.ts`, `useDataMapperValidation.ts`, `validationAdapter.ts`, `TargetTreeNode.tsx`

- [ ] **Setup:** Open the Validation Data Mapper with sample JSON. Manually map 3+ leaf fields via drag-and-drop.
- [ ] **Steps — Basic persistence:**
  1. Verify all mapped fields show the `= equals` operator pill (green).
  2. Click **Save** on the Validation Data Mapper Modal.
  3. Close and re-open the Test Editor → Validation tab → Validation Data Mapper.
  4. Verify all fields still show `= equals`.
- [ ] **Steps — Persistence through Rules modal:**
  1. Open the Validation Data Mapper. Confirm fields show `= equals`.
  2. Open the **Rules** modal (toolbar → Rules). DSL should show `equals` for each field.
  3. **Without editing anything**, click **Save** on the Rules modal.
  4. Click **Save** on the Validation Data Mapper Modal.
  5. Close and re-open the Test Editor → Validation tab → Validation Data Mapper.
  6. Verify all fields still show `= equals` — **not** `∃ exists` or any other operator.
- [ ] **Steps — Mixed operators persist:**
  1. Map 3 fields. Set one to `contains`, one to `close_to` with a value, leave one as `equals`.
  2. Open the Rules modal → verify the DSL shows correct operators → click Save.
  3. Save the Validation Data Mapper Modal.
  4. Close and re-open.
  5. Verify: `contains`, `close_to` (with value), and `equals` are all preserved exactly.
- [ ] **Expected:** Operators are never silently changed during save/reopen cycles, including when the Rules modal is opened and saved.

### INT-05: Unordered array matching option

- [ ] **Setup:** In the Validation Data Mapper Modal footer, look for the **Unordered array matching** checkbox.
- [ ] **Steps:**
  1. Toggle the checkbox on.
  2. Save.
  3. Reopen and verify the checkbox state persists.
- [ ] **Expected:** The `unorderedArrays` option is saved and restored.

### INT-05b: Unmap selected source fields

- [ ] **Setup:** Open the Validation Data Mapper. Auto-map fields so several source nodes are mapped.
- [ ] **Steps:**
  1. In the **Source Panel**, use the checkboxes to select 2–3 mapped source nodes.
  2. A red **"Unmap (N)"** button appears in the Source Panel header (where N is the count of selected mapped items).
  3. Click the **Unmap** button.
  4. The selected mappings are removed. The source nodes revert to unmapped state.
  5. If some selected items are mapped and others are not, both buttons appear: blue **"Map (N)"** for unmapped, red **"Unmap (N)"** for mapped.
- [ ] **Expected:** Only the selected (checked) source fields are unmapped. Other mappings remain untouched. The checkbox styling uses a custom green checkmark on a subtle border (not the default browser blue box) for better dark-theme consistency.
- [ ] **Implementation:** `SourcePanel.tsx` computes `selectedMappedCount` from `selectedSourcePaths` and `mappings`. `DataMapper.tsx` provides `handleUnmapSelectedFields` which normalizes paths via `normalizeMapperPath` and calls `removeMappings`. CSS for `.dm-source-checkbox` uses a green (`--success`) background with a custom CSS `::after` checkmark.

### INT-06: Bottom Dock — Code/Table views include assertions and verify status

- [ ] **Setup:** Open the Validation Data Mapper. Create 6+ field mappings and 7+ array assertions (LENGTH, CONTAINS, EACH, SUBSET). Click **Verify All**.
- [ ] **Steps:**
  1. Click **Code** in the bottom dock toolbar. The dock shows the header: **"6 mappings · 7 assertions"**.
  2. Scroll down in the Code view — below the field mappings, a separator line **"— Assertions —"** appears followed by each assertion (e.g., `offers  LENGTH  3`, `offers[*]  EACH  rank >= 0`). Assertion lines are styled in accent color.
  3. Switch to **Table** mode. Click **List**. The table shows:
     - Field mapping rows (1–6) with columns: #, Target, Source/Expression, Before, After, Trace, Status.
     - A section header: **"Assertions (7)"** followed by assertion rows with Path, Type (e.g., LENGTH, EACH), and Rule summary.
     - The toolbar shows: **"6 rows · 7 assertions"**.
  4. Check the **Status** column: after **Verify All**, it shows **"✓ pass"** (green) or **"✗ fail"** (red). Before verification, it shows **"— same"** or **"△ changed"**.
  5. Switch to **Table > Table** (pivot view). Below the pivot grid, a compact 3-column assertion summary table appears: **Path**, **Type**, **Rule**.
  6. Click **Inspect** on any mapping row. The **Trace panel** opens below the table and auto-scrolls into view, showing Source Input → Path Resolution → Target Output.
- [ ] **Expected:** All three dock views (Code, List, Pivot) include assertions. The Status column reflects verification results (pass/fail) when available. Trace panel appears on Inspect click.
- [ ] **Implementation:** `CodeView.tsx` accepts `assertions`, `verifyStatus`, and `failedMappingIds` props. `BottomUtilityDock.tsx` passes them through from `DataMapper.tsx`. Shared utilities `formatAssertionLine`, `getAssertionJsonPath`, `formatAssertionSummary` in `targetTreeHelpers.ts` — no duplicated code.

### INT-07: Schema drift detection after re-fetch

- [ ] **Setup:** Have a saved Validation Data Mapper with existing mappings.
- [ ] **Steps:**
  1. Re-open the Validation Data Mapper.
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

### Type Check Operator (teal pill — dropdown selector)

> **UI:** Selecting `is_type` opens a **dropdown** with options: `string`, `number`, `boolean`, `object`, `array`, `null`. No typing needed — select and commit instantly.

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `is_type` | `name` | `string` | `"OnStar..."` | ✅ | `name  is_type  "string"` |
| `is_type` | `count` | `number` | `42` | ✅ | `count  is_type  "number"` |
| `is_type` | `isActive` | `boolean` | `true` | ✅ | `isActive  is_type  "boolean"` |
| `is_type` | `offers` | `array` | `[...]` | ✅ | `offers  is_type  "array"` |
| `is_type` | `config` | `object` | `{...}` | ✅ | `config  is_type  "object"` |
| `is_type` | `deletedAt` | `null` | `null` | ✅ | `deletedAt  is_type  "null"` |

### Set Operators (blue pills)

> **UI:** Value input accepts JSON array format (`["a","b"]`) or comma-separated quoted strings (`"a","b"`). Both formats are supported — quotes around individual items are stripped automatically during evaluation.

| Operator | Field | Operator Value | Sample Data | Pass? | DSL Syntax |
|----------|-------|----------------|-------------|-------|------------|
| `in` | `status` | `["active","pending"]` | `"active"` | ✅ | `status  in  ["active","pending"]` |
| `in` | `status` | `"active","pending"` | `"active"` | ✅ | `status  in  "active","pending"` |
| `in` | `status` | `["deleted","banned"]` | `"active"` | ❌ | `status  in  ["deleted","banned"]` |
| `not_in` | `status` | `["deleted","banned"]` | `"active"` | ✅ | `status  not_in  ["deleted","banned"]` |
| `not_in` | `status` | `["active","pending"]` | `"active"` | ❌ | `status  not_in  ["active","pending"]` |

### Range Operators (amber pills — dual-input boxes)

> **UI:** `between` and `close_to` show **two separate number input boxes** separated by a dash (`–`).
> - `between`: boxes labeled **min** / **max**. Press Enter in first box to move to second.
> - `close_to`: boxes labeled **value** / **tolerance**. Press Enter in first box to move to second.

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

## Version Panels — Preview & Compare Modals

### VP-01: Response Version Preview Modal

- [x] **Setup:** Open a test scenario with at least one saved Response Version.
- [x] **Steps:**
  1. In the **Response Versions** panel, click the **Preview** button on any version row.
  2. A pop-up modal opens showing the full JSON response body.
  3. Verify: **transparent background** (no dark overlay or blur).
  4. Verify: the header shows version label, timestamp, and tags (e.g., "Selective · Include") — tags are properly capitalized.
  5. Verify: **search bar** in the header with placeholder "Search… (Cmd+F)". Type a keyword (e.g., `offerName`). Match counter shows `N/M`. Use ▲/▼ buttons or Enter/Shift+Enter to navigate matches. Active match is highlighted with orange outline.
  6. Verify: JSON is **pretty-printed** with syntax highlighting — blue keys, green strings, orange numbers, purple booleans, red nulls.
  7. Verify: **line numbers** in a sticky gutter on the left.
  8. Verify: footer at the bottom shows line count on the left and **Copy** + **Close** buttons on the bottom-right.
  9. Click **Copy** → confirm clipboard contains the full JSON. Button briefly shows "✓ Copied".
  10. Press **Escape** or click **Close** to dismiss. Click outside the modal also closes it.
- [x] **Expected:** Professional code-viewer modal with syntax highlighting, search with navigation, and all action buttons in the footer. Only one scrollbar for the entire code area.

### VP-02: Rules Version Preview Modal

- [x] **Setup:** Open a test scenario with at least one saved Rules Version.
- [x] **Steps:**
  1. In the **Rules Versions** panel, click **Preview** on any version row.
  2. A pop-up modal opens showing the rules in DSL format.
  3. Verify: same modal design as VP-01 — transparent background, search bar, line numbers, footer buttons.
  4. Verify: DSL syntax highlighting — cyan paths, purple operators, gray comments.
  5. Verify: tags show capitalized values (e.g., "Selective · Include · 6 rules · Unordered").
  6. Search for an operator name (e.g., `equals`) and verify matches are highlighted.
  7. Copy and close work identically to VP-01.
- [x] **Expected:** Same professional modal with DSL-appropriate syntax highlighting.

### VP-03: Compare Versions Modal — Search & Layout

- [x] **Setup:** Open a test scenario with at least 2 saved Response Versions or Rules Versions.
- [x] **Steps:**
  1. Click the **Compare** button to open the Compare Versions modal.
  2. Verify: **transparent background** (no dark overlay or blur).
  3. Verify: the header contains the title, controls (e.g., "Unordered Arrays" checkbox for Response), and a **search bar** with counter and ▲/▼ navigation.
  4. Type a search term. Matches in the diff viewer are highlighted with orange background. Active match has an orange outline and auto-scrolls into view.
  5. Verify: **Close** button is in the footer at the bottom-right (not in the header).
  6. Verify: tags in the info bar are properly capitalized (e.g., "Selective · Include · 12 rule(s)").
  7. Press **Escape** or click **Close** to dismiss.
- [x] **Expected:** Compare modal follows the same conventions — transparent background, search with navigation, footer-positioned Close button.

### Modal Design Conventions (memo)

All pop-up modals in the app must follow these rules:

1. **Background overlay**: Always `background: transparent`. Never use opaque/semi-transparent backdrops or `backdrop-filter: blur()`.
2. **Action buttons at bottom-right**: Copy, Close, Cancel, Save — always in a footer bar at the bottom-right. Never in the header.
3. **Search bar**: If the modal displays content (code, JSON, logs, diff), include a search bar in the header with match counter (`N/M`), ▲/▼ navigation, Cmd+F shortcut, Enter/Shift+Enter for next/prev.
4. **Pretty-print JSON**: Always use `JSON.stringify(parsed, null, 2)`. Never show minified JSON in modals.

---

## Summary Checklist

| Phase | Tests | Done | Description |
|-------|-------|------|-------------|
| P0 | 4 | 4/4 ✅ | Adapter capability gating |
| P1 | 12 | 12/12 ✅ | 24 field operators, picker, colors |
| P2 | 3 | 3/3 ✅ | Type checks, existence assertions |
| P3 | 7 | 7/7 ✅ | Array length, contains, each, subset, inline layout |
| P4 | 8 | 8/8 ✅ | DSL editor, syntax, autocomplete (auto-suggest), sync, line decorations |
| P5 | 7 | 7/7 ✅ | Verify All, Fetch & Verify, auto-verify, filters |
| P6 | 1 | 1/1 ✅ | JSON Schema validation (Test Editor) |
| P7 | 4 | 4/4 ✅ | Expression engine, variable rename (inline + modal), viewport fit + resize, 125 functions |
| P8 | 4 | 4/4 ✅ | bodySize, datePrecise, between, close_to |
| P9.1 | 5 | 5/5 ✅ | Universal negation |
| P9.2 | 4 | — | Lambda syntax, HOFs |
| P9.3 | 5 | — | ASSERT keyword, custom predicates |
| P9.4 | 15 | — | 3-mode modal, DSL reference (accordion), edge toggle, verify stats |
| VP | 3 | 3/3 ✅ | Version preview modals, compare modal search & layout |
| Integration | 9 | — | Cross-phase workflows, unmap selected, bottom dock assertions, operator persistence regression |
| **Total** | **91** | **55/91** | P0–P8 verified; VP verified; P9+ pending |

### Automated Test Coverage

| Test File | Tests | Scope |
|-----------|-------|-------|
| `fieldOperatorEvaluation.test.ts` | 33 | Original unit tests |
| `fieldOperatorEvaluation.comprehensive.test.ts` | 167 | All 24 operators: pass, fail, edge cases, type coercion, boundaries |
| `validationAdapter.integration.test.ts` | 84 | Full pipeline: adapter serialize → operator evaluate for all operators, negate, expressions |
| `validationAdapter.test.ts` | 71 | Adapter unit tests (includes explicit operator persistence) |
| `useValidationVerify.test.ts` | 37 | Verify hook tests |
| `ValidationRulesModal.test.tsx` | 44 | Modal rendering, mode switching, Save/Cancel, edge toggle, reference panel toggle |
| `ValidationCodeEditor.test.tsx` | — | Monaco editor mount, theme, decorations, selection guard |
| `DslReferencePanel.test.tsx` | — | Accordion behavior, merged sections, search, insert/copy |
| `CodeView.test.tsx` | — | Assertion rendering in code/table views, status column, empty state |
| `targetTreeHelpers.test.ts` | — | `getAssertionJsonPath`, `formatAssertionLine` utilities |
| `InlineAssertionRow.test.tsx` | — | Inline editing, each fallback, verify badges |
| `TestEditorValidationTab.test.tsx` | — | JSON Schema editor, Pretty/Minify buttons |
| **Total automated** | **375+** | |

### E2E Test Coverage (Playwright)

| Test File | Tests | Scope |
|-----------|-------|-------|
| `e2e/validation-rules-editor.spec.ts` | — | Typing, autocomplete, multi-line selection |
| `e2e/validation-rules-sync.spec.ts` | 5 | Bidirectional visual ↔ DSL sync |
| `e2e/validation-rules-modal-zindex.spec.ts` | — | Portal stacking, z-index |
| `e2e/validation-rules-visual-mapper-clear.spec.ts` | — | Clear/reset flows |
| `e2e/validation-rules-edge-toggle.spec.ts` | 2 | Edge toggle visibility/toggle, line decorations after Verify All |
