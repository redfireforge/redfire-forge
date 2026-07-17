/**
 * Coverage gaps — grpcWorkflowStepResultStore.ts
 */
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
  trailers: { 'grpc-status': '0' },
  messages: [{ n: 1 }],
  assertionFailures: ['assertions[0]: failed'],
};

describe('GrpcWorkflowStepResultStore coverage gaps', () => {
  it('getByNodeId returns committed results', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    expect(store.getByNodeId('grpc-1')?.body).toEqual({ message: 'hello' });
    expect(store.getByNodeId('missing')).toBeUndefined();
  });

  it('listNodeIds returns committed node ids', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    store.commit('grpc-2', undefined, { ...unarySuccess, nodeId: 'grpc-2' });
    expect(store.listNodeIds().sort()).toEqual(['grpc-1', 'grpc-2']);
  });

  it('resolveSource returns undefined for blank source', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    expect(store.resolveSource('   ')).toBeUndefined();
  });

  it('commit ignores blank saveAs aliases', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', '   ', unarySuccess);
    expect(store.resolveSource('grpc-1')?.nodeId).toBe('grpc-1');
  });

  it('freezes committed step results and shallow-copies nested payloads', () => {
    const store = new GrpcWorkflowStepResultStore();
    store.commit('grpc-1', undefined, unarySuccess);
    const resolved = store.getByNodeId('grpc-1');
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(resolved?.body).toEqual({ message: 'hello' });
    expect(resolved?.body).not.toBe(unarySuccess.body);
    expect(resolved?.messages?.[0]).toEqual({ n: 1 });
    expect(resolved?.messages?.[0]).not.toBe(unarySuccess.messages?.[0]);
    expect(resolved?.trailers).toEqual({ 'grpc-status': '0' });
    expect(resolved?.assertionFailures).toEqual(['assertions[0]: failed']);
  });
});
