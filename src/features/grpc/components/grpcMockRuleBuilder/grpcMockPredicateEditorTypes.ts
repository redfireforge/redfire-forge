import type { GrpcMockBuilderPredicateNode } from '../../utils/grpcMockRuleBuilderModel';

export interface GrpcMockPredicateEditorProps {
  node: GrpcMockBuilderPredicateNode;
  readOnly: boolean;
  disabled: boolean;
  depth: number;
  onChange: (node: GrpcMockBuilderPredicateNode) => void;
  onRemove?: () => void;
}
