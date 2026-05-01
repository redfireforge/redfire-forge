# Training Paths Plan — Workflow Patterns, Auth Strategies, Assertion Mastery

> Companion to `Versioning-Training-Manaulal-Plan.md`. Covers the 3 remaining training paths shown as "soon" in the Gallery sidebar.

---

## Overview

| Training Path | ID | Icon | Manual Count | Phases | Key Source Files |
|---|---|---|---|---|---|
| Workflow Patterns | `workflow-patterns` | ⚡ | 12 | 4 phases | `graphRunner.ts`, `graphRunnerNodeHandlers.ts`, node components |
| Auth Strategies | `auth-strategies` | 🔐 | 8 | 3 phases | `tokenManager.ts`, `authResolver.ts`, `requestAuthState.ts`, `CatalogAuthPanel.tsx` |
| Assertion Mastery | `assertion-mastery` | ✅ | 10 | 3 phases | `validator.ts`, `TestEditorValidationTab.tsx`, `JsonPathBuilder.tsx`, assertion presets |

**Total: 30 manuals** across 10 phases.

---

## Training Path 1: Workflow Patterns ⚡

### Description
Learn conditional branching, parallel execution, error handling, loops, and sub-workflow composition patterns.

### Available Node Types (20 total)
From `WorkflowNodeType`:
```
'http' | 'condition' | 'delay' | 'start' | 'fork' | 'join' | 'end' |
'webhook' | 'schedule' | 'switch' | 'loop' | 'setVariable' |
'aggregate' | 'errorHandler' | 'logDebug' | 'waitForCondition' |
'subWorkflow' | 'script' | 'correlationWait'
```

### Source Code Reference

| File | Purpose | Lines |
|---|---|---|
| `src/features/workflow/types/workflow.ts` | All node data interfaces + `WorkflowNodeType` union | ~420 |
| `src/features/workflow/engine/graphRunner.ts` | Core execution engine — topological traversal | ~314 |
| `src/features/workflow/engine/graphRunnerNodeHandlers.ts` | Per-node-type execution handlers | ~800+ |
| `src/features/workflow/engine/graphRunnerHelpers.ts` | `evaluateCondition`, `collectReachableFromEdges`, `markSubtreeSkipped` | ~200 |
| `src/features/workflow/engine/variableContext.ts` | Variable resolution, `{{var}}` interpolation, per-node scoping | ~150 |
| `src/features/workflow/engine/scriptSandbox.ts` | Script node execution sandbox | ~100 |
| `src/features/workflow/engine/scriptLibraries.ts` | Script library loading + preamble building | ~80 |
| `src/features/workflow/engine/correlationStore.ts` | Correlation-based pause/resume for webhook callbacks | ~100 |
| `src/features/workflow/engine/debugController.ts` | Step-through debugging, breakpoints, pause/resume | ~150 |
| `src/features/workflow/utils/workflowExtractSubWorkflow.ts` | Extract selected nodes into child workflow | ~161 |
| `src/features/workflow/utils/workflowHostResolve.ts` | Base URL resolution — service registry, env, profile | ~120 |

### Gallery Workflow Samples Available

| Sample | ID | Nodes | Key Patterns |
|---|---|---|---|
| Create → Extract → Verify | `sample-workflow-001` | 3+ | HTTP chaining, variable extraction |
| Webhook Trigger | `sample-workflow-webhook` | 5+ | Webhook trigger, HTTP, delay |
| Sub-Workflow Orchestrator | `sample-workflow-sub-workflow` | 9 | Sub-workflow, loop, retry, forEach |
| Order Pipeline | `sample-workflow-order-pipeline` | 8 | Condition branching, sub-workflow, shipping |
| Multi-Region Deploy | `sample-workflow-deploy-orchestrator` | 12 | Fork/Join, multi-instance, dynamic rollback |
| Error Handler | `sample-workflow-wf-error-handler` | 9 | Workflow-level error handling, notification |

---

### WP-Phase 1: Foundation Nodes (Easy)

Covers: Start, End, HTTP, Delay, SetVariable, LogDebug — the building blocks.

#### 1. `workflow-http-chaining-easy.html` — HTTP Request Chaining
- **Difficulty:** Easy
- **Gallery Sample:** `sample-workflow-001`
- **Real-world scenario:** *"User Lookup → Extract ID → Fetch Details"*
- **Topics covered:**
  - Start/End nodes and workflow structure
  - HTTP node: method, URL, headers, body, auth
  - Variable extraction: `{{response.body.id}}` → next node
  - `VariableContext` — set/get/resolve, per-node scoping
  - Response detail in node state (status code, response time, body preview)
  - Workflow console log prefixes: `>` request, `<` response, `#` extraction, `*` status, `!` error
- **Exercises:**
  1. Chain 3 HTTP nodes: GET list → extract first ID → GET detail by ID
  2. Add a SetVariable node between steps to transform data
  3. Add a LogDebug node to inspect variables mid-flow

#### 2. `workflow-delay-timing-easy.html` — Delays and Timing
- **Difficulty:** Easy
- **Gallery Sample:** None (create from scratch)
- **Real-world scenario:** *"Rate-Limited API — Spacing Requests"*
- **Topics covered:**
  - Delay node: fixed mode (`delayMs`) and random mode (`minMs`–`maxMs`)
  - Use case: rate limiting, polling intervals, think time simulation
  - Delay node display: shows `500ms` or `100–500ms` range
  - Combining delays with HTTP nodes for paced execution
- **Exercises:**
  1. Create a workflow with 3 HTTP calls spaced by 1000ms delays
  2. Use random delay (200–800ms) to simulate realistic user behavior
  3. Compare execution time with and without delays

#### 3. `workflow-variables-easy.html` — Variables and Context
- **Difficulty:** Easy
- **Gallery Sample:** None
- **Real-world scenario:** *"Building a Dynamic URL from Environment Variables"*
- **Topics covered:**
  - Initial variables (set before run)
  - Environment layer (`environmentLayer`) — low-priority variables
  - `{{variable}}` interpolation in any field
  - SetVariable node: assignments array `[{ name, expression }]`
  - LogDebug node: log template with variable interpolation
  - Per-node variable scoping: `ctx.setForNode(nodeId, key, value)`
  - Built-in runtime variables: `httpStatus`, `status`, `responseBody`
- **Exercises:**
  1. Set `baseUrl` as initial variable, use in HTTP nodes
  2. Use SetVariable to compute a derived value
  3. Use LogDebug to print all variables at different stages

---

### WP-Phase 2: Branching and Flow Control (Medium)

Covers: Condition, Switch, Fork/Join — controlling execution flow.

#### 4. `workflow-condition-branching-medium.html` — If/Else Conditions
- **Difficulty:** Medium
- **Gallery Sample:** `sample-workflow-order-pipeline`
- **Real-world scenario:** *"Order Processing — Express vs Standard Shipping"*
- **Topics covered:**
  - ConditionNode: `left`, `operator`, `right` fields
  - Operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `matches`, `exists`
  - Yes/No branches via `sourceHandle: 'true'` / `'false'`
  - Subtree skipping: `markSubtreeSkipped()` marks entire untaken branch as skipped
  - Multiple edges per branch (parallel after condition)
  - Variable resolution in condition operands
- **Exercises:**
  1. Create a condition that routes based on HTTP status code
  2. Build a 3-way branch: success → process, 404 → create, 5xx → error handler
  3. Use `contains` operator to check response body content

#### 5. `workflow-switch-multiway-medium.html` — Switch Multi-Way Routing
- **Difficulty:** Medium
- **Gallery Sample:** None
- **Real-world scenario:** *"API Response Router — Different Handlers per Status Class"*
- **Topics covered:**
  - SwitchNode: expression + cases array with `value` and edge targets
  - Default case handling
  - When to use Switch vs Condition (2-way vs N-way)
  - Variable interpolation in switch expression
- **Exercises:**
  1. Build a switch that routes to 3 different HTTP nodes based on a variable
  2. Add a default branch for unmatched cases
  3. Compare with nested Condition nodes for the same logic

#### 6. `workflow-fork-join-medium.html` — Parallel Execution
- **Difficulty:** Medium
- **Gallery Sample:** `sample-workflow-deploy-orchestrator`
- **Real-world scenario:** *"Multi-Region Health Check — Parallel Pings"*
- **Topics covered:**
  - Fork node: splits execution into parallel branches
  - Join node: barrier — waits until all incoming branches arrive
  - Join `arrived/expected` counter: `joinArrived.get(nodeId)` vs `incomingCount.get(nodeId)`
  - Thread IDs: each fork branch gets a unique `threadId`
  - Waiting state display: `"waiting (2/3)"`
  - Result aggregation after join
- **Exercises:**
  1. Fork into 3 parallel HTTP requests to different endpoints
  2. Observe join waiting behavior with different response times
  3. Add a SetVariable after Join to aggregate results

---

### WP-Phase 3: Loops, Aggregation, and Error Handling (Medium–Advanced)

#### 7. `workflow-loop-patterns-medium.html` — Loops: Count, ForEach, While
- **Difficulty:** Medium
- **Gallery Sample:** `sample-workflow-sub-workflow`
- **Real-world scenario:** *"Batch User Processing — Iterate Over a List"*
- **Topics covered:**
  - Loop modes: `count` (N iterations), `forEach` (over collection), `while` (condition-based)
  - Loop node handles: `body` (loop iteration) and `done` (after loop)
  - `maxIterations` safety limit (default 100)
  - `countExpression` — dynamic count via variable
  - `itemVariable` — current element name in forEach
  - `collectionExpression` — the array to iterate
  - `whileLeft`, `whileOperator`, `whileRight` — while condition
  - Loop badge display: `×5`, `∀ item`, `left == right`
- **Exercises:**
  1. Use count loop to make 5 sequential requests
  2. Use forEach to iterate over a JSON array from a previous response
  3. Use while loop to poll until a condition is met

#### 8. `workflow-aggregate-medium.html` — Aggregation Patterns
- **Difficulty:** Medium
- **Gallery Sample:** None
- **Real-world scenario:** *"Collecting Results from Parallel Branches"*
- **Topics covered:**
  - AggregateNode: mappings array `[{ id, sourceExpression, targetVariable, strategy }]`
  - Aggregation strategies: append, overwrite, merge
  - Combining with Fork/Join for parallel collection
  - Combining with Loop for iterative accumulation
  - Badge display: `"3 mappings"`
- **Exercises:**
  1. Aggregate responses from 3 forked HTTP requests
  2. Use aggregate inside a loop to build an array
  3. Compare append vs overwrite strategies

#### 9. `workflow-error-handling-advanced.html` — Error Handling Strategies
- **Difficulty:** Advanced
- **Gallery Sample:** `sample-workflow-wf-error-handler`
- **Real-world scenario:** *"Payment Flow with Failure Notification"*
- **Topics covered:**
  - Node-level try/catch in `visit()`: each node failure is caught, logged, and state set to `fail`
  - Error handler node: `ErrorHandlerNodeData`
  - Workflow-level error config: `WorkflowErrorConfig` with `mode: 'run-handler'`
  - `handlerEntryNodeId` — entry point for the error subgraph
  - Error variables injected: `error.message`, `error.statusCode`, `error.failedCount`
  - Unvisited End nodes marked `fail` when any step fails
  - `summarizeRequestFailure()` — human-readable error from `RequestResult`
  - `humanizeError()` — friendly error messages
- **Exercises:**
  1. Create a workflow where one HTTP node intentionally fails
  2. Add a workflow-level error handler that sends a notification
  3. Inspect error variables in the handler subgraph

---

### WP-Phase 4: Sub-Workflows and Advanced Patterns (Advanced)

#### 10. `workflow-sub-workflow-advanced.html` — Sub-Workflow Composition
- **Difficulty:** Advanced
- **Gallery Sample:** `sample-workflow-sub-workflow`
- **Real-world scenario:** *"Orchestrating Multi-Step Deploys with Reusable Child Workflows"*
- **Topics covered:**
  - SubWorkflowNode: `workflowId`, `workflowName`, `inputMappings`, `outputMappings`
  - Static picker vs dynamic expression (`{{workflowId}}`)
  - Input mappings: `sourceExpression` → `targetVariable` (parent → child)
  - Output mappings: `sourceVariable` → `targetVariable` (child → parent)
  - `propagateAllOutputs` — pass all child variables to parent
  - Multi-instance mode: `forEach` collection, `elementVariable`, `sequential`/`parallel`
  - Max depth limit (`maxDepth`) — prevents infinite recursion
  - Retry config: `retryCount`, `retryDelayMs`, `onFailure` (stop/continue)
  - `SubWorkflowRunSummary` — parent receives child execution details
  - `extractToSubWorkflow()` — refactor tool: select nodes → extract to child
- **Exercises:**
  1. Create parent + child workflow with input/output mappings
  2. Use multi-instance forEach to run child per item in an array
  3. Use "Extract to Sub-Workflow" to refactor an existing workflow

#### 11. `workflow-webhook-correlation-advanced.html` — Webhooks and Correlation Wait
- **Difficulty:** Advanced
- **Gallery Sample:** `sample-workflow-webhook`
- **Real-world scenario:** *"Payment Callback — Start Payment, Wait for Webhook Confirmation"*
- **Topics covered:**
  - WebhookTriggerNode: external event triggers workflow start
  - ScheduleTriggerNode: time-based workflow triggers
  - CorrelationWaitNode: pause workflow, wait for matching webhook callback
  - Correlation matching: `correlationIdExpression`, `webhookPath`, `correlationSource` (body/header/query)
  - `correlationJsonPath` — JSONPath to extract correlation ID from webhook payload
  - `extractVariables` — pull data from webhook into workflow context
  - `timeoutMs` — fail if no callback within timeout
  - `webhookFilter` — optional expression to validate webhook payload
  - `ICorrelationStore` — the store that holds pending correlations
- **Exercises:**
  1. Create a workflow: HTTP POST (start payment) → CorrelationWait → HTTP GET (confirm)
  2. Configure correlation matching by body field
  3. Set timeout and observe failure behavior

#### 12. `workflow-debug-advanced.html` — Debugging Workflows
- **Difficulty:** Advanced
- **Gallery Sample:** Any
- **Real-world scenario:** *"Step-Through Debugging a Failing API Chain"*
- **Topics covered:**
  - DebugController: step-through execution, breakpoints
  - `waitForStep(nodeId, threadId)` — pause before each node
  - `markRunning(nodeId, threadId)` — resume execution
  - `isStopped` flag — user-initiated stop
  - `NodePausedOverlay` — visual indicator on canvas
  - Inspecting variables at each step
  - Join barrier debugging: `markWaitingJoin()`
  - Console log analysis: reading prefixed log lines
- **Exercises:**
  1. Set breakpoints on specific nodes, step through execution
  2. Inspect variable state at each breakpoint
  3. Debug a fork/join workflow — observe branch execution order

---

## Training Path 2: Auth Strategies 🔐

### Description
API Key, Bearer Token, OAuth2, Basic Auth, and chained auth flows across tests and workflows.

### Auth Types Supported
From `AuthConfig.type`:
```
'none' | 'inherit' | 'bearer' | 'basic' | 'apikey' | 'oauth2'
```
Plus: `GlobalAuthProfile`, environment auth fallback, catalog security scheme inheritance.

### Source Code Reference

| File | Purpose | Lines |
|---|---|---|
| `src/shared/types/index.ts` | `AuthConfig`, `AuthType`, `GlobalAuthProfile` interfaces | ~50 |
| `src/engine/tokenManager.ts` | OAuth2 token acquisition, JWT parsing, caching, dedup | ~87 |
| `src/features/requests/utils/authResolver.ts` | Auth inheritance chain: Test → Scenario → FG → Global → Env | ~33 |
| `src/features/requests/utils/requestAuthState.ts` | Modal auth state management, `authToState`/`stateToAuth` | ~61 |
| `src/shared/utils/authHeaders.ts` | Resolve auth config to HTTP headers | ~30 |
| `src/features/catalog/components/CatalogAuthPanel.tsx` | Catalog auth UI: inherit from spec, global profile, manual | ~200 |
| `src/features/catalog/utils/catalogCurlGenerator.ts` | cURL generation with auth headers | ~120 |
| `src/features/workflow/utils/workflowHostResolve.ts` | Per-node auth resolution in workflows | ~120 |

### Auth Inheritance Chain
```
Test → Scenario → Feature Group → Global Auth Profile → Environment Fallback → { type: 'none' }
```
Each level can be `inherit` (pass through) or set explicit auth. First non-inherit/non-none wins.

---

### AS-Phase 1: Individual Auth Types (Easy)

#### 1. `auth-bearer-token-easy.html` — Bearer Token Authentication
- **Difficulty:** Easy
- **Real-world scenario:** *"Accessing a Protected User API with a Static Token"*
- **Topics covered:**
  - `AuthConfig.type = 'bearer'`
  - `prefix` field (default `"Bearer"`, also `"Token"`, `"Bot"`)
  - `token` field — the raw token string
  - Header produced: `Authorization: Bearer <token>`
  - Where to configure: test-level, scenario-level, feature-group level
- **Exercises:**
  1. Configure bearer auth on a test hitting `jsonplaceholder.typicode.com`
  2. Change prefix from `Bearer` to `Token`
  3. Use `{{variable}}` in the token field for dynamic tokens

#### 2. `auth-basic-easy.html` — Basic Authentication
- **Difficulty:** Easy
- **Real-world scenario:** *"Internal Admin API with Username/Password"*
- **Topics covered:**
  - `AuthConfig.type = 'basic'`
  - `username`, `password` fields
  - Header produced: `Authorization: Basic <base64(user:pass)>`
  - Security note: credentials are base64-encoded, not encrypted
- **Exercises:**
  1. Configure basic auth with test credentials
  2. Observe the generated `Authorization` header in response details
  3. Try with incorrect credentials and observe 401 response

#### 3. `auth-apikey-easy.html` — API Key Authentication
- **Difficulty:** Easy
- **Real-world scenario:** *"Accessing a Weather API with an API Key"*
- **Topics covered:**
  - `AuthConfig.type = 'apikey'`
  - `apiKeyName` — header or query parameter name
  - `apiKeyValue` — the key value
  - `apiKeyIn` — `'header'` or `'query'`
  - Header mode: `X-API-Key: <value>`
  - Query mode: appended as `?key=value`
  - Special case: when `apiKeyName` is `"Authorization"`, auto-prefixes `Bearer`
- **Exercises:**
  1. Configure API key in header mode
  2. Switch to query parameter mode
  3. Use the `Authorization` header name and observe auto-prefix behavior

#### 4. `auth-oauth2-easy.html` — OAuth2 Client Credentials
- **Difficulty:** Easy
- **Real-world scenario:** *"Machine-to-Machine Auth for a Backend Service"*
- **Topics covered:**
  - `AuthConfig.type = 'oauth2'`
  - `tokenUrl`, `clientId`, `clientSecret` fields
  - `TokenManager` class: acquires tokens, parses JWT `exp` claim, caches, deduplicates concurrent requests
  - 30-second expiry buffer (`TOKEN_EXPIRY_BUFFER_SEC`)
  - Default 30-minute cache when JWT has no `exp` claim
  - Error handling: missing fields, HTTP errors, malformed JWT
  - Token passed as: `Authorization: Bearer <acquired_token>`
- **Exercises:**
  1. Configure OAuth2 with a test token URL
  2. Understand caching: observe that repeated requests don't re-fetch tokens
  3. Test error scenarios: invalid client ID, unreachable token URL

---

### AS-Phase 2: Auth Inheritance and Profiles (Medium)

#### 5. `auth-inheritance-chain-medium.html` — The Auth Hierarchy
- **Difficulty:** Medium
- **Real-world scenario:** *"Multi-Team API Suite — Shared Auth Across Feature Groups"*
- **Topics covered:**
  - `resolveAuth()` function — the 5-level chain
  - `type: 'inherit'` — pass through to parent level
  - Test level (highest priority) → Scenario → Feature Group → Global Profile → Env Fallback
  - Override at any level: set explicit auth type to stop inheritance
  - `type: 'none'` at test level still walks up the chain
  - Edge cases: missing profile ID, undefined scenario auth, empty profile list
- **Exercises:**
  1. Set bearer auth on feature group, verify tests inherit it
  2. Override at scenario level with API key, verify test uses scenario's auth
  3. Set test to `inherit`, remove all parent auth, verify falls back to `none`

#### 6. `auth-global-profiles-medium.html` — Global Auth Profiles
- **Difficulty:** Medium
- **Real-world scenario:** *"Shared OAuth2 Credentials Across All Test Suites"*
- **Topics covered:**
  - `GlobalAuthProfile` interface: `{ id, name, auth: AuthConfig }`
  - Creating/editing profiles in Settings → Global Auth Profiles
  - `globalAuthProfileId` on FeatureGroup — links to a profile
  - Profile resolution in `resolveAuth()`: checked after FG-level auth
  - `globalProfileId` field on AuthConfig — used in request editor
  - `ModalAuthType = 'global-profile'` — special UI mode
  - Sharing profiles across feature groups
- **Exercises:**
  1. Create a global OAuth2 profile
  2. Link it to a feature group and verify all tests use it
  3. Change profile credentials — all linked feature groups update automatically

#### 7. `auth-catalog-security-medium.html` — Catalog Security Schemes
- **Difficulty:** Medium
- **Real-world scenario:** *"OpenAPI Spec with Multiple Security Schemes"*
- **Topics covered:**
  - `CatalogSecurityScheme` types: `apiKey`, `http`, `oauth2`, `openIdConnect`
  - "Inherit from Spec" mode in `CatalogAuthPanel`
  - `schemeToAuthType()` — maps OpenAPI scheme to RedfireForge auth type
  - Multiple schemes: dropdown to select which scheme to use
  - `__inherit`, `__schemeName`, `__globalProfileId` metadata fields
  - Auto-fill: API key name/location auto-populated from scheme definition
  - Auth verification: "Verify" button to test auth config against live API
- **Exercises:**
  1. Import an OpenAPI spec with multiple security schemes
  2. Switch between "Inherit from Spec" and manual auth modes
  3. Use the verification button to test auth against the live API

---

### AS-Phase 3: Workflow Auth and Advanced Patterns (Advanced)

#### 8. `auth-workflow-advanced.html` — Auth in Workflows
- **Difficulty:** Advanced
- **Real-world scenario:** *"Chained Auth Flow — Login → Extract Token → Use in Subsequent Requests"*
- **Topics covered:**
  - Per-HTTP-node auth resolution: `resolveHttpAuth(data)` callback
  - Service Registry auth: per-service, per-environment auth config
  - Workflow-level auth profiles: `WorkflowHostProfile`
  - Chained auth pattern: HTTP login → extract token → SetVariable → use in next HTTP
  - OAuth2 token caching across workflow nodes (shared `TokenManager` instance)
  - `resolveServiceAuth()` — endpoint matrix auth resolution
  - Environment-scoped auth overrides
  - cURL generation with auth for testing
- **Exercises:**
  1. Build a login → use token workflow with variable extraction
  2. Configure service-level auth with environment overrides
  3. Compare per-node auth vs workflow-level shared auth

---

## Training Path 3: Assertion Mastery ✅

### Description
From simple status checks to structured JSON assertions, regex patterns, and custom validation scripts.

### Assertion Types (7 types)
From the `Assertion` union type:
```typescript
| { type: 'status'; expected: string }
| { type: 'responseTime'; maxMs: number }
| { type: 'header'; name: string; operator: AssertionOperator; value?: string }
| { type: 'regex'; jsonPath: string; pattern: string }
| { type: 'arrayLength'; jsonPath: string; operator: ComparisonOperator; value: number }
| { type: 'numeric'; jsonPath: string; operator: ComparisonOperator; value: number }
| { type: 'date'; jsonPath: string; operator: ComparisonOperator; reference: DateReference }
```

### Validation Modes (3 modes)
```
'none' | 'full' | 'selective'
```
- **none**: no JSON validation
- **full**: deep compare entire response against expected JSON
- **selective**: validate specific JSONPath fields (include or exclude mode)

### Source Code Reference

| File | Purpose | Lines |
|---|---|---|
| `src/shared/types/index.ts` | `Assertion`, `AssertionOperator`, `ComparisonOperator`, `ValidationConfig`, `DateReference` | ~80 |
| `src/engine/validator.ts` | `validate()`, `evaluateAssertions()`, `getByPath()`, `matchesStatusPattern()`, deep compare | ~400+ |
| `src/features/scenarios/components/TestEditorValidationTab.tsx` | UI for assertions + validation modes | ~400+ |
| `src/features/requests/components/JsonPathBuilder.tsx` | Interactive JSON tree for selecting paths | ~260+ |
| `src/features/scenarios/components/JsonPathPicker.tsx` | Inline path picker button | ~50 |
| `src/features/scenarios/components/AssertionPresetMenu.tsx` | Preset import menu | ~88 |
| `src/data/galleries/assertion-presets/presets.ts` | 5 preset factories | ~100 |
| `src/data/galleries/assertion-presets/types.ts` | `AssertionPresetEntry`, `AssertionPresetCategory` | ~11 |
| `src/features/requests/components/RegexAssertionModal.tsx` | Visual regex builder with pattern library | ~200 |
| `src/features/requests/components/ResponseVersionPanel.tsx` | Response version history (for validation baseline) | ~100 |
| `src/features/requests/components/RulesVersionPanel.tsx` | Rules version history | ~100 |

### Assertion Presets Available (5 presets)

| Preset | ID | Assertions | Types | Category |
|---|---|---|---|---|
| API Health Check | `api-health-check` | 2 | status, arrayLength | api-validation |
| Paginated List | `paginated-list` | 3 | arrayLength, numeric | api-validation |
| Token Expiry | `token-expiry` | 3 | regex, date, numeric | security |
| Price Guard | `price-guard` | 3 | numeric, arrayLength | data-quality |
| API Contract | `api-contract` | 5 | status, numeric, regex | api-validation |

---

### AM-Phase 1: Validation Modes and Basic Assertions (Easy)

#### 1. `assertion-status-codes-easy.html` — Status Code Assertions
- **Difficulty:** Easy
- **Real-world scenario:** *"Verifying API Returns Correct HTTP Status"*
- **Topics covered:**
  - `{ type: 'status', expected: '200' }`
  - Pattern matching: exact (`200`), class (`2xx`), range (`200-299`), list (`200,201,204`)
  - `matchesStatusPattern()` function — the pattern matcher
  - Status assertion overrides default pass/fail: asserting `404` makes 404 a pass
  - `statusAsserted` flag — when set, skips default 4xx/5xx failure
  - Combining with other assertions
- **Exercises:**
  1. Assert exact status `200` on a GET request
  2. Use class pattern `2xx` to accept any success status
  3. Assert `404` and verify the test passes on a missing resource

#### 2. `assertion-response-time-easy.html` — Response Time SLA
- **Difficulty:** Easy
- **Real-world scenario:** *"Enforcing a 500ms SLA on API Responses"*
- **Topics covered:**
  - `{ type: 'responseTime', maxMs: 500 }`
  - Passes when `responseTimeMs <= maxMs`
  - Failure detail: `path: '(responseTime)', expected: '≤ 500ms', actual: '750ms'`
  - Use case: SLA enforcement, performance regression detection
- **Exercises:**
  1. Set a 500ms SLA and hit a fast API
  2. Set a 10ms SLA and observe the failure
  3. Combine status + responseTime assertions

#### 3. `assertion-validation-modes-easy.html` — JSON Validation Modes
- **Difficulty:** Easy
- **Real-world scenario:** *"Verifying API Response Structure"*
- **Topics covered:**
  - `ValidationMode`: `none`, `full`, `selective`
  - Full mode: `deepCompare()` — exact match, all keys, all values, nested
  - Selective mode with `include`: validate only specified `ExpectedField[]`
  - Selective mode with `exclude`: validate everything except `excludedPaths[]`
  - `sampleJson` — the reference response JSON
  - `expectedJson` — the expected response for full mode
  - Fetching sample response: "Fetch Sample" button → auto-populate
  - `unorderedArrays` flag — array element matching by content, not index
- **Exercises:**
  1. Use full mode to match an entire response
  2. Switch to selective mode and validate only 3 key fields
  3. Enable `unorderedArrays` and test with reordered array elements

---

### AM-Phase 2: Advanced Assertions (Medium)

#### 4. `assertion-header-checks-medium.html` — Response Header Assertions
- **Difficulty:** Medium
- **Real-world scenario:** *"Verifying Content-Type, Cache Headers, and CORS"*
- **Topics covered:**
  - `{ type: 'header', name, operator, value }`
  - Operators: `equals` (exact match), `contains` (substring), `regex` (pattern), `exists` (presence check)
  - Case-insensitive header name matching
  - No `value` needed for `exists` operator
  - Failure path format: `(header:content-type)`
  - Invalid regex handling: `actual: 'invalid regex pattern'`
- **Exercises:**
  1. Assert `Content-Type` contains `json`
  2. Assert a custom header exists
  3. Use regex to validate a request ID header format

#### 5. `assertion-jsonpath-regex-medium.html` — JSONPath + Regex
- **Difficulty:** Medium
- **Real-world scenario:** *"Validating Email Formats and ID Patterns in API Responses"*
- **Topics covered:**
  - `{ type: 'regex', jsonPath, pattern }`
  - `getByPath()` — JSONPath resolution (`$.a.b`, `a[0].x`, `$.items[*].id`)
  - `[*]` wildcard: walks every array element, returns array of results
  - `.length` on arrays: `$.items.length` returns count
  - Non-string values serialized to JSON before regex test
  - Undefined path handling: `actual: 'undefined'`
  - Regex Builder modal: visual builder with pattern library
  - `JsonPathPicker` — inline picker from sample JSON
- **Exercises:**
  1. Validate email format with regex on `$.email`
  2. Validate UUID format on `$.id`
  3. Use the Regex Builder to create a complex pattern

#### 6. `assertion-numeric-array-medium.html` — Numeric and Array Assertions
- **Difficulty:** Medium
- **Real-world scenario:** *"E-Commerce Price Validation and Pagination Checks"*
- **Topics covered:**
  - `{ type: 'numeric', jsonPath, operator, value }` — compare number at path
  - `{ type: 'arrayLength', jsonPath, operator, value }` — compare array length
  - `ComparisonOperator`: `=`, `!=`, `>`, `>=`, `<`, `<=`
  - Combining: price > 0 AND price < 10000 (two assertions)
  - Array length on `$` root (root-level array)
  - `formatOp()` — human-readable operator display
- **Exercises:**
  1. Assert `$.price > 0` and `$.price < 10000`
  2. Assert `$.items` array length >= 1
  3. Assert `$.page = 1` and `$.total > 0` for pagination

#### 7. `assertion-date-comparison-medium.html` — Date Assertions
- **Difficulty:** Medium
- **Real-world scenario:** *"Verifying Token Expiry Is in the Future"*
- **Topics covered:**
  - `{ type: 'date', jsonPath, operator, reference }`
  - `DateReference`: `{ kind: 'today', timezone: 'utc' | 'local' }` or `{ kind: 'fixed', iso: string }`
  - `resolveDate()` — resolves reference to a comparable date string
  - `toDayString()` — normalizes dates for comparison
  - Operators: `=` (same day), `>` (after), `<` (before), etc.
  - Use case: token expiry, subscription end dates, event scheduling
- **Exercises:**
  1. Assert `$.expiresAt > today` (UTC)
  2. Assert `$.createdAt < today` (local timezone)
  3. Use a fixed date reference for historical comparisons

---

### AM-Phase 3: Presets, Composition, and Advanced Patterns (Advanced)

#### 8. `assertion-presets-advanced.html` — Assertion Presets
- **Difficulty:** Advanced
- **Real-world scenario:** *"Standardizing Assertions Across a Test Suite"*
- **Topics covered:**
  - `AssertionPresetMenu` component — UI for importing presets
  - `AssertionPresetEntry`: `{ id, name, category, assertionCount, assertionTypes, factory }`
  - Categories: `api-validation`, `data-quality`, `security` (+ `all`)
  - 5 built-in presets: API Health Check, Paginated List, Token Expiry, Price Guard, API Contract
  - Factory pattern: each preset returns a fresh `Assertion[]`
  - Importing presets appends to existing assertions
  - Customizing imported presets (editing paths, values, operators)
- **Exercises:**
  1. Import "API Health Check" preset and customize for your API
  2. Import "Token Expiry" preset and adjust the regex pattern
  3. Import "API Contract" preset and modify the userId range

#### 9. `assertion-composition-advanced.html` — Complex Assertion Strategies
- **Difficulty:** Advanced
- **Real-world scenario:** *"E-Commerce Order Validation — Status + Body + Headers + Timing"*
- **Topics covered:**
  - Assertions run on EVERY request regardless of validation mode
  - Combining assertions WITH validation modes (both apply)
  - Status assertion + selective validation: assert 404 AND validate error body
  - Multiple assertions of same type (e.g., two numeric assertions on different paths)
  - Order of evaluation: assertions first, then JSON validation
  - `failureDetails` array: contains failures from both assertions and validation
  - `passed` flag: false if ANY assertion or validation fails
  - Testing error responses: assert error status + validate error body structure
- **Exercises:**
  1. Build a 5-assertion suite: status, time, header, regex, numeric
  2. Combine assertions with selective validation on the same test
  3. Assert a 404 status and validate the error response body

#### 10. `assertion-jsonpath-advanced.html` — Advanced JSONPath and Unordered Arrays
- **Difficulty:** Advanced
- **Real-world scenario:** *"Validating Complex Nested E-Commerce Product Responses"*
- **Topics covered:**
  - `JsonPathBuilder` component — interactive tree for selecting validation paths
  - Tree rendering: expandable nodes, checkbox selection, search filtering
  - `buildTree()` — parses JSON into navigable `JsonNode` tree
  - `getAllLeafPaths()` — get all selectable paths
  - Include vs exclude mode toggle
  - `validateFieldsUnordered()` — row-based array matching
  - Row grouping: fields with same array prefix treated as a row
  - Finding matching rows at any index (not just expected index)
  - `RulesTable` component — tabular view of validation rules
  - Response version panel: save/restore response snapshots for comparison
  - Rules version panel: save/restore validation rule sets
- **Exercises:**
  1. Use the JSON tree to select validation paths from a complex nested response
  2. Enable unordered arrays and validate products that arrive in any order
  3. Save a rules version, modify rules, then compare using the version panel

---

## Implementation Priority & Status

| Priority | Path | Manuals | Rationale | Status |
|---|---|---|---|---|
| **P1** | Workflow Patterns Phase 1–2 | 6 + overview | Most-used features, foundation for advanced patterns | 🔲 Not Started |
| **P2** | Auth Strategies Phase 1 | 4 + overview | Daily workflow — auth is needed for most real APIs | 🔲 Not Started |
| **P3** | Assertion Mastery Phase 1 | 3 + overview | Core testing — validation is the point of testing | 🔲 Not Started |
| **P4** | Auth Strategies Phase 2 | 3 | Intermediate — inheritance and profiles | 🔲 Not Started |
| **P5** | Assertion Mastery Phase 2 | 4 | Intermediate — advanced assertion types | 🔲 Not Started |
| **P6** | Workflow Patterns Phase 3 | 3 | Intermediate — loops and error handling | 🔲 Not Started |
| **P7** | Workflow Patterns Phase 4 | 3 | Advanced — sub-workflows and webhooks | 🔲 Not Started |
| **P8** | Auth Strategies Phase 3 | 1 | Advanced — workflow auth patterns | 🔲 Not Started |
| **P9** | Assertion Mastery Phase 3 | 3 | Advanced — presets and composition | 🔲 Not Started |

**Progress: 0 / 33 files delivered (0%)**

---

## Detailed Delivery Tracker

### P1 — Workflow Patterns Phase 1–2 (7 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/workflow-patterns.html` | Overview | 🔲 |
| 2 | `workflow-patterns/foundation/workflow-http-chaining-easy.html` | Manual | 🔲 |
| 3 | `workflow-patterns/foundation/workflow-delay-timing-easy.html` | Manual | 🔲 |
| 4 | `workflow-patterns/foundation/workflow-variables-easy.html` | Manual | 🔲 |
| 5 | `workflow-patterns/flow-control/workflow-condition-branching-medium.html` | Manual | 🔲 |
| 6 | `workflow-patterns/flow-control/workflow-switch-multiway-medium.html` | Manual | 🔲 |
| 7 | `workflow-patterns/flow-control/workflow-fork-join-medium.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1–2 | Code | 🔲 |

### P2 — Auth Strategies Phase 1 (5 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/auth-strategies.html` | Overview | 🔲 |
| 2 | `auth-strategies/basics/auth-bearer-token-easy.html` | Manual | 🔲 |
| 3 | `auth-strategies/basics/auth-basic-easy.html` | Manual | 🔲 |
| 4 | `auth-strategies/basics/auth-apikey-easy.html` | Manual | 🔲 |
| 5 | `auth-strategies/basics/auth-oauth2-easy.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1 | Code | 🔲 |

### P3 — Assertion Mastery Phase 1 (4 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/assertion-mastery.html` | Overview | 🔲 |
| 2 | `assertion-mastery/basics/assertion-status-codes-easy.html` | Manual | 🔲 |
| 3 | `assertion-mastery/basics/assertion-response-time-easy.html` | Manual | 🔲 |
| 4 | `assertion-mastery/basics/assertion-validation-modes-easy.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1 | Code | 🔲 |

### P4 — Auth Strategies Phase 2 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/inheritance/auth-inheritance-chain-medium.html` | Manual | 🔲 |
| 2 | `auth-strategies/inheritance/auth-global-profiles-medium.html` | Manual | 🔲 |
| 3 | `auth-strategies/inheritance/auth-catalog-security-medium.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 2 manuals | Code | 🔲 |

### P5 — Assertion Mastery Phase 2 (4 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/intermediate/assertion-header-checks-medium.html` | Manual | 🔲 |
| 2 | `assertion-mastery/intermediate/assertion-jsonpath-regex-medium.html` | Manual | 🔲 |
| 3 | `assertion-mastery/intermediate/assertion-numeric-array-medium.html` | Manual | 🔲 |
| 4 | `assertion-mastery/intermediate/assertion-date-comparison-medium.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 2 manuals | Code | 🔲 |

### P6 — Workflow Patterns Phase 3 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/loops-errors/workflow-loop-patterns-medium.html` | Manual | 🔲 |
| 2 | `workflow-patterns/loops-errors/workflow-aggregate-medium.html` | Manual | 🔲 |
| 3 | `workflow-patterns/loops-errors/workflow-error-handling-advanced.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 3 manuals | Code | 🔲 |

### P7 — Workflow Patterns Phase 4 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/advanced/workflow-sub-workflow-advanced.html` | Manual | 🔲 |
| 2 | `workflow-patterns/advanced/workflow-webhook-correlation-advanced.html` | Manual | 🔲 |
| 3 | `workflow-patterns/advanced/workflow-debug-advanced.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 4 manuals | Code | 🔲 |

### P8 — Auth Strategies Phase 3 (1 file)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/advanced/auth-workflow-advanced.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 3 manual | Code | 🔲 |

### P9 — Assertion Mastery Phase 3 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/advanced/assertion-presets-advanced.html` | Manual | 🔲 |
| 2 | `assertion-mastery/advanced/assertion-composition-advanced.html` | Manual | 🔲 |
| 3 | `assertion-mastery/advanced/assertion-jsonpath-advanced.html` | Manual | 🔲 |
| — | `trainingPaths.ts` — add Phase 3 manuals | Code | 🔲 |

---

## Summary

| Deliverable | Count | Status |
|---|---|---|
| HTML manuals | 30 | 🔲 0 / 30 |
| Overview pages | 3 | 🔲 0 / 3 |
| `trainingPaths.ts` updates | 9 | 🔲 0 / 9 |
| New gallery samples | 0 | N/A — all referenced samples already exist |
| **Total files** | **33** | **🔲 0 / 33** |

---

## File Structure

```
docs/training-manuals/
├── workflow-patterns/
│   ├── workflow-patterns.html              (overview page)
│   ├── foundation/
│   │   ├── workflow-http-chaining-easy.html
│   │   ├── workflow-delay-timing-easy.html
│   │   └── workflow-variables-easy.html
│   ├── flow-control/
│   │   ├── workflow-condition-branching-medium.html
│   │   ├── workflow-switch-multiway-medium.html
│   │   └── workflow-fork-join-medium.html
│   ├── loops-errors/
│   │   ├── workflow-loop-patterns-medium.html
│   │   ├── workflow-aggregate-medium.html
│   │   └── workflow-error-handling-advanced.html
│   └── advanced/
│       ├── workflow-sub-workflow-advanced.html
│       ├── workflow-webhook-correlation-advanced.html
│       └── workflow-debug-advanced.html
├── auth-strategies/
│   ├── auth-strategies.html                (overview page)
│   ├── basics/
│   │   ├── auth-bearer-token-easy.html
│   │   ├── auth-basic-easy.html
│   │   ├── auth-apikey-easy.html
│   │   └── auth-oauth2-easy.html
│   ├── inheritance/
│   │   ├── auth-inheritance-chain-medium.html
│   │   ├── auth-global-profiles-medium.html
│   │   └── auth-catalog-security-medium.html
│   └── advanced/
│       └── auth-workflow-advanced.html
└── assertion-mastery/
    ├── assertion-mastery.html              (overview page)
    ├── basics/
    │   ├── assertion-status-codes-easy.html
    │   ├── assertion-response-time-easy.html
    │   └── assertion-validation-modes-easy.html
    ├── intermediate/
    │   ├── assertion-header-checks-medium.html
    │   ├── assertion-jsonpath-regex-medium.html
    │   ├── assertion-numeric-array-medium.html
    │   └── assertion-date-comparison-medium.html
    └── advanced/
        ├── assertion-presets-advanced.html
        ├── assertion-composition-advanced.html
        └── assertion-jsonpath-advanced.html
```

---

## `trainingPaths.ts` Updates Required

Each training path entry needs `comingSoon: false` and populated `phases[]` array with manual references. Example structure:

```typescript
{
  id: 'workflow-patterns',
  name: 'Workflow Patterns',
  icon: '⚡',
  description: '...',
  comingSoon: false,  // ← change from true
  phases: [
    {
      id: 'wp-phase-1',
      name: 'Foundation Nodes',
      manuals: [
        { id: 'workflow-http-chaining-easy', name: 'HTTP Request Chaining', difficulty: 'easy', manualPath: 'workflow-patterns/foundation/workflow-http-chaining-easy.html' },
        // ...
      ],
    },
    // ...
  ],
}
```
