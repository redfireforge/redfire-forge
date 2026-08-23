/**
 * Phase 8I — Acceptance checklist traceability (hardening gate).
 *
 * Each describe block maps to one Phase 8 acceptance checklist item.
 * Tests use mocked transport — no live Docker/gRPC server required.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Scenario } from '../types';
import { makeScenario as _makeScenario } from '@test-utils/factories';
import { expandDataSource } from '@engine/dataSourceExpander';
import { executeGrpcAction } from '@engine/grpcExecution';
import { executeGrpcHarnessScenario } from './grpcHarnessExecutor';
import type { GrpcHarnessOperations } from './buildGrpcHarnessOperations';
import { executeGrpcHarnessBidiStream, collectGrpcHarnessServerStream } from './grpcHarnessStreamCollector';
import {
  evaluateGrpcHarnessAssertions,
  evaluateGrpcHarnessAssertionsDetailed,
} from './grpcHarnessAssertEngine';
import {
  GRPC_INT64_MAX,
  GRPC_UINT64_MAX,
} from './grpcHarnessNumericCompare';
import { buildGrpcHarnessRowTraceKey } from './grpcHarnessRowIdentity';
import { prepareGrpcHarnessResultReportExport } from './grpcHarnessExport';
import { scanForbiddenGrpcPersistTargets } from './grpcSecretLeakScan';
import { GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS } from './grpcSecretPolicy';
import {
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_SERVER_STREAM_START_REQUEST,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import type { GrpcStreamEvent } from './contracts';
import { GRPC_HARNESS_RESULT_SCHEMA_VERSION } from '../types/grpc-harness-result';
import { resolveGrpcHarnessResultStatus } from './grpcHarnessResultBuilder';
import { GrpcApiClientError } from './grpcApiClient';

const BUILD_CONTEXT = {
  resolveTemplate: (value: string) => value,
  profiles: [],
  pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' as const },
};

function grpcScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 'grpc-8i',
    name: 'Harness echo',
    url: '',
    method: 'GRPC',
    actionType: 'grpcCall',
    grpcCallAction: {
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target.address,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: { message: 'hello' },
    },
    ...overrides,
  }) as Scenario;
}

function mockHarnessOps(overrides: Partial<GrpcHarnessOperations> = {}): GrpcHarnessOperations {
  return {
    invokeUnary: vi.fn(async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'ok' },
      durationMs: 5,
    })),
    collectHarnessServerStream: vi.fn(async () => ({
      callType: 'server_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      attempts: 1,
      messages: [{ message: 'stream' }],
    })),
    executeClientStream: vi.fn(async () => ({
      callType: 'client_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      attempts: 1,
      body: { message: 'client' },
    })),
    executeBidiStream: vi.fn(async () => ({
      callType: 'bidi_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      attempts: 1,
      messages: [{ message: 'bidi' }],
    })),
    ...overrides,
  };
}

function makeGrpcExecutionOps() {
  return {
    invokeUnary: async () => ({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'hello' },
      durationMs: 5,
    }),
    collectHarnessServerStream: async () => ({
      callType: 'server_streaming' as const,
      passed: true,
      durationMs: 1,
      attempts: 1,
    }),
    executeClientStream: async () => ({
      callType: 'client_streaming' as const,
      passed: true,
      durationMs: 1,
      attempts: 1,
    }),
    executeBidiStream: async () => ({
      callType: 'bidi_streaming' as const,
      passed: true,
      durationMs: 1,
      attempts: 1,
    }),
  };
}

function makeStreamDeps(events: GrpcStreamEvent[]) {
  const cancelStream = vi.fn(async () => undefined);
  const startStream = vi.fn(async () => ({
    data: { streamId: 'stream-1', requestId: 'req-1' },
  }));
  const sendStreamMessage = vi.fn(async () => undefined);
  const endStream = vi.fn(async () => undefined);
  const openStreamEvents = vi.fn((_streamId: string, _tabId: string, handlers: {
    onEvent: (event: GrpcStreamEvent) => void;
  }) => {
    queueMicrotask(() => {
      for (const event of events) {
        handlers.onEvent(event);
      }
    });
    return () => undefined;
  });
  return { startStream, sendStreamMessage, endStream, cancelStream, openStreamEvents };
}

describe('Phase 8I deliverables', () => {
  it('exports gate scripts and documentation paths', async () => {
    const fs = await import('fs/promises');
    const read = (rel: string) =>
      fs.access(new URL(rel, import.meta.url)).then(() => true);
    await expect(read('../../../scripts/test-grpc-phase8i.sh')).resolves.toBe(true);
    await expect(read('../../../scripts/test-grpc-phase8.sh')).resolves.toBe(true);
    await expect(read('../../../docs/guides/grpc-phase8-runbook.md')).resolves.toBe(true);
    await expect(read('../../../docs/guides/grpc-phase8-validation-report.md')).resolves.toBe(true);
  });

  it('registers npm gate scripts for phase 8I and full phase 8', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase8i']).toContain('test-grpc-phase8i.sh');
    expect(pkg.scripts?.['test:grpc:phase8']).toContain('test-grpc-phase8.sh');
  });

  it('retains sub-phase acceptance files for granular traceability', async () => {
    const fs = await import('fs/promises');
    const phases = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
    for (const phase of phases) {
      await expect(
        fs.access(new URL(`./grpcPhase8${phase}Acceptance.test.ts`, import.meta.url)),
      ).resolves.toBeUndefined();
    }
  });
});

// ─── Checklist 1: unified harness adapter + explicit callType ───────────────

describe('Phase 8I acceptance — checklist-1: unified harness adapter', () => {
  const callTypes = [
    'unary',
    'server_streaming',
    'client_streaming',
    'bidi_streaming',
  ] as const;

  it.each(callTypes)('executeGrpcHarnessScenario dispatches %s with explicit callType', async (callType) => {
    const ops = mockHarnessOps();
    const scenario = grpcScenario({
      grpcCallAction: {
        callType,
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: callType === 'unary' ? 'Echo' : 'Stream',
        body: { message: 'hi' },
        ...(callType === 'server_streaming' || callType === 'bidi_streaming'
          ? { collect: { maxMessages: 3 } }
          : {}),
        ...(callType === 'client_streaming' || callType === 'bidi_streaming'
          ? { sendMessages: [{ message: 'one' }] }
          : {}),
      },
    });

    const outcome = await executeGrpcHarnessScenario(scenario, {
      operations: ops,
      buildContext: BUILD_CONTEXT,
    });
    expect(outcome.callType).toBe(callType);
    expect(outcome.passed).toBe(true);
    if (callType === 'unary') {
      expect(ops.invokeUnary).toHaveBeenCalledTimes(1);
      expect(ops.collectHarnessServerStream).not.toHaveBeenCalled();
      expect(ops.executeClientStream).not.toHaveBeenCalled();
      expect(ops.executeBidiStream).not.toHaveBeenCalled();
    } else if (callType === 'server_streaming') {
      expect(ops.collectHarnessServerStream).toHaveBeenCalledTimes(1);
      expect(ops.collectHarnessServerStream).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ maxMessages: 3 }),
        expect.any(Object),
      );
      expect(ops.invokeUnary).not.toHaveBeenCalled();
    } else if (callType === 'client_streaming') {
      expect(ops.executeClientStream).toHaveBeenCalledTimes(1);
      expect(ops.invokeUnary).not.toHaveBeenCalled();
    } else {
      expect(ops.executeBidiStream).toHaveBeenCalledTimes(1);
      expect(ops.executeBidiStream).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ maxMessages: 3 }),
        expect.any(Object),
      );
      expect(ops.invokeUnary).not.toHaveBeenCalled();
    }
  });

  it('grpcExecution publishes transportType grpcCall for harness scenarios', async () => {
    const result = await executeGrpcAction(grpcScenario(), makeGrpcExecutionOps());
    expect(result.transportType).toBe('grpcCall');
    expect(result.grpcResultMeta?.service).toBeTruthy();
  });

  it('executeGrpcAction resolves profile-only target via runtimeOverrides.profiles', async () => {
    const ops = mockHarnessOps();
    const scenario = grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '',
        connectionId: 'profile-a',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hi' },
      },
    });
    const result = await executeGrpcAction(scenario, ops, {
      runtimeOverrides: {
        profiles: [{
          id: 'profile-a',
          name: 'Echo profile',
          target: 'profile-host:50052',
          tlsMode: 'disabled',
        }],
        pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      },
    });
    expect(result.passed).toBe(true);
    expect(result.grpcResultMeta?.target).toBe('profile-host:50052');
    expect(ops.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ address: 'profile-host:50052' }),
      }),
      expect.any(String),
    );
  });
});

// ─── Checklist 2: bounded stream collection windows ─────────────────────────

describe('Phase 8I acceptance — checklist-2: bounded stream collection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('bidi stream collector stops at maxMessages bound', async () => {
    const deps = makeStreamDeps([
      { type: 'grpc-message', direction: 'inbound', data: { message: 'a' } },
      { type: 'grpc-message', direction: 'inbound', data: { message: 'b' } },
    ]);
    const outcome = await executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      [{ message: 'ping' }],
      { maxMessages: 2 },
      { deps },
    );
    expect(outcome.streamStopReason).toBe('max_messages');
    expect(outcome.messages).toHaveLength(2);
    expect(deps.cancelStream).toHaveBeenCalledTimes(1);
  });

  it('bidi stream collector stops at maxDurationMs bound', async () => {
    vi.useFakeTimers();
    const deps = makeStreamDeps([]);
    const outcomePromise = executeGrpcHarnessBidiStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      [{ message: 'ping' }],
      { maxDurationMs: 50 },
      { deps },
    );
    await vi.advanceTimersByTimeAsync(50);
    const outcome = await outcomePromise;
    expect(outcome.streamStopReason).toBe('max_duration');
    expect(deps.cancelStream).toHaveBeenCalledTimes(1);
  });

  it('server stream collector forwards maxMessages bound to workflow collector', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      durationMs: 8,
      messages: [{ message: 'a' }, { message: 'b' }],
      trailers: {},
      stopReason: 'max_messages' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      { maxMessages: 3 },
      { deps: { collectServerStream } },
    );
    expect(collectServerStream).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      { maxMessages: 3 },
      expect.objectContaining({ abortSignal: undefined }),
    );
    expect(outcome.callType).toBe('server_streaming');
    expect(outcome.streamStopReason).toBe('max_messages');
    expect(outcome.messages).toHaveLength(2);
  });

  it('server stream collector forwards maxDurationMs bound to workflow collector', async () => {
    const collectServerStream = vi.fn(async () => ({
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      durationMs: 52,
      messages: [],
      trailers: {},
      stopReason: 'max_duration' as const,
    }));
    const outcome = await collectGrpcHarnessServerStream(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      { maxDurationMs: 50 },
      { deps: { collectServerStream } },
    );
    expect(collectServerStream).toHaveBeenCalledWith(
      FIXTURE_SERVER_STREAM_START_REQUEST,
      'harness:grpc-8i',
      { maxDurationMs: 50 },
      expect.objectContaining({ abortSignal: undefined }),
    );
    expect(outcome.callType).toBe('server_streaming');
    expect(outcome.streamStopReason).toBe('max_duration');
  });

  it('grpcStreamField assertions evaluate against collected message snapshots', () => {
    const outcome = {
      callType: 'server_streaming' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 8,
      attempts: 1,
      messages: [{ n: 1, text: 'first' }, { n: 2, text: 'second' }],
    };
    const assertOutcome = evaluateGrpcHarnessAssertions(outcome, [{
      grpcStreamField: '$.text',
      index: 1,
      equals: 'second',
    }]);
    expect(assertOutcome.passed).toBe(true);
  });
});

// ─── Checklist 3: int64/uint64 string-safe comparisons ────────────────────

describe('Phase 8I acceptance — checklist-3: int64/uint64 assertions', () => {
  it('grpcNumericField compares int64 max without precision loss', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: { id: String(GRPC_INT64_MAX) },
      attempts: 1,
    };
    const result = evaluateGrpcHarnessAssertions(outcome, [{
      grpcNumericField: '$.id',
      operator: '==',
      value: String(GRPC_INT64_MAX),
    }]);
    expect(result.passed).toBe(true);
  });

  it('grpcNumericField compares uint64 max without precision loss', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: { id: String(GRPC_UINT64_MAX) },
      attempts: 1,
    };
    const result = evaluateGrpcHarnessAssertions(outcome, [{
      grpcNumericField: '$.id',
      operator: '==',
      value: String(GRPC_UINT64_MAX),
    }]);
    expect(result.passed).toBe(true);
  });
});

// ─── Checklist 4: failure categorization ────────────────────────────────────

describe('Phase 8I acceptance — checklist-4: failure categorization', () => {
  it('classifies harness assertion failures as assertion category', async () => {
    const result = await executeGrpcAction(grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
        assertions: [{ grpcField: '$.message', equals: 'wrong' }],
      },
    }), {
      ...makeGrpcExecutionOps(),
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 5,
      }),
    });
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('failed');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('assertion');
    expect(result.grpcResultMeta?.errorCategory).toBe('assertion');
  });

  it('classifies snapshot/template failures as serialization category', async () => {
    const result = await executeGrpcAction(grpcScenario({
      grpcCallAction: {
        callType: 'unary',
        target: '{{missingHost}}',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: 'hello' },
      },
    }), makeGrpcExecutionOps(), { grpcHarnessEnv: {} });
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('error');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('serialization');
    expect(result.grpcResultMeta?.errorCategory).toBe('serialization');
  });

  it('classifies gRPC status 4 (DEADLINE_EXCEEDED) as timeout', () => {
    expect(resolveGrpcHarnessResultStatus({
      transportPassed: false,
      grpcStatus: 4,
      assertionsPassed: true,
      validationPassed: true,
    })).toBe('timeout');
  });

  it('maps DEADLINE_EXCEEDED to timeout harness result end-to-end', async () => {
    const result = await executeGrpcAction(grpcScenario(), {
      ...makeGrpcExecutionOps(),
      invokeUnary: async () => ({
        status: 4,
        statusMessage: 'DEADLINE_EXCEEDED',
        headers: {},
        trailers: {},
        durationMs: 30_000,
      }),
    });
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('timeout');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('timeout');
    expect(result.grpcResultMeta?.errorCategory).toBe('timeout');
  });

  it('classifies retryable transport failures as network category', async () => {
    const result = await executeGrpcAction(grpcScenario(), {
      ...makeGrpcExecutionOps(),
      invokeUnary: async () => {
        throw new GrpcApiClientError('call', 'connection refused', { retryable: true });
      },
    });
    expect(result.grpcResultMeta?.harnessResult?.status).toBe('error');
    expect(result.grpcResultMeta?.harnessResult?.errorCategory).toBe('network');
    expect(result.grpcResultMeta?.errorCategory).toBe('network');
  });

  it('assertion evaluation produces stable indexed failure messages', () => {
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: { message: 'actual' },
      attempts: 1,
    };
    const detailed = evaluateGrpcHarnessAssertionsDetailed(outcome, [
      { grpcField: '$.message', equals: 'expected' },
    ]);
    expect(detailed.passed).toBe(false);
    expect(detailed.assertionResults[0]?.message).toContain('assertions[0]:');
    expect(detailed.assertionResults[0]?.name).toBe('grpcField:$.message');
  });
});

// ─── Checklist 5: data-source row identity ──────────────────────────────────

describe('Phase 8I acceptance — checklist-5: data-source row identity', () => {
  it('expanded rows keep unique dataRowId and interpolated grpcCallAction', () => {
    const scenario = grpcScenario({
      id: 'sc-param',
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{msg}}' },
      },
      dataSource: {
        id: 'ds-1',
        columns: [{ id: 'c1', name: 'msg', type: 'body', mapping: 'msg' }],
        rows: [
          { id: 'row-a', values: { c1: 'Alpha' }, enabled: true },
          { id: 'row-b', values: { c1: 'Beta' }, enabled: true },
        ],
        source: { type: 'inline' },
      },
    });
    const expanded = expandDataSource(scenario);
    expect(expanded.map((row) => row.dataRowId)).toEqual(['row-a', 'row-b']);
    expect(expanded[0].grpcCallAction?.body).toEqual({ message: 'Alpha' });
    expect(buildGrpcHarnessRowTraceKey('sc-param', 'row-a')).toBe('sc-param::row-a');
  });

  it('publishes dataRowId on harnessResult when scenario row is expanded', async () => {
    const result = await executeGrpcAction({
      ...grpcScenario(),
      dataRowId: 'row-a',
    }, makeGrpcExecutionOps());
    expect(result.dataRowId).toBe('row-a');
    expect(result.grpcResultMeta?.harnessResult?.dataRowId).toBe('row-a');
    expect(result.grpcResultMeta?.harnessResult?.schemaVersion).toBe(GRPC_HARNESS_RESULT_SCHEMA_VERSION);
  });

  it('keeps stable assertions[N] logs across parameterized rows', async () => {
    const scenario = grpcScenario({
      id: 'sc-param-assert',
      grpcCallAction: {
        callType: 'unary',
        target: FIXTURE_UNARY_CALL_REQUEST.target.address,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{msg}}' },
        assertions: [{ grpcField: '$.message', equals: 'wrong-expected' }],
      },
      dataSource: {
        id: 'ds-assert',
        columns: [{ id: 'c1', name: 'msg', type: 'body', mapping: 'msg' }],
        rows: [
          { id: 'row-a', values: { c1: 'Alpha' }, enabled: true },
          { id: 'row-b', values: { c1: 'Beta' }, enabled: true },
        ],
        source: { type: 'inline' },
      },
    });
    const rows = expandDataSource(scenario);
    const results = await Promise.all(rows.map((row) => executeGrpcAction(row, {
      ...makeGrpcExecutionOps(),
      invokeUnary: async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: (row.grpcCallAction?.body as { message: string }).message },
        durationMs: 5,
      }),
    })));

    for (const result of results) {
      expect(result.passed).toBe(false);
      expect(result.dataRowId).toBeTruthy();
      expect(result.grpcResultMeta?.assertionFailures?.[0]).toMatch(/^assertions\[0\]:/);
      expect(result.grpcResultMeta?.harnessResult?.assertionResults[0]?.message).toMatch(/^assertions\[0\]:/);
      expect(result.grpcResultMeta?.harnessResult?.assertionResults[0]?.name).toBe('grpcField:$.message');
    }
    expect(results[0]?.grpcResultMeta?.harnessResult?.assertionResults[0]?.name)
      .toBe(results[1]?.grpcResultMeta?.harnessResult?.assertionResults[0]?.name);
  });
});

// ─── Checklist 6: export redaction ──────────────────────────────────────────

describe('Phase 8I acceptance — checklist-6: harness export redaction', () => {
  const SECRET = 'phase8i-export-secret-token';

  it('prepareGrpcHarnessResultReportExport passes leak scan for all call types', async () => {
    const { buildGrpcHarnessResult } = await import('./grpcHarnessResultBuilder');
    const callTypes = ['unary', 'server_streaming', 'client_streaming', 'bidi_streaming'] as const;

    for (const callType of callTypes) {
      const harnessResult = buildGrpcHarnessResult({
        scenarioId: 'sc-export',
        callType,
        durationMs: 5,
        transportOutcome: {
          callType,
          passed: true,
          grpcStatus: 0,
          durationMs: 5,
          attempts: 1,
          trailers: { authorization: `Bearer ${SECRET}` },
          body: callType === 'unary' || callType === 'client_streaming'
            ? { token: SECRET }
            : undefined,
          messages: callType === 'server_streaming' || callType === 'bidi_streaming'
            ? [{ token: SECRET }]
            : undefined,
        },
        assertionResults: [],
        assertionsPassed: true,
        validationPassed: true,
        harnessAssertionsConfigured: false,
      });

      const report = prepareGrpcHarnessResultReportExport({
        scenarioName: 'Export',
        result: {
          id: `r-${callType}`,
          scenarioId: 'sc-export',
          scenarioName: 'Export',
          url: 'grpc://localhost:50051/svc/m',
          method: callType,
          httpStatus: 200,
          responseTimeMs: 5,
          responseBody: '{}',
          responseHeaders: { authorization: `Bearer ${SECRET}` },
          timestamp: Date.now(),
          passed: true,
          validationMode: 'none',
          failureDetails: [],
          transportType: 'grpcCall',
          grpcResultMeta: {
            service: 'svc',
            method: 'm',
            target: 'localhost:50051',
            harnessResult,
          },
        },
        auth: { type: 'bearer', bearerToken: SECRET },
      });

      expect(JSON.stringify(report)).not.toContain(SECRET);
      expect(scanForbiddenGrpcPersistTargets({ harness_result_export: report })).toHaveLength(0);
    }
  });

  it('export.ts wires runner artifact redaction for JSON/CSV export', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../utils/export.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('redactGrpcHarnessRunnerArtifactsForExport');
    expect(source).toContain('exportSafeResults');
  });

  it('reportGenerator wires runner artifact redaction', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../features/results/utils/reportGenerator.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('redactGrpcHarnessRunnerArtifactsForExport');
    expect(source).toContain('exportSafeResults');
  });

  it('grpcCrossFeatureExport re-exports prepareGrpcHarnessResultReportExport', async () => {
    const mod = await import('../../features/grpc/utils/grpcCrossFeatureExport');
    expect(typeof mod.prepareGrpcHarnessResultReportExport).toBe('function');
  });

  it('includes harness export targets in forbidden persist policy', () => {
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('harness_result_export');
    expect(GRPC_FORBIDDEN_SECRET_PERSIST_TARGETS).toContain('runner_artifacts');
  });
});
