import { v4 as uuidv4 } from 'uuid';
import { readStructuredFile } from './fileParsing';
import type {
  Scenario, TestConfig, AuthConfig, ValidationConfig, Assertion, Extraction,
  KeyValue, ExecutionMode, ErrorPolicy, LoadProfileConfig, DataSource, DataSourceColumn, DataSourceRow,
} from '../src/shared/types';
import { buildDataSourceFromInline } from './dataLoader';

const DATA_SOURCE_COLUMN_TYPES: DataSourceColumn['type'][] = ['path', 'param', 'body', 'header', 'validate'];

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
  /** Inline data source for parameterized testing (compact CLI shorthand) */
  data?: { columns?: string[]; rows: (string[] | Record<string, unknown>)[] };
  /**
   * Inline data source using the full native schema (same shape the GUI exports/imports —
   * columns with id/name/type/mapping, rows with id/values/tags/enabled/note). Takes priority
   * over `data` when both are present. Row `values` may be keyed by column `id` or column `name`.
   */
  dataSource?: Record<string, unknown>;
  /**
   * Custom assertions directly on the test (compact shorthand for `validation.assertions`).
   * Merged with any assertions already nested under `validation:` when both are present.
   * Assertions run regardless of `validation.mode` — mode only gates the separate
   * expectedJson/expectedFields checks.
   */
  assertions?: Assertion[];
  /** Scenario-level tags for CLI filtering (e.g., ['smoke', 'regression']) */
  tags?: string[];
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
    iterations?: number;
    /** @deprecated Use `iterations` instead */
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
  const file = readStructuredFile(filePath) as TestFile;
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

/**
 * Merges `v.assertions` (nested under `validation:`) with `topLevelAssertions` (the compact
 * top-level `assertions:` shorthand on a test) — see BUG-5. Assertions run regardless of
 * `mode`; `mode` only gates the separate `expectedJson`/`expectedFields` checks below.
 */
function toValidation(v: TestFileValidation | undefined, topLevelAssertions?: Assertion[]): ValidationConfig {
  const assertions = [...(v?.assertions ?? []), ...(topLevelAssertions ?? [])];
  const merged = assertions.length ? assertions : undefined;

  if (!v || v.mode === 'none') return { mode: 'none', assertions: merged };
  return {
    mode: v.mode,
    expectedJson: v.expectedJson,
    expectedFields: v.expectedFields,
    selectiveMode: v.selectiveMode,
    excludedPaths: v.excludedPaths,
    unorderedArrays: v.unorderedArrays,
    assertions: merged,
  };
}

function toHeaders(h?: Record<string, string>): KeyValue[] {
  if (!h) return [];
  return Object.entries(h).map(([key, value]) => ({ key, value }));
}

// ── Native inline dataSource (full GUI-native schema) ────────

function toNativeDataSourceColumn(raw: unknown, index: number, testName: string): DataSourceColumn {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Test "${testName}": dataSource.columns[${index}] must be an object.`);
  }
  const c = raw as Record<string, unknown>;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name) {
    throw new Error(`Test "${testName}": dataSource.columns[${index}] is missing required "name".`);
  }
  const type = (typeof c.type === 'string' ? c.type : 'param') as DataSourceColumn['type'];
  if (!DATA_SOURCE_COLUMN_TYPES.includes(type)) {
    throw new Error(
      `Test "${testName}": dataSource.columns[${index}] ("${name}") has invalid type "${type}". ` +
      `Expected one of: ${DATA_SOURCE_COLUMN_TYPES.join(', ')}.`,
    );
  }
  const mapping = typeof c.mapping === 'string' ? c.mapping.trim() : '';
  if (type === 'validate' && !mapping) {
    // Unlike path/param/body/header (where defaulting mapping to the column name is a
    // reasonable shorthand), a validate column's mapping IS the JSONPath the engine matches
    // against — defaulting it to the human-readable name would silently produce a bogus
    // JSONPath that never matches anything, so this must be explicit.
    throw new Error(
      `Test "${testName}": dataSource.columns[${index}] ("${name}") is type "validate" and must ` +
      `specify a "mapping" (JSONPath, e.g. "$.name") — it cannot default to the column name.`,
    );
  }
  return {
    id: typeof c.id === 'string' && c.id ? c.id : uuidv4(),
    name,
    type,
    mapping: mapping || name,
    description: typeof c.description === 'string' ? c.description : undefined,
  };
}

function toNativeDataSourceRow(raw: unknown, index: number, columns: DataSourceColumn[], testName: string): DataSourceRow {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Test "${testName}": dataSource.rows[${index}] must be an object.`);
  }
  const r = raw as Record<string, unknown>;
  if (!r.values || typeof r.values !== 'object') {
    throw new Error(`Test "${testName}": dataSource.rows[${index}] is missing a "values" object.`);
  }
  // Accept values keyed by column id (native/GUI export) or column name (friendlier for hand-authored files).
  const idByName = new Map(columns.map(col => [col.name, col.id]));
  const knownIds = new Set(columns.map(col => col.id));
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(r.values as Record<string, unknown>)) {
    const columnId = knownIds.has(key) ? key : idByName.get(key) ?? key;
    values[columnId] = value == null ? '' : String(value);
  }
  const tags = Array.isArray(r.tags)
    ? r.tags.map(t => String(t).toLowerCase().trim()).filter(Boolean)
    : undefined;
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    label: typeof r.label === 'string' ? r.label : undefined,
    values,
    enabled: r.enabled !== false,
    tags: tags?.length ? tags : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
}

/**
 * Build a DataSource from the full native `dataSource:` schema (same shape the GUI
 * exports/imports) instead of the compact `data:` shorthand. Unlike `data:`, this
 * preserves row-level tags/notes/labels and every column type (path/param/body/header/validate).
 */
function buildDataSourceFromNative(raw: Record<string, unknown>, testName: string): DataSource {
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
    throw new Error(`Test "${testName}": dataSource.columns must be a non-empty array.`);
  }
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    throw new Error(`Test "${testName}": dataSource.rows must be a non-empty array.`);
  }
  const columns = raw.columns.map((c, i) => toNativeDataSourceColumn(c, i, testName));
  const rows = raw.rows.map((r, i) => toNativeDataSourceRow(r, i, columns, testName));
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uuidv4(),
    label: typeof raw.label === 'string' && raw.label ? raw.label : testName,
    columns,
    rows,
    source: { type: 'inline' },
  };
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

    // Data source: CLI --data flag wins, then the native dataSource: schema (fuller —
    // preserves row tags/notes), then the compact data: shorthand.
    let dataSource: DataSource | undefined = externalDataSource;
    if (!dataSource && t.dataSource) {
      dataSource = buildDataSourceFromNative(t.dataSource, t.name);
    }
    if (!dataSource && t.data) {
      dataSource = buildDataSourceFromInline(t.data);
    }

    // Normalize tags: lowercase, trim
    const scenarioTags = t.tags?.map(tag => tag.toLowerCase().trim()).filter(Boolean);

    return {
      id: uuidv4(),
      name: t.name,
      url: resolveUrl(t.url, base),
      method: (t.method?.toUpperCase() ?? 'GET') as Scenario['method'],
      headers: mergedHeaders,
      body: t.body ?? '',
      bodyType: (t.bodyType as Scenario['bodyType']) ?? undefined,
      auth: t.auth ? toAuth(t.auth) : defaultAuth,
      validation: toValidation(t.validation, t.assertions),
      extractions,
      featureGroupName: t.featureGroup,
      groupName: t.scenario,
      dataSource,
      scenarioTags: scenarioTags?.length ? scenarioTags : undefined,
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
  const expandedCount = scenarios.reduce((n, s) => {
    const rowCount = s.dataSource?.rows.filter(r => r.enabled).length ?? 0;
    return n + (rowCount > 0 ? rowCount : 1);
  }, 0);
  const transactions = cliOverrides.transactions ?? fc.iterations ?? fc.transactions ?? expandedCount;
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
    iterations: transactions,
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
