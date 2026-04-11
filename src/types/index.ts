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

export interface ValidationConfig {
  mode: ValidationMode;
  expectedJson?: string;
  expectedFields?: ExpectedField[];
  selectiveMode?: SelectiveMode;
  sampleJson?: string;
  excludedPaths?: string[];
  unorderedArrays?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: KeyValue[];
  body: string;
  auth: AuthConfig;
  validation: ValidationConfig;
}

export interface TestScenario {
  id: string;
  name: string;
  auth?: AuthConfig;
  tests: Scenario[];
}

export interface FeatureGroup {
  id: string;
  name: string;
  microserviceId?: string;
  environmentId?: string;
  scenarios: TestScenario[];
}

export interface ScenarioWeight {
  scenarioId: string;
  weight: number;
}

export type ExecutionMode = 'batch' | 'pool';

export interface TestConfig {
  concurrency: number;
  totalTransactions: number;
  scenarioWeights: ScenarioWeight[];
  executionMode: ExecutionMode;
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
  envName?: string;
  svcName?: string;
  baseUrl?: string;
}
