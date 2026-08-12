/**
 * API Mock Studio — shared contracts (Phase 1A).
 * Pure types used by renderer, companion server, and CLI.
 * No React, Express, storage, or platform imports.
 */

// ── Shared Enums ────────────────────────────────────────────────────

export type ApiMockMethod =
  | 'ANY' | 'GET' | 'HEAD' | 'POST' | 'PUT'
  | 'PATCH' | 'DELETE' | 'OPTIONS' | 'TRACE';

export type ApiMockPredicateOperator =
  | 'exact' | 'contains' | 'prefix' | 'suffix'
  | 'regex' | 'glob'
  | 'present' | 'absent'
  | 'jsonPath_exists' | 'jsonPath_equals'
  | 'jsonSchema'
  | 'json_strict' | 'json_subset'
  | 'xpath_exists' | 'xpath_equals'
  | 'xmlSchema'
  | 'form_field_exact' | 'form_field_regex' | 'form_field_present'
  | 'multipart_field' | 'multipart_file'
  | 'binary_exact' | 'binary_sha256';

export type ApiMockResponseMode = 'rules' | 'sequence' | 'weighted' | 'state';

export type ApiMockServerState =
  | 'stopped' | 'starting' | 'running'
  | 'applying' | 'draining' | 'error';

export type ApiMockPathMatcherKind = 'exact' | 'parameterized' | 'glob' | 'regex';

export type ApiMockResponseBodyKind =
  | 'none' | 'text' | 'json' | 'xml' | 'html'
  | 'form' | 'binary_base64' | 'file';

export type ApiMockFaultKind =
  | 'none' | 'timeout' | 'close' | 'reset' | 'malformed' | 'dribble';

export type ApiMockTransactionOutcome =
  | 'matched' | 'ambiguous' | 'unmatched' | 'fault' | 'error';

export type ApiMockDiagnosticSeverity = 'error' | 'warning' | 'info';

export type ApiMockSecuritySelector =
  | 'scheme' | 'username' | 'tokenClaim'
  | 'apiKeyName' | 'apiKeyLocation' | 'certSubject';

// ── Predicate Types ─────────────────────────────────────────────────

export type ApiMockPredicateExpectedValue =
  | string | number | boolean | null
  | string[]
  | Record<string, string | number | boolean | null | string[]>;

export interface ApiMockPredicateGroupV1 {
  id: string;
  combinator: 'all' | 'any' | 'not';
  children: Array<ApiMockPredicateGroupV1 | ApiMockPredicateV1>;
}

export interface ApiMockPredicateV1 {
  id: string;
  source: 'pathParam' | 'query' | 'header' | 'cookie' | 'security' | 'body' | 'transport';
  selector?: string;
  operator: ApiMockPredicateOperator;
  expected?: ApiMockPredicateExpectedValue;
  options?: {
    caseSensitive?: boolean;
    negate?: boolean;
    matchStyle?: 'subset' | 'exact';
  };
}

// ── Path Matcher ────────────────────────────────────────────────────

export interface ApiMockPathMatcherV1 {
  kind: ApiMockPathMatcherKind;
  value: string;
  paramNames?: string[];
  flags?: { caseInsensitive?: boolean; decoded?: boolean };
}

// ── Response & Behavior ─────────────────────────────────────────────

export interface ApiMockResponseCookieV1 {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ApiMockResponseBodyV1 {
  kind: ApiMockResponseBodyKind;
  content: string;
  contentType?: string;
  encoding?: 'utf-8' | 'base64';
  filePath?: string;
}

export interface ApiMockBehaviorV1 {
  delayMs: number;
  jitterMs: number;
  longRunningMs?: number;
  chunkSchedule?: Array<{ afterMs: number; body: string }>;
  maxMatches?: number;
  expiresAt?: string;
  fault?: ApiMockFaultKind;
  probability?: number;
}

export interface ApiMockStateTransitionV1 {
  currentState?: string;
  targetState: string;
  counterUpdates?: Array<{ key: string; delta: number }>;
}

export interface ApiMockResponseVariantV1 {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  conditions?: ApiMockPredicateGroupV1;
  weight?: number;
  status: number;
  reasonPhrase?: string;
  headers: Array<{ id: string; key: string; value: string; enabled: boolean }>;
  cookies: ApiMockResponseCookieV1[];
  body: ApiMockResponseBodyV1;
  behavior: ApiMockBehaviorV1;
  transition?: ApiMockStateTransitionV1;
}

export interface ApiMockStaticResponseV1 {
  status: number;
  reasonPhrase?: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
  contentType: string;
}

// ── Variables & Import Source ────────────────────────────────────────

export interface ApiMockVariableV1 {
  id: string;
  key: string;
  value: string;
  sensitive: boolean;
  description?: string;
}

export interface ApiMockImportSourceV1 {
  kind: 'redfireforge' | 'openapi' | 'wiremock' | 'curl' | 'catalog' | 'requests' | 'journal';
  label?: string;
  importedAt: string;
  sourceVersion?: string;
  diagnostics: ApiMockDiagnosticV1[];
}

// ── Folder ──────────────────────────────────────────────────────────

export interface ApiMockRouteFolderV1 {
  id: string;
  parentId?: string;
  name: string;
  expanded: boolean;
  sortOrder: number;
}

// ── Route ───────────────────────────────────────────────────────────

export interface ApiMockRouteV1 {
  id: string;
  folderId?: string;
  name: string;
  enabled: boolean;
  method: ApiMockMethod;
  path: ApiMockPathMatcherV1;
  priority: number;
  predicates: ApiMockPredicateGroupV1;
  responseMode: ApiMockResponseMode;
  responses: ApiMockResponseVariantV1[];
  tags: string[];
  operationId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Settings ────────────────────────────────────────────────────────

export interface ApiMockServerSettingsV1 {
  selection: {
    multipleMatchPolicy: 'highest_priority' | 'reject_multiple';
    equalPriorityPolicy: 'specificity_then_id' | 'reject';
    ambiguityResponse: ApiMockStaticResponseV1;
  };
  fallback: {
    unmatchedResponse: ApiMockStaticResponseV1;
    mode: 'default_response' | 'closest_match_debug';
  };
  cors: {
    enabled: boolean;
    allowOrigins: string[];
    allowMethods: ApiMockMethod[];
    allowHeaders: string[];
    allowCredentials: boolean;
    maxAge: number;
    exposeHeaders: string[];
  };
  limits: {
    maxInboundBodyBytes: number;
    maxResponseBodyBytes: number;
    maxConcurrentConnections: number;
    maxDelayMs: number;
    longRunningEnabled: boolean;
    longRunningMaxMs: number;
    gracefulDrainMs: number;
  };
  journal: {
    enabled: boolean;
    maxEntries: number;
    maxCapturedBodyBytes: number;
    persistToDisk: boolean;
    retentionSeconds?: number;
  };
  redaction: {
    headerNames: string[];
    jsonPaths: string[];
    preserveScheme: boolean;
  };
}

// ── Server Definition ───────────────────────────────────────────────

export interface ApiMockServerDefinitionV1 {
  id: string;
  name: string;
  enabled: boolean;
  host: '127.0.0.1' | 'localhost' | '0.0.0.0';
  port: number;
  basePath: string;
  folders: ApiMockRouteFolderV1[];
  routes: ApiMockRouteV1[];
  samples: ApiMockSimulationSampleV1[];
  variables: ApiMockVariableV1[];
  settings: ApiMockServerSettingsV1;
  source?: ApiMockImportSourceV1;
  createdAt: string;
  updatedAt: string;
}

// ── Workspace ───────────────────────────────────────────────────────

export interface ApiMockWorkspaceV1 {
  schemaVersion: 1;
  activeServerId?: string;
  servers: ApiMockServerDefinitionV1[];
  tabOrder: string[];
}

// ── Diagnostics ─────────────────────────────────────────────────────

export interface ApiMockDiagnosticV1 {
  code: string;
  severity: ApiMockDiagnosticSeverity;
  path: string;
  message: string;
  remediation?: string;
  context?: Record<string, string | number | boolean>;
}

// ── Captured Request/Response ───────────────────────────────────────

export interface ApiMockCapturedRequestV1 {
  method: string;
  path: string;
  rawPath: string;
  query: Record<string, string[]>;
  headers: Record<string, string[]>;
  cookies: Record<string, string>;
  body: string | null;
  bodyTruncated: boolean;
  contentType?: string;
  contentLength?: number;
  remoteAddress?: string;
  receivedAt: string;
}

export interface ApiMockCapturedResponseV1 {
  status: number;
  reasonPhrase?: string;
  headers: Record<string, string[]>;
  cookies: ApiMockResponseCookieV1[];
  body: string | null;
  bodyTruncated: boolean;
  contentType?: string;
  durationMs: number;
  generationAtResponse: number;
}

// ── Simulation ──────────────────────────────────────────────────────

export interface ApiMockSimulationSampleV1 {
  id: string;
  name: string;
  routeId?: string;
  request: ApiMockCapturedRequestV1;
  expected?: {
    outcome: ApiMockTransactionOutcome;
    routeId?: string;
    responseId?: string;
    status?: number;
    headers?: Record<string, string | string[]>;
    bodyContains?: string;
    bodyExact?: string;
  };
}

// ── Match Explanation ───────────────────────────────────────────────

export interface ApiMockPredicateResultV1 {
  predicateId: string;
  groupId: string;
  source: string;
  operator: ApiMockPredicateOperator;
  passed: boolean;
  evaluated: boolean;
  reason?: string;
}

export interface ApiMockMatchExplanationV1 {
  normalizedRequest: {
    method: string;
    path: string;
    decodedPath: string;
    pathSegments: string[];
    query: Record<string, string[]>;
    headerKeys: string[];
    cookieKeys: string[];
    bodyContentType?: string;
    bodySizeBytes: number;
  };
  candidates: Array<{
    routeId: string;
    routeName: string;
    priority: number;
    enabled: boolean;
    methodMatch: boolean;
    pathMatch: boolean;
    predicateResults: ApiMockPredicateResultV1[];
    overallMatch: boolean;
  }>;
  policyDecision: {
    policy: 'highest_priority' | 'reject_multiple';
    equalPriorityPolicy: 'specificity_then_id' | 'reject';
    matchedCount: number;
    highestPriority: number;
    tiedAtHighest: number;
    outcome: ApiMockTransactionOutcome;
    selectedRouteId?: string;
    selectedResponseId?: string;
    specificityBreakdown?: Array<{
      routeId: string;
      score: number;
      components: Array<{ source: string; weight: number }>;
    }>;
  };
  nearMisses: Array<{
    routeId: string;
    routeName: string;
    failedPredicates: Array<{ predicateId: string; source: string; reason: string }>;
    missDistance: number;
  }>;
}

// ── Conflict Finding ────────────────────────────────────────────────

export interface ApiMockConflictFindingV1 {
  id: string;
  serverId: string;
  ruleIds: [string, string];
  kind: 'definite_overlap' | 'potential_overlap' | 'duplicate' | 'shadowed' | 'unreachable';
  severity: ApiMockDiagnosticSeverity;
  dimensions: Array<{
    source: 'method' | 'path' | ApiMockPredicateV1['source'];
    selector?: string;
    result: 'overlap' | 'disjoint' | 'unknown';
    explanation: string;
  }>;
  selectionOutcome: 'reject_ambiguous' | 'left_wins' | 'right_wins' | 'tie_break' | 'unknown';
  witnessRequest?: ApiMockCapturedRequestV1;
  ruleFingerprints: [string, string];
  acknowledgedAt?: string;
}

// ── Runtime Snapshot & Transaction ──────────────────────────────────

export interface ApiMockRuntimeSnapshotV1 {
  serverId: string;
  generation: number;
  committedAt: string;
  definitionFingerprint: string;
  definition: ApiMockServerDefinitionV1;
}

export interface ApiMockTransactionV1 {
  id: string;
  serverId: string;
  generation: number;
  receivedAt: string;
  completedAt?: string;
  request: ApiMockCapturedRequestV1;
  response?: ApiMockCapturedResponseV1;
  outcome: ApiMockTransactionOutcome;
  matchedRouteId?: string;
  matchedResponseId?: string;
  explanation: ApiMockMatchExplanationV1;
  durationMs?: number;
}

// ── Export Envelope ──────────────────────────────────────────────────

export type ApiMockExportPayloadV1 =
  | { scope: 'workspace'; workspace: ApiMockWorkspaceV1 }
  | { scope: 'servers'; servers: ApiMockServerDefinitionV1[] }
  | { scope: 'routes'; sourceServerId: string; routes: ApiMockRouteV1[]; samples: ApiMockSimulationSampleV1[] };

export interface ApiMockExportV1 {
  _exportMeta: {
    kind: 'redfireforge-api-mock';
    schemaVersion: 1;
    exportedAt: string;
    redacted: boolean;
  };
  data: ApiMockExportPayloadV1;
}

// ── Migration ───────────────────────────────────────────────────────

export interface ApiMockMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (data: Record<string, unknown>) => {
    result: Record<string, unknown>;
    diagnostics: ApiMockDiagnosticV1[];
  };
}

// ── Template Context (transient runtime value) ──────────────────────

export interface ApiMockTemplateContextV1 {
  request: {
    method: string;
    path: string;
    pathParams: Record<string, string>;
    query: Record<string, string[]>;
    headers: Record<string, string[]>;
    cookies: Record<string, string>;
    body: Record<string, unknown> | string | null;
    rawBody: string;
  };
  state: Record<string, string>;
  variables: Record<string, string>;
  counters: Record<string, number>;
  now: string;
  seed: string;
}

// ── Conformance Corpus ──────────────────────────────────────────────

export interface ApiMockConformanceCaseV1 {
  id: string;
  description: string;
  category: 'match' | 'no-match' | 'ambiguity' | 'conflict' | 'validation' | 'redaction';
  server: {
    settings: Partial<ApiMockServerSettingsV1>;
    routes: ApiMockRouteV1[];
  };
  request: ApiMockCapturedRequestV1;
  expected: {
    outcome: ApiMockTransactionOutcome;
    matchedRouteId?: string;
    matchedResponseId?: string;
    status?: number;
    candidateCount?: number;
    nearMissCount?: number;
    diagnosticCodes?: string[];
    conflictKinds?: ApiMockConflictFindingV1['kind'][];
  };
}

// ── Simulation Result ───────────────────────────────────────────────

export interface ApiMockSimulationResultV1 {
  sampleId: string;
  generation: number | 'draft';
  passed?: boolean;
  outcome: ApiMockTransactionOutcome;
  renderedResponse?: ApiMockCapturedResponseV1;
  trace: ApiMockMatchExplanationV1;
}
