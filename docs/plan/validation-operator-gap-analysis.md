# Validation & Assertion Operator Gap Analysis

> Date: 2026-05-13
> Purpose: Identify missing operators, assertion types, and transformation functions by benchmarking RedfireForge against commercial and open-source API testing / data mapping tools.

---

## Executive Summary

RedfireForge has a solid foundation — 7 assertion types, a 69-function expression engine, type-mismatch detection with auto-fix suggestions, and both ordered/unordered array validation. However, comparing against 16 industry tools reveals **significant gaps in field-level assertion operators, type-checking predicates, collection predicates, and validation adapter expressiveness**. The Visual Mapper currently produces only exact-match `ExpectedField` entries with no operator support, forcing users back to the manual assertions panel for anything beyond equality.

Additionally, **professional engineers need a code-first authoring path** — tools like Postman (JavaScript), Karate (Gherkin DSL), Hurl (text DSL), and k6 (JavaScript) all let power users write validation rules as code. RedfireForge currently has no code editor for validation rules. The system also lacks an **integrated live validation stage** that verifies all rules (field operators, array assertions, type checks) against a real or sample response directly within the mapper context.

**Architectural mandate:** The Visual Mapper is a **unified tool** used across 11+ integration contexts (validation, extraction, body building, variable binding, column mapping, webhook extraction, etc.). All operator and expression enhancements must be designed as **capability-gated modules** within a universal adapter framework — ensuring the mapper scales to future functions (GraphQL, gRPC, database, AI prompts, conditional logic, loop constructs) without fragmenting into separate tools per context.

### Key Findings

| Gap Category | Severity | Tools That Have It | RedfireForge Status |
|---|---|---|---|
| Field-level comparison operators (>, <, contains, etc.) on `ExpectedField` | **Critical** | All 16 tools | Missing — exact match only |
| Type-checking predicates (isString, isNumber, isBoolean, isNull) | **Critical** | Hurl, Bruno, StepCI, Karate, Pact, JSON Schema | Missing |
| Dual-mode authoring (visual UI + code/DSL editor) | **Critical** | Postman, Karate, Hurl, k6, JMeter, REST Assured | Missing — visual only |
| Live validation / verify-all-rules stage | **Critical** | Postman, Karate, Hurl, Bruno, REST Assured, JMeter | Partial — only in Test Editor, not in mapper |
| Boolean assertion (is true / is false) | **High** | Postman, Hurl, Bruno, Karate, Chai.js | Missing |
| String operators (contains, startsWith, endsWith, notContains) | **High** | 14 of 16 tools | Only in header assertions + expressions |
| Null/undefined/empty checks | **High** | 13 of 16 tools | Missing from assertions |
| Collection predicates (count, contains item, contains any/all) | **High** | Karate, Hurl, Postman, Bruno, Gatling | Only arrayLength exists |
| Negation modifier (NOT any assertion) | **Medium** | Hurl, Karate, Postman, JMeter | Missing |
| Schema/structure validation (JSON Schema) | **Medium** | Postman, Pact, StepCI, Karate | Missing |
| Existence check (field exists / not exists) | **Medium** | Hurl, Bruno, StepCI, Karate, Postman | Only for headers |
| Between/range operator | **Low** | Bruno, JSON Schema (min+max) | Missing |
| In/not-in set membership | **Low** | Bruno, StepCI, JSONata, Karate (within) | Missing |
| Deep/partial object matching | **Low** | Karate, Postman (deep.equal) | Missing |

---

## Part 0: Unified Mapper Architecture — Design for Universal Reuse

### Guiding Principle

The Visual Mapper is **not** a validation-only tool. It is the **single, shared visual authoring surface** used across 11+ integration points in RedfireForge today. Every operator, expression function, and UX enhancement designed in this document must be universally applicable — or cleanly gated behind adapter capabilities — so the mapper remains a cohesive, unified experience regardless of where it's embedded.

### Current Integration Inventory (11 adapters)

| Adapter | Context | Source → Target | Category |
|---|---|---|---|
| `validationAdapter` | Body validation rules | Response JSON → Expected fields | `http` |
| `extractionAdapter` | Variable extraction | Response JSON → Variable names | `http` |
| `requestBodyAdapter` | Request body building | Variables/Generators → JSON body | `http` |
| `assertionAdapter` | Regex assertion (internal) | Response JSON → Regex pattern | `http` |
| `columnMappingAdapter` | Data source ↔ template | CSV columns → Request slots | `data-source` |
| `populateFromApiAdapter` | Populate data source | API response → DS columns/rows | `data-source` |
| `sharedDsFetchAdapter` | Shared data source fetch | API response → DS columns/rows | `data-source` |
| `variableBindingAdapter` | Workflow variable wiring | Upstream variables → Template slots | `workflow` |
| `webhookExtractionAdapter` | Webhook/correlation extraction | Webhook payload → Variables | `webhook` |
| `requestBodyAdapter` (Form) | Form body building | Variables → Form key/value pairs | `http` |
| `demoAdapter` | Sandbox/gallery demos | Sample API → Order summary | `custom` |

### Where Each Adapter Is Used in the UI

| UI Location | Adapter(s) Used |
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
| Regex Assertion Builder | `assertionAdapter` (indirect) |
| Gallery Samples | `demoAdapter` |

### Universal Operator Framework Design

The operator system (pills, code editor, verify stage) should be **modular** — each adapter declares which operator capabilities it supports:

```typescript
interface MapperAdapter<TOutput = unknown> {
  // Existing fields ...
  contextId: string;
  title: string;
  sources: MapperSource[];
  target: MapperTarget;
  serialize(mappings: Mapping[]): TOutput;
  deserialize(existing: TOutput): Mapping[];

  // NEW: Operator capability flags
  capabilities?: {
    /** Show operator pills on target nodes (validation, assertion) */
    operators?: boolean;
    /** Show array assertion rows (validation) */
    arrayAssertions?: boolean;
    /** Show type-check pills (validation) */
    typeChecks?: boolean;
    /** Enable code editor tab in bottom dock */
    codeEditor?: boolean;
    /** Enable verify-all toolbar (validation) */
    verification?: boolean;
    /** Enable expression editor on mappings (all adapters) */
    expressions?: boolean;
    /** Enable schema drift/repair features */
    schemaDrift?: boolean;
    /** Enable mapping profiles (save/load presets) */
    profiles?: boolean;
    /** Future: enable conditional mapping logic */
    conditionals?: boolean;
    /** Future: enable loop/iterate constructs */
    loopConstructs?: boolean;
    /** Future: enable error handling / fallback paths */
    errorHandling?: boolean;
  };
}
```

### Capability Matrix Per Adapter (Current + Planned)

| Adapter | Operators | Array Assert | Type Check | Code Editor | Verify | Expressions | Schema Drift | Profiles |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **validationAdapter** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **extractionAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| **requestBodyAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| **columnMappingAdapter** | — | — | — | — | — | partial | — | — |
| **populateFromApiAdapter** | — | — | — | — | — | planned | ✓ | — |
| **sharedDsFetchAdapter** | — | — | — | — | — | planned | ✓ | — |
| **variableBindingAdapter** | — | — | — | ✓ | — | ✓ | — | ✓ |
| **webhookExtractionAdapter** | — | — | — | — | — | ✓ | — | — |
| **assertionAdapter** | ✓ | — | — | — | ✓ | — | — | — |
| **demoAdapter** | — | — | — | ✓ | — | ✓ | ✓ | ✓ |

### Future Functions & Adapter Expansion Roadmap

Beyond validation operators, the unified mapper framework should anticipate these **future use cases**:

#### Near-Term (6 months)

| Future Function | Adapters Benefiting | Design Impact |
|---|---|---|
| **Conditional mappings** — map field A only if condition X | All adapters | Add `condition?: string` to `Mapping` type; UI shows conditional badge |
| **Loop/iterate** — for-each over arrays to produce multiple outputs | `requestBody`, `extraction`, `populate` | Loop node in target tree; expression iterates source array |
| **Default values / fallback** — use literal if source path is empty | `extraction`, `variableBinding`, `requestBody` | `fallback?: string` on `Mapping`; UI shows fallback pill |
| **Multi-source merge** — combine fields from 2+ sources into one target | `variableBinding`, `requestBody` | Already supported via multi-source tabs; extend expression UI |
| **Type coercion declarations** — explicit toString/toNumber/toBoolean | All adapters | Type coercion pill (distinct from type-check assertion) |
| **Expression templates** — reusable named expressions across adapters | All adapters | Expression library panel; import/export named snippets |

#### Mid-Term (6-12 months)

| Future Function | Adapters Benefiting | Design Impact |
|---|---|---|
| **GraphQL field selection** — visual field picker for GraphQL queries | New adapter: `graphqlAdapter` | Target tree = GraphQL schema; source = response fields |
| **Database mapper** — map query results to variables | New adapter: `dbResultAdapter` | Source = SQL result set; target = variables or assertions |
| **AI/LLM prompt template** — map variables into prompt placeholders | New adapter: `promptAdapter` | Source = context vars; target = prompt template slots |
| **gRPC/protobuf mapping** — map .proto fields to/from JSON | New adapter: `grpcAdapter` | Target tree built from .proto schema |
| **WebSocket message mapping** — extract from WS frames | New adapter: `wsExtractionAdapter` | Similar to webhook extraction but for WS |
| **File content mapping** — CSV/XML/YAML to JSON mapping | New adapter: `fileFormatAdapter` | Source tree adapts to non-JSON formats |

#### Long-Term (12+ months)

| Future Function | Adapters Benefiting | Design Impact |
|---|---|---|
| **Data flow visualization** — trace data flow across workflow steps | All workflow adapters | Canvas shows end-to-end data lineage |
| **Schema evolution tracking** — track how APIs evolve over time | All HTTP adapters | Time-series schema diff; migration suggestions |
| **AI-assisted mapping** — suggest mappings using LLM | All adapters | "Suggest" button in toolbar; ranked mapping proposals |
| **Custom operator plugins** — user-defined operators | `validationAdapter` | Plugin registration API; UI shows custom operators in picker |
| **Cross-adapter references** — one adapter's output feeds another | Workflow chains | Inter-adapter dependency graph; cascading updates |

### Architectural Principles for Extensibility

1. **Capability-gated UI** — The mapper shell (`DataMapper.tsx`) renders UI elements only when the adapter declares the capability. Operators, array assertions, code editor, and verify toolbar all hide gracefully for adapters that don't need them.

2. **Adapter-provided operator sets** — Each adapter can supply its own operator vocabulary. The validation adapter provides comparison/string/type operators. A future database adapter might provide SQL-specific operators. The operator picker is data-driven, not hard-coded.

3. **Expression as the universal escape hatch** — Every adapter supports `expression` on mappings for complex transformations. The expression engine is the single unifying language across all contexts.

4. **Backward compatibility** — Adding `capabilities` is optional; adapters without it behave exactly as they do today. No existing integration breaks.

5. **Shared components, adapter-specific chrome** — Panels (source, target, canvas, toolbar) are shared. Adapter-specific features (e.g., validation verify, body template sync) are injected via capability flags and adapter callbacks.

6. **Single `Mapping` type** — All adapters share the same `Mapping` interface. Operator metadata attaches to mappings (via `operator?: FieldOperator` + `operatorValue?: string`), not to adapter-specific types. Each adapter's `serialize()` decides what to do with operator data.

7. **Progressive disclosure** — Simple adapters (column mapping, variable binding) show a minimal mapper. Complex adapters (validation, body builder) progressively reveal code editor, verification, schema drift, and profiles as the user needs them.

---

## Part 1: Current RedfireForge Inventory

### 1.1 Assertion Types (`Assertion` union)

| Type | Parameters | Operators | Notes |
|---|---|---|---|
| `status` | `expected: string` | Pattern matching: exact, range (200-299), class (2xx), comma-separated | Good coverage |
| `responseTime` | `maxMs: number` | `<=` only (implicit) | No min threshold |
| `header` | `name`, `operator`, `value?` | `equals`, `contains`, `regex`, `exists` | Only for headers, not body fields |
| `regex` | `jsonPath`, `pattern` | Full RegExp match on stringified value | No partial match mode |
| `arrayLength` | `jsonPath`, `operator`, `value` | `=`, `!=`, `>`, `>=`, `<`, `<=` | Good — but only counts length |
| `numeric` | `jsonPath`, `operator`, `value` | `=`, `!=`, `>`, `>=`, `<`, `<=` | Coerces with `Number()` |
| `date` | `jsonPath`, `operator`, `reference` | `=`, `!=`, `>`, `>=`, `<`, `<=` | Day-level only, no time precision |

### 1.2 `ExpectedField` (Body Validation)

```typescript
interface ExpectedField {
  jsonPath: string;
  expectedValue: string;
  // NO operator field — always exact equality via JSON.stringify comparison
}
```

**This is the core gap.** The Visual Mapper, SetupStepValidate, and selective validation all route through `ExpectedField[]`, which only supports exact string match.

### 1.3 Expression Functions (69 functions)

| Category | Functions | Count |
|---|---|---|
| String | `$upper`, `$lower`, `$trim`, `$length`, `$concat`, `$substring`, `$replace`, `$split`, `$join`, `$startsWith`, `$endsWith`, `$padStart`, `$padEnd`, `$repeat`, `$indexOf`, `$toString` | 16 |
| Math | `$add`, `$subtract`, `$multiply`, `$divide`, `$round`, `$abs`, `$min`, `$max`, `$mod`, `$floor`, `$ceil`, `$power`, `$random`, `$parseInt`, `$toInt`, `$parseFloat` | 16 |
| Conditional | `$default`, `$if`, `$isEmpty`, `$contains`, `$matches`, `$not`, `$coalesce`, `$equals`, `$toBool` | 9 |
| JSON | `$jsonpath`, `$parse`, `$stringify`, `$keys`, `$values`, `$count`, `$flatten`, `$merge`, `$type`, `$sort`, `$reverse`, `$unique`, `$first`, `$last`, `$slice` | 15 |
| Date/Time | `$now`, `$toIso`, `$formatDate`, `$diffMs`, `$addDays`, `$addHours`, `$timestamp`, `$epoch` | 8 |
| Encoding | `$base64`, `$base64Decode`, `$urlEncode`, `$urlDecode`, `$hash` | 5 |

### 1.4 Type Mismatch Quick-Fixes

Covers pairwise coercions: `string↔number`, `string↔boolean`, `string↔array`, `string↔object`, `array↔number` (`$count`), `array↔object` (`$first`), etc. Date-like string detection exists.

---

## Part 2: Competitive Benchmark — Assertion & Validation Operators

### 2.1 Postman (Chai.js BDD)

Postman uses the full Chai.js assertion library, offering the richest operator set of any API client:

**Equality:**
- `.to.equal(val)` — strict equality
- `.to.eql(val)` / `.to.deep.equal(val)` — deep structural equality
- `.to.not.equal(val)` — negated

**Type Checks:**
- `.to.be.a('string')` / `.to.be.a('number')` / `.to.be.a('array')` / `.to.be.a('object')` / `.to.be.a('boolean')`
- `.to.be.an('array')`

**Truthiness/Nullness:**
- `.to.be.true` / `.to.be.false`
- `.to.be.null` / `.to.be.undefined`
- `.to.exist` / `.to.not.exist`
- `.to.be.empty` / `.to.not.be.empty`

**Comparison:**
- `.to.be.above(n)` / `.to.be.gt(n)` — greater than
- `.to.be.at.least(n)` / `.to.be.gte(n)` — greater than or equal
- `.to.be.below(n)` / `.to.be.lt(n)` — less than
- `.to.be.at.most(n)` / `.to.be.lte(n)` — less than or equal
- `.to.be.within(min, max)` — range check

**String/Collection:**
- `.to.include(val)` / `.to.contain(val)` — substring or array item
- `.to.have.string(str)` — string contains
- `.to.match(/regex/)` — regex match
- `.to.have.lengthOf(n)` — length check
- `.to.have.property(name, [value])` — property existence + optional value
- `.to.have.keys([...])` / `.to.have.any.keys([...])`
- `.to.have.members([...])` / `.to.include.members([...])`
- `.to.have.deep.members([...])` — unordered deep array comparison
- `.to.satisfy(fn)` — custom predicate function

**Negation:** Any assertion can be negated with `.not`

**JSON Schema:** `pm.response.to.have.jsonSchema(schema)`

### 2.2 Karate DSL

Karate has the most expressive structural matching:

**Match Variants:**
- `match == ` — exact equality
- `match != ` — not equals
- `match contains` — subset/partial match
- `match !contains` — does not contain
- `match contains only` — exact set (any order)
- `match contains any` — at least one match
- `match contains deep` — recursive partial match
- `match contains only deep` — exact set, deep comparison
- `match each` — validate every array element
- `match each contains deep` — each element deep-partial

**Type Markers (Schema Validation):**
- `#string` — must be string
- `#number` — must be number
- `#boolean` — must be boolean
- `#array` — must be array
- `#object` — must be object
- `#null` — must be null
- `#notnull` — must not be null
- `#present` — field must exist
- `#notpresent` — field must not exist
- `##string` — optional string (field may be absent)
- `#uuid` — UUID format
- `#regex pattern` — regex match
- `#? expression` — custom JavaScript predicate
- `#[N]` — array of length N
- `#[]` — array (any length)

**Comparison:** `assert response.count > 0` (JavaScript expression)

### 2.3 Hurl

Hurl has the cleanest predicate DSL among all tools:

**Comparison Predicates:**
- `==` / `equals` — equality
- `!=` / `notEquals` — inequality
- `>` / `greaterThan`
- `>=` / `greaterThanOrEquals`
- `<` / `lessThan`
- `<=` / `lessThanOrEquals`

**String Predicates:**
- `contains` — substring
- `startsWith` — prefix
- `endsWith` — suffix
- `matches` / `=~` — regex
- `includes` — includes value

**Type-Checking Predicates:**
- `isInteger`
- `isFloat`
- `isNumber`
- `isString`
- `isBoolean`
- `isCollection`
- `isObject`
- `isList`
- `isDate`
- `isEmpty`

**Collection Predicates:**
- `count == N` / `count > N` / `count >= N` / `count < N` / `count <= N` / `count != N`
- `exists` — value exists

**Negation:** `not` prefix inverts any predicate

**Hash/Integrity:**
- `sha256 ==` — SHA-256 hash comparison
- `md5 ==` — MD5 hash comparison

### 2.4 Bruno

Bruno has the most comprehensive no-code assertion set:

**Comparison:** `equals`, `notEquals`, `gt`, `gte`, `lt`, `lte`

**String:** `contains`, `notContains`, `startsWith`, `endsWith`, `matches`, `notMatches`

**Type Checks:** `isNumber`, `isString`, `isBoolean`, `isArray`, `isJson`, `isNull`

**Existence:** `isDefined`, `isUndefined`, `isEmpty`, `isNotEmpty`

**Truthiness:** `isTruthy`, `isFalsy`

**Set Membership:** `in`, `notIn`

**Range:** `between`

**Collection:** `length`

### 2.5 StepCI

**Matchers:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `match` (regex)

**Type Checks:** `isNumber`, `isString`, `isBoolean`, `isNull`, `isDefined`, `isObject`, `isArray`

**Schema:** OpenAPI schema validation support

### 2.6 REST Assured (Hamcrest Matchers)

**Core Matchers:**
- `equalTo()` / `not(equalTo())`
- `is()` / `not()`
- `hasItems()` / `hasItem()` / `contains()` / `containsInAnyOrder()`
- `containsString()` / `startsWith()` / `endsWith()`
- `greaterThan()` / `greaterThanOrEqualTo()` / `lessThan()` / `lessThanOrEqualTo()`
- `hasSize()` — collection size
- `hasKey()` / `hasValue()` / `hasEntry()`
- `nullValue()` / `notNullValue()`
- `instanceOf(Class)` — type check
- `blankOrNullString()` / `emptyString()` / `emptyOrNullString()`
- `closeTo(value, delta)` — approximate numeric comparison
- `allOf()` / `anyOf()` — composite matchers
- `everyItem(matcher)` — array element matching

**JSON Schema:** `matchesJsonSchemaInClasspath()`

### 2.7 JMeter

**Response Assertion Patterns:**
- `Contains` — regex partial match
- `Matches` — regex full match
- `Equals` — exact string equality
- `Substring` — non-regex contains
- `Not` — negate any of the above
- `Or` — match any (instead of all)

**Other Assertion Types:**
- JSON Assertion (JSONPath + expected value/regex)
- JSON Schema Assertion
- Duration Assertion (response time)
- Size Assertion (response size in bytes)
- XML Assertion / XPath Assertion
- Compare Assertion (compare two sample results)
- BeanShell/JSR223 Assertion (custom script)

### 2.8 Gatling

**Check Validators:**
- `is(expected)` — equality
- `not(expected)` — inequality
- `in(values...)` — set membership
- `exists` — value present
- `notExists` — value absent
- `isNull` / `notNull`
- `count.is(n)` / `count.gt(n)` / `count.gte(n)` / `count.lt(n)` / `count.lte(n)`
- `transform(fn).is(val)` — transform then validate
- Custom `validate(fn)` — arbitrary logic

### 2.9 k6

**Checks** — arbitrary JavaScript boolean expressions:
- `check(res, { 'status is 200': (r) => r.status === 200 })`
- Supports all JavaScript operators including `===`, `!==`, `>`, `<`, `includes()`, `match()`, etc.

**Thresholds** — metric-level aggregations:
- `rate<0.01` (error rate)
- `p(95)<200` (percentile)
- `avg<300` (average)

### 2.10 Artillery

**Expect Plugin:**
- `statusCode` — status check
- `contentType` — content type check
- `hasProperty` — property existence
- `equals` — equality
- `notEquals` — inequality
- `hasHeader` — header existence
- `matchesRegexp` — regex match
- `cdnHit` — CDN hit check

### 2.11 Pact (Contract Testing)

**Matchers:**
- `like(example)` / `somethingLike(example)` — type-based matching
- `eachLike(example, { min })` — array with type matching + min length
- `term({ generate, matcher })` — regex matching with example generation
- `boolean()`, `string()`, `integer()`, `decimal()` — type matchers
- `uuid()`, `ipv4Address()`, `ipv6Address()`, `email()` — format matchers
- `iso8601Date()`, `iso8601DateTime()`, `iso8601DateTimeWithMillis()`, `rfc3339Timestamp()` — date format matchers
- `hexadecimal()` — hex string matcher
- `nullValue()` — null matcher
- `atLeastOneLike(example)` / `atMostLike(example, max)` — array length bounds

### 2.12 JSON Schema (Industry Standard)

**Type:** `type` keyword — `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`

**Numeric:** `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`

**String:** `minLength`, `maxLength`, `pattern` (regex), `format` (email, date, uri, uuid, etc.)

**Array:** `minItems`, `maxItems`, `uniqueItems`, `items`, `contains`, `minContains`, `maxContains`

**Object:** `required`, `properties`, `additionalProperties`, `minProperties`, `maxProperties`, `patternProperties`, `propertyNames`

**Composition:** `allOf`, `anyOf`, `oneOf`, `not`, `if/then/else`

**Constant:** `enum`, `const`

---

## Part 3: Competitive Benchmark — Transformation & Expression Functions

### 3.1 JSONata

**String:** `$string`, `$length`, `$substring`, `$substringBefore`, `$substringAfter`, `$uppercase`, `$lowercase`, `$trim`, `$pad`, `$contains`, `$split`, `$join`, `$replace`, `$match`, `$base64encode`, `$base64decode`, `$encodeUrl`, `$encodeUrlComponent`, `$decodeUrl`, `$decodeUrlComponent`, `$eval`

**Numeric:** `$number`, `$abs`, `$floor`, `$ceil`, `$round`, `$power`, `$sqrt`, `$random`, `$sum`, `$max`, `$min`, `$average`

**Boolean:** `$boolean`, `$not`, `$exists`

**Array:** `$count`, `$append`, `$sort`, `$reverse`, `$shuffle`, `$distinct`, `$zip`, `$reduce`, `$map`, `$filter`, `$sift`, `$each`

**Object:** `$keys`, `$values`, `$spread`, `$merge`, `$lookup`, `$type`, `$error`, `$assert`

**Date/Time:** `$now`, `$millis`, `$fromMillis`, `$toMillis`

**Higher-Order:** `$map`, `$filter`, `$reduce`, `$sift`, `$each`, `$single`, `$sort` (with comparator)

**Missing in RedfireForge vs JSONata:**
- `$sqrt` — square root
- `$sum` — array sum
- `$average` — array average
- `$map` / `$filter` / `$reduce` — higher-order array ops
- `$distinct` — deduplicate
- `$zip` — zip arrays
- `$spread` — object to array of single-key objects
- `$lookup` — object as lookup table
- `$substringBefore` / `$substringAfter`
- `$exists` — existence check
- `$assert` / `$error` — runtime assertion/error throwing

### 3.2 MuleSoft DataWeave

**Core Operators:** `++` (concat), `--` (remove), `~=` (coercing equality), `match/case` (pattern matching)

**Core Functions:** `contains`, `endsWith`, `find`, `flatMap`, `flatten`, `groupBy`, `indexOf`, `isEmpty`, `filter`, `map`, `mapObject`, `orderBy`, `pluck`, `reduce`, `sizeOf`, `splitBy`, `trim`, `upper`, `lower`, `replace`, `distinctBy`, `zip`, `unzip`

**String Module:** `appendIfMissing`, `prependIfMissing`, `camelize`, `capitalize`, `dasherize`, `underscore`, `charCode`, `fromCharCode`, `collapse`, `isAlpha`, `isNumeric`, `isUpperCase`, `isLowerCase`, `leftPad`, `rightPad`, `repeat`, `substringBefore`, `substringAfter`, `substringBeforeLast`, `substringAfterLast`, `pluralize`, `singularize`, `ordinalize`, `wrapIfMissing`, `wrapWith`

**Numbers Module:** `isDecimal`, `isEven`, `isInteger`, `isOdd`, `toHex`, `fromHex`, `toBinary`, `fromBinary`

**Missing in RedfireForge vs DataWeave:**
- `$groupBy` — group array by key
- `$mapObject` — transform object entries
- `$pluck` — extract values by key transformation
- `$orderBy` — sort by expression
- `$sizeOf` — universal size (string length, array length, object key count)
- `$distinctBy` — deduplicate by expression
- `$find` / `$findAll` — search within string/array
- String utilities: `camelize`, `capitalize`, `dasherize`, `underscore`, `isAlpha`, `isNumeric`

### 3.3 jq

**Built-in Filters:** `length`, `keys`, `keys_unsorted`, `values`, `has(key)`, `in(obj)`, `getpath`, `setpath`, `delpaths`, `to_entries`, `from_entries`, `with_entries`, `map`, `map_values`, `select`, `empty`, `error`, `add`, `any`, `all`, `flatten`, `range`, `floor`, `ceil`, `round`, `fabs`, `sqrt`, `pow`, `log`, `exp`, `nan`, `isinfinite`, `isnan`, `isnormal`, `infinite`, `sort`, `sort_by`, `group_by`, `unique`, `unique_by`, `max_by`, `min_by`, `reverse`, `contains`, `inside`, `startswith`, `endswith`, `ltrimstr`, `rtrimstr`, `split`, `join`, `ascii_downcase`, `ascii_upcase`, `explode`, `implode`, `test`, `capture`, `scan`, `gsub`, `sub`, `tostring`, `tonumber`, `type`, `builtins`, `indices`, `limit`, `first`, `last`, `nth`, `reduce`, `foreach`, `recurse`, `env`, `transpose`, `input`, `inputs`, `debug`, `halt`, `path`, `paths`, `leaf_paths`, `any`, `all`, `ascii`, `tojson`, `fromjson`, `utf8bytelength`

**Missing in RedfireForge vs jq:**
- `$has` — check if object has key
- `$select` — conditional filter
- `$any` / `$all` — array predicate
- `$groupBy` / `$uniqueBy` / `$sortBy` / `$minBy` / `$maxBy` — parameterized array ops
- `$toEntries` / `$fromEntries` / `$withEntries` — object↔array transformation
- `$startsWith` / `$endsWith` — already have, but missing from assertions
- `$ltrimStr` / `$rtrimStr` — trim specific prefix/suffix
- `$scan` / `$capture` — regex capture groups
- `$indices` — all index positions of substring

---

## Part 4: Gap Analysis Summary

### 4.1 Critical Gaps — Must Have

These capabilities are present in **every** or nearly every competing tool. Their absence significantly limits RedfireForge's validation expressiveness.

#### GAP-01: `ExpectedField` Operator Support

**Current:** `ExpectedField` has only `jsonPath` + `expectedValue` (exact equality).

**Needed:** Add an `operator` field to `ExpectedField`:

```typescript
export interface ExpectedField {
  jsonPath: string;
  expectedValue: string;
  operator?: FieldOperator;
}

export type FieldOperator =
  | 'equals'           // default when omitted — backward compatible
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'         // string contains substring
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'          // regex
  | 'exists'           // field exists (any value)
  | 'not_exists'
  | 'is_null'
  | 'is_not_null'
  | 'is_true'
  | 'is_false'
  | 'is_empty'         // empty string, empty array, or empty object
  | 'is_not_empty'
  | 'is_type'          // expectedValue = 'string' | 'number' | 'boolean' | 'array' | 'object'
  | 'array_length'     // expectedValue = '>5', '>=3', '=10', '<100', etc.
  | 'in'               // expectedValue = comma-separated set: "a,b,c"
  | 'not_in'
  | 'between';         // expectedValue = "1,100" (min,max inclusive)
```

**Impact:** Unlocks all field-level validations from within the Visual Mapper, Data Source Setup, and selective validation. Backward compatible (omitted `operator` defaults to `equals`).

**Who has it:** All 16 tools.

#### GAP-02: Type-Checking Assertion Type

**Current:** No way to assert that a field is a specific type without writing a regex.

**Needed:** New assertion type or new operators on `ExpectedField`:

```typescript
| { type: 'typeCheck'; jsonPath: string; expectedType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'integer' | 'float' }
```

**Who has it:** Hurl (`isString`, `isNumber`, `isBoolean`, `isInteger`, `isFloat`, `isCollection`, `isObject`), Bruno (`isNumber`, `isString`, `isBoolean`, `isArray`, `isJson`), StepCI (`isNumber`, `isString`, `isBoolean`, `isNull`, `isDefined`, `isObject`, `isArray`), Karate (`#string`, `#number`, `#boolean`, `#array`, `#object`, `#null`), Pact (`string()`, `integer()`, `decimal()`, `boolean()`), Postman/Chai (`to.be.a('string')`), JSON Schema (`type` keyword).

#### GAP-03: Boolean Assertion

**Current:** No way to assert `field === true` or `field === false` without exact string match on `"true"`.

**Needed:** First-class boolean check — either via `ExpectedField` operator (`is_true`, `is_false`) or via new assertion type.

**Who has it:** Postman (`.to.be.true`/`.to.be.false`), Hurl (`isBoolean`), Bruno (`isTruthy`/`isFalsy`), Karate (`#boolean`), all script-based tools.

#### GAP-04: String Operators on Body Fields

**Current:** `contains`, `startsWith`, `endsWith` only exist for **header** assertions (via `AssertionOperator`). Body field validation has no substring/prefix/suffix check.

**Needed:** Either extend `ExpectedField` with operators (see GAP-01) or add a new `field` assertion type with string operators.

**Who has it:** Postman (`include`, `match`, `string`), Hurl (`contains`, `startsWith`, `endsWith`, `matches`), Bruno (`contains`, `notContains`, `startsWith`, `endsWith`, `matches`, `notMatches`), JMeter (`Contains`, `Substring`), REST Assured (`containsString`, `startsWith`, `endsWith`), Gatling (`transform` + `is`).

### 4.2 High-Priority Gaps

#### GAP-05: Null/Undefined/Empty Checks

**Current:** No first-class null, undefined, or empty check. Users must use exact match against `"null"` string.

**Needed:** `is_null`, `is_not_null`, `is_empty`, `is_not_empty`, `exists`, `not_exists` operators.

**Who has it:** Hurl (`exists`, `isEmpty`), Bruno (`isNull`, `isDefined`, `isUndefined`, `isEmpty`, `isNotEmpty`), StepCI (`isNull`, `isDefined`), Postman (`.to.be.null`, `.to.be.undefined`, `.to.be.empty`, `.to.exist`), Karate (`#null`, `#notnull`, `#present`, `#notpresent`), REST Assured (`nullValue()`, `notNullValue()`, `emptyString()`), Gatling (`isNull`, `notNull`, `exists`, `notExists`).

#### GAP-06: Negation Modifier

**Current:** No way to negate an assertion generically. Must add separate `not_*` operators for each.

**Needed:** Either a `negate: boolean` flag on assertions, or explicit `not_*` variants for key operators.

**Who has it:** Hurl (`not` prefix on any predicate), Karate (`!contains`, `match !=`), Postman (`.not` chain), JMeter (`Not` checkbox), REST Assured (`not()` matcher).

#### GAP-07: Collection Item Membership

**Current:** `arrayLength` checks count. No way to assert "array contains item X" or "array contains all of [X, Y, Z]".

**Needed:**

```typescript
| { type: 'arrayContains'; jsonPath: string; value: string; mode: 'any' | 'all' | 'only' | 'none' }
```

**Who has it:** Karate (`contains`, `contains only`, `contains any`, `contains deep`), Postman (`include`, `have.members`, `include.members`, `have.deep.members`), REST Assured (`hasItems`, `hasItem`, `contains`, `containsInAnyOrder`), Hurl (`includes`).

#### GAP-08: Each/Every Array Element Assertion

**Current:** No way to assert that every element in an array satisfies a condition.

**Needed:**

```typescript
| { type: 'each'; jsonPath: string; assertion: Assertion }  // nested assertion on each item
```

Or a simpler `match each` approach: every `items[*].status == "active"`.

**Who has it:** Karate (`match each`), Postman (`every()` + Chai), REST Assured (`everyItem()`), Gatling (`transform` + custom).

### 4.3 Medium-Priority Gaps

#### GAP-09: JSON Schema Validation

**Current:** No JSON Schema validation support.

**Needed:** Assertion type that validates response against a JSON Schema (Draft 2020-12):

```typescript
| { type: 'jsonSchema'; schema: string }  // JSON Schema as string
```

**Who has it:** Postman (`pm.response.to.have.jsonSchema`), JMeter (JSON Schema Assertion), REST Assured (`matchesJsonSchemaInClasspath`), StepCI (OpenAPI schema), Pact (structural matchers), Karate (type markers as mini-schema).

#### GAP-10: Field Existence Assertion on Body

**Current:** `exists` operator only works for headers. No way to check if a JSON path exists in the body.

**Needed:** `exists` / `not_exists` as operators on `ExpectedField` or as a dedicated assertion type.

**Who has it:** All tools with type checking or field validation.

#### GAP-11: Deep/Partial Object Matching

**Current:** Only full equality or selective field matching. No "response contains this subset" check.

**Needed:** An assertion that checks if a JSON path's value contains (as a subset) a given JSON structure.

**Who has it:** Karate (`contains deep`), Postman (`deep.include`), REST Assured (Hamcrest nested matchers).

#### GAP-12: Response Size Assertion

**Current:** No assertion on response body size in bytes.

**Needed:** `{ type: 'bodySize'; operator: ComparisonOperator; value: number }` — compare response byte size.

**Who has it:** JMeter (Size Assertion), Hurl (`bytes count`), Gatling (bodyBytes check).

### 4.4 Lower-Priority Gaps

#### GAP-13: In/Not-In Set Membership

**Current:** No set membership check.

**Needed:** `in` / `not_in` operators where `expectedValue` is a comma-separated or JSON array of allowed values.

**Who has it:** Bruno (`in`, `notIn`), StepCI (`in`, `nin`), Gatling (`in()`), Karate (`within`, `!within`).

#### GAP-14: Between/Range Operator

**Current:** Must combine two numeric assertions to check range.

**Needed:** `between` operator: `expectedValue = "1,100"` (min,max inclusive).

**Who has it:** Bruno (`between`), Postman (`within(min, max)`), JSON Schema (`minimum` + `maximum`).

#### GAP-15: Approximate Numeric Comparison

**Current:** Exact numeric comparison only.

**Needed:** `closeTo(value, delta)` style assertion for floating-point tolerance.

**Who has it:** REST Assured (`closeTo()`), Chai.js (`closeTo()`).

#### GAP-16: Date/Time Precision Beyond Day

**Current:** Date assertions truncate to day (`YYYY-MM-DD`). No time-of-day comparison.

**Needed:** Support for ISO 8601 datetime comparison with configurable precision (day, hour, minute, second, millisecond).

**Who has it:** Pact (`iso8601DateTime`, `iso8601DateTimeWithMillis`), DataWeave (full date/time arithmetic), JSONata (`$toMillis`, `$fromMillis`).

### 4.5 Critical Gaps — Dual-Mode Authoring & Live Validation

#### GAP-17: Dual-Mode Authoring (Visual UI + Code Editor)

**Current:** Validation rules can only be created via the Visual Mapper (drag-and-drop) or the Test Editor's manual assertion panel. No code-first authoring path exists.

**Needed:** A code editor mode that lets seasoned engineers write, read, and edit validation rules as structured code — bi-directionally synced with the visual mapper.

**Design requirements:**

1. **Code DSL format** — a human-readable, editable text representation of all validation rules:
   ```
   # Field assertions
   offers[0].associatedOfferingCode  equals      "ONZFCNCPR3MCAL4"
   offers[0].rank                    >=           1
   offers[0].offerName               contains     "OnStar"
   offers[0].isActive                is_true
   offers[4].rank                    is_number
   offers[4].productCode             exists
   offers[4].duration.value          >            0
   offers[4].duration.value          between      1, 365

   # Array assertions
   offers                            length >=    3
   offers                            contains     offerName = "EV Access - 8 Years"
   offers[*].rank                    each >=      0
   ```

2. **Bi-directional sync** — edits in the code editor reflect immediately in the visual tree (operator pills, array assertion rows), and vice versa. Conflict resolution: last-write-wins with visual diff on switch.

3. **Syntax highlighting** — paths in monospace, operators color-coded (same scheme as visual pills: green/amber/purple/teal/gray), values syntax-highlighted by type.

4. **Autocomplete** — JSON path completion from the source/target sample data, operator keyword completion, value suggestions from sample data.

5. **Inline validation** — red squiggles on syntax errors (bad path, unknown operator, type mismatch between operator and value).

6. **Import/export** — paste rules from other tools, export as JSON, YAML, or Hurl-style format.

**Benchmark — how competitors do it:**

| Tool | Code Authoring | Visual Authoring | Sync |
|---|---|---|---|
| **Postman** | JavaScript + Chai.js (primary) | Test builder UI (secondary) | One-way: code only |
| **Karate** | Gherkin DSL (primary) | — | Code only |
| **Hurl** | Hurl text DSL (primary) | — | Code only |
| **Bruno** | Assert tab (structured rows) | Assert tab UI | Bi-directional |
| **k6** | JavaScript (primary) | — | Code only |
| **JMeter** | XML (manual) | GUI assertions (primary) | Bi-directional via XML |
| **REST Assured** | Java/Groovy (primary) | — | Code only |
| **SoapUI/ReadyAPI** | Groovy scripts | GUI assertions | Both modes |

**RedfireForge's opportunity:** Most tools are code-only OR visual-only. Only Bruno and JMeter/SoapUI offer both. By building true bi-directional sync between a code editor and the visual mapper, RedfireForge can offer the best of both worlds — which no competing tool does well.

**Who has it:** Postman, Karate, Hurl, k6, JMeter, REST Assured (code-first); Bruno, SoapUI (dual-mode).

#### GAP-18: Integrated Live Validation / Verify-All Stage

**Current:** The "Verify Rules" button exists only in the Test Editor's validation tab (`TestEditorValidationTab.tsx`). The Visual Mapper has no built-in verification — users must save, go back to the Test Editor, and click "Verify Rules" to see if their rules pass. There is no way to verify array assertions, type checks, or operator-based rules inside the mapper.

**Needed:** An integrated validation stage directly within the Visual Mapper that:

1. **Verify button in mapper toolbar** — "Verify All" runs every validation rule against the current sample response (or live-fetched response) without leaving the mapper.

2. **Per-rule pass/fail status** — each mapped target node shows a pass (✓) or fail (✗) indicator next to its operator pill. Array assertion rows show their own status. The Rules summary table in the bottom dock shows a Status column.

3. **Failure details inline** — failed rules show the actual vs expected value right on the target node (similar to the existing trace overlay), not in a separate panel.

4. **Aggregate status bar** — footer shows "14 passed · 1 failed · 0 skipped" with the option to filter the tree to show only failed rules.

5. **Auto-verify on change** — optionally re-verify whenever a rule is added, changed, or removed (debounced). Toggle in toolbar: "Auto-verify".

6. **Live fetch + verify** — "Fetch & Verify" button sends a real HTTP request, then runs all rules against the live response. Results appear inline.

**Benchmark — how competitors do it:**

| Tool | In-Context Verify | Live Fetch | Per-Rule Status | Auto-Verify |
|---|---|---|---|---|
| **Postman** | Run test tab → results | Send request | Per-assertion pass/fail | — |
| **Karate** | Run feature → report | Yes (built-in) | Per-match pass/fail | — |
| **Hurl** | Run file → inline results | Yes (built-in) | Per-assert pass/fail | — |
| **Bruno** | Assert tab → run | Send request | Per-assertion ✓/✗ | — |
| **SoapUI** | Run test step → results | Yes | Per-assertion | — |
| **k6** | Console output | Yes | check() pass rate | — |
| **REST Assured** | Test runner output | Yes | Per-matcher | — |
| **JMeter** | Assertion results listener | Yes | Per-assertion | — |

**RedfireForge's opportunity:** No tool integrates verify results directly into the mapping canvas with per-node inline pass/fail. This would be a differentiation point — the mapper becomes a live validation workbench, not just a rule builder.

**Who has it:** All tools have verification, but none integrate it into a visual mapping context.

---

## Part 4B: UX Design — Operator Placement in Visual Mapper

> Interactive mockup: `docs/mockups/validation-operators-visual-mapper.html`

### Design Principle: Two Modes, One Model

The Visual Mapper operates in **two authoring modes** that share a single underlying rule model. Users can switch freely between them:

| Mode | For Whom | How It Works |
|---|---|---|
| **Visual Mode** (default) | All users | Drag-and-drop mapping + click operator pills + inline value editing + array assertion rows |
| **Code Mode** | Seasoned engineers | Text editor with DSL syntax, autocomplete, syntax highlighting, and inline validation errors |

Both modes read and write the same `ExpectedField[]` + `Assertion[]` data. Changes in one mode are immediately reflected in the other.

### Visual Mode — Where Each Operator Lives

#### On Target Tree Nodes (field-level operators)

Each mapped target node gains an **operator pill** in the mapping reference area:

```
[type-pill] fieldName  ← [operator-pill] [value-input?] sourcePath
```

- **Operator pill** — color-coded badge (click to open operator picker dropdown)
  - Green: `= equals` (default)
  - Amber: `≥ at least`, `> greater than`, `< less than`, `≤ at most`, `↔ between`
  - Purple: `⊃ contains`, `⊳ starts with`, `⊲ ends with`, `/r/ matches`
  - Red: `✓ is true`, `✗ is false`
  - Teal: `τ isString`, `τ isNumber`, `τ isBoolean`, `τ isArray`, `τ isObject`
  - Gray: `∃ exists`, `∄ not exists`, `∅ is null`, `⊙ not empty`
  - Blue: `∈ in`, `∉ not in`

- **Inline value input** — appears next to the operator pill when the operator requires a value (comparison, string, set membership, between). Hidden for no-value operators (is_true, exists, is_null, type checks).

- **Between operator** — shows two value inputs: `[min] and [max]`

#### On Array Nodes (array-level assertions)

Array (`arr`) nodes gain **assertion rows** directly below the node, visually nested:

```
▼ [arr] offers                           6 items · 2 assertions
  ┃ LENGTH    ≥ at least  [3]                            Edit  ×
  ┃ CONTAINS  item where offerName = ["EV Access"]       Edit  ×
  ┃ EACH      rank  ≥ at least  [0]                      Edit  ×
```

- Right-click array node → context menu offers "Add length assertion", "Add contains assertion", "Add each assertion"
- Each assertion row has inline operator select, value input, edit, and remove controls

#### On Canvas Lines (operator badges)

Connection lines between source and target gain **mid-line operator badges** (same pattern as existing expression/mismatch badges):

- Comparison operators: amber badge showing `≥ 1`
- String operators: purple badge showing `contains`
- Type checks: teal badge showing `τ`

#### In the Operator Picker Dropdown

Clicking any operator pill opens a categorized dropdown:

- **Searchable** — type to filter operators
- **Grouped** — Equality, Comparison, String, Boolean, Type Checks, Existence & Null, Set Membership
- **Each item** — icon + name + description
- **Smart defaults** — picker pre-selects operators appropriate for the field type (numeric field → shows comparison operators first; string field → shows string operators first; boolean field → shows is_true/is_false first)

#### In the Right-Click Context Menu

Right-clicking any target node shows assertion shortcuts:

- Quick-add: equals, at least, contains, starts with, is true, is type, exists, is null
- For array nodes: add length/contains/each assertions
- Expression editor access (double-click shortcut)

### Code Mode — DSL Editor

The bottom dock gains a **"Code"** tab (alongside Rules/Table/Preview) that shows a **text editor** with all validation rules in a structured DSL:

```
# Syntax: TARGET_PATH  OPERATOR  [VALUE]

# Field assertions
offers[0].associatedOfferingCode  equals           "ONZFCNCPR3MCAL4"
offers[0].rank                    >=               1
offers[0].offerName               contains         "OnStar"
offers[0].isActive                is_true
offers[0].billingCadence          equals           "Prepaid"
offers[4].rank                    is_number
offers[4].offerName               starts_with      "Connected Access"
offers[4].productCode             exists
offers[4].duration.value          >                0
offers[4].duration.value          between          1, 365

# Array assertions
offers                            length >=        3
offers                            contains_item    offerName = "EV Access - 8 Years"
offers[*].rank                    each >=          0

# Type assertions
offers[4].rank                    is_type          number
offers[0].isActive                is_type          boolean
```

**Editor features:**

| Feature | Description |
|---|---|
| **Syntax highlighting** | Paths (monospace cyan), operators (color-coded), values (green strings, amber numbers, red booleans), comments (gray) |
| **Autocomplete** | Path completion from sample JSON tree, operator keywords, value suggestions from sample data |
| **Inline errors** | Red squiggles on: unknown paths (not in sample), unknown operators, type mismatches (e.g., `contains` on a number field) |
| **Line actions** | Gutter icons: click to jump to the corresponding target node in visual mode |
| **Bi-directional sync** | Edits here update the visual tree (operator pills, array rows) instantly; visual edits update the code. Debounced parse at 300ms. |
| **Import/Export** | Toolbar buttons: "Import" (paste from Hurl/JSON/YAML), "Export" (copy as JSON array, YAML, or Hurl-style) |
| **Parse errors** | Toast notification for parse failures with line number; invalid lines highlighted but not applied until fixed |

**Sync behavior:**

- Visual → Code: operator pill click / value edit / assertion add/remove → code updates on next tab switch or immediately if code tab is visible
- Code → Visual: on each valid parse, diff against current model → add/update/remove rules. Invalid lines are flagged but don't block other valid lines.
- Conflict: if both modes edited the same rule, last-write-wins with a brief "Sync conflict" toast showing what changed.

### Validation Stage — Verify All Rules

The mapper toolbar gains a **verification cluster**:

```
[Verify All]  [Fetch & Verify]  [Auto-verify ☐]   14 passed · 1 failed
```

**Verify All behavior:**
1. Takes the current sample response data (already loaded in source panel)
2. Runs every `ExpectedField` (with operators) through the enhanced `validateFields()` engine
3. Runs every array assertion through `evaluateAssertions()`
4. Runs every type/existence check
5. Results appear:
   - **Per-node inline**: target nodes gain a pass/fail indicator (✓ green or ✗ red) next to the operator pill
   - **Array assertion rows**: gain a pass/fail badge
   - **Rules table (bottom dock)**: Status column shows ✓ Pass / ✗ Fail with actual values for failures
   - **Footer status**: aggregated "N passed · M failed"
   - **Canvas lines**: failed mappings get a red stroke; passed ones stay green

**Fetch & Verify behavior:**
1. Sends a real HTTP request (using the same host/method/headers as the test definition)
2. Replaces sample response with live response
3. Runs all verification against the live response
4. Shows HTTP status in toolbar: "HTTP 200 · 14 passed · 1 failed"

**Auto-verify toggle:**
- When enabled, re-runs verification (debounced 500ms) whenever a rule is added, changed, or removed
- Runs against sample data only (not live fetch) for performance
- Indicator in toolbar: "Auto ✓" with spinning indicator during verification

**Filter by verification status:**
- Target panel filter dropdown gains: "All", "Mapped", "Unmapped", **"Passed"**, **"Failed"**
- Rules table filter gains: "All operators", **"Failed only"**, **"Passed only"**

---

## Part 5: Expression Function Gaps

### 5.1 Missing Higher-Order Array Functions

| Function | Description | Available In |
|---|---|---|
| `$map(array, expr)` | Transform each element | JSONata, DataWeave, jq |
| `$filter(array, expr)` | Filter by predicate | JSONata, DataWeave, jq |
| `$reduce(array, expr, init)` | Reduce to single value | JSONata, DataWeave, jq |
| `$sum(array)` | Sum numeric array | JSONata, DataWeave, jq |
| `$average(array)` | Average of numeric array | JSONata, DataWeave |
| `$groupBy(array, key)` | Group by key | JSONata, DataWeave, jq |
| `$any(array, pred)` | True if any element matches | jq |
| `$all(array, pred)` | True if all elements match | jq |
| `$sortBy(array, key)` | Sort by expression | DataWeave, jq |
| `$minBy(array, key)` | Min by expression | jq |
| `$maxBy(array, key)` | Max by expression | jq |
| `$distinctBy(array, key)` | Deduplicate by expression | DataWeave, jq |
| `$zip(arr1, arr2)` | Zip two arrays | JSONata, DataWeave, jq |

### 5.2 Missing String Functions

| Function | Description | Available In |
|---|---|---|
| `$substringBefore(str, sep)` | Substring before separator | JSONata, DataWeave |
| `$substringAfter(str, sep)` | Substring after separator | JSONata, DataWeave |
| `$capitalize(str)` | Capitalize first letter | DataWeave |
| `$camelCase(str)` | Convert to camelCase | DataWeave |
| `$snakeCase(str)` | Convert to snake_case | DataWeave |
| `$kebabCase(str)` | Convert to kebab-case | DataWeave |
| `$isAlpha(str)` | All alphabetic | DataWeave |
| `$isNumeric(str)` | All numeric | DataWeave |
| `$trimStart(str)` / `$trimEnd(str)` | Directional trim | jq, JavaScript |
| `$scan(str, regex)` | Capture groups from regex | jq, JSONata |
| `$leftPad(str, len, char)` | Left pad (alias padStart) | — (already have `$padStart`) |

### 5.3 Missing Object Functions

| Function | Description | Available In |
|---|---|---|
| `$has(obj, key)` | Check key existence | jq |
| `$toEntries(obj)` | Object → `[{key, value}]` array | jq, JSONata |
| `$fromEntries(arr)` | `[{key, value}]` → object | jq |
| `$withEntries(obj, fn)` | Transform entries | jq |
| `$pick(obj, keys)` | Select subset of keys | Lodash, Ramda |
| `$omit(obj, keys)` | Exclude keys | Lodash, Ramda |
| `$mapValues(obj, fn)` | Transform values | DataWeave, Lodash |
| `$mapKeys(obj, fn)` | Transform keys | DataWeave, Lodash |

### 5.4 Missing Math/Utility Functions

| Function | Description | Available In |
|---|---|---|
| `$sqrt(n)` | Square root | JSONata, jq |
| `$log(n)` | Natural logarithm | jq |
| `$exp(n)` | Exponential | jq |
| `$clamp(n, min, max)` | Clamp to range | Custom |
| `$uuid()` | Generate UUID v4 | Custom |
| `$range(start, end, step?)` | Generate number range | jq, JSONata |

---

## Part 6: Recommended Implementation Roadmap

### Phase 0: Unified Adapter Capability Framework (Foundation) — COMPLETED ✓

**Goal:** Establish the universal operator framework so all subsequent phases automatically work across every adapter context. This phase has zero visible UI changes but enables everything that follows.

**Completed:** 2026-05-13

| Task | Files | Status |
|---|---|---|
| Define `FieldOperator` type (24 operator union) | `types.ts` | ✓ |
| Define `AdapterCapabilities` interface (12 boolean flags) | `types.ts` | ✓ |
| Add `defaultCapabilities()` + `resolveCapabilities()` helpers | `types.ts` | ✓ |
| Add `capabilities?: AdapterCapabilities` to `MapperAdapter<T>` | `types.ts` | ✓ |
| Add `operator?`, `operatorValue?`, `condition?`, `fallback?` to `Mapping` | `types.ts` | ✓ |
| Export new types from barrel `index.ts` | `index.ts` | ✓ |
| Update `DataMapper.tsx` — resolve capabilities, pass to toolbar + target panel | `DataMapper.tsx` | ✓ |
| Update `MapperToolbar.tsx` — accept `capabilities` prop | `MapperToolbar.tsx` | ✓ |
| Update `TargetTreeNode.tsx` — accept `capabilities` prop | `TargetTreeNode.tsx` | ✓ |
| Update `TargetPanel.tsx` — pass capabilities through | `TargetPanel.tsx` | ✓ |
| Update `DataMapperModal.tsx` — replace `contextId === 'validation'` hardcoding with capability checks | `DataMapperModal.tsx` | ✓ |
| Update `validationAdapter` — full capabilities (operators, verify, code, etc.) | `validationAdapter.ts` | ✓ |
| Update `extractionAdapter` — expressions, codeEditor, schemaDrift, profiles | `extractionAdapter.ts` | ✓ |
| Update `requestBodyAdapter` — expressions, codeEditor, schemaDrift, profiles | `requestBodyAdapter.ts` | ✓ |
| Update `variableBindingAdapter` — expressions, codeEditor, profiles | `variableBindingAdapter.ts` | ✓ |
| Update `webhookExtractionAdapter` — expressions only | `webhookExtractionAdapter.ts` | ✓ |
| Update `columnMappingAdapter` — minimal (expressions: false) | `columnMappingAdapter.ts` | ✓ |
| Update `populateFromApiAdapter` — schemaDrift only | `populateFromApiAdapter.ts` | ✓ |
| Update `sharedDsFetchAdapter` — schemaDrift only | `sharedDsFetchAdapter.ts` | ✓ |
| Update `demoAdapter` — expressions, codeEditor, schemaDrift, profiles | `demoAdapter.ts` | ✓ |
| Update `assertionAdapter` — operators, verification | `assertionAdapter.ts` | ✓ |
| Update `roundTripMappings` lossless check for new Mapping fields | `mappingSerializer.ts` | ✓ |
| Unit tests: `resolveCapabilities` + `defaultCapabilities` | `types.test.ts` (new) | ✓ |
| Unit tests: capability gating in DataMapperModal | `DataMapperModal.test.tsx` | ✓ |
| Unit tests: round-trip with operator/condition/fallback fields | `mappingSerializer.test.ts` | ✓ |
| `npx tsc -b --noEmit` passes | — | ✓ |
| Full data-mapper suite passes (79 files, 2644 tests) | — | ✓ |

**Key Design Decisions:**
- `capabilities` undefined → all-false (backward compatible)
- `expressions` defaults to `true` (most adapters use expressions)
- `DataMapperModal` no longer checks `contextId === 'validation'` — uses `caps.unorderedArrays` and `caps.hideAdvanced` instead
- `FieldOperator` is a 24-member string union covering all planned operators from Phases 1–8
- `Mapping` gains 4 new optional fields: `operator`, `operatorValue`, `condition`, `fallback`

### Phase 1: Field Operator Foundation (Critical — GAP-01, GAP-03, GAP-04, GAP-05) — ✅ COMPLETED

**Goal:** Make `ExpectedField` operator-aware so the Visual Mapper, Data Source Setup, and Test Editor can all express rich field-level validations.

| Task | Files | Status |
|---|---|---|
| Add `FieldOperator` union + `operator?`/`operatorValue?` to `ExpectedField` | `src/shared/types/index.ts` | ✅ Done |
| Create `evaluateFieldOperator()` — exported engine for all 24 operators | `src/engine/validator.ts` | ✅ Done |
| Extend `validateFields()` — operator-first evaluation with equals fallback | `src/engine/validator.ts` | ✅ Done |
| Extend `validateFieldsUnordered()` — operator-aware inner loop | `src/engine/validator.ts` | ✅ Done |
| Update validation adapter serialize — writes `operator`/`operatorValue` | `validationAdapter.ts` | ✅ Done |
| Update validation adapter deserialize — reads `operator`/`operatorValue` back | `validationAdapter.ts` | ✅ Done |
| Operator pill + category-based picker on mapped TargetTreeNode | `TargetTreeNode.tsx` | ✅ Done |
| Inline value editor for value-requiring operators | `TargetTreeNode.tsx` | ✅ Done |
| Wire `onUpdateMappingOperator` through TargetPanel → DataMapper | `TargetPanel.tsx`, `DataMapper.tsx` | ✅ Done |
| Capability-gated — pills only render when `capabilities.operators === true` | `TargetTreeNode.tsx` | ✅ Done |
| Update flat rules table to show Operator column with colored badges | `TestEditorValidationTab.tsx` | ✅ Done |
| Update SetupStepValidate rules table with Operator column | `SetupStepValidate.tsx` | ✅ Done |
| Operator pill CSS — 6 color themes matching mockup | `data-mapper.css` | ✅ Done |
| Operator badge CSS — color-coded badges per operator category | `scenario-builder.css` | ✅ Done |
| 80+ evaluateFieldOperator unit tests (all 24 operators) | `validator.validate.test.ts` | ✅ Done |
| Integration tests — selective mode with field operators | `validator.validate.test.ts` | ✅ Done |
| Adapter round-trip tests — serialize/deserialize/backward compat | `validationAdapter.test.ts` | ✅ Done |

**Key Design Decisions:**
- `evaluateFieldOperator()` is exported from the validator, making it reusable by future adapters and the live verification stage.
- `operatorValue` uses the `operatorValue` field on `ExpectedField` with fallback to `expectedValue` — full backward compatibility.
- The operator picker uses a category-grouped dropdown with search, matching the mockup's `operator-picker` design.
- 6 CSS color themes: `equals` (green), `comparison` (yellow), `string-op` (purple), `boolean-op` (red), `type-check` (teal), `existence` (gray).
- 24 operators implemented: `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex`, `is_true`, `is_false`, `is_null`, `is_not_null`, `is_empty`, `is_not_empty`, `exists`, `not_exists`, `is_type`, `in`, `not_in`, `between`, `close_to`.

**Tests:** 144 validator tests passed (80+ new), 52 adapter tests passed (6 new), 558 component tests passed (all existing pass).

### Phase 2: Type & Existence Assertions (High — GAP-02, GAP-06, GAP-10) ✅ COMPLETED

**Goal:** Add type-checking and existence assertions as first-class `Assertion` union members, so users can add them from the "+ Add" assertion menu, edit them inline, and have them evaluated by `evaluateAssertions()` at runtime — independent of the `FieldOperator` system (which already has `is_type`, `exists`, `not_exists` on `ExpectedField`).

**Context:** Phase 1 added 24 `FieldOperator` values including `is_type`, `exists`, `not_exists`, `is_null`, etc. on `ExpectedField`. These work inside the Visual Mapper's validation adapter. Phase 2 adds **standalone assertion types** to the `Assertion` union so they can be used in the Assertions panel (outside the mapper) — same as `status`, `responseTime`, `header`, `regex`, `arrayLength`, `numeric`, and `date` work today.

**New Assertion Types:**

| Type | Syntax | Example |
|---|---|---|
| `typeCheck` | `{ type: 'typeCheck'; jsonPath: string; expectedType: JsonTypeName }` | Assert `$.price` is a `number` |
| `existence` | `{ type: 'existence'; jsonPath: string; expectExists: boolean }` | Assert `$.metadata.tags` exists (or not) |

Where `JsonTypeName = 'string' \| 'number' \| 'boolean' \| 'array' \| 'object' \| 'null'`.

---

#### Step 1: Type Definitions (S)

**File:** `src/shared/types/index.ts`

1. Add `JsonTypeName` type alias:
   ```typescript
   export type JsonTypeName = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
   ```
2. Extend the `Assertion` union with two new members:
   ```typescript
   export type Assertion =
     | { type: 'status'; expected: string }
     | { type: 'responseTime'; maxMs: number }
     | { type: 'header'; name: string; operator: AssertionOperator; value?: string }
     | { type: 'regex'; jsonPath: string; pattern: string }
     | { type: 'arrayLength'; jsonPath: string; operator: ComparisonOperator; value: number }
     | { type: 'numeric'; jsonPath: string; operator: ComparisonOperator; value: number }
     | { type: 'date'; jsonPath: string; operator: ComparisonOperator; reference: DateReference }
     | { type: 'typeCheck'; jsonPath: string; expectedType: JsonTypeName }         // NEW
     | { type: 'existence'; jsonPath: string; expectExists: boolean };              // NEW
   ```

**Done when:** TypeScript compiles with the new union members. All existing assertion handling still works (existing switch cases continue to match).

---

#### Step 2: Validator Engine — `evaluateAssertions()` (S)

**File:** `src/engine/validator.ts`

1. Add `case 'typeCheck'` to the `evaluateAssertions` switch:
   ```typescript
   case 'typeCheck': {
     const val = getByPath(ctx.responseBody, a.jsonPath);
     const actualType = getJsonTypeName(val);
     if (actualType !== a.expectedType) {
       failures.push({
         path: `(typeCheck:${a.jsonPath})`,
         expected: `type ${a.expectedType}`,
         actual: val === undefined ? 'path not found' : `type ${actualType}`,
       });
     }
     break;
   }
   ```
2. Add `case 'existence'` to the `evaluateAssertions` switch:
   ```typescript
   case 'existence': {
     const val = getByPath(ctx.responseBody, a.jsonPath);
     const found = val !== undefined;
     if (found !== a.expectExists) {
       failures.push({
         path: `(existence:${a.jsonPath})`,
         expected: a.expectExists ? 'field exists' : 'field does not exist',
         actual: found ? 'field exists' : 'field not found',
       });
     }
     break;
   }
   ```
3. Add helper function `getJsonTypeName()`:
   ```typescript
   function getJsonTypeName(val: unknown): JsonTypeName {
     if (val === null) return 'null';
     if (Array.isArray(val)) return 'array';
     const t = typeof val;
     if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t as JsonTypeName;
     return 'string'; // fallback for undefined etc.
   }
   ```

**Done when:** `evaluateAssertions` correctly evaluates both new assertion types against response data.

---

#### Step 3: Assertion UI — "+ Add" Menu (M)

**File:** `src/features/scenarios/components/TestEditorValidationTab.tsx`

1. Add two new buttons to the "+ Add" assertion dropdown menu (after the existing "Date Compare" button):
   - **Type Check:** `addAssertion({ type: 'typeCheck', jsonPath: '', expectedType: 'string' })`
     - Icon: `🏷` | Label: "Type Check" | Desc: "Assert value type at a JSON path"
   - **Field Exists:** `addAssertion({ type: 'existence', jsonPath: '', expectExists: true })`
     - Icon: `🔍` | Label: "Field Exists" | Desc: "Assert a JSON path exists or not"
2. Add inline editing rows for the new types in the assertions list renderer:
   - **`typeCheck` row:** JSON path input + type dropdown (`string`, `number`, `boolean`, `array`, `object`, `null`)
   - **`existence` row:** JSON path input + toggle/dropdown (`exists` / `does not exist`)

**Done when:** Users can add, edit, and delete Type Check and Existence assertions from the Assertions panel in Test Editor.

---

#### Step 4: Assertion UI — SetupStepValidate (M)

**File:** `src/features/scenarios/components/SetupStepValidate.tsx`

1. Add rendering support for `typeCheck` and `existence` assertion types in the assertions display table, matching the style used for `arrayLength`, `numeric`, and `date` assertions.
2. Show:
   - `typeCheck`: badge "TYPE" + path + expected type
   - `existence`: badge "EXISTS" / "NOT EXISTS" + path

**Done when:** SetupStepValidate correctly displays the new assertion types in its rules summary.

---

#### Step 5: Assertion Preset Menu Integration (S)

**File:** `src/features/scenarios/components/AssertionPresetMenu.tsx`

1. Ensure import/export of assertion presets handles the new `typeCheck` and `existence` types without dropping them.
2. If the preset menu has type-specific templates, add preset entries:
   - "All fields are strings" — bulk typeCheck preset
   - "Required fields exist" — bulk existence preset

**Done when:** Preset import/export round-trips the new assertion types. Optional presets are available.

---

#### Step 6: Unit Tests — Validator (M)

**File:** `src/engine/validator.validate.test.ts`

Add test cases for `evaluateAssertions`:

**typeCheck assertions (12+ tests):**
- `$.name` is `string` → pass
- `$.price` is `number` → pass
- `$.active` is `boolean` → pass
- `$.tags` is `array` → pass
- `$.address` is `object` → pass
- `$.deleted` is `null` → pass
- `$.price` expected `string` but got `number` → fail with correct message
- `$.tags` expected `object` but got `array` → fail
- `$.nonexistent` path not found → fail with "path not found"
- Nested path `$.user.profile.age` is `number` → pass
- Array-indexed path `$.items[0].name` is `string` → pass
- Edge case: empty string is still `string` → pass

**existence assertions (8+ tests):**
- `$.name` expectExists `true` → pass (field present)
- `$.name` expectExists `false` → fail (field present but expected absent)
- `$.nonexistent` expectExists `true` → fail (not found)
- `$.nonexistent` expectExists `false` → pass (correctly absent)
- Nested path `$.user.email` exists → pass
- Deeply nested missing `$.user.phone.mobile` → fail
- Root-level `$` always exists → pass
- `null` value — field exists even though value is null → pass (existence ≠ non-null)

**Done when:** All new test cases pass. Existing assertion tests still pass.

---

#### Step 7: Unit Tests — UI Components (M)

**Files:**
- `src/features/scenarios/components/TestEditorValidationTab.test.tsx`
- `src/features/scenarios/components/SetupStepValidate.test.tsx`

Add test cases:
- "+ Add" menu shows "Type Check" and "Field Exists" buttons
- Clicking "Type Check" adds a `typeCheck` assertion row
- Clicking "Field Exists" adds an `existence` assertion row
- `typeCheck` row renders JSON path input and type dropdown
- `existence` row renders JSON path input and exists/not-exists toggle
- Editing type dropdown updates the assertion model
- Editing exists toggle updates `expectExists`
- SetupStepValidate renders `typeCheck` and `existence` assertion badges

**Done when:** All UI tests pass with correct rendering and interaction behavior.

---

#### Step 8: TypeScript Check & Integration Verification (S)

1. Run `npx tsc -b --noEmit` — must pass with zero errors.
2. Run all touched test files:
   ```bash
   npx vitest run src/engine/validator.validate.test.ts \
     src/features/scenarios/components/TestEditorValidationTab.test.tsx \
     src/features/scenarios/components/SetupStepValidate.test.tsx
   ```
3. Verify no regressions in existing assertion evaluation by running the full validator test suite.

**Done when:** Zero type errors, zero test failures.

---

#### Phase 2 Deliverable Criteria

- [x] `JsonTypeName` type and two new `Assertion` union members added to `src/shared/types/index.ts`
- [x] `evaluateAssertions()` handles `typeCheck` and `existence` with correct pass/fail logic
- [x] `getJsonTypeName()` helper correctly classifies all JSON value types including `null` and `array`
- [x] Test Editor "+ Add" menu includes "Type Check" and "Field Exists" options
- [x] Inline editing rows work for both new assertion types
- [x] SetupStepValidate — N/A (only renders `ExpectedField`, not `Assertion` types)
- [x] Assertion preset import/export handles new types + 2 new presets added (Data Type Guard, Required Fields Check)
- [x] 33 new unit tests for validator (12 getJsonTypeName + 13 typeCheck + 8 existence)
- [x] 11 UI component tests for add/edit/render of new assertion types
- [x] `npx tsc -b --noEmit` passes
- [x] All targeted tests pass (344 total)

---

#### Relationship to Phase 1 Field Operators

Phase 1's `FieldOperator` already includes `is_type`, `exists`, `not_exists`, `is_null`, etc. on `ExpectedField` — these work within the Visual Mapper's **validation adapter** (field-level operators on mapped fields). Phase 2's `typeCheck` and `existence` are **standalone assertion types** in the `Assertion` union — they work in the Assertions panel independently, without requiring a mapping. Both systems coexist: the mapper uses `FieldOperator` on `ExpectedField`, and the Assertions panel uses `Assertion` union members.

This means users have two paths:
1. **Visual Mapper path:** Map a field → set operator pill to `is_type` / `exists` → saved via validation adapter as `ExpectedField.operator`
2. **Assertions panel path:** Click "+ Add" → "Type Check" / "Field Exists" → saved as standalone `Assertion` object

Both are evaluated at runtime — `ExpectedField` operators by `validateFields()` and standalone assertions by `evaluateAssertions()`.

### Phase 3: Collection & Structural Assertions (High — GAP-07, GAP-08, GAP-11)

**Goal:** Add array membership checks, each-element validation, and partial matching as first-class `Assertion` union members, enabling users to write assertions like "offers array contains an item where offerName equals X", "every offer has rank >= 0", and "response contains this subset structure."

**New Assertion Types:**

| Type | Syntax | Example |
|---|---|---|
| `arrayContains` | `{ type: 'arrayContains'; jsonPath: string; value: string; mode: 'any' \| 'all' \| 'only' \| 'none' }` | Assert `$.offers` contains item with offerName "EV Access" |
| `each` | `{ type: 'each'; jsonPath: string; fieldPath: string; operator: FieldOperator; value?: string }` | Assert every `$.offers[*].rank` >= 0 |
| `containsSubset` | `{ type: 'containsSubset'; jsonPath: string; expected: string }` | Assert `$.response` contains `{ "status": "active" }` as subset |

---

#### Step 1: Type Definitions (S)

**File:** `src/shared/types/index.ts`

1. Extend the `Assertion` union with three new members:
   ```typescript
   | { type: 'arrayContains'; jsonPath: string; value: string; mode: 'any' | 'all' | 'only' | 'none' }
   | { type: 'each'; jsonPath: string; fieldPath: string; operator: FieldOperator; value?: string }
   | { type: 'containsSubset'; jsonPath: string; expected: string }
   ```
2. `arrayContains.value` is a JSON-stringified value to search for within array items. `mode` controls matching:
   - `any` — at least one item matches (default)
   - `all` — every item matches
   - `only` — exactly these items, no extras (order-independent)
   - `none` — no item matches (negation)
3. `each.fieldPath` is the relative sub-path within each array element (e.g., `rank` for `offers[*].rank`). `operator` + `value` use the existing `FieldOperator` system.
4. `containsSubset.expected` is a JSON string representing the expected subset structure.

**Done when:** TypeScript compiles. All existing assertion handling still works.

---

#### Step 2: Validator Engine — Three New Cases (M)

**File:** `src/engine/validator.ts`

1. Add `case 'arrayContains'` to `evaluateAssertions`:
   - Resolve `jsonPath` to get the array value
   - Verify it is actually an array (fail if not)
   - Parse `value` as JSON
   - Implement mode logic:
     - `any`: `array.some(item => deepEquals(item, parsedValue))` or `array.some(item => getByPath(item, subPath) === parsedValue)` depending on value structure
     - `all`: `array.every(...)` 
     - `only`: set comparison (unordered, all items match, no extras)
     - `none`: `!array.some(...)`
   - Report failure with expected description and actual array summary

2. Add `case 'each'` to `evaluateAssertions`:
   - Resolve `jsonPath` to get the array value
   - Verify it is an array
   - For each element, extract `fieldPath` value and evaluate using `evaluateFieldOperator()`
   - Collect failures: report first N failing indices (e.g., "items[2].rank: expected >= 0, got -1")
   - Summary: "3 of 10 items failed"

3. Add `case 'containsSubset'` to `evaluateAssertions`:
   - Resolve `jsonPath` to get actual value
   - Parse `expected` as JSON
   - Implement recursive subset matching: for each key in expected, actual must have the same key with matching value (recursively for nested objects, element-wise for arrays)
   - Report mismatched paths on failure

4. Add helper `deepSubsetMatch(actual: unknown, expected: unknown): { match: boolean; path?: string }` for recursive subset comparison.

**Done when:** All three cases produce correct pass/fail results with descriptive failure messages.

---

#### Step 3: Assertion UI — "+ Add" Menu & Inline Editing (M)

**File:** `src/features/scenarios/components/TestEditorValidationTab.tsx`

1. Add three new buttons to the "+ Add" dropdown:
   - **Array Contains:** `addAssertion({ type: 'arrayContains', jsonPath: '', value: '', mode: 'any' })`
     - Icon: `🔎` | Label: "Array Contains" | Desc: "Check if array includes specific items"
   - **Each Element:** `addAssertion({ type: 'each', jsonPath: '', fieldPath: '', operator: 'equals', value: '' })`
     - Icon: `∀` | Label: "Each Element" | Desc: "Assert condition on every array element"
   - **Contains Subset:** `addAssertion({ type: 'containsSubset', jsonPath: '', expected: '{}' })`
     - Icon: `⊆` | Label: "Contains Subset" | Desc: "Partial deep match on a JSON structure"

2. Add inline editing rows:
   - **`arrayContains` row:** JSON path input + mode dropdown (any/all/only/none) + value textarea (JSON)
   - **`each` row:** JSON path input (array) + field path input (sub-path) + operator dropdown (reuse `FieldOperator` options) + value input
   - **`containsSubset` row:** JSON path input + expected JSON textarea (multi-line)

**Done when:** Users can add, edit, and delete all three assertion types from the Assertions panel.

---

#### Step 4: Visual Mapper — Array Assertion Rows (M)

**Files:** `src/shared/components/data-mapper/TargetTreeNode.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`, `src/styles/data-mapper.css`

1. Detect array nodes (`type === 'array'`) in the target tree.
2. Below each array node, render **assertion rows** when the adapter has `capabilities.arrayAssertions === true`:
   ```
   ▼ [arr] offers                    6 items · 2 assertions
     ┃ LENGTH  ≥  [3]                                    Edit  ×
     ┃ EACH    rank  ≥  [0]                              Edit  ×
   ```
3. Each row is a compact inline control with: assertion type badge, operator dropdown, value input, edit button (opens detail editor), remove button.
4. "+" button below assertion rows to add new array assertion via a mini picker (Length / Contains / Each / Subset).
5. Store array assertions as additional `Assertion[]` data wired through the validation adapter.
6. CSS: `.dm-array-assertion-row`, `.dm-array-assertion-badge`, `.dm-array-assertion-add` with consistent styling.

**Done when:** Array nodes in the Visual Mapper show inline assertion rows with add/edit/remove controls.

---

#### Step 5: Target Node Right-Click Context Menu (M)

**File:** `src/shared/components/data-mapper/TargetTreeNode.tsx`

1. Add `onContextMenu` handler to target tree nodes.
2. On right-click, show a context menu with options:
   - For **all nodes**: "Set operator..." (opens operator picker), "Edit expression...", "Remove mapping"
   - For **array nodes** (additionally): "Add length assertion", "Add contains assertion", "Add each assertion", "Add subset assertion"
3. Context menu rendered with `position: fixed` (same pattern as operator picker).
4. Click-outside to dismiss.

**Done when:** Right-clicking a target node shows an appropriate context menu. Array-specific options only appear on array nodes.

---

#### Step 6: SetupStepValidate Support (S)

**File:** `src/features/scenarios/components/SetupStepValidate.tsx`

1. Add rendering for `arrayContains`, `each`, and `containsSubset` assertion types in the rules display table.
2. Badges: "CONTAINS" (blue), "EACH" (purple), "SUBSET" (teal) — consistent with existing badge styling.

**Done when:** SetupStepValidate correctly displays all three new assertion types.

---

#### Step 7: Unit Tests (L)

**File:** `src/engine/validator.validate.test.ts`

**arrayContains tests (15+ tests):**
- `mode: 'any'` — array contains matching item → pass
- `mode: 'any'` — no match → fail
- `mode: 'all'` — all items match → pass
- `mode: 'all'` — some items don't match → fail with count
- `mode: 'only'` — exact set (unordered) → pass
- `mode: 'only'` — extras present → fail
- `mode: 'only'` — missing items → fail
- `mode: 'none'` — no items match → pass
- `mode: 'none'` — some match → fail
- Non-array target → fail with "not an array"
- Nested object matching in array items
- Primitive array (strings, numbers)
- Empty array edge cases

**each tests (12+ tests):**
- All elements satisfy `>= 0` → pass
- One element fails → fail with index
- Empty array → pass (vacuously true)
- Non-array target → fail
- Nested field path (`duration.value >= 1`)
- String operator (`offerName contains "Star"`)
- Boolean operator (`isActive is_true`)
- Missing field in some elements → fail

**containsSubset tests (10+ tests):**
- Flat object subset match → pass
- Missing key → fail
- Mismatched value → fail with path
- Nested object subset → pass
- Array subset (order-independent) → pass
- Extra fields in actual → pass (subset, not exact)
- Deep nesting (3+ levels)
- Null values in subset
- Empty subset `{}` → always pass
- Non-object target → fail

**Done when:** All new tests pass. Existing tests unaffected.

---

#### Step 8: UI Component Tests (M)

**Files:** `TestEditorValidationTab.test.tsx`, `SetupStepValidate.test.tsx`, `TargetTreeNode.test.tsx`

- "+ Add" menu shows all three new buttons
- Clicking each adds the correct assertion type
- Inline editing rows render with correct controls
- Context menu appears on right-click for array nodes
- Array assertion rows render below array target nodes
- SetupStepValidate renders badges for new types

**Done when:** All UI tests pass.

---

#### Step 9: TypeScript Check & Integration Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Verify no regressions

---

#### Phase 3 Deliverable Criteria

- [ ] Three new `Assertion` union members in `types/index.ts`
- [ ] `evaluateAssertions()` handles `arrayContains`, `each`, and `containsSubset`
- [ ] `deepSubsetMatch()` helper for recursive partial object comparison
- [ ] Test Editor "+ Add" menu includes three new assertion options
- [ ] Inline editing rows for all three types
- [ ] Visual Mapper array assertion rows below array nodes
- [ ] Right-click context menu on target nodes
- [ ] SetupStepValidate badge rendering
- [ ] 37+ new unit tests
- [ ] `npx tsc -b --noEmit` passes
- [ ] All targeted tests pass

---

### Phase 4: Code Editor Mode — Dual Authoring (Critical — GAP-17)

**Goal:** Add a code-first authoring path for validation rules, bi-directionally synced with the visual mapper, so seasoned engineers can write, read, and edit validation rules as structured text. The code editor uses a human-readable DSL and supports syntax highlighting, autocomplete, inline errors, and import/export.

**DSL Format:**

```
# Syntax: TARGET_PATH  OPERATOR  [VALUE]
offers[0].associatedOfferingCode  equals           "ONZFCNCPR3MCAL4"
offers[0].rank                    >=               1
offers[0].offerName               contains         "OnStar"
offers[0].isActive                is_true
offers[4].rank                    is_type          number
offers[4].productCode             exists
offers[4].duration.value          between          1, 365
offers                            length >=        3
offers[*].rank                    each >=          0
```

---

#### Step 1: DSL Grammar Definition & Parser (L)

**File:** `src/shared/components/data-mapper/utils/validationDsl.ts` (new)

1. Define the DSL grammar:
   - Lines starting with `#` are comments (ignored)
   - Blank lines are ignored
   - Each rule line: `PATH  OPERATOR  [VALUE]`
   - PATH: dotted path with optional bracket notation (`offers[0].rank`, `offers[*].rank`)
   - OPERATOR: one of the 24 `FieldOperator` keywords, plus `length`, `each`, `contains_item`, `subset`
   - VALUE: optional — quoted string `"..."`, number, boolean, or comma-separated for `between`/`in`

2. Implement `parseDslLine(line: string): ParsedRule | ParseError`:
   - Tokenize: extract path, operator keyword, and value
   - Map operator keyword to `FieldOperator` or collection assertion type
   - Return `{ path, operator, value, lineNumber }` or `{ error, lineNumber }`

3. Implement `parseDsl(text: string): { rules: ParsedRule[]; errors: ParseError[] }`:
   - Split text into lines
   - Parse each non-empty, non-comment line
   - Return both valid rules and errors (partial parse — valid lines still apply)

4. Define `ParsedRule` and `ParseError` interfaces.

**Done when:** Parser correctly handles all 24 operators, collection assertions, comments, blank lines, and reports line-level errors for invalid syntax.

---

#### Step 2: DSL Serializer — Model to Text (M)

**File:** `src/shared/components/data-mapper/utils/validationDsl.ts`

1. Implement `serializeToDsl(fields: ExpectedField[], assertions: Assertion[]): string`:
   - Convert each `ExpectedField` to a DSL line: `path  operator  value`
   - Convert each collection assertion (`arrayContains`, `each`, `containsSubset`) to DSL lines
   - Convert each standalone assertion (`typeCheck`, `existence`) to DSL lines
   - Sort by path for readability
   - Insert section comments (`# Field assertions`, `# Array assertions`, `# Type assertions`)
   - Align operator column for readability (pad paths to consistent width)

2. Handle operator-specific serialization:
   - No-value operators (`is_true`, `exists`, `is_null`): omit value
   - `between`: format as `min, max`
   - `in`/`not_in`: format as comma-separated
   - String values: wrap in double quotes
   - Numeric values: raw number
   - Boolean values: `true`/`false`

**Done when:** `parseDsl(serializeToDsl(fields, assertions))` round-trips losslessly for all supported rule types.

---

#### Step 3: DSL Parser — Text to Model (L)

**File:** `src/shared/components/data-mapper/utils/validationDsl.ts`

1. Implement `dslToModel(rules: ParsedRule[]): { fields: ExpectedField[]; assertions: Assertion[] }`:
   - Map field-level rules to `ExpectedField[]` with `operator` and `operatorValue`
   - Map collection rules (`length`, `each`, `contains_item`, `subset`) to appropriate `Assertion` union members
   - Map type/existence rules to `typeCheck` / `existence` assertions

2. Error recovery:
   - Invalid lines produce `ParseError` with line number, column, and message
   - Valid lines from the same text are still processed
   - Unknown operator → error
   - Missing required value → error
   - Bad path syntax → error

**Done when:** Full round-trip works. Error messages are specific and actionable.

---

#### Step 4: ValidationCodeEditor Component (L)

**File:** `src/shared/components/data-mapper/ValidationCodeEditor.tsx` (new)

1. Create a Monaco Editor-based component for editing validation DSL:
   - Set language to a custom `validation-dsl` language registration
   - Theme: dark theme matching the mapper (same as ExpressionEditorModal)

2. Syntax highlighting via Monaco monarch tokenizer:
   - Paths: cyan monospace
   - Operators: color-coded by category (green/amber/purple/teal/gray — same as pills)
   - String values: green
   - Numeric values: amber
   - Boolean values: red
   - Comments: gray italic
   - Errors: red underline

3. Editor props: `value`, `onChange`, `errors: ParseError[]`, `samplePaths: string[]`, `onJumpToNode: (path: string) => void`

**Done when:** Editor renders DSL text with syntax highlighting and displays parse errors as red squiggles.

---

#### Step 5: Autocomplete — Path, Operator, Value (M)

**File:** `src/shared/components/data-mapper/ValidationCodeEditor.tsx`

1. Register Monaco completion provider for `validation-dsl`:
   - **Position 1 (start of line):** Suggest JSON paths from `samplePaths` (extracted from source/target sample data)
   - **Position 2 (after path):** Suggest operator keywords — grouped and sorted by relevance to the field's detected type
   - **Position 3 (after operator):** Suggest values — sample data values for the path, `true`/`false` for boolean operators, type names for `is_type`

2. Path autocomplete uses fuzzy matching (e.g., typing `off.rank` suggests `offers[0].rank`, `offers[1].rank`, etc.)

3. Trigger autocomplete on: typing, Ctrl+Space, or after whitespace following a path/operator.

**Done when:** Autocomplete suggestions appear contextually for paths, operators, and values.

---

#### Step 6: Inline Error Markers (M)

**File:** `src/shared/components/data-mapper/ValidationCodeEditor.tsx`

1. After each parse (debounced 300ms), set Monaco markers for each `ParseError`:
   - Red squiggles on the error span
   - Hover tooltip with error message
   - Error types: unknown path, unknown operator, type mismatch (e.g., `contains` on number field), missing value, syntax error

2. Validate paths against sample data tree — paths not found in the sample get a warning marker (yellow, not red) since the sample may be incomplete.

3. Type-aware operator validation: if sample data shows the path is a number, warn when string operators (`contains`, `starts_with`) are used.

**Done when:** Parse errors and semantic warnings display as inline markers.

---

#### Step 7: Integration Into Mapper Bottom Dock (M)

**Files:** `src/shared/components/data-mapper/DataMapper.tsx`, `src/shared/components/data-mapper/CodeView.tsx`

1. Add a new bottom utility mode: `'validation-code'` alongside existing `'code'`, `'preview'`, `'table'`.
2. Add "Rules" button to the toolbar view group (next to Code, Preview, Table).
3. When active, render `ValidationCodeEditor` in the bottom dock.
4. Pass: current `ExpectedField[]`, `Assertion[]`, sample paths, and `onJumpToNode` callback.

**Done when:** The "Rules" tab appears in the bottom dock and shows the validation DSL editor with current rules.

---

#### Step 8: Bi-Directional Sync Engine (L)

**File:** `src/shared/components/data-mapper/hooks/useValidationCodeSync.ts` (new)

1. Implement `useValidationCodeSync` hook:
   - Inputs: `mappings: Mapping[]`, `assertions: Assertion[]`, `onUpdateMappings`, `onUpdateAssertions`
   - State: `dslText`, `parseErrors`, `syncDirection: 'visual' | 'code' | null`

2. **Visual → Code sync:**
   - When mappings or assertions change from the visual side, re-serialize to DSL text
   - Only update if the code tab is visible or on tab switch
   - Preserve user's cursor position after sync

3. **Code → Visual sync:**
   - On text change (debounced 300ms), parse the DSL
   - Diff parsed rules against current model
   - Apply additions, updates, and removals to mappings and assertions
   - Invalid lines are flagged but don't block valid lines

4. **Conflict resolution:**
   - Track sync direction: last-writer-wins
   - If both sides changed the same rule, show a brief toast "Sync conflict on [path]" and apply the latest change

**Done when:** Edits in the code editor reflect in the visual tree, and visual edits reflect in the code editor. Round-trip is lossless for all supported rule types.

---

#### Step 9: Line Gutter Click-to-Focus (S)

**File:** `src/shared/components/data-mapper/ValidationCodeEditor.tsx`

1. Add gutter decoration (small arrow icon) on each valid rule line.
2. On click, call `onJumpToNode(path)` — which scrolls the target tree to the corresponding node and selects it.
3. On hover, highlight the corresponding connection line on the canvas.

**Done when:** Clicking a gutter icon jumps to and highlights the target node in the visual tree.

---

#### Step 10: Import/Export (M)

**File:** `src/shared/components/data-mapper/utils/validationDsl.ts`

1. **Export formats:**
   - `exportAsJson(fields, assertions)` → JSON array of rule objects
   - `exportAsYaml(fields, assertions)` → YAML format
   - `exportAsHurl(fields, assertions)` → Hurl-style predicate syntax
   - `exportAsDsl(fields, assertions)` → native DSL text (same as serializer)

2. **Import formats:**
   - `importFromJson(text)` → parsed rules
   - `importFromDsl(text)` → parsed rules (same as parser)
   - Auto-detect format based on content (JSON array → JSON import, otherwise DSL)

3. Add "Import" and "Export" buttons to the ValidationCodeEditor toolbar area.

**Done when:** Users can export validation rules to JSON/YAML/Hurl/DSL and import from JSON/DSL.

---

#### Step 11: Unit Tests — DSL Parser & Serializer (L)

**File:** `src/shared/components/data-mapper/utils/validationDsl.test.ts` (new)

- Round-trip test: serialize → parse → serialize produces identical output (20+ rule variations)
- Parse all 24 field operators
- Parse collection assertions (`length`, `each`, `contains_item`, `subset`)
- Parse type/existence assertions
- Parse comments and blank lines (ignored)
- Error: unknown operator → line-level error
- Error: missing value for value-requiring operator
- Error: malformed path syntax
- Error: unterminated string literal
- Partial parse: valid lines extracted alongside errors
- Serializer: operator alignment, section grouping, value quoting
- Import/export round-trip for JSON format
- Edge cases: empty input, single rule, 100+ rules

**Done when:** All parser/serializer tests pass with comprehensive edge case coverage.

---

#### Step 12: Unit Tests — Sync Engine (M)

**File:** `src/shared/components/data-mapper/hooks/useValidationCodeSync.test.ts` (new)

- Visual → Code: mapping change triggers DSL update
- Code → Visual: text edit triggers mapping update (debounced)
- Conflict: simultaneous edits resolve with last-writer-wins
- Invalid lines produce errors but don't break valid lines
- Adding a rule in code creates a new mapping
- Removing a rule in code removes the mapping
- Changing operator in code updates the mapping operator
- Tab switch triggers sync in correct direction

**Done when:** All sync tests pass.

---

#### Step 13: Integration Tests — Round-Trip (M)

**File:** `src/shared/components/data-mapper/DataMapper.test.tsx`

- Render mapper with validation adapter and mappings
- Switch to "Rules" bottom dock
- Verify DSL text matches current mappings
- Edit DSL text → verify mappings update
- Edit mapping in visual tree → verify DSL text updates

**Done when:** Integration tests confirm bi-directional sync works end-to-end.

---

#### Step 14: TypeScript Check & Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Verify no regressions

---

#### Phase 4 Deliverable Criteria

- [ ] Validation DSL grammar defined with support for all operators + collection assertions
- [ ] DSL parser handles partial parse with line-level error reporting
- [ ] DSL serializer produces human-readable, aligned DSL text
- [ ] Lossless round-trip: serialize → parse → serialize
- [ ] `ValidationCodeEditor` component with Monaco Editor, syntax highlighting, and dark theme
- [ ] Autocomplete for paths, operators, and values
- [ ] Inline error markers (parse errors + semantic warnings)
- [ ] "Rules" tab in mapper bottom dock
- [ ] Bi-directional sync engine (visual ↔ code) with debounced parse
- [ ] Line gutter click-to-focus navigation
- [ ] Import/export: JSON, YAML, Hurl-style DSL
- [ ] 40+ parser/serializer unit tests
- [ ] 15+ sync engine unit tests
- [ ] Integration tests for round-trip behavior
- [ ] `npx tsc -b --noEmit` passes

---

### Phase 5: Integrated Live Validation Stage (Critical — GAP-18)

**Goal:** Add in-mapper rule verification so users can validate all rules (field operators, array assertions, type checks, existence) against sample or live response data directly within the Visual Mapper — turning the mapper from a rule builder into a live validation workbench.

**Key UX:** Per-node pass/fail indicators, aggregate status bar, auto-verify on change, and fetch-and-verify for live responses.

---

#### Step 1: `useValidationVerify` Hook (M)

**File:** `src/shared/components/data-mapper/hooks/useValidationVerify.ts` (new)

1. Create a React hook that accepts:
   - `mappings: Mapping[]` — current mappings (with operators)
   - `assertions: Assertion[]` — standalone assertions
   - `sampleResponseData: unknown` — the response data to verify against
   - `adapter: MapperAdapter` — for serializing mappings to `ExpectedField[]`
   - `enabled: boolean` — whether verification is active

2. Core logic:
   - Serialize mappings to `ExpectedField[]` using the adapter
   - Call `validateFields(sampleResponseData, expectedFields)` (with operator support from Phase 1)
   - Call `evaluateAssertions(assertions, ctx)` for standalone assertions
   - Merge results into a `VerifyResult` structure:
     ```typescript
     interface VerifyResult {
       status: 'idle' | 'running' | 'complete';
       fieldResults: Map<string, { passed: boolean; actual?: string; expected?: string }>;
       assertionResults: { assertion: Assertion; passed: boolean; actual?: string; expected?: string }[];
       passedCount: number;
       failedCount: number;
       skippedCount: number;
     }
     ```

3. Debounced re-verify when `mappings`, `assertions`, or `sampleResponseData` change (500ms debounce).

**Done when:** Hook returns `VerifyResult` with per-field and per-assertion pass/fail status.

---

#### Step 2: "Verify All" Toolbar Button (S)

**File:** `src/shared/components/data-mapper/MapperToolbar.tsx`

1. Add a "Verify All" button in the toolbar, visible when `capabilities.verification === true`.
2. On click, trigger verification via the hook (set `enabled = true`).
3. Show spinner while verification is running.
4. Button style: outlined with teal accent (matching type-check color theme).

**Done when:** Clicking "Verify All" runs all rules against sample data.

---

#### Step 3: "Fetch & Verify" Button (M)

**Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`

1. Add "Fetch & Verify" button next to "Verify All".
2. On click:
   - Send HTTP request using the adapter's `fetchSampleData()` method
   - Replace sample response with live response
   - Run all verification against the live response
3. Show HTTP status in toolbar: "HTTP 200" badge + verify results.
4. Disabled if adapter doesn't provide `fetchSampleData`.

**Done when:** Clicking "Fetch & Verify" sends a request and shows per-rule results against the live response.

---

#### Step 4: "Auto-verify" Toggle (M)

**Files:** `src/shared/components/data-mapper/MapperToolbar.tsx`, `src/shared/components/data-mapper/DataMapper.tsx`

1. Add "Auto-verify" checkbox toggle next to the verify buttons.
2. When enabled, `useValidationVerify` re-runs verification (debounced 500ms) whenever rules change.
3. Show a small spinning indicator during auto-verify.
4. State persisted in component state (not localStorage — session-only).

**Done when:** Toggling auto-verify causes rules to be re-verified on every change.

---

#### Step 5: Per-Node Pass/Fail Indicator (M)

**File:** `src/shared/components/data-mapper/TargetTreeNode.tsx`

1. Accept `verifyStatus?: 'pass' | 'fail' | undefined` prop on `TargetTreeNode`.
2. When `verifyStatus` is set, render a badge next to the operator pill:
   - Pass: small green "✓" badge
   - Fail: small red "✗" badge with tooltip showing actual vs expected
3. Badge CSS: `.dm-verify-pass`, `.dm-verify-fail` — small, non-intrusive indicators.

**Done when:** Mapped target nodes show pass/fail indicators after verification.

---

#### Step 6: Per-Rule Pass/Fail in Array Assertion Rows (S)

**File:** `src/shared/components/data-mapper/DataMapper.tsx`

1. Pass `verifyResult` to array assertion row components.
2. Each row shows ✓ or ✗ badge based on the corresponding assertion result.
3. Failed rows show actual value in a subtle tooltip.

**Done when:** Array assertion rows display pass/fail status.

---

#### Step 7: Rules Summary Table — Status Column (M)

**File:** `src/shared/components/data-mapper/CodeView.tsx` or `MappingTableView.tsx`

1. Add a "Status" column to the rules/table view.
2. For each row: show "✓ Pass" (green), "✗ Fail" (red with actual vs expected), or "— Skipped" (gray).
3. Sortable by status (failures first).

**Done when:** The rules table shows verification status per rule.

---

#### Step 8: Footer Aggregated Status (S)

**File:** `src/shared/components/data-mapper/DataMapper.tsx`

1. When verification results are available, show aggregated status in the mapper footer:
   ```
   12 mapped  |  ✓ 11 passed · ✗ 1 failed
   ```
2. Clicking "1 failed" could filter the tree to show only failed rules.

**Done when:** Footer displays verification aggregate.

---

#### Step 9: Canvas Lines — Red Stroke for Failures (S)

**File:** `src/shared/components/data-mapper/MappingCanvas.tsx`

1. Accept `failedMappingIds?: Set<string>` from the verify result.
2. Draw lines for failed mappings in red stroke (replacing the normal accent color).
3. Failed lines get a small "✗" badge at the midpoint.

**Done when:** Failed mapping lines are visually distinct on the canvas.

---

#### Step 10: Failure Detail Inline on Target Nodes (M)

**File:** `src/shared/components/data-mapper/TargetTreeNode.tsx`

1. When a target node's verification fails, show the actual vs expected value inline (similar to trace overlay):
   ```
   offerName  = equals  offers[0].offerName  = OnStar One  ✗ Got: "OnStar Two"
   ```
2. Keep compact — truncate long values with "..." and show full value on hover.
3. Style: `.dm-verify-actual` — red subtle text next to the mapping info.

**Done when:** Failed target nodes show the actual value that caused the failure.

---

#### Step 11: Target Panel Filter — Passed/Failed (S)

**File:** `src/shared/components/data-mapper/TargetPanel.tsx`

1. Add "Passed" and "Failed" options to the target panel filter dropdown (alongside existing "All", "Mapped", "Unmapped").
2. "Failed" filter shows only nodes where verification failed.
3. "Passed" filter shows only nodes where verification passed.
4. Only visible when verification results are available.

**Done when:** Users can filter the target tree by verification status.

---

#### Step 12: Rules Table Filter — Failed Only / Passed Only (S)

**File:** `src/shared/components/data-mapper/CodeView.tsx`

1. Add filter options in the rules table: "All", "Failed only", "Passed only".
2. Filter applies to the displayed rows.

**Done when:** Rules table supports filtering by verification status.

---

#### Step 13: Bridge to Validator Engine (M)

**File:** `src/shared/components/data-mapper/hooks/useValidationVerify.ts`

1. Wire `validateFields()` for `ExpectedField[]` evaluation (field operators from Phase 1).
2. Wire `evaluateAssertions()` for standalone assertions (typeCheck, existence from Phase 2; collection assertions from Phase 3).
3. Build `AssertionContext` from sample data: HTTP status defaults to 200, response time to 0, headers to `{}`, body to `sampleResponseData`.
4. Merge field-level failures and assertion-level failures into the unified `VerifyResult`.

**Done when:** All rule types (field operators, standalone assertions, collection assertions) are evaluated in the verify flow.

---

#### Step 14: Unit Tests — Verify Hook (M)

**File:** `src/shared/components/data-mapper/hooks/useValidationVerify.test.ts` (new)

- Verify passes when all rules match sample data
- Verify fails when a field operator doesn't match
- Verify fails when a standalone assertion fails
- Per-field results map correctly to target paths
- Auto-verify re-runs on mapping change (debounced)
- Empty mappings → 0 passed, 0 failed
- Mixed pass/fail → correct counts

**Done when:** All verify hook tests pass.

---

#### Step 15: Integration Tests (M)

**File:** `src/shared/components/data-mapper/DataMapper.test.tsx`

- Click "Verify All" → pass/fail indicators appear
- Failed nodes show red badge
- Footer shows aggregate status
- Canvas lines turn red for failures
- Filter by "Failed" shows only failing nodes

**Done when:** Integration tests confirm the full verify flow.

---

#### Step 16: E2E Test (M)

**File:** `e2e/validation-rules-visual-mapper-clear.spec.ts`

- Open mapper with validation adapter
- Add mappings with operators
- Click "Verify All"
- Assert pass/fail badges visible
- Assert footer status text

**Done when:** E2E test passes.

---

#### Step 17: TypeScript Check & Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Verify no regressions

---

#### Phase 5 Deliverable Criteria

- [ ] `useValidationVerify` hook with per-field and per-assertion results
- [ ] "Verify All" button in toolbar
- [ ] "Fetch & Verify" button for live HTTP request + verify
- [ ] "Auto-verify" toggle with debounced re-verification
- [ ] Per-node pass/fail badges on target tree nodes
- [ ] Per-rule pass/fail in array assertion rows
- [ ] Status column in rules table
- [ ] Footer aggregated status ("N passed · M failed")
- [ ] Red canvas lines for failed mappings
- [ ] Inline failure detail on target nodes (actual vs expected)
- [ ] Target panel filter: Passed / Failed
- [ ] Rules table filter: Failed only / Passed only
- [ ] Bridge to `validateFields()` + `evaluateAssertions()`
- [ ] 15+ unit tests for verify hook
- [ ] Integration tests for full verify flow
- [ ] E2E test for verify workflow
- [ ] `npx tsc -b --noEmit` passes

---

### Phase 6: Schema Validation (Medium — GAP-09)

**Goal:** Support JSON Schema (Draft 2020-12) validation against response bodies, enabling users to validate structural contracts — required fields, types, value constraints, and nested structures — using the industry-standard JSON Schema format.

---

#### Step 1: Type Definition (S)

**File:** `src/shared/types/index.ts`

1. Add `jsonSchema` to the `Assertion` union:
   ```typescript
   | { type: 'jsonSchema'; schema: string }
   ```
2. `schema` is a JSON-stringified JSON Schema document.

**Done when:** TypeScript compiles with the new union member.

---

#### Step 2: Install Ajv Dependency (S)

**File:** `package.json`

1. Install Ajv (Another JSON Validator) — the most widely used JSON Schema validator for JavaScript:
   ```bash
   npm install ajv ajv-formats
   ```
2. `ajv` for core JSON Schema Draft 2020-12 support.
3. `ajv-formats` for format validation (`email`, `date`, `uri`, `uuid`, etc.).

**Done when:** `ajv` and `ajv-formats` are in dependencies.

---

#### Step 3: Validator Engine — `jsonSchema` Case (M)

**File:** `src/engine/validator.ts`

1. Add `case 'jsonSchema'` to `evaluateAssertions`:
   ```typescript
   case 'jsonSchema': {
     try {
       const schema = JSON.parse(a.schema);
       const ajv = new Ajv({ allErrors: true });
       addFormats(ajv);
       const validate = ajv.compile(schema);
       const valid = validate(ctx.responseBody);
       if (!valid && validate.errors) {
         for (const err of validate.errors.slice(0, 10)) {
           failures.push({
             path: `(jsonSchema:${err.instancePath || '/'})`,
             expected: err.message ?? 'schema validation',
             actual: `violation at ${err.instancePath}: ${err.keyword}`,
           });
         }
       }
     } catch (e) {
       failures.push({
         path: '(jsonSchema)',
         expected: 'valid JSON Schema',
         actual: e instanceof Error ? e.message : 'invalid schema',
       });
     }
     break;
   }
   ```
2. Limit to first 10 errors to avoid flooding the failure list.
3. Lazy-initialize Ajv instance (create once, reuse).

**Done when:** `jsonSchema` assertions evaluate against response body and report per-path failures.

---

#### Step 4: Schema Editor / Paste UI (M)

**File:** `src/features/scenarios/components/TestEditorValidationTab.tsx`

1. Add "JSON Schema" button to the "+ Add" assertion dropdown:
   - Icon: `📐` | Label: "JSON Schema" | Desc: "Validate against a JSON Schema document"
   - Default: `addAssertion({ type: 'jsonSchema', schema: '{}' })`

2. Inline editing row for `jsonSchema`:
   - Multi-line textarea (or Monaco Editor mini) for the schema JSON
   - "Paste Schema" button for quick paste
   - "Generate from Response" button (links to Step 5)
   - Syntax validation: red border if schema JSON is invalid

**Done when:** Users can add, paste, and edit JSON Schema assertions.

---

#### Step 5: Auto-Generate Schema from Sample Response (L)

**File:** `src/shared/components/data-mapper/utils/schemaGenerator.ts` (new)

1. Implement `generateJsonSchema(sampleData: unknown): object`:
   - Recursively traverse the sample JSON
   - Infer `type` for each node (`string`, `number`, `integer`, `boolean`, `array`, `object`, `null`)
   - For objects: set `required` to all keys found in sample, `properties` for each key
   - For arrays: infer `items` schema from first element (or union if heterogeneous)
   - For strings: detect common formats (`email`, `date`, `uri`, `uuid`) and set `format`
   - Set `additionalProperties: false` by default (strict mode)

2. Add "Generate Schema" button in the schema editor row that calls this utility with the current sample response.

3. Options:
   - `strict: boolean` — if true, `additionalProperties: false` and all fields `required`
   - `lenient: boolean` — if true, `additionalProperties: true` and no `required`
   - Default: strict mode

**Done when:** Clicking "Generate Schema" produces a valid JSON Schema from the sample response.

---

#### Step 6: Unit Tests (M)

**File:** `src/engine/validator.validate.test.ts`

- Valid schema against matching response → pass
- Missing required field → fail with path
- Wrong type → fail with type mismatch
- Additional properties violation → fail
- Format validation (`email`, `date`) → pass/fail
- Invalid schema JSON → fail with parse error
- Empty schema `{}` → always pass
- Nested object schema → validates recursively
- Array items schema → validates each element
- Schema with `enum` constraint
- Schema with `minimum`/`maximum`

**File:** `src/shared/components/data-mapper/utils/schemaGenerator.test.ts` (new)

- Generate schema from simple object
- Generate schema from nested object
- Generate schema from array of objects
- Detect string formats (email, date, uuid)
- Strict mode → `required` + `additionalProperties: false`
- Lenient mode → no `required` + `additionalProperties: true`
- Heterogeneous array → union type in items

**Done when:** All tests pass.

---

#### Step 7: TypeScript Check & Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Verify no regressions

---

#### Phase 6 Deliverable Criteria

- [ ] `jsonSchema` assertion type in `Assertion` union
- [ ] Ajv integration with format support
- [ ] `evaluateAssertions()` handles `jsonSchema` with per-path error reporting
- [ ] Schema editor UI with paste and multi-line editing
- [ ] Auto-generate schema from sample response utility
- [ ] Test Editor "+ Add" menu includes "JSON Schema" option
- [ ] 15+ unit tests for schema validation
- [ ] 10+ unit tests for schema generator
- [ ] `npx tsc -b --noEmit` passes

---

### Phase 7: Expression Engine Enrichment (Medium — Part 5 gaps)

**Goal:** Add the most impactful missing transformation functions to the expression engine, prioritized by competitive benchmark frequency and user workflow impact. These functions are available to all adapters via the shared expression evaluator.

---

#### Step 1: Higher-Order Array Functions — High Priority (L)

**File:** `src/features/workflow/utils/expressionFunctions.ts`

Register 5 new functions:

1. **`$sum(array)`** — Sum numeric array elements
   - Input: array of numbers (or path resolving to array)
   - Returns: number (sum)
   - Edge cases: empty array → 0, non-numeric elements → skip or NaN

2. **`$average(array)`** — Average of numeric array
   - Input: array of numbers
   - Returns: number (mean)
   - Edge cases: empty array → 0, single element → that element

3. **`$groupBy(array, key)`** — Group array elements by key
   - Input: array of objects, key path string
   - Returns: object where keys = unique values, values = arrays of matching elements
   - Example: `$groupBy(orders, "status")` → `{ "active": [...], "cancelled": [...] }`

4. **`$any(array, field, operator, value)`** — True if any element matches condition
   - Input: array, field path, comparison operator, value
   - Returns: boolean
   - Example: `$any(offers, "rank", ">", 5)` → true if any offer has rank > 5

5. **`$all(array, field, operator, value)`** — True if all elements match condition
   - Input: array, field path, comparison operator, value
   - Returns: boolean

**Done when:** All 5 functions are registered, evaluate correctly, and appear in the expression editor function catalog.

---

#### Step 2: String Utilities — Medium Priority (M)

**File:** `src/features/workflow/utils/expressionFunctions.ts`

Register 5 new functions:

1. **`$substringBefore(str, separator)`** — Substring before first occurrence of separator
2. **`$substringAfter(str, separator)`** — Substring after first occurrence of separator
3. **`$capitalize(str)`** — Capitalize first letter of string
4. **`$camelCase(str)`** — Convert to camelCase (`"hello world"` → `"helloWorld"`)
5. **`$snakeCase(str)`** — Convert to snake_case (`"helloWorld"` → `"hello_world"`)

**Done when:** All 5 functions work correctly with edge cases (empty string, no separator found, etc.).

---

#### Step 3: Object Utilities — Medium Priority (M)

**File:** `src/features/workflow/utils/expressionFunctions.ts`

Register 5 new functions:

1. **`$has(obj, key)`** — Check if object has a key (returns boolean)
2. **`$toEntries(obj)`** — Convert object to `[{key, value}]` array
3. **`$fromEntries(arr)`** — Convert `[{key, value}]` array to object
4. **`$pick(obj, keys)`** — Return new object with only specified keys (`keys` is comma-separated string)
5. **`$omit(obj, keys)`** — Return new object excluding specified keys

**Done when:** All 5 functions work correctly.

---

#### Step 4: Math Utilities — Low Priority (S)

**File:** `src/features/workflow/utils/expressionFunctions.ts`

Register 4 new functions:

1. **`$sqrt(n)`** — Square root
2. **`$clamp(n, min, max)`** — Clamp number to range
3. **`$uuid()`** — Generate UUID v4 (using crypto.randomUUID or fallback)
4. **`$range(start, end, step?)`** — Generate array of numbers from start to end

**Done when:** All 4 functions work correctly.

---

#### Step 5: Update Expression Editor Function Catalog (S)

**File:** `src/shared/components/data-mapper/utils/transformationLibrary.ts`

1. Add all 19 new functions to the transformation library catalog with:
   - Name, description, category, example usage, parameter descriptions
2. Group them appropriately:
   - "Array Operations" → `$sum`, `$average`, `$groupBy`, `$any`, `$all`
   - "String" → `$substringBefore`, `$substringAfter`, `$capitalize`, `$camelCase`, `$snakeCase`
   - "Object" → `$has`, `$toEntries`, `$fromEntries`, `$pick`, `$omit`
   - "Math" → `$sqrt`, `$clamp`, `$uuid`, `$range`

**Done when:** All new functions appear in the expression editor sidebar with descriptions.

---

#### Step 6: Unit Tests (L)

**File:** `src/features/workflow/utils/expressionFunctions.test.ts`

For each of the 19 functions, add tests covering:
- Normal case → correct result
- Edge cases (empty input, missing args, wrong types)
- Type coercion behavior
- Error handling (invalid args → graceful error message)

Target: 60+ new tests.

**Done when:** All function tests pass.

---

#### Step 7: TypeScript Check & Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run `expressionFunctions.test.ts`
3. Verify existing expression tests still pass

---

#### Phase 7 Deliverable Criteria

- [ ] 5 higher-order array functions (`$sum`, `$average`, `$groupBy`, `$any`, `$all`)
- [ ] 5 string utility functions (`$substringBefore`, `$substringAfter`, `$capitalize`, `$camelCase`, `$snakeCase`)
- [ ] 5 object utility functions (`$has`, `$toEntries`, `$fromEntries`, `$pick`, `$omit`)
- [ ] 4 math utility functions (`$sqrt`, `$clamp`, `$uuid`, `$range`)
- [ ] All 19 functions in expression editor catalog with descriptions
- [ ] 60+ new unit tests
- [ ] `npx tsc -b --noEmit` passes

---

### Phase 8: Nice-to-Have Operators (Low — GAP-12 through GAP-16)

**Goal:** Add remaining lower-priority assertion types and operators to close the final competitive gaps. These are individually small but collectively round out the assertion vocabulary.

**Note:** Phase 1 already implemented `in`, `not_in`, `between`, and `close_to` as `FieldOperator` values on `ExpectedField`. Phase 8 adds them as **standalone `Assertion` types** (like Phase 2 did for `typeCheck`/`existence`) and adds `bodySize` and enhanced date precision.

---

#### Step 1: Type Definitions — New Assertion Types (S)

**File:** `src/shared/types/index.ts`

Add to the `Assertion` union:
```typescript
| { type: 'bodySize'; operator: ComparisonOperator; value: number }
| { type: 'datePrecise'; jsonPath: string; operator: ComparisonOperator; reference: string; precision: 'day' | 'hour' | 'minute' | 'second' | 'millisecond' }
```

**Done when:** TypeScript compiles.

---

#### Step 2: Validator Engine — New Cases (M)

**File:** `src/engine/validator.ts`

1. Add `case 'bodySize'`:
   - Calculate response body size: `new TextEncoder().encode(JSON.stringify(ctx.responseBody)).length`
   - Compare against `a.value` using `a.operator`
   - Report failure with actual vs expected byte size

2. Add `case 'datePrecise'`:
   - Resolve JSON path to get date string
   - Parse both actual and reference as ISO 8601 datetime
   - Truncate both to the specified precision level before comparison
   - Compare using the specified operator
   - Report failure with formatted dates at the precision level

**Done when:** Both new cases evaluate correctly.

---

#### Step 3: Assertion UI — "+ Add" Menu (S)

**File:** `src/features/scenarios/components/TestEditorValidationTab.tsx`

1. Add two new buttons:
   - **Body Size:** `addAssertion({ type: 'bodySize', operator: '<=', value: 10000 })`
     - Icon: `📦` | Label: "Body Size" | Desc: "Assert response body size in bytes"
   - **Date (Precise):** `addAssertion({ type: 'datePrecise', jsonPath: '', operator: '>', reference: new Date().toISOString(), precision: 'second' })`
     - Icon: `🕐` | Label: "Date Precise" | Desc: "Compare datetime with time precision"

2. Inline editing rows:
   - **`bodySize` row:** operator dropdown + byte value input
   - **`datePrecise` row:** JSON path input + operator dropdown + reference datetime input + precision dropdown (`day`/`hour`/`minute`/`second`/`millisecond`)

**Done when:** Users can add and edit both assertion types.

---

#### Step 4: SetupStepValidate Support (S)

**File:** `src/features/scenarios/components/SetupStepValidate.tsx`

1. Render `bodySize` assertion: badge "SIZE" + operator + byte value
2. Render `datePrecise` assertion: badge "DATE" + path + operator + reference + precision

**Done when:** SetupStepValidate correctly displays new assertion types.

---

#### Step 5: Unit Tests (M)

**File:** `src/engine/validator.validate.test.ts`

**bodySize tests (6+ tests):**
- Body <= 10000 bytes → pass
- Body > 10000 bytes → fail with actual size
- Empty body → pass for `>= 0`
- Large body → fail for `< 100`
- Operator `=` exact size match
- Operator `!=` size inequality

**datePrecise tests (10+ tests):**
- Same day, different time, precision `day` → equal
- Same day, different time, precision `hour` → not equal (different hours)
- Precision `second` → compares to the second
- Precision `millisecond` → full precision comparison
- Greater than with `hour` precision
- Missing path → fail
- Invalid date string → fail
- ISO 8601 with timezone offset
- UTC vs local timezone handling
- Reference as ISO string

**Done when:** All tests pass.

---

#### Step 6: TypeScript Check & Verification (S)

1. `npx tsc -b --noEmit` — zero errors
2. Run all touched test files
3. Verify no regressions

---

#### Phase 8 Deliverable Criteria

- [ ] `bodySize` and `datePrecise` assertion types in `Assertion` union
- [ ] `evaluateAssertions()` handles both new types
- [ ] Test Editor "+ Add" menu includes "Body Size" and "Date Precise" options
- [ ] Inline editing rows for both types
- [ ] SetupStepValidate badge rendering
- [ ] 16+ new unit tests
- [ ] `npx tsc -b --noEmit` passes

---

## Part 7: Tool-by-Tool Feature Matrix

### Assertion Operators Matrix

| Operator | Postman | Karate | Hurl | Bruno | StepCI | REST Assured | JMeter | Gatling | k6 | Artillery | Pact | **RedfireForge** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Exact equality | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | **Partial** (assertions only, not ExpectedField) |
| Not equals | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | **No** |
| Greater than | Y | Y | Y | Y | Y | Y | — | Y | Y | — | — | **Partial** (numeric/date only) |
| Less than | Y | Y | Y | Y | Y | Y | — | Y | Y | — | — | **Partial** (numeric/date only) |
| Contains (string) | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **No** (header only) |
| Starts with | Y | — | Y | Y | — | Y | — | — | Y | — | — | **No** |
| Ends with | Y | — | Y | Y | — | Y | — | — | Y | — | — | **No** |
| Regex match | Y | Y | Y | Y | Y | Y | Y | — | Y | Y | Y | **Yes** |
| Is true / false | Y | Y | Y | Y | — | — | — | — | Y | — | — | **No** |
| Is null | Y | Y | — | Y | Y | Y | — | Y | Y | — | Y | **No** |
| Is type | Y | Y | Y | Y | Y | Y | — | — | Y | — | Y | **No** |
| Exists | Y | Y | Y | Y | Y | — | — | Y | Y | Y | — | **No** (header only) |
| Is empty | Y | — | Y | Y | — | Y | — | — | Y | — | — | **No** |
| Array length | Y | Y | Y | Y | — | Y | — | Y | Y | — | Y | **Yes** |
| Array contains | Y | Y | Y | — | — | Y | — | — | Y | — | — | **No** |
| Each element | Y | Y | — | — | — | Y | — | — | Y | — | — | **No** |
| In / not in | — | Y | — | Y | Y | — | — | Y | Y | — | — | **No** |
| Between / range | Y | — | — | Y | — | — | — | — | — | — | — | **No** |
| Deep partial | Y | Y | — | — | — | Y | — | — | — | — | — | **No** |
| JSON Schema | Y | Y | — | — | Y | Y | Y | — | — | — | Y | **No** |
| Negation (any) | Y | Y | Y | — | — | Y | Y | — | Y | — | — | **No** |
| Has property | Y | Y | — | — | — | Y | — | — | Y | Y | — | **No** |
| Custom predicate | Y | Y | — | — | — | Y | Y | Y | Y | — | — | **No** |
| Response size | — | — | Y | — | — | — | Y | Y | Y | — | — | **No** |

### Authoring & Verification Matrix

| Capability | Postman | Karate | Hurl | Bruno | StepCI | REST Assured | JMeter | Gatling | k6 | Artillery | Pact | **RedfireForge** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Visual UI authoring | Y | — | — | Y | — | — | Y | — | — | — | — | **Yes** |
| Code/DSL authoring | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | **No** |
| Bi-directional sync (visual ↔ code) | — | — | — | Y | — | — | Partial | — | — | — | — | **No** |
| In-context verify (without leaving editor) | Y | Y | Y | Y | — | — | Y | — | — | — | — | **No** (Test Editor only) |
| Per-rule pass/fail inline | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **No** |
| Live fetch + verify | Y | Y | Y | Y | — | Y | Y | — | Y | — | — | **Partial** (Test Editor only) |
| Auto-verify on change | — | — | — | — | — | — | — | — | — | — | — | **No** |
| Filter by pass/fail | — | — | — | — | — | — | — | — | — | — | — | **No** |

### Coverage Score

| Tool | Operators (of 25) | Authoring (of 8) | Total (of 33) | Coverage |
|---|---|---|---|---|
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
| **RedfireForge** | **5** | **2** | **7** | **21%** |

**Note:** After implementing all phases (0–8), RedfireForge would score **33/33 (100%)** — the only tool offering a **unified visual mapper** (reused across 11+ contexts) + code authoring + bi-directional sync + auto-verify + per-rule inline pass/fail + filter by status. This combination does not exist in any competing tool today. Critically, the capability-gated architecture (Phase 0) ensures operator features only appear in contexts that declare them, keeping simpler adapters clean.

---

## References

### Commercial Tools
- Postman: https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-examples
- Chai.js (Postman's assertion engine): https://www.chaijs.com/api/bdd/
- Karate DSL: https://docs.karatelabs.io/api-reference/keywords
- REST Assured: https://github.com/rest-assured/rest-assured/wiki/Usage
- SoapUI/ReadyAPI: https://support.smartbear.com/readyapi/docs/en/test-apis-with-readyapi/verifying-results
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
