export interface Environment {
  id: string;
  name: string;
}

export interface Microservice {
  id: string;
  name: string;
  baseUrls: Record<string, string>;        // environmentId -> base URL
  authProfileIds?: Record<string, string>; // environmentId -> GlobalAuthProfile id
  customEnvs?: Environment[];              // microservice-specific environments
}

export interface KeyValue {
  key: string;
  value: string;
}

export type AuthType = 'none' | 'inherit' | 'basic' | 'bearer' | 'apikey' | 'digest' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  // Basic & Digest
  username?: string;
  password?: string;
  // Bearer
  token?: string;
  prefix?: string;
  // API Key
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  // OAuth2 Client Credentials
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  // Links to a GlobalAuthProfile by id
  globalProfileId?: string;
  // Catalog UI state: tracks inherited security scheme / global profile binding
  __inherit?: boolean;
  __schemeName?: string;
  __globalProfileId?: string;
  __globalProfileName?: string;
}

export type ValidationMode = 'none' | 'full' | 'selective';

export interface ExpectedField {
  jsonPath: string;
  expectedValue: string;
}

export type SelectiveMode = 'include' | 'exclude';

export interface ResponseVersion {
  id: string;
  timestamp: number;
  label?: string;
  json: string;
  validationMode?: ValidationMode;
  selectiveMode?: SelectiveMode;
  expectedFields?: ExpectedField[];
  excludedPaths?: string[];
  unorderedArrays?: boolean;
}

export type AssertionOperator = 'equals' | 'contains' | 'regex' | 'exists';

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=';

export type DateReference =
  | { kind: 'today'; timezone: 'utc' | 'local' }
  | { kind: 'fixed'; iso: string };

export type Assertion =
  | { type: 'status'; expected: string }
  | { type: 'responseTime'; maxMs: number }
  | { type: 'header'; name: string; operator: AssertionOperator; value?: string }
  | { type: 'regex'; jsonPath: string; pattern: string }
  | { type: 'arrayLength'; jsonPath: string; operator: ComparisonOperator; value: number }
  | { type: 'numeric'; jsonPath: string; operator: ComparisonOperator; value: number }
  | { type: 'date'; jsonPath: string; operator: ComparisonOperator; reference: DateReference };

export interface ValidationConfig {
  mode: ValidationMode;
  expectedJson?: string;
  expectedFields?: ExpectedField[];
  selectiveMode?: SelectiveMode;
  sampleJson?: string;
  excludedPaths?: string[];
  unorderedArrays?: boolean;
  responseVersions?: ResponseVersion[];
  assertions?: Assertion[];
}

export type BodyType = 'none' | 'json' | 'xml' | 'text' | 'form-urlencoded' | 'form-data' | 'file';

export type ExtractionSource = 'body' | 'header' | 'status';

export interface Extraction {
  name: string;
  source: ExtractionSource;
  expression: string;
  fallback?: string;
}

export interface Scenario {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
  validation: ValidationConfig;
  extractions?: Extraction[];
  fetchHostOverride?: string;
  fetchHostEnabled?: boolean;
  featureGroupName?: string;
  groupName?: string;
}

export interface TestScenario {
  id: string;
  name: string;
  auth?: AuthConfig;
  tests: Scenario[];
}

export interface GlobalAuthProfile {
  id: string;
  name: string;
  auth: AuthConfig;
}

export interface FeatureGroup {
  id: string;
  name: string;
  microserviceId?: string;
  environmentId?: string;
  auth?: AuthConfig;
  globalAuthProfileId?: string;
  scenarios: TestScenario[];
  /** Origin of this feature group. Gallery-imported groups use absolute URLs and skip host replacement. */
  source?: 'user' | 'gallery';
  /** The gallery catalog entry ID this was imported from (e.g. 'test-user-api-smoke'). */
  gallerySampleId?: string;
  /** Hash of the gallery sample content at time of import — used to detect if the sample has been updated. */
  gallerySampleHash?: string;
}

export interface ScenarioWeight {
  scenarioId: string;
  weight: number;
}

export type ExecutionMode = 'sequential' | 'batch' | 'pool' | 'load-profile' | 'workflow';

export type LoadProfileType = 'ramp-up' | 'sustained' | 'spike';

export interface LoadProfileConfig {
  type: LoadProfileType;
  durationSec: number;
  maxConcurrency: number;
  rampUpSec?: number;
  spikeConcurrency?: number;
  spikeStartSec?: number;
  spikeDurationSec?: number;
}

export type ErrorPolicy = 'continue' | 'stop-first' | 'stop-threshold';

export type ThinkTimeMode = 'none' | 'constant' | 'uniform' | 'gaussian';

export interface ThinkTimeConfig {
  mode: ThinkTimeMode;
  constantMs?: number;
  minMs?: number;
  maxMs?: number;
  meanMs?: number;
  stdDevMs?: number;
}

export interface TestConfig {
  concurrency: number;
  totalTransactions: number;
  scenarioWeights: ScenarioWeight[];
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
  workflowVariables?: Record<string, string>;
}

export interface FailureDetail {
  path: string;
  expected: string;
  actual: string;
}

export interface TimingBreakdown {
  dnsLookup: number;
  tcpConnect: number;
  tlsHandshake: number;
  ttfb: number;
  download: number;
  total: number;
}

export interface RequestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  featureGroupName?: string;
  groupName?: string;
  url: string;
  method: string;
  httpStatus: number;
  responseTimeMs: number;
  responseBody: string;
  timestamp: number;
  passed: boolean;
  validationMode: ValidationMode;
  failureDetails: FailureDetail[];
  errorMessage?: string;
  timing?: TimingBreakdown;
}

export interface TestSummary {
  tps: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  errorsByStatus: Record<number, number>;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failedValidations: number;
  totalDurationMs: number;
}

export interface TestRun {
  id: string;
  timestamp: number;
  config: TestConfig;
  summary: TestSummary;
  results: RequestResult[];
  projectName?: string;
  envName?: string;
  svcName?: string;
  baseUrl?: string;
}

// ─── Requests types ──────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CatalogRequestMeta {
  operationId?: string;
  description?: string;
  originalPath: string;
  tags: string[];
  deprecated?: boolean;
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required: boolean;
    description?: string;
    type?: string;
  }[];
  expectedResponses?: {
    statusCode: string;
    description: string;
  }[];
  security?: string[];
  sourceSpec?: string;
}

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: string;
  bodyType?: BodyType;
  bodyForm?: KeyValue[];
  auth: AuthConfig;
  savedQueryParams?: { key: string; value: string; enabled: boolean; description?: string }[];
  catalogMeta?: CatalogRequestMeta;
}

export interface RequestFolder {
  id: string;
  name: string;
  requests: RequestItem[];
  folders?: RequestFolder[];
  isSubCollection?: boolean;
  auth?: AuthConfig;
  baseUrls?: Record<string, string>;
  selectedEnvId?: string;
}

export interface RequestCollection {
  id: string;
  name: string;
  mode: 'direct' | 'multi-env' | 'group';
  groupId?: string;
  microserviceId?: string;
  baseUrls?: Record<string, string>;
  auth?: AuthConfig;
  authPerEnv?: Record<string, AuthConfig>;
  requests: RequestItem[];
  folders?: RequestFolder[];
}

export interface RequestEnv {
  id: string;
  name: string;
}

export interface RequestsData {
  environments: RequestEnv[];
  collections: RequestCollection[];
  selectedEnvId?: string;
  selectedCollectionId?: string;
  selectedRequestId?: string;
}
