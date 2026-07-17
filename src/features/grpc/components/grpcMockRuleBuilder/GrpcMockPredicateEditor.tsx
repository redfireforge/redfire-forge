import { summarizeMockRulePredicate } from '../../utils/grpcStudioAdvancedModel';
import {
  createDefaultGrpcMockBuilderPredicateLeaf,
  createGrpcMockBuilderNodeId,
  GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH,
  type GrpcMockBuilderPredicateGroup,
  type GrpcMockBuilderPredicateLeaf,
  type GrpcMockBuilderPredicateLeafKind,
} from '../../utils/grpcMockRuleBuilderModel';
import { GRPC_MOCK_PREDICATE_KIND_OPTIONS } from '../../utils/grpcMockRuleBuilderPanelHelpers';
import type { GrpcMockPredicateEditorProps } from './grpcMockPredicateEditorTypes';

function LeafPredicateEditor({
  leaf,
  disabled,
  onChange,
}: {
  leaf: GrpcMockBuilderPredicateLeaf;
  disabled: boolean;
  onChange: (leaf: GrpcMockBuilderPredicateLeaf) => void;
}) {
  return (
    <div className="grpc-mock-builder-predicate-leaf" data-testid={`grpc-mock-builder-leaf-${leaf.nodeId}`}>
      <div className="grpc-mock-builder-predicate-row">
        <label className="grpc-mock-builder-field grpc-mock-builder-field--inline grpc-mock-builder-field--inline-fixed-label">
          <span className="grpc-mock-builder-field__label">Predicate</span>
          <select
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-kind-${leaf.nodeId}`}
            value={leaf.kind}
            disabled={disabled}
            onChange={(event) => {
              const kind = event.target.value as GrpcMockBuilderPredicateLeafKind;
              onChange({
                ...leaf,
                kind,
                method: undefined,
                service: undefined,
                key: undefined,
                value: undefined,
                path: undefined,
              });
            }}
          >
            {GRPC_MOCK_PREDICATE_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grpc-mock-builder-check grpc-mock-builder-check--not">
          <input
            type="checkbox"
            data-testid={`grpc-mock-builder-leaf-not-${leaf.nodeId}`}
            checked={leaf.negated}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, negated: event.target.checked })}
          />
          <span>Not</span>
        </label>
      </div>

      {leaf.kind === 'method_equals' && (
        <label className="grpc-mock-builder-field">
          <span className="grpc-mock-builder-field__label">Method</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-method-${leaf.nodeId}`}
            value={leaf.method ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, method: event.target.value })}
          />
        </label>
      )}
      {leaf.kind === 'service_equals' && (
        <label className="grpc-mock-builder-field">
          <span className="grpc-mock-builder-field__label">Service</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-service-${leaf.nodeId}`}
            value={leaf.service ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, service: event.target.value })}
          />
        </label>
      )}
      {(leaf.kind === 'metadata_equals' || leaf.kind === 'metadata_exists') && (
        <label className="grpc-mock-builder-field">
          <span className="grpc-mock-builder-field__label">Metadata key</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-key-${leaf.nodeId}`}
            value={leaf.key ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, key: event.target.value })}
          />
        </label>
      )}
      {leaf.kind === 'metadata_equals' && (
        <label className="grpc-mock-builder-field">
          <span className="grpc-mock-builder-field__label">Metadata value</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-value-${leaf.nodeId}`}
            value={leaf.value ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, value: event.target.value })}
          />
        </label>
      )}
      {(leaf.kind === 'body_path_equals' || leaf.kind === 'body_path_exists') && (
        <label className="grpc-mock-builder-field grpc-mock-builder-field--inline grpc-mock-builder-field--inline-grow grpc-mock-builder-field--inline-fixed-label">
          <span className="grpc-mock-builder-field__label">Body path</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-path-${leaf.nodeId}`}
            value={leaf.path ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, path: event.target.value })}
          />
        </label>
      )}
      {leaf.kind === 'body_path_equals' && (
        <label className="grpc-mock-builder-field grpc-mock-builder-field--inline grpc-mock-builder-field--inline-grow grpc-mock-builder-field--inline-fixed-label">
          <span className="grpc-mock-builder-field__label">Expected value</span>
          <input
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-leaf-body-value-${leaf.nodeId}`}
            value={leaf.value ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...leaf, value: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}

export function GrpcMockPredicateEditor({
  node,
  readOnly,
  disabled,
  depth,
  onChange,
  onRemove,
}: GrpcMockPredicateEditorProps) {
  if (readOnly) {
    if (node.type === 'expression') {
      return (
        <div className="grpc-mock-builder-readonly" data-testid={`grpc-mock-builder-readonly-${node.nodeId}`}>
          <span className="grpc-mock-builder-badge">Expression</span>
          <code className="grpc-mock-builder-readonly__expr">{node.expression}</code>
          <p className="grpc-mock-builder-hint">Edit this predicate in the JSON editor.</p>
        </div>
      );
    }
    return (
      <div className="grpc-mock-builder-readonly" data-testid={`grpc-mock-builder-readonly-${node.nodeId}`}>
        <span className="grpc-mock-builder-badge">Read-only</span>
        <code className="grpc-mock-builder-readonly__expr">
          {node.type === 'leaf'
            ? summarizeMockRulePredicate({
              id: 'readonly',
              name: 'readonly',
              enabled: true,
              priority: 1,
              predicate: {
                kind: node.kind,
                ...(node.kind === 'method_equals' ? { method: node.method ?? '' } : {}),
                ...(node.kind === 'service_equals' ? { service: node.service ?? '' } : {}),
                ...(node.kind === 'metadata_equals' ? { key: node.key ?? '', value: node.value ?? '' } : {}),
                ...(node.kind === 'metadata_exists' ? { key: node.key ?? '' } : {}),
                ...(node.kind === 'body_path_equals' ? { path: node.path ?? '', value: node.value ?? '' } : {}),
                ...(node.kind === 'body_path_exists' ? { path: node.path ?? '' } : {}),
              } as never,
              response: {},
            })
            : 'Complex predicate — edit in JSON editor.'}
        </code>
        <p className="grpc-mock-builder-hint">Edit this predicate in the JSON editor.</p>
      </div>
    );
  }

  if (node.type === 'leaf') {
    return (
      <div className="grpc-mock-builder-predicate-block">
        <LeafPredicateEditor
          leaf={node}
          disabled={disabled}
          onChange={onChange}
        />
        {onRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            data-testid={`grpc-mock-builder-remove-predicate-${node.nodeId}`}
            disabled={disabled}
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>
    );
  }

  if (node.type === 'expression') {
    return null;
  }

  const group = node;
  const canNest = depth + 1 < GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH;

  return (
    <div className="grpc-mock-builder-group" data-testid={`grpc-mock-builder-group-${group.nodeId}`}>
      <div className="grpc-mock-builder-group__header">
        <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
          <span className="grpc-mock-builder-field__label">Group</span>
          <select
            className="grpc-mock-builder-input"
            data-testid={`grpc-mock-builder-group-combinator-${group.nodeId}`}
            value={group.combinator}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...group,
                combinator: event.target.value as GrpcMockBuilderPredicateGroup['combinator'],
              });
            }}
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        </label>
        {onRemove && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            data-testid={`grpc-mock-builder-remove-group-${group.nodeId}`}
            disabled={disabled}
            onClick={onRemove}
          >
            Remove group
          </button>
        )}
      </div>

      <div className="grpc-mock-builder-group__children">
        {group.children.map((child) => (
          <GrpcMockPredicateEditor
            key={child.nodeId}
            node={child}
            readOnly={readOnly}
            disabled={disabled}
            depth={depth + 1}
            onChange={(nextChild) => {
              onChange({
                ...group,
                children: group.children.map((entry) => (
                  entry.nodeId === child.nodeId ? nextChild : entry
                )),
              });
            }}
            onRemove={() => {
              const children = group.children.filter((entry) => entry.nodeId !== child.nodeId);
              onChange({ ...group, children });
            }}
          />
        ))}
      </div>

      <div className="grpc-mock-builder-group__actions">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          data-testid={`grpc-mock-builder-add-leaf-${group.nodeId}`}
          disabled={disabled}
          onClick={() => {
            onChange({
              ...group,
              children: [...group.children, createDefaultGrpcMockBuilderPredicateLeaf()],
            });
          }}
        >
          + Leaf
        </button>
        {canNest && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            data-testid={`grpc-mock-builder-add-group-${group.nodeId}`}
            disabled={disabled}
            onClick={() => {
              onChange({
                ...group,
                children: [...group.children, {
                  nodeId: createGrpcMockBuilderNodeId('group'),
                  type: 'group',
                  combinator: 'and',
                  children: [createDefaultGrpcMockBuilderPredicateLeaf()],
                }],
              });
            }}
          >
            + Nested group
          </button>
        )}
      </div>
    </div>
  );
}

/** @internal Exported for coverage tests only. */
export function GrpcMockPredicateEditorForTests(props: GrpcMockPredicateEditorProps) {
  return <GrpcMockPredicateEditor {...props} />;
}
