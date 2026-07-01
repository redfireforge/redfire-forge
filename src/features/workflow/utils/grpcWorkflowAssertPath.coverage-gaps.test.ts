/**
 * Coverage gaps — grpcWorkflowAssertPath.ts
 */
import { describe, expect, it } from 'vitest';
import { resolveGrpcAssertFieldValue } from './grpcWorkflowAssertPath';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

describe('grpcWorkflowAssertPath coverage gaps', () => {
  it('returns undefined for blank field paths', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 'u1',
      callType: 'unary',
      status: 'success',
      body: { message: 'hello' },
    };
    expect(resolveGrpcAssertFieldValue('   ', result)).toBeUndefined();
  });

  it('resolves unary body fields without $. prefix', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 'u1',
      callType: 'unary',
      status: 'success',
      body: { message: 'hello' },
    };
    expect(resolveGrpcAssertFieldValue('message', result)).toBe('hello');
  });

  it('resolves stream message fields without $. prefix', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
      messages: [{ phase: 'start' }, { phase: 'done' }],
    };
    expect(resolveGrpcAssertFieldValue('phase', result)).toBe('done');
  });

  it('resolves indexed stream messages via messages[n] prefix', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
      messages: [{ n: 1 }, { n: 2 }],
    };
    expect(resolveGrpcAssertFieldValue('messages[0].n', result)).toBe(1);
  });

  it('handles empty messages array for stream results', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
      messages: [],
    };
    expect(resolveGrpcAssertFieldValue('$.phase', result)).toBeUndefined();
  });

  it('resolves unary fields when body is undefined', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 'u1',
      callType: 'unary',
      status: 'success',
    };
    expect(resolveGrpcAssertFieldValue('message', result)).toBeUndefined();
  });

  it('resolves stream fields when messages is undefined', () => {
    const result: GrpcWorkflowStepResult = {
      nodeId: 's1',
      callType: 'server_streaming',
      status: 'success',
    };
    expect(resolveGrpcAssertFieldValue('phase', result)).toBeUndefined();
  });
});
