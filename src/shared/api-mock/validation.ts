/**
 * API Mock Studio — structural and semantic validation (Phase 1A).
 * Pure functions producing ApiMockDiagnosticV1 arrays.
 */
import type {
  ApiMockDiagnosticV1,
  ApiMockServerDefinitionV1,
  ApiMockServerSettingsV1,
  ApiMockRouteV1,
  ApiMockPredicateGroupV1,
  ApiMockPredicateV1,
  ApiMockResponseVariantV1,
  ApiMockWorkspaceV1,
  ApiMockResponseMode,
  ApiMockFaultKind,
  ApiMockSecuritySelector,
} from './contracts';
import { CURRENT_SCHEMA_VERSION, HARD_CEILINGS } from './defaults';

type D = ApiMockDiagnosticV1;
const d = (code: string, severity: D['severity'], path: string, message: string, remediation?: string, context?: D['context']): D =>
  ({ code, severity, path, message, ...(remediation ? { remediation } : {}), ...(context ? { context } : {}) });

const MVP_RESPONSE_MODES: ApiMockResponseMode[] = ['rules'];
const MVP_FAULT_KINDS: ApiMockFaultKind[] = ['none'];
const VALID_SECURITY_SELECTORS: ApiMockSecuritySelector[] = ['scheme', 'username', 'tokenClaim', 'apiKeyName', 'apiKeyLocation', 'certSubject'];

export function validateWorkspace(ws: ApiMockWorkspaceV1): D[] {
  const out: D[] = [];
  if (ws.schemaVersion > CURRENT_SCHEMA_VERSION) {
    out.push(d('AMS-IMPORT-VERSION-UNKNOWN', 'error', '/schemaVersion', `Schema version ${ws.schemaVersion} is not supported`, `Maximum supported version is ${CURRENT_SCHEMA_VERSION}`));
    return out;
  }
  const serverIds = new Set<string>();
  for (let i = 0; i < ws.servers.length; i++) {
    const srv = ws.servers[i];
    if (serverIds.has(srv.id)) {
      out.push(d('AMS-SCHEMA-DUPLICATE-ID', 'error', `/servers/${i}/id`, `Duplicate server ID "${srv.id}"`));
    }
    serverIds.add(srv.id);
    out.push(...validateServer(srv, `/servers/${i}`));
  }
  return out;
}

export function validateServer(srv: ApiMockServerDefinitionV1, basePath = ''): D[] {
  const out: D[] = [];
  if (!srv.id) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/id`, 'Server ID is required'));
  if (!srv.name) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/name`, 'Server name is required'));

  // Validate routes
  const routeIds = new Set<string>();
  const folderIds = new Set(srv.folders.map(f => f.id));
  let predicateCount = 0;

  if (srv.routes.length > HARD_CEILINGS.maxRoutes) {
    out.push(d('AMS-LIMIT-ROUTES', 'error', `${basePath}/routes`, `${srv.routes.length} routes exceeds the ${HARD_CEILINGS.maxRoutes} ceiling`, 'Remove or disable excess routes', { value: srv.routes.length, ceiling: HARD_CEILINGS.maxRoutes }));
  }

  for (let i = 0; i < srv.routes.length; i++) {
    const route = srv.routes[i];
    if (routeIds.has(route.id)) {
      out.push(d('AMS-SCHEMA-DUPLICATE-ID', 'error', `${basePath}/routes/${i}/id`, `Duplicate route ID "${route.id}"`));
    }
    routeIds.add(route.id);
    if (route.folderId && !folderIds.has(route.folderId)) {
      out.push(d('AMS-REF-DANGLING-FOLDER', 'warning', `${basePath}/routes/${i}/folderId`, `Route references non-existent folder "${route.folderId}"`));
    }
    const routeDiags = validateRoute(route, `${basePath}/routes/${i}`);
    out.push(...routeDiags);
    predicateCount += countPredicates(route.predicates);
  }

  if (predicateCount > HARD_CEILINGS.maxPredicates) {
    out.push(d('AMS-LIMIT-PREDICATES', 'error', `${basePath}/routes`, `${predicateCount} predicates exceeds the ${HARD_CEILINGS.maxPredicates} ceiling`, 'Simplify predicate trees'));
  }

  // Validate folder references
  for (let i = 0; i < srv.folders.length; i++) {
    const folder = srv.folders[i];
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      out.push(d('AMS-REF-DANGLING-FOLDER', 'warning', `${basePath}/folders/${i}/parentId`, `Folder references non-existent parent "${folder.parentId}"`));
    }
  }

  // Validate samples
  for (let i = 0; i < srv.samples.length; i++) {
    const sample = srv.samples[i];
    if (sample.routeId && !routeIds.has(sample.routeId)) {
      out.push(d('AMS-REF-DANGLING-ROUTE', 'warning', `${basePath}/samples/${i}/routeId`, `Sample references non-existent route "${sample.routeId}"`));
    }
  }

  // Validate settings limits against hard ceilings
  out.push(...validateSettingsLimits(srv.settings, `${basePath}/settings`));

  return out;
}

export function validateRoute(route: ApiMockRouteV1, basePath = ''): D[] {
  const out: D[] = [];
  if (!route.id) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/id`, 'Route ID is required'));
  if (!route.name) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/name`, 'Route name is required'));

  // Capability gate: only 'rules' mode in MVP
  if (!MVP_RESPONSE_MODES.includes(route.responseMode)) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/responseMode`, `Response mode "${route.responseMode}" is not available in MVP`, 'Use "rules" mode'));
  }

  // Validate path matcher
  if (route.path.kind === 'regex') {
    if (route.path.value.length > HARD_CEILINGS.maxRegexLength) {
      out.push(d('AMS-LIMIT-REGEX-LENGTH', 'error', `${basePath}/path/value`, `Regex length ${route.path.value.length} exceeds ${HARD_CEILINGS.maxRegexLength}`, 'Shorten the regex pattern'));
    }
    try {
      new RegExp(route.path.value);
    } catch {
      out.push(d('AMS-REGEX-INVALID', 'error', `${basePath}/path/value`, `Invalid regex: ${route.path.value}`));
    }
  }

  // Validate predicates
  out.push(...validatePredicateGroup(route.predicates, `${basePath}/predicates`, 0));

  // Validate responses
  if (route.responses.length === 0) {
    out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/responses`, 'At least one response variant is required'));
  } else if (route.responses.length > HARD_CEILINGS.maxVariantsPerRoute) {
    out.push(d('AMS-LIMIT-VARIANTS', 'error', `${basePath}/responses`, `${route.responses.length} variants exceeds ${HARD_CEILINGS.maxVariantsPerRoute}`));
  }

  if (route.responseMode === 'rules') {
    out.push(...validateRulesMode(route.responses, basePath));
  }

  // Validate behavior capability gates
  for (let i = 0; i < route.responses.length; i++) {
    out.push(...validateResponseCapabilityGates(route.responses[i], `${basePath}/responses/${i}`));
  }

  return out;
}

function validateRulesMode(responses: ApiMockResponseVariantV1[], basePath: string): D[] {
  const out: D[] = [];
  const enabledDefaults = responses.filter(r => r.enabled && r.isDefault);
  const enabledAny = responses.filter(r => r.enabled);

  if (enabledAny.length === 0) {
    out.push(d('AMS-RESPONSE-NO-ENABLED-VARIANT', 'error', `${basePath}/responses`, 'At least one response variant must be enabled'));
  }
  if (enabledDefaults.length === 0 && enabledAny.length > 0) {
    out.push(d('AMS-RESPONSE-NO-DEFAULT', 'error', `${basePath}/responses`, 'Rules mode requires exactly one enabled default variant'));
  }
  if (enabledDefaults.length > 1) {
    out.push(d('AMS-RESPONSE-MULTIPLE-DEFAULTS', 'error', `${basePath}/responses`, `${enabledDefaults.length} enabled defaults found; exactly one is required`));
  }

  for (let i = 0; i < responses.length; i++) {
    const v = responses[i];
    if (v.weight !== undefined) {
      out.push(d('AMS-RESPONSE-INVALID-MODE', 'error', `${basePath}/responses/${i}/weight`, 'Weight is not valid in "rules" mode'));
    }
    if (v.transition) {
      out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/responses/${i}/transition`, 'State transitions are not available in MVP'));
    }
  }

  return out;
}

function validateResponseCapabilityGates(v: ApiMockResponseVariantV1, basePath: string): D[] {
  const out: D[] = [];
  const b = v.behavior;
  if (b.fault && !MVP_FAULT_KINDS.includes(b.fault)) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/behavior/fault`, `Fault "${b.fault}" is not available in MVP`));
  }
  if (b.chunkSchedule?.length) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/behavior/chunkSchedule`, 'Chunk scheduling is not available in MVP'));
  }
  if (b.maxMatches !== undefined) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/behavior/maxMatches`, 'Match limits are not available in MVP'));
  }
  if (b.expiresAt !== undefined) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/behavior/expiresAt`, 'Expiry is not available in MVP'));
  }
  if (b.probability !== undefined) {
    out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/behavior/probability`, 'Probability is not available in MVP'));
  }
  return out;
}

export function validatePredicateGroup(group: ApiMockPredicateGroupV1, basePath: string, depth: number): D[] {
  const out: D[] = [];
  if (depth > HARD_CEILINGS.maxNestingDepth) {
    out.push(d('AMS-LIMIT-NESTING-DEPTH', 'error', basePath, `Nesting depth ${depth} exceeds ${HARD_CEILINGS.maxNestingDepth}`));
    return out;
  }
  for (let i = 0; i < group.children.length; i++) {
    const child = group.children[i];
    if ('combinator' in child) {
      out.push(...validatePredicateGroup(child, `${basePath}/children/${i}`, depth + 1));
    } else {
      out.push(...validatePredicate(child, `${basePath}/children/${i}`));
    }
  }
  return out;
}

function validatePredicate(pred: ApiMockPredicateV1, basePath: string): D[] {
  const out: D[] = [];
  if (pred.source === 'security' && pred.selector) {
    if (!VALID_SECURITY_SELECTORS.includes(pred.selector as ApiMockSecuritySelector)) {
      out.push(d('AMS-SCHEMA-INVALID-TYPE', 'error', `${basePath}/selector`, `Invalid security selector "${pred.selector}"`, `Valid selectors: ${VALID_SECURITY_SELECTORS.join(', ')}`));
    }
    if (pred.selector === 'certSubject') {
      out.push(d('AMS-CAPABILITY-GATED', 'error', `${basePath}/selector`, 'mTLS certificate matching is not available until Phase 10'));
    }
  }
  if (pred.operator === 'regex' && typeof pred.expected === 'string') {
    if (pred.expected.length > HARD_CEILINGS.maxRegexLength) {
      out.push(d('AMS-LIMIT-REGEX-LENGTH', 'error', `${basePath}/expected`, `Regex length exceeds ${HARD_CEILINGS.maxRegexLength}`));
    }
    try {
      new RegExp(pred.expected);
    } catch {
      out.push(d('AMS-REGEX-INVALID', 'error', `${basePath}/expected`, `Invalid regex: ${pred.expected}`));
    }
  }
  return out;
}

function validateSettingsLimits(settings: ApiMockServerSettingsV1, basePath: string): D[] {
  const out: D[] = [];
  const l = settings.limits;
  const checks: Array<[string, number, number]> = [
    ['maxInboundBodyBytes', l.maxInboundBodyBytes, HARD_CEILINGS.maxInboundBodyBytes],
    ['maxResponseBodyBytes', l.maxResponseBodyBytes, HARD_CEILINGS.maxResponseBodyBytes],
    ['maxConcurrentConnections', l.maxConcurrentConnections, HARD_CEILINGS.maxConcurrentConnections],
    ['gracefulDrainMs', l.gracefulDrainMs, HARD_CEILINGS.maxGracefulDrainMs],
  ];
  for (const [key, value, ceiling] of checks) {
    if (value > ceiling) {
      out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/limits/${key}`, `${value} exceeds hard ceiling ${ceiling}`, `Maximum allowed: ${ceiling}`, { value, ceiling }));
    }
  }
  if (l.maxDelayMs > HARD_CEILINGS.maxDelayMs) {
    out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/limits/maxDelayMs`, `${l.maxDelayMs} exceeds ${HARD_CEILINGS.maxDelayMs}ms`));
  }
  return out;
}

function countPredicates(group: ApiMockPredicateGroupV1): number {
  let count = 0;
  for (const child of group.children) {
    if ('combinator' in child) {
      count += countPredicates(child);
    } else {
      count++;
    }
  }
  return count;
}
