/**
 * Phase 11N — validators for advanced gRPC workflow nodes.
 */
import { assertGrpcLoadTestConfig } from '@shared/grpc/grpcAdvancedFeatureContracts';
import type {
  GrpcLoadTestNodeData,
  GrpcMockAssertNodeData,
  GrpcSchemaDiffNodeData,
} from '../types/workflow/node-grpc-advanced';
import {
  GRPC_WORKFLOW_VALIDATION_CODES,
  type GrpcWorkflowValidationIssue,
  validateGrpcUnaryNodeData,
} from './grpcWorkflowNodeValidation';
import type { GrpcUnaryNodeData } from '../types/workflow/node-grpc';

function issue(
  field: string,
  code: (typeof GRPC_WORKFLOW_VALIDATION_CODES)[keyof typeof GRPC_WORKFLOW_VALIDATION_CODES],
  message: string,
  nodeId?: string,
): GrpcWorkflowValidationIssue {
  return { nodeId, field, code, message };
}

export function validateGrpcLoadTestNodeData(
  data: GrpcLoadTestNodeData,
  nodeId?: string,
): { valid: boolean; issues: GrpcWorkflowValidationIssue[] } {
  const unaryResult = validateGrpcUnaryNodeData(data as GrpcUnaryNodeData, nodeId);
  if (!unaryResult.valid) {
    return unaryResult;
  }
  const hasInlineConfig = data.loadTest != null;
  const hasProfileId = Boolean(data.profileId?.trim());
  if (!hasInlineConfig && !hasProfileId) {
    return {
      valid: false,
      issues: [issue(
        'loadTest',
        GRPC_WORKFLOW_VALIDATION_CODES.INVALID_BODY,
        'Either inline loadTest config or profileId is required',
        nodeId,
      )],
    };
  }
  if (hasInlineConfig) {
    try {
      assertGrpcLoadTestConfig('unary', data.loadTest!);
    } catch (error) {
      return {
        valid: false,
        issues: [issue(
          'loadTest',
          GRPC_WORKFLOW_VALIDATION_CODES.INVALID_BODY,
          error instanceof Error ? error.message : String(error),
          nodeId,
        )],
      };
    }
  }
  return { valid: true, issues: [] };
}

export function validateGrpcSchemaDiffNodeData(
  data: GrpcSchemaDiffNodeData,
  nodeId?: string,
): { valid: boolean; issues: GrpcWorkflowValidationIssue[] } {
  const issues: GrpcWorkflowValidationIssue[] = [];
  if (!data.label?.trim()) {
    issues.push(issue('label', GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL, 'Label is required', nodeId));
  }
  if (!data.leftDescriptorKey?.trim()) {
    issues.push(issue(
      'leftDescriptorKey',
      GRPC_WORKFLOW_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY,
      'Left descriptor key is required',
      nodeId,
    ));
  }
  if (!data.rightDescriptorKey?.trim()) {
    issues.push(issue(
      'rightDescriptorKey',
      GRPC_WORKFLOW_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY,
      'Right descriptor key is required',
      nodeId,
    ));
  }
  return { valid: issues.length === 0, issues };
}

export function validateGrpcMockAssertNodeData(
  data: GrpcMockAssertNodeData,
  nodeId?: string,
): { valid: boolean; issues: GrpcWorkflowValidationIssue[] } {
  const issues: GrpcWorkflowValidationIssue[] = [];
  if (!data.label?.trim()) {
    issues.push(issue('label', GRPC_WORKFLOW_VALIDATION_CODES.MISSING_LABEL, 'Label is required', nodeId));
  }
  if (!data.listenTarget?.trim()) {
    issues.push(issue(
      'listenTarget',
      GRPC_WORKFLOW_VALIDATION_CODES.MISSING_TARGET,
      'Mock listen target is required',
      nodeId,
    ));
  }
  if (!data.descriptorKey?.trim()) {
    issues.push(issue(
      'descriptorKey',
      GRPC_WORKFLOW_VALIDATION_CODES.MISSING_DESCRIPTOR_KEY,
      'Descriptor key is required',
      nodeId,
    ));
  }
  if (!data.service?.trim()) {
    issues.push(issue('service', GRPC_WORKFLOW_VALIDATION_CODES.MISSING_SERVICE, 'Service is required', nodeId));
  }
  if (!data.method?.trim()) {
    issues.push(issue('method', GRPC_WORKFLOW_VALIDATION_CODES.MISSING_METHOD, 'Method is required', nodeId));
  }
  if (data.expectedBodyPath?.trim() && data.expectedBodyValue === undefined) {
    issues.push(issue(
      'expectedBodyValue',
      GRPC_WORKFLOW_VALIDATION_CODES.INVALID_BODY,
      'Expected body value is required when path is set',
      nodeId,
    ));
  }
  return { valid: issues.length === 0, issues };
}
