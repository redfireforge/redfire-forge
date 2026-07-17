/**
 * Coverage gaps — grpcWorkflowNodeValidation.ts
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from '../../../shared/grpc/contractFixtures';
import type {
  GrpcAssertNodeData,
  GrpcServerStreamNodeData,
  GrpcUnaryNodeData,
} from '../types/workflow/node-grpc';
import {
  defaultGrpcWorkflowTimeoutMs,
  GRPC_WORKFLOW_VALIDATION_CODES,
  validateGrpcAssertNodeData,
  validateGrpcServerStreamNodeData,
  validateGrpcUnaryNodeData,
  validateGrpcWorkflowNodeData,
} from './grpcWorkflowNodeValidation';

function validUnary(overrides: Partial<GrpcUnaryNodeData> = {}): GrpcUnaryNodeData {
  return {
    label: 'Echo',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    callType: 'unary',
    body: { message: 'hello' },
    ...overrides,
  };
}

function validStream(overrides: Partial<GrpcServerStreamNodeData> = {}): GrpcServerStreamNodeData {
  return {
    label: 'Stream',
    target: FIXTURE_UNARY_CALL_REQUEST.target.address,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: 'ServerStreamEcho',
    callType: 'server_streaming',
    body: {},
    collect: { maxMessages: 5 },
    ...overrides,
  };
}

describe('grpcWorkflowNodeValidation coverage gaps', () => {
  it('validateGrpcWorkflowNodeData rejects unsupported node types', () => {
    const result = validateGrpcWorkflowNodeData('http', { label: 'HTTP' });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(GRPC_WORKFLOW_VALIDATION_CODES.UNSUPPORTED_NODE_TYPE);
  });

  it('validateGrpcUnaryNodeData rejects invalid tlsMode, timeout, metadata, auth, and onError', () => {
    const result = validateGrpcUnaryNodeData(validUnary({
      tlsMode: 'invalid' as never,
      timeoutMs: 0,
      metadata: { 'bad key': 'x' },
      auth: { type: 'bearer', bearerToken: '' },
      onError: 'skip' as never,
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TLS_MODE)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TIMEOUT)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_METADATA)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_AUTH)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_ON_ERROR)).toBe(true);
  });

  it('validateGrpcServerStreamNodeData rejects wrong callType and invalid maxDurationMs', () => {
    const wrongType = validateGrpcServerStreamNodeData(validStream({
      callType: 'unary' as never,
    }));
    expect(wrongType.valid).toBe(false);
    expect(wrongType.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_CALL_TYPE)).toBe(true);

    const badDuration = validateGrpcServerStreamNodeData(validStream({
      collect: { maxDurationMs: 0 },
    }));
    expect(badDuration.valid).toBe(false);
    expect(badDuration.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_COLLECT_RULE)).toBe(true);
  });

  it('validateGrpcAssertNodeData rejects missing label and source', () => {
    const result = validateGrpcAssertNodeData({
      label: '',
      source: '',
      assertions: [{ grpcStatus: 0 }],
    } satisfies GrpcAssertNodeData);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL)).toBe(true);
    expect(result.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_ASSERT_SOURCE)).toBe(true);
  });

  it('validateGrpcAssertNodeData rejects empty assertion kinds and operator-less shapes', () => {
    const emptyKind = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{} as never],
    });
    expect(emptyKind.valid).toBe(false);

    const emptyField = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcField: '   ' }],
    });
    expect(emptyField.valid).toBe(false);

    const emptyTrailer = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcTrailer: '   ' }],
    });
    expect(emptyTrailer.valid).toBe(false);

    const emptyDuration = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcDuration: {} }],
    });
    expect(emptyDuration.valid).toBe(false);

    const emptyStreamLength = validateGrpcAssertNodeData({
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcStreamLength: {} }],
    });
    expect(emptyStreamLength.valid).toBe(false);
  });

  it('validateGrpcUnaryNodeData rejects missing label and invalid literal target', () => {
    const missingLabel = validateGrpcUnaryNodeData(validUnary({ label: '   ' }));
    expect(missingLabel.valid).toBe(false);
    expect(missingLabel.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL)).toBe(true);

    const invalidTarget = validateGrpcUnaryNodeData(validUnary({ target: 'not-a-target' }));
    expect(invalidTarget.valid).toBe(false);
    expect(invalidTarget.issues.some((i) => i.code === GRPC_WORKFLOW_VALIDATION_CODES.INVALID_TARGET)).toBe(true);
  });

  it('validateGrpcWorkflowNodeData routes grpcAssert through assert validator', () => {
    const result = validateGrpcWorkflowNodeData('grpcAssert', {
      label: 'Assert',
      source: 'grpc-1',
      assertions: [{ grpcStatus: 0 }],
    });
    expect(result.valid).toBe(true);
  });

  it('defaultGrpcWorkflowTimeoutMs returns 30 seconds', () => {
    expect(defaultGrpcWorkflowTimeoutMs()).toBe(30_000);
  });
});
