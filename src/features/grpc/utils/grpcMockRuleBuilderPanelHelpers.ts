import type {
  GrpcMockBuilderModel,
  GrpcMockBuilderPredicateLeafKind,
  GrpcMockBuilderPredicateNode,
  GrpcMockBuilderRuleRow,
} from './grpcMockRuleBuilderModel';

export const GRPC_MOCK_PREDICATE_KIND_OPTIONS: Array<{ value: GrpcMockBuilderPredicateLeafKind; label: string }> = [
  { value: 'method_equals', label: 'Method equals' },
  { value: 'service_equals', label: 'Service equals' },
  { value: 'metadata_equals', label: 'Metadata equals' },
  { value: 'metadata_exists', label: 'Metadata exists' },
  { value: 'body_path_equals', label: 'Body path equals' },
  { value: 'body_path_exists', label: 'Body path exists' },
];

export const GRPC_MOCK_STATUS_OPTIONS: Array<{ code: number; name: string; description: string }> = [
  { code: 0, name: 'OK', description: 'Success.' },
  { code: 1, name: 'CANCELLED', description: 'Operation was cancelled by the caller.' },
  { code: 2, name: 'UNKNOWN', description: 'Unknown error.' },
  { code: 3, name: 'INVALID_ARGUMENT', description: 'Client supplied an invalid argument.' },
  { code: 4, name: 'DEADLINE_EXCEEDED', description: 'Deadline expired before completion.' },
  { code: 5, name: 'NOT_FOUND', description: 'Requested entity was not found.' },
  { code: 6, name: 'ALREADY_EXISTS', description: 'Entity already exists.' },
  { code: 7, name: 'PERMISSION_DENIED', description: 'Caller does not have permission.' },
  { code: 8, name: 'RESOURCE_EXHAUSTED', description: 'Resource or quota exhausted.' },
  { code: 9, name: 'FAILED_PRECONDITION', description: 'System state does not allow this operation now.' },
  { code: 10, name: 'ABORTED', description: 'Operation aborted, typically due to concurrency conflict.' },
  { code: 11, name: 'OUT_OF_RANGE', description: 'Operation attempted past valid range.' },
  { code: 12, name: 'UNIMPLEMENTED', description: 'Operation is not implemented or not supported.' },
  { code: 13, name: 'INTERNAL', description: 'Internal server error.' },
  { code: 14, name: 'UNAVAILABLE', description: 'Service is currently unavailable; retry may succeed.' },
  { code: 15, name: 'DATA_LOSS', description: 'Unrecoverable data loss or corruption.' },
  { code: 16, name: 'UNAUTHENTICATED', description: 'Missing or invalid authentication credentials.' },
];

export function getGrpcMockStatusOption(code: number): { code: number; name: string; description: string } | undefined {
  return GRPC_MOCK_STATUS_OPTIONS.find((entry) => entry.code === code);
}

export function matchesGrpcMockBuilderSearch(rule: GrpcMockBuilderRuleRow, query: string): boolean {
  const q = query.toLowerCase();
  if (rule.name.toLowerCase().includes(q)) return true;
  return matchesGrpcMockBuilderPredicateSearch(rule.predicate, q);
}

export function matchesGrpcMockBuilderPredicateSearch(node: GrpcMockBuilderPredicateNode, q: string): boolean {
  if (node.type === 'leaf') {
    if (node.method?.toLowerCase().includes(q)) return true;
    if (node.service?.toLowerCase().includes(q)) return true;
    if (node.key?.toLowerCase().includes(q)) return true;
    return false;
  }
  if (node.type === 'group') {
    return node.children.some((child) => matchesGrpcMockBuilderPredicateSearch(child, q));
  }
  if (node.type === 'expression') {
    return node.expression.toLowerCase().includes(q);
  }
  return false;
}

export function nextGrpcMockBuilderRulePriority(model: GrpcMockBuilderModel): number {
  if (model.rules.length === 0) {
    return 1;
  }
  return Math.max(...model.rules.map((rule) => rule.priority)) + 1;
}

export function updateGrpcMockBuilderRuleRow(
  model: GrpcMockBuilderModel,
  ruleId: string,
  patch: Partial<GrpcMockBuilderRuleRow>,
): GrpcMockBuilderModel {
  return {
    ...model,
    rules: model.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
  };
}
