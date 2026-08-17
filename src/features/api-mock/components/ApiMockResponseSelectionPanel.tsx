import { useState } from 'react';
import type {
  ApiMockPredicateGroupV1,
  ApiMockPredicateV1,
  ApiMockRouteV1,
  ApiMockResponseVariantV1,
} from '../../../shared/api-mock/contracts';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ApiMockPatternToolboxModal } from './ApiMockPatternToolboxModal';
import { WandIcon } from './ApiMockIcons';

// eslint-disable-next-line react-refresh/only-export-components
export function readJsonPathCondition(variant: ApiMockResponseVariantV1): { path: string; value: string } {
  const child = variant.conditions?.children?.find(
    (c): c is ApiMockPredicateV1 => 'operator' in c && c.operator === 'jsonPath_equals',
  );
  if (!child) return { path: '', value: '' };
  const expected = child.expected;
  if (Array.isArray(expected) && expected.length >= 2) {
    return { path: String(expected[0] ?? ''), value: String(expected[1] ?? '') };
  }
  return { path: child.selector ?? '', value: expected == null ? '' : String(expected) };
}

// eslint-disable-next-line react-refresh/only-export-components
export function writeJsonPathCondition(
  variant: ApiMockResponseVariantV1,
  path: string,
  value: string,
): ApiMockPredicateGroupV1 | undefined {
  if (!path.trim() && !value.trim()) return undefined;
  return {
    id: variant.conditions?.id || `pg-cond-${variant.id}`,
    combinator: 'all',
    children: [{
      id: `pred-jsonpath-${variant.id}`,
      source: 'body',
      selector: '',
      operator: 'jsonPath_equals',
      expected: [path, value],
    }],
  };
}

/** Map Pattern Toolbox Apply onto the variant JSONPath pair (equals or exists). */
// eslint-disable-next-line react-refresh/only-export-components
export function applyToolboxPredicateToSelection(
  variant: ApiMockResponseVariantV1,
  patch: Partial<ApiMockPredicateV1>,
): ApiMockPredicateGroupV1 | undefined {
  const current = readJsonPathCondition(variant);
  if (patch.operator === 'jsonPath_equals') {
    if (Array.isArray(patch.expected) && patch.expected.length >= 2) {
      return writeJsonPathCondition(variant, String(patch.expected[0] ?? ''), String(patch.expected[1] ?? ''));
    }
    if (typeof patch.expected === 'string') {
      return writeJsonPathCondition(variant, patch.expected, current.value);
    }
  }
  if (patch.operator === 'jsonPath_exists' && typeof patch.expected === 'string') {
    return writeJsonPathCondition(variant, patch.expected, current.value);
  }
  return variant.conditions;
}

/** Live sequence cursor as 1-based “next step”, matching the variant list. */
// eslint-disable-next-line react-refresh/only-export-components
export function sequenceCursorLabel(position: number | undefined, enabledCount: number): string {
  const count = enabledCount > 0 ? enabledCount : 1;
  const raw = position ?? 0;
  const nextIndex = ((raw % count) + count) % count;
  return `Next: Step ${nextIndex + 1} of ${count}`;
}

interface Props {
  route: ApiMockRouteV1;
  activeVariant: ApiMockResponseVariantV1;
  sequencePosition?: number;
  conditionLabel: string;
  onUpdateRoute: (patch: Partial<ApiMockRouteV1>) => void;
  onUpdateVariant: (patch: Partial<ApiMockResponseVariantV1>) => void;
  onModeChange: (mode: ApiMockRouteV1['responseMode']) => void;
}

export function ApiMockResponseSelectionPanel({
  route,
  activeVariant,
  sequencePosition,
  conditionLabel,
  onUpdateRoute,
  onUpdateVariant,
  onModeChange,
}: Props) {
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const currentCondition = readJsonPathCondition(activeVariant);
  return (
    <div className="am-form-grid" data-testid="api-mock-selection-panel">
      <div className="am-form-row">
        <div className="am-form-label">Mode</div>
        <div className="am-form-control">
          <CustomSelect
            value={route.responseMode}
            onChange={v => onModeChange(v as ApiMockRouteV1['responseMode'])}
            options={[
              { value: 'rules', label: 'Conditional rules' },
              { value: 'sequence', label: 'Sequence' },
              { value: 'weighted', label: 'Weighted random' },
              { value: 'state', label: 'Scenario state' },
            ]}
            className="am-cs wide"
            aria-label="Response selection mode"
            data-testid="api-mock-response-mode"
          />
        </div>
      </div>
      <div className="am-form-row">
        <div className="am-form-label">Condition</div>
        <div className="am-form-control" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="am-chip active am-selection-condition-chip" data-testid="api-mock-selection-condition">{conditionLabel}</span>
          {route.responseMode === 'sequence' && (
            <span
              className="am-badge info"
              data-testid="api-mock-sequence-position"
              title="Shared cursor for the next call — not this variant's list index"
            >
              {sequenceCursorLabel(sequencePosition, route.responses.filter(r => r.enabled).length)}
            </span>
          )}
          {route.responseMode === 'rules' && (
            <>
              <button
                type="button"
                className="am-btn small"
                data-testid="api-mock-selection-default"
                onClick={() => onUpdateRoute({
                  responses: route.responses.map(v => ({
                    ...v,
                    isDefault: v.id === activeVariant.id,
                  })),
                })}
              >
                Make default
              </button>
              <span className="am-hint" data-testid="api-mock-selection-default-note">
                Exactly one enabled variant is the Default fallback.
              </span>
            </>
          )}
        </div>
      </div>
      {route.responseMode === 'rules' && !activeVariant.isDefault && (
        <div className="am-form-row am-selection-jsonpath-row">
          <div className="am-form-label">JSONPath</div>
          <div className="am-form-control">
            <input
              className="am-input mono"
              value={currentCondition.path}
              placeholder="$.sku"
              aria-label="Variant JSONPath expression"
              data-testid="api-mock-selection-condition-path"
              onChange={e => onUpdateVariant({
                conditions: writeJsonPathCondition(activeVariant, e.target.value, currentCondition.value),
              })}
            />
            <input
              className="am-input mono"
              value={currentCondition.value}
              placeholder="MISSING"
              aria-label="Variant JSONPath expected value"
              data-testid="api-mock-selection-condition-value"
              onChange={e => onUpdateVariant({
                conditions: writeJsonPathCondition(activeVariant, currentCondition.path, e.target.value),
              })}
            />
            <button
              type="button"
              className="am-btn small"
              data-testid="api-mock-selection-condition-toolbox"
              aria-label="Pick JSONPath from sample body"
              title="Click a key in a sample body instead of typing the path"
              onClick={() => setToolboxOpen(true)}
            >
              <WandIcon size={13} /> Pick from sample
            </button>
          </div>
        </div>
      )}
      {toolboxOpen && (
        <ApiMockPatternToolboxModal
          initial={route.path}
          initialTab="jsonpath"
          allowedTabs={['jsonpath']}
          title="Pick JSONPath from sample"
          jsonSampleSeed={'{\n  "sku": "MISSING"\n}'}
          contextLabel={`${route.method} ${route.path.value} · Variant condition`}
          predicateOperator="jsonPath_equals"
          predicateExpected={
            currentCondition.path
              ? [currentCondition.path, currentCondition.value]
              : undefined
          }
          onApply={() => {}}
          onApplyPredicate={patch => {
            onUpdateVariant({ conditions: applyToolboxPredicateToSelection(activeVariant, patch) });
          }}
          onClose={() => setToolboxOpen(false)}
        />
      )}
      {route.responseMode === 'weighted' && (
        <div className="am-form-row">
          <div className="am-form-label">Weight</div>
          <div className="am-form-control">
            <input
              className="am-input num mono"
              type="number"
              min={0}
              value={activeVariant.weight ?? 1}
              onChange={e => onUpdateVariant({
                weight: parseInt(e.target.value, 10) || 0,
              })}
              data-testid="api-mock-variant-weight"
            />
            <span className="am-hint">Relative chance among eligible variants. Simulation pins the roll for the session so two runs match.</span>
          </div>
        </div>
      )}
      {route.responseMode === 'state' && (
        <>
          <div className="am-form-row">
            <div className="am-form-label">Required state</div>
            <div className="am-form-control">
              <input
                className="am-input wide mono"
                value={activeVariant.transition?.currentState ?? ''}
                placeholder="Started"
                onChange={e => onUpdateVariant({
                  transition: {
                    currentState: e.target.value || undefined,
                    // Keep Next as-is — do not invent Started (or mirror Required).
                    // An empty Next stays blank until the author fills it.
                    targetState: activeVariant.transition?.targetState ?? '',
                    counterUpdates: activeVariant.transition?.counterUpdates,
                  },
                })}
                data-testid="api-mock-variant-required-state"
              />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Next state</div>
            <div className="am-form-control">
              <input
                className="am-input wide mono"
                value={activeVariant.transition?.targetState ?? ''}
                placeholder="Active"
                onChange={e => onUpdateVariant({
                  transition: {
                    currentState: activeVariant.transition?.currentState,
                    targetState: e.target.value || 'Started',
                    counterUpdates: activeVariant.transition?.counterUpdates,
                  },
                })}
                data-testid="api-mock-variant-next-state"
              />
            </div>
          </div>
          <div className="am-section-heading" style={{ marginTop: 8 }}>
            Counter updates
            <span className="am-spacer" />
            <button
              type="button"
              className="am-btn small"
              data-testid="api-mock-counter-add"
              onClick={() => onUpdateVariant({
                transition: {
                  currentState: activeVariant.transition?.currentState,
                  targetState: activeVariant.transition?.targetState || 'Started',
                  counterUpdates: [
                    ...(activeVariant.transition?.counterUpdates ?? []),
                    { key: 'hits', delta: 1 },
                  ],
                },
              })}
            >
              + Counter
            </button>
          </div>
          {(() => {
            const counterUpdates = activeVariant.transition?.counterUpdates ?? [];
            return counterUpdates.map((cu, idx) => (
            <div key={`cu-${idx}`} className="am-counter-row" data-testid={`api-mock-counter-row-${idx}`}>
              <input
                className="am-input wide mono"
                aria-label={`Counter ${idx + 1} key`}
                data-testid={`api-mock-counter-key-${idx}`}
                placeholder="items"
                value={cu.key}
                onChange={e => {
                  const next = [...counterUpdates];
                  next[idx] = { ...next[idx], key: e.target.value };
                  onUpdateVariant({
                    transition: {
                      currentState: activeVariant.transition?.currentState,
                      targetState: activeVariant.transition?.targetState || 'Started',
                      counterUpdates: next,
                    },
                  });
                }}
              />
              <input
                className="am-input num mono"
                type="number"
                aria-label={`Counter ${idx + 1} delta`}
                data-testid={`api-mock-counter-delta-${idx}`}
                value={cu.delta}
                onChange={e => {
                  const next = [...counterUpdates];
                  next[idx] = { ...next[idx], delta: parseInt(e.target.value, 10) || 0 };
                  onUpdateVariant({
                    transition: {
                      currentState: activeVariant.transition?.currentState,
                      targetState: activeVariant.transition?.targetState || 'Started',
                      counterUpdates: next,
                    },
                  });
                }}
              />
              <button
                type="button"
                className="am-icon-btn"
                aria-label={`Remove counter ${idx + 1}`}
                data-testid={`api-mock-counter-remove-${idx}`}
                onClick={() => {
                  const next = counterUpdates.filter((_, i) => i !== idx);
                  onUpdateVariant({
                    transition: {
                      currentState: activeVariant.transition?.currentState,
                      targetState: activeVariant.transition?.targetState || 'Started',
                      counterUpdates: next.length ? next : undefined,
                    },
                  });
                }}
              >×</button>
            </div>
            ));
          })()}
        </>
      )}
      {route.responseMode !== 'rules' && (
        <div className="am-notice">
          <span>
            <strong>{route.responseMode}</strong> mode is active on the live listener (sequence / weighted / scenario state).
          </span>
        </div>
      )}
    </div>
  );
}
