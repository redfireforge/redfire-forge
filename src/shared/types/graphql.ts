// Phase 1 shared types for GraphQL Studio
// See docs/plan/future/graphql/graphql-studio-plan.md Section 4.3

export interface GraphqlConnection {
  id: string;
  name: string;
  endpoint: string;
  wsEndpoint?: string;       // subscription endpoint (default: swap http(s) → ws(s) from endpoint URL)
  headers: Record<string, string>;
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  schemaPollingInterval?: number;  // ms between schema re-fetches; 0 = disabled (default: 30000)
  createdAt: number;               // Unix ms — used for sorting profiles in the profile switcher dropdown
  updatedAt: number;               // Unix ms — updated whenever the user edits the connection
  // Phase 2 — subscription transport selection
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse'; // default: 'auto'
  sseMode?: 'distinct' | 'single';  // only relevant when subscriptionTransport is 'sse'; default: 'distinct'
  // Phase 2 — query complexity estimator thresholds
  complexityThreshold?: number;  // cost badge turns red above this value (default: 500)
  complexityListMultiplier?: number; // list field cost multiplier (default: 10)
  complexityMaxDepth?: number;   // depth beyond which sub-tree cost doubles (default: 10)
  // Phase 2 — subscription log
  subscriptionBufferSize?: number; // max messages in memory (default: 5000)
  // Phase 2 — file upload
  maxFileSize?: number;            // client-side per-file size limit in bytes (default: 50 * 1024 * 1024 = 50 MB)
  // Phase 3 — history
  historyMaxItems?: number;        // ring buffer size for operation history (default: 100, range: 10–500)
  // Phase 3 — APQ
  apqEnabled?: boolean;            // enable Automatic Persisted Queries (default: false)
  apqUseGet?: boolean;             // when APQ is on: use GET for hash-only query requests (default: false)
  apqUnsupportedDetected?: boolean; // true after server-not-supported detection; disables APQ toggle UI
  // Phase 3 — query batching
  batchEnabled?: boolean;          // enable "Batch" checkbox per tab + Send Batch button (default: false)
  batchTimeoutMs?: number;         // timeout for batch requests in ms (default: 30000)
  batchUnsupportedDetected?: boolean; // true after server returned 400/405/non-array for a batch attempt
  // Phase 3 — request deduplication
  dedupEnabled?: boolean;          // deduplicate identical in-flight requests (default: true)
  // Phase 3F — complexity gate
  complexityBlockEnabled?: boolean;    // block queries exceeding blockThreshold (default: false)
  complexityBlockThreshold?: number;   // block threshold (default: 1000); only active when blockEnabled
}

// Phase 1 — represents a single editor tab in GraphqlStudioPage
export interface GraphqlOperationTab {
  id: string;
  label: string;              // operation name from AST, or "Untitled" for anonymous operations
  modelUri: string;           // Monaco model URI — unique per tab (e.g. "inmemory://graphql/{id}")
  operationType?: 'query' | 'mutation' | 'subscription'; // derived from AST; undefined = not yet parsed
  variables: string;          // JSON string for the Variables panel
  headers: GraphqlHeaderRow[]; // per-tab header overrides (in addition to connection-level headers)
  unsavedChanges: boolean;    // true when query/variables/headers changed since last save/load
  connectionId?: string;      // which connection profile this tab is using (undefined = none)
  /** Name of the operation the user last selected in this tab's operation picker.
   *  undefined = auto (use first operation). Persisted so the selection survives tab switches. */
  selectedOperation?: string;
  /** Phase 3F: true when this tab is checked for inclusion in a batch request */
  isBatched?: boolean;
}

export interface GraphqlHeaderRow {
  id: string;
  key: string;
  value: string;              // {{var}} supported; resolved at runtime
  enabled: boolean;
}

export interface GraphqlAuth {
  type: 'inherit' | 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  /** When type is 'inherit', references a GlobalAuthProfile id from Environment Manager. */
  globalProfileId?: string;
  token?: string;             // bearer token value
  username?: string;          // basic auth
  password?: string;          // basic auth
  headerName?: string;        // apiKey / custom header name
  headerValue?: string;       // apiKey / custom header value
  oauth2?: {                  // oauth2 client_credentials flow
    tokenUrl: string;
    clientId: string;
    clientSecret: string;     // stored as masked env var reference e.g. {{oauth_secret}}
    scope?: string;
    audience?: string;
  };
}

export interface GraphqlOperation {
  id: string;
  name?: string;
  query: string;
  variables?: string;        // JSON string
  operationType: 'query' | 'mutation' | 'subscription';
}

export interface GraphqlResponse {
  data?: unknown;
  errors?: GraphqlError[];
  extensions?: Record<string, unknown>;
  latencyMs: number;
  httpStatus: number;
  httpHeaders: Record<string, string>;
  /** Outgoing request headers sent with this operation (auth + custom, env-resolved). */
  requestHeaders?: Record<string, string>;
  /** HTTP method used for the GraphQL operation (typically POST; GET when APQ use-get is on). */
  requestMethod?: string;
  /** Parsed JSON body sent to the GraphQL endpoint (`query`, `variables`, `operationName`, …). */
  requestBody?: Record<string, unknown>;
  /** Phase 6H — where resolved auth credentials originated (page / tab / profile). */
  authSentSource?: 'page' | 'tab' | 'profile';
  /** Phase 6H — masked auth header lines shown in Metadata tab (e.g. Authorization: Bearer …). */
  authSentLines?: string[];
  timestamp: number;
  // Sprint 7 (2D) — incremental delivery metadata
  /** true while a multipart/mixed stream is still delivering chunks */
  isStreaming?: boolean;
  /** number of multipart chunks received so far (undefined for non-incremental requests) */
  chunkCount?: number;
  // Phase 3F — APQ metadata
  /** SHA-256 hex hash of the normalized query (only set when APQ was used) */
  apqHash?: string;
  /** true = hash-only request succeeded (server cache hit); false = cache miss + retry */
  apqCacheHit?: boolean;
  /** true = server does not support APQ; connection should auto-disable APQ */
  apqUnsupported?: boolean;
  /** Phase 3F — present when this response came from Send Batch (not single Execute) */
  batchContext?: GraphqlBatchResponseContext;
}

/** Metadata stamped on each tab response after a batch run */
export interface GraphqlBatchResponseContext {
  /** 0-based slot in the batch result array */
  batchIndex: number;
  batchSize: number;
  /** Server rejected JSON-array batch — proxy sent one POST per operation */
  batchUnsupported: boolean;
  /** HTTP POST count from proxy → GraphQL server (1 = array batch, batchSize = sequential) */
  upstreamRequestCount: number;
  /** Shared array-batch round-trip ms, or this operation's POST ms in sequential mode */
  batchLatencyMs: number;
  /** JSON array body sent upstream when array batch succeeded */
  wireRequestBody?: unknown[];
}

export interface GraphqlError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

// Phase 3F — batch execution result
export interface GraphqlBatchOperationResult {
  /** Original request index (preserves request-index order) */
  index: number;
  /** Operation name from the tab (for display in result card header) */
  operationName?: string;
  response: GraphqlResponse;
}

export interface GraphqlBatchResult {
  results: GraphqlBatchOperationResult[];
  /** true if the upstream server does not support array batching */
  batchUnsupported: boolean;
}

export interface GraphqlSchemaInfo {
  sdl: string;
  types: GraphqlTypeNode[];
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  fetchedAt: number;
}

export interface GraphqlTypeNode {
  name: string;
  kind: 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'SCALAR';
  description?: string;
  fields?: GraphqlFieldNode[];
  enumValues?: string[];
  interfaces?: string[];
  possibleTypes?: string[];
  /** SDL definition fragment for this type only (from printType()), used in the Schema Explorer SDL panel */
  sdlFragment?: string;
}

export interface GraphqlFieldNode {
  name: string;
  type: string;              // formatted type string e.g. "[User!]!"
  description?: string;
  args?: GraphqlArgNode[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphqlArgNode {
  name: string;
  type: string;
  description?: string;
  defaultValue?: string;
}

// Phase 3A — `response` is a JSON-serialized string (capped at 512KB before write).
// Denormalized `latencyMs`, `status`, and `timestamp` fields allow fast list rendering
// without deserializing the full response string.
export interface GraphqlHistoryItem {
  id: string;                        // crypto.randomUUID() — NOT connectionId+timestamp (collision risk)
  operation: GraphqlOperation;
  response: string;                  // JSON.stringify(GraphqlResponse), truncated to 512KB
  connectionId: string;
  timestamp: number;                 // Unix ms — compound IDB index key with connectionId
  latencyMs: number;
  status: 'success' | 'error';       // per-operation: error when no data and (GraphQL errors or HTTP failure)
}

// Phase 1 — named environment containing resolved key-value variable pairs
export interface GraphqlEnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  masked?: boolean;            // false = show value in plain text; omitted/true = hide with •••• (UI only; still editable)
}

export interface GraphqlEnvironment {
  id: string;
  name: string;                // e.g. "Staging", "Production", "Local Dev"
  variables: GraphqlEnvironmentVariable[];
  isActive: boolean;           // only one environment per workspace can be active at a time
  createdAt: number;
  updatedAt: number;
}

// Phase 2 — subscription session tracking
export type SubscriptionState =
  | 'idle'
  | 'connecting'
  | 'active'
  | 'paused'
  | 'reconnecting'
  | 'closing'
  | 'closed'
  | 'error';

export interface SubscriptionStats {
  totalMessages:      number;
  errorCount:         number;
  avgLatencyMs:       number;   // rolling average of offsetMs differences between consecutive messages
  msgsPerSec:         number;   // rolling 5-second window message rate
  connectedDurationMs: number;  // ms since subscribe() was called (updated on each message)
}

export interface GraphqlSubscriptionSession {
  id:          string;                       // UUID for this subscribe() invocation
  state:       SubscriptionState;
  transport:   'graphql-transport-ws' | 'graphql-ws' | 'sse';
  startedAt:   number;                       // Unix ms when subscribe() was called
  messages:    GraphqlSubscriptionMessage[];
  stats:       SubscriptionStats;
}

// Phase 2 — file upload slot (one entry per attached file)
export interface FileUploadSlot {
  id:           string;
  file:         File;
  variablePath: string;  // dot-separated path in the variables JSON where null should be injected (e.g. "input.avatar")
  sizeBytes:    number;
  mimeType:     string;
  error?:       string;  // client-side validation error (size exceeded, unsupported type, etc.)
}

// Phase 2 — subscription message assertion (per-message pass/fail evaluation)
export interface GraphqlSubscriptionAssertion {
  id:          string;
  jsonPath:    string;       // JSONPath expression to extract value from message data (e.g. "$.user.name")
  operator:    string;       // field operator from the existing evaluateFieldOperator engine
  expected:    unknown;      // expected value for comparison operators; unused for existence/type checks
  description: string;       // human-readable label shown in the assertion panel
}

// Phase 2 — visual query builder state (per-tab)
export type FieldSelectionPath = string;  // dot-separated field path, e.g. "user.orders.nodes.id"

export interface DirectiveApplication {
  fieldPath: FieldSelectionPath;
  directive: '@skip' | '@include' | '@defer';
  variable:  string;                        // auto-generated variable name (e.g. "skipUser")
}

export interface FragmentDefinition {
  name:    string;
  onType:  string;                          // the GraphQL type this fragment is defined on
  fields:  FieldSelectionPath[];
  isUsed:  boolean;                         // false if defined but not spread anywhere in current query
}

export interface QueryBuilderState {
  operationType:  'query' | 'mutation' | 'subscription';
  operationName:  string;
  selectedFields: Record<FieldSelectionPath, boolean>;   // path → selected
  argValues:      Record<FieldSelectionPath, string>;    // path → raw value or {{var}} reference
  aliases:        Record<FieldSelectionPath, string>;    // path → alias name
  directives:     DirectiveApplication[];
  fragments:      FragmentDefinition[];
}

// Phase 2G — Apollo Tracing (legacy extensions.tracing format)
export interface ResolverTrace {
  path:        Array<string | number>;
  parentType:  string;
  fieldName:   string;
  returnType:  string;
  startOffset: number;   // nanoseconds from request start
  duration:    number;   // nanoseconds
}

export interface ApolloTracingData {
  version:    number;
  startTime:  string;    // ISO 8601
  endTime:    string;    // ISO 8601
  duration:   number;    // nanoseconds
  parsing?:    { startOffset: number; duration: number };
  validation?: { startOffset: number; duration: number };
  execution?: { resolvers: ResolverTrace[] };
}

// Phase 2 — individual message received on a live subscription (WS or SSE)
export interface GraphqlSubscriptionMessage {
  id:          string;          // unique within this subscription session (UUID or sequential int as string)
  sessionId:   string;          // ties message to the active subscription session (shared across all messages in one subscribe call)
  index:       number;          // sequential 1-based counter since subscribe() was called
  direction:   'in' | 'out';   // 'in' = server push (`next`); 'out' = client send (e.g. `ping`)
  timestampMs: number;          // absolute Unix ms when this frame was received
  offsetMs:    number;          // ms elapsed since subscribe() was called
  data:        unknown;         // parsed JSON body of the `next` frame payload
  errors?:     GraphqlError[];  // present if the `next` frame contains an `errors` array
  transport:   'graphql-transport-ws' | 'graphql-ws' | 'sse';
}

// Phase 2 — result shape emitted by multipartParser.ts for @defer / @stream responses
export interface IncrementalDeliveryResult {
  type:        'initial' | 'patch';
  patchIndex:  number;
  path?:       Array<string | number>;          // undefined for the initial chunk; array path for patches
  data?:       unknown;                         // the patched fragment or list item data
  errors?:     GraphqlError[];                  // partial errors for this chunk only
  extensions?: Record<string, unknown>;         // e.g. Apollo Tracing data in the final chunk
  merged:      unknown;                         // fully merged accumulated result up to this point
  hasNext:     boolean;                         // false when the final chunk has been received
}

// Phase 3A — collection root entity
export interface GraphqlCollection {
  id: string;
  name: string;
  variables: Record<string, string>; // collection-scoped vars; script-only, not merged into global env
  preRequestScript: string;          // runs before every item in this collection
  postResponseScript: string;        // runs after every item in this collection
  createdAt: number;
}

// Phase 3A — folder within a collection; supports infinite nesting via parentId
export interface GraphqlCollectionFolder {
  id: string;
  collectionId: string;              // which GraphqlCollection this folder belongs to
  name: string;
  parentId?: string;                 // undefined = root of collection
  sortOrder: number;                 // display order within parent; used for IDB compound index
  createdAt: number;
}

// Phase 3A — a single saved operation item inside a collection
export interface GraphqlCollectionItem {
  id: string;
  collectionId: string;              // which GraphqlCollection this item belongs to
  name: string;
  description?: string;              // user-written notes for this operation
  folderId?: string;                 // undefined = root of collection
  sortOrder: number;                 // display order within folder; drives drag-and-drop reorder
  operation: GraphqlOperation;
  connectionId?: string;             // optional — saved connection context
  scripts?: GraphqlScriptConfig;     // per-item pre/post-request scripts (Phase 3B)
  isPinned?: boolean;
  tags?: string[];                   // user-defined tags for filtering/grouping
  lastExecutedAt?: number;           // Unix ms of last successful run; drives "Recent" pinned section
  createdAt: number;
  updatedAt: number;
}

export interface GraphqlScriptConfig {
  preRequest?: string;         // JavaScript source for pre-request script (sandboxed)
  postResponse?: string;       // JavaScript source for post-response script (sandboxed)
  timeout?: number;            // max execution time ms (default: 10000 per 3B-1)
  enabled?: boolean;           // false = scripts defined but not executed (default: true)
}

// Phase 3A — collection runner result per named rf.test() assertion
export interface CollectionRunTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

// Phase 3A — event emitted by useGraphqlCollectionRunner for each item
export interface ScriptLogEntry {
  /** log/warn/error = rf.log/warn/error output; pass/fail = rf.test() named assertion result */
  level: 'log' | 'warn' | 'error' | 'pass' | 'fail';
  message: string;
  timestamp: number;
}

export interface CollectionRunEvent {
  type: 'start' | 'result' | 'error' | 'skip';
  itemId: string;
  latencyMs?: number;
  tests?: CollectionRunTestResult[];
  error?: { phase: 'pre-script' | 'http' | 'post-script'; message: string };
  /** Phase 3B — script console output (rf.log/warn/error calls) captured during this item's execution */
  logs?: ScriptLogEntry[];
}

// Phase 3A — which tab is active in GraphqlStudioActivityBar
export type GraphqlStudioActivityTab = 'history' | 'collections' | 'mock';

export interface RfResponseContext {
  httpStatus:  number;
  httpHeaders: Record<string, string>;
  data:        unknown;
  errors?:     GraphqlError[];
  latencyMs:   number;
}

// Phase 3B-7 — typed error classes thrown by rf.abort() and rf.skip()
export class ScriptAbortError extends Error {
  constructor(message?: string) {
    super(message ?? 'Script aborted');
    this.name = 'ScriptAbortError';
  }
}

export class ScriptSkipError extends Error {
  constructor(message?: string) {
    super(message ?? 'Script requested skip');
    this.name = 'ScriptSkipError';
  }
}

// Phase 3B — thrown by rf.assert(condition, msg) when condition is false.
// Behavior by context:
//   - Inside rf.test() fn body: caught per-test and recorded as a failed test result.
//   - Top-level in pre-request phase: runner classifies as isAssertionFailure=true and
//     blocks the HTTP request (same effect as rf.abort() — the assertion is an explicit gate).
//   - Top-level in post-response phase: non-blocking; runner logs a warn and continues.
export class GraphqlAssertionError extends Error {
  constructor(message?: string) {
    super(message ?? 'Assertion failed');
    this.name = 'GraphqlAssertionError';
  }
}

// The `rf` object injected into pre-request and post-response scripts
export interface RfContext {
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  response?: RfResponseContext;  // undefined in pre-request; populated in post-response
  assert(condition: boolean, message?: string): void;
  // Phase 3B-7 — throws ScriptAbortError; blocks the HTTP request (pre-request only)
  abort(message?: string): never;
  // Phase 3B-7 — throws ScriptSkipError; marks item as skipped in collection runner
  skip(message?: string): never;
  // Phase 3B-7 — named assertion; async fn supported; collected via pendingTests[]
  test(name: string, fn: () => void | Promise<void>): void;
  // Phase 3B-7 — shared key-value store across items in a collection run; no-op stub outside runner
  store: Map<string, unknown>;
  // Phase 3B-7 — collection-scoped variables; silent no-op outside a collection context
  getCollectionVar(key: string): string | undefined;
  setCollectionVar(key: string, value: string): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  // Operation metadata (read-only, populated before script runs)
  operation: {
    name: string | undefined;        // current operation name (undefined for anonymous operations)
    type: 'query' | 'mutation' | 'subscription';
    variables: Record<string, unknown>;  // parsed variables object (read-only snapshot)
  };
}


export interface GraphqlSchemaSnapshot {
  id: string;
  connectionId: string;
  sdl: string;
  typesCount: number;
  capturedAt: number;
  label?: string;              // user-assigned label e.g. "v2.3 — before migration"
}

export interface GraphqlSchemaDiffChange {
  criticality: 'BREAKING' | 'DANGEROUS' | 'SAFE' | 'DEPRECATED';
  path: string;                // e.g. "Query.user" or "Order.items[first: Int]"
  description: string;         // human-readable change description
  oldValue?: string;
  newValue?: string;
  // Phase 3D — per-change acknowledgement (merged from graphql-diff-acknowledgements IDB store)
  acknowledged?: boolean;
  acknowledgeNote?: string;
}

export interface GraphqlSchemaDiffResult {
  changes: GraphqlSchemaDiffChange[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
  deprecatedCount: number;
}

export type MockResolver =
  | { type: 'random' }
  | { type: 'fixed';  value: unknown }
  | { type: 'script'; code: string }   // function body using `return`, e.g. "return new Date().toISOString()". Context: field, typeName, args, log
  | { type: 'error';  message: string }; // always returns a GraphQL error for this field

// Phase 3E — custom scalar value factory preset
export type MockScalarPreset = 'email' | 'date-iso' | 'uuid' | 'url' | 'phone' | 'name' | 'sentence';

export interface MockScalarFactory {
  scalarName: string;          // e.g. "DateTime", "EmailAddress"
  preset?: MockScalarPreset;   // built-in generator (no faker.js)
  scriptCode?: string;         // function body using `return`, e.g. "return new Date().toISOString()". Context: field, typeName, args, log
}

// Phase 3E — a named set of resolver overrides for quick scenario switching
export interface MockScenario {
  id: string;
  name: string;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver override
}

export interface GraphqlMockConfig {
  connectionId: string;
  enabled: boolean;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver
  globalLatencyMs: number;    // added to every mock response (0 = no delay)
  jitterMs?: number;          // random jitter added to latency (0–jitterMs); default 0
  seed?: number;              // random seed for deterministic mock data generation
  scenarios?: MockScenario[];
  activeScenarioId?: string;  // id of the currently-active scenario (undefined = base resolvers)
  scalarFactories?: MockScalarFactory[];
}
