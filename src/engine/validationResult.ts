/**
 * Shared helper for building the validation portion of a RequestResult.
 * Used by both requestExecution.ts (load testing) and graphRunnerHelpers.ts (workflow engine).
 */
import type { FailureDetail, ValidationConfig, Assertion, TransportType } from '../shared/types';
import { validate, evaluateAssertions } from './validator';

export interface ValidationInput {
  httpStatus: number;
  responseTimeMs: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseObj: unknown;
  errorMessage?: string;
  validation: ValidationConfig;
  assertions: Assertion[];
  /** Populated by kafkaExecution for `kafkaField` assertion evaluation. */
  kafkaContext?: {
    key?: string;
    offset?: number;
    partition?: number;
    topic?: string;
  };
  /** Populated by WS execution for `wsField` / `wsNumericField` assertion evaluation. */
  wsContext?: {
    connectionId?: string;
    frameType?: 'text' | 'binary';
    protocol?: string;
    messageSize?: number;
    latencyMs?: number;
    url?: string;
  };
  /**
   * Transport type. Absent or `'http'` means standard HTTP request.
   * When non-HTTP, the `(http)` failure check (status 0 / 4xx+) is skipped
   * because HTTP status codes are synthetic for non-HTTP transports.
   */
  transportType?: TransportType;
}

export interface ValidationOutput {
  failureDetails: FailureDetail[];
  passed: boolean;
  errorMessage?: string;
}

/**
 * Evaluate assertions + JSON validation and determine pass/fail.
 * Centralises the logic previously duplicated in requestExecution and graphRunnerHelpers.
 */
export function buildValidationResult(input: ValidationInput): ValidationOutput {
  const { httpStatus, responseTimeMs, responseHeaders, responseObj, validation, assertions } = input;
  const { errorMessage } = input;
  const isHttpTransport = !input.transportType || input.transportType === 'http';

  const { failures: assertionFailures, statusAsserted } = assertions.length > 0
    ? evaluateAssertions(assertions, {
        httpStatus, responseTimeMs, responseHeaders,
        responseBody: responseObj, rawBody: input.responseBody,
        kafkaContext: input.kafkaContext, wsContext: input.wsContext,
      })
    : { failures: [], statusAsserted: false };

  const httpOk = httpStatus > 0 && httpStatus < 400;
  const statusOk = statusAsserted
    ? assertionFailures.every(f => f.path !== '(status)')
    : httpOk;

  const jsonFailures = validation.mode !== 'none' && statusOk
    ? validate(validation, responseObj)
    : [];

  let failureDetails = [...assertionFailures, ...jsonFailures];

  // HTTP failure: status >= 400 or network error (status 0), AND no status assertion
  // explicitly accepted it. Only applies to HTTP transports — for Kafka and WS,
  // httpStatus is synthetic (200 on success, 0 on failure) and should not generate
  // an `(http)` failure detail.
  if (isHttpTransport) {
    const httpFailed = !statusAsserted && (httpStatus >= 400 || httpStatus === 0);
    if (httpFailed) {
      const actual = errorMessage
        || (httpStatus === 0 ? 'network error' : `HTTP ${httpStatus}`);
      failureDetails = [{ path: '(http)', expected: '2xx', actual }, ...assertionFailures];
    }
  }

  const networkError = isHttpTransport && httpStatus === 0 && !statusAsserted;
  const nonHttpError = !isHttpTransport && (!!errorMessage || httpStatus === 0);
  const passed = !networkError && !nonHttpError && failureDetails.length === 0;

  return { failureDetails, passed, errorMessage };
}
