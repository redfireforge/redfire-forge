/**
 * API Mock Studio — conservative static conflict analyzer (Phase 1E).
 * Pure analysis: no side effects, no runtime state.
 */
import type {
  ApiMockRouteV1,
  ApiMockConflictFindingV1,
  ApiMockCapturedRequestV1,
  ApiMockDiagnosticSeverity,
  ApiMockPredicateV1,
  ApiMockPredicateGroupV1,
} from './contracts';
import { computeRouteFingerprint } from './fingerprint';
import { matchPath } from './pathMatcher';

export interface ConflictAnalysisResult {
  findings: ApiMockConflictFindingV1[];
}

export async function analyzeConflicts(routes: ApiMockRouteV1[], serverId: string): Promise<ConflictAnalysisResult> {
  const enabled = routes.filter(r => r.enabled);
  const findings: ApiMockConflictFindingV1[] = [];
  const fingerprints = new Map<string, string>();

  for (const r of enabled) {
    fingerprints.set(r.id, await computeRouteFingerprint(r));
  }

  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i], b = enabled[j];
      const finding = analyzeRoutePair(a, b, serverId, fingerprints);
      if (finding) findings.push(finding);
    }
  }
  return { findings };
}

function analyzeRoutePair(
  a: ApiMockRouteV1, b: ApiMockRouteV1, serverId: string, fingerprints: Map<string, string>,
): ApiMockConflictFindingV1 | null {
  if (isDuplicate(a, b)) {
    return makeFinding(a, b, serverId, 'duplicate', 'error', fingerprints, [
      { source: 'method', result: 'overlap', explanation: `Both use ${a.method}` },
      { source: 'path', result: 'overlap', explanation: `Both match ${a.path.value}` },
    ]);
  }

  const dims = analyzeDimensions(a, b);
  if (dims.some(d => d.result === 'disjoint')) return null;

  const hasUnknown = dims.some(d => d.result === 'unknown');
  const kind = hasUnknown ? 'potential_overlap' as const : 'definite_overlap' as const;

  // Higher-priority broader rule shadows the narrower / lower-priority peer.
  if (a.priority > b.priority && isSuperset(a.predicates, b.predicates)) {
    return makeFinding(a, b, serverId, 'shadowed', 'warning', fingerprints, dims);
  }
  if (b.priority > a.priority && isSuperset(b.predicates, a.predicates)) {
    return makeFinding(b, a, serverId, 'shadowed', 'warning', fingerprints, dims);
  }

  const severity: ApiMockDiagnosticSeverity = kind === 'definite_overlap' ? 'warning' : 'info';
  return makeFinding(a, b, serverId, kind, severity, fingerprints, dims);
}

function isDuplicate(a: ApiMockRouteV1, b: ApiMockRouteV1): boolean {
  if (a.method !== b.method) return false;
  if (a.path.kind !== b.path.kind || a.path.value !== b.path.value) return false;
  // Different priorities mean one rule wins deterministically — classify as shadowed,
  // not duplicate (duplicate implies guaranteed 409 Ambiguous on every request).
  if (a.priority !== b.priority) return false;
  return predicateTreesEqual(a.predicates, b.predicates);
}

function predicateTreesEqual(a: ApiMockPredicateGroupV1, b: ApiMockPredicateGroupV1): boolean {
  if (a.combinator !== b.combinator) return false;
  if (a.children.length !== b.children.length) return false;
  for (let i = 0; i < a.children.length; i++) {
    const ac = a.children[i], bc = b.children[i];
    if ('combinator' in ac && 'combinator' in bc) {
      if (!predicateTreesEqual(ac, bc)) return false;
    } else if (!('combinator' in ac) && !('combinator' in bc)) {
      if (!predicatesEqual(ac, bc)) return false;
    } else {
      return false;
    }
  }
  return true;
}

function predicatesEqual(a: ApiMockPredicateV1, b: ApiMockPredicateV1): boolean {
  return a.source === b.source && a.selector === b.selector && a.operator === b.operator
    && JSON.stringify(a.expected) === JSON.stringify(b.expected)
    && JSON.stringify(a.options) === JSON.stringify(b.options);
}

type DimResult = ApiMockConflictFindingV1['dimensions'][0];

function analyzeDimensions(a: ApiMockRouteV1, b: ApiMockRouteV1): DimResult[] {
  const dims: DimResult[] = [];
  dims.push(analyzeMethodDimension(a, b));
  dims.push(analyzePathDimension(a, b));

  const aPreds = flattenPredicates(a.predicates);
  const bPreds = flattenPredicates(b.predicates);

  const seenSources = new Set<string>();
  for (const ap of aPreds) {
    const key = `${ap.source}:${ap.selector ?? ''}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    const bp = bPreds.find(p => p.source === ap.source && p.selector === ap.selector);
    if (bp) {
      dims.push(analyzePredicatePairDimension(ap, bp));
    } else {
      dims.push({
        source: ap.source,
        selector: ap.selector,
        result: 'unknown',
        explanation: `Left has ${ap.operator}${ap.selector ? ` on ${ap.selector}` : ''}${ap.expected != null ? ` ${String(ap.expected)}` : ''}; right has none`,
      });
    }
  }
  for (const bp of bPreds) {
    const key = `${bp.source}:${bp.selector ?? ''}`;
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    dims.push({
      source: bp.source,
      selector: bp.selector,
      result: 'unknown',
      explanation: `Right has ${bp.operator}${bp.selector ? ` on ${bp.selector}` : ''}${bp.expected != null ? ` ${String(bp.expected)}` : ''}; left has none`,
    });
  }
  return dims;
}

function analyzeMethodDimension(a: ApiMockRouteV1, b: ApiMockRouteV1): DimResult {
  if (a.method === 'ANY' || b.method === 'ANY' || a.method === b.method) {
    return { source: 'method', result: 'overlap', explanation: `Both match ${a.method === b.method ? a.method : 'overlapping methods'}` };
  }
  return { source: 'method', result: 'disjoint', explanation: `${a.method} vs ${b.method}` };
}

function analyzePathDimension(a: ApiMockRouteV1, b: ApiMockRouteV1): DimResult {
  if (a.path.kind === 'exact' && b.path.kind === 'exact') {
    return a.path.value === b.path.value
      ? { source: 'path', result: 'overlap', explanation: `Both match ${a.path.value}` }
      : { source: 'path', result: 'disjoint', explanation: `${a.path.value} vs ${b.path.value}` };
  }
  // Run the literal through the real matcher: asserting overlap without testing
  // reported `/users/:id` as conflicting with `/health`.
  if ((a.path.kind === 'parameterized' && b.path.kind === 'exact') || (a.path.kind === 'exact' && b.path.kind === 'parameterized')) {
    const pattern = a.path.kind === 'parameterized' ? a.path : b.path;
    const literal = a.path.kind === 'exact' ? a.path : b.path;
    return matchPath(pattern, literal.value).matched
      ? { source: 'path', result: 'overlap', explanation: `${pattern.value} captures ${literal.value}` }
      : { source: 'path', result: 'disjoint', explanation: `${pattern.value} does not capture ${literal.value}` };
  }
  if ((a.path.kind === 'glob' && b.path.kind === 'exact') || (a.path.kind === 'exact' && b.path.kind === 'glob')) {
    const pattern = a.path.kind === 'glob' ? a.path : b.path;
    const literal = a.path.kind === 'exact' ? a.path : b.path;
    return matchPath(pattern, literal.value).matched
      ? { source: 'path', result: 'overlap', explanation: `${pattern.value} matches ${literal.value}` }
      : { source: 'path', result: 'disjoint', explanation: `${pattern.value} does not match ${literal.value}` };
  }
  if (a.path.kind === 'regex' || b.path.kind === 'regex') {
    if (a.path.kind === 'exact' || b.path.kind === 'exact') {
      const exact = a.path.kind === 'exact' ? a : b;
      const regex = a.path.kind === 'regex' ? a : b;
      try {
        const matches = new RegExp(regex.path.value).test(exact.path.value);
        return matches
          ? { source: 'path', result: 'overlap', explanation: `Regex matches ${exact.path.value}` }
          : { source: 'path', result: 'disjoint', explanation: `Regex does not match ${exact.path.value}` };
      } catch {
        return { source: 'path', result: 'unknown', explanation: 'Invalid regex' };
      }
    }
    return { source: 'path', result: 'unknown', explanation: 'Regex intersection is undecidable' };
  }
  if (a.path.kind === 'parameterized' && b.path.kind === 'parameterized') {
    const aParts = a.path.value.split('/'), bParts = b.path.value.split('/');
    if (aParts.length !== bParts.length) return { source: 'path', result: 'disjoint', explanation: 'Different segment count' };
    for (let i = 0; i < aParts.length; i++) {
      const ap = aParts[i], bp = bParts[i];
      const aParam = ap.startsWith(':') || (ap.startsWith('{') && ap.endsWith('}'));
      const bParam = bp.startsWith(':') || (bp.startsWith('{') && bp.endsWith('}'));
      if (!aParam && !bParam && ap !== bp) return { source: 'path', result: 'disjoint', explanation: `Literal segments differ: ${ap} vs ${bp}` };
    }
    return { source: 'path', result: 'overlap', explanation: 'Compatible parameterized paths' };
  }
  return { source: 'path', result: 'unknown', explanation: 'Path intersection cannot be determined statically' };
}

function analyzePredicatePairDimension(a: ApiMockPredicateV1, b: ApiMockPredicateV1): DimResult {
  const src = a.source;
  const sel = a.selector;
  const label = sel ? `${src} "${sel}"` : src;

  if (a.operator === 'present' && b.operator === 'absent') return { source: src, selector: sel, result: 'disjoint', explanation: `${label}: present vs absent` };
  if (a.operator === 'absent' && b.operator === 'present') return { source: src, selector: sel, result: 'disjoint', explanation: `${label}: absent vs present` };
  if (a.operator === 'present' || b.operator === 'present') return { source: src, selector: sel, result: 'overlap', explanation: `${label}: present implies overlap` };
  if (a.operator === 'absent' && b.operator === 'absent') return { source: src, selector: sel, result: 'overlap', explanation: `${label}: both absent` };

  if (a.options?.negate && !b.options?.negate && a.operator === 'exact' && b.operator === 'exact' && JSON.stringify(a.expected) === JSON.stringify(b.expected)) {
    return { source: src, selector: sel, result: 'disjoint', explanation: `${label}: negated exact vs same exact` };
  }

  if (a.operator === 'exact' && b.operator === 'exact') {
    const eq = JSON.stringify(a.expected) === JSON.stringify(b.expected);
    return eq
      ? { source: src, selector: sel, result: 'overlap', explanation: `${label}: identical exact values` }
      : { source: src, selector: sel, result: 'disjoint', explanation: `${label}: different exact values` };
  }
  if ((a.operator === 'exact' && b.operator === 'contains') || (a.operator === 'contains' && b.operator === 'exact')) {
    const exact = a.operator === 'exact' ? String(a.expected) : String(b.expected);
    const sub = a.operator === 'contains' ? String(a.expected) : String(b.expected);
    return exact.includes(sub)
      ? { source: src, selector: sel, result: 'overlap', explanation: `${label}: exact contains substring` }
      : { source: src, selector: sel, result: 'disjoint', explanation: `${label}: exact does not contain substring` };
  }
  if (a.operator === 'regex' && b.operator === 'exact') {
    try { return new RegExp(String(a.expected)).test(String(b.expected))
      ? { source: src, selector: sel, result: 'overlap', explanation: `${label}: regex matches exact` }
      : { source: src, selector: sel, result: 'disjoint', explanation: `${label}: regex does not match exact` };
    } catch { return { source: src, selector: sel, result: 'unknown', explanation: `${label}: invalid regex` }; }
  }
  if (a.operator === 'exact' && b.operator === 'regex') {
    try { return new RegExp(String(b.expected)).test(String(a.expected))
      ? { source: src, selector: sel, result: 'overlap', explanation: `${label}: regex matches exact` }
      : { source: src, selector: sel, result: 'disjoint', explanation: `${label}: regex does not match exact` };
    } catch { return { source: src, selector: sel, result: 'unknown', explanation: `${label}: invalid regex` }; }
  }
  if (a.operator === 'regex' && b.operator === 'regex') {
    return { source: src, selector: sel, result: 'unknown', explanation: `${label}: regex intersection undecidable` };
  }
  if (involvesSchemasOrPaths(a.operator) || involvesSchemasOrPaths(b.operator)) {
    return { source: src, selector: sel, result: 'unknown', explanation: `${label}: schema/path intersection undecidable` };
  }
  return { source: src, selector: sel, result: 'unknown', explanation: `${label}: cannot determine overlap` };
}

function involvesSchemasOrPaths(op: string): boolean {
  return ['jsonPath_exists', 'jsonPath_equals', 'jsonSchema', 'xpath_exists', 'xpath_equals', 'xmlSchema'].includes(op);
}

function isSuperset(a: ApiMockPredicateGroupV1, b: ApiMockPredicateGroupV1): boolean {
  if (a.children.length === 0) return true;
  const aFlat = flattenPredicates(a);
  const bFlat = flattenPredicates(b);
  return bFlat.every(bp => aFlat.some(ap => predicatesEqual(ap, bp)));
}

function flattenPredicates(group: ApiMockPredicateGroupV1): ApiMockPredicateV1[] {
  const out: ApiMockPredicateV1[] = [];
  for (const child of group.children) {
    if ('combinator' in child) out.push(...flattenPredicates(child));
    else out.push(child);
  }
  return out;
}

function makeFinding(
  a: ApiMockRouteV1, b: ApiMockRouteV1, serverId: string,
  kind: ApiMockConflictFindingV1['kind'], severity: ApiMockDiagnosticSeverity,
  fingerprints: Map<string, string>, dimensions: DimResult[],
): ApiMockConflictFindingV1 {
  return {
    id: `conflict-${a.id}-${b.id}`,
    serverId,
    ruleIds: [a.id, b.id],
    kind, severity, dimensions,
    selectionOutcome: resolveSelectionOutcome(a, b),
    witnessRequest: buildWitnessRequest(a, b),
    ruleFingerprints: [fingerprints.get(a.id) ?? '', fingerprints.get(b.id) ?? ''],
  };
}

function resolveSelectionOutcome(
  a: ApiMockRouteV1,
  b: ApiMockRouteV1,
): ApiMockConflictFindingV1['selectionOutcome'] {
  if (a.priority > b.priority) return 'left_wins';
  if (b.priority > a.priority) return 'right_wins';
  return 'reject_ambiguous';
}

/** Concrete request that should hit both rules (literal path preferred). */
function buildWitnessRequest(a: ApiMockRouteV1, b: ApiMockRouteV1): ApiMockCapturedRequestV1 {
  const method = a.method !== 'ANY' ? a.method : b.method !== 'ANY' ? b.method : 'GET';
  const path = pickWitnessPath(a, b);
  const headers: Record<string, string[]> = {};
  const aPreds = flattenPredicates(a.predicates);
  const bPreds = flattenPredicates(b.predicates);
  for (const p of [...aPreds, ...bPreds]) {
    if (p.source === 'header' && p.selector && (p.operator === 'exact' || p.operator === 'contains')) {
      headers[p.selector] = [String(p.expected ?? 'value')];
    }
  }
  return {
    method,
    path,
    rawPath: path,
    query: {},
    cookies: {},
    headers,
    body: null,
    bodyTruncated: false,
    receivedAt: new Date().toISOString(),
  };
}

function pickWitnessPath(a: ApiMockRouteV1, b: ApiMockRouteV1): string {
  if (a.path.kind === 'exact') return a.path.value || '/';
  if (b.path.kind === 'exact') return b.path.value || '/';
  // Prefer a concrete sample for parameterized/glob: fill :param / {param}.
  const pattern = a.path.value || b.path.value || '/';
  return pattern.replace(/:[^/]+/g, '42').replace(/\{[^}]+\}/g, '42') || '/';
}
