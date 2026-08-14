/**
 * API Mock Studio — default values for server settings and new entities.
 */
import type {
  ApiMockServerSettingsV1,
  ApiMockStaticResponseV1,
  ApiMockBehaviorV1,
  ApiMockResponseBodyV1,
  ApiMockPredicateGroupV1,
  ApiMockResponseVariantV1,
} from './contracts';
import { DEFAULT_PROXY_SETTINGS } from './proxyContracts';
import { DEFAULT_CALLBACK_SETTINGS } from './callbackContracts';

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_AMBIGUITY_RESPONSE: ApiMockStaticResponseV1 = {
  status: 409,
  reasonPhrase: 'Conflict',
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  body: '{"error":"ambiguous","requestId":"{{requestId}}","competingRules":{{competingRuleCount}}}',
  contentType: 'application/json',
};

export const DEFAULT_UNMATCHED_RESPONSE: ApiMockStaticResponseV1 = {
  status: 404,
  reasonPhrase: 'Not Found',
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  body: '{"error":"not_found","requestId":"{{requestId}}"}',
  contentType: 'application/json',
};

export const DEFAULT_SETTINGS: ApiMockServerSettingsV1 = {
  selection: {
    multipleMatchPolicy: 'highest_priority',
    equalPriorityPolicy: 'reject',
    ambiguityResponse: { ...DEFAULT_AMBIGUITY_RESPONSE },
  },
  fallback: {
    unmatchedResponse: { ...DEFAULT_UNMATCHED_RESPONSE },
    mode: 'default_response',
  },
  cors: {
    enabled: false,
    allowOrigins: ['*'],
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    allowCredentials: false,
    maxAge: 86400,
    exposeHeaders: [],
  },
  limits: {
    maxInboundBodyBytes: 1_048_576,
    maxResponseBodyBytes: 1_048_576,
    maxConcurrentConnections: 100,
    maxDelayMs: 0,
    longRunningEnabled: false,
    longRunningMaxMs: 3_600_000,
    gracefulDrainMs: 5_000,
  },
  journal: {
    enabled: true,
    maxEntries: 500,
    maxCapturedBodyBytes: 262_144,
    persistToDisk: false,
  },
  redaction: {
    headerNames: ['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key', 'x-auth-token'],
    jsonPaths: [],
    preserveScheme: true,
  },
  proxy: { ...DEFAULT_PROXY_SETTINGS, allowlist: [], forwardCredentialHeaders: [] },
  callbacks: { ...DEFAULT_CALLBACK_SETTINGS, allowlist: [] },
};

export const DEFAULT_BEHAVIOR: ApiMockBehaviorV1 = {
  delayMs: 0,
  jitterMs: 0,
};

export const DEFAULT_BODY: ApiMockResponseBodyV1 = {
  kind: 'none',
  content: '',
};

export const EMPTY_PREDICATE_GROUP: ApiMockPredicateGroupV1 = {
  id: '',
  combinator: 'all',
  children: [],
};

export function createDefaultResponse(id: string): ApiMockResponseVariantV1 {
  return {
    id,
    name: '200 Default',
    enabled: true,
    isDefault: true,
    status: 200,
    headers: [],
    cookies: [],
    body: { ...DEFAULT_BODY },
    behavior: { ...DEFAULT_BEHAVIOR },
  };
}

// Hard ceilings — configurable values cannot exceed these
export const HARD_CEILINGS = {
  maxOpenTabs: 8,
  maxRoutes: 2_000,
  maxPredicates: 10_000,
  maxNestingDepth: 16,
  maxVariantsPerRoute: 100,
  maxRegexLength: 4_096,
  maxRegexInspectBytes: 1_048_576,
  maxRequestHeaders: 200,
  maxRequestHeaderBytes: 16_384,
  maxInboundBodyBytes: 10_485_760,
  maxResponseBodyBytes: 10_485_760,
  maxConcurrentConnections: 500,
  maxDelayMs: 60_000,
  maxLongRunningMs: 3_600_000,
  maxGracefulDrainMs: 30_000,
  maxJournalEntries: 500,
  maxCapturedBodyBytes: 1_048_576,
  maxSimulationBatch: 500,
  maxTemplateNesting: 32,
  maxTemplateOperations: 10_000,
} as const;

export const AUTO_PORT_RANGE = { min: 4600, max: 4699 } as const;
