# Validation & Assertion Operator Gap Analysis

> Date: 2026-05-14
> Purpose: Benchmark RedfireForge against commercial and open-source API testing tools for validation operators, assertion types, and expression functions.
> Last updated: 2026-05-14 — Phase 9.4 complete. Validation Rules Modal with 3-mode layout, redesigned DSL Reference Panel (10 categories, 39 entries), DSL assertion evaluation in verify hook, verify stats in modal header.

---

## 1. Executive Summary

RedfireForge scores **100% on the competitive feature matrix** (33 of 33 capabilities), surpassing Postman (88%), Karate (79%), and all other benchmarked tools. Starting from 21% coverage (7/33, ranked last), the validation platform was built through 13 implementation phases (P0–P9.4) to become the industry leader.

| Metric | Before (Pre-Phase 0) | After (Post-Phase 9.4) |
|---|---|---|
| Assertion types | 7 | 16 |
| Expression functions | 69 | 125 |
| Expression categories | 6 | 8 |
| FieldOperator values | 0 | 24 |
| Competitive coverage | 21% (7/33) | 100% (33/33) |
| Industry ranking | 12th of 12 | 1st of 12 |
| Authoring modes | Visual only | Visual + Code DSL (bi-directional) + 3-mode Validation Rules Modal |

### Unique Differentiators

RedfireForge is the only tool offering all of these in a single platform:
- **Unified visual mapper** reused across 10 integration contexts
- **Bi-directional visual ↔ code sync** (debounced, lossless)
- **Console-style Validation Rules Modal** — docked/floating/maximized with built-in DSL Reference (10 categories, 39 entries)
- **Auto-verify on change** with per-rule inline pass/fail (fields + DSL assertions counted together)
- **Verify stats in rules modal header** — live passed/failed/error counts
- **125-function expression engine** with lambda/closure support
- **Custom predicate functions** via `ASSERT` keyword
- **Universal negation** on any assertion
- **Type mismatch detection** with auto-fix suggestions
- **Modular validator architecture** — extracted into focused, testable modules

---

## 2. Competitive Coverage

### 2.1 Coverage Scorecard

| Tool | Operators (of 25) | Authoring (of 8) | Total (of 33) | Coverage |
|---|---|---|---|---|
| **RedfireForge** | **25** | **8** | **33** | **100%** |
| Postman (Chai.js) | 23 | 6 | 29 | 88% |
| Karate DSL | 21 | 5 | 26 | 79% |
| k6 (JavaScript) | 20 | 4 | 24 | 73% |
| Hurl | 18 | 5 | 23 | 70% |
| Bruno | 17 | 6 | 23 | 70% |
| REST Assured | 17 | 4 | 21 | 64% |
| JMeter | 10 | 6 | 16 | 48% |
| Gatling | 12 | 2 | 14 | 42% |
| StepCI | 10 | 2 | 12 | 36% |
| Pact | 9 | 2 | 11 | 33% |
| Artillery | 7 | 2 | 9 | 27% |

### 2.2 Assertion Operators Matrix

| Operator | Postman | Karate | Hurl | Bruno | StepCI | REST Assured | JMeter | Gatling | k6 | Artillery | Pact | **RedfireForge** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Exact equality | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | **Yes** |
| Not equals | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | **Yes** |
| Greater than | Y | Y | Y | Y | Y | Y | — | Y | Y | — | — | **Yes** |
| Less than | Y | Y | Y | Y | Y | Y | — | Y | Y | — | — | **Yes** |
| Contains (string) | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **Yes** |
| Starts with | Y | — | Y | Y | — | Y | — | — | Y | — | — | **Yes** |
| Ends with | Y | — | Y | Y | — | Y | — | — | Y | — | — | **Yes** |
| Regex match | Y | Y | Y | Y | Y | Y | Y | — | Y | Y | Y | **Yes** |
| Is true / false | Y | Y | Y | Y | — | — | — | — | Y | — | — | **Yes** |
| Is null | Y | Y | — | Y | Y | Y | — | Y | Y | — | Y | **Yes** |
| Is type | Y | Y | Y | Y | Y | Y | — | — | Y | — | Y | **Yes** |
| Exists | Y | Y | Y | Y | Y | — | — | Y | Y | Y | — | **Yes** |
| Is empty | Y | — | Y | Y | — | Y | — | — | Y | — | — | **Yes** |
| Array length | Y | Y | Y | Y | — | Y | — | Y | Y | — | Y | **Yes** |
| Array contains | Y | Y | Y | — | — | Y | — | — | Y | — | — | **Yes** |
| Each element | Y | Y | — | — | — | Y | — | — | Y | — | — | **Yes** |
| In / not in | — | Y | — | Y | Y | — | — | Y | Y | — | — | **Yes** |
| Between / range | Y | — | — | Y | — | — | — | — | — | — | — | **Yes** |
| Deep partial | Y | Y | — | — | — | Y | — | — | — | — | — | **Yes** |
| JSON Schema | Y | Y | — | — | Y | Y | Y | — | — | — | Y | **Yes** |
| Negation (any) | Y | Y | Y | — | — | Y | Y | — | Y | — | — | **Yes** |
| Has property | Y | Y | — | — | — | Y | — | — | Y | Y | — | **Yes** |
| Custom predicate | Y | Y | — | — | — | Y | Y | Y | Y | — | — | **Yes** |
| Response size | — | — | Y | — | — | — | Y | Y | Y | — | — | **Yes** |
| Approximate numeric | Y | — | — | — | — | Y | — | — | — | — | — | **Yes** |

### 2.3 Authoring & Verification Matrix

| Capability | Postman | Karate | Hurl | Bruno | StepCI | REST Assured | JMeter | Gatling | k6 | Artillery | Pact | **RedfireForge** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Visual UI authoring | Y | — | — | Y | — | — | Y | — | — | — | — | **Yes** |
| Code/DSL authoring | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | **Yes** |
| Bi-directional sync | — | — | — | Y | — | — | Partial | — | — | — | — | **Yes** |
| In-context verify | Y | Y | Y | Y | — | — | Y | — | — | — | — | **Yes** |
| Per-rule pass/fail | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **Yes** |
| Live fetch + verify | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **Yes** |
| Auto-verify on change | — | — | — | — | — | — | — | — | — | — | — | **Yes** |
| Filter by pass/fail | — | — | — | — | — | — | — | — | — | — | — | **Yes** |

---

## 3. RedfireForge Capabilities Inventory

### 3.1 Assertion Types (16)

| Type | Parameters | Operators | Phase |
|---|---|---|---|
| `status` | `expected: string` | Pattern: exact, range (200-299), class (2xx) | — |
| `responseTime` | `maxMs: number` | `<=` implicit | — |
| `header` | `name`, `operator`, `value?` | `equals`, `contains`, `regex`, `exists` | — |
| `regex` | `jsonPath`, `pattern` | Full RegExp on stringified value | — |
| `arrayLength` | `jsonPath`, `operator`, `value` | `=`, `!=`, `>`, `>=`, `<`, `<=` | — |
| `numeric` | `jsonPath`, `operator`, `value` | `=`, `!=`, `>`, `>=`, `<`, `<=` | — |
| `date` | `jsonPath`, `operator`, `reference` | `=`, `!=`, `>`, `>=`, `<`, `<=` | — |
| `typeCheck` | `jsonPath`, `expectedType` | `string`, `number`, `boolean`, `array`, `object`, `null` | P2 |
| `existence` | `jsonPath`, `expectExists` | boolean | P2 |
| `arrayContains` | `jsonPath`, `value`, `mode` | `any`, `all`, `only`, `none` | P3 |
| `each` | `jsonPath`, `fieldPath`, `operator`, `value?` | Any FieldOperator | P3 |
| `containsSubset` | `jsonPath`, `expected` | Deep recursive partial match | P3 |
| `jsonSchema` | `schema` | Ajv-powered JSON Schema validation | P6 |
| `bodySize` | `operator`, `value`, `unit` | `=`, `!=`, `>`, `>=`, `<`, `<=` + bytes/kb/mb | P8 |
| `datePrecise` | `jsonPath`, `operator`, `reference`, `precision` | day/hour/min/sec/ms | P8 |
| `custom` | `expression`, `description?` | Full expression engine (125 functions + lambdas) | P9.3 |

### 3.2 Field Operators (24)

```typescript
type FieldOperator =
  | 'equals' | 'not_equals'
  | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex'
  | 'is_true' | 'is_false'
  | 'is_null' | 'is_not_null' | 'is_empty' | 'is_not_empty'
  | 'exists' | 'not_exists'
  | 'is_type' | 'array_length'
  | 'in' | 'not_in' | 'between' | 'close_to';
```

### 3.3 Expression Functions (125 across 8 categories)

| Category | Functions | Count |
|---|---|---|
| String | `$upper`, `$lower`, `$trim`, `$length`, `$concat`, `$substring`, `$replace`, `$split`, `$join`, `$startsWith`, `$endsWith`, `$padStart`, `$padEnd`, `$repeat`, `$indexOf`, `$toString`, `$substringBefore`, `$substringAfter`, `$capitalize`, `$camelCase`, `$snakeCase`, `$kebabCase`, `$isAlpha`, `$isNumeric`, `$trimStart`, `$trimEnd`, `$scan`, `$ltrimStr`, `$rtrimStr`, `$capture`, `$indices` | 31 |
| Math | `$add`, `$subtract`, `$multiply`, `$divide`, `$round`, `$abs`, `$min`, `$max`, `$mod`, `$floor`, `$ceil`, `$power`, `$random`, `$parseInt`, `$toInt`, `$parseFloat`, `$sqrt`, `$clamp`, `$uuid`, `$range`, `$log`, `$exp`, `$gt`, `$gte`, `$lt`, `$lte`, `$eq`, `$neq` | 28 |
| Array | `$sum`, `$average`, `$groupBy`, `$any`, `$all`, `$map`, `$filter`, `$reduce`, `$sortBy`, `$minBy`, `$maxBy`, `$distinctBy`, `$zip`, `$pluck`, `$find`, `$findAll` | 16 |
| Object | `$has`, `$toEntries`, `$fromEntries`, `$pick`, `$omit`, `$withEntries`, `$mapValues`, `$mapKeys`, `$spread`, `$lookup`, `$exists` | 11 |
| Conditional | `$default`, `$if`, `$isEmpty`, `$contains`, `$matches`, `$not`, `$coalesce`, `$equals`, `$toBool`, `$assert`, `$error` | 11 |
| JSON | `$jsonpath`, `$parse`, `$stringify`, `$keys`, `$values`, `$count`, `$flatten`, `$merge`, `$type`, `$sort`, `$reverse`, `$unique`, `$first`, `$last`, `$slice` | 15 |
| Date/Time | `$now`, `$toIso`, `$formatDate`, `$diffMs`, `$addDays`, `$addHours`, `$timestamp`, `$epoch` | 8 |
| Encoding | `$base64`, `$base64Decode`, `$urlEncode`, `$urlDecode`, `$hash` | 5 |

Lambda/closure syntax: `x => body` (single param), `(a, b) => body` (multi param), enabling higher-order function composition.

### 3.4 ExpectedField Interface

```typescript
interface ExpectedField {
  jsonPath: string;
  expectedValue: string;
  operator?: FieldOperator;      // 24 operators
  operatorValue?: string;         // operator-specific value
  negate?: boolean;               // universal negation
}
```

### 3.5 Type Mismatch Quick-Fixes

Covers pairwise coercions: `string↔number`, `string↔boolean`, `string↔array`, `string↔object`, `array↔number` (`$count`), `array↔object` (`$first`), date-like string detection. Operators that don't compare values (`exists`, `not_exists`, `is_empty`, `is_not_empty`) skip type mismatch detection.

---

## 4. Unified Mapper Architecture

### 4.1 Guiding Principle

The Visual Mapper is a **single, shared visual authoring surface** used across 10 integration contexts. All operator and expression enhancements are universally applicable — or cleanly gated behind adapter capabilities — keeping the mapper cohesive regardless of where it's embedded.

### 4.2 Adapter Inventory (10 adapters)

| Adapter | Context | Source → Target | Category |
|---|---|---|---|
| `validationAdapter` | Body validation rules | Response JSON → Expected fields | `http` |
| `extractionAdapter` | Variable extraction | Response JSON → Variable names | `http` |
| `requestBodyAdapter` | Request body building (JSON/Form/Raw) | Variables/Generators → Body template | `http` |
| `assertionAdapter` | Regex assertion | Response JSON → Regex pattern | `http` |
| `columnMappingAdapter` | Data source ↔ template | CSV columns → Request slots | `data-source` |
| `populateFromApiAdapter` | Populate data source | API response → DS columns/rows | `data-source` |
| `sharedDsFetchAdapter` | Shared data source fetch | API response → DS columns/rows | `data-source` |
| `variableBindingAdapter` | Workflow variable wiring | Upstream variables → Template slots | `workflow` |
| `webhookExtractionAdapter` | Webhook/correlation extraction | Webhook payload → Variables | `webhook` |
| `demoAdapter` | Sandbox/gallery demos | Sample API → Order summary | `custom` |

### 4.3 Where Each Adapter Is Used

| UI Location | Adapter(s) |
|---|---|
| Test Editor → Validation tab | `validationAdapter` |
| Setup Step → Validate | `validationAdapter` |
| Data Source Row Detail Modal | `validationAdapter` |
| Extraction Editor | `extractionAdapter` |
| Data Source Editor | `populateFromApiAdapter`, `columnMappingAdapter` |
| Shared Data Source Modal | `sharedDsFetchAdapter` |
| Workflow → HTTP Config | `variableBindingAdapter`, `requestBodyAdapter` |
| Workflow → Webhook Config | `webhookExtractionAdapter` |
| Workflow → Correlation Wait | `webhookExtractionAdapter` |
| Regex Assertion Builder | `assertionAdapter` |
| Gallery Samples | `demoAdapter` |

### 4.4 Capability Matrix Per Adapter

| Adapter | Operators | Array Assert | Type Check | Code Editor | Verify | Expressions | Schema Drift | Profiles |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **validationAdapter** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **extractionAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| **requestBodyAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| **columnMappingAdapter** | — | — | — | — | — | partial | — | — |
| **populateFromApiAdapter** | — | — | — | — | — | — | ✓ | — |
| **sharedDsFetchAdapter** | — | — | — | — | — | — | ✓ | — |
| **variableBindingAdapter** | — | — | — | ✓ | — | ✓ | — | ✓ |
| **webhookExtractionAdapter** | — | — | — | — | — | ✓ | — | — |
| **assertionAdapter** | ✓ | — | — | — | ✓ | — | — | — |
| **demoAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |

### 4.5 Capability Framework

```typescript
interface AdapterCapabilities {
  operators?: boolean;           // operator pills on target nodes
  arrayAssertions?: boolean;     // array assertion rows
  typeChecks?: boolean;          // type-check pills
  codeEditor?: boolean;          // code editor tab
  verification?: boolean;        // verify-all toolbar
  expressions?: boolean;         // expression editor on mappings
  schemaDrift?: boolean;         // schema drift/repair features
  profiles?: boolean;            // mapping profiles (save/load)
  unorderedArrays?: boolean;     // unordered array matching
  autoMapDefaultOperator?: FieldOperator; // default operator for auto-mapped fields
  conditionals?: boolean;        // future: conditional mapping logic
  loopConstructs?: boolean;      // future: loop/iterate constructs
  errorHandling?: boolean;       // future: error handling / fallback paths
}
```

### 4.6 Architectural Principles

1. **Capability-gated UI** — The mapper renders UI elements only when the adapter declares the capability.
2. **Adapter-provided operator sets** — Each adapter can supply its own operator vocabulary.
3. **Expression as universal escape hatch** — Every adapter supports `expression` on mappings for complex transformations.
4. **Backward compatibility** — `capabilities` is optional; adapters without it behave as before.
5. **Shared components, adapter-specific chrome** — Panels are shared; adapter-specific features injected via capability flags.
6. **Single `Mapping` type** — All adapters share the same `Mapping` interface with `operator`, `operatorValue`, `negate`.
7. **Progressive disclosure** — Simple adapters show a minimal mapper; complex adapters progressively reveal advanced features.

---

## 5. UX Design — Visual Mapper

### 5.1 Two Modes, One Model

| Mode | For Whom | How It Works |
|---|---|---|
| **Visual Mode** (default) | All users | Drag-and-drop + operator pills + inline value editing + array assertion rows |
| **Code Mode** | Engineers | Text editor with DSL syntax, autocomplete, syntax highlighting |

Both modes read and write the same `ExpectedField[]` + `Assertion[]` data with bi-directional sync.

### 5.2 Visual Mode — Operator Placement

**On Target Tree Nodes (field-level):**

```
[type-pill] fieldName  ← [operator-pill] [value-input?] sourcePath
```

Operator pill color scheme:
- Green: `= equals`
- Amber: `≥ at least`, `> greater than`, `< less than`, `≤ at most`, `↔ between`
- Purple: `⊃ contains`, `⊳ starts with`, `⊲ ends with`, `/r/ matches`
- Red: `✓ is true`, `✗ is false`
- Teal: `τ isString`, `τ isNumber`, `τ isBoolean`, `τ isArray`, `τ isObject`
- Gray: `∃ exists`, `∄ not exists`, `∅ is null`, `⊙ not empty`
- Blue: `∈ in`, `∉ not in`

**On Array Nodes (array-level):**

```
▼ [arr] offers                           6 items · 2 assertions
  ┃ LENGTH    ≥ at least  [3]                            Edit  ×
  ┃ CONTAINS  item where offerName = ["EV Access"]       Edit  ×
  ┃ EACH      rank  ≥ at least  [0]                      Edit  ×
```

**On Canvas Lines:** Mid-line operator badges (amber for comparison, purple for string, teal for type checks).

**Operator Picker Dropdown:** Searchable, grouped by category (Equality, Comparison, String, Boolean, Type, Existence, Set). Smart defaults based on field type.

### 5.3 Code Mode — DSL Editor

```
# Field assertions
offers[0].associatedOfferingCode  equals           "ONZFCNCPR3MCAL4"
offers[0].rank                    >=               1
offers[0].offerName               contains         "OnStar"
offers[0].isActive                is_true
offers[4].productCode             exists
offers[4].duration.value          between          1, 365
offers[4].rank                    NOT is_number

# Array assertions
offers                            length >=        3
offers                            contains_item    offerName = "EV Access - 8 Years"
offers[*].rank                    each >=          0
```

| Feature | Description |
|---|---|
| Syntax highlighting | Paths (cyan), operators (color-coded), values (green/amber/red), comments (gray) |
| Autocomplete | Path completion from JSON tree, operator keywords, value suggestions |
| Inline errors | Red squiggles for unknown paths, unknown operators, type mismatches |
| Bi-directional sync | Visual edits ↔ code edits, debounced 300ms, last-write-wins on conflict |
| Copy & paste | Select all + copy to back up rules; paste DSL text to restore (parser validates on the fly) |
| Validation Rules Modal | 3-mode panel (docked/floating/maximized) with DSL Reference Panel; Escape closes |

### 5.4 Verification Stage

Toolbar: `[Verify All] [Fetch & Verify] [Auto-verify ☐] 14 passed · 1 failed`

- **Verify All** — runs all rules against current sample data (field operators + DSL assertions)
- **Fetch & Verify** — sends live HTTP request, replaces sample, runs all rules
- **Auto-verify** — re-runs on change (debounced 500ms, sample data only)
- **Results** — per-node inline badges (✓/✗), array assertion badges, rules table status, canvas line colors, footer aggregates
- **DSL assertion evaluation** — the verify hook evaluates DSL-originated assertions (`arrayLength`, `typeCheck`, `existence`, `each`, `arrayContains`, `containsSubset`, `custom`) alongside field operators, so the passed/failed count matches the total DSL rule count. Non-DSL assertions (`status`, `responseTime`, `header`) are excluded (they belong to the Test Editor).
- **Filter** — target panel filter: All / Mapped / Unmapped / **Passed** / **Failed**

---

## 6. Module Architecture

The validation and Data Mapper subsystems were refactored from monolithic files (>900 lines) into focused, testable modules. All files are under 900 lines; all have >90% code coverage.

### 6.1 Validator Engine Modules

| Module | Extracted From | Exports | Purpose |
|---|---|---|---|
| `validatorDateHelpers.ts` | `validator.ts` | `resolveDate`, `toDayString`, `truncateToUnit` | Date assertion evaluation (day compare, precision truncation) |
| `validatorHttpHelpers.ts` | `validator.ts` | `matchesStatusPattern`, `getJsonTypeName`, `findHeader`, `evaluateHeaderOp` | HTTP-level assertion helpers (status patterns, header ops) |
| `validatorSubsetMatch.ts` | `validator.ts` | `deepSubsetMatch` | Recursive deep partial match for `containsSubset` + `arrayContains` |
| `validatorCustomExpression.ts` | `validator.ts` | `isTruthy`, `wrapCustomExprDollarPaths`, `DOLLAR_PATH_CHAR` | Custom `ASSERT` expression preprocessing |
| `fieldOperatorEvaluation.ts` | `validator.ts` | `evaluateFieldOperator`, `stringify`, `toNumber` | 24-operator switch with robust serialization (circular-safe) |
| `validator.ts` | — | `validate`, `evaluateAssertions`, re-exports above | Barrel module — orchestrates selective/full validation and all 16 assertion types |

### 6.2 Data Mapper Extracted Hooks

| Hook | Extracted From | Responsibility |
|---|---|---|
| `useBottomUtilityDock.ts` | `DataMapper.tsx` | Bottom dock mode toggles (preview, code, table); rules moved to `ValidationRulesModal` |
| `useDataMapperTreeInteraction.ts` | `DataMapper.tsx` | Mouse/keyboard events for tree nodes — hover, click, keyboard navigation bridge |
| `useHighlightedMappingPaths.ts` | `DataMapper.tsx` | Derives highlight sets (mapping IDs + source/target paths) from hover > focus > selection |
| `useMapperVisibleLines.ts` | `DataMapper.tsx` | Filters connection lines when "node focus" or "hide lines" modes are active |
| `useKeyboardNavigation.ts` | — (original) | Arrow keys, Tab panel switch, Home/End, proper root-node (empty path) handling |

### 6.3 Test Editor Extracted Modules

| Module | Extracted From | Exports |
|---|---|---|
| `testEditorValidationAddMenu.ts` | `TestEditorValidationTab.tsx` | `ADD_ASSERTION_MENU_ROWS` — data-driven assertion factory menu |
| `testEditorValidationPivot.ts` | `TestEditorValidationTab.tsx` | `buildPivotedRulesFromExpectedFields`, `trailingBracketArrayIndex` — pivoted rules table model |

### 6.4 Validation Rules Modal

| Component | File | Description |
|---|---|---|
| `ValidationRulesModal` | `ValidationRulesModal.tsx` | 3-mode panel (docked/floating/maximized) wrapping `ValidationCodeEditor` + `DslReferencePanel` |
| `DslReferencePanel` | `DslReferencePanel.tsx` | Searchable, categorized DSL reference (10 sections, 39 entries) with click-to-insert and copy |
| `useValidationRulesModal` | `hooks/useValidationRulesModal.ts` | Mode/resize/reference state management with localStorage persistence |
| `ValidationCodeEditor` | `ValidationCodeEditor.tsx` | Monaco-based DSL editor with syntax highlighting, autocomplete, inline error markers |

Modal features:
- **3 display modes** — docked (bottom dock, resizable), floating (draggable + resizable portal), maximized (full-screen)
- **Mode persistence** — saved to `localStorage`
- **DSL Reference Panel** — collapsible right pane with 10 categories, card-based entries, code blocks, insert + copy buttons
- **Verify stats in header** — live passed/failed/error counts after verification
- **Escape to close** — respects Monaco suggest widget (doesn't close when autocomplete is open)
- **Portal-based rendering** — portals into nearest modal overlay for correct stacking context

> **Note:** `FloatingEditorModal.tsx` was deleted and replaced by the modal's floating mode.

### 6.5 Quality Gate

> Note: Test counts below are from the last full-suite run. Re-run `npx vitest run` and `npx playwright test` before release to get current numbers.

| Metric | Value |
|---|---|
| Unit tests | 16,356+ passing |
| E2E tests | 613+ passing |
| Test files | 576+ |
| Statement coverage | >90% (all files) |
| Branch coverage | >90% (all files) |
| Function coverage | >90% (all files) |
| Monolithic files (>900 lines) | 0 |
| ESLint errors | 0 |
| TypeScript errors | 0 |

---

## 7. Competitive Benchmark — Tool Details

### 7.1 Postman (Chai.js BDD)

**Equality:** `.to.equal(val)`, `.to.eql(val)` / `.to.deep.equal(val)`, `.to.not.equal(val)`

**Type Checks:** `.to.be.a('string'/'number'/'array'/'object'/'boolean')`

**Truthiness/Nullness:** `.to.be.true`, `.to.be.false`, `.to.be.null`, `.to.be.undefined`, `.to.exist`, `.to.be.empty`

**Comparison:** `.to.be.above(n)`, `.to.be.at.least(n)`, `.to.be.below(n)`, `.to.be.at.most(n)`, `.to.be.within(min, max)`

**String/Collection:** `.to.include(val)`, `.to.have.string(str)`, `.to.match(/regex/)`, `.to.have.lengthOf(n)`, `.to.have.property(name)`, `.to.have.keys([...])`, `.to.have.members([...])`, `.to.have.deep.members([...])`, `.to.satisfy(fn)`

**Negation:** `.not` chain on any assertion

**JSON Schema:** `pm.response.to.have.jsonSchema(schema)`

### 7.2 Karate DSL

**Match Variants:** `match ==`, `match !=`, `match contains`, `match !contains`, `match contains only`, `match contains any`, `match contains deep`, `match each`, `match each contains deep`

**Type Markers:** `#string`, `#number`, `#boolean`, `#array`, `#object`, `#null`, `#notnull`, `#present`, `#notpresent`, `##string` (optional), `#uuid`, `#regex pattern`, `#? expression`, `#[N]` (array length)

### 7.3 Hurl

**Comparison:** `==`/`equals`, `!=`/`notEquals`, `>`/`greaterThan`, `>=`/`greaterThanOrEquals`, `<`/`lessThan`, `<=`/`lessThanOrEquals`

**String:** `contains`, `startsWith`, `endsWith`, `matches`/`=~`, `includes`

**Type Checks:** `isInteger`, `isFloat`, `isNumber`, `isString`, `isBoolean`, `isCollection`, `isObject`, `isList`, `isDate`, `isEmpty`

**Collection:** `count == N`, `exists`

**Hash:** `sha256 ==`, `md5 ==`

**Negation:** `not` prefix

### 7.4 Bruno

**Comparison:** `equals`, `notEquals`, `gt`, `gte`, `lt`, `lte`

**String:** `contains`, `notContains`, `startsWith`, `endsWith`, `matches`, `notMatches`

**Type Checks:** `isNumber`, `isString`, `isBoolean`, `isArray`, `isJson`, `isNull`

**Existence:** `isDefined`, `isUndefined`, `isEmpty`, `isNotEmpty`

**Other:** `isTruthy`, `isFalsy`, `in`, `notIn`, `between`, `length`

### 7.5 Other Tools

**StepCI:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `match`; type matchers; OpenAPI schema validation

**REST Assured (Hamcrest):** `equalTo()`, `not()`, `hasItems()`, `containsString()`, `greaterThan()`, `hasSize()`, `nullValue()`, `closeTo()`, `allOf()`/`anyOf()`, `everyItem()`, `matchesJsonSchemaInClasspath()`

**JMeter:** Response Assertion (`Contains`, `Matches`, `Equals`, `Substring`, `Not`, `Or`); JSON Assertion; JSON Schema Assertion; Duration Assertion; Size Assertion; BeanShell/JSR223 Assertion

**Gatling:** `is()`, `not()`, `in()`, `exists`, `notExists`, `isNull`/`notNull`, `count.is(n)`, `transform(fn).is(val)`, `validate(fn)`

**k6:** Arbitrary JavaScript checks: `check(res, { 'status is 200': (r) => r.status === 200 })`; thresholds: `rate<0.01`, `p(95)<200`

**Artillery:** Expect Plugin: `statusCode`, `contentType`, `hasProperty`, `equals`, `notEquals`, `hasHeader`, `matchesRegexp`

**Pact:** `like()`, `eachLike()`, `term()`, `boolean()`, `string()`, `integer()`, `decimal()`, `uuid()`, `iso8601Date()`, `nullValue()`

**JSON Schema:** `type`, `minimum`/`maximum`, `minLength`/`maxLength`/`pattern`/`format`, `minItems`/`maxItems`/`uniqueItems`, `required`/`properties`/`additionalProperties`, `allOf`/`anyOf`/`oneOf`/`not`/`if-then-else`, `enum`/`const`

---

## 8. Expression Function Benchmarks

### 8.1 vs JSONata

| Function | JSONata | RedfireForge |
|---|---|---|
| `$string`, `$length`, `$substring`, `$uppercase`, `$lowercase`, `$trim` | ✓ | ✓ |
| `$substringBefore`, `$substringAfter`, `$contains`, `$split`, `$join`, `$replace`, `$match` | ✓ | ✓ |
| `$base64encode`, `$base64decode`, `$encodeUrl`, `$decodeUrl` | ✓ | ✓ |
| `$number`, `$abs`, `$floor`, `$ceil`, `$round`, `$power`, `$sqrt`, `$random` | ✓ | ✓ |
| `$sum`, `$max`, `$min`, `$average` | ✓ | ✓ |
| `$count`, `$append`, `$sort`, `$reverse`, `$distinct`, `$zip` | ✓ | ✓ |
| `$map`, `$filter`, `$reduce`, `$sift`, `$each` | ✓ | ✓ |
| `$keys`, `$values`, `$spread`, `$merge`, `$lookup`, `$type` | ✓ | ✓ |
| `$exists`, `$boolean`, `$not` | ✓ | ✓ |
| `$now`, `$millis`, `$fromMillis`, `$toMillis` | ✓ | ✓ |
| `$assert`, `$error` | ✓ | ✓ |
| **Coverage** | | **100%** |

### 8.2 vs DataWeave

All core functions covered: `contains`, `endsWith`, `flatMap`, `flatten`, `groupBy`, `filter`, `map`, `mapObject`, `orderBy`, `pluck`, `reduce`, `sizeOf`, `splitBy`, `trim`, `upper`, `lower`, `replace`, `distinctBy`, `zip`.

String module functions: `capitalize` ✓, `underscore` (`$snakeCase`) ✓, `isAlpha`/`isNumeric` ✓.

### 8.3 vs jq

All major built-in filters covered: `length`, `keys`, `values`, `has`, `to_entries`/`from_entries`/`with_entries`, `map`/`select`/`reduce`, `sort_by`/`group_by`/`unique_by`/`min_by`/`max_by`, `reverse`, `contains`, `startswith`/`endswith`, `split`/`join`, `ascii_downcase`/`ascii_upcase`, `test`/`capture`/`scan`, `tostring`/`tonumber`/`type`, `any`/`all`, `flatten`, `first`/`last`.

### 8.4 Expression Gap Coverage Summary

| Category | Implemented | Total Gaps | Coverage |
|---|---|---|---|
| Array HOFs | 13 | 13 | 100% |
| String | 11 | 11 | 100% |
| Object | 8 | 8 | 100% |
| Math/Utility | 6 | 6 | 100% |
| **Total** | **38** | **38** | **100%** |

---

## 9. Gap Closure Summary

### 9.1 All 18 Gaps — Closed

| GAP | Description | Severity | Phase | Status |
|---|---|---|---|---|
| GAP-01 | ExpectedField operator support (24 operators) | Critical | P1 | ✅ |
| GAP-02 | Type-checking predicates (`typeCheck` assertion) | Critical | P2 | ✅ |
| GAP-03 | Boolean assertion (`is_true`/`is_false`) | High | P1 | ✅ |
| GAP-04 | String operators on body fields | High | P1 | ✅ |
| GAP-05 | Null/undefined/empty checks | High | P1 | ✅ |
| GAP-06 | Universal negation modifier (`negate` + `NOT` DSL) | Medium | P9.1 | ✅ |
| GAP-07 | Collection item membership (`arrayContains`) | High | P3 | ✅ |
| GAP-08 | Each/every element assertion (`each`) | High | P3 | ✅ |
| GAP-09 | JSON Schema validation (Ajv) | Medium | P6 | ✅ |
| GAP-10 | Field existence on body (`existence` assertion) | Medium | P2 | ✅ |
| GAP-11 | Deep/partial object matching (`containsSubset`) | Low | P3 | ✅ |
| GAP-12 | Response size assertion (`bodySize`) | Medium | P8 | ✅ |
| GAP-13 | In/not-in set membership (`in`/`not_in`) | Low | P1 | ✅ |
| GAP-14 | Between/range operator (`between`) | Low | P1 | ✅ |
| GAP-15 | Approximate numeric comparison (`close_to`) | Low | P1 | ✅ |
| GAP-16 | Date/time precision beyond day (`datePrecise`) | Low | P8 | ✅ |
| GAP-17 | Dual-mode authoring (visual + code DSL) | Critical | P4 | ✅ |
| GAP-18 | Integrated live validation (verify + auto-verify) | Critical | P5 | ✅ |

### 9.2 Implementation Phases

| Phase | Title | Key Deliverables | Status |
|---|---|---|---|
| P0 | Adapter Capability Framework | `AdapterCapabilities` interface, `FieldOperator` type, `resolveCapabilities()`, all 10 adapters updated | ✅ |
| P1 | Field Operator Foundation | 24 `FieldOperator` values, `evaluateFieldOperator()`, operator pills, 6 CSS color themes | ✅ |
| P2 | Type & Existence Assertions | `typeCheck` + `existence` assertion types, operator picker UI | ✅ |
| P3 | Collection & Structural Assertions | `arrayContains` (4 modes), `each`, `containsSubset`, array assertion rows | ✅ |
| P4 | Code Editor Mode | Monaco DSL editor, bi-directional sync, autocomplete, import/export | ✅ |
| P5 | Live Validation Stage | Verify All, Fetch & Verify, auto-verify toggle, per-rule inline pass/fail, failure navigation | ✅ |
| P6 | Schema Validation | `jsonSchema` assertion with Ajv, auto-generate from response, inline validation errors | ✅ |
| P7 | Expression Engine Enrichment | 25+ new functions (`$sum`, `$average`, `$groupBy`, `$has`, `$toEntries`, `$pick`, `$omit`, etc.) | ✅ |
| P8 | Nice-to-Have Operators | `bodySize`, `datePrecise`, `close_to`, `between` | ✅ |
| P9.1 | Universal Negation | `negate` on `Assertion`/`ExpectedField`/`Mapping`, `NOT` DSL keyword, red toggle badge | ✅ |
| P9.2 | Lambda Expression Syntax | Arrow-function lambdas, `LambdaValue` runtime, 25 new HOFs, comparison helpers | ✅ |
| P9.3 | Custom Predicate Functions | `custom` assertion, `ASSERT` DSL keyword, full expression engine context | ✅ |
| P9.4 | Validation Rules Modal | Console-style 3-mode modal (docked/floating/maximized) + redesigned DSL Reference Panel (10 categories, 39 entries) + verify stats in header + DSL assertion evaluation in verify hook | ✅ |

### 9.3 Key Design Decisions

- **`evaluateFieldOperator()` exported** — reusable by all adapters and live verification
- **`operatorValue` with `expectedValue` fallback** — full backward compatibility
- **Capability-gated operator picker** — renders only when adapter declares `operators: true`
- **Auto-map default operator** — validation adapter defaults to `exists`, preventing false failures on type differences
- **Lambda syntax** — `x => body` (JS-style arrows), implicit return, lexical scoping, no infix operators (use `$gt`, `$add`, etc.)
- **`ASSERT` DSL keyword** — bridges custom assertions to the expression engine: `ASSERT $gt($count($.body.items), 0), "Expected items"`

---

### 9.4 Phase 9.4: Validation Rules Modal — Console-Style Pop-Up with DSL Reference Panel

**Status:** ✅ Complete

**Goal:** Replace the current bottom-dock validation rules editor with a console-style pop-up modal (matching the Workflow Console pattern) that supports three display modes (docked/floating/maximized) and includes a collapsible DSL Reference Panel alongside the editor, so users never need to memorize syntax.

**Motivation:** The current bottom-dock implementation has two problems: (1) the editor competes for vertical space with the mapper canvas, making it hard to see both rules and mappings simultaneously; (2) users must memorize DSL syntax because there's no in-context reference. The Workflow Console already solves the layout problem with a 3-mode panel (docked/floating/full-screen). This phase applies the same pattern and adds a side-by-side DSL reference.

**Implementation Summary:**
- `ValidationRulesModal.tsx` — 3-mode panel shell (docked/floating/maximized) wrapping `ValidationCodeEditor` + `DslReferencePanel`, with verify stats (passed/failed) in header
- `DslReferencePanel.tsx` — Redesigned: 10 semantic categories (Equality, Comparison, String, Boolean & Null, Type & Existence, Set Membership, Collection, Custom Predicates, Modifiers, Syntax Guide), 40 card-based entries with descriptions, code blocks, insert + copy buttons, expand/collapse all, search with clear
- `hooks/useValidationRulesModal.ts` — Mode/resize/reference state management with localStorage persistence
- `hooks/useValidationVerify.ts` — Now evaluates DSL-originated assertions (arrayLength, typeCheck, existence, each, arrayContains, containsSubset, custom) so verify count matches total DSL rule count
- `styles/validation-rules-modal.css` — All modal + reference panel CSS (professional card-based design with category badges)
- `FloatingEditorModal.tsx` deleted — replaced by the modal's floating mode
- `BottomUtilityDock.tsx` simplified — rules branch removed; only handles code/preview/table
- `ASSERT` keyword added to Monaco Monarch tokenizer for proper syntax highlighting
- Portal renders into nearest modal overlay ancestor for correct stacking context (z-index fix)

---

#### 9.4.0 Design Philosophy

1. **Console-style 3-mode layout** — Exactly like `WorkflowConsolePanel`: docked (resizable bottom dock), floating (draggable + resizable window via `createPortal`), and maximized (full-screen, hides mapper canvas). Mode is persisted to `localStorage`.
2. **Split-pane: Editor (left) + DSL Reference (right)** — The modal body is a horizontal split. Left pane is the Monaco DSL editor (existing `ValidationCodeEditor`). Right pane is a collapsible DSL Reference Panel with categorized syntax samples.
3. **Reference panel toggle** — A "Reference" button in the header toggles the right pane. When hidden, the editor takes full width. State is persisted to `localStorage`.
4. **Click-to-insert** — Each sample in the reference panel has a copy/insert button that inserts the syntax at the editor's cursor position.
5. **Searchable reference** — A search input at the top of the reference panel filters operators/examples by keyword.

---

#### 9.4.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: [Title] [Rule count] [Search] [Reference ◀▶] [Mode ▾] [✕] │
├──────────────────────────────────────────────────────────────┤
│                          BODY                                │
│ ┌──────────────────────────┐ ┌─────────────────────────────┐ │
│ │                          │ │  DSL Reference Panel        │ │
│ │  Monaco DSL Editor       │ │  ┌─────────────────────┐    │ │
│ │  (ValidationCodeEditor)  │ │  │ 🔍 Search operators  │    │ │
│ │                          │ │  ├─────────────────────┤    │ │
│ │  path  operator  value   │ │  │ ▾ Field Assertions   │    │ │
│ │  path  operator  value   │ │  │   equals  "value"   [+]│ │ │
│ │  path  operator  value   │ │  │   contains "text"   [+]│ │ │
│ │  ...                     │ │  │   >= 5              [+]│ │ │
│ │                          │ │  │   is_true           [+]│ │ │
│ │                          │ │  │ ▾ Collection         │    │ │
│ │                          │ │  │   length >= N       [+]│ │ │
│ │                          │ │  │   each >= N         [+]│ │ │
│ │                          │ │  │ ▾ Type & Existence   │    │ │
│ │                          │ │  │ ▾ Custom Predicates  │    │ │
│ │                          │ │  │ ▾ Negation           │    │ │
│ └──────────────────────────┘ └─────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ FOOTER: Syntax hint · Ctrl+Space · Ctrl+G jump · # comments │
└──────────────────────────────────────────────────────────────┘
```

**Display Modes (matching WorkflowConsolePanel):**

| Mode | Behavior | CSS |
|---|---|---|
| **Docked** | Bottom dock inside mapper; top resize handle; 80–600px height | `vr-modal-docked` |
| **Floating** | `position: fixed` via `createPortal`; draggable header; corner + edge resize | `vr-modal-floating` |
| **Maximized** | Full mapper area; hides canvas via `:has()` selector | `vr-modal-maximized` |

**Mode selector:** `<select>` in the header (same as Workflow Console): `⬓ Bottom` / `⧉ Floating` / `⬜ Full Screen`.

---

#### 9.4.2 DSL Reference Panel — Content Specification

The reference panel is organized into 10 collapsible categories with searchable card-based entries. Each entry shows: **operator name** (color-coded), **description**, **syntax code block**, and **Insert** + **Copy** buttons. Categories have distinctive icon badges for instant visual recognition.

**Categories (10 sections, 39 entries total):**

| # | Category | Icon | Color | Entries |
|---|---|---|---|---|
| 1 | Equality | = | Green | 2 (equals, not_equals) |
| 2 | Comparison | ≶ | Amber | 6 (>, >=, <, <=, between, close_to) |
| 3 | String | Aa | Purple | 5 (contains, not_contains, starts_with, ends_with, regex) |
| 4 | Boolean & Null | ?! | Red | 6 (is_true, is_false, is_null, is_not_null, is_empty, is_not_empty) |
| 5 | Type & Existence | T | Cyan | 3 (is_type, exists, not_exists) |
| 6 | Set Membership | ∈ | Blue | 2 (in, not_in) |
| 7 | Collection | [] | Teal | 7 (length, each, contains_any, contains_all, contains_only, contains_none, subset) |
| 8 | Custom Predicates | λ | Mauve | 2 (ASSERT, ASSERT + comment) |
| 9 | Modifiers | ¬ | Red | 2 (NOT, NOT ASSERT) |
| 10 | Syntax Guide | # | Gray | 4 (comment, paths, strings, numbers) |

**Detailed content per category (for reference — actual data in `DslReferencePanel.tsx`):**

**Section 1: Equality**

| Keyword | Syntax | Example |
|---|---|---|
| `equals` / `=` | `path  equals  "value"` | `offers[0].name  equals  "Premium"` |
| `not_equals` / `!=` | `path  not_equals  "value"` | `status  !=  "inactive"` |
| `greater_than` / `>` | `path  >  number` | `offers[0].rank  >  0` |
| `greater_than_or_equal` / `>=` | `path  >=  number` | `count  >=  1` |
| `less_than` / `<` | `path  <  number` | `responseTime  <  1000` |
| `less_than_or_equal` / `<=` | `path  <=  number` | `errors.length  <=  0` |
| `contains` | `path  contains  "text"` | `name  contains  "Star"` |
| `not_contains` | `path  not_contains  "text"` | `msg  not_contains  "error"` |
| `starts_with` | `path  starts_with  "prefix"` | `code  starts_with  "ON"` |
| `ends_with` | `path  ends_with  "suffix"` | `file  ends_with  ".json"` |
| `regex` | `path  regex  "pattern"` | `email  regex  "^.+@.+$"` |
| `is_true` | `path  is_true` | `isActive  is_true` |
| `is_false` | `path  is_false` | `isDeleted  is_false` |
| `is_null` | `path  is_null` | `deletedAt  is_null` |
| `is_not_null` | `path  is_not_null` | `createdAt  is_not_null` |
| `is_empty` | `path  is_empty` | `errors  is_empty` |
| `is_not_empty` | `path  is_not_empty` | `items  is_not_empty` |
| `exists` | `path  exists` | `metadata.version  exists` |
| `not_exists` | `path  not_exists` | `_internal  not_exists` |
| `is_type` | `path  is_type  typename` | `rank  is_type  number` |
| `in` | `path  in  "a", "b", "c"` | `status  in  "active", "pending"` |
| `not_in` | `path  not_in  "a", "b"` | `role  not_in  "admin", "root"` |
| `between` | `path  between  min, max` | `price  between  10, 100` |
| `close_to` | `path  close_to  value, tolerance` | `lat  close_to  40.7, 0.1` |

**Section 2: Collection Assertions**

| Keyword | Syntax | Example |
|---|---|---|
| `length` | `path  length >=  N` | `offers  length >=  3` |
| `each` | `path[*].field  each OP  value` | `offers[*].rank  each >=  0` |
| `contains_any` | `path  contains_any  "a", "b"` | `tags  contains_any  "vip"` |
| `contains_all` | `path  contains_all  "a", "b"` | `perms  contains_all  "r", "w"` |
| `contains_only` | `path  contains_only  "a", "b"` | `flags  contains_only  "on"` |
| `contains_none` | `path  contains_none  "a"` | `list  contains_none  "banned"` |
| `subset` | `path  subset  {"key": ...}` | `meta  subset  {"v": 1}` |

**Section 3: Type & Existence Checks**

| Keyword | Syntax | Example |
|---|---|---|
| `is_type string` | `path  is_type  string` | `name  is_type  string` |
| `is_type number` | `path  is_type  number` | `count  is_type  number` |
| `is_type boolean` | `path  is_type  boolean` | `active  is_type  boolean` |
| `is_type array` | `path  is_type  array` | `items  is_type  array` |
| `is_type object` | `path  is_type  object` | `config  is_type  object` |
| `is_type null` | `path  is_type  null` | `deleted  is_type  null` |

**Section 4: Custom Predicates (ASSERT)**

| Keyword | Syntax | Example |
|---|---|---|
| `ASSERT` | `ASSERT expression` | `ASSERT $gt($.body.count, 0)` |
| `ASSERT` + desc | `ASSERT expr  // desc` | `ASSERT $gt($.body.count, 0)  // positive count` |

**Section 5: Negation (NOT prefix)**

| Keyword | Syntax | Example |
|---|---|---|
| `NOT` | `path  NOT operator  value` | `status  NOT is_null` |
| `NOT ASSERT` | `NOT ASSERT expression` | `NOT ASSERT $isEmpty($.body)` |

**Section 6: Syntax Reference**

| Element | Syntax |
|---|---|
| Comments | `# This is a comment` |
| Paths | `field`, `obj.field`, `arr[0].field`, `arr[*].field` |
| String values | `"double quoted"` |
| Numeric values | `42`, `3.14`, `-1` |
| Boolean values | `true`, `false` |
| Comma lists | `"a", "b", "c"` (for `in`, `not_in`) |
| Ranges | `min, max` (for `between`) |

---

#### 9.4.3 Implementation Steps

**Step 1: Create `ValidationRulesModal.tsx` (L)**

New file: `src/shared/components/data-mapper/ValidationRulesModal.tsx`

1. Implement 3-mode panel (docked/floating/maximized) matching `WorkflowConsolePanel` pattern:
   - `mode` state: `'docked' | 'floating' | 'maximized'`
   - Docked: resizable bottom dock (min 80px, max 600px, default 260px)
   - Floating: `createPortal(document.body)`, draggable header, corner resize grip, right-edge resize
   - Maximized: flex:1, hide mapper canvas via `:has()` CSS
   - Mode persisted to `localStorage` key `vr-modal-default-mode`
2. Header bar with: title, rule/error counts, Search toggle, Reference toggle, mode `<select>`, close button
3. Body: horizontal split — left pane (Monaco editor), right pane (DSL Reference, collapsible)
4. Footer: syntax hint bar (same as current `ValidationCodeEditor` footer)
5. Props: same as current `ValidationCodeEditor` + `onClose`, `referenceVisible?`

**Step 2: Create `DslReferencePanel.tsx` (M)**

New file: `src/shared/components/data-mapper/DslReferencePanel.tsx`

1. Searchable, categorized DSL reference from section 9.4.2 above
2. Collapsible sections (accordion): Field, Collection, Type/Existence, Custom, Negation, Syntax
3. Each entry: keyword (monospace, color-coded), syntax template, example, `[+]` insert button
4. Search input filters entries across all sections by keyword/syntax/example
5. Click-to-insert callback: `onInsert(text: string)` — inserts at Monaco cursor position
6. Responsive: in docked mode (narrow), sections use compact layout; in floating/maximized, full layout

**Step 3: Create `hooks/useValidationRulesModal.ts` (S)**

New hook for modal state management:
- `mode`, `setMode` with localStorage persistence
- `referenceVisible`, `toggleReference` with localStorage persistence
- `dockedHeight` with resize logic
- `floatPos`, `floatSize` with drag/resize handlers
- Mirrors `WorkflowConsolePanel` state management

**Step 4: Update `DataMapper.tsx` Integration (M)**

1. Replace `BottomUtilityDock` rules rendering with `ValidationRulesModal`
2. Replace `FloatingEditorModal` usage with the new modal's floating mode
3. Remove `rulesFloating` state from `useBottomUtilityDock` (modal handles its own modes)
4. The "Rules" toolbar button now toggles `ValidationRulesModal` visibility (not bottom dock mode)
5. When rules modal is in docked mode, it renders inside the mapper layout (same position as before)
6. When floating/maximized, it renders via `createPortal`

**Step 5: Add CSS Styles (M)**

File: `src/styles/validation-rules-modal.css`

1. `.vr-modal-panel` base styles (flex column, dark theme matching mapper)
2. `.vr-modal-docked` — bottom dock within mapper, resize handle top
3. `.vr-modal-floating` — fixed position, z-index 100, box-shadow, rounded corners
4. `.vr-modal-maximized` — flex:1, `:has()` rule to hide `.dm-body`
5. `.vr-modal-header` — header bar (matches `wf-console-header` style)
6. `.vr-modal-body` — horizontal flexbox (editor left, reference right)
7. `.vr-modal-split` — CSS grid or flex with configurable split ratio
8. `.vr-reference-panel` — right pane styles (scrollable, collapsible sections)
9. `.vr-reference-search` — search input styling
10. `.vr-reference-section` — accordion sections with expand/collapse
11. `.vr-reference-entry` — individual entry with keyword, syntax, example, insert button
12. `.vr-reference-insert-btn` — insert button hover states
13. Transition animations for reference panel show/hide (width transition)

**Step 6: Unit Tests (M)**

1. `ValidationRulesModal.test.tsx` — mode switching, reference toggle, resize, close
2. `DslReferencePanel.test.tsx` — search filtering, section collapse/expand, insert callback, all entries render
3. `useValidationRulesModal.test.ts` — localStorage persistence, mode/reference state

**Step 7: Update Existing Tests (S)**

1. Update `DataMapper.test.tsx` — rules modal replaces bottom dock rules mode
2. Update any E2E tests that reference the old bottom dock rules tab

**Step 8: TypeScript Check & Verification (S)**

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Visual verification of all 3 modes + reference panel

---

#### 9.4.4 Deliverable Criteria

- [x] 3-mode panel (docked/floating/maximized) with mode selector in header
- [x] Mode persisted to localStorage
- [x] Docked mode: resizable via top drag handle (80–600px)
- [x] Floating mode: draggable header, corner resize grip, right-edge resize
- [x] Maximized mode: fills mapper area
- [x] DSL Reference Panel with 10 categories, 40 card-based entries (redesigned from original 6 sections)
- [x] Reference panel toggle (show/hide) with state persisted to localStorage
- [x] Search input with clear button, filters across all sections (keyword, description, syntax, example)
- [x] Click-to-insert from reference entries into Monaco editor at cursor
- [x] Copy syntax button on each entry
- [x] Expand all / Collapse all buttons in reference header
- [x] Category icon badges (=, ≶, Aa, ?!, T, ∈, [], λ, ¬, #) with color-coding
- [x] Reference entries are color-coded matching the DSL syntax highlighting theme
- [x] Bi-directional sync preserved (no regression from current `useValidationCodeSync`)
- [x] All existing ValidationCodeEditor features preserved (autocomplete, error markers, path hints, Ctrl+G)
- [x] Keyboard shortcut: Escape closes the modal (respects Monaco suggest widget)
- [x] Verify stats (passed/failed) displayed in modal header when verification is complete
- [x] DSL assertions (arrayLength, typeCheck, existence, etc.) evaluated in verify hook — count matches total DSL rules
- [x] Portal renders into nearest modal overlay for correct stacking context (z-index fix)
- [x] Unit tests for modal, reference panel, and hook
- [x] E2E tests for z-index, mode switching, reference panel toggle
- [x] TypeScript zero errors

---

#### 9.4.5 Risk Assessment

| Risk | Mitigation | Outcome |
|---|---|---|
| Monaco editor resize issues in mode transitions | Use `automaticLayout: true` + force `editor.layout()` on mode change | Resolved |
| Reference panel competes for width in narrow viewports | Reference panel is collapsible via toggle button | Resolved |
| Bi-directional sync regression | Reuse existing `useValidationCodeSync` unchanged; modal is a pure UI wrapper | No regression |
| Floating mode z-index conflicts with other modals | **Realized.** Fixed by portaling into nearest modal overlay ancestor (`.dm-modal-overlay` or `.modal-overlay`) instead of `document.body`, so the panel participates in the correct stacking context. Diagnosed via Playwright `elementFromPoint` tests. | Resolved |

---

> **Future Roadmap** has been moved to [`long-term-enhancement-plan.md`](./long-term-enhancement-plan.md) § 9.

---

## 10. References

### Commercial Tools
- Postman: https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-examples
- Chai.js: https://www.chaijs.com/api/bdd/
- Karate DSL: https://docs.karatelabs.io/api-reference/keywords
- REST Assured: https://github.com/rest-assured/rest-assured/wiki/Usage
- k6: https://grafana.com/docs/k6/latest/using-k6/assertions
- Gatling: https://docs.gatling.io/concepts/checks/
- Artillery: https://artillery.io/docs/reference/extensions/expect
- JMeter: https://jmeter.apache.org/usermanual/regular_expressions.html

### Open-Source Tools
- Hurl: https://hurl.dev/docs/asserting-response.html
- Bruno: https://docs.usebruno.com/testing/tests/assertions
- StepCI: https://docs.stepci.com/reference/matchers.html
- Pact: https://docs.pact.io/implementation_guides/javascript/docs/matching

### Transformation Languages
- JSONata: https://docs.jsonata.org/overview.html
- MuleSoft DataWeave: https://docs.mulesoft.com/dataweave/latest/dw-operators
- jq: https://jqlang.org/manual

### Standards
- JSON Schema: https://json-schema.org/understanding-json-schema/keywords
