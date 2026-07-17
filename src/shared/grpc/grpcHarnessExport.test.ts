/**
 * Phase 8H — gRPC harness export redaction tests.
 */
import { describe, expect, it } from 'vitest';
import type { GrpcCallType } from './contracts';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';
import type { GrpcHarnessResult } from '../types/grpc-harness-result';
import type { RequestResult } from '../types';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  formatGrpcHarnessResultSummaryForExport,
  prepareGrpcHarnessResultReportExport,
  redactGrpcHarnessRequestResultForExport,
  redactGrpcHarnessResultForExport,
  redactGrpcHarnessRunnerArtifactsForExport,
  sanitizeGrpcHarnessDiagnosticText,
} from './grpcHarnessExport';
import { detectGrpcSecretLikeString } from './grpcSecretLeakScan';
import { scanForbiddenGrpcPersistTargets } from './grpcSecretLeakScan';
import { buildGrpcHarnessResult } from './grpcHarnessResultBuilder';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';

const SECRET_TOKEN = 'super-secret-token-value-should-never-export';
const BEARER = `Bearer ${SECRET_TOKEN}`;
const VALID_PEM = `-----BEGIN CERTIFICATE-----
LEAKED-CA
-----END CERTIFICATE-----`;

const AUTH = { type: 'bearer' as const, bearerToken: SECRET_TOKEN };

function outcomeForCallType(callType: GrpcCallType): GrpcHarnessCallOutcome {
  const base = {
    passed: true,
    grpcStatus: 0,
    grpcStatusMessage: 'OK',
    durationMs: 12,
    attempts: 1,
    trailers: {
      authorization: BEARER,
      'x-api-key': SECRET_TOKEN,
      'grpc-trace-bin': 'c2VjcmV0',
    },
  };
  switch (callType) {
    case 'unary':
      return {
        ...base,
        callType,
        body: { message: 'hello', bearerToken: SECRET_TOKEN },
      };
    case 'server_streaming':
      return {
        ...base,
        callType,
        messages: [{ n: 1, apiKey: SECRET_TOKEN }],
      };
    case 'client_streaming':
      return {
        ...base,
        callType,
        body: { message: 'terminal', clientSecret: SECRET_TOKEN },
      };
    case 'bidi_streaming':
      return {
        ...base,
        callType,
        messages: [{ n: 1, password: SECRET_TOKEN }],
      };
    default:
      return { ...base, callType: 'unary', body: { message: 'hello' } };
  }
}

function harnessResultForCallType(callType: GrpcCallType): GrpcHarnessResult {
  return buildGrpcHarnessResult({
    scenarioId: 'sc-1',
    callType,
    durationMs: 12,
    transportOutcome: outcomeForCallType(callType),
    assertionResults: [{
      name: 'grpcTrailer:authorization',
      passed: false,
      message: `assertions[0]: trailer authorization expected "ok", got "${BEARER}"`,
    }],
    assertionsPassed: false,
    validationPassed: true,
    harnessAssertionsConfigured: true,
  });
}

function requestResultForCallType(callType: GrpcCallType): RequestResult {
  const harnessResult = harnessResultForCallType(callType);
  const responseBody = callType === 'unary' || callType === 'client_streaming'
    ? JSON.stringify(harnessResult.body, null, 2)
    : JSON.stringify(harnessResult.messages, null, 2);
  return {
    id: 'r-1',
    scenarioId: 'sc-1',
    scenarioName: 'Echo',
    url: 'grpc://localhost:50051/echo.EchoService/Echo',
    method: callType.toUpperCase(),
    httpStatus: 200,
    responseTimeMs: 12,
    responseBody,
    responseHeaders: { authorization: BEARER },
    timestamp: Date.now(),
    passed: false,
    validationMode: 'none',
    failureDetails: [{
      path: '(grpcAssertion)',
      expected: 'pass',
      actual: `assertions[0]: got ${BEARER}`,
    }],
    errorMessage: `assertions[0]: trailer authorization expected "ok", got "${BEARER}"`,
    transportType: 'grpcCall',
    grpcResultMeta: {
      service: 'echo.EchoService',
      method: 'Echo',
      target: 'localhost:50051',
      harnessResult,
      assertionFailures: [`assertions[0]: trailer authorization expected "ok", got "${BEARER}"`],
      errorCategory: 'assertion',
    },
    requestLog: {
      headers: { authorization: BEARER },
      body: JSON.stringify({ bearerToken: SECRET_TOKEN }),
    },
  };
}

describe('sanitizeGrpcHarnessDiagnosticText (Phase 8H)', () => {
  it('masks bearer tokens and PEM blocks in diagnostic strings', () => {
    const sanitized = sanitizeGrpcHarnessDiagnosticText(
      `transport failed: ${BEARER} with cert ${VALID_PEM}`,
    );
    expect(sanitized).not.toContain(SECRET_TOKEN);
    expect(sanitized).toContain('Bearer [REDACTED]');
    expect(sanitized).toContain('[REDACTED_PEM]');
  });
});

describe('redactGrpcHarnessResultForExport (Phase 8H)', () => {
  const callTypes: GrpcCallType[] = [
    'unary',
    'server_streaming',
    'client_streaming',
    'bidi_streaming',
  ];

  it.each(callTypes)('redacts trailers, payloads, and assertion messages for %s', (callType) => {
    const redacted = redactGrpcHarnessResultForExport(harnessResultForCallType(callType), AUTH);
    expect(redacted.schemaVersion).toBe(GRPC_HARNESS_RESULT_SCHEMA_VERSION);
    expect(redacted.trailers?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.trailers?.['x-api-key']).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(redacted)).not.toContain(SECRET_TOKEN);
    expect(redacted.assertionResults[0]?.message).not.toContain(SECRET_TOKEN);
    expect(redacted.assertionResults[0]?.message).toContain('Bearer [REDACTED]');
  });

  it('sanitizes grpcStatusMessage on harness result export', () => {
    const raw = harnessResultForCallType('unary');
    raw.grpcStatusMessage = BEARER;
    const redacted = redactGrpcHarnessResultForExport(raw, AUTH);
    expect(redacted.grpcStatusMessage).not.toContain(SECRET_TOKEN);
    expect(redacted.grpcStatusMessage).toContain('Bearer [REDACTED]');
  });
});

describe('redactGrpcHarnessRequestResultForExport (Phase 8H)', () => {
  const callTypes: GrpcCallType[] = [
    'unary',
    'server_streaming',
    'client_streaming',
    'bidi_streaming',
  ];

  it.each(callTypes)('redacts harness RequestResult rows for %s', (callType) => {
    const redacted = redactGrpcHarnessRequestResultForExport(
      requestResultForCallType(callType),
      AUTH,
    );
    expect(redacted.responseHeaders?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.requestLog?.headers.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.grpcResultMeta?.harnessResult?.trailers?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(redacted)).not.toContain(SECRET_TOKEN);
    expect(redacted.errorMessage).not.toContain(SECRET_TOKEN);
  });

  it('passes through non-gRPC RequestResult rows unchanged', () => {
    const httpResult: RequestResult = {
      id: 'http-1',
      scenarioId: 'sc-http',
      scenarioName: 'HTTP',
      url: 'http://example.com',
      method: 'GET',
      httpStatus: 200,
      responseTimeMs: 5,
      responseBody: '{"ok":true}',
      timestamp: Date.now(),
      passed: true,
      validationMode: 'none',
      failureDetails: [],
      transportType: 'http',
    };
    expect(redactGrpcHarnessRequestResultForExport(httpResult)).toBe(httpResult);
  });

  it('redacts grpc workflow rows with grpcResultMeta but no harnessResult', () => {
    const secret = 'workflow-grpc-unary-secret-token';
    const workflowBearer = `Bearer ${secret}`;
    const result: RequestResult = {
      id: 'wf-1',
      scenarioId: 'wf-node',
      scenarioName: 'gRPC Unary',
      url: 'grpc://localhost:50051/svc/m',
      method: 'UNARY',
      httpStatus: 0,
      responseTimeMs: 8,
      responseBody: '',
      responseHeaders: { authorization: workflowBearer },
      timestamp: Date.now(),
      passed: false,
      validationMode: 'none',
      failureDetails: [],
      errorMessage: `status ${workflowBearer}`,
      transportType: 'grpcUnary',
      grpcResultMeta: {
        service: 'svc',
        method: 'm',
        target: 'localhost:50051',
        grpcStatusMessage: workflowBearer,
        assertionFailures: [`expected ok, got ${workflowBearer}`],
      },
    };
    const redacted = redactGrpcHarnessRequestResultForExport(result);
    expect(JSON.stringify(redacted)).not.toContain(secret);
    expect(redacted.grpcResultMeta?.grpcStatusMessage).toContain('Bearer [REDACTED]');
  });

  it('redacts authorization headers without auth config via heuristics', () => {
    const redacted = redactGrpcHarnessRequestResultForExport(requestResultForCallType('unary'));
    expect(redacted.responseHeaders?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(redacted)).not.toContain(SECRET_TOKEN);
  });

  it('redacts bearer values in non-secret header names even when auth is provided', () => {
    const leakedBearer = `Bearer ${SECRET_TOKEN}`;
    const result = requestResultForCallType('unary');
    result.responseHeaders = {
      ...result.responseHeaders,
      'x-trace-id': leakedBearer,
    };
    const redacted = redactGrpcHarnessRequestResultForExport(result, AUTH);
    expect(redacted.responseHeaders?.['x-trace-id']).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(redacted)).not.toContain(SECRET_TOKEN);
  });

  it('redacts bearer values in mixed-case non-secret header names', () => {
    const leakedBearer = `Bearer ${SECRET_TOKEN}`;
    const result = requestResultForCallType('unary');
    result.responseHeaders = { 'X-Trace-Id': leakedBearer };
    const redacted = redactGrpcHarnessRequestResultForExport(result, AUTH);
    expect(redacted.responseHeaders?.['x-trace-id']).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(redacted)).not.toContain(SECRET_TOKEN);
  });

  it('sanitizes failureDetails expected values that embed secrets', () => {
    const result = requestResultForCallType('unary');
    result.failureDetails = [{
      path: '$.token',
      expected: BEARER,
      actual: 'mismatch',
    }];
    const redacted = redactGrpcHarnessRequestResultForExport(result, AUTH);
    expect(redacted.failureDetails[0]?.expected).toContain('Bearer [REDACTED]');
    expect(JSON.stringify(redacted.failureDetails)).not.toContain(SECRET_TOKEN);
  });

  it('sanitizes failureDetails actual values that embed secrets', () => {
    const result = requestResultForCallType('unary');
    result.failureDetails = [{
      path: '$.token',
      expected: 'ok',
      actual: BEARER,
    }];
    const redacted = redactGrpcHarnessRequestResultForExport(result, AUTH);
    expect(redacted.failureDetails[0]?.actual).toContain('Bearer [REDACTED]');
    expect(JSON.stringify(redacted.failureDetails)).not.toContain(SECRET_TOKEN);
  });

  it('is idempotent when redacted twice', () => {
    const once = redactGrpcHarnessRequestResultForExport(requestResultForCallType('unary'), AUTH);
    const twice = redactGrpcHarnessRequestResultForExport(once, AUTH);
    expect(twice).toEqual(once);
  });
});

describe('formatGrpcHarnessResultSummaryForExport (Phase 8H)', () => {
  it('never embeds raw secrets in export summary lines', () => {
    const summary = formatGrpcHarnessResultSummaryForExport(
      harnessResultForCallType('unary'),
      AUTH,
    );
    expect(summary).not.toContain(SECRET_TOKEN);
    expect(summary).toContain('Bearer [REDACTED]');
  });
});

describe('detectGrpcSecretLikeString (Phase 8H)', () => {
  it('detects bearer, basic, and PEM patterns', () => {
    expect(detectGrpcSecretLikeString(BEARER)).toBe(true);
    expect(detectGrpcSecretLikeString('Basic abcdefghijklmnop==')).toBe(true);
    expect(detectGrpcSecretLikeString(VALID_PEM)).toBe(true);
    expect(detectGrpcSecretLikeString('hello')).toBe(false);
  });
});

describe('prepareGrpcHarnessResultReportExport (Phase 8H)', () => {
  it('passes forbidden-target leak scan for harness result report bundle', () => {
    const report = prepareGrpcHarnessResultReportExport({
      scenarioName: 'Echo',
      result: requestResultForCallType('unary'),
      auth: AUTH,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(report.kind).toBe('grpc_harness_result_report');
    expect(JSON.stringify(report)).not.toContain(SECRET_TOKEN);
    const findings = scanForbiddenGrpcPersistTargets({
      harness_result_export: report,
    });
    expect(findings).toHaveLength(0);
  });

  it('redacts raw unredacted results and snapshot secrets in one bundle', async () => {
    const { buildGrpcHarnessExecuteSnapshot } = await import('./grpcHarnessSnapshotBuilder');
    const { FIXTURE_DESCRIPTOR_KEY } = await import('./contractFixtures');
    const { makeScenario: makeTestScenario } = await import('../../test-utils/factories');
    const scenario = makeTestScenario({
      id: 'grpc-export',
      name: 'Harness export',
      url: '',
      method: 'GRPC',
      actionType: 'grpcCall',
      grpcCallAction: {
        callType: 'unary',
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hi' },
        auth: { type: 'bearer', bearerToken: SECRET_TOKEN },
        metadata: { authorization: BEARER },
      },
    });
    const harnessSnapshot = buildGrpcHarnessExecuteSnapshot(
      { scenario, requestId: 'req-export', capturedAt: '2026-01-01T00:00:00.000Z' },
      {
        resolveTemplate: (value) => value,
        profiles: [],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    );
    const report = prepareGrpcHarnessResultReportExport({
      scenarioName: 'Harness export',
      snapshot: harnessSnapshot,
      result: requestResultForCallType('unary'),
      auth: AUTH,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(report.snapshot?.snapshot.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(JSON.stringify(report)).not.toContain(SECRET_TOKEN);
    expect(scanForbiddenGrpcPersistTargets({ harness_result_export: report })).toHaveLength(0);
  });
});

describe('redactGrpcHarnessRunnerArtifactsForExport (Phase 8H)', () => {
  it('redacts only grpc harness rows in mixed runner batches', () => {
    const httpResult: RequestResult = {
      id: 'http-1',
      scenarioId: 'sc-http',
      scenarioName: 'HTTP',
      url: 'http://example.com',
      method: 'GET',
      httpStatus: 200,
      responseTimeMs: 5,
      responseBody: '{"token":"visible-in-http"}',
      timestamp: Date.now(),
      passed: true,
      validationMode: 'none',
      failureDetails: [],
    };
    const grpcResult = requestResultForCallType('server_streaming');
    const redacted = redactGrpcHarnessRunnerArtifactsForExport([httpResult, grpcResult], new Map([
      ['sc-1', AUTH],
    ]));
    expect(redacted[0]).toBe(httpResult);
    expect(JSON.stringify(redacted[1])).not.toContain(SECRET_TOKEN);
    const findings = scanForbiddenGrpcPersistTargets({ runner_artifacts: [redacted[1]!] });
    expect(findings).toHaveLength(0);
  });
});
