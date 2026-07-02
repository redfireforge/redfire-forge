import { useMemo } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { parseGrpcMockRuleSetJsonForBuilder, summarizeMockRulePredicate } from '../utils/grpcStudioAdvancedModel';
import {
  createDefaultGrpcMockBuilderPredicateLeaf,
  createDefaultGrpcMockBuilderRuleRow,
  buildGrpcMockBuilderPredicateNodeId,
  createGrpcMockBuilderNodeId,
  formatGrpcMockBuilderIssues,
  GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH,
  measureGrpcMockBuilderPredicateDepth,
  parseGrpcMockRuleSetToBuilderModel,
  serializeGrpcMockBuilderModelToStableJson,
  type GrpcMockBuilderModel,
  type GrpcMockBuilderPredicateGroup,
  type GrpcMockBuilderPredicateLeaf,
  type GrpcMockBuilderPredicateLeafKind,
  type GrpcMockBuilderPredicateNode,
  type GrpcMockBuilderRuleRow,
  validateGrpcMockBuilderModel,
} from '../utils/grpcMockRuleBuilderModel';

export interface GrpcMockRuleBuilderPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

const PREDICATE_KIND_OPTIONS: Array<{ value: GrpcMockBuilderPredicateLeafKind; label: string }> = [
  { value: 'method_equals', label: 'Method equals' },
  { value: 'service_equals', label: 'Service equals' },
  { value: 'metadata_equals', label: 'Metadata equals' },
  { value: 'metadata_exists', label: 'Metadata exists' },
  { value: 'body_path_equals', label: 'Body path equals' },
  { value: 'body_path_exists', label: 'Body path exists' },
];

function nextRulePriority(model: GrpcMockBuilderModel): number {
  if (model.rules.length === 0) {
    return 1;
  }
  return Math.max(...model.rules.map((rule) => rule.priority)) + 1;
}

function updateRuleRow(
  model: GrpcMockBuilderModel,
  ruleId: string,
  patch: Partial<GrpcMockBuilderRuleRow>,
): GrpcMockBuilderModel {
  return {
    ...model,
    rules: model.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
  };
}

interface PredicateEditorProps {
  node: GrpcMockBuilderPredicateNode;
  readOnly: boolean;
  disabled: boolean;
  depth: number;
  onChange: (node: GrpcMockBuilderPredicateNode) => void;
  onRemove?: () => void;
}

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
      <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
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
          {PREDICATE_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="grpc-mock-builder-check">
        <input
          type="checkbox"
          data-testid={`grpc-mock-builder-leaf-not-${leaf.nodeId}`}
          checked={leaf.negated}
          disabled={disabled}
          onChange={(event) => onChange({ ...leaf, negated: event.target.checked })}
        />
        <span>Not</span>
      </label>

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
        <label className="grpc-mock-builder-field">
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
        <label className="grpc-mock-builder-field">
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

function PredicateEditor({
  node,
  readOnly,
  disabled,
  depth,
  onChange,
  onRemove,
}: PredicateEditorProps) {
  if (readOnly) {
    if (node.type === 'expression') {
      return (
        <div className="grpc-mock-builder-readonly" data-testid={`grpc-mock-builder-readonly-${node.nodeId}`}>
          <span className="grpc-mock-builder-badge">Expression</span>
          <code className="grpc-mock-builder-readonly__expr">{node.expression}</code>
          <p className="grpc-mock-builder-hint">Edit this predicate in the JSON tab.</p>
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
            : 'Complex predicate — edit in JSON tab.'}
        </code>
        <p className="grpc-mock-builder-hint">Edit this predicate in the JSON tab.</p>
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
          <PredicateEditor
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

export function GrpcMockRuleBuilderPanel({ advanced }: GrpcMockRuleBuilderPanelProps) {
  // Rules hot-swap to in-process + network listener while runtime is running (Phase 11M).
  const disabled = false;
  const parsed = useMemo(
    () => parseGrpcMockRuleSetJsonForBuilder(advanced.mockServer.rulesJson),
    [advanced.mockServer.rulesJson],
  );

  const builderModel = useMemo(() => {
    if (!parsed.ok) {
      return undefined;
    }
    return parseGrpcMockRuleSetToBuilderModel(parsed.ruleSet);
  }, [parsed]);

  const builderIssues = useMemo(() => {
    if (!builderModel) {
      return [];
    }
    return validateGrpcMockBuilderModel(builderModel);
  }, [builderModel]);

  const applyModel = (model: GrpcMockBuilderModel) => {
    advanced.patchMockRulesJson(serializeGrpcMockBuilderModelToStableJson(model));
  };

  const convertRulePredicateToGroup = (rule: GrpcMockBuilderRuleRow) => {
    if (rule.predicateReadOnly || rule.predicate.type === 'group') {
      return;
    }
    applyModel(updateRuleRow(builderModel!, rule.id, {
      predicate: {
        nodeId: buildGrpcMockBuilderPredicateNodeId(rule.id, 'root'),
        type: 'group',
        combinator: 'and',
        children: [rule.predicate],
      },
    }));
  };

  if (!parsed.ok) {
    return (
      <div className="grpc-mock-builder-panel" data-testid="grpc-mock-builder-panel">
        <p className="grpc-mock-builder-hint grpc-mock-builder-hint--error" data-testid="grpc-mock-builder-parse-error">
          {parsed.error}
        </p>
      </div>
    );
  }

  if (!builderModel) {
    return null;
  }

  return (
    <div className="grpc-mock-builder-panel" data-testid="grpc-mock-builder-panel">
      <div className="grpc-mock-builder-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="grpc-mock-builder-add-rule"
          disabled={disabled}
          onClick={() => {
            applyModel({
              ...builderModel,
              rules: [...builderModel.rules, createDefaultGrpcMockBuilderRuleRow(nextRulePriority(builderModel))],
            });
          }}
        >
          + Add rule
        </button>
      </div>

      {builderIssues.length > 0 && (
        <p className="grpc-mock-builder-hint grpc-mock-builder-hint--error" data-testid="grpc-mock-builder-validation">
          {formatGrpcMockBuilderIssues(builderIssues)}
        </p>
      )}

      {advanced.mockServer.parseError && (
        <p className="grpc-mock-builder-hint grpc-mock-builder-hint--error" data-testid="grpc-mock-builder-start-blocked">
          Start blocked: {advanced.mockServer.parseError}
        </p>
      )}

      <div className="grpc-mock-builder-rules">
        {builderModel.rules.map((rule) => (
          <article
            key={rule.id}
            className={`grpc-mock-builder-rule${rule.enabled ? ' grpc-mock-builder-rule--on' : ''}`}
            data-testid={`grpc-mock-builder-rule-${rule.id}`}
          >
            <header className="grpc-mock-builder-rule__header">
              <label className="grpc-mock-builder-check">
                <input
                  type="checkbox"
                  data-testid={`grpc-mock-builder-enabled-${rule.id}`}
                  checked={rule.enabled}
                  disabled={disabled}
                  onChange={(event) => {
                    applyModel(updateRuleRow(builderModel, rule.id, { enabled: event.target.checked }));
                  }}
                />
                <span>Enabled</span>
              </label>
              <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
                <span className="grpc-mock-builder-field__label">Name</span>
                <input
                  className="grpc-mock-builder-input"
                  data-testid={`grpc-mock-builder-name-${rule.id}`}
                  value={rule.name}
                  disabled={disabled}
                  onChange={(event) => {
                    applyModel(updateRuleRow(builderModel, rule.id, { name: event.target.value }));
                  }}
                />
              </label>
              <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
                <span className="grpc-mock-builder-field__label">Priority</span>
                <input
                  type="number"
                  className="grpc-mock-builder-input grpc-mock-builder-input--narrow"
                  data-testid={`grpc-mock-builder-priority-${rule.id}`}
                  value={rule.priority}
                  disabled={disabled}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    applyModel(updateRuleRow(builderModel, rule.id, {
                      priority: Number.isFinite(value) ? value : rule.priority,
                    }));
                  }}
                />
              </label>
              <label className="grpc-mock-builder-check">
                <input
                  type="checkbox"
                  data-testid={`grpc-mock-builder-fallthrough-${rule.id}`}
                  checked={rule.fallthrough}
                  disabled={disabled}
                  onChange={(event) => {
                    applyModel(updateRuleRow(builderModel, rule.id, { fallthrough: event.target.checked }));
                  }}
                />
                <span>Fallthrough</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                data-testid={`grpc-mock-builder-delete-rule-${rule.id}`}
                disabled={disabled}
                onClick={() => {
                  applyModel({
                    ...builderModel,
                    rules: builderModel.rules.filter((entry) => entry.id !== rule.id),
                  });
                }}
              >
                Delete
              </button>
            </header>

            <div className="grpc-mock-builder-rule__body">
              <div className="grpc-mock-builder-section">
                <div className="grpc-mock-builder-section__title">When</div>
                {!rule.predicateReadOnly && rule.predicate.type === 'leaf' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    data-testid={`grpc-mock-builder-convert-group-${rule.id}`}
                    disabled={disabled}
                    onClick={() => convertRulePredicateToGroup(rule)}
                  >
                    Convert to group
                  </button>
                )}
                {rule.predicateReadOnly ? (
                  <div
                    className="grpc-mock-builder-readonly"
                    data-testid={`grpc-mock-builder-readonly-rule-${rule.id}`}
                  >
                    <span className="grpc-mock-builder-badge">Read-only</span>
                    <code className="grpc-mock-builder-readonly__expr">
                      {rule.originalPredicate
                        ? summarizeMockRulePredicate({
                          id: rule.id,
                          name: rule.name,
                          enabled: rule.enabled,
                          priority: rule.priority,
                          predicate: rule.originalPredicate,
                          response: {},
                        })
                        : rule.predicate.type === 'expression'
                          ? rule.predicate.expression
                          : 'Complex predicate — edit in JSON tab.'}
                    </code>
                    <p className="grpc-mock-builder-hint">Edit this predicate in the JSON tab.</p>
                  </div>
                ) : (
                  <PredicateEditor
                    node={rule.predicate}
                    readOnly={false}
                    disabled={disabled}
                    depth={1}
                    onChange={(predicate) => {
                      if (measureGrpcMockBuilderPredicateDepth(predicate) > GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH) {
                        return;
                      }
                      applyModel(updateRuleRow(builderModel, rule.id, { predicate }));
                    }}
                  />
                )}
              </div>

              <div className="grpc-mock-builder-section">
                <div className="grpc-mock-builder-section__title">Then respond</div>
                <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
                  <span className="grpc-mock-builder-field__label">Status code</span>
                  <input
                    type="number"
                    min={0}
                    className="grpc-mock-builder-input grpc-mock-builder-input--narrow"
                    data-testid={`grpc-mock-builder-status-${rule.id}`}
                    value={rule.responseStatusCode ?? ''}
                    disabled={disabled}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      applyModel(updateRuleRow(builderModel, rule.id, {
                        responseStatusCode: Number.isFinite(value) ? value : undefined,
                      }));
                    }}
                  />
                </label>
                <label className="grpc-mock-builder-field grpc-mock-builder-field--stacked">
                  <span className="grpc-mock-builder-field__label">Response body (JSON)</span>
                  <textarea
                    className="grpc-mock-builder-textarea"
                    rows={4}
                    data-testid={`grpc-mock-builder-body-${rule.id}`}
                    value={rule.responseBodyText}
                    disabled={disabled}
                    onChange={(event) => {
                      applyModel(updateRuleRow(builderModel, rule.id, { responseBodyText: event.target.value }));
                    }}
                  />
                </label>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** @internal Exported for coverage tests only (updated panel). */
export function GrpcMockPredicateEditorForTests(props: PredicateEditorProps) {
  return <PredicateEditor {...props} />;
}
