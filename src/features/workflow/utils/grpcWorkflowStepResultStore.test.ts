import { describe, expect, it } from 'vitest';
import { GrpcWorkflowStepResultStore } from './grpcWorkflowStepResultStore';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

const unarySuccess: GrpcWorkflowStepResult = {
  nodeId: 'grpc-1',
  callType: 'unary',
  status: 'success',
  grpcStatus: 0,
  grpcStatusMessage: 'OK',
  body: { message: 'hello' },
  durationMs: 12,
};

describe('GrpcWorkflowStepResultStore', () => {
  it('commits and resolves by node id', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    expect(store.resolveSource('grpc-1')).toEqual(unarySuccess);
  });

  it('resolves by saveAs alias', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', 'echoCall', unarySuccess);
    expect(store.resolveSource('echoCall')?.nodeId).toBe('grpc-1');
  });

  it('returns committed results by reference from store', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    const resolved = store.resolveSource('grpc-1');
    expect(resolved?.body).toEqual({ message: 'hello' });
    expect(resolved).not.toBe(unarySuccess);
  });

  it('returns undefined for unknown source', () => {
    const store = new GrpcWorkflowStepResultStore();
    expect(store.resolveSource('missing')).toBeUndefined();
  });

  it('rejects duplicate saveAs alias at runtime', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('node-a', 'echo', unarySuccess);
    expect(() => store.commit('node-b', 'echo', unarySuccess)).toThrow(/saveAs alias/);
  });
});
