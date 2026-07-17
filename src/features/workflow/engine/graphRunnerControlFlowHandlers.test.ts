import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('./scriptSandbox', () => ({
  executeScript: vi.fn(),
}));

vi.mock('./scriptLibraries', () => ({
  loadScriptLibraries: vi.fn(() => []),
  buildLibraryPreamble: vi.fn(() => ''),
}));

import type { WorkflowNode, WorkflowEdge } from '../types/workflow';
import { handleConditionNode, handleSwitchNode } from './graphRunnerNodeHandlers';
import {
  getMockFetch,
  makeCtx,
  makeCallbacks,
  makeHandlerContext,
  makeNode,
  makeEdge,
} from './graphRunnerNodeHandlers.test-utils';

const mockFetch = getMockFetch();

beforeEach(() => {
  resetAllMocks();
  mockFetch.mockResolvedValue({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"ok": true}',
  });
});

describe('handleConditionNode', () => {
  it('takes Yes branch when condition is true', async () => {
    const ctx = makeCtx({ status: '200' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('c1', [
      makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
      makeEdge('e2', 'c1', 'no1', 'false', 'No'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('yes1', makeNode('yes1', 'http'));
    nodeMap.set('no1', makeNode('no1', 'http'));
    const { callbacks, states } = makeCallbacks();

    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('c1', 'condition', {
      left: '{{status}}', operator: '==', right: '200',
    });

    await handleConditionNode('c1', node, hCtx);

    expect(states['c1']?.state).toBe('pass');
    expect(visit).toHaveBeenCalledWith('yes1', 'main');
  });

  it('takes No branch when condition is false', async () => {
    const ctx = makeCtx({ status: '404' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('c1', [
      makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
      makeEdge('e2', 'c1', 'no1', 'false', 'No'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('yes1', makeNode('yes1', 'http'));
    nodeMap.set('no1', makeNode('no1', 'http'));
    const { callbacks } = makeCallbacks();

    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('c1', 'condition', {
      left: '{{status}}', operator: '==', right: '200',
    });

    await handleConditionNode('c1', node, hCtx);
    expect(visit).toHaveBeenCalledWith('no1', 'main');
  });

  it('runs multiple matched edges in parallel', async () => {
    const ctx = makeCtx({ status: '200' });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('c1', [
      makeEdge('e1', 'c1', 'yes1', 'true', 'Yes'),
      makeEdge('e2', 'c1', 'yes2', 'true', 'Yes'),
    ]);
    const { callbacks } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing });
    const node = makeNode('c1', 'condition', {
      left: '{{status}}', operator: '==', right: '200',
    });

    await handleConditionNode('c1', node, hCtx);
    expect(visit).toHaveBeenCalledTimes(2);
  });
});

describe('handleSwitchNode', () => {
  function switchSetup(exprValue: string) {
    const ctx = makeCtx({ env: exprValue });
    const visit = vi.fn();
    const outgoing = new Map<string, WorkflowEdge[]>();
    outgoing.set('sw1', [
      makeEdge('e1', 'sw1', 'dev-path', 'case-c1'),
      makeEdge('e2', 'sw1', 'prod-path', 'case-c2'),
      makeEdge('e3', 'sw1', 'default-path', 'default'),
    ]);
    const nodeMap = new Map<string, WorkflowNode>();
    nodeMap.set('dev-path', makeNode('dev-path', 'http'));
    nodeMap.set('prod-path', makeNode('prod-path', 'http'));
    nodeMap.set('default-path', makeNode('default-path', 'http'));
    const { callbacks, states } = makeCallbacks();
    const hCtx = makeHandlerContext({ ctx, callbacks, visit, outgoing, nodeMap });
    const node = makeNode('sw1', 'switch', {
      expression: '{{env}}',
      cases: [
        { id: 'c1', value: 'dev', label: 'Development' },
        { id: 'c2', value: 'prod', label: 'Production' },
      ],
    });
    return { hCtx, node, visit, states };
  }

  it('takes matched case branch', async () => {
    const { hCtx, node, visit, states } = switchSetup('dev');
    await handleSwitchNode('sw1', node, hCtx);
    expect(states['sw1']?.state).toBe('pass');
    expect(visit).toHaveBeenCalledWith('dev-path', 'main');
  });

  it('takes default branch when no case matches', async () => {
    const { hCtx, node, visit } = switchSetup('staging');
    await handleSwitchNode('sw1', node, hCtx);
    expect(visit).toHaveBeenCalledWith('default-path', 'main');
  });
});
