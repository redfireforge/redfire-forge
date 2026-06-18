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
  apqUnsupportedDetected?: boolean; // true after server-not-supported detection; disables APQ toggle UI
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
}

export interface GraphqlHeaderRow {
  id: string;
  key: string;
  value: string;              // {{var}} supported; resolved at runtime
  enabled: boolean;
}

export interface GraphqlAuth {
  type: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
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
  timestamp: number;
  // Sprint 7 (2D) — incremental delivery metadata
  /** true while a multipart/mixed stream is still delivering chunks */
  isStreaming?: boolean;
  /** number of multipart chunks received so far (undefined for non-incremental requests) */
  chunkCount?: number;
}

export interface GraphqlError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
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

export interface GraphqlHistoryItem {
  id: string;
  operation: GraphqlOperation;
  response: GraphqlResponse;
  connectionId: string;
  timestamp: number;           // denormalized from response.timestamp for fast sorting/indexing without deserializing the full response
  latencyMs: number;           // denormalized from response for fast display in history list without parsing response
}

// Phase 1 — named environment containing resolved key-value variable pairs
export interface GraphqlEnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  masked?: boolean;            // true = display as ••••• in the UI (for secrets/tokens)
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

export interface GraphqlCollectionFolder {
  id: string;
  name: string;
  parentId?: string;           // undefined = root
  createdAt: number;
}

export interface GraphqlCollectionItem {
  id: string;
  name: string;
  description?: string;        // user-written notes for this operation
  folderId?: string;           // undefined = root collection
  operation: GraphqlOperation;
  connectionId?: string;       // optional — saved connection context
  scripts?: GraphqlScriptConfig;  // per-item pre/post-request scripts (Phase 3)
  isPinned?: boolean;
  tags?: string[];             // user-defined tags for filtering/grouping
  createdAt: number;
  updatedAt: number;
}

export interface GraphqlScriptConfig {
  preRequest?: string;         // JavaScript source for pre-request script (sandboxed)
  postResponse?: string;       // JavaScript source for post-response script (sandboxed)
  timeout?: number;            // max execution time ms (default: 5000)
  enabled?: boolean;           // false = scripts defined but not executed (default: true)
}

export interface RfResponseContext {
  httpStatus:  number;
  httpHeaders: Record<string, string>;
  data:        unknown;
  errors?:     GraphqlError[];
  latencyMs:   number;
}

// The `rf` object injected into pre-request and post-response scripts
export interface RfContext {
  getEnv(key: string): string | undefined;
  setEnv(key: string, value: string): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;
  response?: RfResponseContext;  // undefined in pre-request; populated in post-response
  assert(condition: boolean, message?: string): void;
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

export interface GraphqlCodeGenOptions {
  target: 'typescript-graphql-request' | 'typescript-urql' | 'typescript-apollo' |
          'typescript-fetch' | 'python-gql' | 'curl' | 'httpie';
  includeTypes: boolean;          // prepend TypeScript interface definitions
  useEnvVarsForHeaders: boolean;  // replace {{var}} with process.env / os.environ / $VAR
  includeErrorHandling: boolean;  // wrap client call in try/catch (TS) or try/except (Python);
                                  // adds GraphQL errors check (if result.errors throw/raise)
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
  criticality: 'BREAKING' | 'DANGEROUS' | 'SAFE';
  path: string;                // e.g. "Query.user" or "Order.items[first: Int]"
  description: string;         // human-readable change description
  oldValue?: string;
  newValue?: string;
}

export interface GraphqlSchemaDiffResult {
  changes: GraphqlSchemaDiffChange[];
  breakingCount: number;
  dangerousCount: number;
  safeCount: number;
}

export type MockResolver =
  | { type: 'random' }
  | { type: 'fixed';  value: unknown }
  | { type: 'script'; code: string };  // JS arrow function body: "() => new Date().toISOString()"

export interface GraphqlMockConfig {
  connectionId: string;
  enabled: boolean;
  resolvers: Record<string, Record<string, MockResolver>>;  // typeName → fieldName → resolver
  globalLatencyMs: number;    // added to every mock response (0 = no delay)
  seed?: number;              // random seed for deterministic mock data generation
}
