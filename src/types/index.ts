export interface KeyValue {
  key: string;
  value: string;
}

export type AuthType = 'none' | 'basic' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  username?: string;
  password?: string;
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
  scenarios: TestScenario[];
}

export interface ScenarioWeight {
  scenarioId: string;
  weight: number;
}

export interface TestConfig {
  concurrency: number;
  totalTransactions: number;
  scenarioWeights: ScenarioWeight[];
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
}
