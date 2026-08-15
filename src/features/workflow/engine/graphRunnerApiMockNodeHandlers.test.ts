import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  handleApiMockStartNode,
  handleApiMockApplyNode,
  handleApiMockResetStateNode,
  handleApiMockStopNode,
  handleApiMockAssertCallsNode,
  fetchApiMockControl,
} from './graphRunnerApiMockNodeHandlers';
import type { NodeHandlerContext, PassedFlag } from './graphRunnerNodeHandlerContext';
import type { WorkflowNode } from '../types/workflow';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import {
  handleApiMockStart,
  handleApiMockApply,
  handleApiMockResetState,
  handleApiMockStop,
  handleApiMockAssertCalls,
} from './apiMockNodeHandlers';
import { resolveApiMockDefinition } from '../utils/apiMockWorkflowDefinitionResolver';
import { registerApiMockServerForRun } from '../utils/apiMockRunIsolation';
import { apiMockControlBase } from '../../../shared/api-mock/controlBase';
import { httpFetch } from '../../../shared/utils/httpClient';

vi.mock('./apiMockNodeHandlers', () => ({
  handleApiMockStart: vi.fn(),
  handleApiMockApply: vi.fn(),
  handleApiMockResetState: vi.fn(),
  handleApiMockStop: vi.fn(),
  handleApiMockAssertCalls: vi.fn(),
}));

vi.mock('../utils/apiMockWorkflowDefinitionResolver', () => ({
  resolveApiMockDefinition: vi.fn(),
}));

vi.mock('../utils/apiMockRunIsolation', () => ({
  registerApiMockServerForRun: vi.fn(),
}));

vi.mock('../../../shared/api-mock/controlBase', () => ({
  apiMockControlBase: vi.fn(() => 'http://127.0.0.1:3001'),
}));

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(async (url: string) => {
    const res = await fetch(url) as Response & { json: () => Promise<unknown> };
    const payload = await res.json();
    return { status: 200, statusText: 'OK', headers: {}, body: JSON.stringify(payload) };
  }),
}));

const ts = '2026-08-12T00:00:00.000Z';

function makeDef(id = 'srv-1'): ApiMockServerDefinitionV1 {
  return {
    id,
    name: 'Users',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [{
      id: 'r1',
      name: 'Hello',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/hello' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse('resp-1')],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeHCtx(overrides: Partial<NodeHandlerContext> = {}): NodeHandlerContext {
  const results: NodeHandlerContext['results'] = [];
  const vars = new Map<string, string>();
  return {
    nodeMap: new Map(),
    outgoing: new Map(),
    ctx: {
      get: (k: string) => vars.get(k),
      set: (k: string, v: string) => { vars.set(k, v); },
      snapshot: () => Object.fromEntries(vars),
      has: (k: string) => vars.has(k),
      delete: (k: string) => { vars.delete(k); },
    } as unknown as NodeHandlerContext['ctx'],
    tokenManager: {} as NodeHandlerContext['tokenManager'],
    results,
    allPassed: true,
    visited: new Set(),
    joinArrived: new Map(),
    incomingCount: new Map(),
    callbacks: {
      onNodeStateChange: vi.fn(),
      onComplete: vi.fn(),
    },
    initialVariables: {},
    log: vi.fn(),
    nodeLabel: () => 'Mock',
    visit: vi.fn(),
    visitOutgoing: vi.fn().mockResolvedValue(undefined),
    threadId: 't1',
    executionId: 'run-1',
    workflowId: 'wf-1',
    capturedApiMockDetails: new Map(),
    ...overrides,
  };
}

function startNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'n-start',
    type: 'apiMockStart',
    position: { x: 0, y: 0 },
    data: { label: 'Start', serverId: 'srv-1', isolateRun: true, ...data },
  } as unknown as WorkflowNode;
}

function applyNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'n-apply',
    type: 'apiMockApply',
    position: { x: 0, y: 0 },
    data: { label: 'Apply', serverId: 'srv-1', ...data },
  } as unknown as WorkflowNode;
}

function resetNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'n-reset',
    type: 'apiMockResetState',
    position: { x: 0, y: 0 },
    data: { label: 'Reset', serverId: 'srv-1', ...data },
  } as unknown as WorkflowNode;
}

function stopNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'n-stop',
    type: 'apiMockStop',
    position: { x: 0, y: 0 },
    data: { label: 'Stop', serverId: 'srv-1', ...data },
  } as unknown as WorkflowNode;
}

function assertNode(data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: 'n-assert',
    type: 'apiMockAssertCalls',
    position: { x: 0, y: 0 },
    data: { label: 'Assert', serverId: 'srv-1', expectedMinCount: 1, ...data },
  } as unknown as WorkflowNode;
}

describe('graphRunnerApiMockNodeHandlers', () => {
  beforeEach(() => {
    vi.mocked(apiMockControlBase).mockReturnValue('http://127.0.0.1:3001');
    vi.mocked(resolveApiMockDefinition).mockResolvedValue({
      ok: true,
      definition: makeDef(),
      workspaceServerId: 'srv-1',
    });
    vi.mocked(handleApiMockStart).mockResolvedValue({
      success: true,
      serverId: 'srv-1__run_run-1',
      port: 4700,
      generation: 2,
    });
    vi.mocked(handleApiMockApply).mockResolvedValue({ success: true, generation: 3 });
    vi.mocked(handleApiMockResetState).mockResolvedValue({ success: true });
    vi.mocked(handleApiMockStop).mockResolvedValue({ success: true });
    vi.mocked(handleApiMockAssertCalls).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('handleApiMockStartNode', () => {
    it('starts mock, saves outputs, and advances on success', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode(), hCtx, passed);

      expect(passed.value).toBe(true);
      expect(hCtx.ctx.get('mockServerId')).toBe('srv-1__run_run-1');
      expect(hCtx.ctx.get('mockPort')).toBe('4700');
      expect(hCtx.ctx.get('mockBaseUrl')).toBe('http://127.0.0.1:4700');
      expect(hCtx.ctx.get('mockGeneration')).toBe('2');
      expect(hCtx.results[0]?.passed).toBe(true);
      expect(hCtx.results[0]?.transportType).toBe('apiMockStart');
      expect(hCtx.capturedApiMockDetails?.get('n-start')).toMatchObject({
        transport: 'apiMockStart',
        serverId: 'srv-1__run_run-1',
        port: 4700,
        generation: 2,
      });
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-start', 't1');
      expect(hCtx.callbacks.onNodeStateChange).toHaveBeenCalledWith('n-start', expect.objectContaining({ state: 'pass' }));
      expect(registerApiMockServerForRun).not.toHaveBeenCalled();
    });

    it('registers isolated server on start when isolateRun is true', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({ isolateRun: true }), hCtx, passed);

      expect(handleApiMockStart).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: 'srv-1' }),
        expect.objectContaining({
          registerStarted: expect.any(Function),
        }),
      );
      const ctxArg = vi.mocked(handleApiMockStart).mock.calls[0]![1];
      ctxArg.registerStarted?.('srv-1__run_run-1');
      expect(registerApiMockServerForRun).toHaveBeenCalledWith('run-1', 'srv-1__run_run-1');
    });

    it('does not register when isolateRun is false', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({ isolateRun: false }), hCtx, passed);

      const ctxArg = vi.mocked(handleApiMockStart).mock.calls[0]![1];
      expect(ctxArg.registerStarted).toBeUndefined();
    });

    it('resolves template serverId and custom save variable names', async () => {
      const hCtx = makeHCtx();
      hCtx.ctx.set('sid', 'srv-1');
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({
        serverId: '{{sid}}',
        saveServerIdAs: '  ',
        savePortAs: 'myPort',
        saveBaseUrlAs: 'myBase',
        saveGenerationAs: 'myGen',
      }), hCtx, passed);

      expect(resolveApiMockDefinition).toHaveBeenCalledWith(expect.objectContaining({ serverId: 'srv-1' }));
      expect(hCtx.ctx.get('myPort')).toBe('4700');
      expect(hCtx.ctx.get('myBase')).toBe('http://127.0.0.1:4700');
      expect(hCtx.ctx.get('myGen')).toBe('2');
      expect(hCtx.ctx.has('  ')).toBe(false);
    });

    it('logs missing server id and fails when definition cannot be resolved', async () => {
      vi.mocked(resolveApiMockDefinition).mockResolvedValue({
        ok: false,
        error: 'Server "missing-server" not found in workspace',
      });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };
      const node = startNode({ serverId: 'missing-server' });

      await handleApiMockStartNode('n-start', node, hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.passed).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toContain('not found');
      expect(hCtx.capturedApiMockDetails?.get('n-start')?.transport).toBe('apiMockStart');
      expect(hCtx.visitOutgoing).not.toHaveBeenCalled();
    });

    it('continues graph on handler failure when onError is continue', async () => {
      vi.mocked(handleApiMockStart).mockResolvedValue({ success: false, error: 'Port in use' });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({ onError: 'continue' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-start', 't1');
    });

    it('handles thrown errors from start handler', async () => {
      vi.mocked(handleApiMockStart).mockRejectedValue(new Error('network down'));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({ serverId: '' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toBe('network down');
    });

    it('uses definition fallbacks when start result omits serverId, port, and generation', async () => {
      vi.mocked(handleApiMockStart).mockResolvedValue({ success: true });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode(), hCtx, passed);

      expect(hCtx.ctx.get('mockServerId')).toBe('srv-1');
      expect(hCtx.ctx.get('mockPort')).toBe('4600');
      expect(hCtx.ctx.get('mockBaseUrl')).toBe('http://127.0.0.1:4600');
      expect(hCtx.ctx.get('mockGeneration')).toBe('1');
      expect(hCtx.results[0]?.url).toContain('srv-1:4600');
    });

    it('logs (missing) when server id resolves empty', async () => {
      vi.mocked(resolveApiMockDefinition).mockResolvedValue({ ok: false, error: 'required' });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode({ serverId: '' }), hCtx, passed);

      expect(hCtx.log).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('START mock (missing)'),
      }));
      expect(hCtx.results[0]?.url).toContain('unknown');
    });

    it('uses generic failure message when handler fails without details', async () => {
      vi.mocked(handleApiMockStart).mockResolvedValue({ success: false });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode(), hCtx, passed);

      expect(hCtx.results[0]?.errorMessage).toBe('API Mock node failed');
    });

    it('uses assertionDetails message when start fails without explicit error', async () => {
      vi.mocked(handleApiMockStart).mockResolvedValue({
        success: false,
        assertionDetails: {
          expected: 'expected 2 calls',
          actual: 'got 0',
          nearMisses: ['near-1', 'near-2', 'near-3', 'near-4', 'near-5', 'near-6'],
        },
      });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStartNode('n-start', startNode(), hCtx, passed);

      expect(hCtx.results[0]?.errorMessage).toContain('expected 2 calls');
      expect(hCtx.log).toHaveBeenCalledWith(expect.objectContaining({ prefix: '!', text: expect.stringContaining('near-miss: near-1') }));
      expect(hCtx.log).toHaveBeenCalledWith(expect.objectContaining({ prefix: '!', text: expect.stringContaining('near-miss: near-5') }));
      expect(hCtx.log).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('near-miss: near-6') }));
    });
  });

  describe('handleApiMockApplyNode', () => {
    it('applies definition and saves generation on success', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode(), hCtx, passed);

      expect(passed.value).toBe(true);
      expect(hCtx.ctx.get('mockGeneration')).toBe('3');
      expect(hCtx.results[0]?.transportType).toBe('apiMockApply');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-apply', 't1');
    });

    it('strips run suffix for workspace lookup and overrides definition id', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };
      const runScopedId = 'srv-1__run_run-1';

      await handleApiMockApplyNode('n-apply', applyNode({ serverId: runScopedId }), hCtx, passed);

      expect(resolveApiMockDefinition).toHaveBeenCalledWith({
        serverId: 'srv-1',
        isolateRun: false,
      });
      expect(handleApiMockApply).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: runScopedId }),
        expect.objectContaining({
          definition: expect.objectContaining({ id: runScopedId }),
        }),
      );
    });

    it('uses generation zero when apply result omits generation', async () => {
      vi.mocked(handleApiMockApply).mockResolvedValue({ success: true });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode(), hCtx, passed);

      expect(hCtx.ctx.get('mockGeneration')).toBe('0');
    });

    it('uses plain server id when apply target is not run-scoped', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode({ serverId: 'plain-srv' }), hCtx, passed);

      expect(resolveApiMockDefinition).toHaveBeenCalledWith({
        serverId: 'plain-srv',
        isolateRun: false,
      });
    });

    it('applies without definition when workspace lookup fails', async () => {
      vi.mocked(resolveApiMockDefinition).mockResolvedValue({
        ok: false,
        error: 'missing',
      });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode(), hCtx, passed);

      expect(handleApiMockApply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ definition: undefined }),
      );
      expect(passed.value).toBe(true);
    });

    it('continues on apply failure when onError is continue', async () => {
      vi.mocked(handleApiMockApply).mockResolvedValue({ success: false, error: 'commit failed' });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode({ onError: 'continue' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-apply', 't1');
    });

    it('handles thrown errors during apply', async () => {
      vi.mocked(handleApiMockApply).mockRejectedValue(new Error('apply boom'));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockApplyNode('n-apply', applyNode(), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toBe('apply boom');
    });
  });

  describe('handleApiMockResetStateNode', () => {
    it('resets state and advances on success', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockResetStateNode('n-reset', resetNode(), hCtx, passed);

      expect(passed.value).toBe(true);
      expect(hCtx.results[0]?.transportType).toBe('apiMockResetState');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-reset', 't1');
    });

    it('fails and optionally continues when reset fails', async () => {
      vi.mocked(handleApiMockResetState).mockResolvedValue({ success: false, error: 'reset failed' });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockResetStateNode('n-reset', resetNode({ onError: 'continue' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-reset', 't1');
    });

    it('handles thrown errors during reset', async () => {
      vi.mocked(handleApiMockResetState).mockRejectedValue(new Error('reset boom'));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockResetStateNode('n-reset', resetNode(), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toBe('reset boom');
    });
  });

  describe('handleApiMockStopNode', () => {
    it('stops server and advances on success', async () => {
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStopNode('n-stop', stopNode(), hCtx, passed);

      expect(passed.value).toBe(true);
      expect(hCtx.results[0]?.transportType).toBe('apiMockStop');
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-stop', 't1');
    });

    it('fails and optionally continues when stop fails', async () => {
      vi.mocked(handleApiMockStop).mockResolvedValue({ success: false, error: 'already stopped' });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStopNode('n-stop', stopNode({ onError: 'continue' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-stop', 't1');
    });

    it('handles thrown errors during stop', async () => {
      vi.mocked(handleApiMockStop).mockRejectedValue(new Error('stop boom'));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockStopNode('n-stop', stopNode(), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toBe('stop boom');
    });
  });

  describe('handleApiMockAssertCallsNode', () => {
    it('loads transactions, asserts, and advances on success', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { transactions: [{ id: 'tx-1' }] } }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/mock/servers/srv-1/transactions?limit=500',
        undefined,
      );
      expect(handleApiMockAssertCalls).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: 'srv-1' }),
        expect.anything(),
        [{ id: 'tx-1' }],
      );
      expect(passed.value).toBe(true);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-assert', 't1');
    });

    it('resolves template serverId and routeId', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { transactions: [] } }),
      }));
      const hCtx = makeHCtx();
      hCtx.ctx.set('sid', 'srv-1');
      hCtx.ctx.set('rid', 'r1');
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode({
        serverId: '{{sid}}',
        routeId: '{{rid}}',
      }), hCtx, passed);

      expect(handleApiMockAssertCalls).toHaveBeenCalledWith(
        expect.objectContaining({ serverId: 'srv-1', routeId: 'r1' }),
        expect.anything(),
        [],
      );
    });

    it('fails when journal fetch returns ok=false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: { message: 'down' } }),
      }));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toContain('down');
    });

    it('uses default message when journal fetch fails without error message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: false }),
      }));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(hCtx.results[0]?.errorMessage).toBe('Failed to load transactions');
    });

    it('continues on assert failure when onError is continue', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { transactions: [] } }),
      }));
      vi.mocked(handleApiMockAssertCalls).mockResolvedValue({
        success: false,
        assertionDetails: { expected: 'count = 1', actual: 'count = 0' },
      });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode({ onError: 'continue' }), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.visitOutgoing).toHaveBeenCalledWith('n-assert', 't1');
    });

    it('handles thrown errors during assert', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(passed.value).toBe(false);
      expect(hCtx.results[0]?.errorMessage).toBe('fetch failed');
    });

    it('treats missing transactions payload as empty list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: true }),
      }));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(handleApiMockAssertCalls).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [],
      );
    });

    it('resolves empty routeId to undefined', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { transactions: [] } }),
      }));
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode({ routeId: '' }), hCtx, passed);

      expect(handleApiMockAssertCalls).toHaveBeenCalledWith(
        expect.objectContaining({ routeId: undefined }),
        expect.anything(),
        [],
      );
    });

    it('keeps a relative /api/mock URL when control base is empty (Vite proxy)', async () => {
      vi.mocked(apiMockControlBase).mockReturnValue('');
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, data: { transactions: [] } }),
      });
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
      const hCtx = makeHCtx();
      const passed: PassedFlag = { value: true };

      await handleApiMockAssertCallsNode('n-assert', assertNode(), hCtx, passed);

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/mock/servers/srv-1/transactions?limit=500',
        undefined,
      );
    });
  });

  describe('fetchApiMockControl', () => {
    it('forwards the POST body on web (native fetch)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      const body = JSON.stringify({ id: 'srv-ff6eca94', name: 'Cart API' });

      await fetchApiMockControl('/api/mock/servers/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/mock/servers/start',
        expect.objectContaining({ method: 'POST', body }),
      );
    });

    it('accepts URL and Request inputs and prefixes a relative path without a slash', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      await fetchApiMockControl(new URL('http://127.0.0.1:3001/api/mock/health'));
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3001/api/mock/health', undefined);

      await fetchApiMockControl(new Request('http://127.0.0.1:3001/api/mock/state'));
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3001/api/mock/state', undefined);

      await fetchApiMockControl('api/mock/ping');
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3001/api/mock/ping', undefined);
    });

    it('rejects a non-string control URL', async () => {
      await expect(fetchApiMockControl({ url: 'true' } as RequestInfo)).rejects.toThrow(/Invalid control URL/);
      await expect(fetchApiMockControl({ url: 'false' } as RequestInfo)).rejects.toThrow(/Invalid control URL/);
    });

    it('uses httpFetch on Tauri and maps status, headers, and errors', async () => {
      vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
      vi.mocked(httpFetch).mockResolvedValueOnce({
        status: 0,
        statusText: 'OK',
        headers: { 'x-mock': '1' },
        body: '{"ok":true}',
      });

      const res = await fetchApiMockControl('/api/mock/health', {
        method: 'GET',
        headers: { 'X-Trace': 't1' },
        body: '{"ping":true}',
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('{"ok":true}');
      expect(httpFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/mock/health',
        'GET',
        expect.objectContaining({ 'Content-Type': 'application/json', 'x-trace': 't1' }),
        '{"ping":true}',
      );

      vi.mocked(httpFetch).mockResolvedValueOnce({
        status: 500,
        statusText: 'ERR',
        headers: {},
        body: '',
        error: 'companion down',
      });
      await expect(fetchApiMockControl('/api/mock/health')).rejects.toThrow('companion down');

      vi.mocked(httpFetch).mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '',
      });
      await fetchApiMockControl('/api/mock/health', { method: 'POST', body: new Blob() });
      expect(httpFetch).toHaveBeenLastCalledWith(
        'http://127.0.0.1:3001/api/mock/health',
        'POST',
        { 'Content-Type': 'application/json' },
        undefined,
      );
    });
  });

  describe('makeCtx runId fallback', () => {
    it('uses workflowId when executionId is missing', async () => {
      const hCtx = makeHCtx({ executionId: undefined, workflowId: 'wf-only' });
      const passed: PassedFlag = { value: true };

      await handleApiMockStopNode('n-stop', stopNode(), hCtx, passed);

      expect(handleApiMockStop).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ runId: 'wf-only' }),
      );
    });

    it('falls back to workflow when both execution and workflow ids are missing', async () => {
      const hCtx = makeHCtx({ executionId: undefined, workflowId: undefined });
      const passed: PassedFlag = { value: true };

      await handleApiMockResetStateNode('n-reset', resetNode(), hCtx, passed);

      expect(handleApiMockResetState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ runId: 'workflow' }),
      );
    });

    it('start node uses workflowId then the workflow token for isolate runId', async () => {
      const withWf = makeHCtx({ executionId: undefined, workflowId: 'wf-start' });
      await handleApiMockStartNode('n-start', startNode(), withWf, { value: true });
      expect(resolveApiMockDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'wf-start' }),
      );

      const bare = makeHCtx({ executionId: undefined, workflowId: undefined });
      await handleApiMockStartNode('n-start', startNode(), bare, { value: true });
      expect(resolveApiMockDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'workflow' }),
      );
    });
  });
});
