export interface Environment {
  id: string;
  name: string;
}

export interface Microservice {
  id: string;
  name: string;
  baseUrls: Record<string, string>; // environmentId -> base URL
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

export interface ValidationConfig {
  mode: ValidationMode;
  expectedJson?: string;
  expectedFields?: ExpectedField[];
  selectiveMode?: SelectiveMode;
  sampleJson?: string;
  excludedPaths?: string[];
  unorderedArrays?: boolean;
  responseVersions?: ResponseVersion[];
}

export type BodyType = 'none' | 'json' | 'xml' | 'text' | 'form-urlencoded' | 'form-data' | 'file';

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
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  environments: Environment[];
  microservices: Microservice[];
  globalAuthProfiles: GlobalAuthProfile[];
  featureGroups: FeatureGroup[];
  selectedEnvId?: string;
  selectedSvcId?: string;
}

export interface ScenarioWeight {
  scenarioId: string;
  weight: number;
}

export type ExecutionMode = 'sequential' | 'batch' | 'pool' | 'load-profile';

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

export interface TestConfig {
  concurrency: number;
  totalTransactions: number;
  scenarioWeights: ScenarioWeight[];
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
}

export interface FailureDetail {
  path: string;
  expected: string;
  actual: string;
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

// ─── Workbench types ─────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface WorkbenchRequest {
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
}

export interface WorkbenchFolder {
  id: string;
  name: string;
  requests: WorkbenchRequest[];
  folders?: WorkbenchFolder[];
  isSubCollection?: boolean;
  auth?: AuthConfig;
  baseUrls?: Record<string, string>;
  selectedEnvId?: string;
}

export interface WorkbenchCollection {
  id: string;
  name: string;
  mode: 'direct' | 'multi-env';
  baseUrls?: Record<string, string>;
  auth?: AuthConfig;
  authPerEnv?: Record<string, AuthConfig>;
  requests: WorkbenchRequest[];
  folders?: WorkbenchFolder[];
}

export interface WorkbenchEnv {
  id: string;
  name: string;
}

export interface WorkbenchData {
  environments: WorkbenchEnv[];
  collections: WorkbenchCollection[];
  selectedEnvId?: string;
  selectedCollectionId?: string;
  selectedRequestId?: string;
}
