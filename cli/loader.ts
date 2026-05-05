import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import type {
  Scenario, TestConfig, AuthConfig, ValidationConfig, Assertion, Extraction,
  KeyValue, ExecutionMode, ErrorPolicy, LoadProfileConfig, DataSource,
} from '../src/types';
import { buildDataSourceFromInline } from './dataLoader';

// ── YAML/JSON test file schema ──────────────────────────────

interface TestFileExtraction {
  name: string;
  source?: 'body' | 'header' | 'status';
  expression: string;
  fallback?: string;
}

interface TestFileScenario {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyType?: string;
  auth?: TestFileAuth;
  validation?: TestFileValidation;
  extract?: TestFileExtraction[];
  weight?: number;
  featureGroup?: string;
  scenario?: string;
  /** Inline data source for parameterized testing */
  data?: { columns?: string[]; rows: (string[] | Record<string, unknown>)[] };
}

interface TestFileAuth {
  type: 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'digest';
  username?: string;
  password?: string;
  token?: string;
  prefix?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

interface TestFileValidation {
  mode: 'none' | 'full' | 'selective';
  expectedJson?: string;
  expectedFields?: { jsonPath: string; expectedValue: string }[];
  selectiveMode?: 'include' | 'exclude';
  excludedPaths?: string[];
  unorderedArrays?: boolean;
  assertions?: Assertion[];
}

export interface TestFile {
  name?: string;
  baseUrl?: string;
  env?: string;
  variables?: Record<string, string>;
  defaults?: {
    auth?: TestFileAuth;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  };
  config?: {
    concurrency?: number;
    transactions?: number;
    mode?: string;
    errorPolicy?: string;
    maxErrors?: number;
    maxErrorRate?: number;
    loadProfile?: {
      type?: string;
      duration?: number;
      maxConcurrency?: number;
      rampUp?: number;
      spikeConcurrency?: number;
      spikeStart?: number;
      spikeDuration?: number;
    };
  };
  tests: TestFileScenario[];
}

// ── Loader ──────────────────────────────────────────────────

export function loadTestFile(filePath: string): TestFile {
  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.toLowerCase();
  let parsed: unknown;
  if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
    parsed = parseYaml(content);
  } else {
    parsed = JSON.parse(content);
  }
  const file = parsed as TestFile;
  if (!file.tests || !Array.isArray(file.tests) || file.tests.length === 0) {
    throw new Error(`Test file must contain a non-empty "tests" array.`);
  }
  return file;
}

// ── Convert to engine types ─────────────────────────────────

function toAuth(a?: TestFileAuth): AuthConfig {
  if (!a || a.type === 'none') return { type: 'none' };
  return {
    type: a.type,
    username: a.username,
    password: a.password,
    token: a.token,
    prefix: a.prefix,
    apiKeyName: a.apiKeyName,
    apiKeyValue: a.apiKeyValue,
    apiKeyIn: a.apiKeyIn,
    tokenUrl: a.tokenUrl,
    clientId: a.clientId,
    clientSecret: a.clientSecret,
  };
}

function toValidation(v?: TestFileValidation): ValidationConfig {
  if (!v || v.mode === 'none') return { mode: 'none', assertions: v?.assertions };
  return {
    mode: v.mode,
    expectedJson: v.expectedJson,
    expectedFields: v.expectedFields,
    selectiveMode: v.selectiveMode,
    excludedPaths: v.excludedPaths,
    unorderedArrays: v.unorderedArrays,
    assertions: v.assertions,
  };
}

function toHeaders(h?: Record<string, string>): KeyValue[] {
  if (!h) return [];
  return Object.entries(h).map(([key, value]) => ({ key, value }));
}

function resolveUrl(url: string, baseUrl?: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!baseUrl) return url;
  const base = baseUrl.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function buildScenarios(file: TestFile, cliBaseUrl?: string, externalDataSource?: DataSource): Scenario[] {
  const base = cliBaseUrl || file.baseUrl;
  const defaultAuth = toAuth(file.defaults?.auth);
  const defaultHeaders = toHeaders(file.defaults?.headers);

  return file.tests.map((t) => {
    const testHeaders = toHeaders(t.headers);
    const mergedHeaders = [...defaultHeaders];
    for (const h of testHeaders) {
      const existing = mergedHeaders.findIndex(dh => dh.key.toLowerCase() === h.key.toLowerCase());
      if (existing >= 0) mergedHeaders[existing] = h;
      else mergedHeaders.push(h);
    }

    const extractions: Extraction[] | undefined = t.extract?.map(e => ({
      name: e.name,
      source: e.source ?? 'body',
      expression: e.expression,
      fallback: e.fallback,
    }));

    // Data source: CLI --data flag takes priority, then inline YAML data
    let dataSource: DataSource | undefined = externalDataSource;
    if (!dataSource && t.data) {
      dataSource = buildDataSourceFromInline(t.data);
    }

    return {
      id: uuidv4(),
      name: t.name,
      url: resolveUrl(t.url, base),
      method: (t.method?.toUpperCase() ?? 'GET') as Scenario['method'],
      headers: mergedHeaders,
      body: t.body ?? '',
      bodyType: (t.bodyType as Scenario['bodyType']) ?? undefined,
      auth: t.auth ? toAuth(t.auth) : defaultAuth,
      validation: toValidation(t.validation),
      extractions,
      featureGroupName: t.featureGroup,
      groupName: t.scenario,
      dataSource,
    };
  });
}

export function buildTestConfig(
  file: TestFile,
  scenarios: Scenario[],
  cliOverrides: {
    concurrency?: number;
    transactions?: number;
    mode?: string;
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    duration?: number;
    errorPolicy?: string;
    maxErrors?: number;
    maxErrorRate?: number;
  },
): TestConfig {
  const fc = file.config ?? {};
  const concurrency = cliOverrides.concurrency ?? fc.concurrency ?? 1;
  // Default transaction count: account for data source expansion
  const expandedCount = scenarios.reduce((n, s) => {
    const rowCount = s.dataSource?.rows.filter(r => r.enabled).length ?? 0;
    return n + (rowCount > 0 ? rowCount : 1);
  }, 0);
  const transactions = cliOverrides.transactions ?? fc.transactions ?? expandedCount;
  const mode = (cliOverrides.mode ?? fc.mode ?? 'batch') as ExecutionMode;
  const timeout = cliOverrides.timeout ?? file.defaults?.timeout ?? 10;
  const retries = cliOverrides.retries ?? file.defaults?.retries ?? 0;
  const retryDelay = cliOverrides.retryDelay ?? file.defaults?.retryDelay ?? 1000;
  const errorPolicy = (cliOverrides.errorPolicy ?? fc.errorPolicy ?? 'continue') as ErrorPolicy;

  let loadProfile: LoadProfileConfig | undefined;
  if (mode === 'load-profile' && (fc.loadProfile || cliOverrides.duration)) {
    const lp = fc.loadProfile ?? {};
    loadProfile = {
      type: (lp.type as LoadProfileConfig['type']) ?? 'sustained',
      durationSec: cliOverrides.duration ?? lp.duration ?? 60,
      maxConcurrency: lp.maxConcurrency ?? concurrency,
      rampUpSec: lp.rampUp,
      spikeConcurrency: lp.spikeConcurrency,
      spikeStartSec: lp.spikeStart,
      spikeDurationSec: lp.spikeDuration,
    };
  }

  return {
    concurrency,
    totalTransactions: transactions,
    scenarioWeights: scenarios.map(s => ({
      scenarioId: s.id,
      weight: file.tests.find(t => t.name === s.name)?.weight ?? 1,
    })),
    executionMode: mode,
    loadProfile,
    timeoutSec: timeout,
    retryCount: retries,
    retryDelayMs: retryDelay,
    errorPolicy,
    maxErrors: cliOverrides.maxErrors ?? fc.maxErrors ?? 10,
    maxErrorRate: cliOverrides.maxErrorRate ?? fc.maxErrorRate ?? 50,
    workflowVariables: file.variables,
  };
}
