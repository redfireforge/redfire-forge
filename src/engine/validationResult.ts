/**
 * Shared helper for building the validation portion of a RequestResult.
 * Used by both requestExecution.ts (load testing) and graphRunnerHelpers.ts (workflow engine).
 */
import type { FailureDetail, ValidationConfig, Assertion } from '../shared/types';
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

  const { failures: assertionFailures, statusAsserted } = assertions.length > 0
    ? evaluateAssertions(assertions, { httpStatus, responseTimeMs, responseHeaders, responseBody: responseObj, rawBody: input.responseBody })
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
  // explicitly accepted it. Always record this — independent of whether `errorMessage`
  // was supplied — so the workflow engine and the runner agree on pass/fail (the runner
  // pre-populates `errorMessage` from the response body, the workflow engine does not).
  const httpFailed = !statusAsserted && (httpStatus >= 400 || httpStatus === 0);
  if (httpFailed) {
    const actual = errorMessage
      || (httpStatus === 0 ? 'network error' : `HTTP ${httpStatus}`);
    failureDetails = [{ path: '(http)', expected: '2xx', actual }, ...assertionFailures];
  }

  const networkError = httpStatus === 0 && !statusAsserted;
  const passed = !networkError && failureDetails.length === 0;

  return { failureDetails, passed, errorMessage };
}
