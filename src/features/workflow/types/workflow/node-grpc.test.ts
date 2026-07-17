import { describe, expect, it } from 'vitest';
import {
  isGrpcWorkflowCallNodeType,
  isGrpcWorkflowNodeType,
  isGrpcWorkflowNodeTypeIncludingAdvanced,
} from './node-grpc';

describe('node-grpc type guards', () => {
  it('recognizes base grpc workflow node types', () => {
    expect(isGrpcWorkflowNodeType('grpcUnary')).toBe(true);
    expect(isGrpcWorkflowNodeType('grpcServerStream')).toBe(true);
    expect(isGrpcWorkflowNodeType('grpcAssert')).toBe(true);
    expect(isGrpcWorkflowNodeType('http')).toBe(false);
  });

  it('recognizes advanced grpc node types and nullish guard branch', () => {
    expect(isGrpcWorkflowNodeTypeIncludingAdvanced('grpcLoadTest')).toBe(true);
    expect(isGrpcWorkflowNodeTypeIncludingAdvanced('grpcSchemaDiff')).toBe(true);
    expect(isGrpcWorkflowNodeTypeIncludingAdvanced('grpcMockAssert')).toBe(true);
    expect(isGrpcWorkflowNodeTypeIncludingAdvanced('grpcUnary')).toBe(true);
    expect(isGrpcWorkflowNodeTypeIncludingAdvanced(undefined)).toBe(false);
  });

  it('recognizes grpc call node types only', () => {
    expect(isGrpcWorkflowCallNodeType('grpcUnary')).toBe(true);
    expect(isGrpcWorkflowCallNodeType('grpcServerStream')).toBe(true);
    expect(isGrpcWorkflowCallNodeType('grpcAssert')).toBe(false);
    expect(isGrpcWorkflowCallNodeType(undefined)).toBe(false);
  });
});
