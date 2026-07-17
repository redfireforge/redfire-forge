import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../../hooks/useGrpcStudioAdvancedFeatures';
import StandardProfessionalModal from '../../../../shared/components/StandardProfessionalModal';
import { parseGrpcMockRuleSetJsonForBuilder, summarizeMockRulePredicate } from '../../utils/grpcStudioAdvancedModel';
import {
  createDefaultGrpcMockBuilderRuleRow,
  buildGrpcMockBuilderPredicateNodeId,
  createGrpcMockBuilderNodeId,
  detectGrpcMockBuilderConflicts,
  formatGrpcMockBuilderIssues,
  GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH,
  measureGrpcMockBuilderPredicateDepth,
  parseGrpcMockRuleSetToBuilderModel,
  serializeGrpcMockBuilderModelToStableJson,
  summarizeBuilderPredicateNode,
  summarizeBuilderRule,
  type GrpcMockBuilderConflict,
  type GrpcMockBuilderModel,
  type GrpcMockBuilderRuleRow,
  validateGrpcMockBuilderModel,
} from '../../utils/grpcMockRuleBuilderModel';
import { generateMockRuleStubsFromDescriptor } from '../../utils/grpcMockProtoStubGenerator';
import {
  getGrpcMockStatusOption,
  GRPC_MOCK_STATUS_OPTIONS,
  matchesGrpcMockBuilderSearch,
  nextGrpcMockBuilderRulePriority,
  updateGrpcMockBuilderRuleRow,
} from '../../utils/grpcMockRuleBuilderPanelHelpers';
import { GrpcMockPredicateEditor } from './GrpcMockPredicateEditor';
import { GrpcMockRuleTester } from './GrpcMockRuleTester';

export interface GrpcMockRuleBuilderPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
  toolbarHost?: HTMLElement | null;
}
export function GrpcMockRuleBuilderPanel({ advanced, toolbarHost = null }: GrpcMockRuleBuilderPanelProps) {
  // Rules hot-swap to in-process + network listener while runtime is running (Phase 11M).
  const disabled = false;
  const [collapsedRules, setCollapsedRules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [testerRuleId, setTesterRuleId] = useState<string | null>(null);
  const [dragRuleId, setDragRuleId] = useState<string | null>(null);
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
  const dragRuleIdRef = useRef<string | null>(null);
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

  const conflicts = useMemo(() => {
    if (!builderModel) return [];
    return detectGrpcMockBuilderConflicts(builderModel);
  }, [builderModel]);

  const conflictsByRuleId = useMemo(() => {
    const map = new Map<string, GrpcMockBuilderConflict[]>();
    for (const c of conflicts) {
      const listA = map.get(c.ruleAId) ?? [];
      listA.push(c);
      map.set(c.ruleAId, listA);
      const listB = map.get(c.ruleBId) ?? [];
      listB.push(c);
      map.set(c.ruleBId, listB);
    }
    return map;
  }, [conflicts]);

  const applyModel = (model: GrpcMockBuilderModel) => {
    advanced.patchMockRulesJson(serializeGrpcMockBuilderModelToStableJson(model));
  };

  const scrollRuleIntoView = (ruleId: string, block: ScrollLogicalPosition = 'center') => {
    requestAnimationFrame(() => {
      const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ruleId}"]`);
      if (!ruleEl) return;
      ruleEl.scrollIntoView({ behavior: 'smooth', block });
    });
  };

  const collapseAllRules = () => {
    if (!builderModel || builderModel.rules.length === 0) return;
    setCollapsedRules(new Set(builderModel.rules.map((rule) => rule.id)));
  };

  const expandAllRules = () => {
    setCollapsedRules(new Set());
  };

  const toggleCollapse = (ruleId: string) => {
    setCollapsedRules((prev) => {
      const next = new Set(prev);
      const wasCollapsed = next.has(ruleId);
      if (wasCollapsed) {
        next.delete(ruleId);
        if (builderModel) {
          const idx = builderModel.rules.findIndex((r) => r.id === ruleId);
          if (idx > 0) {
            for (let i = 0; i < idx; i++) {
              next.add(builderModel.rules[i].id);
            }
          }
        }
        scrollRuleIntoView(ruleId, 'start');
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const toggleTest = (ruleId: string) => {
    setTesterRuleId((prev) => (prev === ruleId ? null : ruleId));
  };

  useEffect(() => {
    if (!testerRuleId || !builderModel) return;
    const stillExists = builderModel.rules.some((rule) => rule.id === testerRuleId);
    if (!stillExists) setTesterRuleId(null);
  }, [testerRuleId, builderModel]);

  const handleDragStart = (e: React.DragEvent, ruleId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-redfire-mock-rule-id', ruleId);
    e.dataTransfer.setData('text/plain', ruleId);
    dragRuleIdRef.current = ruleId;
    setDragRuleId(ruleId);
  };

  const handleDragOver = (e: React.DragEvent, ruleId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragRuleId && dragRuleId !== ruleId) setDragOverRuleId(ruleId);
  };

  const handleDrop = (e: React.DragEvent, targetRuleId: string) => {
    e.preventDefault();
    const draggedId = dragRuleId
      ?? dragRuleIdRef.current
      ?? e.dataTransfer.getData('application/x-redfire-mock-rule-id')
      ?? e.dataTransfer.getData('text/plain');
    if (!draggedId || !builderModel || draggedId === targetRuleId) {
      dragRuleIdRef.current = null;
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const rules = [...builderModel.rules];
    const fromIdx = rules.findIndex((r) => r.id === draggedId);
    const toIdx = rules.findIndex((r) => r.id === targetRuleId);
    if (fromIdx < 0 || toIdx < 0) {
      dragRuleIdRef.current = null;
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const [moved] = rules.splice(fromIdx, 1);
    rules.splice(toIdx, 0, moved);
    const reordered = rules.map((r, idx) => ({ ...r, priority: idx + 1 }));
    applyModel({ ...builderModel, rules: reordered });
    dragRuleIdRef.current = null;
    setDragRuleId(null);
    setDragOverRuleId(null);
  };

  const handleDragEnd = () => {
    requestAnimationFrame(() => {
      dragRuleIdRef.current = null;
      setDragRuleId(null);
      setDragOverRuleId(null);
    });
  };

  const duplicateRule = (rule: GrpcMockBuilderRuleRow) => {
    const newId = createGrpcMockBuilderNodeId('rule');
    const clone: GrpcMockBuilderRuleRow = {
      ...structuredClone(rule),
      id: newId,
      name: `${rule.name} (copy)`,
      priority: nextGrpcMockBuilderRulePriority(builderModel!),
    };
    applyModel({ ...builderModel!, rules: [...builderModel!.rules, clone] });
    scrollRuleIntoView(newId);
  };

  const convertRulePredicateToGroup = (rule: GrpcMockBuilderRuleRow) => {
    if (rule.predicateReadOnly || rule.predicate.type === 'group') {
      return;
    }
    applyModel(updateGrpcMockBuilderRuleRow(builderModel!, rule.id, {
      predicate: {
        nodeId: buildGrpcMockBuilderPredicateNodeId(rule.id, 'root'),
        type: 'group',
        combinator: 'and',
        children: [rule.predicate],
      },
    }));
  };

  const convertRulePredicateToLeaf = (rule: GrpcMockBuilderRuleRow) => {
    if (rule.predicateReadOnly || rule.predicate.type !== 'group') return;
    const onlyChild = rule.predicate.children[0];
    if (rule.predicate.children.length !== 1 || onlyChild?.type !== 'leaf') return;
    applyModel(updateGrpcMockBuilderRuleRow(builderModel!, rule.id, { predicate: onlyChild }));
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

  const canGenerateFromProto = Boolean(
    advanced.activeDescriptor && advanced.activeDescriptor.services.length > 0,
  );
  const hasRules = builderModel.rules.length > 0;

  const toolbar = (
    <div className="grpc-mock-builder-toolbar">
      <input
        className="grpc-mock-builder-search"
        data-testid="grpc-mock-builder-search"
        type="search"
        placeholder="Filter rules by name, method, service…"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        data-testid="grpc-mock-builder-add-rule"
        disabled={disabled}
        onClick={() => {
          setSearchQuery('');
          const newRule = createDefaultGrpcMockBuilderRuleRow(nextGrpcMockBuilderRulePriority(builderModel));
          applyModel({ ...builderModel, rules: [...builderModel.rules, newRule] });
          scrollRuleIntoView(newRule.id);
        }}
      >
        + Add rule
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        data-testid="grpc-mock-builder-generate-stubs"
        disabled={disabled || !canGenerateFromProto}
        title={canGenerateFromProto
          ? 'Generate one mock rule stub per RPC method from the loaded proto descriptor'
          : 'Load a proto descriptor (Schema tab or reflection) to enable Generate from proto'}
        onClick={() => {
          if (!canGenerateFromProto || !advanced.activeDescriptor) return;
          const nextPriority = nextGrpcMockBuilderRulePriority(builderModel);
          const { rules: stubRules } = generateMockRuleStubsFromDescriptor(advanced.activeDescriptor, nextPriority);
          if (stubRules.length > 0) {
            setSearchQuery('');
            applyModel({ ...builderModel, rules: [...builderModel.rules, ...stubRules] });
            setCollapsedRules((prev) => {
              const next = new Set(prev);
              for (const rule of stubRules) next.add(rule.id);
              return next;
            });
            scrollRuleIntoView(stubRules[0].id, 'start');
          }
        }}
      >
        ⚙ Generate from proto
      </button>
      <div className="grpc-mock-builder-toolbar__bulk" role="group" aria-label="Expand or collapse all rules">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="grpc-mock-builder-collapse-all"
          disabled={!hasRules}
          title="Collapse every rule to a compact summary row"
          onClick={collapseAllRules}
        >
          Collapse all
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid="grpc-mock-builder-expand-all"
          disabled={!hasRules}
          title="Expand every rule to show full predicate and response editors"
          onClick={expandAllRules}
        >
          Expand all
        </button>
      </div>
    </div>
  );

  return (
    <div className="grpc-mock-builder-panel" data-testid="grpc-mock-builder-panel">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}

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

      {conflicts.length > 0 && (
        <div className="grpc-mock-builder-hint grpc-mock-builder-hint--warn" data-testid="grpc-mock-builder-conflicts">
          ⚠ {conflicts.length} potential rule conflict{conflicts.length > 1 ? 's' : ''}: {conflicts.map((c) => c.reason).join('; ')}
        </div>
      )}

      {builderModel.rules.length === 0 && (
        <div className="grpc-mock-builder-empty" data-testid="grpc-mock-builder-empty">
          <div className="grpc-mock-builder-empty__icon" aria-hidden="true">⚡</div>
          <div className="grpc-mock-builder-empty__title">No mock rules yet</div>
          <div className="grpc-mock-builder-empty__hint">
            Create your first rule to define how the mock server responds to incoming gRPC calls.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="grpc-mock-builder-empty-add"
            onClick={() => {
              const firstRule = createDefaultGrpcMockBuilderRuleRow(1);
              applyModel({ ...builderModel, rules: [firstRule] });
              scrollRuleIntoView(firstRule.id);
            }}
          >
            + Create first rule
          </button>
        </div>
      )}

      <div className="grpc-mock-builder-rules">
        {builderModel.rules
          .filter((rule) => !searchQuery || matchesGrpcMockBuilderSearch(rule, searchQuery))
          .map((rule) => {
          const isCollapsed = collapsedRules.has(rule.id);
          const responseStatusCode = typeof rule.responseStatusCode === 'number' && Number.isFinite(rule.responseStatusCode)
            ? rule.responseStatusCode
            : 0;
          const statusOption = getGrpcMockStatusOption(responseStatusCode);
          const statusSelectOptions = statusOption
            ? GRPC_MOCK_STATUS_OPTIONS
            : [{ code: responseStatusCode, name: 'CUSTOM', description: 'Custom/non-standard gRPC status code.' }, ...GRPC_MOCK_STATUS_OPTIONS];
          return (
          <article
            key={rule.id}
            className={`grpc-mock-builder-rule mock-server-rule-card${rule.enabled ? ' grpc-mock-builder-rule--on mock-server-rule-card--enabled' : ''}${!rule.enabled ? ' grpc-mock-builder-rule--disabled mock-server-rule-card--disabled' : ''}${dragOverRuleId === rule.id ? ' grpc-mock-builder-rule--drop-target mock-server-rule-card--drop-target' : ''}${dragRuleId === rule.id ? ' grpc-mock-builder-rule--dragging mock-server-rule-card--dragging' : ''}`}
            data-testid={`grpc-mock-builder-rule-${rule.id}`}
            onDragOver={(e) => handleDragOver(e, rule.id)}
            onDrop={(e) => handleDrop(e, rule.id)}
          >
            <header className="grpc-mock-builder-rule__header">
              <span
                className="grpc-mock-builder-drag-handle mock-server-drag-handle"
                draggable
                data-testid={`grpc-mock-builder-drag-${rule.id}`}
                onDragStart={(e) => handleDragStart(e, rule.id)}
                onDragEnd={handleDragEnd}
                title="Drag to reorder"
              >⠿</span>
              <button
                type="button"
                className="grpc-mock-builder-collapse-btn"
                data-testid={`grpc-mock-builder-collapse-${rule.id}`}
                onClick={() => toggleCollapse(rule.id)}
                title={isCollapsed ? 'Expand rule' : 'Collapse rule'}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
              <label className="grpc-mock-builder-check">
                <input
                  type="checkbox"
                  data-testid={`grpc-mock-builder-enabled-${rule.id}`}
                  checked={rule.enabled}
                  disabled={disabled}
                  onChange={(event) => {
                    applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, { enabled: event.target.checked }));
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
                    applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, { name: event.target.value }));
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
                    applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, {
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
                    applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, { fallthrough: event.target.checked }));
                  }}
                />
                <span>Fallthrough</span>
              </label>
              {(conflictsByRuleId.get(rule.id)?.length ?? 0) > 0 && (
                <span
                  className="grpc-mock-builder-conflict-badge"
                  data-testid={`grpc-mock-builder-conflict-${rule.id}`}
                  title={conflictsByRuleId.get(rule.id)!.map((c) => c.reason).join('; ')}
                >
                  ⚠ Conflict
                </span>
              )}
              <div className="grpc-mock-builder-actions-group">
              <button
                type="button"
                className={`btn btn-ghost btn-xs grpc-mock-builder-hover-action${testerRuleId === rule.id ? ' grpc-mock-builder-hover-action--active' : ''}`}
                data-testid={`grpc-mock-builder-test-toggle-${rule.id}`}
                title="Test this rule"
                onClick={() => toggleTest(rule.id)}
              >
                🧪 Test
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs grpc-mock-builder-hover-action"
                data-testid={`grpc-mock-builder-duplicate-rule-${rule.id}`}
                disabled={disabled}
                title="Duplicate rule"
                onClick={() => duplicateRule(rule)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs grpc-mock-builder-hover-action"
                data-testid={`grpc-mock-builder-delete-rule-${rule.id}`}
                disabled={disabled}
                onClick={() => {
                  if (testerRuleId === rule.id) setTesterRuleId(null);
                  applyModel({
                    ...builderModel,
                    rules: builderModel.rules.filter((entry) => entry.id !== rule.id),
                  });
                }}
              >
                Delete
              </button>
              </div>
            </header>

            {isCollapsed && (
              <div className="grpc-mock-builder-rule__summary" data-testid={`grpc-mock-builder-summary-${rule.id}`}>
                <code>{summarizeBuilderRule(rule)}</code>
              </div>
            )}

            {!isCollapsed && (
            <div className="grpc-mock-builder-rule__body">
              <div className="grpc-mock-builder-section">
                <div className="grpc-mock-builder-section__title">When</div>
                <div className="grpc-mock-builder-predicate-summary" data-testid={`grpc-mock-builder-pred-summary-${rule.id}`}>
                  {rule.predicateReadOnly && rule.originalPredicate
                    ? summarizeMockRulePredicate({
                        id: rule.id, name: rule.name, enabled: rule.enabled, priority: rule.priority,
                        predicate: rule.originalPredicate, response: {},
                      })
                    : summarizeBuilderPredicateNode(rule.predicate)}
                </div>
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
                {!rule.predicateReadOnly
                  && rule.predicate.type === 'group'
                  && rule.predicate.children.length === 1
                  && rule.predicate.children[0]?.type === 'leaf' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    data-testid={`grpc-mock-builder-convert-leaf-${rule.id}`}
                    disabled={disabled}
                    onClick={() => convertRulePredicateToLeaf(rule)}
                  >
                    Convert to single predicate
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
                          : 'Complex predicate — edit in JSON editor.'}
                    </code>
                    <p className="grpc-mock-builder-hint">Edit this predicate in the JSON editor.</p>
                  </div>
                ) : (
                  <GrpcMockPredicateEditor
                    node={rule.predicate}
                    readOnly={false}
                    disabled={disabled}
                    depth={1}
                    onChange={(predicate) => {
                      if (measureGrpcMockBuilderPredicateDepth(predicate) > GRPC_MOCK_BUILDER_MAX_PREDICATE_DEPTH) {
                        return;
                      }
                      applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, { predicate }));
                    }}
                  />
                )}
              </div>

              <div className="grpc-mock-builder-section">
                <div className="grpc-mock-builder-section__title">Then respond</div>
                <div className="grpc-mock-builder-response-row">
                  <label className="grpc-mock-builder-field grpc-mock-builder-field--inline grpc-mock-builder-field--inline-fixed-label-response">
                    <span className="grpc-mock-builder-field__label">Status code</span>
                    <select
                      className="grpc-mock-builder-input grpc-mock-builder-status-select"
                      data-testid={`grpc-mock-builder-status-${rule.id}`}
                      value={String(responseStatusCode)}
                      disabled={disabled}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10);
                        applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, {
                          responseStatusCode: Number.isFinite(next) ? next : undefined,
                        }));
                      }}
                    >
                      {statusSelectOptions.map((entry) => (
                        <option key={entry.code} value={entry.code}>
                          {entry.code} - {entry.name}: {entry.description}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grpc-mock-builder-field grpc-mock-builder-field--inline">
                    <span className="grpc-mock-builder-field__label">Latency (ms)</span>
                    <input
                      type="number"
                      min={0}
                      max={30000}
                      className="grpc-mock-builder-input grpc-mock-builder-input--narrow"
                      data-testid={`grpc-mock-builder-latency-${rule.id}`}
                      value={rule.responseLatencyMs ?? ''}
                      disabled={disabled}
                      placeholder="0"
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, {
                          responseLatencyMs: Number.isFinite(value) && value >= 0 ? value : undefined,
                        }));
                      }}
                    />
                  </label>
                </div>
                <label className="grpc-mock-builder-field grpc-mock-builder-field--inline grpc-mock-builder-field--inline-grow grpc-mock-builder-field--inline-fixed-label-response">
                  <span className="grpc-mock-builder-field__label">Status message</span>
                  <input
                    className="grpc-mock-builder-input"
                    data-testid={`grpc-mock-builder-message-${rule.id}`}
                    value={rule.responseMessage ?? ''}
                    disabled={disabled}
                    placeholder="Optional gRPC status message"
                    onChange={(event) => {
                      applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, {
                        responseMessage: event.target.value || undefined,
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
                      applyModel(updateGrpcMockBuilderRuleRow(builderModel, rule.id, { responseBodyText: event.target.value }));
                    }}
                  />
                </label>
              </div>
            </div>
            )}

          </article>
          );
        })}
      </div>

      {testerRuleId && builderModel && (
        <StandardProfessionalModal
          open
          title="Dry-Run Tester"
          onClose={() => setTesterRuleId(null)}
          closeButtonKind="none"
          dialogClassName="grpc-dry-run-tester-modal"
          headerClassName="modal-header grpc-mock-tester-modal__header"
          bodyStyle={{ padding: '0 14px 14px' }}
          dragAnchor={{
            selector: '[data-testid="grpc-mock-builder-panel"]',
            hAlign: 'center',
            vAlign: 'top',
            padding: { top: -220 },
          }}
          minWidth={540}
          minHeight={380}
        >
          <GrpcMockRuleTester builderModel={builderModel} ruleId={testerRuleId} onClose={() => setTesterRuleId(null)} />
        </StandardProfessionalModal>
      )}
    </div>
  );
}

