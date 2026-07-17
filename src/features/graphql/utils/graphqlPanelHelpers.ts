/**
 * Shared validation helpers for GraphQL workflow node config panels.
 * Extracted to satisfy react-refresh/only-export-components lint rule and
 * to centralise tab-level validation (task 4C-8).
 */

import type {
  GraphqlQueryNodeData,
  GraphqlSubscriptionNodeData,
  GraphqlIntrospectNodeData,
  GraphqlAssertNodeData,
  GraphqlExtractionRule,
} from '../../workflow/types/workflow';

export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/** Replace `{{varName}}` placeholders with JSON `null` for syntax-only validation. */
export function normalizeVariablesJsonForValidation(str: string): string {
  return str.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g, 'null');
}

export function isValidJson(str: string): boolean {
  try { JSON.parse(str); return true; } catch { return false; }
}

/**
 * True when variables JSON is syntactically valid as a template — allows bare
 * `{{var}}` values (resolved before JSON.parse at runtime) as well as quoted
 * `"{{var}}"` strings.
 */
export function isValidVariablesJsonTemplate(str: string): boolean {
  try {
    JSON.parse(normalizeVariablesJsonForValidation(str));
    return true;
  } catch {
    return false;
  }
}

/** True when variables JSON is non-empty, not `{}`, and fails template validation. */
export function hasInvalidVariablesJson(variables: string | undefined): boolean {
  const varStr = (variables ?? '').trim();
  return varStr !== '' && varStr !== '{}' && !isValidVariablesJsonTemplate(varStr);
}

export function hasInvalidExtractionRules(rules: GraphqlExtractionRule[] | undefined): boolean {
  return (rules ?? []).some(
    (r) => r.variableName.trim() !== '' && !isValidIdentifier(r.variableName),
  );
}

export function hasInvalidOutputBindings(
  bindings: Array<{ variableName: string }> | undefined,
): boolean {
  return (bindings ?? []).some(
    (b) => b.variableName.trim() !== '' && !isValidIdentifier(b.variableName),
  );
}

// ── Query / Mutation panel ─────────────────────────────────────────────────────

export interface QueryTabErrors {
  operation: boolean;
  variables: boolean;
  extraction: boolean;
  output: boolean;
}

export function computeQueryTabErrors(
  data: Pick<GraphqlQueryNodeData, 'endpoint' | 'query' | 'variables' | 'extractionRules' | 'outputBindings'>,
): QueryTabErrors {
  return {
    operation: !data.endpoint?.trim() || !data.query?.trim(),
    variables: hasInvalidVariablesJson(data.variables),
    extraction: hasInvalidExtractionRules(data.extractionRules),
    output: hasInvalidOutputBindings(data.outputBindings),
  };
}

/** Count configured fields on the Operation tab (endpoint, query, non-default timeout, TLS skip). */
export function countOperationTabConfigured(
  data: Pick<GraphqlQueryNodeData, 'endpoint' | 'query' | 'timeoutMs' | 'skipTlsVerify'>,
): number {
  let count = 0;
  if (data.endpoint?.trim()) count++;
  if (data.query?.trim()) count++;
  if (data.timeoutMs != null && data.timeoutMs !== 30000) count++;
  if (data.skipTlsVerify) count++;
  return count;
}

/** Count variable keys in the Variables tab JSON (ignores empty `{}`). */
export function countVariablesTabConfigured(variables: string | undefined): number {
  const trimmed = (variables ?? '').trim();
  if (!trimmed || trimmed === '{}') return 0;
  try {
    const parsed = JSON.parse(normalizeVariablesJsonForValidation(trimmed));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).length;
    }
    return 1;
  } catch {
    return 1;
  }
}

export function hasQueryConfigErrors(errors: QueryTabErrors): boolean {
  return errors.operation || errors.variables || errors.extraction || errors.output;
}

// ── Subscription panel ───────────────────────────────────────────────────────

export interface SubscriptionTabErrors {
  subscription: boolean;
  extraction: boolean;
  output: boolean;
}

export function computeSubscriptionTabErrors(
  data: Pick<
    GraphqlSubscriptionNodeData,
    'endpoint' | 'subscriptionQuery' | 'variables' | 'extractionRules' | 'outputBindings'
  >,
): SubscriptionTabErrors {
  const subscriptionErr = !data.endpoint?.trim() || !data.subscriptionQuery?.trim();
  const variablesErr = hasInvalidVariablesJson(data.variables);
  return {
    subscription: subscriptionErr || variablesErr,
    extraction: hasInvalidExtractionRules(data.extractionRules),
    output: hasInvalidOutputBindings(data.outputBindings),
  };
}

export function hasSubscriptionConfigErrors(errors: SubscriptionTabErrors): boolean {
  return errors.subscription || errors.extraction || errors.output;
}

// ── Introspect panel ───────────────────────────────────────────────────────────

export interface IntrospectTabErrors {
  endpoint: boolean;
  output: boolean;
}

export function computeIntrospectTabErrors(
  data: Pick<GraphqlIntrospectNodeData, 'endpoint' | 'outputBindings'>,
): IntrospectTabErrors {
  return {
    endpoint: !data.endpoint?.trim(),
    output: hasInvalidOutputBindings(data.outputBindings),
  };
}

export function hasIntrospectConfigErrors(errors: IntrospectTabErrors): boolean {
  return errors.endpoint || errors.output;
}

// ── Assert panel ───────────────────────────────────────────────────────────────

export interface AssertTabErrors {
  source: boolean;
  assertions: boolean;
}

export function computeAssertTabErrors(
  data: Pick<GraphqlAssertNodeData, 'sourceVariable' | 'assertions'>,
): AssertTabErrors {
  return {
    source: !data.sourceVariable?.trim(),
    assertions: (data.assertions ?? []).some((a) => !a.jsonPath?.trim()),
  };
}

export function hasAssertConfigErrors(errors: AssertTabErrors): boolean {
  return errors.source || errors.assertions;
}

// ── Modal-level guard ──────────────────────────────────────────────────────────

const GRAPHQL_NODE_TYPES = new Set([
  'graphqlQuery',
  'graphqlMutation',
  'graphqlSubscription',
  'graphqlIntrospect',
  'graphqlAssert',
]);

export function isGraphqlWorkflowNodeType(type: string): boolean {
  return GRAPHQL_NODE_TYPES.has(type);
}

export function hasGraphqlNodeConfigErrors(
  nodeType: string,
  data: GraphqlQueryNodeData | GraphqlSubscriptionNodeData | GraphqlIntrospectNodeData | GraphqlAssertNodeData,
): boolean {
  switch (nodeType) {
    case 'graphqlQuery':
    case 'graphqlMutation':
      return hasQueryConfigErrors(computeQueryTabErrors(data as GraphqlQueryNodeData));
    case 'graphqlSubscription':
      return hasSubscriptionConfigErrors(computeSubscriptionTabErrors(data as GraphqlSubscriptionNodeData));
    case 'graphqlIntrospect':
      return hasIntrospectConfigErrors(computeIntrospectTabErrors(data as GraphqlIntrospectNodeData));
    case 'graphqlAssert':
      return hasAssertConfigErrors(computeAssertTabErrors(data as GraphqlAssertNodeData));
    default:
      return false;
  }
}
