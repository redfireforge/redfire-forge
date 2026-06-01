/**
 * Kafka action execution for the standard test runner (non-workflow).
 *
 * Produce and consume paths map `KafkaProduceActionConfig` / `KafkaConsumeActionConfig`
 * to the shared `KafkaNodeOperations` interface and return a `RequestResult` with
 * `transportType` and `kafkaResultMeta` populated.
 *
 * This file must NOT be imported by `requestExecution.ts`.  Executor wires it in
 * via the `RunOpts.executeNonHttp` callback to avoid circular dependencies.
 */
import type { Scenario, RequestResult, KafkaResultMeta } from '../shared/types';
import type { KafkaNodeOperations } from '../features/workflow/engine/graphRunnerNodeHandlerContext';
import { nextResultId, buildErrorResult } from './requestExecution';
import { buildValidationResult } from './validationResult';
import { toErrorMessage } from '../shared/utils/helpers';
import { resolveKafkaActionType } from '../shared/utils/kafkaScenarioDefaults';
import { classifyKafkaFailure } from '../features/workflow/engine/graphRunnerKafkaNodeHandlers';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Execute a Kafka produce or consume action and return a `RequestResult`.
 * Called by `executor.ts` via `RunOpts.executeNonHttp`.
 */
export async function executeKafkaAction(
  scenario: Scenario,
  kafkaOps: KafkaNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const actionType = resolveKafkaActionType(scenario);
  if (actionType === 'kafkaProduce') return executeKafkaProduce(scenario, kafkaOps, timeoutMs);
  if (actionType === 'kafkaConsume') return executeKafkaConsume(scenario, kafkaOps, timeoutMs);
  // Fallback — should never be reached for validated Kafka scenarios
  return buildErrorResult(scenario, new Error(`Unsupported Kafka actionType: '${actionType}'`));
}

// ---------------------------------------------------------------------------
// Produce
// ---------------------------------------------------------------------------

async function executeKafkaProduce(
  scenario: Scenario,
  kafkaOps: KafkaNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const cfg = scenario.kafkaProduceAction!;
  const id = nextResultId();
  const start = performance.now();

  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let errorMessage: string | undefined;
  let kafkaResultMeta: KafkaResultMeta | undefined;

  try {
    const result = await kafkaOps.produce({
      clusterId: cfg.clusterId,
      topic: cfg.topic,
      key: cfg.key,
      value: cfg.value ?? '',
      partition: cfg.partition,
      headers: cfg.headers,
      ackMode: cfg.acks !== undefined ? String(cfg.acks) : undefined,
      timeoutMs: cfg.timeoutMs ?? timeoutMs ?? 5_000,
    });

    httpStatus = 200;
    responseBody = cfg.value ?? '';
    responseObj = parseJsonSafe(responseBody);
    kafkaResultMeta = {
      topic: result.topic,
      partition: result.partition,
      offset: parseInt(result.offset, 10),
      key: cfg.key,
      headers: cfg.headers,
    };
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
    const failureClass = classifyKafkaFailure(errorMessage);
    if (failureClass !== 'network') {
      errorMessage = `[${failureClass}] ${errorMessage}`;
    }
  }

  const responseTimeMs = roundMs(performance.now() - start);
  const kafkaContext = kafkaResultMeta ? toKafkaContext(kafkaResultMeta) : undefined;

  const vr = buildValidationResult({
    httpStatus,
    responseTimeMs,
    responseHeaders: cfg.headers ?? {},
    responseBody,
    responseObj,
    errorMessage,
    validation: scenario.validation,
    assertions: scenario.validation.assertions ?? [],
    kafkaContext,
  });

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    featureGroupName: scenario.featureGroupName,
    groupName: scenario.groupName,
    url: scenario.url,
    method: scenario.method,
    httpStatus,
    responseTimeMs,
    responseBody,
    responseHeaders: cfg.headers ?? {},
    timestamp: Date.now(),
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: vr.errorMessage,
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
    scenarioTags: scenario.scenarioTags,
    transportType: 'kafkaProduce',
    kafkaResultMeta,
  };
}

// ---------------------------------------------------------------------------
// Consume
// ---------------------------------------------------------------------------

async function executeKafkaConsume(
  scenario: Scenario,
  kafkaOps: KafkaNodeOperations,
  timeoutMs?: number,
): Promise<RequestResult> {
  const cfg = scenario.kafkaConsumeAction!;
  const id = nextResultId();
  const start = performance.now();

  let httpStatus = 0;
  let responseBody = '';
  let responseObj: unknown = null;
  let responseHeaders: Record<string, string> = {};
  let errorMessage: string | undefined;
  let kafkaResultMeta: KafkaResultMeta | undefined;

  try {
    const headerFilters = cfg.filter?.headersMatch
      ? Object.entries(cfg.filter.headersMatch).map(([key, value]) => ({ key, value }))
      : undefined;

    const jsonPathFilters = cfg.filter?.jsonPath
      ? [{ jsonPath: cfg.filter.jsonPath, expectedValue: cfg.filter.jsonEquals }]
      : undefined;

    const messages = await kafkaOps.consume({
      clusterId: cfg.clusterId,
      topic: cfg.topic,
      maxMessages: cfg.maxMessages ?? 1,
      timeoutMs: cfg.timeoutMs ?? timeoutMs ?? 10_000,
      startPosition: cfg.fromBeginning ? 'earliest' : 'latest',
      keyRegex: cfg.filter?.keyEquals
        ? '^' + cfg.filter.keyEquals.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'
        : undefined,
      headerFilters: headerFilters?.length ? headerFilters : undefined,
      jsonPathFilters: jsonPathFilters?.length ? jsonPathFilters : undefined,
    });

    if (messages.length === 0) {
      httpStatus = 0;
      errorMessage = 'No messages received within timeout';
    } else {
      const msg = messages[0];
      httpStatus = 200;
      responseBody = msg.value;
      responseHeaders = msg.headers ?? {};
      responseObj = parseJsonSafe(responseBody);
      kafkaResultMeta = {
        topic: msg.topic,
        partition: msg.partition,
        offset: parseInt(msg.offset, 10),
        key: msg.key,
        headers: msg.headers,
        matchedMessages: messages.length,
      };
    }
  } catch (err) {
    httpStatus = 0;
    errorMessage = toErrorMessage(err);
    // Classify error type (auth/tls/timeout/network) and surface it
    const failureClass = classifyKafkaFailure(errorMessage);
    if (failureClass !== 'network') {
      // Prefix with class so the error is actionable in the results UI
      errorMessage = `[${failureClass}] ${errorMessage}`;
    }
  }

  const responseTimeMs = roundMs(performance.now() - start);
  const kafkaContext = kafkaResultMeta ? toKafkaContext(kafkaResultMeta) : undefined;

  const vr = buildValidationResult({
    httpStatus,
    responseTimeMs,
    responseHeaders,
    responseBody,
    responseObj,
    errorMessage,
    validation: scenario.validation,
    assertions: scenario.validation.assertions ?? [],
    kafkaContext,
  });

  return {
    id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    featureGroupName: scenario.featureGroupName,
    groupName: scenario.groupName,
    url: scenario.url,
    method: scenario.method,
    httpStatus,
    responseTimeMs,
    responseBody: responseBody.slice(0, 10_000),
    responseHeaders,
    timestamp: Date.now(),
    passed: vr.passed,
    validationMode: scenario.validation.mode,
    failureDetails: vr.failureDetails,
    errorMessage: vr.errorMessage,
    dataRowId: scenario.dataRowId,
    dataRowLabel: scenario.dataRowLabel,
    scenarioTags: scenario.scenarioTags,
    transportType: 'kafkaConsume',
    kafkaResultMeta,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonSafe(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function toKafkaContext(meta: KafkaResultMeta): { key?: string; offset?: number; partition?: number; topic?: string } {
  return {
    key: meta.key,
    offset: meta.offset,
    partition: meta.partition,
    topic: meta.topic,
  };
}
