import { useState } from 'react';
import type { ApiMockRouteV1, ApiMockPredicateV1, ApiMockPredicateGroupV1, ApiMockResponseVariantV1, ApiMockFaultKind, ApiMockSimulationSampleV1 } from '../../../shared/api-mock/contracts';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { ApiMockResponseEditor } from './ApiMockResponseEditor';
import { ApiMockPatternToolboxModal } from './ApiMockPatternToolboxModal';

interface Props {
  route: ApiMockRouteV1;
  onUpdate: (patch: Partial<ApiMockRouteV1>) => void;
  hasConflict?: boolean;
  /** Peer rule label from conflict analysis, e.g. "GET /users/admin". */
  conflictPeer?: string;
  /** Journal hits for this rule (mockup meta line). */
  matchCount?: number;
  onSimulate?: () => void;
  onDelete?: () => void;
  onReviewConflicts?: () => void;
  folderName?: string;
  samples?: ApiMockSimulationSampleV1[];
}

type BuilderTab = 'match' | 'response' | 'behavior' | 'examples' | 'docs';

const BUILDER_PANEL_ID = 'api-mock-builder-panel';
const BUILDER_TABS: ReadonlyArray<{ id: BuilderTab; label: string }> = [
  { id: 'match', label: 'Match' },
  { id: 'response', label: 'Response' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'examples', label: 'Examples' },
  { id: 'docs', label: 'Documentation' },
];

const METHODS = ['ANY', 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'] as const;
const OPERATORS: ApiMockPredicateV1['operator'][] = ['exact', 'contains', 'prefix', 'suffix', 'regex', 'glob', 'present', 'absent'];
const SOURCES: ApiMockPredicateV1['source'][] = ['pathParam', 'query', 'header', 'cookie', 'security', 'body', 'transport'];

const SOURCE_LABELS: Record<ApiMockPredicateV1['source'], string> = {
  pathParam: 'Path parameter',
  query: 'Query',
  header: 'Header',
  cookie: 'Cookie',
  security: 'Security',
  body: 'Body',
  transport: 'Transport',
};
const METHOD_OPTIONS = METHODS.map(m => ({ value: m, label: m }));
const OPERATOR_OPTIONS = OPERATORS.map(o => ({
  value: o,
  label: ({
    exact: 'Exact',
    contains: 'Contains',
    prefix: 'Prefix',
    suffix: 'Suffix',
    regex: 'Regex',
    glob: 'Glob',
    present: 'Present',
    absent: 'Absent',
  } as Record<string, string>)[o],
}));
const SOURCE_OPTIONS = SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] }));

const FAULT_OPTIONS: Array<{ value: ApiMockFaultKind; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'timeout', label: 'Timeout (no response)' },
  { value: 'close', label: 'Close connection' },
  { value: 'reset', label: 'Reset connection' },
  { value: 'malformed', label: 'Malformed body' },
  { value: 'dribble', label: 'Dribble (slow drip)' },
];

function isLeaf(node: ApiMockPredicateGroupV1 | ApiMockPredicateV1): node is ApiMockPredicateV1 {
  return (node as ApiMockPredicateV1).operator !== undefined;
}

export function ApiMockRouteEditor({
  route,
  onUpdate,
  hasConflict = false,
  conflictPeer,
  matchCount,
  onSimulate,
  onDelete,
  onReviewConflicts,
  folderName,
  samples = [],
}: Props) {
  const [tab, setTab] = useState<BuilderTab>('match');
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const group = route.predicates;
  const leaves = group.children.filter(isLeaf);
  const routeSamples = samples.filter(s => s.routeId === route.id);
  const pathTitle = `${route.method === 'ANY' ? 'ANY' : route.method} ${route.path.value || '/'}`;
  const shortId = route.id.length > 12 ? route.id.slice(0, 12) : route.id;
  const metaParts = [
    folderName,
    `Rule ID ${shortId}`,
    matchCount != null ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : null,
    route.operationId ? `op ${route.operationId}` : null,
  ].filter(Boolean);

  const updateGroup = (patch: Partial<ApiMockPredicateGroupV1>) =>
    onUpdate({ predicates: { ...group, ...patch } });

  const addCondition = () => {
    const child: ApiMockPredicateV1 = {
      id: `pred-${crypto.randomUUID().slice(0, 8)}`,
      source: 'header',
      selector: '',
      operator: 'exact',
      expected: '',
    };
    updateGroup({ children: [...group.children, child] });
  };

  const updateCondition = (id: string, patch: Partial<ApiMockPredicateV1>) =>
    updateGroup({
      children: group.children.map(c => (isLeaf(c) && c.id === id ? { ...c, ...patch } : c)),
    });

  const removeCondition = (id: string) =>
    updateGroup({ children: group.children.filter(c => !(isLeaf(c) && c.id === id)) });

  const defaultVariant = route.responses.find(v => v.isDefault) ?? route.responses[0];
  const updateDefaultBehavior = (patch: Partial<ApiMockResponseVariantV1['behavior']>) => {
    if (!defaultVariant) return;
    onUpdate({ responses: route.responses.map(v => v.id === defaultVariant.id ? { ...v, behavior: { ...v.behavior, ...patch } } : v) });
  };

  return (
    <div className="api-mock-route-editor" data-testid="api-mock-route-editor">
      <div className="am-editor-header">
        <span className={`am-method ${route.method.toLowerCase()}`}>{route.method}</span>
        <div style={{ minWidth: 0, flex: '0 1 auto' }}>
          <div className="am-editor-title" data-testid="api-mock-route-title">{pathTitle}</div>
          <div className="am-editor-meta">{metaParts.join(' · ')}</div>
          {/* Keep name editable for tests / docs summary sync */}
          <input
            className="am-sr-only"
            value={route.name}
            onChange={e => onUpdate({ name: e.target.value })}
            aria-label="Route name"
            data-testid="api-mock-route-name"
          />
        </div>
        {hasConflict && <span className="am-badge warning" data-testid="api-mock-editor-conflict">Potential overlap</span>}
        <span className="am-spacer" />
        <label className="am-enabled-label">
          Enabled
          <button
            className={`am-toggle${route.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={route.enabled}
            aria-label="Toggle route enabled"
            title={route.enabled ? 'Disable route' : 'Enable route'}
            onClick={() => onUpdate({ enabled: !route.enabled })}
            data-testid="api-mock-route-enabled"
          />
        </label>
        <button className="am-btn small" onClick={onSimulate} data-testid="api-mock-simulate">Simulate</button>
        <button className="am-btn small danger" onClick={onDelete} data-testid="api-mock-delete-route">Delete</button>
      </div>

      <div className="am-builder-tabs" role="tablist" aria-label="Route editor sections" onKeyDown={handleTabListArrowKeys}>
        {BUILDER_TABS.map(t => {
          const active = tab === t.id;
          const badge = t.id === 'match'
            ? (leaves.length > 0 ? leaves.length : null)
            : t.id === 'response' ? route.responses.length
              : t.id === 'examples' ? (routeSamples.length > 0 ? routeSamples.length : null)
                : null;
          return (
            <button
              key={t.id}
              id={`api-mock-btab-${t.id}`}
              role="tab"
              aria-selected={active}
              aria-controls={BUILDER_PANEL_ID}
              tabIndex={active ? 0 : -1}
              className={`am-builder-tab${active ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} {badge != null && <span className="am-count-badge">{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="am-editor-body" id={BUILDER_PANEL_ID} role="tabpanel" aria-labelledby={`api-mock-btab-${tab}`}>
        {tab === 'match' && (
          <>
            <div className="am-form-grid">
              <div className="am-form-row">
                <div className="am-form-label">Request line</div>
                <div className="am-form-control am-request-line">
                  <CustomSelect
                    value={route.method}
                    onChange={v => onUpdate({ method: v as ApiMockRouteV1['method'] })}
                    options={METHOD_OPTIONS}
                    className="am-cs"
                    aria-label="Route method"
                    data-testid="api-mock-method-select"
                  />
                  <input
                    className="am-input wide mono"
                    value={route.path.value}
                    onChange={e => onUpdate({ path: { ...route.path, value: e.target.value } })}
                    placeholder="/users/:id"
                    data-testid="api-mock-path-input"
                  />
                  <button
                    className="am-icon-btn"
                    aria-label="Open pattern toolbox"
                    title="Open pattern toolbox"
                    onClick={() => setToolboxOpen(true)}
                    data-testid="api-mock-path-toolbox"
                  >✦</button>
                </div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Priority</div>
                <div className="am-form-control">
                  <input
                    className="am-input num mono"
                    type="number"
                    value={route.priority}
                    onChange={e => onUpdate({ priority: parseInt(e.target.value, 10) || 0 })}
                    data-testid="api-mock-priority-input"
                  />
                  <span className="am-hint">Higher value wins when the server policy chooses highest priority.</span>
                </div>
              </div>
            </div>

            <div className="am-section-heading">
              Match all conditions
              <span className="am-badge info">{group.combinator.toUpperCase()}</span>
              <span className="am-spacer" />
              <button className="am-btn small ghost" onClick={addCondition} data-testid="api-mock-add-condition">+ Condition</button>
            </div>

            {leaves.length === 0 ? (
              <div className="am-empty-conditions" data-testid="api-mock-conditions-empty">
                No conditions — this route matches on method and path alone.
              </div>
            ) : (
              <div className="am-matcher-group">
                <div className="am-group-label">
                  <span>{group.combinator === 'all' ? 'All of' : group.combinator === 'any' ? 'Any of' : 'None of'} {leaves.length}</span>
                </div>
                {leaves.map(pred => (
                  <div className="am-matcher-row" key={pred.id} data-testid={`api-mock-condition-${pred.id}`}>
                    <CustomSelect
                      value={pred.source}
                      onChange={v => updateCondition(pred.id, { source: v as ApiMockPredicateV1['source'] })}
                      options={SOURCE_OPTIONS}
                      size="sm"
                      className="am-cs"
                      aria-label="Condition source"
                      data-testid={`api-mock-condition-source-${pred.id}`}
                    />
                    <input
                      className="am-input mono"
                      value={pred.selector ?? ''}
                      placeholder="name"
                      onChange={e => updateCondition(pred.id, { selector: e.target.value })}
                      aria-label="Condition selector"
                    />
                    <CustomSelect
                      value={pred.operator}
                      onChange={v => updateCondition(pred.id, { operator: v as ApiMockPredicateV1['operator'] })}
                      options={OPERATOR_OPTIONS}
                      size="sm"
                      className="am-cs"
                      aria-label="Condition operator"
                      data-testid={`api-mock-condition-operator-${pred.id}`}
                    />
                    <input
                      className="am-input mono"
                      value={typeof pred.expected === 'string' ? pred.expected : ''}
                      placeholder="value"
                      disabled={pred.operator === 'present' || pred.operator === 'absent'}
                      onChange={e => updateCondition(pred.id, { expected: e.target.value })}
                      aria-label="Condition value"
                    />
                    <button
                      className="am-icon-btn"
                      aria-label="Remove condition"
                      title="Remove condition"
                      onClick={() => removeCondition(pred.id)}
                      data-testid={`api-mock-condition-remove-${pred.id}`}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            {hasConflict && (
              <div className="am-notice warning" data-testid="api-mock-conflict-notice" style={{ marginTop: 14 }}>
                <div>
                  <strong>Potential overlap with {conflictPeer ?? 'another rule'}</strong>
                  <br />
                  The path template or predicates may accept the same requests; priorities may also tie.{' '}
                  <button type="button" className="am-link-btn" onClick={onReviewConflicts} data-testid="api-mock-review-conflicts">
                    Review conflict evidence
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'response' && (
          <ApiMockResponseEditor route={route} onUpdateRoute={onUpdate} />
        )}
        {tab === 'behavior' && (
          <>
            <div className="am-form-grid">
              <div className="am-form-row">
                <div className="am-form-label">Latency</div>
                <div className="am-form-control">
                  <input
                    className="am-input num mono"
                    type="number"
                    min={0}
                    value={defaultVariant?.behavior.delayMs ?? 0}
                    onChange={e => updateDefaultBehavior({ delayMs: parseInt(e.target.value, 10) || 0 })}
                    data-testid="api-mock-behavior-delay"
                  />
                  <span className="am-hint">ms fixed delay</span>
                </div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Fault injection</div>
                <div className="am-form-control">
                  <CustomSelect
                    value={defaultVariant?.behavior.fault ?? 'none'}
                    onChange={v => updateDefaultBehavior({ fault: v as ApiMockFaultKind })}
                    options={FAULT_OPTIONS}
                    className="am-cs"
                    aria-label="Fault injection"
                    data-testid="api-mock-fault-select"
                  />
                </div>
              </div>
              <div className="am-form-row">
                <div className="am-form-label">Jitter (± ms)</div>
                <div className="am-form-control">
                  <input
                    className="am-input num mono"
                    type="number"
                    min={0}
                    value={defaultVariant?.behavior.jitterMs ?? 0}
                    onChange={e => updateDefaultBehavior({ jitterMs: parseInt(e.target.value, 10) || 0 })}
                    data-testid="api-mock-behavior-jitter"
                  />
                </div>
              </div>
            </div>
            {defaultVariant?.behavior.fault && defaultVariant.behavior.fault !== 'none' && (
              <div className="am-notice warning" style={{ marginTop: 12 }}>
                <span>Fault “{defaultVariant.behavior.fault}” is injected before the normal response — use it to test client resilience.</span>
              </div>
            )}
          </>
        )}
        {tab === 'examples' && (
          routeSamples.length === 0 ? (
            <div className="am-notice" data-testid="api-mock-examples-empty">
              <span>Run <strong>Simulate</strong> to exercise this rule against sample requests. Captured transactions can be promoted to examples from the journal.</span>
            </div>
          ) : (
            <div className="am-card-grid" data-testid="api-mock-examples-grid">
              {routeSamples.map(sample => (
                <button
                  key={sample.id}
                  type="button"
                  className="am-item-card"
                  onClick={onSimulate}
                  data-testid={`api-mock-example-${sample.id}`}
                >
                  <h3>{sample.name}</h3>
                  <p className="am-mono">{sample.request.method} {sample.request.path}</p>
                </button>
              ))}
            </div>
          )
        )}
        {tab === 'docs' && (
          <div className="am-form-grid">
            <div className="am-form-row">
              <div className="am-form-label">Summary</div>
              <div className="am-form-control">
                <input
                  className="am-input wide"
                  value={route.name}
                  placeholder="Return one user by numeric ID"
                  onChange={e => onUpdate({ name: e.target.value })}
                  data-testid="api-mock-docs-summary"
                />
              </div>
            </div>
            <div className="am-form-row">
              <div className="am-form-label">Operation ID</div>
              <div className="am-form-control">
                <input
                  className="am-input wide mono"
                  value={route.operationId ?? ''}
                  placeholder="getUserById"
                  onChange={e => onUpdate({ operationId: e.target.value || undefined })}
                  data-testid="api-mock-docs-operation-id"
                />
              </div>
            </div>
            <div className="am-form-row">
              <div className="am-form-label">Tags</div>
              <div className="am-form-control">
                <input
                  className="am-input wide"
                  value={route.tags.join(', ')}
                  placeholder="users, public"
                  onChange={e => onUpdate({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  data-testid="api-mock-docs-tags"
                />
                <span className="am-hint">Comma-separated.</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {toolboxOpen && (
        <ApiMockPatternToolboxModal
          initial={route.path}
          onApply={m => onUpdate({ path: m })}
          onClose={() => setToolboxOpen(false)}
        />
      )}
    </div>
  );
}
