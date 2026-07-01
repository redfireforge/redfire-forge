import { describe, expect, it } from 'vitest';
import { resolveGrpcAssertFieldValue } from './grpcWorkflowAssertPath';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

describe('resolveGrpcAssertFieldValue', () => {
  it('resolves unary body fields with $. prefix', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 'u1',
      callType: 'unary',
      status: 'success',
      body: { message: 'hello' },
    };
    expect(resolveGrpcAssertFieldValue('$.message', result)).toBe('hello');
  });

  it('resolves last stream message field by default', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
      messages: [{ phase: 'start' }, { phase: 'done' }],
    };
    expect(resolveGrpcAssertFieldValue('$.phase', result)).toBe('done');
  });

  it('resolves indexed stream messages', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
      messages: [{ n: 1 }, { n: 2 }],
    };
    expect(resolveGrpcAssertFieldValue('messages[0].n', result)).toBe(1);
  });
});
