/**
 * Phase 11L — visual mock rule builder model ↔ GrpcMockRuleSet sync.
 */
import type {
  GrpcMockPredicate,
  GrpcMockRule,
  GrpcMockRuleSet,
} from '@shared/grpc/grpcMockRuleContracts';
import {
  validateGrpcMockRuleSet,
  type GrpcMockRuleValidationIssue,
} from '@shared/grpc/grpcMockRuleContracts';
import { GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS } from '@shared/grpc/grpcMockPredicateSandbox';
import { summarizeMockRulePredicate } from './grpcStudioAdvancedModel';

export const GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH = 2;

export type GrpcMockBuilderPredicateLeafKind =
  | 'method_equals'
  | 'service_equals'
  | 'metadata_equals'
  | 'metadata_exists'
  | 'body_path_equals'
  | 'body_path_exists';

export interface GrpcMockBuilderPredicateLeaf {
  nodeId: string;
  type: 'leaf';
  kind: GrpcMockBuilderPredicateLeafKind;
  negated: boolean;
  method?: string;
  service?: string;
  key?: string;
  value?: string;
  path?: string;
}

export interface GrpcMockBuilderPredicateGroup {
  nodeId: string;
  type: 'group';
  combinator: 'and' | 'or';
  children: GrpcMockBuilderPredicateNode[];
}

export interface GrpcMockBuilderExpressionReadOnly {
  nodeId: string;
  type: 'expression';
  expression: string;
  negated?: boolean;
}

export type GrpcMockBuilderPredicateNode =
  | GrpcMockBuilderPredicateLeaf
  | GrpcMockBuilderPredicateGroup
  | GrpcMockBuilderExpressionReadOnly;

export interface GrpcMockBuilderRuleRow {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  fallthrough: boolean;
  predicate: GrpcMockBuilderPredicateNode;
  predicateReadOnly: boolean;
  originalPredicate?: GrpcMockPredicate;
  responseStatusCode?: number;
  responseBodyText: string;
  responseMessage?: string;
  responseLatencyMs?: number;
  collapsed?: boolean;
}

export interface GrpcMockBuilderModel {
  rules: GrpcMockBuilderRuleRow[];
  defaultResponse?: GrpcMockRuleSet['defaultResponse'];
}

export interface GrpcMockBuilderModelIssue {
  path: string;
  message: string;
}

let builderNodeCounter = 0;

export function resetGrpcMockBuilderNodeIdsForTests(): void {
  builderNodeCounter = 0;
}

export function createGrpcMockBuilderNodeId(prefix = 'node'): string {
  builderNodeCounter += 1;
  return `${prefix}-${builderNodeCounter}`;
}

/** Stable predicate node id for parse round-trips (avoids remounting editors on each keystroke). */
export function buildGrpcMockBuilderPredicateNodeId(ruleId: string, path: string): string {
  return `pred:${ruleId}:${path}`;
}

export function createDefaultGrpcMockBuilderPredicateLeaf(): GrpcMockBuilderPredicateLeaf {
  return {
    nodeId: createGrpcMockBuilderNodeId('leaf'),
    type: 'leaf',
    kind: 'method_equals',
    negated: false,
    method: 'Echo',
  };
}

export function createDefaultGrpcMockBuilderRuleRow(priority = 1): GrpcMockBuilderRuleRow {
  const id = createGrpcMockBuilderNodeId('rule');
  return {
    id,
    name: 'New rule',
    enabled: true,
    priority,
    fallthrough: false,
    predicate: createDefaultGrpcMockBuilderPredicateLeaf(),
    predicateReadOnly: false,
    responseStatusCode: 0,
    responseBodyText: '{}',
  };
}

/** Summarize a builder predicate node as a human-readable string (for collapsed rule summary). */
export function summarizeBuilderPredicateNode(node: GrpcMockBuilderPredicateNode): string {
  const not = (node.type === 'leaf' && node.negated) || (node.type === 'expression' && node.negated);
  const prefix = not ? 'NOT ' : '';
  switch (node.type) {
    case 'leaf': {
      switch (node.kind) {
        case 'method_equals': return `${prefix}method == "${node.method ?? ''}"`;
        case 'service_equals': return `${prefix}service == "${node.service ?? ''}"`;
        case 'metadata_equals': return `${prefix}metadata.${node.key ?? '?'} == "${node.value ?? ''}"`;
        case 'metadata_exists': return `${prefix}metadata.${node.key ?? '?'} exists`;
        case 'body_path_equals': return `${prefix}body.${node.path ?? '?'} == ${JSON.stringify(node.value ?? '')}`;
        case 'body_path_exists': return `${prefix}body.${node.path ?? '?'} exists`;
        default: return 'unknown';
      }
    }
    case 'group': {
      const sep = node.combinator === 'and' ? ' AND ' : ' OR ';
      const inner = node.children.map((c) => summarizeBuilderPredicateNode(c)).join(sep);
      return `(${inner})`;
    }
    case 'expression':
      return `${prefix}${node.expression}`;
    default:
      return 'unknown';
  }
}

/** Build a compact one-line summary for a collapsed rule card. */
export function summarizeBuilderRule(rule: GrpcMockBuilderRuleRow): string {
  const predPart = rule.predicateReadOnly && rule.originalPredicate
    ? summarizeMockRulePredicate({
      id: rule.id, name: rule.name, enabled: rule.enabled, priority: rule.priority,
      predicate: rule.originalPredicate, response: {},
    })
    : summarizeBuilderPredicateNode(rule.predicate);
  const statusCode = rule.responseStatusCode ?? 0;
  const bodyPreview = rule.responseBodyText.trim().slice(0, 40);
  const bodySuffix = rule.responseBodyText.trim().length > 40 ? '…' : '';
  return `${predPart} → ${statusCode} ${bodyPreview}${bodySuffix}`;
}

/** Extract the primary method value from a predicate for conflict detection. */
function extractLeafMethodValue(node: GrpcMockBuilderPredicateNode): string | undefined {
  if (node.type === 'leaf' && node.kind === 'method_equals' && !node.negated) {
    return node.method?.trim().toLowerCase();
  }
  if (node.type === 'group') {
    for (const child of node.children) {
      const val = extractLeafMethodValue(child);
      if (val) return val;
    }
  }
  return undefined;
}

export interface GrpcMockBuilderConflict {
  ruleAId: string;
  ruleAName: string;
  ruleBId: string;
  ruleBName: string;
  reason: string;
}

/** Detect enabled rules at the same priority that match the same method (potential conflicts). */
export function detectGrpcMockBuilderConflicts(model: GrpcMockBuilderModel): GrpcMockBuilderConflict[] {
  const conflicts: GrpcMockBuilderConflict[] = [];
  const enabledRules = model.rules.filter((r) => r.enabled);

  // Group by priority
  const byPriority = new Map<number, GrpcMockBuilderRuleRow[]>();
  for (const rule of enabledRules) {
    const list = byPriority.get(rule.priority) ?? [];
    list.push(rule);
    byPriority.set(rule.priority, list);
  }

  for (const [priority, group] of byPriority) {
    if (group.length < 2) continue;

    // Check for method overlap within same priority
    const methodMap = new Map<string, GrpcMockBuilderRuleRow>();
    for (const rule of group) {
      const method = extractLeafMethodValue(rule.predicate);
      if (method) {
        const existing = methodMap.get(method);
        if (existing) {
          conflicts.push({
            ruleAId: existing.id,
            ruleAName: existing.name,
            ruleBId: rule.id,
            ruleBName: rule.name,
            reason: `Both match method "${method}" at priority ${priority}`,
          });
        } else {
          methodMap.set(method, rule);
        }
      }
    }
  }

  return conflicts;
}

function stripQuotedLiteralsForSecurityScan(value: string): string {
  return value
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

export function scanGrpcMockBuilderValueForForbiddenTokens(value: string): string | undefined {
  const scanTarget = stripQuotedLiteralsForSecurityScan(value);
  for (const pattern of GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS) {
    if (pattern.test(scanTarget)) {
      return `Forbidden pattern: ${pattern}`;
    }
  }
  return undefined;
}

function isStructuredLeafKind(kind: string): kind is GrpcMockBuilderPredicateLeafKind {
  return kind === 'method_equals'
    || kind === 'service_equals'
    || kind === 'metadata_equals'
    || kind === 'metadata_exists'
    || kind === 'body_path_equals'
    || kind === 'body_path_exists';
}

function leafFromStructuredPredicate(
  predicate: GrpcMockPredicate,
  negated: boolean,
  nodeId: string,
): GrpcMockBuilderPredicateLeaf | undefined {
  if (!isStructuredLeafKind(predicate.kind)) {
    return undefined;
  }
  const base: GrpcMockBuilderPredicateLeaf = {
    nodeId,
    type: 'leaf',
    kind: predicate.kind,
    negated,
  };
  switch (predicate.kind) {
    case 'method_equals':
      return { ...base, method: predicate.method };
    case 'service_equals':
      return { ...base, service: predicate.service };
    case 'metadata_equals':
      return { ...base, key: predicate.key, value: predicate.value };
    case 'metadata_exists':
      return { ...base, key: predicate.key };
    case 'body_path_equals':
      return { ...base, path: predicate.path, value: predicate.value };
    case 'body_path_exists':
      return { ...base, path: predicate.path };
    default:
      return undefined;
  }
}

function expressionReadOnlyFromPredicate(
  predicate: GrpcMockPredicate,
  rule: GrpcMockRule,
  nodeId: string,
  negated = false,
): GrpcMockBuilderExpressionReadOnly {
  return {
    nodeId,
    type: 'expression',
    expression: predicate.kind === 'expression'
      ? predicate.expression
      : summarizeMockRulePredicate({ ...rule, predicate }),
    negated: negated || undefined,
  };
}

function parsePredicateNode(
  predicate: GrpcMockPredicate,
  rule: GrpcMockRule,
  depth: number,
  path: string,
): { node: GrpcMockBuilderPredicateNode; readOnly: boolean } {
  const nodeId = buildGrpcMockBuilderPredicateNodeId(rule.id, path);
  if (predicate.kind === 'expression') {
    return {
      node: expressionReadOnlyFromPredicate(predicate, rule, nodeId),
      readOnly: true,
    };
  }

  if (predicate.kind === 'not') {
    const inner = predicate.predicate;
    if (inner.kind === 'expression') {
      return {
        node: expressionReadOnlyFromPredicate(inner, rule, nodeId, true),
        readOnly: true,
      };
    }
    const leaf = leafFromStructuredPredicate(inner, true, nodeId);
    if (leaf) {
      return { node: leaf, readOnly: false };
    }
    return {
      node: expressionReadOnlyFromPredicate(predicate, rule, nodeId),
      readOnly: true,
    };
  }

  if (predicate.kind === 'and' || predicate.kind === 'or') {
    if (depth > GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH) {
      return {
        node: expressionReadOnlyFromPredicate(predicate, rule, nodeId),
        readOnly: true,
      };
    }
    const children: GrpcMockBuilderPredicateNode[] = [];
    let childReadOnly = false;
    for (const [index, child] of predicate.predicates.entries()) {
      const parsedChild = parsePredicateNode(child, rule, depth + 1, `${path}.${index}`);
      children.push(parsedChild.node);
      childReadOnly = childReadOnly || parsedChild.readOnly;
    }
    return {
      node: {
        nodeId,
        type: 'group',
        combinator: predicate.kind,
        children,
      },
      readOnly: childReadOnly,
    };
  }

  const leaf = leafFromStructuredPredicate(predicate, false, nodeId);
  if (!leaf) {
    return {
      node: expressionReadOnlyFromPredicate(predicate, rule, nodeId),
      readOnly: true,
    };
  }
  return { node: leaf, readOnly: false };
}

export function measureGrpcMockBuilderPredicateDepth(node: GrpcMockBuilderPredicateNode): number {
  // Count group nesting only — leaves/expressions do not add depth (plan: max 2 group levels).
  if (node.type === 'leaf' || node.type === 'expression') {
    return 0;
  }
  if (node.children.length === 0) {
    return 1;
  }
  const childDepth = Math.max(0, ...node.children.map((child) => measureGrpcMockBuilderPredicateDepth(child)));
  return 1 + childDepth;
}

function serializeLeafPredicate(leaf: GrpcMockBuilderPredicateLeaf): GrpcMockPredicate {
  let base: GrpcMockPredicate;
  switch (leaf.kind) {
    case 'method_equals':
      base = { kind: 'method_equals', method: leaf.method?.trim() ?? '' };
      break;
    case 'service_equals':
      base = { kind: 'service_equals', service: leaf.service?.trim() ?? '' };
      break;
    case 'metadata_equals':
      base = {
        kind: 'metadata_equals',
        key: leaf.key?.trim() ?? '',
        value: leaf.value ?? '',
      };
      break;
    case 'metadata_exists':
      base = { kind: 'metadata_exists', key: leaf.key?.trim() ?? '' };
      break;
    case 'body_path_equals':
      base = {
        kind: 'body_path_equals',
        path: leaf.path?.trim() ?? '',
        value: leaf.value ?? '',
      };
      break;
    case 'body_path_exists':
      base = { kind: 'body_path_exists', path: leaf.path?.trim() ?? '' };
      break;
    default: {
      const _exhaustive: never = leaf.kind;
      throw new Error(`Unsupported leaf kind: ${String(_exhaustive)}`);
    }
  }
  if (leaf.negated) {
    return { kind: 'not', predicate: base };
  }
  return base;
}

function serializePredicateNode(node: GrpcMockBuilderPredicateNode): GrpcMockPredicate {
  if (node.type === 'expression') {
    throw new Error('Cannot serialize read-only expression node from builder.');
  }
  if (node.type === 'leaf') {
    return serializeLeafPredicate(node);
  }
  return {
    kind: node.combinator,
    predicates: node.children.map((child) => serializePredicateNode(child)),
  };
}

function parseResponseBodyText(bodyText: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid response body JSON',
    };
  }
}

export function parseGrpcMockRuleSetToBuilderModel(ruleSet: GrpcMockRuleSet): GrpcMockBuilderModel {
  const rules = ruleSet.rules.flatMap((rule) => {
    if (rule == null || typeof rule !== 'object') {
      return [];
    }
    const record = rule as Partial<GrpcMockRule>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string') {
      return [];
    }
    const predicate = record.predicate ?? { kind: 'method_equals', method: '' };
    const response = record.response ?? {};
    const rootPath = 'root';
    const ruleForPredicate: GrpcMockRule = {
      id: record.id,
      name: record.name,
      enabled: Boolean(record.enabled),
      priority: typeof record.priority === 'number' ? record.priority : 1,
      predicate: predicate as GrpcMockPredicate,
      response,
    };
    const parsedPredicate = parsePredicateNode(predicate as GrpcMockPredicate, ruleForPredicate, 1, rootPath);
    let predicateNode = parsedPredicate.node;
    let predicateReadOnly = parsedPredicate.readOnly;
    if (
      !predicateReadOnly
      && measureGrpcMockBuilderPredicateDepth(predicateNode) > GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH
    ) {
      predicateReadOnly = true;
      predicateNode = expressionReadOnlyFromPredicate(
        predicate as GrpcMockPredicate,
        ruleForPredicate,
        buildGrpcMockBuilderPredicateNodeId(record.id, rootPath),
      );
    }
    const responseBody = response.body;
    return [{
      id: record.id,
      name: record.name,
      enabled: Boolean(record.enabled),
      priority: typeof record.priority === 'number' ? record.priority : 1,
      fallthrough: Boolean(record.fallthrough),
      predicate: predicateNode,
      predicateReadOnly,
      originalPredicate: predicateReadOnly ? structuredClone(predicate as GrpcMockPredicate) : undefined,
      responseStatusCode: response.statusCode,
      responseBodyText: responseBody == null ? '' : JSON.stringify(responseBody, null, 2),
      responseMessage: response.message,
      responseLatencyMs: response.latencyMs,
    } satisfies GrpcMockBuilderRuleRow];
  });
  return {
    rules,
    defaultResponse: ruleSet.defaultResponse ? structuredClone(ruleSet.defaultResponse) : undefined,
  };
}

export function serializeGrpcMockBuilderModelToRuleSet(model: GrpcMockBuilderModel): GrpcMockRuleSet {
  const rules: GrpcMockRule[] = model.rules.map((row) => {
    let predicate: GrpcMockPredicate;
    if (row.predicateReadOnly) {
      if (!row.originalPredicate) {
        throw new Error(`Rule ${row.id} is read-only but missing originalPredicate.`);
      }
      predicate = structuredClone(row.originalPredicate);
    } else {
      predicate = serializePredicateNode(row.predicate);
    }
    const bodyParsed = parseResponseBodyText(row.responseBodyText);
    const response: GrpcMockRule['response'] = {};
    if (row.responseStatusCode != null) {
      response.statusCode = row.responseStatusCode;
    }
    if (bodyParsed.ok && bodyParsed.value !== undefined) {
      response.body = bodyParsed.value;
    }
    if (row.responseMessage?.trim()) {
      response.message = row.responseMessage.trim();
    }
    if (row.responseLatencyMs != null && row.responseLatencyMs > 0) {
      response.latencyMs = row.responseLatencyMs;
    }
    return {
      id: row.id.trim(),
      name: row.name.trim(),
      enabled: row.enabled,
      priority: row.priority,
      fallthrough: row.fallthrough || undefined,
      predicate,
      response,
    };
  });
  return {
    rules,
    defaultResponse: model.defaultResponse ? structuredClone(model.defaultResponse) : undefined,
  };
}

export function sortGrpcMockRulesForStableExport(rules: GrpcMockRule[]): GrpcMockRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.id.localeCompare(b.id);
  });
}

export function serializeGrpcMockRuleSetToStableJson(ruleSet: GrpcMockRuleSet): string {
  const normalized: GrpcMockRuleSet = {
    rules: sortGrpcMockRulesForStableExport(ruleSet.rules),
    defaultResponse: ruleSet.defaultResponse,
  };
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function serializeGrpcMockBuilderModelToStableJson(model: GrpcMockBuilderModel): string {
  return serializeGrpcMockRuleSetToStableJson(serializeGrpcMockBuilderModelToRuleSet(model));
}

function validatePredicateNode(
  node: GrpcMockBuilderPredicateNode,
  path: string,
  issues: GrpcMockBuilderModelIssue[],
): void {
  if (node.type === 'expression') {
    return;
  }
  if (node.type === 'group') {
    const depth = measureGrpcMockBuilderPredicateDepth(node);
    if (depth > GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH) {
      issues.push({
        path,
        message: `Predicate nesting exceeds max depth of ${GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH}.`,
      });
    }
    if (node.children.length === 0) {
      issues.push({ path, message: 'Predicate group must include at least one child.' });
    }
    node.children.forEach((child, index) => {
      validatePredicateNode(child, `${path}.children[${index}]`, issues);
    });
    return;
  }

  const scanFields = [node.method, node.service, node.key, node.value, node.path]
    .filter((value): value is string => typeof value === 'string');
  for (const [index, value] of scanFields.entries()) {
    const forbidden = scanGrpcMockBuilderValueForForbiddenTokens(value);
    if (forbidden) {
      issues.push({ path: `${path}.field[${index}]`, message: forbidden });
    }
  }

  switch (node.kind) {
    case 'method_equals':
      if (!node.method?.trim()) {
        issues.push({ path: `${path}.method`, message: 'Method is required.' });
      }
      break;
    case 'service_equals':
      if (!node.service?.trim()) {
        issues.push({ path: `${path}.service`, message: 'Service is required.' });
      }
      break;
    case 'metadata_equals':
      if (!node.key?.trim()) {
        issues.push({ path: `${path}.key`, message: 'Metadata key is required.' });
      }
      break;
    case 'metadata_exists':
      if (!node.key?.trim()) {
        issues.push({ path: `${path}.key`, message: 'Metadata key is required.' });
      }
      break;
    case 'body_path_equals':
      if (!node.path?.trim()) {
        issues.push({ path: `${path}.path`, message: 'Body path is required.' });
      }
      break;
    case 'body_path_exists':
      if (!node.path?.trim()) {
        issues.push({ path: `${path}.path`, message: 'Body path is required.' });
      }
      break;
    default:
      break;
  }
}

export function validateGrpcMockBuilderModel(model: GrpcMockBuilderModel): GrpcMockBuilderModelIssue[] {
  const issues: GrpcMockBuilderModelIssue[] = [];
  const seenIds = new Set<string>();

  model.rules.forEach((row, index) => {
    const path = `rules[${index}]`;
    if (!row.id.trim()) {
      issues.push({ path: `${path}.id`, message: 'Rule id is required.' });
    } else if (seenIds.has(row.id)) {
      issues.push({ path: `${path}.id`, message: `Duplicate rule id: ${row.id}` });
    } else {
      seenIds.add(row.id);
    }
    if (!row.name.trim()) {
      issues.push({ path: `${path}.name`, message: 'Rule name is required.' });
    }
    if (!Number.isInteger(row.priority)) {
      issues.push({ path: `${path}.priority`, message: 'Priority must be an integer.' });
    }
    if (!row.predicateReadOnly) {
      validatePredicateNode(row.predicate, `${path}.predicate`, issues);
    }
    const forbiddenName = scanGrpcMockBuilderValueForForbiddenTokens(row.name);
    if (forbiddenName) {
      issues.push({ path: `${path}.name`, message: forbiddenName });
    }
    const bodyParsed = parseResponseBodyText(row.responseBodyText);
    if (!bodyParsed.ok) {
      issues.push({ path: `${path}.responseBodyText`, message: bodyParsed.error });
    }
  });

  const ruleSetIssues = (() => {
    try {
      return validateGrpcMockRuleSet(serializeGrpcMockBuilderModelToRuleSet(model));
    } catch (error) {
      return [{
        path: 'rules',
        message: error instanceof Error ? error.message : 'Invalid mock rule set.',
      }];
    }
  })();
  for (const issue of ruleSetIssues) {
    issues.push({ path: issue.path, message: issue.message });
  }

  return issues;
}

export function builderIssuesToValidationIssues(
  issues: GrpcMockBuilderModelIssue[],
): GrpcMockRuleValidationIssue[] {
  return issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

export function formatGrpcMockBuilderIssues(issues: GrpcMockBuilderModelIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
}
