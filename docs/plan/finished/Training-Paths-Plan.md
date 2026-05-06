# Training Paths Plan — Workflow Patterns, Auth Strategies, Assertion Mastery

> Companion to `Versioning-Training-Manaulal-Plan.md`. Covers the 3 remaining training paths shown as "soon" in the Gallery sidebar.
>
> **Status: ✅ COMPLETE** — 33/33 files delivered across 9 phases (P1–P9).
> Branches: `feature/workflow-patterns-training-p1` through `feature/workflow-patterns-training-p7`.

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
| **P1** | Workflow Patterns Phase 1–2 | 6 + overview | Most-used features, foundation for advanced patterns | ✅ Done |
| **P2** | Auth Strategies Phase 1 | 4 + overview | Daily workflow — auth is needed for most real APIs | ✅ Done |
| **P3** | Assertion Mastery Phase 1 | 3 + overview | Core testing — validation is the point of testing | ✅ Done |
| **P4** | Auth Strategies Phase 2 | 3 | Intermediate — inheritance and profiles | ✅ Done |
| **P5** | Assertion Mastery Phase 2 | 4 | Intermediate — advanced assertion types | ✅ Done |
| **P6** | Workflow Patterns Phase 3 | 3 | Intermediate — loops and error handling | ✅ Done |
| **P7** | Workflow Patterns Phase 4 | 3 | Advanced — sub-workflows and webhooks | ✅ Done |
| **P8** | Auth Strategies Phase 3 | 1 | Advanced — workflow auth patterns | ✅ Done |
| **P9** | Assertion Mastery Phase 3 | 3 | Advanced — presets and composition | ✅ Done |

**Progress: 33 / 33 files delivered (100%)**

---

## Detailed Delivery Tracker

### P1 — Workflow Patterns Phase 1–2 (7 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/workflow-patterns.html` | Overview | ✅ |
| 2 | `workflow-patterns/foundation/workflow-http-chaining-easy.html` | Manual | ✅ |
| 3 | `workflow-patterns/foundation/workflow-delay-timing-easy.html` | Manual | ✅ |
| 4 | `workflow-patterns/foundation/workflow-variables-easy.html` | Manual | ✅ |
| 5 | `workflow-patterns/flow-control/workflow-condition-branching-medium.html` | Manual | ✅ |
| 6 | `workflow-patterns/flow-control/workflow-switch-multiway-medium.html` | Manual | ✅ |
| 7 | `workflow-patterns/flow-control/workflow-fork-join-medium.html` | Manual | ✅ |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1–2 | Code | ✅ |

### P2 — Auth Strategies Phase 1 (5 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/auth-strategies.html` | Overview | ✅ |
| 2 | `auth-strategies/basics/auth-bearer-token-easy.html` | Manual | ✅ |
| 3 | `auth-strategies/basics/auth-basic-easy.html` | Manual | ✅ |
| 4 | `auth-strategies/basics/auth-apikey-easy.html` | Manual | ✅ |
| 5 | `auth-strategies/basics/auth-oauth2-easy.html` | Manual | ✅ |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1 | Code | ✅ |

### P3 — Assertion Mastery Phase 1 (4 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/assertion-mastery.html` | Overview | ✅ |
| 2 | `assertion-mastery/basics/assertion-status-codes-easy.html` | Manual | ✅ |
| 3 | `assertion-mastery/basics/assertion-response-time-easy.html` | Manual | ✅ |
| 4 | `assertion-mastery/basics/assertion-validation-modes-easy.html` | Manual | ✅ |
| — | `trainingPaths.ts` — set `comingSoon: false`, add Phase 1 | Code | ✅ |

### P4 — Auth Strategies Phase 2 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/inheritance/auth-inheritance-chain-medium.html` | Manual | ✅ |
| 2 | `auth-strategies/inheritance/auth-global-profiles-medium.html` | Manual | ✅ |
| 3 | `auth-strategies/inheritance/auth-catalog-security-medium.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 2 manuals | Code | ✅ |

### P5 — Assertion Mastery Phase 2 (4 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/intermediate/assertion-header-checks-medium.html` | Manual | ✅ |
| 2 | `assertion-mastery/intermediate/assertion-jsonpath-regex-medium.html` | Manual | ✅ |
| 3 | `assertion-mastery/intermediate/assertion-numeric-array-medium.html` | Manual | ✅ |
| 4 | `assertion-mastery/intermediate/assertion-date-comparison-medium.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 2 manuals | Code | ✅ |

### P6 — Workflow Patterns Phase 3 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/loops-errors/workflow-loop-patterns-medium.html` | Manual | ✅ |
| 2 | `workflow-patterns/loops-errors/workflow-aggregate-medium.html` | Manual | ✅ |
| 3 | `workflow-patterns/loops-errors/workflow-error-handling-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 3 manuals | Code | ✅ |

### P7 — Workflow Patterns Phase 4 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow-patterns/advanced/workflow-sub-workflow-advanced.html` | Manual | ✅ |
| 2 | `workflow-patterns/advanced/workflow-webhook-correlation-advanced.html` | Manual | ✅ |
| 3 | `workflow-patterns/advanced/workflow-debug-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 4 manuals | Code | ✅ |

### P8 — Auth Strategies Phase 3 (1 file)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `auth-strategies/advanced/auth-workflow-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 3 manual | Code | ✅ |

### P9 — Assertion Mastery Phase 3 (3 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertion-mastery/advanced/assertion-presets-advanced.html` | Manual | ✅ |
| 2 | `assertion-mastery/advanced/assertion-composition-advanced.html` | Manual | ✅ |
| 3 | `assertion-mastery/advanced/assertion-jsonpath-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 3 manuals | Code | ✅ |

---

## Summary

| Deliverable | Count | Status |
|---|---|---|
| HTML manuals | 30 | ✅ 30 / 30 |
| Overview pages | 3 | ✅ 3 / 3 |
| `trainingPaths.ts` updates | 9 | ✅ 9 / 9 |
| New gallery samples | 0 | N/A — all referenced samples already exist |
| **Total files** | **33** | **✅ 33 / 33** |

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

## `trainingPaths.ts` Updates — Complete

All three training path entries have been updated across 9 delivery phases:

- **`workflow-patterns`** — `comingSoon` removed, 4 phases added (P1, P6, P7)
- **`auth-strategies`** — `comingSoon` removed, 3 phases added (P2, P4, P8)
- **`assertion-mastery`** — `comingSoon` removed, 3 phases added (P3, P5, P9)

All phases reference their HTML manuals via `manualPath` and link to gallery samples via `sampleId` where applicable.

---

## Full Training Manual Inventory (All Folders)

The `docs/training-manuals/` directory contains **123 HTML files** across **9 top-level folders** plus 1 standalone file. Only a subset belongs to this plan — the rest come from earlier finished plans.

### Group A — Training Paths (registered in `trainingPaths.ts`, shown in Gallery UI)

These are the structured curriculum paths rendered by `TrainingPathsView.tsx`. Each manual is linked to gallery samples and organized into phases.

| Folder | Training Path | Files | Manuals in `trainingPaths.ts` | Plan |
|---|---|---|---|---|
| `versioning/` | Versioning 🔖 | 17 | 15 + 1 overview + 1 cross-entity | `Versioning-Training-Manaulal-Plan.md` |
| `workflow-patterns/` | Workflow Patterns ⚡ | 13 | 12 + 1 overview | **This plan** (P1, P6, P7) |
| `auth-strategies/` | Auth Strategies 🔐 | 9 | 8 + 1 overview | **This plan** (P2, P4, P8) |
| `assertion-mastery/` | Assertion Mastery ✅ | 11 | 10 + 1 overview | **This plan** (P3, P5, P9) |
| **Subtotal** | | **50** | **45 manuals + 4 overviews + 1 cross-entity** | |

### Group B — Per-Sample Companion Manuals (NOT in `trainingPaths.ts`)

These are legacy standalone HTML manuals created alongside gallery samples during earlier implementation phases. They are **not** integrated into the Training Paths UI — they exist as reference documentation on disk.

| Folder | Files | Origin Plan | Notes |
|---|---|---|---|
| `requests/` | 13 | `gallery-redesign-plan.md` (finished) | 1 overview + 12 per-request manuals |
| `tests/` | 10 | `gallery-redesign-plan.md` (finished) | 1 overview + 9 per-test manuals |
| `catalog/` | 7 | `gallery-redesign-plan.md` (finished) | 1 overview + 6 per-catalog manuals |
| `workflow/` | 36 | `gallery-redesign-plan.md` (finished) | 6 subfolders: api-patterns, async-correlation, diverse-apis, event-driven, flow-control, orchestration, script-node, node-reference |
| `assertions/` | 6 | `assertion-presets-plan.md` (finished) | 1 overview + 5 preset companion manuals |
| _(standalone)_ | 1 | — | `sub-workflow-samples-guide.html` |
| **Subtotal** | **73** | | |

### Grand Total

| Category | Files |
|---|---|
| Training Path manuals (Group A) | 50 |
| Per-sample companion manuals (Group B) | 73 |
| **Total HTML files** | **123** |

---

## Gallery Sample Inventory

All gallery samples available for import in the Gallery sidebar, organized by domain.

### Requests (12 samples)

| ID | Name |
|---|---|
| `req-get-all-users` | Get All Users |
| `req-get-pokemon` | Get Pokemon |
| `req-random-dog` | Random Dog |
| `req-search-countries` | Search Countries |
| `req-create-post` | Create Post |
| `req-search-books` | Search Books |
| `req-paginated-users` | Paginated Users |
| `req-product-search` | Product Search |
| `req-update-resource` | Update Resource |
| `req-delete-resource` | Delete Resource |
| `req-auth-login` | Auth Login |
| `req-echo-headers` | Echo Headers |

### Tests (8 samples)

| ID | Name |
|---|---|
| `test-user-api-smoke` | User API Smoke |
| `test-product-listing` | Product Listing |
| `test-paginated-regression` | Paginated Regression |
| `test-pokemon-contract` | Pokemon Contract |
| `test-country-search` | Country Search |
| `test-auth-flow` | Auth Flow |
| `test-ecommerce-full` | E-Commerce Full |
| `test-multi-api-load` | Multi-API Load |

### API Catalog (8 specs)

| ID | Name |
|---|---|
| `catalog-jsonplaceholder` | JSONPlaceholder |
| `catalog-fakestore` | Fake Store |
| `catalog-pokeapi` | PokéAPI |
| `catalog-dummyjson` | DummyJSON |
| `catalog-rest-countries` | REST Countries |
| `catalog-httpbin` | HTTPBin |
| `sample-catalog-correlation-wait` | Correlation Wait Catalog |
| `sample-catalog-pet-store` | Pet Store |

### Workflows (34 samples)

| ID | Category |
|---|---|
| `sample-workflow-001` | Foundation — HTTP chaining, conditions |
| `sample-workflow-parallel` | Foundation — Fork/Join parallel |
| `sample-workflow-branching` | Flow Control — If/Else branching |
| `sample-workflow-switch` | Flow Control — Switch routing |
| `sample-workflow-loop-agg` | Loops — Loop + Aggregation |
| `sample-workflow-error-handler` | Error — Node-level error handler |
| `sample-workflow-wf-error-handler` | Error — Workflow-level error handler |
| `sample-workflow-order-pipeline` | Orchestration — Order pipeline |
| `sample-workflow-deploy-orchestrator` | Orchestration — Deploy orchestrator |
| `sample-workflow-batch` | Orchestration — Batch provisioning |
| `sample-workflow-sub-workflow` | Composition — Sub-workflow |
| `sample-workflow-webhook` | Events — Webhook trigger |
| `sample-workflow-schedule` | Events — Schedule trigger |
| `sample-workflow-wait-condition` | Events — Wait for condition |
| `sample-workflow-payment-callback-easy` | Correlation — Payment callback |
| `sample-workflow-approval-medium` | Correlation — Approval workflow |
| `sample-workflow-parallel-payment-advanced` | Correlation — Parallel payment |
| `sample-workflow-script-easy` | Script — JSON formatter |
| `sample-workflow-script-medium` | Script — Cross-API validator |
| `sample-workflow-script-advanced` | Script — Data pipeline report |
| `sample-workflow-expressions` | API Patterns — Expression functions |
| `sample-workflow-log-debug` | API Patterns — Debug trace |
| `sample-workflow-book-search` | Diverse APIs — Book search |
| `sample-workflow-country-currency` | Diverse APIs — Country currency |
| `sample-workflow-multi-api-dashboard` | Diverse APIs — Multi-API dashboard |
| `sample-workflow-pokemon-evolution` | Diverse APIs — Pokemon evolution |
| `sample-workflow-product-cart` | Diverse APIs — Product cart |
| `sample-subwf-child` | Child — Sub-workflow child |
| `sample-shipping-child` | Child — Shipping child |
| `sample-rollback-child` | Child — Rollback child |
| `sample-region-deploy-child` | Child — Region deploy child |
| `sample-workflow-payment-callback-simulator` | Simulator — Payment callback |
| `sample-workflow-approval-simulator` | Simulator — Approval |
| `sample-workflow-parallel-payment-simulator` | Simulator — Parallel payment |

### Assertion Presets (5 presets)

| ID | Name |
|---|---|
| `preset-api-healthcheck` | API Health Check |
| `preset-paginated-list` | Paginated List |
| `preset-token-expiry` | Token Expiry |
| `preset-price-guard` | Price Guard |
| `preset-api-contract` | API Contract |

### Summary

| Domain | Count |
|---|---|
| Requests | 12 |
| Tests | 8 |
| API Catalog | 8 |
| Workflows | 34 |
| Assertion Presets | 5 |
| **Total Gallery Samples** | **67** |

---

# Phase 2: Legacy Manual Integration into Training Paths UI

> **Goal:** Register the 73 existing Group B companion manuals (+ 1 standalone + 1 cross-entity versioning) into `trainingPaths.ts` so they appear in the Gallery's Training Paths sidebar alongside the 4 existing paths.
>
> **Status: ✅ COMPLETE**
>
> **Completed:** 2026-05-01
>
> All 75 manuals registered across 15 training paths (8 original + 7 new workflow sub-paths + assertion overview added).

## Integration Strategy

### New Training Paths Added

The legacy manuals were organized into **7 new training paths** + updates to existing paths:

| # | Training Path ID | Name | Icon | Files | Status |
|---|---|---|---|---|---|
| 5 | `requests` | Request Basics | 📡 | 13 | ✅ |
| 6 | `tests` | Test Suites | 🧪 | 10 | ✅ |
| 7 | `catalog` | API Catalog | 📚 | 7 | ✅ |
| 8 | `assertion-mastery` | Assertion Mastery (Phase 4 added) | ✅ | 17 (was 11, +6 preset samples) | ✅ |
| 9 | `wf-flow-control` | Workflow: Flow Control | 🔀 | 6 | ✅ |
| 10 | `wf-api-patterns` | Workflow: API Patterns | 🔗 | 5 | ✅ |
| 11 | `wf-diverse-apis` | Workflow: Diverse APIs | 🌐 | 5 | ✅ |
| 12 | `wf-script-node` | Workflow: Script Node | 📜 | 4 | ✅ |
| 13 | `wf-event-driven` | Workflow: Event-Driven | 📡 | 4 | ✅ |
| 14 | `wf-async-correlation` | Workflow: Async Correlation | ⏳ | 4 | ✅ |
| 15 | `wf-orchestration` | Workflow: Orchestration | 🎭 | 5 | ✅ |
| 16 | `wf-node-reference` | Workflow: Node Reference | 📋 | 3 | ✅ |

Plus cross-entity versioning manual added as Phase 8 to the existing `versioning` path.

**Total new manuals registered: 75** (1 YAML test spec excluded: `correlation-wait-api-yaml-test.html`)

### Naming Convention

Each new training path entry follows the existing `trainingPaths.ts` conventions:
- `manualPath` — relative to `docs/training-manuals/`
- `sampleId` — maps manual filename to gallery sample ID by convention:
  - Requests: `get-all-users-easy.html` → `req-get-all-users`
  - Tests: `user-api-smoke-easy.html` → `test-user-api-smoke`
  - Catalog: `jsonplaceholder-easy.html` → `catalog-jsonplaceholder`
  - Assertions: `api-healthcheck-easy.html` → `preset-api-healthcheck`
  - Workflows: `conditional-branching-easy.html` → `sample-workflow-branching`

### What Each Phase Delivers

For each phase:
1. Add `TrainingPath` entry to `trainingPaths.ts` (or add phases to existing path)
2. Wire `manualPath` and `sampleId` for every manual
3. Run `npx tsc --noEmit` to verify
4. Update this plan tracker

---

## Delivery Phases

### Phase 2A — Request Basics (13 files)

**Training Path:** `requests` — "Request Basics" 📡
**Description:** Learn to build, send, and inspect API requests against real public endpoints.

#### Phase 2A-1: Getting Started (Easy) — 5 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `requests/requests.html` | — | Overview page |
| 2 | `requests/get-all-users-easy.html` | `req-get-all-users` | GET request, JSON response, status codes |
| 3 | `requests/get-pokemon-easy.html` | `req-get-pokemon` | Nested JSON, path parameters |
| 4 | `requests/random-dog-easy.html` | `req-random-dog` | Simple GET, image URLs |
| 5 | `requests/search-countries-easy.html` | `req-search-countries` | Query parameters, search filtering |
| 6 | `requests/create-post-easy.html` | `req-create-post` | POST request, JSON body |

#### Phase 2A-2: CRUD and Pagination (Medium) — 6 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 7 | `requests/search-books-medium.html` | `req-search-books` | Search queries, large payloads |
| 8 | `requests/paginated-users-medium.html` | `req-paginated-users` | Pagination parameters, page traversal |
| 9 | `requests/product-search-medium.html` | `req-product-search` | E-commerce search, filtering |
| 10 | `requests/update-resource-medium.html` | `req-update-resource` | PUT/PATCH requests |
| 11 | `requests/delete-resource-medium.html` | `req-delete-resource` | DELETE requests, status validation |
| 12 | `requests/auth-login-medium.html` | `req-auth-login` | Login flow, token extraction |

#### Phase 2A-3: Advanced Request Patterns (Advanced) — 1 manual

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 13 | `requests/echo-headers-advanced.html` | `req-echo-headers` | Custom headers, header inspection, debugging |

**Delivery:** 1 `trainingPaths.ts` entry with 3 phases, 12 manuals + 1 overview.

---

### Phase 2B — Test Design (10 files)

**Training Path:** `tests` — "Test Design" 🧪
**Description:** Build multi-scenario test suites with assertions, data files, and real API endpoints.

#### Phase 2B-1: First Tests (Easy) — 3 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `tests/tests.html` | — | Overview page |
| 2 | `tests/user-api-smoke-easy.html` | `test-user-api-smoke` | Smoke test, basic assertions |
| 3 | `tests/product-listing-easy.html` | `test-product-listing` | Product validation, multiple scenarios |
| 4 | `tests/json-data-files-easy.html` | — | CSV/JSON data files, parameterized tests |

#### Phase 2B-2: Intermediate Testing (Medium) — 4 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 5 | `tests/paginated-regression-medium.html` | `test-paginated-regression` | Regression testing, pagination |
| 6 | `tests/pokemon-contract-medium.html` | `test-pokemon-contract` | Contract testing, schema validation |
| 7 | `tests/country-search-medium.html` | `test-country-search` | Search validation, data integrity |
| 8 | `tests/auth-flow-medium.html` | `test-auth-flow` | Auth-dependent tests, chained requests |

#### Phase 2B-3: Advanced Test Suites (Advanced) — 2 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 9 | `tests/ecommerce-full-advanced.html` | `test-ecommerce-full` | Full e-commerce test suite, multi-scenario |
| 10 | `tests/multi-api-load-advanced.html` | `test-multi-api-load` | Load testing, concurrent execution, metrics |

**Delivery:** 1 `trainingPaths.ts` entry with 3 phases, 9 manuals + 1 overview.

---

### Phase 2C — API Catalog (7 files)

**Training Path:** `catalog` — "API Catalog" 📚
**Description:** Import and explore OpenAPI specifications, browse endpoints, and generate requests from specs.

#### Phase 2C-1: Importing Specs (Easy) — 2 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `catalog/catalog.html` | — | Overview page |
| 2 | `catalog/jsonplaceholder-easy.html` | `catalog-jsonplaceholder` | Import spec, browse endpoints |
| 3 | `catalog/fakestore-easy.html` | `catalog-fakestore` | E-commerce spec, schema inspection |

#### Phase 2C-2: Exploring APIs (Medium/Advanced) — 4 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 4 | `catalog/pokeapi-medium.html` | `catalog-pokeapi` | Nested schemas, complex endpoints |
| 5 | `catalog/rest-countries-medium.html` | `catalog-rest-countries` | Filter endpoints, rich data models |
| 6 | `catalog/dummyjson-medium.html` | `catalog-dummyjson` | Auth endpoints, pagination in specs |
| 7 | `catalog/httpbin-advanced.html` | `catalog-httpbin` | Advanced spec, testing utilities |

**Delivery:** 1 `trainingPaths.ts` entry with 2 phases, 6 manuals + 1 overview.

---

### Phase 2D — Assertion Preset Samples (6 files)

**Training Path:** `assertion-mastery` — added as Phase 4 "Preset Sample Walkthroughs"
**Description:** Ready-made assertion sets for common validation patterns — import, customize, and compose. Added as a new phase to the existing `assertion-mastery` path rather than a separate path.

#### Phase 2D-1: Basic Presets (Easy/Medium) — 3 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `assertions/assertions.html` | — | Overview page |
| 2 | `assertions/api-healthcheck-easy.html` | `preset-api-healthcheck` | Status + response time check |
| 3 | `assertions/paginated-list-easy.html` | `preset-paginated-list` | Array length + pagination fields |
| 4 | `assertions/token-expiry-medium.html` | `preset-token-expiry` | JWT regex + date assertion |

#### Phase 2D-2: Advanced Presets (Medium/Advanced) — 2 manuals

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 5 | `assertions/price-guard-medium.html` | `preset-price-guard` | Numeric range + field presence |
| 6 | `assertions/api-contract-advanced.html` | `preset-api-contract` | Full contract assertion composition |

**Delivery:** Added Phase 4 ("Preset Sample Walkthroughs") to existing `assertion-mastery` path, 5 manuals + 1 overview.

---

### Phase 2E — Workflow Samples (37 files — split into 8 separate training paths)

**Training Paths:** 8 new paths — `wf-flow-control`, `wf-api-patterns`, `wf-diverse-apis`, `wf-script-node`, `wf-event-driven`, `wf-async-correlation`, `wf-orchestration`, `wf-node-reference`
**Description:** Hands-on walkthroughs of every gallery workflow sample — from simple API calls to multi-stage orchestrations. Split into 8 focused paths by topic rather than one large path.

> The existing `workflow-patterns` path teaches **concepts** (nodes, patterns, techniques).
> These new workflow paths teach **by example** (each manual walks through a specific gallery sample).
>
> **Note:** `correlation-wait-api-yaml-test.html` was excluded — it is a YAML test spec, not a training manual.

#### Phase 2E-1: API Patterns (5 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `workflow/api-patterns/api-patterns.html` | — | Subfolder overview |
| 2 | `workflow/api-patterns/create-extract-verify-easy.html` | `sample-workflow-001` | Create → extract ID → verify |
| 3 | `workflow/api-patterns/parallel-api-calls-easy.html` | `sample-workflow-parallel` | Fork/Join parallel HTTP calls |
| 4 | `workflow/api-patterns/expression-functions-advanced.html` | `sample-workflow-expressions` | Expression evaluation in nodes |
| 5 | `workflow/api-patterns/debug-trace-advanced.html` | `sample-workflow-log-debug` | LogDebug, trace output |

#### Phase 2E-2: Flow Control (6 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 6 | `workflow/flow-control/flow-control.html` | — | Subfolder overview |
| 7 | `workflow/flow-control/conditional-branching-easy.html` | `sample-workflow-branching` | If/Else condition routing |
| 8 | `workflow/flow-control/switch-order-router-medium.html` | `sample-workflow-switch` | Switch node multi-way |
| 9 | `workflow/flow-control/paginated-fetcher-medium.html` | `sample-workflow-loop-agg` | Loop + pagination |
| 10 | `workflow/flow-control/error-handler-advanced.html` | `sample-workflow-error-handler` | Node-level error handler |
| 11 | `workflow/flow-control/wf-error-handler-advanced.html` | `sample-workflow-wf-error-handler` | Workflow-level error handler |

#### Phase 2E-3: Event-Driven Workflows (4 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 12 | `workflow/event-driven/event-driven.html` | — | Subfolder overview |
| 13 | `workflow/event-driven/webhook-trigger-easy.html` | `sample-workflow-webhook` | Webhook node setup |
| 14 | `workflow/event-driven/schedule-trigger-easy.html` | `sample-workflow-schedule` | Schedule/cron triggers |
| 15 | `workflow/event-driven/wait-condition-advanced.html` | `sample-workflow-wait-condition` | WaitForCondition polling |

#### Phase 2E-4: Async Correlation (5 files, 4 registered)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 16 | `workflow/async-correlation/async-correlation.html` | — | Subfolder overview |
| 17 | `workflow/async-correlation/payment-callback-easy.html` | `sample-workflow-payment-callback-easy` | Simple callback pattern |
| 18 | `workflow/async-correlation/approval-workflow-medium.html` | `sample-workflow-approval-medium` | Human approval loop |
| 19 | `workflow/async-correlation/parallel-payment-advanced.html` | `sample-workflow-parallel-payment-advanced` | Multi-provider payment |
| 20 | `workflow/async-correlation/correlation-wait-api-yaml-test.html` | — | ⏭️ Excluded — YAML test spec, not a training manual |

#### Phase 2E-5: Diverse APIs (5 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 21 | `workflow/diverse-apis/country-currency-easy.html` | `sample-workflow-country-currency` | REST Countries → currency |
| 22 | `workflow/diverse-apis/pokemon-evolution-easy.html` | `sample-workflow-pokemon-evolution` | PokéAPI evolution chain |
| 23 | `workflow/diverse-apis/book-search-medium.html` | `sample-workflow-book-search` | Open Library search |
| 24 | `workflow/diverse-apis/multi-api-dashboard-medium.html` | `sample-workflow-multi-api-dashboard` | Multi-source aggregation |
| 25 | `workflow/diverse-apis/product-cart-medium.html` | `sample-workflow-product-cart` | E-commerce cart flow |

#### Phase 2E-6: Script Node (4 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 26 | `workflow/script-node/script-node.html` | — | Subfolder overview |
| 27 | `workflow/script-node/json-formatter-easy.html` | `sample-workflow-script-easy` | Basic script, JSON transform |
| 28 | `workflow/script-node/cross-api-validator-medium.html` | `sample-workflow-script-medium` | Cross-API validation script |
| 29 | `workflow/script-node/data-pipeline-report-advanced.html` | `sample-workflow-script-advanced` | Data pipeline, report generation |

#### Phase 2E-7: Orchestration (5 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 30 | `workflow/orchestration/orchestration.html` | — | Subfolder overview |
| 31 | `workflow/orchestration/order-pipeline-advanced.html` | `sample-workflow-order-pipeline` | Multi-stage order processing |
| 32 | `workflow/orchestration/deploy-orchestrator-advanced.html` | `sample-workflow-deploy-orchestrator` | Deployment with rollback |
| 33 | `workflow/orchestration/batch-provisioning-advanced.html` | `sample-workflow-batch` | Batch resource provisioning |
| 34 | `workflow/orchestration/sub-workflow-advanced.html` | `sample-workflow-sub-workflow` | Sub-workflow composition |

#### Phase 2E-8: Node Reference + Standalone (2 files)

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 35 | `workflow/node-reference/node-reference.html` | — | Complete node type reference |
| 36 | `workflow/workflow.html` | — | Workflow domain overview |
| 37 | `sub-workflow-samples-guide.html` | — | Standalone sub-workflow guide |

**Delivery:** 8 new `trainingPaths.ts` entries (one per workflow sub-category), 36 manuals total (excluding 1 YAML test spec).

---

### Phase 2F — Versioning Cross-Entity (1 file)

Add the missing cross-entity manual to the **existing** Versioning training path.

| # | File | `sampleId` | Topics |
|---|---|---|---|
| 1 | `versioning/cross-entity/cross-feature-versioning-advanced.html` | — | Full lifecycle across entities, version hygiene, team patterns |

**Delivery:** Add 1 manual to existing `versioning` path as a new Phase 8 ("Cross-Entity Versioning").

---

## Phase 2 — Implementation Priority & Status

| Phase | Scope | Manuals | `trainingPaths.ts` Change | Status |
|---|---|---|---|---|
| **2A** | Request Basics | 12 + overview | New path `requests` (3 phases) | ✅ Done |
| **2B** | Test Design | 9 + overview | New path `tests` (3 phases) | ✅ Done |
| **2C** | API Catalog | 6 + overview | New path `catalog` (2 phases) | ✅ Done |
| **2D** | Assertion Preset Samples | 5 + overview | Added Phase 4 to existing `assertion-mastery` path | ✅ Done |
| **2E** | Workflow Samples | 36 manuals across 8 sub-categories | 8 new paths: `wf-flow-control`, `wf-api-patterns`, `wf-diverse-apis`, `wf-script-node`, `wf-event-driven`, `wf-async-correlation`, `wf-orchestration`, `wf-node-reference` | ✅ Done |
| **2F** | Versioning Cross-Entity | 1 | Added Phase 8 to existing `versioning` path | ✅ Done |

**Progress: 75 / 75 manuals registered (100%)**

---

## Phase 2 — Detailed Delivery Tracker

### 2A — Request Basics (13 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `requests/requests.html` | Overview | ✅ |
| 2 | `requests/get-all-users-easy.html` | Manual | ✅ |
| 3 | `requests/get-pokemon-easy.html` | Manual | ✅ |
| 4 | `requests/random-dog-easy.html` | Manual | ✅ |
| 5 | `requests/search-countries-easy.html` | Manual | ✅ |
| 6 | `requests/create-post-easy.html` | Manual | ✅ |
| 7 | `requests/search-books-medium.html` | Manual | ✅ |
| 8 | `requests/paginated-users-medium.html` | Manual | ✅ |
| 9 | `requests/product-search-medium.html` | Manual | ✅ |
| 10 | `requests/update-resource-medium.html` | Manual | ✅ |
| 11 | `requests/delete-resource-medium.html` | Manual | ✅ |
| 12 | `requests/auth-login-medium.html` | Manual | ✅ |
| 13 | `requests/echo-headers-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add `requests` path | Code | ✅ |

### 2B — Test Design (10 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `tests/tests.html` | Overview | ✅ |
| 2 | `tests/user-api-smoke-easy.html` | Manual | ✅ |
| 3 | `tests/product-listing-easy.html` | Manual | ✅ |
| 4 | `tests/json-data-files-easy.html` | Manual | ✅ |
| 5 | `tests/paginated-regression-medium.html` | Manual | ✅ |
| 6 | `tests/pokemon-contract-medium.html` | Manual | ✅ |
| 7 | `tests/country-search-medium.html` | Manual | ✅ |
| 8 | `tests/auth-flow-medium.html` | Manual | ✅ |
| 9 | `tests/ecommerce-full-advanced.html` | Manual | ✅ |
| 10 | `tests/multi-api-load-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add `tests` path | Code | ✅ |

### 2C — API Catalog (7 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `catalog/catalog.html` | Overview | ✅ |
| 2 | `catalog/jsonplaceholder-easy.html` | Manual | ✅ |
| 3 | `catalog/fakestore-easy.html` | Manual | ✅ |
| 4 | `catalog/pokeapi-medium.html` | Manual | ✅ |
| 5 | `catalog/rest-countries-medium.html` | Manual | ✅ |
| 6 | `catalog/dummyjson-medium.html` | Manual | ✅ |
| 7 | `catalog/httpbin-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add `catalog` path | Code | ✅ |

### 2D — Assertion Preset Samples (6 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `assertions/assertions.html` | Overview | ✅ |
| 2 | `assertions/api-healthcheck-easy.html` | Manual | ✅ |
| 3 | `assertions/paginated-list-easy.html` | Manual | ✅ |
| 4 | `assertions/token-expiry-medium.html` | Manual | ✅ |
| 5 | `assertions/price-guard-medium.html` | Manual | ✅ |
| 6 | `assertions/api-contract-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 4 to `assertion-mastery` path | Code | ✅ |

### 2E — Workflow Samples (37 files)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `workflow/workflow.html` | Domain Overview | ✅ |
| 2 | `workflow/api-patterns/api-patterns.html` | Sub Overview | ✅ |
| 3 | `workflow/api-patterns/create-extract-verify-easy.html` | Manual | ✅ |
| 4 | `workflow/api-patterns/parallel-api-calls-easy.html` | Manual | ✅ |
| 5 | `workflow/api-patterns/expression-functions-advanced.html` | Manual | ✅ |
| 6 | `workflow/api-patterns/debug-trace-advanced.html` | Manual | ✅ |
| 7 | `workflow/flow-control/flow-control.html` | Sub Overview | ✅ |
| 8 | `workflow/flow-control/conditional-branching-easy.html` | Manual | ✅ |
| 9 | `workflow/flow-control/switch-order-router-medium.html` | Manual | ✅ |
| 10 | `workflow/flow-control/paginated-fetcher-medium.html` | Manual | ✅ |
| 11 | `workflow/flow-control/error-handler-advanced.html` | Manual | ✅ |
| 12 | `workflow/flow-control/wf-error-handler-advanced.html` | Manual | ✅ |
| 13 | `workflow/event-driven/event-driven.html` | Sub Overview | ✅ |
| 14 | `workflow/event-driven/webhook-trigger-easy.html` | Manual | ✅ |
| 15 | `workflow/event-driven/schedule-trigger-easy.html` | Manual | ✅ |
| 16 | `workflow/event-driven/wait-condition-advanced.html` | Manual | ✅ |
| 17 | `workflow/async-correlation/async-correlation.html` | Sub Overview | ✅ |
| 18 | `workflow/async-correlation/payment-callback-easy.html` | Manual | ✅ |
| 19 | `workflow/async-correlation/approval-workflow-medium.html` | Manual | ✅ |
| 20 | `workflow/async-correlation/parallel-payment-advanced.html` | Manual | ✅ |
| 21 | `workflow/async-correlation/correlation-wait-api-yaml-test.html` | YAML Test Spec | ⏭️ Excluded (not a training manual) |
| 22 | `workflow/diverse-apis/country-currency-easy.html` | Manual | ✅ |
| 23 | `workflow/diverse-apis/pokemon-evolution-easy.html` | Manual | ✅ |
| 24 | `workflow/diverse-apis/book-search-medium.html` | Manual | ✅ |
| 25 | `workflow/diverse-apis/multi-api-dashboard-medium.html` | Manual | ✅ |
| 26 | `workflow/diverse-apis/product-cart-medium.html` | Manual | ✅ |
| 27 | `workflow/script-node/script-node.html` | Sub Overview | ✅ |
| 28 | `workflow/script-node/json-formatter-easy.html` | Manual | ✅ |
| 29 | `workflow/script-node/cross-api-validator-medium.html` | Manual | ✅ |
| 30 | `workflow/script-node/data-pipeline-report-advanced.html` | Manual | ✅ |
| 31 | `workflow/orchestration/orchestration.html` | Sub Overview | ✅ |
| 32 | `workflow/orchestration/order-pipeline-advanced.html` | Manual | ✅ |
| 33 | `workflow/orchestration/deploy-orchestrator-advanced.html` | Manual | ✅ |
| 34 | `workflow/orchestration/batch-provisioning-advanced.html` | Manual | ✅ |
| 35 | `workflow/orchestration/sub-workflow-advanced.html` | Manual | ✅ |
| 36 | `workflow/node-reference/node-reference.html` | Reference | ✅ |
| 37 | `sub-workflow-samples-guide.html` | Standalone | ✅ |
| — | `trainingPaths.ts` — add 8 workflow paths | Code | ✅ |

### 2F — Versioning Cross-Entity (1 file)

| # | File | Type | Status |
|---|---|---|---|
| 1 | `versioning/cross-entity/cross-feature-versioning-advanced.html` | Manual | ✅ |
| — | `trainingPaths.ts` — add Phase 8 to `versioning` path | Code | ✅ |

---

## Phase 2 — Summary

| Deliverable | Count | Status |
|---|---|---|
| New training paths in `trainingPaths.ts` | 10 | ✅ 10 / 10 |
| Existing path updates (`versioning`, `assertion-mastery`) | 2 | ✅ 2 / 2 |
| Manuals registered | 62 | ✅ 62 / 62 |
| Overview/reference pages registered | 13 | ✅ 13 / 13 |
| **Total manuals wired** | **75** | **✅ 75 / 75** |

> **Phase 2 completed:** 2026-05-01
> All 75 legacy manuals are now accessible via the Gallery Training Paths UI.
