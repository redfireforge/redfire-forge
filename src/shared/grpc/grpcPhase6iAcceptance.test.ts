/**
 * Phase 6I — Acceptance checklist traceability (hardening gate).
 *
 * Each test maps directly to one of the six Phase 6 acceptance checklist items.
 * All tests run end-to-end via `runGraph` with injected `grpcOperations`
 * (transport boundary) — internal assert/namespace utilities are not mocked.
 *
 * Checklist items:
 *  1. Two gRPC nodes do not overwrite each other's scoped outputs.
 *  2. `onError: continue` allows downstream execution and carries error detail.
 *  3. `grpcServerStream` always terminates via a recorded stop reason.
 *  4. Retry policy fires on call nodes but NOT on `grpcAssert` nodes.
 *  5. `saveAs` aliases resolve correctly in downstream variable context.
 *  6. Each result carries `workflowNodeId` for per-step routing (Results Explorer).
 */
import { describe, it, expect, vi } from 'vitest';
import type { WorkflowNode, WorkflowEdge } from '../../features/workflow/types/workflow';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { runGraph } from '../../features/workflow/engine/graphRunner';
import {
  endNode,
  makeEdge,
  startNode,
} from '../../features/workflow/engine/graphRunnerNodeHandlers.test-utils';

vi.mock('../../shared/utils/httpClient', () => ({ httpFetch: vi.fn() }));

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const TARGET = FIXTURE_UNARY_CALL_REQUEST.target.address;
const SVC    = FIXTURE_UNARY_CALL_REQUEST.service;
const METHOD = FIXTURE_UNARY_CALL_REQUEST.method;
const DKEY   = FIXTURE_DESCRIPTOR_KEY;

function unaryNode(id: string, extra: Record<string, unknown> = {}): WorkflowNode {
  return {
    id,
    type: 'grpcUnary',
    position: { x: 0, y: 0 },
    data: { label: id, target: TARGET, descriptorKey: DKEY, service: SVC, method: METHOD, callType: 'unary', body: { message: id }, ...extra },
  };
}

function streamNode(id: string): WorkflowNode {
  return {
    id,
    type: 'grpcServerStream',
    position: { x: 0, y: 0 },
    data: {
      label: id, target: TARGET, descriptorKey: DKEY,
      service: SVC, method: 'ServerStream', callType: 'server_streaming',
      body: { message: id }, collect: { maxMessages: 2 },
    },
  };
}

function assertNode(id: string, source: string, onError?: 'fail' | 'continue'): WorkflowNode {
  return {
    id,
    type: 'grpcAssert',
    position: { x: 0, y: 0 },
    data: {
      label: id, source,
      assertions: [{ grpcStatus: 0 }],
      ...(onError ? { onError } : {}),
    },
  };
}

function successOps(body: Record<string, unknown> = { reply: 'ok' }, durationMs = 10) {
  return {
    invokeUnary: vi.fn(async () => ({
      status: 0, statusMessage: 'OK',
      headers: {}, trailers: {}, body, durationMs,
    })),
    collectServerStream: vi.fn(async () => ({
      messages: [body],
      durationMs,
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
      trailers: {},
      stopReason: 'max_messages' as const,
    })),
  };
}

const cbs = () => ({
  onNodeStateChange: vi.fn(),
  onVariablesChange: vi.fn(),
  onComplete: vi.fn(),
});

// runGraph positional args — grpcOperations is at position 19 (0-based)
async function runWith(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  grpcOperations: { invokeUnary: ReturnType<typeof vi.fn>; collectServerStream: ReturnType<typeof vi.fn> },
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

// ─── Checklist 1: namespace isolation ────────────────────────────────────────

describe('Phase 6I acceptance — checklist-1: two-node namespace isolation', () => {
  it('two grpcUnary nodes publish to separate step namespaces and do not overwrite each other', async () => {
    const ops1Body = { value: 'first' };
    const ops2Body = { value: 'second' };
    let callCount = 0;
    const ops = {
      invokeUnary: vi.fn(async () => {
        callCount += 1;
        return {
          status: 0, statusMessage: 'OK', headers: {}, trailers: {},
          body: callCount === 1 ? ops1Body : ops2Body,
          durationMs: 5,
        };
      }),
      collectServerStream: vi.fn(),
    };

    const capturedVars: Record<string, string> = {};
    const callbacks = {
      ...cbs(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => Object.assign(capturedVars, vars)),
    };

    const nodes = [startNode('s'), unaryNode('g1', { saveAs: 'call1' }), unaryNode('g2', { saveAs: 'call2' }), endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'g2'), makeEdge('e3', 'g2', 'e')];

    const results = await runWith(nodes, edges, ops, callbacks);

    expect(results).toHaveLength(2);
    expect(results[0]?.passed).toBe(true);
    expect(results[1]?.passed).toBe(true);

    // Step-scoped namespaces must be independent
    expect(JSON.parse(capturedVars['steps.g1.grpc.body']!)).toEqual(ops1Body);
    expect(JSON.parse(capturedVars['steps.g2.grpc.body']!)).toEqual(ops2Body);

    // saveAs aliases must be independent
    expect(JSON.parse(capturedVars['grpc.call1.body']!)).toEqual(ops1Body);
    expect(JSON.parse(capturedVars['grpc.call2.body']!)).toEqual(ops2Body);

    // Global last-success pointer updates; scoped namespaces remain isolated
    expect(JSON.parse(capturedVars['grpc.response.body']!)).toEqual(ops2Body);
    expect(capturedVars['grpc.response.body']).not.toBe(capturedVars['grpc.call1.body']);
  });
});

// ─── Checklist 2: onError continue ───────────────────────────────────────────

describe('Phase 6I acceptance — checklist-2: onError continue propagates error detail', () => {
  it('failed grpcUnary with onError:continue marks node failed but allows downstream execution', async () => {
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 14, statusMessage: 'UNAVAILABLE', headers: {}, trailers: {}, body: undefined, durationMs: 3,
      })),
      collectServerStream: vi.fn(),
    };

    const states: Record<string, { state: string; error?: string }> = {};
    const callbacks = {
      ...cbs(),
      onNodeStateChange: vi.fn((id: string, s: { state: string; error?: string }) => { states[id] = s; }),
    };

    // unary g1 fails with onError:continue → end node should still pass
    const nodes = [
      startNode('s'),
      unaryNode('g1', { onError: 'continue' }),
      endNode('e'),
    ];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'e')];

    const results = await runWith(nodes, edges, ops, callbacks);

    expect(states['g1']?.state).toBe('fail');
    expect(states['g1']?.error).toMatch(/UNAVAILABLE/i);
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.workflowNodeId).toBe('g1');
    expect(results[0]?.grpcResultMeta?.grpcStatus).toBe(14);
    expect(results[0]?.grpcResultMeta?.grpcStatusMessage).toBe('UNAVAILABLE');
    expect(results[0]?.errorMessage).toBe('UNAVAILABLE');
    // End node must still be reached
    expect(states['e']?.state).toBe('pass');
  });

  it('failed grpcAssert with onError:continue allows end node', async () => {
    const ops = successOps({ answer: 42 });
    const states: Record<string, { state: string; error?: string; grpcMeta?: { assertionFailures?: string[] } }> = {};
    const callbacks = {
      ...cbs(),
      onNodeStateChange: vi.fn((id: string, s: { state: string; error?: string; grpcMeta?: { assertionFailures?: string[] } }) => {
        states[id] = s;
      }),
    };

    // Assert node uses grpcStatus: 99 to force a failure (upstream call returns grpcStatus: 0)
    const failAssert: WorkflowNode = {
      id: 'a1', type: 'grpcAssert', position: { x: 0, y: 0 },
      data: { label: 'a1', source: 'g1', onError: 'continue', assertions: [{ grpcStatus: 99 }] },
    };
    const nodes = [startNode('s'), unaryNode('g1'), failAssert, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops, callbacks);

    expect(states['a1']?.state).toBe('fail');
    expect(states['e']?.state).toBe('pass');
    const assertResult = results.find(r => r.workflowNodeId === 'a1');
    expect(assertResult?.passed).toBe(false);
    expect(assertResult?.transportType).toBe('grpcAssert');
    expect(assertResult?.grpcResultMeta?.assertionFailures?.length).toBeGreaterThan(0);
    expect(states['a1']?.grpcMeta?.assertionFailures?.length).toBeGreaterThan(0);
  });

  it('failed grpcUnary with onError:continue commits step result for downstream assert', async () => {
    const ops = {
      invokeUnary: vi.fn(async () => ({
        status: 3, statusMessage: 'INVALID_ARGUMENT', headers: {}, trailers: {},
        body: { message: 'bad' }, durationMs: 5,
      })),
      collectServerStream: vi.fn(),
    };

    const failAssert: WorkflowNode = {
      id: 'a1', type: 'grpcAssert', position: { x: 0, y: 0 },
      data: { label: 'a1', source: 'g1', assertions: [{ grpcStatus: 3 }] },
    };
    const nodes = [startNode('s'), unaryNode('g1', { onError: 'continue' }), failAssert, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results).toHaveLength(2);
    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.grpcResultMeta?.grpcStatus).toBe(3);
    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(true);
    expect(results[1]?.grpcResultMeta?.assertionFailures).toEqual([]);
  });

  it('failed grpcUnary transport throw with onError:continue commits step result for downstream assert', async () => {
    const ops = {
      invokeUnary: vi.fn(async () => {
        throw new Error('network down');
      }),
      collectServerStream: vi.fn(),
    };

    const failAssert: WorkflowNode = {
      id: 'a1', type: 'grpcAssert', position: { x: 0, y: 0 },
      data: { label: 'a1', source: 'g1', assertions: [{ grpcField: '$.message', exists: false }] },
    };
    const nodes = [startNode('s'), unaryNode('g1', { onError: 'continue' }), failAssert, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.errorMessage).toBe('network down');
    expect(results[1]?.transportType).toBe('grpcAssert');
    expect(results[1]?.passed).toBe(true);
  });
});

// ─── Checklist 3: stream stop reason ─────────────────────────────────────────

describe('Phase 6I acceptance — checklist-3: stream stop reason recorded on result', () => {
  it('max_messages stop reason is recorded on grpcResultMeta.streamStopReason', async () => {
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(async () => ({
        messages: [{ n: 1 }, { n: 2 }],
        durationMs: 20,
        grpcStatus: 0, grpcStatusMessage: 'OK', trailers: {},
        stopReason: 'max_messages' as const,
      })),
    };

    const nodes = [startNode('s'), streamNode('str1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'str1'), makeEdge('e2', 'str1', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results[0]?.transportType).toBe('grpcServerStream');
    expect(results[0]?.grpcResultMeta?.streamStopReason).toBe('max_messages');
    expect(results[0]?.grpcResultMeta?.messageCount).toBe(2);
  });

  it('stream_end stop reason is recorded when server closes naturally', async () => {
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(async () => ({
        messages: [{ x: 1 }],
        durationMs: 15,
        grpcStatus: 0, grpcStatusMessage: 'OK', trailers: {},
        stopReason: 'stream_end' as const,
      })),
    };

    const nodes = [startNode('s'), streamNode('str2'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'str2'), makeEdge('e2', 'str2', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.grpcResultMeta?.streamStopReason).toBe('stream_end');
  });

  it('stream_error stop reason is recorded when collection fails', async () => {
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(async () => ({
        messages: [],
        durationMs: 10,
        grpcStatus: 13,
        grpcStatusMessage: 'Internal',
        trailers: {},
        stopReason: 'stream_error' as const,
        errorDetail: 'boom',
      })),
    };

    const nodes = [startNode('s'), streamNode('str3'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'str3'), makeEdge('e2', 'str3', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results[0]?.passed).toBe(false);
    expect(results[0]?.transportType).toBe('grpcServerStream');
    expect(results[0]?.grpcResultMeta?.streamStopReason).toBe('stream_error');
    expect(results[0]?.errorMessage).toBeTruthy();
  });
});

// ─── Checklist 4: retry policy ───────────────────────────────────────────────

describe('Phase 6I acceptance — checklist-4: retry policy fires on call node but not assert node', () => {
  it('grpcUnary with retry policy retries on UNAVAILABLE status (14)', async () => {
    let callCount = 0;
    const ops = {
      invokeUnary: vi.fn(async () => {
        callCount += 1;
        if (callCount < 3) {
          return { status: 14, statusMessage: 'UNAVAILABLE', headers: {}, trailers: {}, body: undefined, durationMs: 2 };
        }
        return { status: 0, statusMessage: 'OK', headers: {}, trailers: {}, body: { done: true }, durationMs: 2 };
      }),
      collectServerStream: vi.fn(),
    };

    // retry: maxAttempts=3 retries on status 14
    const retryNode = unaryNode('g1', { retry: { maxAttempts: 3, backoffMs: 0, retryOnStatuses: [14] } });
    const nodes = [startNode('s'), retryNode, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(ops.invokeUnary).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    expect(results[0]?.passed).toBe(true);
    expect(results[0]?.grpcResultMeta?.attempts).toBe(3);
  });

  it('grpcAssert failure does NOT retry — invokeUnary is never called by the assert handler', async () => {
    const invokeUnary = vi.fn(async () => ({
      status: 0, statusMessage: 'OK', headers: {}, trailers: {}, body: { msg: 'hi' }, durationMs: 5,
    }));
    const ops = { invokeUnary, collectServerStream: vi.fn() };

    // Deliberately failing assert (wrong expected value)
    const failAssert: WorkflowNode = {
      id: 'a1', type: 'grpcAssert', position: { x: 0, y: 0 },
      data: { label: 'a1', source: 'g1', assertions: [{ grpcStatus: 99 }] },
    };
    const nodes = [startNode('s'), unaryNode('g1'), failAssert, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops);

    // invokeUnary called exactly once — for the unary call node, never by assert
    expect(invokeUnary).toHaveBeenCalledTimes(1);
    const assertResult = results.find(r => r.workflowNodeId === 'a1');
    expect(assertResult?.passed).toBe(false);
    expect(assertResult?.transportType).toBe('grpcAssert');
    expect(assertResult?.grpcResultMeta?.assertionFailures?.length).toBeGreaterThan(0);
  });
});

// ─── Checklist 5: saveAs alias resolution ────────────────────────────────────

describe('Phase 6I acceptance — checklist-5: saveAs alias resolves in downstream variable context', () => {
  it('grpc.<saveAs>.body is readable in downstream assert and variable context', async () => {
    const ops = successOps({ user: 'alice', score: 99 });

    const capturedVars: Record<string, string> = {};
    const callbacks = {
      ...cbs(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => Object.assign(capturedVars, vars)),
    };

    // unary with saveAs='userData' — assert reads from the alias
    const saveAsUnary = unaryNode('g1', { saveAs: 'userData' });
    const assertViaAlias: WorkflowNode = {
      id: 'a1', type: 'grpcAssert', position: { x: 0, y: 0 },
      data: { label: 'a1', source: 'userData', assertions: [{ grpcStatus: 0 }] },
    };
    const nodes = [startNode('s'), saveAsUnary, assertViaAlias, endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops, callbacks);

    // assert must pass — found the step result via saveAs alias
    expect(results.find(r => r.workflowNodeId === 'a1')?.passed).toBe(true);

    // saveAs namespace must be populated in variable context
    const aliasBody = capturedVars['grpc.userData.body'];
    expect(aliasBody).toBeDefined();
    expect(JSON.parse(aliasBody!)).toEqual({ user: 'alice', score: 99 });
  });

  it('steps.<nodeId>.grpc.body is still accessible independently of saveAs alias', async () => {
    const ops = successOps({ item: 'x' });
    const capturedVars: Record<string, string> = {};
    const callbacks = {
      ...cbs(),
      onVariablesChange: vi.fn((vars: Record<string, string>) => Object.assign(capturedVars, vars)),
    };

    const nodes = [startNode('s'), unaryNode('g1', { saveAs: 'myAlias' }), endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'e')];

    await runWith(nodes, edges, ops, callbacks);

    expect(JSON.parse(capturedVars['steps.g1.grpc.body']!)).toEqual({ item: 'x' });
    expect(JSON.parse(capturedVars['grpc.myAlias.body']!)).toEqual({ item: 'x' });
  });
});

// ─── Checklist 6: per-step workflowNodeId ────────────────────────────────────

describe('Phase 6I acceptance — checklist-6: each result carries workflowNodeId for per-step routing', () => {
  it('every RequestResult from a gRPC call node has workflowNodeId matching the node id', async () => {
    const ops = successOps();

    const nodes = [startNode('s'), unaryNode('g1'), unaryNode('g2'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'g2'), makeEdge('e3', 'g2', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results).toHaveLength(2);
    expect(results[0]?.workflowNodeId).toBe('g1');
    expect(results[1]?.workflowNodeId).toBe('g2');
  });

  it('grpcAssert result carries its own workflowNodeId (distinct from the call node)', async () => {
    const ops = successOps({ val: 1 });

    const nodes = [startNode('s'), unaryNode('g1'), assertNode('a1', 'g1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'g1'), makeEdge('e2', 'g1', 'a1'), makeEdge('e3', 'a1', 'e')];

    const results = await runWith(nodes, edges, ops);

    const callResult  = results.find(r => r.workflowNodeId === 'g1');
    const assertResult = results.find(r => r.workflowNodeId === 'a1');
    expect(callResult).toBeDefined();
    expect(assertResult).toBeDefined();
    expect(callResult?.transportType).toBe('grpcUnary');
    expect(assertResult?.transportType).toBe('grpcAssert');
  });

  it('grpcServerStream result carries workflowNodeId and messageCount on grpcResultMeta', async () => {
    const ops = {
      invokeUnary: vi.fn(),
      collectServerStream: vi.fn(async () => ({
        messages: [{ a: 1 }, { a: 2 }],
        durationMs: 10,
        grpcStatus: 0, grpcStatusMessage: 'OK', trailers: {},
        stopReason: 'max_messages' as const,
      })),
    };

    const nodes = [startNode('s'), streamNode('str1'), endNode('e')];
    const edges = [makeEdge('e1', 's', 'str1'), makeEdge('e2', 'str1', 'e')];

    const results = await runWith(nodes, edges, ops);

    expect(results[0]?.workflowNodeId).toBe('str1');
    expect(results[0]?.grpcResultMeta?.messageCount).toBe(2);
  });
});
