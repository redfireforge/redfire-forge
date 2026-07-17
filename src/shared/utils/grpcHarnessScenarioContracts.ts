/**
 * Phase 8A — gRPC harness scenario validators and error catalog.
 */
import type { GrpcCallType } from '../grpc/contracts';
import { validateGrpcAuthForExecute } from '../grpc/grpcAuthPolicy';
import { validateGrpcMetadataKey, validateGrpcMetadataValue } from '../grpc/metadataValidation';
import { validateGrpcTargetAddress } from '../grpc/targetValidation';
import type { Scenario, ScenarioActionType } from '../types';
import type {
  GrpcHarnessAssertion,
  GrpcHarnessCallActionConfig,
  GrpcHarnessCollectConfig,
} from '../types/grpc-harness';

export const GRPC_HARNESS_VALIDATION_CODES = {
  MISSING_ACTION_CONFIG: 'grpc.harness.missing_action_config',
  INVALID_CALL_TYPE: 'grpc.harness.invalid_call_type',
  MISSING_TARGET: 'grpc.harness.missing_target',
  INVALID_TARGET: 'grpc.harness.invalid_target',
  MISSING_DESCRIPTOR_KEY: 'grpc.harness.missing_descriptor_key',
  MISSING_SERVICE: 'grpc.harness.missing_service',
  MISSING_METHOD: 'grpc.harness.missing_method',
  INVALID_BODY: 'grpc.harness.invalid_body',
  INVALID_METADATA: 'grpc.harness.invalid_metadata',
  INVALID_AUTH: 'grpc.harness.invalid_auth',
  INVALID_TIMEOUT: 'grpc.harness.invalid_timeout',
  INVALID_TLS_MODE: 'grpc.harness.invalid_tls_mode',
  INVALID_RETRY: 'grpc.harness.invalid_retry',
  MISSING_COLLECT_RULE: 'grpc.harness.missing_collect_rule',
  INVALID_COLLECT_RULE: 'grpc.harness.invalid_collect_rule',
  MISSING_SEND_MESSAGES: 'grpc.harness.missing_send_messages',
  INVALID_SEND_MESSAGES: 'grpc.harness.invalid_send_messages',
  INVALID_ASSERTION: 'grpc.harness.invalid_assertion',
  UNSUPPORTED_ACTION_TYPE: 'grpc.harness.unsupported_action_type',
} as const;

export type GrpcHarnessValidationCode =
  (typeof GRPC_HARNESS_VALIDATION_CODES)[keyof typeof GRPC_HARNESS_VALIDATION_CODES];

export interface GrpcHarnessValidationIssue {
  field: string;
  code: GrpcHarnessValidationCode;
  message: string;
}

export interface GrpcHarnessScenarioValidationResult {
  valid: boolean;
  issues: GrpcHarnessValidationIssue[];
}

export const GRPC_HARNESS_SCENARIO_CONTRACT_MATRIX: Record<
  GrpcCallType,
  { required: string[]; optional: string[] }
> = {
  unary: {
    required: ['target', 'descriptorKey', 'service', 'method', 'body'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'assertions',
    ],
  },
  server_streaming: {
    required: ['target', 'descriptorKey', 'service', 'method', 'body', 'collect'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'assertions',
    ],
  },
  client_streaming: {
    required: ['target', 'descriptorKey', 'service', 'method', 'sendMessages'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'body', 'assertions',
    ],
  },
  bidi_streaming: {
    required: ['target', 'descriptorKey', 'service', 'method', 'sendMessages', 'collect'],
    optional: [
      'connectionId', 'tlsMode', 'metadata', 'auth', 'timeoutMs', 'retry', 'body', 'assertions',
    ],
  },
};

const ENV_TEMPLATE_PATTERN = /\{\{[^}]+\}\}/;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 600_000;
const KNOWN_GRPC_HARNESS_CALL_TYPES: ReadonlySet<GrpcCallType> = new Set([
  'unary',
  'server_streaming',
  'client_streaming',
  'bidi_streaming',
]);
const STREAMING_CALL_TYPES = new Set<GrpcCallType>([
  'server_streaming',
  'client_streaming',
  'bidi_streaming',
]);

function isKnownGrpcHarnessCallType(value: string | undefined): value is GrpcCallType {
  return value !== undefined && KNOWN_GRPC_HARNESS_CALL_TYPES.has(value as GrpcCallType);
}

/** Returns null when `callType` is present but not a known harness call type. */
function resolveGrpcHarnessCallTypeForRules(
  config: GrpcHarnessCallActionConfig,
): GrpcCallType | null {
  if (config.callType === undefined) return 'unary';
  return isKnownGrpcHarnessCallType(config.callType) ? config.callType : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pushIssue(
  issues: GrpcHarnessValidationIssue[],
  issue: GrpcHarnessValidationIssue,
): void {
  issues.push(issue);
}

export function resolveGrpcHarnessActionType(scenario: Scenario): ScenarioActionType {
  return scenario.actionType ?? 'http';
}

export function isGrpcHarnessScenario(scenario: Scenario): boolean {
  return resolveGrpcHarnessActionType(scenario) === 'grpcCall';
}

export function resolveGrpcHarnessCallType(
  config: GrpcHarnessCallActionConfig | undefined,
): GrpcCallType {
  return config?.callType ?? 'unary';
}

export function makeDefaultGrpcHarnessCallAction(): GrpcHarnessCallActionConfig {
  return {
    callType: 'unary',
    target: '{{grpcHost}}',
    descriptorKey: '',
    service: '',
    method: '',
    body: {},
    metadata: {},
    timeoutMs: DEFAULT_TIMEOUT_MS,
    assertions: [],
  };
}

export function isValidGrpcHarnessTargetTemplate(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (ENV_TEMPLATE_PATTERN.test(trimmed)) return true;
  return validateGrpcTargetAddress(trimmed).valid;
}

function hasValidCollectRule(collect: GrpcHarnessCollectConfig | undefined): boolean {
  const maxMessages = collect?.maxMessages;
  const maxDurationMs = collect?.maxDurationMs;
  if (Number.isFinite(maxMessages) && (maxMessages as number) > 0) return true;
  if (Number.isFinite(maxDurationMs) && (maxDurationMs as number) > 0) return true;
  return false;
}

function validateTlsMode(
  tlsMode: GrpcHarnessCallActionConfig['tlsMode'],
  issues: GrpcHarnessValidationIssue[],
): void {
  if (tlsMode === undefined) return;
  if (tlsMode !== 'disabled' && tlsMode !== 'tls' && tlsMode !== 'mtls') {
    pushIssue(issues, {
      field: 'grpcCallAction.tlsMode',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_TLS_MODE,
      message: 'tlsMode must be disabled, tls, or mtls',
    });
  }
}

function containsHarnessEnvTemplate(value: string): boolean {
  return ENV_TEMPLATE_PATTERN.test(value);
}

function validateHarnessMetadataRecord(
  metadata: Record<string, string> | undefined,
  issues: GrpcHarnessValidationIssue[],
): void {
  if (!metadata) return;
  for (const [key, value] of Object.entries(metadata)) {
    if (!containsHarnessEnvTemplate(key)) {
      const keyError = validateGrpcMetadataKey(key);
      if (keyError) {
        pushIssue(issues, {
          field: 'grpcCallAction.metadata',
          code: GRPC_HARNESS_VALIDATION_CODES.INVALID_METADATA,
          message: keyError,
        });
        continue;
      }
    }
    if (!containsHarnessEnvTemplate(key) && !containsHarnessEnvTemplate(value)) {
      const valueError = validateGrpcMetadataValue(key, value);
      if (valueError) {
        pushIssue(issues, {
          field: 'grpcCallAction.metadata',
          code: GRPC_HARNESS_VALIDATION_CODES.INVALID_METADATA,
          message: valueError,
        });
      }
    }
  }
}

function validateRetryPolicy(
  retry: GrpcHarnessCallActionConfig['retry'],
  issues: GrpcHarnessValidationIssue[],
): void {
  if (!retry) return;
  if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
    pushIssue(issues, {
      field: 'grpcCallAction.retry.maxAttempts',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_RETRY,
      message: 'retry.maxAttempts must be a positive integer',
    });
  }
  if (!Number.isFinite(retry.backoffMs) || retry.backoffMs < 0) {
    pushIssue(issues, {
      field: 'grpcCallAction.retry.backoffMs',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_RETRY,
      message: 'retry.backoffMs must be a non-negative number',
    });
  }
  if (retry.retryOnStatuses !== undefined) {
    if (!Array.isArray(retry.retryOnStatuses) || retry.retryOnStatuses.some(
      (status) => !Number.isInteger(status) || status < 0 || status > 16,
    )) {
      pushIssue(issues, {
        field: 'grpcCallAction.retry.retryOnStatuses',
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_RETRY,
        message: 'retry.retryOnStatuses must be an array of integers 0–16',
      });
    }
  }
}

function validateCollectConfig(
  collect: GrpcHarnessCollectConfig | undefined,
  issues: GrpcHarnessValidationIssue[],
): void {
  if (
    collect?.maxMessages !== undefined
    && (!Number.isInteger(collect.maxMessages) || collect.maxMessages < 1)
  ) {
    pushIssue(issues, {
      field: 'grpcCallAction.collect.maxMessages',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_COLLECT_RULE,
      message: 'collect.maxMessages must be a positive integer when set',
    });
  }
  if (
    collect?.maxDurationMs !== undefined
    && (!Number.isFinite(collect.maxDurationMs) || collect.maxDurationMs < 1)
  ) {
    pushIssue(issues, {
      field: 'grpcCallAction.collect.maxDurationMs',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_COLLECT_RULE,
      message: 'collect.maxDurationMs must be a positive number when set',
    });
  }
  if (!hasValidCollectRule(collect)) {
    pushIssue(issues, {
      field: 'grpcCallAction.collect',
      code: GRPC_HARNESS_VALIDATION_CODES.MISSING_COLLECT_RULE,
      message: 'Streaming collect requires at least one of maxMessages or maxDurationMs',
    });
  }
}

function validateSendMessages(
  sendMessages: GrpcHarnessCallActionConfig['sendMessages'],
  issues: GrpcHarnessValidationIssue[],
): void {
  if (!Array.isArray(sendMessages) || sendMessages.length === 0) {
    pushIssue(issues, {
      field: 'grpcCallAction.sendMessages',
      code: GRPC_HARNESS_VALIDATION_CODES.MISSING_SEND_MESSAGES,
      message: 'sendMessages must be a non-empty array for client/bidi streaming',
    });
    return;
  }
  sendMessages.forEach((message, index) => {
    if (!isPlainObject(message)) {
      pushIssue(issues, {
        field: `grpcCallAction.sendMessages[${index}]`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_SEND_MESSAGES,
        message: 'Each sendMessages entry must be a JSON object',
      });
    }
  });
}

function assertionKinds(assertion: GrpcHarnessAssertion): string[] {
  const kinds: string[] = [];
  if ('grpcStatus' in assertion && assertion.grpcStatus !== undefined) kinds.push('grpcStatus');
  if ('grpcField' in assertion && assertion.grpcField !== undefined) kinds.push('grpcField');
  if ('grpcNumericField' in assertion && assertion.grpcNumericField !== undefined) {
    kinds.push('grpcNumericField');
  }
  if ('grpcStreamField' in assertion && assertion.grpcStreamField !== undefined) {
    kinds.push('grpcStreamField');
  }
  if ('grpcTrailer' in assertion && assertion.grpcTrailer !== undefined) kinds.push('grpcTrailer');
  if ('grpcDuration' in assertion && assertion.grpcDuration !== undefined) kinds.push('grpcDuration');
  if ('grpcStreamLength' in assertion && assertion.grpcStreamLength !== undefined) {
    kinds.push('grpcStreamLength');
  }
  return kinds;
}

function validateAssertionShape(
  assertion: GrpcHarnessAssertion,
  issues: GrpcHarnessValidationIssue[],
  index: number,
  callType: GrpcCallType,
): void {
  const kinds = assertionKinds(assertion);
  if (kinds.length === 0) {
    pushIssue(issues, {
      field: `grpcCallAction.assertions[${index}]`,
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
      message: 'Assertion must specify a supported grpc* assertion kind',
    });
    return;
  }
  if (kinds.length > 1) {
    pushIssue(issues, {
      field: `grpcCallAction.assertions[${index}]`,
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
      message: `Assertion must specify exactly one kind (found: ${kinds.join(', ')})`,
    });
    return;
  }

  const kind = kinds[0]!;
  if (kind === 'grpcStatus') {
    const status = (assertion as { grpcStatus: number }).grpcStatus;
    if (!Number.isInteger(status) || status < 0 || status > 16) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStatus`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStatus must be an integer 0–16',
      });
    }
    return;
  }

  if (kind === 'grpcField') {
    const fieldAssertion = assertion as {
      grpcField: string;
      equals?: unknown;
      contains?: unknown;
      exists?: boolean;
    };
    if (!fieldAssertion.grpcField?.trim()) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcField path is required',
      });
      return;
    }
    const hasOperator = fieldAssertion.equals !== undefined
      || fieldAssertion.contains !== undefined
      || fieldAssertion.exists !== undefined;
    if (!hasOperator) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcField assertion requires equals, contains, or exists',
      });
    }
    return;
  }

  if (kind === 'grpcNumericField') {
    const numeric = assertion as {
      grpcNumericField: string;
      operator: string;
      value: string | number;
    };
    if (!numeric.grpcNumericField?.trim()) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcNumericField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcNumericField path is required',
      });
      return;
    }
    if (!['==', '!=', '>', '>=', '<', '<='].includes(numeric.operator)) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].operator`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcNumericField operator must be one of ==, !=, >, >=, <, <=',
      });
    }
    if (numeric.value === undefined || numeric.value === null || numeric.value === '') {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].value`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcNumericField value is required',
      });
    }
    return;
  }

  if (kind === 'grpcStreamField') {
    const streamField = assertion as {
      grpcStreamField: string;
      index: number;
      equals?: unknown;
      contains?: unknown;
      exists?: boolean;
    };
    if (!streamField.grpcStreamField?.trim()) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStreamField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamField path is required',
      });
      return;
    }
    if (!Number.isInteger(streamField.index) || streamField.index < 0) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].index`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamField index must be a non-negative integer',
      });
      return;
    }
    if (!STREAMING_CALL_TYPES.has(callType)) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStreamField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamField assertions require a streaming callType',
      });
      return;
    }
    const hasOperator = streamField.equals !== undefined
      || streamField.contains !== undefined
      || streamField.exists !== undefined;
    if (!hasOperator) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStreamField`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamField assertion requires equals, contains, or exists',
      });
    }
    return;
  }

  if (kind === 'grpcTrailer') {
    const trailer = assertion as { grpcTrailer: string; equals?: string; exists?: boolean };
    if (!trailer.grpcTrailer?.trim()) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcTrailer`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcTrailer name is required',
      });
      return;
    }
    if (trailer.equals === undefined && trailer.exists === undefined) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcTrailer`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
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
        field: `grpcCallAction.assertions[${index}].grpcDuration`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcDuration requires min and/or max',
      });
    }
    return;
  }

  if (kind === 'grpcStreamLength') {
    const streamLength = (assertion as {
      grpcStreamLength: { equals?: number; min?: number; max?: number };
    }).grpcStreamLength;
    if (!STREAMING_CALL_TYPES.has(callType)) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStreamLength`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamLength assertions require a streaming callType',
      });
      return;
    }
    const hasEquals = Number.isFinite(streamLength?.equals);
    const hasMin = Number.isFinite(streamLength?.min);
    const hasMax = Number.isFinite(streamLength?.max);
    if (!hasEquals && !hasMin && !hasMax) {
      pushIssue(issues, {
        field: `grpcCallAction.assertions[${index}].grpcStreamLength`,
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'grpcStreamLength requires equals, min, and/or max',
      });
    }
  }
}

export function validateGrpcHarnessCallActionConfig(
  config: GrpcHarnessCallActionConfig,
): GrpcHarnessScenarioValidationResult {
  const issues: GrpcHarnessValidationIssue[] = [];
  const rulesCallType = resolveGrpcHarnessCallTypeForRules(config);
  const assertionCallType: GrpcCallType = rulesCallType ?? 'unary';

  if (config.callType !== undefined && !isKnownGrpcHarnessCallType(config.callType)) {
    pushIssue(issues, {
      field: 'grpcCallAction.callType',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_CALL_TYPE,
      message: 'callType must be unary, server_streaming, client_streaming, or bidi_streaming',
    });
  }

  if (!config.target?.trim()) {
    if (!config.connectionId?.trim()) {
      pushIssue(issues, {
        field: 'grpcCallAction.target',
        code: GRPC_HARNESS_VALIDATION_CODES.MISSING_TARGET,
        message: 'target or connectionId is required',
      });
    }
  } else if (!isValidGrpcHarnessTargetTemplate(config.target)) {
    pushIssue(issues, {
      field: 'grpcCallAction.target',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_TARGET,
      message: 'target must be a valid host:port or env template such as {{grpcHost}}',
    });
  }

  if (!config.descriptorKey?.trim()) {
    pushIssue(issues, {
      field: 'grpcCallAction.descriptorKey',
      code: GRPC_HARNESS_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY,
      message: 'descriptorKey is required',
    });
  }
  if (!config.service?.trim()) {
    pushIssue(issues, {
      field: 'grpcCallAction.service',
      code: GRPC_HARNESS_VALIDATION_CODES.MISSING_SERVICE,
      message: 'service is required',
    });
  }
  if (!config.method?.trim()) {
    pushIssue(issues, {
      field: 'grpcCallAction.method',
      code: GRPC_HARNESS_VALIDATION_CODES.MISSING_METHOD,
      message: 'method is required',
    });
  }

  validateTlsMode(config.tlsMode, issues);
  validateRetryPolicy(config.retry, issues);

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    pushIssue(issues, {
      field: 'grpcCallAction.timeoutMs',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_TIMEOUT,
      message: `timeoutMs must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`,
    });
  }

  if (config.metadata) {
    validateHarnessMetadataRecord(config.metadata, issues);
  }

  if (config.auth) {
    for (const authIssue of validateGrpcAuthForExecute(config.auth)) {
      pushIssue(issues, {
        field: authIssue.field ? `grpcCallAction.auth.${authIssue.field}` : 'grpcCallAction.auth',
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_AUTH,
        message: authIssue.message,
      });
    }
  }

  if (rulesCallType === 'unary' || rulesCallType === 'server_streaming') {
    if (!isPlainObject(config.body)) {
      pushIssue(issues, {
        field: 'grpcCallAction.body',
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_BODY,
        message: 'body must be a JSON object',
      });
    }
  } else if (rulesCallType !== null && config.body !== undefined && !isPlainObject(config.body)) {
    pushIssue(issues, {
      field: 'grpcCallAction.body',
      code: GRPC_HARNESS_VALIDATION_CODES.INVALID_BODY,
      message: 'body must be a JSON object when provided',
    });
  }

  if (rulesCallType === 'server_streaming' || rulesCallType === 'bidi_streaming') {
    validateCollectConfig(config.collect, issues);
  }

  if (rulesCallType === 'client_streaming' || rulesCallType === 'bidi_streaming') {
    validateSendMessages(config.sendMessages, issues);
  }

  if (config.assertions) {
    if (!Array.isArray(config.assertions)) {
      pushIssue(issues, {
        field: 'grpcCallAction.assertions',
        code: GRPC_HARNESS_VALIDATION_CODES.INVALID_ASSERTION,
        message: 'assertions must be an array',
      });
    } else {
      config.assertions.forEach((assertion, index) => {
        validateAssertionShape(assertion, issues, index, assertionCallType);
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validates a gRPC harness scenario configuration.
 *
 * HTTP, Kafka, and WebSocket scenarios return `{ valid: true, issues: [] }`.
 * Only scenarios with `actionType === 'grpcCall'` are validated.
 */
export function validateGrpcHarnessScenario(scenario: Scenario): GrpcHarnessScenarioValidationResult {
  const actionType = resolveGrpcHarnessActionType(scenario);
  if (actionType !== 'grpcCall') {
    return { valid: true, issues: [] };
  }
  if (!scenario.grpcCallAction) {
    return {
      valid: false,
      issues: [{
        field: 'grpcCallAction',
        code: GRPC_HARNESS_VALIDATION_CODES.MISSING_ACTION_CONFIG,
        message: 'grpcCallAction is required when actionType is "grpcCall"',
      }],
    };
  }
  return validateGrpcHarnessCallActionConfig(scenario.grpcCallAction);
}

/** Human-readable errors for import/run gates (Kafka/WS parity). Non-gRPC scenarios return `[]`. */
export function validateGrpcHarnessActionConfig(scenario: Scenario): string[] {
  return validateGrpcHarnessScenario(scenario).issues.map((issue) => issue.message);
}

export function hasGrpcHarnessScenarioConfigErrors(scenario: Scenario): boolean {
  if (!isGrpcHarnessScenario(scenario)) return false;
  return !validateGrpcHarnessScenario(scenario).valid;
}

export function summarizeGrpcHarnessScenarioValidation(scenario: Scenario): string {
  const result = validateGrpcHarnessScenario(scenario);
  if (result.valid) return '';
  return result.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ');
}
