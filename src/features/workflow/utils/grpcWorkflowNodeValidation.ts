/**
 * Phase 6A — gRPC workflow node schema validators and error catalog.
 */
import type { GrpcAuthConfig } from '../../../shared/grpc/contracts';
import { validateGrpcAuthForExecute } from '../../../shared/grpc/grpcAuthPolicy';
import { validateGrpcMetadataRecord } from '../../../shared/grpc/metadataValidation';
import { validateGrpcTargetAddress } from '../../../shared/grpc/targetValidation';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
  GrpcWorkflowAssertion,
  GrpcWorkflowBaseConfig,
  GrpcWorkflowNodeType,
} from '../types/workflow/node-grpc';
import { isGrpcWorkflowNodeType, isGrpcWorkflowNodeTypeIncludingAdvanced } from '../types/workflow/node-grpc';
import {
  validateGrpcLoadTestNodeData,
  validateGrpcMockAssertNodeData,
  validateGrpcSchemaDiffNodeData,
} from './grpcWorkflowAdvancedNodeValidation';

export const GRPC_WORKFLOW_VALIDATION_CODES = {
  MISSING_LABEL: 'grpc.workflow.missing_label',
  MISSING_TARGET: 'grpc.workflow.missing_target',
  INVALID_TARGET: 'grpc.workflow.invalid_target',
  MISSING_DESCRIPTOR_KEY: 'grpc.workflow.missing_descriptor_key',
  MISSING_SERVICE: 'grpc.workflow.missing_service',
  MISSING_METHOD: 'grpc.workflow.missing_method',
  INVALID_BODY: 'grpc.workflow.invalid_body',
  INVALID_METADATA: 'grpc.workflow.invalid_metadata',
  INVALID_AUTH: 'grpc.workflow.invalid_auth',
  INVALID_TIMEOUT: 'grpc.workflow.invalid_timeout',
  INVALID_TLS_MODE: 'grpc.workflow.invalid_tls_mode',
  INVALID_RETRY: 'grpc.workflow.invalid_retry',
  INVALID_ON_ERROR: 'grpc.workflow.invalid_on_error',
  INVALID_SAVE_AS: 'grpc.workflow.invalid_save_as',
  MISSING_COLLECT_RULE: 'grpc.workflow.missing_collect_rule',
  INVALID_COLLECT_RULE: 'grpc.workflow.invalid_collect_rule',
  MISSING_ASSERT_SOURCE: 'grpc.workflow.missing_assert_source',
  MISSING_ASSERTIONS: 'grpc.workflow.missing_assertions',
  INVALID_ASSERTION: 'grpc.workflow.invalid_assertion',
  INVALID_CALL_TYPE: 'grpc.workflow.invalid_call_type',
  DUPLICATE_SAVE_AS: 'grpc.workflow.duplicate_save_as',
  SAVE_AS_SHADOWS_NODE_ID: 'grpc.workflow.save_as_shadows_node_id',
  RESERVED_SAVE_AS: 'grpc.workflow.reserved_save_as',
  ASSERT_SOURCE_CALL_TYPE_MISMATCH: 'grpc.workflow.assert_source_call_type_mismatch',
  UNKNOWN_ASSERT_SOURCE: 'grpc.workflow.unknown_assert_source',
  UNSUPPORTED_NODE_TYPE: 'grpc.workflow.unsupported_node_type',
} as const;

export type GrpcWorkflowValidationCode =
  (typeof GRPC_WORKFLOW_VALIDATION_CODES)[keyof typeof GRPC_WORKFLOW_VALIDATION_CODES];

export interface GrpcWorkflowValidationIssue {
  nodeId?: string;
  field: string;
  code: GrpcWorkflowValidationCode;
  message: string;
}

export interface GrpcWorkflowNodeValidationResult {
  valid: boolean;
  issues: GrpcWorkflowValidationIssue[];
}

/** Required vs optional fields per node type (contract matrix for docs/tests). */
export const GRPC_WORKFLOW_NODE_CONTRACT_MATRIX: Record<
  GrpcWorkflowNodeType,
  { required: string[]; optional: string[] }
> = {
  grpcUnary: {
    required: ['label', 'target', 'descriptorKey', 'service', 'method', 'callType', 'body'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'onError', 'saveAs',
    ],
  },
  grpcServerStream: {
    required: ['label', 'target', 'descriptorKey', 'service', 'method', 'callType', 'body', 'collect'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'onError', 'saveAs',
    ],
  },
  grpcAssert: {
    required: ['label', 'source', 'assertions'],
    optional: ['onError'],
  },
};

const SAVE_AS_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const ENV_TEMPLATE_PATTERN = /\{\{[^}]+\}\}/;
/** Reserved — collide with compatibility aliases {{grpc.response.*}} / {{grpc.stream.*}} */
export const GRPC_WORKFLOW_RESERVED_SAVE_AS = ['response', 'stream'] as const;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 600_000;

export function isValidGrpcWorkflowSaveAsAlias(alias: string): boolean {
  return SAVE_AS_PATTERN.test(alias.trim());
}

/** Accept literal host:port / in-process targets or env templates with {{var}}. */
export function isValidGrpcWorkflowTargetTemplate(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (ENV_TEMPLATE_PATTERN.test(trimmed)) return true;
  return validateGrpcTargetAddress(trimmed).valid;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(
  issues: GrpcWorkflowValidationIssue[],
  issue: GrpcWorkflowValidationIssue,
): void {
  issues.push(issue);
}

function validateTlsMode(
  tlsMode: GrpcWorkflowBaseConfig['tlsMode'],
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (tlsMode === undefined) return;
  if (tlsMode === 'disabled' || tlsMode === 'tls' || tlsMode === 'mtls') return;
  pushIssue(issues, {
    nodeId,
    field: 'tlsMode',
    code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TLS_MODE,
    message: 'tlsMode must be disabled, tls, or mtls',
  });
}

function validateTimeoutMs(
  timeoutMs: number | undefined,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (timeoutMs === undefined) return;
  if (!Number.isFinite(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    pushIssue(issues, {
      nodeId,
      field: 'timeoutMs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TIMEOUT,
      message: `timeoutMs must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
    });
  }
}

function validateMetadata(
  metadata: Record<string, string> | undefined,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (!metadata || Object.keys(metadata).length === 0) return;
  const error = validateGrpcMetadataRecord(metadata);
  if (error) {
    pushIssue(issues, {
      nodeId,
      field: 'metadata',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_METADATA,
      message: error,
    });
  }
}

function validateAuthConfig(
  auth: GrpcAuthConfig | undefined,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (!auth || auth.type === 'none') return;
  const authIssues = validateGrpcAuthForExecute(auth);
  for (const authIssue of authIssues) {
    pushIssue(issues, {
      nodeId,
      field: authIssue.field,
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_AUTH,
      message: authIssue.message,
    });
  }
}

function validateRetryPolicy(
  retry: GrpcWorkflowBaseConfig['retry'],
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (!retry) return;
  if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
    pushIssue(issues, {
      nodeId,
      field: 'retry.maxAttempts',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_RETRY,
      message: 'retry.maxAttempts must be an integer >= 1',
    });
  }
  if (!Number.isFinite(retry.backoffMs) || retry.backoffMs < 0) {
    pushIssue(issues, {
      nodeId,
      field: 'retry.backoffMs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_RETRY,
      message: 'retry.backoffMs must be a non-negative number',
    });
  }
  if (retry.retryOnStatuses) {
    for (const status of retry.retryOnStatuses) {
      if (!Number.isInteger(status) || status < 0 || status > 16) {
        pushIssue(issues, {
          nodeId,
          field: 'retry.retryOnStatuses',
          code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_RETRY,
          message: 'retryOnStatuses entries must be gRPC status codes 0–16',
        });
        break;
      }
    }
  }
}

function validateOnErrorPolicy(
  onError: string | undefined,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (onError === undefined) return;
  if (onError !== 'fail' && onError !== 'continue') {
    pushIssue(issues, {
      nodeId,
      field: 'onError',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ON_ERROR,
      message: 'onError must be fail or continue',
    });
  }
}

function validateSaveAsAlias(
  saveAs: string | undefined,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  const trimmed = saveAs?.trim();
  if (!trimmed) return;
  if (
    GRPC_WORKFLOW_RESERVED_SAVE_AS.includes(trimmed as typeof GRPC_WORKFLOW_RESERVED_SAVE_AS[number])
  ) {
    pushIssue(issues, {
      nodeId,
      field: 'saveAs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.RESERVED_SAVE_AS,
      message: `saveAs "${trimmed}" is reserved (conflicts with grpc.${trimmed} compatibility alias)`,
    });
    return;
  }
  if (!isValidGrpcWorkflowSaveAsAlias(trimmed)) {
    pushIssue(issues, {
      nodeId,
      field: 'saveAs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_SAVE_AS,
      message: 'saveAs must be a valid identifier (letters, digits, underscore)',
    });
  }
}

function validateCallNodeBase(
  data: GrpcWorkflowBaseConfig,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (!data.label?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'label',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL,
      message: 'Node label is required',
    });
  }
  const hasTarget = Boolean(data.target?.trim());
  const hasConnectionProfile = Boolean(data.connectionId?.trim());
  if (!hasTarget && !hasConnectionProfile) {
    pushIssue(issues, {
      nodeId,
      field: 'target',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_TARGET,
      message: 'Target address or connection profile is required',
    });
  } else if (hasTarget && !isValidGrpcWorkflowTargetTemplate(data.target)) {
    pushIssue(issues, {
      nodeId,
      field: 'target',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TARGET,
      message: 'Target must be host:port, in-process:<name>, or an env template such as {{grpcHost}}',
    });
  }
  if (!data.descriptorKey?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'descriptorKey',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY,
      message: 'descriptorKey is required',
    });
  }
  if (!data.service?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'service',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_SERVICE,
      message: 'service is required',
    });
  }
  if (!data.method?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'method',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_METHOD,
      message: 'method is required',
    });
  }
  validateTlsMode(data.tlsMode, issues, nodeId);
  validateTimeoutMs(data.timeoutMs, issues, nodeId);
  validateMetadata(data.metadata, issues, nodeId);
  validateAuthConfig(data.auth, issues, nodeId);
  validateRetryPolicy(data.retry, issues, nodeId);
  validateOnErrorPolicy(data.onError, issues, nodeId);
  validateSaveAsAlias(data.saveAs, issues, nodeId);
}

function validateBody(
  body: unknown,
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (!isPlainObject(body)) {
    pushIssue(issues, {
      nodeId,
      field: 'body',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_BODY,
      message: 'body must be a JSON object',
    });
  }
}

function hasValidCollectRule(collect: GrpcServerStreamNodeData['collect']): boolean {
  if (!collect || typeof collect !== 'object') return false;
  const maxMessages = collect.maxMessages;
  const untilExpression = collect.untilExpression?.trim();
  const maxDurationMs = collect.maxDurationMs;
  if (Number.isFinite(maxMessages) && (maxMessages as number) > 0) return true;
  if (untilExpression) return true;
  if (Number.isFinite(maxDurationMs) && (maxDurationMs as number) > 0) return true;
  return false;
}

function validateCollectConfig(
  collect: GrpcServerStreamNodeData['collect'],
  issues: GrpcWorkflowValidationIssue[],
  nodeId?: string,
): void {
  if (
    collect?.maxMessages !== undefined
    && (!Number.isInteger(collect.maxMessages) || collect.maxMessages < 1)
  ) {
    pushIssue(issues, {
      nodeId,
      field: 'collect.maxMessages',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_COLLECT_RULE,
      message: 'collect.maxMessages must be a positive integer when set',
    });
  }
  if (
    collect?.maxDurationMs !== undefined
    && (!Number.isFinite(collect.maxDurationMs) || collect.maxDurationMs < 1)
  ) {
    pushIssue(issues, {
      nodeId,
      field: 'collect.maxDurationMs',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_COLLECT_RULE,
      message: 'collect.maxDurationMs must be a positive number when set',
    });
  }
  if (!hasValidCollectRule(collect)) {
    pushIssue(issues, {
      nodeId,
      field: 'collect',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_COLLECT_RULE,
      message: 'Server stream collect requires at least one of maxMessages, untilExpression, or maxDurationMs',
    });
  }
}

function assertionKinds(assertion: GrpcWorkflowAssertion): string[] {
  const kinds: string[] = [];
  if ('grpcStatus' in assertion && assertion.grpcStatus !== undefined) kinds.push('grpcStatus');
  if ('grpcField' in assertion && assertion.grpcField !== undefined) kinds.push('grpcField');
  if ('grpcTrailer' in assertion && assertion.grpcTrailer !== undefined) kinds.push('grpcTrailer');
  if ('grpcDuration' in assertion && assertion.grpcDuration !== undefined) kinds.push('grpcDuration');
  if ('grpcStreamLength' in assertion && assertion.grpcStreamLength !== undefined) kinds.push('grpcStreamLength');
  return kinds;
}

function isValidGrpcAssertFieldPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed) return false;

  // Accept "$" root and both "$.*"/"$[...]" prefixed forms, while preserving
  // compatibility with legacy relative paths like "message".
  let normalized = trimmed;
  if (normalized === '$') return true;
  if (normalized.startsWith('$.')) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith('$[')) {
    normalized = normalized.slice(1);
  } else if (normalized.startsWith('$')) {
    return false;
  }

  if (!normalized) return false;
  if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) {
    return false;
  }

  let i = 0;
  let sawToken = false;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (ch === '.') {
      if (!sawToken || i === normalized.length - 1) return false;
      i += 1;
      continue;
    }
    if (ch === '[') {
      const end = normalized.indexOf(']', i + 1);
      if (end === -1) return false;
      const inner = normalized.slice(i + 1, end).trim();
      if (!/^\d+$/.test(inner) && inner !== '*') return false;
      sawToken = true;
      i = end + 1;
      continue;
    }
    if (ch === ']') return false;

    let j = i;
    while (j < normalized.length && normalized[j] !== '.' && normalized[j] !== '[' && normalized[j] !== ']') {
      j += 1;
    }
    if (j === i) return false;
    sawToken = true;
    i = j;
  }

  return sawToken;
}

function validateAssertionShape(
  assertion: GrpcWorkflowAssertion,
  issues: GrpcWorkflowValidationIssue[],
  nodeId: string | undefined,
  index: number,
): void {
  const kinds = assertionKinds(assertion);
  if (kinds.length === 0) {
    pushIssue(issues, {
      nodeId,
      field: `assertions[${index}]`,
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
      message: 'Assertion must specify grpcStatus, grpcField, grpcTrailer, grpcDuration, or grpcStreamLength',
    });
    return;
  }
  if (kinds.length > 1) {
    pushIssue(issues, {
      nodeId,
      field: `assertions[${index}]`,
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
      message: `Assertion must specify exactly one assertion kind (found: ${kinds.join(', ')})`,
    });
    return;
  }
  const kind = kinds[0]!;
  if (kind === 'grpcStatus') {
    const status = (assertion as { grpcStatus: number }).grpcStatus;
    if (!Number.isInteger(status) || status < 0 || status > 16) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcStatus`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStatus must be an integer 0–16',
      });
    }
    return;
  }
  if (kind === 'grpcField') {
    const fieldAssertion = assertion as { grpcField: string; equals?: unknown; contains?: unknown; exists?: boolean };
    const field = fieldAssertion.grpcField?.trim();
    if (!field) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcField`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcField path is required',
      });
      return;
    }
    if (!isValidGrpcAssertFieldPath(field)) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcField`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcField must be a valid JSONPath (e.g. $.message, messages[0].field, payload.items[0])',
      });
      return;
    }
    const hasOperator = fieldAssertion.equals !== undefined
      || fieldAssertion.contains !== undefined
      || fieldAssertion.exists !== undefined;
    if (!hasOperator) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcField`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcField assertion requires equals, contains, or exists',
      });
    }
    return;
  }
  if (kind === 'grpcTrailer') {
    const trailerAssertion = assertion as { grpcTrailer: string; equals?: string; exists?: boolean };
    const trailer = trailerAssertion.grpcTrailer?.trim();
    if (!trailer) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcTrailer`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcTrailer name is required',
      });
      return;
    }
    const hasOperator = trailerAssertion.equals !== undefined
      || trailerAssertion.exists !== undefined;
    if (!hasOperator) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcTrailer`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcTrailer assertion requires equals or exists',
      });
    }
    return;
  }
  if (kind === 'grpcDuration') {
    const duration = (assertion as { grpcDuration: { max?: number; min?: number } }).grpcDuration;
    const hasMin = Number.isFinite(duration?.min);
    const hasMax = Number.isFinite(duration?.max);
    if (!hasMin && !hasMax) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcDuration`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcDuration requires min and/or max',
      });
    }
    return;
  }
  if (kind === 'grpcStreamLength') {
    const length = (assertion as { grpcStreamLength: { equals?: number; min?: number; max?: number } }).grpcStreamLength;
    const hasEquals = Number.isFinite(length?.equals);
    const hasMin = Number.isFinite(length?.min);
    const hasMax = Number.isFinite(length?.max);
    if (!hasEquals && !hasMin && !hasMax) {
      pushIssue(issues, {
        nodeId,
        field: `assertions[${index}].grpcStreamLength`,
        code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamLength requires equals, min, and/or max',
      });
    }
  }
}

export function validateGrpcUnaryNodeData(
  data: GrpcUnaryNodeData,
  nodeId?: string,
): GrpcWorkflowNodeValidationResult {
  const issues: GrpcWorkflowValidationIssue[] = [];
  validateCallNodeBase(data, issues, nodeId);
  validateBody(data.body, issues, nodeId);
  if (data.callType !== 'unary') {
    pushIssue(issues, {
      nodeId,
      field: 'callType',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_CALL_TYPE,
      message: 'callType must be unary',
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateGrpcServerStreamNodeData(
  data: GrpcServerStreamNodeData,
  nodeId?: string,
): GrpcWorkflowNodeValidationResult {
  const issues: GrpcWorkflowValidationIssue[] = [];
  validateCallNodeBase(data, issues, nodeId);
  validateBody(data.body, issues, nodeId);
  validateCollectConfig(data.collect, issues, nodeId);
  if (data.callType !== 'server_streaming') {
    pushIssue(issues, {
      nodeId,
      field: 'callType',
      code: GRPC_WORKFLOW_VALIDATION_CODES.INVALID_CALL_TYPE,
      message: 'callType must be server_streaming',
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateGrpcAssertNodeData(
  data: GrpcAssertNodeData,
  nodeId?: string,
): GrpcWorkflowNodeValidationResult {
  const issues: GrpcWorkflowValidationIssue[] = [];
  if (!data.label?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'label',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL,
      message: 'Node label is required',
    });
  }
  if (!data.source?.trim()) {
    pushIssue(issues, {
      nodeId,
      field: 'source',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_ASSERT_SOURCE,
      message: 'Assert source (node id or saveAs alias) is required',
    });
  }
  validateOnErrorPolicy(data.onError, issues, nodeId);
  const assertions = data.assertions ?? [];
  if (assertions.length === 0) {
    pushIssue(issues, {
      nodeId,
      field: 'assertions',
      code: GRPC_WORKFLOW_VALIDATION_CODES.MISSING_ASSERTIONS,
      message: 'At least one assertion is required',
    });
  } else {
    assertions.forEach((assertion, index) => {
      validateAssertionShape(assertion, issues, nodeId, index);
    });
  }
  return { valid: issues.length === 0, issues };
}

export function validateGrpcWorkflowNodeData(
  nodeType: string,
  data: unknown,
  nodeId?: string,
): GrpcWorkflowNodeValidationResult {
  if (!isGrpcWorkflowNodeType(nodeType) && !isGrpcWorkflowNodeTypeIncludingAdvanced(nodeType)) {
    return {
      valid: false,
      issues: [{
        nodeId,
        field: 'type',
        code: GRPC_WORKFLOW_VALIDATION_CODES.UNSUPPORTED_NODE_TYPE,
        message: `Unsupported gRPC workflow node type: ${nodeType}`,
      }],
    };
  }
  switch (nodeType) {
    case 'grpcUnary':
      return validateGrpcUnaryNodeData(data as GrpcUnaryNodeData, nodeId);
    case 'grpcServerStream':
      return validateGrpcServerStreamNodeData(data as GrpcServerStreamNodeData, nodeId);
    case 'grpcAssert':
      return validateGrpcAssertNodeData(data as GrpcAssertNodeData, nodeId);
    case 'grpcLoadTest':
      return validateGrpcLoadTestNodeData(data as import('../types/workflow/node-grpc-advanced').GrpcLoadTestNodeData, nodeId);
    case 'grpcSchemaDiff':
      return validateGrpcSchemaDiffNodeData(data as import('../types/workflow/node-grpc-advanced').GrpcSchemaDiffNodeData, nodeId);
    case 'grpcMockAssert':
      return validateGrpcMockAssertNodeData(data as import('../types/workflow/node-grpc-advanced').GrpcMockAssertNodeData, nodeId);
    default:
      return { valid: true, issues: [] };
  }
}

export function defaultGrpcWorkflowTimeoutMs(): number {
  return DEFAULT_TIMEOUT_MS;
}

/** Modal/save guard — mirrors `hasGraphqlNodeConfigErrors` for Phase 6G config panels. */
export function hasGrpcWorkflowNodeConfigErrors(nodeType: string, data: unknown): boolean {
  if (!isGrpcWorkflowNodeType(nodeType) && !isGrpcWorkflowNodeTypeIncludingAdvanced(nodeType)) {
    return false;
  }
  return !validateGrpcWorkflowNodeData(nodeType, data).valid;
}
