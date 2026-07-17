/**
 * Phase 11N — Cross-surface integration acceptance checklist.
 *
 * Maps to grpc-studio-plan.md Phase 11N verification gates:
 *  1. Load-test workflow node writes isolated namespace; downstream reads summary.
 *  2. Schema-diff workflow node fails on injected breaking corpus.
 *  3. Mock-assert workflow node validates mock listener responses.
 *  4. Harness advanced promotion passes leak scan.
 *  5. Collections schema compare + history drift helpers.
 *  6. Gate script + deliverables traceability.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { WorkflowEdge, WorkflowNode } from '../../features/workflow/types/workflow';
import { runGraph } from '../../features/workflow/engine/graphRunner';
import {
  endNode,
  makeEdge,
  startNode,
} from '../../features/workflow/engine/graphRunnerNodeHandlers.test-utils';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { computeGrpcSchemaDiff } from './grpcSchemaDiffEngine';
import {
  prepareGrpcHarnessResultReportExportWithAdvanced,
  prepareGrpcLoadTestProfileHarnessFixture,
} from './grpcHarnessAdvancedPromotion';
import { buildGrpcNodeOperations, resetBuildGrpcNodeOperationsForTests } from './buildGrpcNodeOperations';
import { makeResult } from '../../test-utils/factories';
import {
  buildGrpcSavedRequestSchemaCompareIntent,
  compareGrpcSavedRequestSchema,
  detectGrpcHistoryDescriptorDrift,
} from '../../features/grpc/utils/grpcCollectionSchemaDiffActions';
import type { GrpcSavedRequest } from './grpcSavedRequest';

vi.mock('../../shared/utils/httpClient', () => ({ httpFetch: vi.fn() }));

const getGrpcLoadTestProfileByIdMock = vi.fn();
vi.mock('../../features/grpc/data/grpcLoadTestProfileRepository', () => ({
  getGrpcLoadTestProfileById: (...args: unknown[]) => getGrpcLoadTestProfileByIdMock(...args),
}));

const postGrpcDescriptorLookupMock = vi.fn();
vi.mock('./grpcApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcApiClient')>();
  return {
    ...actual,
    postGrpcDescriptorLookup: (...args: unknown[]) => postGrpcDescriptorLookupMock(...args),
  };
});

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

const TARGET = FIXTURE_UNARY_CALL_REQUEST.target.address;
const SVC = FIXTURE_UNARY_CALL_REQUEST.service;
const METHOD = FIXTURE_UNARY_CALL_REQUEST.method;
const DKEY = FIXTURE_DESCRIPTOR_KEY;

function loadTestNode(id: string, extra: Record<string, unknown> = {}): WorkflowNode {
  return {
    id,
    type: 'grpcLoadTest',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      target: TARGET,
      descriptorKey: DKEY,
      service: SVC,
      method: METHOD,
      callType: 'unary',
      body: { message: id },
      loadTest: { concurrency: 1, totalCalls: 2, warmupCalls: 0 },
      ...extra,
    },
  };
}

function schemaDiffNode(id: string, leftKey: string, rightKey: string): WorkflowNode {
  return {
    id,
    type: 'grpcSchemaDiff',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      leftDescriptorKey: leftKey,
      rightDescriptorKey: rightKey,
    },
  };
}

function mockAssertNode(id: string): WorkflowNode {
  return {
    id,
    type: 'grpcMockAssert',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      listenTarget: '127.0.0.1:50061',
      descriptorKey: DKEY,
      service: SVC,
      method: METHOD,
      body: { message: 'mock' },
      expectedBodyPath: 'message',
      expectedBodyValue: 'mock-reply',
    },
  };
}

const cbs = () => ({
  onNodeStateChange: vi.fn(),
  onVariablesChange: vi.fn(),
  onComplete: vi.fn(),
});

async function runWith(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  grpcOperations: Record<string, unknown>,
  callbacks = cbs(),
) {
  return runGraph(
    nodes, edges, {}, callbacks,
    undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined,
    grpcOperations,
  );
}

describe('Phase 11N acceptance — checklist-1: load-test namespace', () => {
  it('grpcLoadTest publishes loadTestSummary for downstream variable reads', async () => {
    const capturedVars: Record<string, string> = {};
    const callbacks = {
      ...cbs(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => Object.assign(capturedVars, vars)),
    };
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { reply: 'ok' },
        durationMs: 4,
      })),
      collectServerStream: vi.fn(),
    };
    const nodes = [
      startNode('s'),
      loadTestNode('lt1', { saveAs: 'loadRun' }),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'lt1'), makeEdge('e2', 'lt1', 'e')];
    const results = await runWith(nodes, edges, ops, callbacks);

    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.transportType).toBe('grpcLoadTest');

    const summary = JSON.parse(capturedVars['steps.lt1.grpc.loadTestSummary']!);
    expect(summary.runId).toBeTruthy();
    expect(summary.totalCalls).toBe(2);
    expect(summary.succeeded).toBe(2);
    expect(JSON.parse(capturedVars['grpc.loadRun.loadTestSummary']!).runId).toBe(summary.runId);
  });
});

describe('Phase 11N acceptance — checklist-1b: load-test profileId', () => {
  it('grpcLoadTest resolves inline config over profileId when both are set', async () => {
    const profileResolver = vi.fn(async () => ({
      concurrency: 5,
      totalCalls: 99,
      warmupCalls: 0,
    }));
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { reply: 'ok' },
        durationMs: 2,
      })),
      collectServerStream: vi.fn(),
      resolveLoadTestProfile: profileResolver,
    };
    const nodes = [
      startNode('s'),
      loadTestNode('lt-profile', {
        loadTest: { concurrency: 1, totalCalls: 1, warmupCalls: 0 },
        profileId: 'ignored-profile',
      }),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'lt-profile'), makeEdge('e2', 'lt-profile', 'e')];
    const results = await runWith(nodes, edges, ops);
    expect(results[0]?.passed).toBe(true);
    expect(profileResolver).not.toHaveBeenCalled();
    expect(ops.invokeUnary).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 11N acceptance — checklist-1d: profile-only load test', () => {
  it('grpcLoadTest resolves profileId when inline loadTest is omitted', async () => {
    const profileResolver = vi.fn(async () => ({
      concurrency: 1,
      totalCalls: 1,
      warmupCalls: 0,
    }));
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { reply: 'ok' },
        durationMs: 2,
      })),
      collectServerStream: vi.fn(),
      resolveLoadTestProfile: profileResolver,
    };
    const nodes = [
      startNode('s'),
      loadTestNode('lt-profile-only', { loadTest: undefined, profileId: 'profile-abc' }),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'lt-profile-only'), makeEdge('e2', 'lt-profile-only', 'e')];
    const results = await runWith(nodes, edges, ops);
    expect(results[0]?.passed).toBe(true);
    expect(profileResolver).toHaveBeenCalledWith('profile-abc');
    expect(ops.invokeUnary).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 11N acceptance — checklist-1c: graph validation', () => {
  it('validateGrpcWorkflowGraph validates advanced gRPC node schemas', async () => {
    const { validateGrpcWorkflowGraph } = await import('../../features/workflow/utils/validateGrpcWorkflowGraph');
    const invalid: WorkflowNode[] = [{
      id: 'sd-bad',
      type: 'grpcSchemaDiff',
      position: { x: 0, y: 0 },
      data: { label: 'diff', leftDescriptorKey: '', rightDescriptorKey: DKEY },
    }];
    expect(validateGrpcWorkflowGraph(invalid).valid).toBe(false);
  });
});

describe('Phase 11N acceptance — checklist-2b: schema-diff success paths', () => {
  it('grpcSchemaDiff publishes schemaDiffSummary with saveAs alias', async () => {
    const capturedVars: Record<string, string> = {};
    const callbacks = {
      ...cbs(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => Object.assign(capturedVars, vars)),
    };
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(),
      resolveDescriptor: vi.fn(async () => FIXTURE_DESCRIPTOR),
    };
    const nodes = [
      startNode('s'),
      {
        ...schemaDiffNode('diff-ok', FIXTURE_DESCRIPTOR_KEY, FIXTURE_DESCRIPTOR_KEY),
        data: {
          ...schemaDiffNode('diff-ok', FIXTURE_DESCRIPTOR_KEY, FIXTURE_DESCRIPTOR_KEY).data,
          saveAs: 'schemaRun',
        },
      },
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'diff-ok'), makeEdge('e2', 'diff-ok', 'e')];
    const results = await runWith(nodes, edges, ops, callbacks);
    expect(results[0]?.passed).toBe(true);
    expect(JSON.parse(capturedVars['steps.diff-ok.grpc.schemaDiffSummary']!).breaking).toBe(0);
    expect(JSON.parse(capturedVars['grpc.schemaRun.schemaDiffSummary']!).breaking).toBe(0);
  });

  it('grpcSchemaDiff passes when failOnBreaking is false despite breaking changes', async () => {
    const breakingRight = { ...FIXTURE_MULTI_SERVICE_DESCRIPTOR, services: [] };
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(),
      resolveDescriptor: vi.fn(async (key: string) => {
        if (key === FIXTURE_DESCRIPTOR_KEY) return FIXTURE_DESCRIPTOR;
        return breakingRight;
      }),
    };
    const nodes = [
      startNode('s'),
      {
        ...schemaDiffNode('diff-soft', FIXTURE_DESCRIPTOR_KEY, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY),
        data: {
          ...schemaDiffNode('diff-soft', FIXTURE_DESCRIPTOR_KEY, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY).data,
          failOnBreaking: false,
        },
      },
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'diff-soft'), makeEdge('e2', 'diff-soft', 'e')];
    const results = await runWith(nodes, edges, ops);
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.transportType).toBe('grpcSchemaDiff');
  });
});

describe('Phase 11N acceptance — checklist-2: schema-diff breaking corpus', () => {
  it('grpcSchemaDiff fails when breaking changes are detected', async () => {
    const breakingRight = {
      ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      services: [],
    };
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(),
      resolveDescriptor: vi.fn(async (key: string) => {
        if (key === FIXTURE_DESCRIPTOR_KEY) return FIXTURE_DESCRIPTOR;
        if (key === FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY) return breakingRight;
        throw new Error(`unknown key ${key}`);
      }),
    };
    const preflight = computeGrpcSchemaDiff({
      leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      rightDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
      left: FIXTURE_DESCRIPTOR,
      right: breakingRight,
    });
    expect(preflight.summary.breaking).toBeGreaterThan(0);

    const nodes = [
      startNode('s'),
      schemaDiffNode('diff1', FIXTURE_DESCRIPTOR_KEY, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'diff1'), makeEdge('e2', 'diff1', 'e')];
    const results = await runWith(nodes, edges, ops);

    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.transportType).toBe('grpcSchemaDiff');
  });
});

describe('Phase 11N acceptance — checklist-1e: load-test partial failure', () => {
  it('grpcLoadTest fails the step when any call fails', async () => {
    let call = 0;
    const ops = {
      invokeUnary: vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return {
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
            body: { reply: 'ok' },
            durationMs: 2,
          };
        }
        return {
          status: 13,
          statusMessage: 'INTERNAL',
          headers: {},
          trailers: {},
          body: {},
          durationMs: 2,
        };
      }),
      collectServerStream: vi.fn(),
    };
    const nodes = [
      startNode('s'),
      loadTestNode('lt-partial', { loadTest: { concurrency: 1, totalCalls: 2, warmupCalls: 0 } }),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'lt-partial'), makeEdge('e2', 'lt-partial', 'e')];
    const results = await runWith(nodes, edges, ops);
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.transportType).toBe('grpcLoadTest');
    expect(ops.invokeUnary).toHaveBeenCalledTimes(2);
  });
});

describe('Phase 11N acceptance — checklist-3: mock assert', () => {
  it('grpcMockAssert passes when mock listener response matches expectations', async () => {
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'mock-reply' },
        durationMs: 3,
      })),
      collectServerStream: vi.fn(),
    };
    const nodes = [startNode('s'), mockAssertNode('ma1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'ma1'), makeEdge('e2', 'ma1', 'e')];
    const results = await runWith(nodes, edges, ops);

    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.transportType).toBe('grpcMockAssert');
    expect(ops.invokeUnary).toHaveBeenCalledWith(
      expect.objectContaining({ target: { address: '127.0.0.1:50061', tlsMode: 'disabled' } }),
      expect.any(String),
    );
  });

  it('grpcMockAssert fails when response body does not match expectations', async () => {
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'wrong-reply' },
        durationMs: 3,
      })),
      collectServerStream: vi.fn(),
    };
    const nodes = [startNode('s'), mockAssertNode('ma-fail'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'ma-fail'), makeEdge('e2', 'ma-fail', 'e')];
    const results = await runWith(nodes, edges, ops);
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.transportType).toBe('grpcMockAssert');
  });
});

describe('Phase 11N acceptance — checklist-4: harness advanced promotion', () => {
  it('prepareGrpcHarnessResultReportExportWithAdvanced passes leak scan', () => {
    const profile = prepareGrpcLoadTestProfileHarnessFixture({
      name: 'smoke',
      config: { concurrency: 1, totalCalls: 1 },
    });
    const bundle = prepareGrpcHarnessResultReportExportWithAdvanced({
      base: {
        scenarioName: 'grpc-smoke',
        result: makeResult({ scenarioId: 's1', passed: true }),
      },
      loadTestProfile: profile,
      schemaDiffReport: computeGrpcSchemaDiff({
        leftDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        rightDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
        left: FIXTURE_DESCRIPTOR,
        right: FIXTURE_DESCRIPTOR,
      }),
    });
    expect(bundle.advancedAttachments?.loadTestProfile?.name).toBe('smoke');
    expect(bundle.advancedAttachments?.schemaDiffMarkdown).toContain('gRPC Schema Diff Report');
  });
});

describe('Phase 11N acceptance — checklist-5: collections schema actions', () => {
  it('saved request compare intent + drift detection helpers', async () => {
    const saved: GrpcSavedRequest = {
      id: 'sr-1',
      name: 'Echo',
      revisionId: 'r1',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      service: SVC,
      method: METHOD,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
    };
    const intent = buildGrpcSavedRequestSchemaCompareIntent(saved, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
    expect(intent.keysDiffer).toBe(true);

    const report = await compareGrpcSavedRequestSchema({
      saved,
      currentDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
      resolveDescriptor: async (key) => {
        if (key === FIXTURE_DESCRIPTOR_KEY) return FIXTURE_DESCRIPTOR;
        return FIXTURE_MULTI_SERVICE_DESCRIPTOR;
      },
    });
    expect(report.leftDescriptorKey).toBe(FIXTURE_DESCRIPTOR_KEY);

    const drift = detectGrpcHistoryDescriptorDrift({
      id: 'h1',
      callType: 'unary',
      target: TARGET,
      service: SVC,
      method: METHOD,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      capturedAt: '2026-07-01T00:00:00.000Z',
      bodyTruncated: false,
      record: { body: {}, metadata: {} },
    }, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
    expect(drift?.kind).toBe('history_descriptor_drift');
  });
});

describe('Phase 11N acceptance — checklist-6: deliverables', () => {
  it('exports advanced node handlers and gate wiring', () => {
    expect(readSrc('package.json')).toContain('"test:grpc:phase11n"');
    expect(readSrc('scripts/test-grpc-phase11n.sh')).toContain('Phase 11N gate');
    expect(readSrc('src/features/workflow/engine/graphRunnerGrpcAdvancedNodeHandlers.ts')).toContain('handleGrpcLoadTestNode');
    expect(readSrc('src/shared/grpc/grpcHarnessAdvancedPromotion.ts')).toContain('prepareGrpcHarnessResultReportExportWithAdvanced');
    expect(readSrc('src/features/grpc/hooks/useGrpcCollections.ts')).toContain('compareSavedRequestSchema');
    expect(readSrc('docs/plan/future/grpc/grpc-cross-feature-matrix.md')).toContain('Phase 11N');
    expect(readSrc('src/shared/grpc/buildGrpcNodeOperations.ts')).toContain('resolveGrpcWorkflowDescriptorByKey');
    expect(readSrc('src-server/routes/grpc/grpc-routes.ts')).toContain('/api/grpc/descriptor/lookup');
  });

  it('buildGrpcNodeOperations wires Phase 11N production resolvers', () => {
    resetBuildGrpcNodeOperationsForTests();
    const ops = buildGrpcNodeOperations();
    expect(typeof ops.resolveDescriptor).toBe('function');
    expect(typeof ops.resolveLoadTestProfile).toBe('function');
  });

  it('buildGrpcNodeOperations resolveLoadTestProfile loads profile config', async () => {
    resetBuildGrpcNodeOperationsForTests();
    getGrpcLoadTestProfileByIdMock.mockResolvedValueOnce({
      id: 'p1',
      name: 'Smoke',
      config: { concurrency: 2, totalCalls: 5 },
    });
    const ops = buildGrpcNodeOperations();
    const config = await ops.resolveLoadTestProfile!('p1');
    expect(config.totalCalls).toBe(5);
    expect(getGrpcLoadTestProfileByIdMock).toHaveBeenCalledWith('p1');
  });

  it('buildGrpcNodeOperations resolveDescriptor fetches descriptor by key', async () => {
    resetBuildGrpcNodeOperationsForTests();
    postGrpcDescriptorLookupMock.mockResolvedValueOnce({
      ok: true,
      op: 'lookup_descriptor',
      data: FIXTURE_DESCRIPTOR,
    });
    const ops = buildGrpcNodeOperations();
    const descriptor = await ops.resolveDescriptor!(FIXTURE_DESCRIPTOR_KEY);
    expect(descriptor.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(postGrpcDescriptorLookupMock).toHaveBeenCalledWith({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      requestId: expect.stringMatching(/^wf-desc-/),
    });
  });
});
