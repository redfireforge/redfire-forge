import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkflowEdge, WorkflowNode } from '../types/workflow';

vi.mock('../../../shared/utils/httpClient', () => ({
  httpFetch: vi.fn(),
}));

import { runGraph } from './graphRunner';
import { httpFetch } from '../../../shared/utils/httpClient';
import { httpNode } from './graphRunnerNodeHandlers.test-utils';

const mockFetch = vi.mocked(httpFetch);

describe('runGraph with DebugController', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{}',
    });
  });

  it('pauses before each node and resumes on stepNode', async () => {
    const { DebugController } = await import('./debugController');
    const n1 = httpNode('n1', 'First');
    const n2 = httpNode('n2', 'Second');
    const nodes: WorkflowNode[] = [n1, n2];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    const dc = new DebugController();
    const runPromise = runGraph(nodes, edges, {}, cb, undefined, undefined, undefined, undefined, dc);

    // Wait a tick for the first node to pause
    await new Promise(r => setTimeout(r, 50));
    expect(dc.getPausedNodeIds()).toContain('n1');

    // Step first node
    dc.stepNode('n1');
    await new Promise(r => setTimeout(r, 200));

    // Second node should now be paused
    expect(dc.getPausedNodeIds()).toContain('n2');

    // Step second node
    dc.stepNode('n2');
    await runPromise;

    // onComplete should have been called
    expect(cb.onComplete).toHaveBeenCalled();

    // Both nodes should have gone through 'paused' state
    const pausedCalls = cb.onNodeStateChange.mock.calls.filter(
      ([, s]: [string, { state: string }]) => s.state === 'paused'
    );
    expect(pausedCalls.length).toBe(2);
  });

  it('resumeAll skips pausing for remaining nodes', async () => {
    const { DebugController } = await import('./debugController');
    const n1 = httpNode('n1', 'First');
    const n2 = httpNode('n2', 'Second');
    const nodes: WorkflowNode[] = [n1, n2];
    const edges: WorkflowEdge[] = [{ id: 'e1', source: 'n1', target: 'n2' }];
    const cb = {
      onNodeStateChange: vi.fn(),
      onVariablesChange: vi.fn(),
      onComplete: vi.fn(),
    };

    const dc = new DebugController();
    const runPromise = runGraph(nodes, edges, {}, cb, undefined, undefined, undefined, undefined, dc);

    await new Promise(r => setTimeout(r, 50));
    dc.resumeAll();
    await runPromise;

    expect(cb.onComplete).toHaveBeenCalled();
  });
});
