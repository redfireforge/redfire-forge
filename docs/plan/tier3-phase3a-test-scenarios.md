# Tier 3 Phase 3A — Test Scenarios

> Full Validation Engine in Rust  
> Created: 2026-05-18  
> Sub-Group A completed: 2026-05-18 — 107 tests (40 validation_types + 67 json_path), 9 rounds re-evaluation, 0 bugs remaining  
> Sub-Group B completed: 2026-05-18 — 110 tests (28 deep_compare + 20 subset_match + 38 http_helpers + 24 date_helpers), 9 rounds re-evaluation, 6 bugs found & fixed  
> Sub-Group C completed: 2026-05-18 — 159 tests (98 field_operator + 61 assertion_evaluator), 8 plan corrections found (is_false/0 bug, stringify semantics, exists/not_exists Option, compare+format_op helpers, regex 200-char truncation, jsonSchema assertion index, bodySize fallback+rounding, datePrecise string reference)  
> Sub-Group D completed: 2026-05-18 — 93 tests (51 json_validator + 33 validation_result + 9 cross_module), 10 rounds re-evaluation, 3 bugs found & fixed (try_remap_paths primitive guard, serde_json preserve_order for Map iteration parity, bodySize null body edge case)  
> Section 12 (JS Bridge) completed: 2026-05-18 — prepareRustScenario serializes validation+assertions, mapRustResult passthrough with custom assertion merge, 26 new TS tests
> Section 13 (Performance Benchmark) completed: 2026-05-19 — 7 Rust benchmarks (A-G) in cross_module_test.rs, 7 JS benchmarks in validationResult.perf.test.ts, 1 bridge benchmark in rustBridge.perf.test.ts. Rust wins on heavy assertions (E, 5.8×) and deep compare (D, 1.2×); JS wins on simple/moderate benchmarks via V8 JIT optimization. Bridge overhead: 18.57ms/10K (1.86 µs/iter).
> Section 13 review (round 1): 2026-05-19 — 4 issues found & fixed: (1) missing sanity assertion in Benchmark B (Rust & JS), (2) bridge overhead criterion mislabeled as PASS (actual: 32%), (3) analysis missing per-benchmark explanation for G's 27× gap (chrono date parsing), (4) Benchmark B makeInput allocation fairness note added
> Full plan audit (round 2): 2026-05-19 — 9 documentation corrections: (1) validation_types count 39→40, (2) date_helpers count 23→24, (3) executor count 63→66 (3 tokio::test), (4) removed phantom `has_length` FieldOperator, (5) added missing `between` to 1.1, (6) expanded Section 1.2 from 10 JS-named variants to 21 items covering all 16 Rust assertion types + edge cases, (7) added Section 1.5 struct serde tests, (8) DatePrecision added millisecond variant, (9) added 3 missing enums (SizeUnit, AssertionOperator, Timezone) + missing date_helpers tests (array, negative epoch, truncate_millisecond)
> Documentation review (round 3): 2026-05-19 — 4 corrections: (1) Benchmark E containsSubset "3-field subset"→"2-field subset" (actual: `active` + `role`), (2) body field count "10-field"→"11-field" across 3 references (A, D, JS-A), (3) Section 13 header test count 42→49 (33 validation_result + 9 cross-module + 7 perf), (4) Benchmark G analysis corrected "16 parse attempts" to accurate chrono explanation (3 parse calls, first-attempt match)
> Documentation review (round 4): 2026-05-19 — exhaustive cross-check of all 13 sections against Rust/JS source. Verified: all 542 Rust tests pass, all test counts match, all fixture data (body, assertions, expectedFields, headers) identical between Rust code, JS code, and plan tables. No issues found.
> Documentation review (round 5): 2026-05-19 — reverse audit: enumerated every `fn` in all 12 test files and matched against plan checkboxes. Found **~55 undocumented test functions** across 7 modules: (1) json_path: added 33 checkboxes for Sections 2.7-2.11 (unclosed brackets, wildcard edge cases, `length` property, `get_by_path_as_string`, `strip_root_prefix`), (2) deep_compare: added 7 checkboxes (empty collections, root type mismatch, null-vs-missing, mixed-type arrays), (3) subset_match: fixed incorrect "null expected always matches" claim (actual behavior: null expected requires null actual), added 8 checkboxes (object-vs-array search mode, nested paths, bare keys), (4) http_helpers: added 5 checkboxes (missing header × 3, None expected × 2), (5) field_operator: added 14 checkboxes in new Sections 7.11-7.12 (undefined actual across 10 operators, NaN/Infinity, close_to edge cases), (6) assertion_evaluator: added 7 checkboxes (numeric JS coercion for bool/null/array, null-as-typeof-object, multibyte regex truncation, datePrecise label, mixed assertions), (7) json_validator + validation_result: added 17 checkboxes (exists/not_exists operators, boolean/array equality, empty body, negated status, integration tests).
> Total Rust tests: 542 (66 executor + 476 validation) | Total TS bridge tests: 90 | Perf benchmarks: 15 (7 Rust + 7 JS + 1 bridge)

---

## Sub-Group A: Types + JSONPath

### 1. Validation Types — Serde Serialization (`validation_types_test.rs` — 40 tests)

#### 1.1 FieldOperator round-trip (24 variants)
- [x] `equals` → `"equals"` and back
- [x] `not_equals` → `"not_equals"` and back
- [x] `greater_than` → `"greater_than"` and back
- [x] `greater_than_or_equal` → `"greater_than_or_equal"` and back
- [x] `less_than` → `"less_than"` and back
- [x] `less_than_or_equal` → `"less_than_or_equal"` and back
- [x] `contains` → `"contains"` and back
- [x] `not_contains` → `"not_contains"` and back
- [x] `starts_with` → `"starts_with"` and back
- [x] `ends_with` → `"ends_with"` and back
- [x] `regex` → `"regex"` and back
- [x] `is_null` → `"is_null"` and back
- [x] `is_not_null` → `"is_not_null"` and back
- [x] `is_true` → `"is_true"` and back
- [x] `is_false` → `"is_false"` and back
- [x] `exists` → `"exists"` and back
- [x] `not_exists` → `"not_exists"` and back
- [x] `is_type` → `"is_type"` and back
- [x] `is_empty` → `"is_empty"` and back
- [x] `is_not_empty` → `"is_not_empty"` and back
- [x] `in` → `"in"` and back (Rust enum `In` with `#[serde(rename_all = "snake_case")]`)
- [x] `not_in` → `"not_in"` and back (Rust enum `NotIn`)
- [x] `between` → `"between"` and back
- [x] `close_to` → `"close_to"` and back

#### 1.2 Assertion variant round-trip (all 16 Rust assertion types + edge cases)
- [x] `Status` with expected/negate
- [x] `ResponseTime` with maxMs/negate
- [x] `Header` with name/operator/value/negate
- [x] `Regex` with jsonPath/pattern/negate
- [x] `ArrayLength` with jsonPath/operator/value/negate
- [x] `Numeric` with jsonPath/operator/value/negate
- [x] `Date` (today/utc) with jsonPath/operator/reference/negate
- [x] `Date` (fixed) with jsonPath/operator/reference/negate
- [x] `TypeCheck` with jsonPath/expectedType/negate
- [x] `Existence` with jsonPath/expectExists/negate
- [x] `ArrayContains` with jsonPath/value/mode/negate
- [x] `Each` with jsonPath/fieldPath/operator/value/negate
- [x] `ContainsSubset` with jsonPath/expected/negate
- [x] `JsonSchema` with schema/negate
- [x] `BodySize` with operator/value/unit/negate
- [x] `DatePrecise` with jsonPath/operator/reference/precision/negate
- [x] `Custom` with expression/description/negate
- [x] Deserialize all 16 assertion types from a single JS-style JSON array
- [x] Edge case: `Header` with null value field
- [x] Edge case: `Each` without value field (operator-only like `exists`)
- [x] Edge case: `Custom` without description field

#### 1.3 Assertion `is_negated()` helper
- [x] Assertions with negate=true return true
- [x] Assertions without negate field return false
- [x] Assertions with negate=false return false

#### 1.4 Supporting enums
- [x] `ValidationMode` variants: none, full, selective
- [x] `ComparisonOperator` variants: =, !=, >, >=, <, <=
- [x] `JsonTypeName` variants: string, number, boolean, object, array, null
- [x] `DateReference` variants: today (with timezone), fixed (with date string)
- [x] `DatePrecision` variants: day, hour, minute, second, millisecond
- [x] `ArrayContainsMode` variants: any, all, only, none
- [x] `SizeUnit` variants: bytes, kb, mb
- [x] `AssertionOperator` variants: equals, contains, regex, exists
- [x] `Timezone` variants: utc, local

#### 1.5 Struct serde round-trips
- [x] `ExpectedField` minimal (jsonPath + expectedValue only)
- [x] `ExpectedField` full (all fields: jsonPath, expectedValue, operator, operatorValue, negate, expression)
- [x] `FailureDetail` serde round-trip (path, expected, actual)
- [x] `ValidationConfig` with assertions array round-trip
- [x] `ValidationConfig` minimal JSON deserializes (mode only, no optional fields)

---

### 2. JSONPath Engine (`json_path_test.rs` — 67 tests)

#### 2.1 Simple property access
- [x] `foo` → returns value of top-level key "foo"
- [x] `nested.inner` → returns nested object value
- [x] `a.b.c.d` → 4-level deep access works
- [x] Missing key returns `Value::Null`

#### 2.2 Bracket notation
- [x] `foo["bar"]` → same as `foo.bar`
- [x] `["foo"]` → top-level bracket access
- [x] `a["b"]["c"]` → chained brackets

#### 2.3 Array indexing
- [x] `arr[0]` → first element
- [x] `arr[2]` → third element
- [x] `arr[99]` → out-of-bounds returns Null
- [x] Negative index not supported (returns Null)
- [x] Leading zero `arr[01]` → parses as index 1

#### 2.4 Wildcard `[*]` expansion
- [x] `arr[*]` → returns array of all elements
- [x] `arr[*].name` → maps over array, plucks property from each
- [x] `arr[*].nested.value` → deep pluck through wildcard
- [x] `arr[*][0]` → index into each wildcard result
- [x] Empty array with wildcard → returns empty array

#### 2.5 Root `$` and `$.` prefix
- [x] `$.foo` → same as `foo`
- [x] `$` alone → returns root object
- [x] `$.arr[0]` → works with array index
- [x] `$.arr[*].name` → works with wildcard

#### 2.6 Edge cases
- [x] Empty path `""` → returns root object
- [x] Whitespace-only path → returns Null (not treated as empty)
- [x] Path on primitive value → returns Null
- [x] Path on null → returns Null
- [x] Numeric key on object → string lookup `"0"` in object keys
- [x] Numeric key on object via bracket `["0"]` → same as dot notation
- [x] Non-numeric key on array → returns Null
- [x] Multi-byte UTF-8 keys → correct lookup
- [x] Keys with special characters (dots, brackets in key names)
- [x] Boolean and number leaf values → returned correctly
- [x] Negative index on array → returns Null (not supported)
- [x] `path_exists()` returns true for existing path, false for missing
- [x] `path_exists()` returns true for path to `null` value (null exists)
- [x] `path_exists()` for deep missing path → false
- [x] `path_exists()` for array index in/out of bounds
- [x] `path_exists()` for wildcard on array/non-array

#### 2.7 Unclosed/malformed bracket handling
- [x] Unclosed bracket `foo[` → returns partial result (stops tokenization gracefully)
- [x] Empty bracket `foo[]` → returns Null
- [x] Quoted bracket `foo["bar"]` → resolves to `foo.bar`
- [x] Unquoted bracket `foo[bar]` → resolves key `bar`
- [x] Bracket with spaces `foo[ "bar" ]` → trims and resolves

#### 2.8 Wildcard edge cases
- [x] `[*]` on non-array (object) → returns Null
- [x] `[*]` on string → returns Null
- [x] `arr[*]` terminal → returns full array
- [x] Double nested wildcard `arr[*][*]` → nested expansion
- [x] Deep wildcard chain `arr[*].nested[*].value`

#### 2.9 `length` property
- [x] `arr.length` on array → returns array length as number
- [x] `nested.arr.length` on nested array
- [x] `obj.length` on object with `"length"` key → returns that key's value
- [x] `obj.nested.length` on non-array object without `"length"` key → returns Null
- [x] `str.length` on string → returns Null (not implemented for strings)

#### 2.10 `get_by_path_as_string()` helper
- [x] Primitive string value → returns raw string (no quotes)
- [x] Null value → returns `""` (empty string)
- [x] Missing path → returns `""` (empty string)
- [x] Object value → returns JSON-serialized string
- [x] Array value → returns JSON-serialized string
- [x] Null input root → returns `""` (empty string)
- [x] Intermediate null in path → returns `""` (empty string)
- [x] Deeply nested value → returns correct string
- [x] Array element by index → returns correct string

#### 2.11 Internal `strip_root_prefix()` helper
- [x] No prefix → path returned as-is
- [x] `$.` prefix → stripped
- [x] Bare `$` → returns empty string

---

## Sub-Group B: Leaf Helpers

### 3. Deep Compare (`deep_compare_test.rs` — 28 tests)

#### 3.1 Identical values
- [x] Identical objects → 0 failures
- [x] Identical arrays → 0 failures
- [x] Identical nested structures → 0 failures
- [x] Identical primitives (string, number, bool, null) → 0 failures
- [x] Empty objects match → 0 failures
- [x] Empty arrays match → 0 failures

#### 3.2 Primitive mismatches
- [x] Number mismatch → 1 failure with path, expected, actual
- [x] String mismatch → 1 failure with quoted expected/actual
- [x] Boolean mismatch → 1 failure
- [x] Root type mismatch (e.g., string vs number at root) → 1 failure
- [x] Null vs non-null → 1 failure
- [x] Non-null vs null → 1 failure

#### 3.3 Object comparison
- [x] Missing key in actual → failure with "missing" actual
- [x] Extra key in actual → failure with "unexpected" expected
- [x] Multiple key mismatches → multiple failures
- [x] Nested object mismatches → correct path (`a.b.c`)

#### 3.4 Array comparison
- [x] Different length → failure at shorter index
- [x] Same length, element mismatch → failure with `[N]` path
- [x] Nested arrays → correct path (`[0][1]`)
- [x] Deeply nested array in object → correct path reporting
- [x] Array of objects with mixed types → per-element comparison

#### 3.5 JS `typeof` parity (critical for correctness)
- [x] Array expected, object actual → failure message says `expected: 'array', actual: 'object'`
- [x] Object expected, array actual → iterates object keys against array indices as string keys
- [x] Object with `"length"` key vs array → compares against `array.length`
- [x] Nested object vs nested array → multi-failure with per-key messages

#### 3.6 Stringify parity
- [x] Integer stringifies without quotes: `1` not `"1"`
- [x] Float stringifies correctly: `1.5`
- [x] Null stringifies as `null`
- [x] Nested null in object → correct expected/actual strings
- [x] Nested null vs missing key → different failure messages (`"null"` vs `"missing"`)

#### 3.7 serde_json number equality
- [x] `json!(1)` vs `json!(1.0)` — documents accepted divergence from JS

---

### 4. Subset Match (`subset_match_test.rs` — 20 tests)

#### 4.1 Object subset matching
- [x] Subset of keys matches → pass
- [x] Extra keys in actual → still passes (subset semantics)
- [x] Missing key in actual → fail with path
- [x] Value mismatch on matching key → fail

#### 4.2 Array subset matching (existential/unordered)
- [x] Expected array is subset of actual → pass (any order)
- [x] Expected element not found in actual → fail
- [x] Empty expected array → passes against any array
- [x] Single element match → pass

#### 4.3 Object expected, array actual (search mode)
- [x] Object expected, array actual → searches each array element for matching subset
- [x] Object expected, array actual, element matches → pass
- [x] Object expected, array actual, no element matches → fail with type names
- [x] Array index path included in failure when expected element missing

#### 4.3b Nested subset matching
- [x] Nested object within array → recursive subset check
- [x] Deeply nested structure → correct path reporting
- [x] Nested path with missing key → fail with correct path
- [x] Nested mismatch → propagates with correct path string
- [x] Bare key path at root level → works without `$` prefix

#### 4.4 Null handling
- [x] Null expected + null actual → matches (both null)
- [x] Null expected + non-null actual → fail (expects `"null"`, gets stringified actual)
- [x] Object expected + null actual → fail (key lookup on null fails)

#### 4.5 Type mismatches
- [x] Expected array, actual object → fail with type names
- [x] Expected object, actual primitive → fail
- [x] Empty expected object against primitive → fail (not vacuous match)

#### 4.6 Primitive comparison
- [x] Matching primitives → pass
- [x] Mismatching primitives → fail with stringified values

---

### 5. HTTP Helpers (`http_helpers_test.rs` — 38 tests)

#### 5.1 `matches_status_pattern` — exact match
- [x] `200` matches status 200
- [x] `200` does not match status 201
- [x] `404` matches status 404

#### 5.2 `matches_status_pattern` — range
- [x] `200-299` matches 200, 250, 299
- [x] `200-299` does not match 300
- [x] `400-499` matches 404

#### 5.3 `matches_status_pattern` — class (`Nxx`)
- [x] `2xx` matches 200, 201, 299
- [x] `2xx` does not match 300
- [x] `4xx` matches 400, 404, 499
- [x] `5xx` matches 500, 503

#### 5.4 `matches_status_pattern` — comma-separated
- [x] `200,201,204` matches each
- [x] `200,201,204` does not match 202
- [x] `2xx,304` matches both patterns

#### 5.5 `matches_status_pattern` — edge cases
- [x] Empty pattern → no match (not vacuous true)
- [x] Leading hyphen `"-200"` → not treated as range 0-200
- [x] Trailing hyphen `"200-"` → not treated as valid range
- [x] `u16` overflow pattern `"99999"` → no false positive match
- [x] Large range boundary `"0-99999"` → safe u32 handling
- [x] Whitespace trimming in comma-separated values

#### 5.6 `get_json_type_name`
- [x] String → `JsonTypeName::String`
- [x] Number → `JsonTypeName::Number`
- [x] Boolean → `JsonTypeName::Boolean`
- [x] Object → `JsonTypeName::Object`
- [x] Array → `JsonTypeName::Array`
- [x] Null → `JsonTypeName::Null`

#### 5.7 `find_header` (case-insensitive)
- [x] Exact case match → returns value
- [x] Different case → returns value (case-insensitive)
- [x] Missing header → returns None

#### 5.8 `evaluate_header_op`
- [x] `"exists"` with present header → pass
- [x] `"exists"` with missing header → fail
- [x] `"equals"` exact match → pass
- [x] `"equals"` mismatch → fail
- [x] `"contains"` substring present → pass
- [x] `"contains"` substring absent → fail
- [x] `"regex"` valid pattern matches → pass
- [x] `"regex"` valid pattern does not match → fail
- [x] `"regex"` invalid pattern → fail with error message
- [x] `"equals"` with missing header → fail (header not found)
- [x] `"contains"` with missing header → fail (header not found)
- [x] `"regex"` with missing header → fail (header not found)
- [x] `"equals"` with None expected value → pass (both sides None)
- [x] `"contains"` with None expected value → pass (`"abc".contains("") == true`)
- [x] Unknown operator → fail with "unknown operator" message

---

### 6. Date Helpers (`date_helpers_test.rs` — 24 tests)

#### 6.1 `resolve_date`
- [x] Fixed date reference (full ISO) → returns the date string as-is
- [x] Fixed date reference (date-only) → returns as-is
- [x] Fixed date reference (short string) → returns as-is
- [x] Today UTC → returns current UTC date as `YYYY-MM-DD`
- [x] Today Local → returns current local date as `YYYY-MM-DD`

#### 6.2 `to_day_string`
- [x] ISO 8601 string `"2024-01-15T10:30:00Z"` → `"2024-01-15"`
- [x] Date-only string `"2024-01-15"` → `"2024-01-15"`
- [x] Non-date string → None
- [x] Empty string → None
- [x] Epoch milliseconds (integer) → correct UTC date
- [x] Epoch zero (0) → `"1970-01-01"`
- [x] Float epoch milliseconds (e.g., `1705312200000.5`) → truncates to integer, returns date
- [x] Boolean value → None
- [x] Null value → None
- [x] Object value → None
- [x] Array value → None
- [x] Negative epoch millis → correct date (pre-1970)

#### 6.3 `truncate_to_unit`
- [x] Truncate to milliseconds → identity (returns same value)
- [x] Truncate to seconds → zeroes sub-second portion
- [x] Truncate to minutes → zeroes seconds + sub-seconds
- [x] Truncate to hours → zeroes minutes + seconds
- [x] Truncate to days → zeroes hours + minutes + seconds
- [x] Zero epoch → returns 0 for all precisions
- [x] Negative epoch millis → floors like JS `Math.floor` (uses `div_euclid`)

---

## Sub-Group C: Core Evaluators (Completed)

### 7. Field Operator Evaluator (`field_operator.rs` — 98 tests)

#### 7.1 Helper functions
- [x] `to_number(Value::Number(42))` → Some(42.0)
- [x] `to_number(Value::String("3.14"))` → Some(3.14)
- [x] `to_number(Value::String(""))` → None (empty string)
- [x] `to_number(Value::String("  "))` → None (whitespace only)
- [x] `to_number(Value::String("abc"))` → None (non-numeric)
- [x] `to_number(Value::Bool(true))` → None
- [x] `to_number(Value::Null)` → None
- [x] `stringify(Value::String("hello"))` → `"hello"` (raw, no quotes)
- [x] `stringify(Value::Number(42))` → `"42"`
- [x] `stringify(Value::Null)` → `"null"`
- [x] `stringify(Value::Bool(true))` → `"true"`
- [x] `stringify(Value::Array)` → JSON serialized
- [x] `strip_quotes("\"hello\"")` → `"hello"`
- [x] `strip_quotes("'hello'")` → `"hello"`
- [x] `strip_quotes("hello")` → `"hello"` (no change)
- [x] `parse_list_items("[1,2,3]")` → vec of Value::Number
- [x] `parse_list_items("a, b, c")` → vec of Value::String after trim+strip

#### 7.2 Equality operators
- [x] `equals` — string actual matches string expected
- [x] `equals` — number actual matches number expected (JSON stringify comparison)
- [x] `equals` — JSON object actual matches JSON string expected (parse then stringify)
- [x] `equals` — mismatch returns pass: false with `"equals {raw}"` message
- [x] `equals` — uses `operatorValue` when present, falls back to `expectedValue`
- [x] `not_equals` — inverse of equals
- [x] `not_equals` — matching values → pass: false

#### 7.3 Comparison operators
- [x] `greater_than` — 5 > 3 → pass
- [x] `greater_than` — 3 > 5 → fail
- [x] `greater_than` — equal values → fail
- [x] `greater_than` — non-numeric actual → fail gracefully (pass: false)
- [x] `greater_than` — non-numeric expected → fail gracefully
- [x] `greater_than` — string numeric `"10"` > `"5"` → pass (parsed as numbers)
- [x] `greater_than_or_equal` — equal values → pass
- [x] `less_than` — standard comparison
- [x] `less_than_or_equal` — standard comparison

#### 7.4 String operators
- [x] `contains` — string actual contains target → pass
- [x] `contains` — non-string actual gets JSON stringified before search
- [x] `contains` — target not found → fail
- [x] `not_contains` — inverse of contains
- [x] `starts_with` — actual starts with target → pass
- [x] `starts_with` — non-string actual gets stringified
- [x] `ends_with` — actual ends with target → pass
- [x] `regex` — valid pattern matches → pass
- [x] `regex` — valid pattern does not match → fail
- [x] `regex` — empty pattern → `pass: false, actual: "empty pattern"`
- [x] `regex` — invalid pattern → `pass: false, actual: "invalid regex pattern"`
- [x] `regex` — non-string actual gets stringified before test

#### 7.5 Boolean/null operators
- [x] `is_true` — `Value::Bool(true)` → pass
- [x] `is_true` — `Value::String("true")` → pass
- [x] `is_true` — `Value::String("True")` → fail (case-sensitive)
- [x] `is_true` — `Value::Number(1)` → fail (only bool true or string "true")
- [x] `is_false` — `Value::Bool(false)` → pass
- [x] `is_false` — `Value::String("false")` → pass
- [x] `is_false` — `Value::String("False")` → fail (case-sensitive)
- [x] `is_false` — `Value::Number(0)` → **fail** (JS does NOT check === 0)
- [x] `is_null` — `Value::Null` → pass
- [x] `is_null` — any non-null value → fail
- [x] `is_not_null` — non-null value → pass
- [x] `is_not_null` — `Value::Null` → fail
- [x] `is_not_null` — `None` (undefined/not found) → fail

#### 7.6 Existence operators (requires Option<&Value>)
- [x] `exists` — `Some(Value::Null)` → pass (null at path counts as exists)
- [x] `exists` — `Some(Value::Number(42))` → pass
- [x] `exists` — `None` → fail (path not found)
- [x] `not_exists` — `None` → pass
- [x] `not_exists` — `Some(Value::Null)` → fail

#### 7.7 Collection operators
- [x] `is_empty` — `""` → pass
- [x] `is_empty` — `Value::Null` → pass
- [x] `is_empty` — `None` (undefined) → pass
- [x] `is_empty` — `[]` → pass
- [x] `is_empty` — `{}` → pass
- [x] `is_empty` — `"hello"` → fail
- [x] `is_empty` — `[1, 2]` → fail
- [x] `is_not_empty` — inverse of all is_empty cases

#### 7.8 Type check operator
- [x] `is_type` — `"string"` matches Value::String → pass
- [x] `is_type` — `"number"` matches Value::Number → pass
- [x] `is_type` — `"boolean"` matches Value::Bool → pass
- [x] `is_type` — `"array"` matches Value::Array → pass (NOT "object")
- [x] `is_type` — `"object"` matches Value::Object → pass
- [x] `is_type` — `"null"` matches Value::Null → pass
- [x] `is_type` — case insensitive expected (e.g., `"STRING"` matches string)
- [x] `is_type` — mismatch → `pass: false, actual: "type: {actualType}"`

#### 7.9 Set membership operators
- [x] `in` — value in JSON array `[1, 2, 3]` → pass
- [x] `in` — value NOT in set → fail
- [x] `in` — comma-separated string `"a, b, c"` parsed with strip quotes
- [x] `in` — membership uses JSON.stringify equality (string vs number distinction)
- [x] `not_in` — value not in set → pass
- [x] `not_in` — value in set → fail

#### 7.10 Range/proximity operators
- [x] `between` — `5` between `1,10` → pass (inclusive)
- [x] `between` — `1` between `1,10` → pass (inclusive, boundary)
- [x] `between` — `10` between `1,10` → pass (inclusive, boundary)
- [x] `between` — `0` between `1,10` → fail
- [x] `between` — whitespace-separated `"1 10"` → parsed correctly
- [x] `between` — non-numeric → fail
- [x] `close_to` — `5.005` close to `"5,0.01"` → pass
- [x] `close_to` — `5.02` close to `"5,0.01"` → fail (outside tolerance)
- [x] `close_to` — default tolerance 0.01 when omitted: `"5"` → tolerance 0.01
- [x] `close_to` — non-numeric actual → fail

#### 7.11 Undefined actual (None) edge cases across operators
- [x] `equals` — `None` actual → fail (undefined cannot equal anything)
- [x] `not_equals` — `None` actual → pass (undefined is not equal to any value)
- [x] `in` — `None` actual → always fail (undefined is never "in" a set)
- [x] `not_in` — `None` actual → always pass (undefined is trivially "not in" a set)
- [x] `is_null` — `None` actual → fail (undefined ≠ null — only `Value::Null` is null)
- [x] `contains` — `None` actual → stringify as `""` then search
- [x] `starts_with` — `None` actual → stringify as `""` then test
- [x] `regex` — `None` actual → stringify as `""` then test
- [x] `is_type` — `None` actual → fail (undefined has no type)
- [x] `is_type` — `None` actual vs `"null"` expected → fail (undefined ≠ null)

#### 7.12 Numeric edge cases
- [x] `to_number(Value::String("NaN"))` → None (NaN is not a valid number)
- [x] `to_number(Value::String("Infinity"))` → Some(Infinity) (Infinity is a valid f64)
- [x] `close_to` — NaN tolerance (from invalid operatorValue) → always fails
- [x] `close_to` — no comma separator in operatorValue (e.g., `"5"` with no parts) → uses default tolerance

#### 7.13 Default/unknown operator
- [x] Unknown operator string → `pass: false, actual: "unknown operator"`

---

### 8. Assertion Evaluator (`assertion_evaluator.rs` — 61 tests)

#### 8.1 Helper functions
- [x] `compare(5.0, Eq, 5.0)` → true
- [x] `compare(5.0, Ne, 3.0)` → true
- [x] `compare(5.0, Gt, 3.0)` → true
- [x] `compare(3.0, Gte, 3.0)` → true
- [x] `compare(3.0, Lt, 5.0)` → true
- [x] `compare(5.0, Lte, 5.0)` → true
- [x] `format_op(Eq)` → `"="`
- [x] `format_op(Ne)` → `"≠"`
- [x] `format_op(Gte)` → `"≥"`
- [x] `format_op(Lte)` → `"≤"`

#### 8.2 Status code assertions
- [x] Exact status `"200"` match against http_status 200 → pass (0 failures)
- [x] Exact status `"200"` against 404 → fail with path `"(status)"`
- [x] Range `"200-299"` against 201 → pass
- [x] Class `"2xx"` against 200 → pass
- [x] Comma-separated `"200,201"` against 201 → pass
- [x] Sets `status_asserted = true` even when assertion passes
- [x] Sets `status_asserted = true` even when assertion fails
- [x] Negated status: pass → negated fail with `"NOT (assertion to fail)"`

#### 8.3 Response time assertions
- [x] `responseTimeMs: 50` with `maxMs: 100` → pass
- [x] `responseTimeMs: 150` with `maxMs: 100` → fail with `"≤ 100ms"` expected
- [x] Negated response time

#### 8.4 Header assertions
- [x] Header exists → pass
- [x] Header missing → fail
- [x] Header equals exact value → pass
- [x] Header contains substring → pass
- [x] Header regex match → pass
- [x] Header value is None (`a.value` is None for exists operator) → pass if exists
- [x] Path format: `"(header:{name})"`
- [x] Negated header

#### 8.5 Regex assertions
- [x] Path value matches regex → pass
- [x] Path value does not match → fail with truncated actual (200 chars max)
- [x] Path not found → stringify as `"undefined"` then test regex
- [x] Invalid regex pattern → config error `"invalid regex pattern"`
- [x] Non-string value gets JSON stringified before regex test
- [x] Path format: `"(regex:{jsonPath})"`
- [x] Multi-byte UTF-8 actual truncated safely at 200 chars (doesn't split codepoints)
- [x] Negated regex (but config error still fails when negated)

#### 8.6 Array length assertions
- [x] Array with matching length → pass
- [x] Array with wrong length → fail
- [x] Non-array value → fail with `"not an array ({type})"`
- [x] Null value → fail with `"not an array (object)"` (JS typeof null == "object")
- [x] Path not found → fail with `"undefined"`
- [x] Uses comparison operator (=, !=, >, >=, <, <=)
- [x] Path format: `"(arrayLength:{jsonPath})"`

#### 8.7 Numeric assertions
- [x] Numeric value matching comparison → pass
- [x] Numeric value failing comparison → fail
- [x] Path not found → fail with `"undefined"` (checked FIRST)
- [x] Non-numeric value → fail with `"not a number: {JSON}"`
- [x] String numeric `"42"` → parsed as number via `Number(raw)`
- [x] Bool `true` → parsed as `1.0` (JS `Number(true) === 1`)
- [x] Null → parsed as `0.0` (JS `Number(null) === 0`)
- [x] Object → NaN → fail with `"not a number: {JSON}"`
- [x] Empty array `[]` → `0.0` (JS `Number([]) === 0`)
- [x] Single-element array `[42]` → `42.0` (JS `Number([42]) === 42`)
- [x] Multi-element array `[1,2]` → NaN → fail (JS `Number([1,2])` is NaN)
- [x] Path format: `"(numeric:{jsonPath})"`

#### 8.8 Date assertions (day-level)
- [x] Date value matches reference → pass
- [x] Date value before reference with `<` operator → pass
- [x] Path not found → fail with `"undefined"`
- [x] Non-date value → fail with `"not a date: {JSON}"`
- [x] Comparison uses `localeCompare` semantics: -1/0/1 compared with operator against 0
- [x] Path format: `"(date:{jsonPath})"`

#### 8.9 Type check assertions
- [x] Matching type → pass
- [x] Mismatching type → fail with `"type {actual}"`
- [x] Path not found → fail with `"path not found"`
- [x] Path format: `"(typeCheck:{jsonPath})"`

#### 8.10 Existence assertions
- [x] Path found (even null) with `expectExists: true` → pass
- [x] Path not found with `expectExists: true` → fail
- [x] Path not found with `expectExists: false` → pass
- [x] Path found with `expectExists: false` → fail
- [x] Path format: `"(existence:{jsonPath})"`

#### 8.11 Array contains assertions (4 modes)
- [x] `any` mode — at least one match → pass
- [x] `any` mode — no match → fail `"no matching item in N items"`
- [x] `all` mode — all match → pass
- [x] `all` mode — partial match → fail `"K of N items did not match"`
- [x] `only` mode — exact unordered set → pass
- [x] `only` mode — missing items → fail with `"missing: [...]"`
- [x] `only` mode — extra items → fail with `"extras: [...]"`
- [x] `none` mode — no match → pass
- [x] `none` mode — match found → fail `"item at index M matched"`
- [x] Non-array value → fail `"not an array"`
- [x] Object items use `deep_subset_match` for matching
- [x] Primitive items use `JSON.stringify` equality

#### 8.12 Each (per-element) assertions
- [x] All elements pass operator → pass
- [x] Some elements fail → fail with summary
- [x] 4+ failures → shows first 3 with `"… and N more"`
- [x] `fieldPath` set → extracts nested path from each element
- [x] `fieldPath` empty → uses element directly
- [x] Non-array → fail `"not an array"`
- [x] Null value → fail `"not an array (object)"` (JS typeof null == "object")
- [x] Operator name in failure message uses snake_case (e.g., `greater_than` not `greaterThan`)
- [x] Path format: `"(each:{jsonPath})"`

#### 8.13 Contains subset assertions
- [x] Subset matches → pass
- [x] Subset mismatch → fail with subset path appended
- [x] Path not found → fail `"undefined"`
- [x] Invalid JSON in expected → config error `"invalid JSON in expected"`, expected: `"valid JSON subset"`
- [x] Path format: `"(containsSubset:{jsonPath}{.subPath})"`
- [x] Negated: config error (invalid JSON) still fails even when negated

#### 8.14 JSON Schema assertions
- [x] Valid response against valid schema → pass
- [x] Invalid response → fail with up to 10 error details
- [x] Path includes assertion index: `"(jsonSchema#0:{instancePath})"`
- [x] Invalid schema string → config error, expected: `"valid JSON Schema"`
- [x] Negated: schema parse error still fails when negated

#### 8.15 Body size assertions
- [x] Body size within threshold → pass
- [x] Body size exceeds threshold → fail
- [x] Unit conversion: bytes (÷1), kb (÷1024), mb (÷1048576)
- [x] Actual rounded to 2 decimal places in display
- [x] Fallback: if raw_body empty → use `serde_json::to_string(response_body)`
- [x] Path format: `"(bodySize)"`

#### 8.16 Date precise assertions
- [x] Truncated comparison passes → pass
- [x] Truncated comparison fails → fail
- [x] Path not found → fail `"undefined"`
- [x] Invalid actual date → fail `"invalid date: {raw}"`
- [x] Invalid reference date → fail `"invalid reference: {ref}"`
- [x] All 5 precisions: day, hour, minute, second, millisecond
- [x] Precision label in failure message uses lowercase (e.g., `"day"` not `"Day"`)
- [x] Path format: `"(datePrecise:{jsonPath})"`

#### 8.17 Custom assertions
- [x] Custom assertion is SKIPPED entirely (no failure, no pass)
- [x] Other assertions in same list are still evaluated

#### 8.18 Multiple assertions in single call
- [x] Mixed assertions (status + numeric + regex + header) → all evaluated, all failures collected

#### 8.19 Universal negate logic
- [x] Non-negated: all assertion failures pushed to result
- [x] Negated + assertion fails → pass (failures dropped)
- [x] Negated + assertion passes → synthetic failure `"assertion passed (negated → fail)"`
- [x] Negated + config error → config error still pushed (fail even when negated)
- [x] Config error patterns: `"invalid regex pattern"`, `"invalid JSON in expected"`, starts_with `"invalid date:"`, starts_with `"invalid reference:"`, expected `"valid JSON Schema"`, expected `"valid JSON subset"`
- [x] Synthetic failure path uses assertion type name: `"(status)"`, `"(responseTime)"`, etc.

---

## Sub-Group D: Validation Engine + Wiring (Completed)

### 9. JSON Validator (`json_validator.rs` — 51 tests)

#### 9.1 `validate()` — mode routing
- [x] `mode: 'none'` → returns empty failures
- [x] `mode: 'full'` with valid expectedJson → calls `deep_compare()`, returns failures
- [x] `mode: 'full'` with empty/null expectedJson → returns empty failures
- [x] `mode: 'full'` with invalid JSON string → returns `(parse)` failure: `{ path: "(parse)", expected: "valid JSON", actual: "parse error in expected JSON" }`
- [x] `mode: 'selective'` with empty expectedFields → returns empty failures
- [x] `mode: 'selective'` → calls `validate_fields()` for ordered, `validate_fields_unordered()` for unordered
- [x] Unknown mode string (e.g., `"custom_mode"`) → handled by Rust enum exhaustiveness at IPC boundary (Rust rejects invalid modes at deserialization)

#### 9.2 `validate_fields()` — ordered field validation
- [x] Field with operator: calls `evaluate_field_operator`, passes negate through
- [x] Field with operator + negate: flips pass/fail, prepends "NOT " to expected
- [x] Field without operator: JSON-stringifies both sides and compares
- [x] Field without operator — expected is valid JSON string: `JSON.parse(expected)` → `JSON.stringify()` normalization
- [x] Field without operator — expected is NOT valid JSON: `JSON.stringify(expected)` (quote the raw string)
- [x] Field without operator + negate: expected becomes `"NOT equals {expectedValue}"`
- [x] Missing field (path resolves to null/undefined): actual display is `"null"` or `"undefined"`
- [x] Multiple fields: all failures collected, not short-circuited
- [x] Null value at path → actual displays as `"null"`
- [x] `exists` operator with null at path → passes (null exists)
- [x] `exists` operator with missing path → fails
- [x] `not_exists` operator with missing path → passes
- [x] Boolean equality: `Value::Bool(true)` vs `"true"` → pass (stringify comparison)
- [x] Array equality: `[1,2,3]` vs `"[1,2,3]"` → pass (JSON stringify normalization)
- [x] Nested path: `$.data.nested.value` → correctly resolves through nested objects
- [x] Array index path: `$.data.items[0].name` → correctly resolves array element

#### 9.3 `validate_fields_unordered()` — unordered array validation
- [x] Non-array fields (no `[N]` in path): validated via `validate_fields()` directly
- [x] Array fields grouped by row prefix: `offers[0].name` and `offers[0].code` → same group
- [x] Row prefixes grouped by pattern: `offers[0]` and `offers[1]` → same `offers[*]` group
- [x] Perfect match: all fields in a row match at some index → mark index as used, no failures
- [x] `usedIndices` prevents same array element from matching two expected rows
- [x] Partial match (best partial): mismatches reported with context `"actual (matched by suffix=value at [index])"`
- [x] Partial match: actual value has quotes stripped (`m.actualValue.replace(/^"|"$/g, '')`)
- [x] No match: failures reported as `"no matching item found in array"`
- [x] Array not found (length 0): falls back to `validate_fields()` for those rows
- [x] With operator in array fields: operator evaluation works per-candidate index
- [x] With negate in array fields: negate applied per-field within the matching loop
- [x] Nested arrays: `offers[0].items[1].name` — row prefix is `offers[0].items[1]`
- [x] Multi-field row matching at different array indices: rows with 2+ fields find correct permutation
- [x] Partial match with undefined actual → actual not quote-stripped (no quotes to strip)

#### 9.4 `try_remap_paths()` — heuristic path remapping
- [x] Only called when ALL failures have `actual == "undefined"`
- [x] Not called when response is null/non-object
- [x] Strategy 1 (array response): strip common first segment from paths, re-validate
- [x] Strategy 1: first segment detected by splitting on `[` or `.` (`/[[.]/`)
- [x] Strategy 1: all paths must share the same first segment
- [x] Strategy 2 (object response): try each root key as prefix (`key.path`), normalize `.[` to `[`
- [x] Strategy 2b: also try resolving directly against nested value
- [x] Improvement check: remapped result must have at least one non-undefined actual
- [x] No improvement: returns null, original failures kept
- [x] Respects `unordered` flag: uses `validate_fields_unordered` when unordered

### 10. Validation Result (`validation_result.rs` — 33 tests)

#### 10.1 `build_validation_result()` — combination logic
- [x] No assertions + mode none → passed = http_ok, empty failures
- [x] No assertions + mode selective + HTTP 200 → runs validate(), returns validation failures
- [x] Assertions present → runs `evaluate_assertions()` first, captures `status_asserted`
- [x] `http_ok` = `http_status > 0 && http_status < 400`
- [x] `status_ok` with `status_asserted = true` + no status failure → `status_ok = true` (even for HTTP 500)
- [x] `status_ok` with `status_asserted = true` + status failure present → `status_ok = false`
- [x] `status_ok` with `status_asserted = false` → `status_ok = http_ok`
- [x] JSON validation runs only when `mode != 'none'` AND `status_ok`
- [x] JSON validation skipped when `mode == 'none'` (regardless of status_ok)
- [x] JSON validation skipped when `!status_ok` (bad HTTP status without status assertion)

#### 10.2 HTTP failure overlay
- [x] HTTP 500 + no status assertion → `(http)` failure prepended, JSON failures DROPPED
- [x] HTTP 500 + no status assertion + error_message set → actual = error_message
- [x] HTTP 500 + no status assertion + no error_message → actual = `"HTTP 500"`
- [x] HTTP 500 + no status assertion + empty error_message `""` → falls back to `"HTTP 500"` (empty treated as absent)
- [x] HTTP 0 (network error) + no status assertion → actual = `"network error"`, `network_error = true`
- [x] HTTP 0 (network error) + empty error_message `""` → still uses `"network error"` (empty treated as absent)
- [x] HTTP 500 + passing status assertion → NO http overlay, all assertion + JSON failures kept
- [x] HTTP 200 → no overlay, assertion + JSON failures merged normally
- [x] HTTP 0 + status assertion passing → no network_error, JSON validation runs

#### 10.3 Final result computation
- [x] `passed = !network_error && failure_details.is_empty()`
- [x] `error_message` passed through unchanged from input
- [x] Network error: `http_status == 0 && !status_asserted` → always `passed = false`
- [x] Failures from assertions + JSON validation merged in order (assertions first)
- [x] Empty response body → parsed as `Value::Null` (no panic)
- [x] Combined: assertion failures + JSON validation failures both collected
- [x] Negated status assertion: pass→fail blocks JSON validation (status_ok = false)
- [x] Negated status assertion: fail→pass allows JSON validation (status_ok = true)

#### 10.4 Integration through `build_validation_result()`
- [x] Selective mode + `try_remap_paths` triggered end-to-end
- [x] HTTP 500 + failing assertion → JSON validation skipped end-to-end
- [x] Unordered mode + assertions → both pass end-to-end
- [x] Full mode mismatch → correct failure details end-to-end

### 11. Executor Wiring

#### 11.1 `validate_result()` helper
- [x] Validation runs AFTER `execute_with_retry()`, NOT inside it
- [x] `validate_result()` called at **TWO** call sites: `run_pool()` and `run_load_profile()` (no `run_sequential` exists — sequential mode uses `run_pool` with concurrency=1)
- [x] `result` declared as `let mut result` to allow mutation after `execute_with_retry()`
- [x] Body parsing guard: skip JSON parsing when `mode == ValidationMode::None` AND assertions empty
- [x] Body parsing failure: invalid JSON → `Value::Null` used as response_obj
- [x] `cap_body` truncation: validation operates on truncated body (may cause false negatives on large bodies)
- [x] Circuit breaker: `is_error` now includes `!result.passed.unwrap_or(true)`, check moved AFTER `validate_result()`
- [x] `build_result()` updated with default values: `passed: None`, `failure_details: vec![]`, `validation_mode: String::new()`

#### 11.2 Types changes
- [x] `RustScenario` has `#[serde(default)] validation: ValidationConfig` and `#[serde(default)] assertions: Vec<Assertion>`
- [x] `#[serde(default)]` on both fields ensures backward compatibility with old JS bridge code
- [x] `ExecutionResult.passed` is `Option<bool>` (None when validation not run)
- [x] `ExecutionResult.failure_details` is `Vec<FailureDetail>` (empty default)
- [x] `ExecutionResult.validation_mode` is `String` (NOT `ValidationMode` enum — for IPC transport)
- [x] `FailureDetail` reused from `validation_types.rs` — NOT re-defined in `types.rs`
- [x] `ValidationMode` used as enum internally, converted to string only for `ExecutionResult.validation_mode`
- [x] `ExpectedField.expression` is `Option<String>` — intentionally not serialized by JS, defaults to None

### 12. JS Bridge Changes (Completed)

#### 12.1 Serialization
- [x] `prepareRustScenario()` includes `validation` and `assertions` (filtered, no custom)
- [x] Custom assertions filtered out at serialization time
- [x] UI-only fields (`selectiveMode`, `sampleJson`, etc.) NOT serialized
- [x] `canUseRustExecutor()` — no additional gating needed (hybrid approach: Rust skips custom, JS evaluates them post-hoc)

#### 12.2 Result mapping
- [x] `mapRustResult()`: when `rustResult.passed !== undefined`, passthrough Rust results
- [x] `mapRustResult()`: custom assertions run JS-side, merged into Rust failure details
- [x] `mapRustResult()`: backward compatibility — `passed === undefined` falls back to JS validation
- [x] Combined result: `passed = rustResult.passed && customFailures.length === 0`

### 13. Integration Tests (`validation_result_test.rs` + `cross_module_test.rs` — 49 tests: 33 validation_result + 9 cross-module integration + 7 perf benchmarks)
- [x] End-to-end: scenario → Rust validation → same `passed` as JS validation
- [x] End-to-end: same `failureDetails` content (path, expected, actual strings match)
- [x] HTTP 500 + no status assertion → identical overlay behavior
- [x] HTTP 500 + passing status assertion → JSON validation runs in both
- [x] All selective fields undefined → `tryRemapPaths` produces same result
- [x] `negate: true` with config errors → errors survive negation in both
- [x] `custom` assertion filtered → JS fills in post-hoc, same final result
- [x] `validateFieldsUnordered` partial match → same context strings
- [x] `mode: 'full'` with invalid expectedJson → same `(parse)` failure
- [x] No assertions + mode none → same simple HTTP-based pass/fail

#### 13.1 Performance Benchmark — Rust Core (`cross_module_test.rs`)

> **Implementation note**: `validate_result()` in `executor.rs` is private. Benchmarks B replicate the same pipeline inline: `serde_json::from_str(&body_str)` → `build_validation_result(...)`.
> **Warmup**: Each benchmark should run 100 warmup iterations before the timed loop to ensure allocator and regex caches are hot. Rust benchmarks use `--release` mode.
> **Common fixture args for `build_validation_result()`**: All Rust benchmarks must supply all 8 parameters: `http_status: 200`, `response_time_ms: 45.0`, `response_headers: HashMap` (empty for A-F, populated for G), `response_body: &str` (the shared JSON string), `response_obj: &Value` (parsed once outside the loop), `error_message: None`, `validation: &ValidationConfig`, `assertions: &[Assertion]`. Test function names must start with `perf_` (e.g. `fn perf_benchmark_a()`) so the filter command works.

**Benchmark A: Selective mode + 5 assertions (primary benchmark — 10K iterations)**
- [x] Build shared fixture: 11-field JSON body (id, name, count, active, email, role, score, tags, items, metadata, timestamp), `mode: selective`, 4 expectedFields (equals ×2, greater_than_or_equal, contains operators), 5 assertions (status, responseTime, numeric, regex, existence)
- [x] Run `build_validation_result()` 10K times, all-passing — measure wall-clock via `Instant::now()`
- [x] Assert all 10K → `passed: true` (sanity check)
- [x] Print elapsed ms for comparison

**Benchmark B: Full pipeline including JSON parsing (10K iterations)**
- [x] Same fixture as A but pipeline is: `serde_json::from_str(&body_string)` + `build_validation_result()` — measures realistic per-result cost including deserialization
- [x] Assert all 10K → `passed: true` (sanity check — ensures JSON parsing produces valid input)
- [x] Print elapsed ms

**Benchmark C: Mixed pass/fail workload (10K iterations)**
- [x] 70% passing (HTTP 200, same body + assertions as A — all pass), 30% failing (HTTP 500 with **same response body**, overlay path)
- [x] **CRITICAL**: Pre-build TWO assertion arrays: `assertions_pass` (all 5 from A, used for 70% passing) and `assertions_fail` (4 assertions WITHOUT `status`, used for 30% failing). Loop uses `if i % 10 < 7 { http_status=200, &assertions_pass } else { http_status=500, &assertions_fail }`. Failing iterations must omit the `status` assertion so `statusAsserted = false` and the HTTP failure overlay (`http_failed = !statusAsserted && httpStatus >= 400`) is actually triggered. If a status assertion were present, `statusAsserted = true` prevents the overlay — the status assertion fails but the `(http)` overlay allocation path (drop JSON failures, prepend `FailureDetail { path: "(http)", expected: "2xx", actual: "HTTP 500" }`) never executes.
- [x] Exercises both the happy path AND the HTTP failure overlay allocation path (different Vec construction)
- [x] Print elapsed ms + assert correct pass/fail ratio (7000 passed, 3000 failed)

**Benchmark D: Full mode — deep JSON comparison (5K iterations)**
- [x] `mode: full` with `expectedJson` = **exact copy of the full response body** (the root `{"data":{...}}` object with all 11 nested fields, arrays, and sub-objects — `deep_compare` is called with `(expectedObj, responseBody, "", &mut failures)` at the root level), 2 assertions (status, responseTime)
- [x] Exercises `deep_compare()` which is recursion-heavy with `format!` calls on nested objects, arrays of objects, and leaf values
- [x] Print elapsed ms

**Benchmark E: Heavy assertions — schema + subset + each (2K iterations)**
- [x] `mode: none` (no expectedFields — assertion-only benchmark), 5 assertions: `jsonSchema` (small schema), `containsSubset` (2-field subset: `active` + `role`), `each` (5-element array of objects, field operator), `arrayContains` (value in array), `arrayLength` (count check)
- [x] Exercises the most expensive assertion types: jsonschema crate compilation, `deep_subset_match` recursion, array iteration with `evaluate_field_operator`
- [x] Print elapsed ms

**Benchmark F: Selective with unorderedArrays (5K iterations)**
- [x] `mode: selective`, `unorderedArrays: true`, 3 expectedFields on array elements (see table below), 2 assertions (status, responseTime)
- [x] Exercises `validate_fields_unordered()` path — the array index grouping, `[N]`→`[*]` pattern extraction, and permutation matching against all array elements
- [x] Print elapsed ms

**Benchmark F expectedFields (unordered array elements):**
| # | jsonPath | expectedValue | operator |
|---|---|---|---|
| 1 | `$.data.items[0].name` | `Widget C` | `equals` |
| 2 | `$.data.items[0].price` | `29.99` | `equals` |
| 3 | `$.data.items[1].name` | `Widget A` | `equals` |

> Note: The fields reference `items[0]` and `items[1]` but with **deliberate index mismatch** — "Widget C" is actually at `items[2]` and "Widget A" is at `items[0]` in the response body. With `unorderedArrays: true`, `validate_fields_unordered` must rearrange to find a matching permutation. This ensures the unordered matching logic is genuinely exercised, not short-circuited by indices already being correct.

**Benchmark G: Remaining assertion types — header + date + typeCheck + bodySize + datePrecise (5K iterations)**
- [x] `mode: none` (no expectedFields — assertion-only benchmark), 5 assertions covering types not in A/E: `header` (name: "content-type", operator: contains, value: "json"), `date` (jsonPath: `$.data.timestamp`, operator: `<=`, reference: `{ kind: "fixed", iso: "2025-01-01" }`), `typeCheck` (jsonPath: `$.data.count`, expectedType: "number"), `bodySize` (operator: `<`, value: 10, unit: kb), `datePrecise` (jsonPath: `$.data.timestamp`, operator: `<=`, reference: "2025-01-01T00:00:00Z", precision: day)
- [x] **Note**: Benchmark G requires passing `response_headers` (the shared headers map with `content-type` and `x-request-id`) unlike other benchmarks that can use an empty map
- [x] Exercises `find_header`, `evaluate_header_op`, `resolve_date`, `to_day_string`, `get_json_type_name`, body size calculation, `truncate_to_unit`
- [x] Print elapsed ms

**Regression guard:**
- [x] Assert primary benchmark (A) completes in < 2 seconds (10K × selective + 5 assertions on any modern machine)

#### 13.2 Performance Benchmark — JS Baseline (`validationResult.perf.test.ts`)

> **Warmup**: Each JS benchmark runs 100 warmup iterations before the timed loop to ensure V8 JIT compilation is warm.
> **API**: Import `buildValidationResult` and `ValidationInput` from `src/engine/validationResult.ts`. Construct a `ValidationInput` object with `httpStatus`, `responseTimeMs`, `responseHeaders`, `responseBody` (string), `responseObj` (parsed JSON), `validation` (ValidationConfig), and `assertions` (Assertion[]).
> **Test isolation**: Perf tests (`.perf.test.ts`) are matched by vitest's default `*.test.ts` pattern and would run in the full suite. Each perf test file should use `describe.skipIf(process.env.PERF !== '1')` or equivalent guard so perf benchmarks only run when targeted explicitly (via direct file path or `PERF=1` env). This prevents 10K-iteration loops from slowing CI/development test runs.

**JS Benchmark A: Selective mode + 5 assertions (10K iterations)**
- [x] Same fixture as Rust Benchmark A: 11-field JSON body, `mode: selective`, 4 expectedFields, 5 assertions
- [x] Run `buildValidationResult()` 10K times — measure wall-clock via `performance.now()`
- [x] Print elapsed ms

**JS Benchmark B: Full pipeline including JSON.parse (10K iterations)**
- [x] Same body as string, include `JSON.parse()` in the loop to match Rust's `serde_json::from_str` cost
- [x] Assert all 10K → `passed: true` (sanity check)
- [x] Print elapsed ms

**JS Benchmark C: Mixed pass/fail workload (10K iterations)**
- [x] 70% passing, 30% HTTP 500 with overlay — same mix as Rust Benchmark C (failing iterations omit the status assertion so the overlay fires)
- [x] Print elapsed ms + assert correct ratio

**JS Benchmark D: Full mode — deep JSON comparison (5K iterations)**
- [x] Same fixture as Rust Benchmark D
- [x] Print elapsed ms

**JS Benchmark E: Heavy assertions — schema + subset + each (2K iterations)**
- [x] Same fixture as Rust Benchmark E — ensures fair comparison for expensive assertions
- [x] Print elapsed ms

**JS Benchmark F: Selective with unorderedArrays (5K iterations)**
- [x] Same fixture as Rust Benchmark F
- [x] Print elapsed ms

**JS Benchmark G: Remaining assertion types (5K iterations)**
- [x] Same fixture as Rust Benchmark G — header, date, typeCheck, bodySize, datePrecise
- [x] Print elapsed ms

#### 13.3 Performance Benchmark — JS Bridge Passthrough (`rustBridge.perf.test.ts`)

**Bridge Benchmark: `mapRustResultPassthrough` overhead (10K iterations)**
- [x] Build a full mock `RustExecutionResult` using the existing `makeRustResult()` factory pattern from `rustBridge.test.ts` — must include all required fields (`id`, `scenarioId`, `scenarioName`, `url`, `method`, `httpStatus: 200`, `responseTimeMs`, `responseBody` (shared JSON string), `responseHeaders`, `timestamp`, `requestLog`, `timing`, `retryCount: 0`) plus passthrough fields: `passed: true`, `failureDetails: []`, `validationMode: "selective"`
- [x] Build a `Scenario` mock using the existing `makeScenario()` factory pattern from `rustBridge.test.ts` with `validation.assertions` containing 1 custom assertion (`{ type: 'custom', expression: 'true' }`) + 1 non-custom (`{ type: 'status', expected: '200' }`) — the custom assertion triggers `JSON.parse(responseBody)` + `evaluateAssertions` overhead on the passthrough path; the status assertion is skipped (already evaluated by Rust)
- [x] Run `mapRustResult()` 10K times with the same mock — measures the bridge mapping + JSON.parse + custom assertion eval + full `RequestResult` construction cost
- [x] Print elapsed ms — this is the overhead on top of Rust validation
- [x] Compare: bridge overhead should be < 10% of JS-only validation time (Benchmark A)

#### 13.4 Comparison & Reporting

- [x] Run Rust benchmarks: `cd src-tauri && cargo test perf_ --release -- --nocapture`
- [x] Run JS benchmarks: `PERF=1 npx vitest run src/engine/validationResult.perf.test.ts`
- [x] Run bridge benchmarks: `PERF=1 npx vitest run src/features/test-runner/utils/rustBridge.perf.test.ts`
- [x] Document results in a comparison table (Benchmark A-G: Rust ms vs JS ms, speedup factor)
- [x] ~~Verify: Rust Benchmark A < JS Benchmark A~~ — **FINDING: JS faster** (see table below; V8 JIT optimizes tight loops effectively; Rust overhead from regex compilation per-call and `format!` allocations in selective field matching)
- [x] ~~Verify: Rust Benchmark B < JS Benchmark B~~ — **FINDING: JS faster** (same root cause as A)
- [x] ~~Verify: Bridge passthrough overhead < 10% of JS-only Benchmark A time~~ — **FINDING: 32% overhead** (18.57 ms bridge vs 57.51 ms JS-A = 32%). However, bridge overhead includes `JSON.parse(responseBody)` + custom assertion evaluation + `RequestResult` construction — not just field mapping. Pure field mapping overhead is negligible; the `JSON.parse` and `evaluateAssertions` calls dominate. In production the bridge overhead is amortized by the much larger HTTP round-trip time.
- [x] All benchmarks must print per-iteration µs for easy comparison

**Results (macOS aarch64, 2026-05-19):**

| Benchmark | Iters | Rust ms | Rust µs/iter | JS ms | JS µs/iter | Winner |
|---|---|---|---|---|---|---|
| A (selective + 5 assertions) | 10K | 224.00 | 22.40 | 57.51 | 5.75 | JS 3.9× |
| B (full pipeline + parse) | 10K | 258.63 | 25.86 | 73.11 | 7.31 | JS 3.5× |
| C (mixed 70/30 pass/fail) | 10K | 224.29 | 22.43 | 41.44 | 4.14 | JS 5.4× |
| D (full mode deep compare) | 5K | 30.69 | 6.14 | 36.18 | 7.24 | Rust 1.2× |
| E (heavy assertions) | 2K | 48.22 | 24.11 | 281.49 | 140.75 | **Rust 5.8×** |
| F (unorderedArrays) | 5K | 523.12 | 104.62 | 149.71 | 29.94 | JS 3.5× |
| G (header+date+typeCheck+bodySize+datePrecise) | 5K | 776.80 | 155.36 | 28.62 | 5.72 | JS 27× |
| Bridge (passthrough overhead) | 10K | — | — | 18.57 | 1.86 | — |

**Analysis:**
- **Rust wins on heavy assertions (E)** by 5.8×: `jsonschema` crate validation + `deep_subset_match` + `each` are genuinely faster in Rust after warmup. The `jsonschema` crate compiles schemas more efficiently than JS Ajv on repeated invocations.
- **Rust wins on deep compare (D)** by 1.2×: recursion-heavy `deep_compare` with `format!` is slightly faster in Rust due to efficient stack allocation and no GC pauses.
- **JS wins on simple/moderate benchmarks (A/B/C/F)**: V8 JIT inlines and optimizes tight validation loops with simple string/number operations extremely well. Rust's overhead in A/B/C comes from: regex compilation per-call (no caching in `evaluate_assertions` — the `Regex` assertion recompiles the pattern on every invocation), `format!` string allocations for failure detail paths (even when constructing temporaries that are immediately dropped on success), and `String::from`/`.into()` conversions.
- **JS wins on G by 27×**: The extreme gap is due to Rust `chrono` date parsing overhead — `DatePrecise` calls `parse_date_to_millis()` which tries up to 4 format parsers (RFC3339, two NaiveDateTime patterns, NaiveDate) per date value. Although RFC3339 matches on the first attempt for these inputs, `chrono` parsing itself is heavyweight (allocates, validates, timezone-aware). The `Date` assertion also calls `to_day_string()` which has its own chrono parse. Combined with 3 chrono parse calls per iteration + `format!` allocations for path strings, this explains the 27× gap. JS `Date.parse()` is a highly optimized native V8 builtin.
- **Benchmark B note**: JS Benchmark B calls `makeInput()` inside the timed loop (creating a new `ValidationInput` via spread operator per iteration), while Rust reuses config/assertions by reference. This adds ~1-2µs of JS object allocation overhead per iteration — slightly unfair to JS but more realistic since real requests create fresh inputs.
- **Rust executor value is in parallelism**: the Rust executor's primary advantage is `tokio` async concurrency (100+ concurrent HTTP requests), not per-result validation speed. Validation is CPU-bound and V8 is competitive; the Rust executor offloads the HTTP I/O bottleneck.
- **Optimization opportunities**: Rust regex caching (compile once, reuse across iterations) and `chrono` bypass for common ISO 8601 formats would significantly close the gap on A/G. These are tracked but not required for correctness.

#### 13.5 Shared Test Data Shape

**Response body** (used by all benchmarks):
```json
{
  "data": {
    "id": "abc123def456",
    "name": "Test User",
    "count": 42,
    "active": true,
    "email": "user@example.com",
    "role": "admin",
    "score": 95.5,
    "tags": ["alpha", "beta", "gamma", "delta", "epsilon"],
    "items": [
      { "name": "Widget A", "price": 9.99 },
      { "name": "Widget B", "price": 19.99 },
      { "name": "Widget C", "price": 29.99 },
      { "name": "Widget D", "price": 39.99 },
      { "name": "Widget E", "price": 49.99 }
    ],
    "metadata": { "version": "1.0", "region": "us-east" },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**Response headers** (used by Benchmark G):
```json
{ "content-type": "application/json; charset=utf-8", "x-request-id": "abc-123" }
```

**Primary assertions (Benchmarks A/B/C):**
| # | Type | Config |
|---|---|---|
| 1 | `status` | expected: `"200"` |
| 2 | `responseTime` | maxMs: `500` |
| 3 | `numeric` | jsonPath: `$.data.count`, operator: `>`, value: `0` |
| 4 | `regex` | jsonPath: `$.data.id`, pattern: `^[a-f0-9]+$` |
| 5 | `existence` | jsonPath: `$.data.name`, expectExists: `true` |

**Selective expectedFields (Benchmarks A/B/C):**
| # | jsonPath | expectedValue | operator |
|---|---|---|---|
| 1 | `$.data.active` | `true` | `equals` |
| 2 | `$.data.role` | `"admin"` | `equals` |
| 3 | `$.data.score` | `95.5` | `greater_than_or_equal` |
| 4 | `$.data.email` | `example` | `contains` (field operator — exercises string ops) |

**Heavy assertions (Benchmark E):**
| # | Type | Config |
|---|---|---|
| 1 | `jsonSchema` | small schema: requires `data` object with `id` string, `count` number |
| 2 | `containsSubset` | jsonPath: `$.data`, expected: `{"active": true, "role": "admin"}` |
| 3 | `each` | jsonPath: `$.data.items`, fieldPath: `price`, operator: `greater_than`, value: `0` |
| 4 | `arrayContains` | jsonPath: `$.data.tags`, value: `"alpha"`, mode: `any` |
| 5 | `arrayLength` | jsonPath: `$.data.tags`, operator: `=`, value: `5` |

**Remaining assertion types (Benchmark G):**
| # | Type | Config |
|---|---|---|
| 1 | `header` | name: `content-type`, operator: `contains`, value: `json` |
| 2 | `date` | jsonPath: `$.data.timestamp`, operator: `<=`, reference: `{ kind: "fixed", iso: "2025-01-01" }` |
| 3 | `typeCheck` | jsonPath: `$.data.count`, expectedType: `number` |
| 4 | `bodySize` | operator: `<`, value: `10`, unit: `kb` |
| 5 | `datePrecise` | jsonPath: `$.data.timestamp`, operator: `<=`, reference: `2025-01-01T00:00:00Z`, precision: `day` |
