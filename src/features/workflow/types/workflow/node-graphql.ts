// ── Phase 4 — GraphQL Workflow Node Types ────────────────────────────────────

import type { FieldOperator } from '@shared/types';
import type { GraphqlAuth } from '@shared/types/graphql';

export interface GraphqlNodeHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface GraphqlExtractionRule {
  /** Name under which the extracted value is stored in workflow variables. */
  variableName: string;
  /** JSONPath applied to the response `data` object. */
  jsonPath: string;
}

export interface GraphqlOutputBinding {
  field: 'data' | 'errors' | 'latencyMs' | 'httpStatus' | 'operationName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlSubscriptionOutputBinding {
  field: 'messages' | 'messageCount' | 'firstMessage' | 'lastMessage' | 'latencyMs';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlIntrospectOutputBinding {
  field: 'sdl' | 'typeCount' | 'fieldCount' | 'schemaHash' | 'queryTypeName';
  variableName: string;
  enabled: boolean;
}

export interface GraphqlWorkflowAssertion {
  id: string;
  /** JSONPath applied to the value of sourceVariable. */
  jsonPath: string;
  /**
   * FieldOperator value — use full names (e.g. 'equals', 'greater_than_or_equal').
   * Do NOT use short aliases.
   */
  operator: FieldOperator;
  /** Stringified expected value; omitted for 'exists' / 'not_exists'. */
  expectedValue?: string;
  /** Human-readable label shown in the workflow run timeline. */
  description?: string;
}

/**
 * Node data for `graphqlQuery` and `graphqlMutation` — they are structurally identical.
 * The `nodeType` distinguishes them only in the config panel UI.
 */
export interface GraphqlQueryNodeData {
  [key: string]: unknown;
  label: string;
  /** HTTP endpoint; {{var}} supported. */
  endpoint: string;
  /** GraphQL operation text (query or mutation). */
  query: string;
  /** JSON string; {{var}} interpolated at runtime. */
  variables: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  /** Default 30000 ms. */
  timeoutMs: number;
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlOutputBinding[];
}

export interface GraphqlSubscriptionNodeData {
  [key: string]: unknown;
  label: string;
  /** HTTP or WS endpoint; wss:// derived via deriveWsEndpoint() when needed. */
  endpoint: string;
  /** Must be a `subscription { }` operation. */
  subscriptionQuery: string;
  /** JSON string. */
  variables: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  /** Default: 'auto'. */
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  /** Stop after collecting N messages (0 = unlimited). */
  stopAfterMessages?: number;
  /** Stop after N ms of wall time. */
  stopAfterMs?: number;
  /** JSONPath expression on the latest message's `data` object; stop when truthy. Same root as extractionRules. */
  stopCondition?: string;
  /** Applied to each individual message. */
  extractionRules: GraphqlExtractionRule[];
  outputBindings: GraphqlSubscriptionOutputBinding[];
}

export interface GraphqlIntrospectNodeData {
  [key: string]: unknown;
  label: string;
  endpoint: string;
  headers: GraphqlNodeHeaderRow[];
  auth?: GraphqlAuth;
  skipTlsVerify?: boolean;
  /** Default 30000 ms; introspection can be slow on cold starts. */
  timeoutMs: number;
  /** Error if schema type count is below this value. */
  minTypeCount?: number;
  /** Error if any of these type names are absent from the schema. */
  requiredTypes?: string[];
  /** Error if any specified field is not found on its type. */
  requiredFields?: Array<{ typeName: string; fieldName: string }>;
  outputBindings: GraphqlIntrospectOutputBinding[];
}

export interface GraphqlAssertNodeData {
  [key: string]: unknown;
  label: string;
  /** Name of the workflow variable to assert on (from a prior node's output). */
  sourceVariable: string;
  assertions: GraphqlWorkflowAssertion[];
  /** 'error' halts the workflow; 'warn' continues with a warning badge. */
  failBehavior: 'error' | 'warn';
}
