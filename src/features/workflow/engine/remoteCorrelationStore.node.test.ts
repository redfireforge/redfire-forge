/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { RemoteCorrelationStore } from './remoteCorrelationStore';
import type { WorkflowPausedState } from '../types/workflow';

function makeState(): WorkflowPausedState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    visitedNodes: [],
    pausedNodeId: 'cw1',
    threadId: 'main',
    joinArrived: {},
    results: [],
    startTime: 1000,
    initialVariables: {},
  };
}

function ok(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('RemoteCorrelationStore (no window)', () => {
  it('defaults baseUrl to http://localhost:3001 when window is unavailable', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(ok({ paused: true }, 201))
      .mockResolvedValueOnce(ok({ resumed: true, webhookData: {} }));
    const s = new RemoteCorrelationStore({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await s.pause('x', '/wh', makeState(), 5000);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'http://localhost:3001/api/correlations/pause',
    );
  });
});
