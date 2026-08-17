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
import { isUnavailablePredicateOperator } from './unavailableOperators';
import { isJsonSchemaCompileable } from './schemaMatchers';
import { DEFAULT_PROXY_SETTINGS, PROXY_HARD_CEILINGS } from './proxyContracts';
import { CALLBACK_HARD_CEILINGS, DEFAULT_CALLBACK_SETTINGS } from './callbackContracts';

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
  const servers = Array.isArray(ws.servers) ? ws.servers : [];
  if (!Array.isArray(ws.servers)) {
    out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', '/servers', 'Workspace servers array is required'));
    return out;
  }
  for (let i = 0; i < servers.length; i++) {
    const srv = servers[i];
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
  const routes = srv.routes ?? [];
  const folders = srv.folders ?? [];
  const samples = srv.samples ?? [];
  const routeIds = new Set<string>();
  const folderIds = new Set(folders.map(f => f.id));
  let predicateCount = 0;

  if (routes.length > HARD_CEILINGS.maxRoutes) {
    out.push(d('AMS-LIMIT-ROUTES', 'error', `${basePath}/routes`, `${routes.length} routes exceeds the ${HARD_CEILINGS.maxRoutes} ceiling`, 'Remove or disable excess routes', { value: routes.length, ceiling: HARD_CEILINGS.maxRoutes }));
  }

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
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
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      out.push(d('AMS-REF-DANGLING-FOLDER', 'warning', `${basePath}/folders/${i}/parentId`, `Folder references non-existent parent "${folder.parentId}"`));
    }
  }

  // Validate samples
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.routeId && !routeIds.has(sample.routeId)) {
      out.push(d('AMS-REF-DANGLING-ROUTE', 'warning', `${basePath}/samples/${i}/routeId`, `Sample references non-existent route "${sample.routeId}"`));
    }
  }

  if (!srv.settings) {
    out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/settings`, 'Server settings are required'));
    return out;
  }

  // Validate settings limits against hard ceilings
  out.push(...validateSettingsLimits(srv.settings, `${basePath}/settings`));
  out.push(...validateProxySettings(srv.settings, `${basePath}/settings`));
  out.push(...validateTlsSettings(srv.settings, `${basePath}/settings`));
  out.push(...validateCallbackSettings(srv, `${basePath}`));

  return out;
}

export function validateRoute(route: ApiMockRouteV1, basePath = ''): D[] {
  const out: D[] = [];
  if (!route.id) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/id`, 'Route ID is required'));
  if (!route.name) out.push(d('AMS-SCHEMA-MISSING-FIELD', 'error', `${basePath}/name`, 'Route name is required'));

  // Non-rules modes are supported by the listener (Phase 7). Keep an informational note only.
  if (!MVP_RESPONSE_MODES.includes(route.responseMode)) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/responseMode`, `Response mode "${route.responseMode}" is active at runtime (sequence/weighted/state).`));
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
    out.push(...validateVariantOutbound(route.responses[i], `${basePath}/responses/${i}`));
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
      out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/responses/${i}/transition`, 'State transition will run after this variant is selected on a matched request.'));
    }
  }

  return out;
}

function validateResponseCapabilityGates(v: ApiMockResponseVariantV1, basePath: string): D[] {
  const out: D[] = [];
  const b = v.behavior;
  if (b.fault && !MVP_FAULT_KINDS.includes(b.fault)) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/behavior/fault`, `Fault "${b.fault}" is active at runtime (connection-level).`));
  }
  if (b.chunkSchedule?.length) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/behavior/chunkSchedule`, 'Chunk schedule is active for dribble faults.'));
  }
  if (b.maxMatches !== undefined) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/behavior/maxMatches`, 'Match limit is enforced at runtime.'));
  }
  if (b.expiresAt !== undefined) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/behavior/expiresAt`, 'Variant expiry is enforced at runtime.'));
  }
  if (b.probability !== undefined) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/behavior/probability`, 'Probability gating is enforced at runtime.'));
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
  }
  if (isUnavailablePredicateOperator(pred.operator)) {
    out.push(d(
      'AMS-CAPABILITY-GATED',
      'warning',
      `${basePath}/operator`,
      `Operator "${pred.operator}" is not evaluated yet — this condition never matches`,
      'Use a supported operator (exact, regex, JSONPath, XPath, schema, …).',
    ));
  }
  if (pred.operator === 'jsonSchema' && !isJsonSchemaCompileable(pred.expected)) {
    out.push(d(
      'AMS-SCHEMA-INVALID',
      'error',
      `${basePath}/expected`,
      'JSON Schema did not compile',
      'Provide a JSON Schema object or a JSON string the matcher can compile.',
    ));
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
    ['longRunningMaxMs', l.longRunningMaxMs, HARD_CEILINGS.maxLongRunningMs],
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

function validateTlsSettings(settings: ApiMockServerSettingsV1, basePath: string): D[] {
  const tls = settings.tls;
  if (!tls?.enabled) return [];
  const out: D[] = [];
  if (!tls.certPem?.trim()) {
    out.push(d(
      'AMS-TLS-CERT-MISSING',
      'error',
      `${basePath}/tls/certPem`,
      'TLS is enabled but no certificate is configured',
      'Paste a PEM certificate or generate a self-signed pair',
    ));
  }
  if (!tls.keyPem?.trim()) {
    out.push(d(
      'AMS-TLS-KEY-MISSING',
      'error',
      `${basePath}/tls/keyPem`,
      'TLS is enabled but no private key is configured',
      'Paste the matching PEM private key or generate a self-signed pair',
    ));
  }
  if (tls.certPem?.trim() && !/-----BEGIN CERTIFICATE-----/.test(tls.certPem)) {
    out.push(d(
      'AMS-TLS-CERT-INVALID',
      'error',
      `${basePath}/tls/certPem`,
      'Certificate is not PEM encoded',
      'Expected a -----BEGIN CERTIFICATE----- block',
    ));
  }
  if (tls.mtls?.enabled && !tls.mtls.clientCaPem?.trim()) {
    out.push(d(
      'AMS-TLS-CLIENT-CA-MISSING',
      'error',
      `${basePath}/tls/mtls/clientCaPem`,
      'Client certificates are required but no client CA is configured',
      'Generate a client certificate, or paste the CA that signs your client certificates',
    ));
  }
  return out;
}

function validateProxySettings(settings: ApiMockServerSettingsV1, basePath: string): D[] {
  const out: D[] = [];
  const proxy = settings.proxy ?? DEFAULT_PROXY_SETTINGS;
  const proxyActive = settings.fallback.mode === 'proxy' || proxy.enabled;

  if (settings.fallback.mode === 'proxy' && !proxy.enabled) {
    out.push(d(
      'AMS-PROXY-DISABLED',
      'error',
      `${basePath}/proxy/enabled`,
      'Fallback mode is "proxy" but proxy.enabled is false',
      'Enable proxy and configure an allowlist, or switch fallback mode',
    ));
  }

  if (proxyActive && proxy.allowlist.length === 0) {
    out.push(d(
      'AMS-PROXY-ALLOWLIST-EMPTY',
      'error',
      `${basePath}/proxy/allowlist`,
      'Proxy requires a non-empty allowlist of absolute origins',
      'Add entries like https://api.example.com',
    ));
  }

  for (let i = 0; i < proxy.allowlist.length; i++) {
    const entry = proxy.allowlist[i];
    try {
      const u = new URL(entry);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        out.push(d('AMS-PROXY-ALLOWLIST-INVALID', 'error', `${basePath}/proxy/allowlist/${i}`, `Allowlist entry must be http(s): "${entry}"`));
      }
      if (u.pathname && u.pathname !== '/') {
        out.push(d('AMS-PROXY-ALLOWLIST-INVALID', 'warning', `${basePath}/proxy/allowlist/${i}`, `Prefer origin-only allowlist entries (no path): "${entry}"`));
      }
    } catch {
      out.push(d('AMS-PROXY-ALLOWLIST-INVALID', 'error', `${basePath}/proxy/allowlist/${i}`, `Invalid allowlist URL: "${entry}"`));
    }
  }

  if (proxy.maxRedirects > PROXY_HARD_CEILINGS.maxRedirects) {
    out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/proxy/maxRedirects`, `${proxy.maxRedirects} exceeds ${PROXY_HARD_CEILINGS.maxRedirects}`));
  }
  if (proxy.timeoutMs > PROXY_HARD_CEILINGS.timeoutMs) {
    out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/proxy/timeoutMs`, `${proxy.timeoutMs} exceeds ${PROXY_HARD_CEILINGS.timeoutMs}ms`));
  }
  if (proxy.maxResponseBytes > PROXY_HARD_CEILINGS.maxResponseBytes) {
    out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/proxy/maxResponseBytes`, `${proxy.maxResponseBytes} exceeds ${PROXY_HARD_CEILINGS.maxResponseBytes}`));
  }
  if (proxy.forwardAuth) {
    out.push(d(
      'AMS-PROXY-FORWARD-AUTH',
      'warning',
      `${basePath}/proxy/forwardAuth`,
      'Credential forwarding is enabled — only allowlisted upstreams should receive Authorization/Cookie headers',
    ));
  }
  return out;
}

function validateCallbackSettings(srv: ApiMockServerDefinitionV1, basePath: string): D[] {
  const out: D[] = [];
  const cbSettings = srv.settings.callbacks ?? DEFAULT_CALLBACK_SETTINGS;
  for (let i = 0; i < cbSettings.allowlist.length; i++) {
    const entry = cbSettings.allowlist[i];
    try {
      const u = new URL(entry);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        out.push(d('AMS-CALLBACK-ALLOWLIST-INVALID', 'error', `${basePath}/settings/callbacks/allowlist/${i}`, `Callback allowlist must be http(s): "${entry}"`));
      }
    } catch {
      out.push(d('AMS-CALLBACK-ALLOWLIST-INVALID', 'error', `${basePath}/settings/callbacks/allowlist/${i}`, `Invalid callback URL: "${entry}"`));
    }
  }

  for (let ri = 0; ri < srv.routes.length; ri++) {
    const route = srv.routes[ri];
    for (let vi = 0; vi < route.responses.length; vi++) {
      const cbs = route.responses[vi].callbacks ?? [];
      for (let ci = 0; ci < cbs.length; ci++) {
        const cb = cbs[ci];
        if (!cb.enabled) continue;
        if (!cb.url) {
          out.push(d('AMS-CALLBACK-URL-MISSING', 'error', `${basePath}/routes/${ri}/responses/${vi}/callbacks/${ci}/url`, 'Enabled callback requires a URL'));
          continue;
        }
        if (!cbSettings.allowlist.includes(cb.url)) {
          out.push(d(
            'AMS-CALLBACK-NOT-ALLOWLISTED',
            'error',
            `${basePath}/routes/${ri}/responses/${vi}/callbacks/${ci}/url`,
            `Callback URL is not in the server callback allowlist: "${cb.url}"`,
            'Add the exact URL under Settings → Callbacks',
          ));
        }
        if (cb.maxRetries > CALLBACK_HARD_CEILINGS.maxRetries) {
          out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/routes/${ri}/responses/${vi}/callbacks/${ci}/maxRetries`, `${cb.maxRetries} exceeds ${CALLBACK_HARD_CEILINGS.maxRetries}`));
        }
        if (cb.timeoutMs > CALLBACK_HARD_CEILINGS.timeoutMs) {
          out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/routes/${ri}/responses/${vi}/callbacks/${ci}/timeoutMs`, `${cb.timeoutMs} exceeds ${CALLBACK_HARD_CEILINGS.timeoutMs}ms`));
        }
        if (new TextEncoder().encode(cb.bodyTemplate ?? '').length > CALLBACK_HARD_CEILINGS.maxBodyBytes) {
          out.push(d('AMS-LIMIT-EXCEEDED', 'error', `${basePath}/routes/${ri}/responses/${vi}/callbacks/${ci}/bodyTemplate`, 'Callback body exceeds hard ceiling'));
        }
      }
    }
  }
  return out;
}

function validateVariantOutbound(v: ApiMockResponseVariantV1, basePath: string): D[] {
  const out: D[] = [];
  if (v.transforms?.length) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/transforms`, `${v.transforms.length} response transform(s) active at runtime.`));
  }
  if (v.callbacks?.some(c => c.enabled)) {
    out.push(d('AMS-CAPABILITY-INFO', 'info', `${basePath}/callbacks`, 'Outbound callbacks fire after delivery (failure-isolated).'));
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
