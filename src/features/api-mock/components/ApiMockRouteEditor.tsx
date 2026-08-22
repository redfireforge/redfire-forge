import { useState } from 'react';
import type { ApiMockRouteV1, ApiMockPredicateV1, ApiMockPredicateGroupV1, ApiMockResponseVariantV1, ApiMockFaultKind, ApiMockSimulationSampleV1, ApiMockRouteFolderV1, ApiMockVariableV1 } from '../../../shared/api-mock/contracts';
import { isUnavailablePredicateOperator } from '../../../shared/api-mock/unavailableOperators';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { inferPathKind } from '../../../shared/api-mock/pathMatcher';
import {
  addChildToGroup,
  countLeaves,
  findLeafInTree,
  isPredicateGroup,
  removeNodeFromTree,
  updateGroupInTree,
  updateLeafInTree,
} from '../../../shared/api-mock/predicateTree';
import { ApiMockResponseEditor } from './ApiMockResponseEditor';
import { ApiMockPatternToolboxModal } from './ApiMockPatternToolboxModal';
import { ApiMockExamplesPanel } from './ApiMockExamplesPanel';
import { ApiMockMatchStyleRadios } from './ApiMockMatchStyleRadios';
import { WandIcon, TrashIcon, FlaskIcon, AlertIcon, PlusIcon } from './ApiMockIcons';
import { ApiMockExpandableText } from './ApiMockExpandableText';
import { toolboxTabForOperator } from './apiMockPatternToolboxConstants';
import {
  BUILDER_PANEL_ID,
  BUILDER_TABS,
  COMBINATOR_OPTIONS,
  FAULT_OPTIONS,
  METHOD_OPTIONS,
  SECURITY_SELECTOR_OPTIONS,
  SOURCE_LABELS,
  SOURCE_OPTIONS,
  TOOLBOX_OPERATORS,
  expectedText,
  operatorOptionsFor,
  pairExpected,
  securitySelectorValue,
  type BuilderTab,
} from './apiMockRouteEditorConstants';

interface Props {
  route: ApiMockRouteV1;
  onUpdate: (patch: Partial<ApiMockRouteV1>) => void;
  hasConflict?: boolean;
  conflictPeer?: string;
  matchCount?: number;
  sequencePosition?: number;
  onSimulate?: (sample?: ApiMockSimulationSampleV1) => void;
  onReviewConflicts?: () => void;
  folderName?: string;
  folders?: ApiMockRouteFolderV1[];
  samples?: ApiMockSimulationSampleV1[];
  onUpdateSample?: (sample: ApiMockSimulationSampleV1) => void;
  onDeleteSample?: (sampleId: string) => void;
  onTrySampleInRequests?: (sample: ApiMockSimulationSampleV1) => void;
  variables?: ApiMockVariableV1[];
  timeoutHoldMaxMs?: number;
}

export function ApiMockRouteEditor({ route, onUpdate, hasConflict = false, conflictPeer, matchCount, sequencePosition, onSimulate, onReviewConflicts, folderName, folders = [], samples = [], onUpdateSample, onDeleteSample, onTrySampleInRequests, variables = [], timeoutHoldMaxMs }: Props) {
  const [tab, setTab] = useState<BuilderTab>('match');
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [toolboxPredicateId, setToolboxPredicateId] = useState<string | undefined>();
  const group = route.predicates;
  const leaves = countLeaves(group);
  const routeSamples = samples.filter(sample => sample.routeId === route.id || !sample.routeId);
  const pathTitle = `${route.method === 'ANY' ? 'ANY' : route.method} ${route.path.value || '/'}`;
  const shortId = route.id.length > 12 ? route.id.slice(0, 12) : route.id;
  const metaParts = [folderName, `Rule ID ${shortId}`, matchCount != null ? `${matchCount} match${matchCount === 1 ? '' : 'es'}` : null, route.operationId ? `op ${route.operationId}` : null].filter(Boolean);
  const updateGroup = (patch: Partial<ApiMockPredicateGroupV1>) => onUpdate({ predicates: { ...group, ...patch } });
  const setTree = (next: ApiMockPredicateGroupV1) => onUpdate({ predicates: next });
  const newLeaf = (): ApiMockPredicateV1 => ({
    id: `pred-${crypto.randomUUID().slice(0, 8)}`,
    source: 'header',
    selector: '',
    operator: 'exact',
    expected: '',
  });

  const newGroup = (): ApiMockPredicateGroupV1 => ({
    id: `grp-${crypto.randomUUID().slice(0, 8)}`,
    combinator: 'all',
    children: [],
  });

  const addCondition = (groupId: string = group.id) => setTree(addChildToGroup(group, groupId, newLeaf()));
  const addGroup = (groupId: string = group.id) => setTree(addChildToGroup(group, groupId, newGroup()));
  const updateCondition = (id: string, patch: Partial<ApiMockPredicateV1>) => setTree(updateLeafInTree(group, id, patch));
  const removeCondition = (id: string) => setTree(removeNodeFromTree(group, id));
  const setCombinator = (groupId: string, combinator: ApiMockPredicateGroupV1['combinator']) =>
    setTree(updateGroupInTree(group, groupId, { combinator }));

  const defaultVariant = route.responses.find(v => v.isDefault) ?? route.responses[0];
  const updateDefaultBehavior = (patch: Partial<ApiMockResponseVariantV1['behavior']>) => {
    if (!defaultVariant) return;
    onUpdate({ responses: route.responses.map(v => v.id === defaultVariant.id ? { ...v, behavior: { ...v.behavior, ...patch } } : v) });
  };

  const renderLeaf = (pred: ApiMockPredicateV1) => (
    <div className="am-matcher-leaf" key={pred.id}>
    <div className="am-matcher-row" data-testid={`api-mock-condition-${pred.id}`}>
      <CustomSelect
        value={pred.source}
        onChange={v => {
          const source = v as ApiMockPredicateV1['source'];
          const patch: Partial<ApiMockPredicateV1> = { source };
          if (source === 'security' && !securitySelectorValue(pred.selector)) {
            patch.selector = 'scheme';
          }
          updateCondition(pred.id, patch);
        }}
        options={SOURCE_OPTIONS}
        size="sm"
        className="am-cs"
        menuPlacement="below"
        menuMinWidth={280}
        aria-label="Condition source"
        data-testid={`api-mock-condition-source-${pred.id}`}
      />
      {pred.source === 'security' ? (
        <CustomSelect
          value={securitySelectorValue(pred.selector)}
          onChange={v => updateCondition(pred.id, { selector: v })}
          options={SECURITY_SELECTOR_OPTIONS}
          placeholder="Selector"
          size="sm"
          className="am-cs"
          menuPlacement="below"
          menuMinWidth={280}
          aria-label="Condition selector"
          data-testid={`api-mock-condition-selector-${pred.id}`}
        />
      ) : (
        <input
          className="am-input mono"
          value={pred.source === 'body' ? '' : pred.selector ?? ''}
          placeholder={pred.source === 'body' ? '(whole body)' : 'name'}
          // Body predicates read the entire payload — there is no key to name, and
          // form/multipart field names belong in the matcher's own field box.
          disabled={pred.source === 'body'}
          title={pred.source === 'body'
            ? 'Body conditions read the whole payload — the operator carries the meaning'
            : undefined}
          onChange={e => updateCondition(pred.id, { selector: e.target.value })}
          aria-label="Condition selector"
          data-testid={`api-mock-condition-selector-${pred.id}`}
        />
      )}
      <CustomSelect
        value={pred.operator}
        onChange={v => updateCondition(pred.id, { operator: v as ApiMockPredicateV1['operator'] })}
        options={operatorOptionsFor(pred.operator, pred.source)}
        className="am-cs am-cs--operator"
        menuAlign="start"
        menuMinWidth={280}
        menuMaxWidth={300}
        aria-label="Condition operator"
        data-testid={`api-mock-condition-operator-${pred.id}`}
      />
      {pred.operator === 'jsonPath_equals' || pred.operator === 'xpath_equals'
        || pred.operator === 'multipart_field' || pred.operator === 'multipart_file'
        || pred.operator === 'form_field_exact' || pred.operator === 'form_field_regex' ? (
        <div className={`am-jsonpath-pair${pred.operator === 'jsonPath_equals' || pred.operator === 'xpath_equals' ? ' am-jsonpath-pair--matchstyle' : ''}`}>
          <input
            className="am-input mono"
            value={pairExpected(pred.expected)[0]}
            placeholder={
              pred.operator.startsWith('xpath') ? "//*[local-name()='vin']/text()"
                : pred.operator.startsWith('multipart') || pred.operator.startsWith('form_field') ? 'field'
                  : '$.customer.tier'
            }
            onChange={e => updateCondition(pred.id, {
              expected: [e.target.value, pairExpected(pred.expected)[1]],
            })}
            aria-label={pred.operator.startsWith('xpath') ? 'Condition XPath' : pred.operator.startsWith('jsonPath') ? 'Condition JSONPath' : 'Condition field'}
            data-testid={`api-mock-condition-expr-${pred.id}`}
          />
          {pred.source === 'body' ? (
            <ApiMockExpandableText
              label="Condition value"
              value={pairExpected(pred.expected)[1]}
              placeholder={pred.operator === 'multipart_file' ? 'file.png' : 'value'}
              onChange={v => updateCondition(pred.id, {
                expected: [pairExpected(pred.expected)[0], v],
              })}
              testId={`api-mock-condition-value-${pred.id}`}
              ariaLabel="Condition value"
              beforeExpand={(pred.operator === 'jsonPath_equals' || pred.operator === 'xpath_equals')
                ? <ApiMockMatchStyleRadios predicate={pred} onUpdate={updateCondition} />
                : undefined}
            />
          ) : (
            <>
              <input
                className="am-input mono"
                value={pairExpected(pred.expected)[1]}
                placeholder={pred.operator === 'multipart_file' ? 'file.png' : 'value'}
                onChange={e => updateCondition(pred.id, {
                  expected: [pairExpected(pred.expected)[0], e.target.value],
                })}
                aria-label="Condition value"
                data-testid={`api-mock-condition-value-${pred.id}`}
              />
              {(pred.operator === 'jsonPath_equals' || pred.operator === 'xpath_equals')
                && <ApiMockMatchStyleRadios predicate={pred} onUpdate={updateCondition} />}
            </>
          )}
        </div>
      ) : pred.operator === 'jsonSchema' || pred.operator === 'xmlSchema' || pred.operator === 'json_strict' || pred.operator === 'json_subset' ? (
        <ApiMockExpandableText
          label="Condition body"
          value={expectedText(pred.expected)}
          placeholder={pred.operator === 'xmlSchema' ? 'Order, Id  or  <xs:element name="Order"/>' : '{ "type": "object" }'}
          onChange={v => updateCondition(pred.id, { expected: v })}
          testId={`api-mock-condition-schema-${pred.id}`}
          multiline
          className="am-matcher-schema"
          ariaLabel="Condition schema"
        />
      ) : (
        pred.source === 'body' && pred.operator !== 'present' && pred.operator !== 'absent' ? (
          <ApiMockExpandableText
            label="Condition body"
            value={typeof pred.expected === 'string' ? pred.expected : ''}
            placeholder={
              pred.operator === 'jsonPath_exists' ? '$.customer.tier'
                : pred.operator === 'xpath_exists' ? "//*[local-name()='vin']"
                  : pred.operator === 'binary_sha256' ? '64-char hex digest'
                    : pred.operator === 'binary_exact' ? 'raw body'
                      : 'value'
            }
            onChange={v => updateCondition(pred.id, { expected: v })}
            testId={`api-mock-condition-value-${pred.id}`}
            ariaLabel="Condition value"
          />
        ) : (
          <input
            className="am-input mono"
            value={typeof pred.expected === 'string' ? pred.expected : ''}
            placeholder={
              pred.source === 'security' && pred.selector === 'certSubject' ? 'CN=client-name'
                : pred.operator === 'jsonPath_exists' ? '$.customer.tier'
                  : pred.operator === 'xpath_exists' ? "//*[local-name()='vin']"
                    : pred.operator === 'binary_sha256' ? '64-char hex digest'
                      : 'value'
            }
            disabled={pred.operator === 'present' || pred.operator === 'absent'}
            onChange={e => updateCondition(pred.id, { expected: e.target.value })}
            aria-label="Condition value"
            data-testid={`api-mock-condition-value-${pred.id}`}
          />
        )
      )}
      <div className="am-matcher-actions">
        {TOOLBOX_OPERATORS.has(pred.operator) && (
          <button
            className="am-icon-btn"
            aria-label="Open pattern toolbox"
            title="Open pattern toolbox"
            onClick={() => { setToolboxPredicateId(pred.id); setToolboxOpen(true); }}
            data-testid={`api-mock-condition-toolbox-${pred.id}`}
          ><WandIcon size={13} /></button>
        )}
        <button
          className="am-icon-btn"
          aria-label="Remove condition"
          title="Remove condition"
          onClick={() => removeCondition(pred.id)}
          data-testid={`api-mock-condition-remove-${pred.id}`}
        ><TrashIcon size={13} /></button>
      </div>
    </div>
    {isUnavailablePredicateOperator(pred.operator) && (
      <p className="am-notice warning" data-testid={`api-mock-condition-unavailable-${pred.id}`}>
        Operator {pred.operator} is not evaluated yet — this condition never matches.
      </p>
    )}
    </div>
  );

  const renderGroup = (node: ApiMockPredicateGroupV1, depth: number) => {
    const n = countLeaves(node);
    return (
      <div
        className={`am-matcher-group${depth > 0 ? ' nested' : ''}`}
        key={node.id}
        data-testid={`api-mock-group-${node.id}`}
      >
        <div className="am-group-label">
          <CustomSelect
            value={node.combinator}
            onChange={v => setCombinator(node.id, v as ApiMockPredicateGroupV1['combinator'])}
            options={COMBINATOR_OPTIONS}
            size="sm"
            className="am-cs am-group-combinator"
            aria-label="Group combinator"
            data-testid={`api-mock-group-combinator-${node.id}`}
          />
          <span className="am-faint" data-testid={`api-mock-group-count-${node.id}`}>
            {n} condition{n === 1 ? '' : 's'}
          </span>
          <span className="am-spacer" />
          <button
            className="am-btn small ghost"
            onClick={() => addCondition(node.id)}
            data-testid={depth === 0 ? 'api-mock-add-condition' : `api-mock-group-add-condition-${node.id}`}
          ><PlusIcon size={11} /> Condition</button>
          <button
            className="am-btn small ghost"
            onClick={() => addGroup(node.id)}
            data-testid={depth === 0 ? 'api-mock-add-group' : `api-mock-group-add-group-${node.id}`}
          >[ ] Group</button>
          {depth > 0 && (
            <button
              className="am-icon-btn"
              aria-label="Remove group"
              title="Remove group"
              onClick={() => removeCondition(node.id)}
              data-testid={`api-mock-group-remove-${node.id}`}
            ><TrashIcon size={13} /></button>
          )}
        </div>
        {node.combinator === 'not' && (
          <div className="am-hint" data-testid={`api-mock-group-failclosed-${node.id}`}>
            Fails closed — a child that cannot be evaluated makes the whole group miss, so a stub can never invert into a match.
          </div>
        )}
        {node.children.length === 0 ? (
          <div
            className="am-empty-conditions"
            data-testid={depth === 0 ? 'api-mock-conditions-empty' : `api-mock-group-empty-${node.id}`}
          >
            {depth === 0
              ? 'No conditions — this route matches on method and path alone.'
              : 'Empty group — add a condition, or remove it so it does not affect matching.'}
          </div>
        ) : (
          node.children.map(child => (
            isPredicateGroup(child) ? renderGroup(child, depth + 1) : renderLeaf(child)
          ))
        )}
      </div>
    );
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
        {hasConflict && <span className="am-badge warning" data-testid="api-mock-editor-conflict"><AlertIcon size={11} /> Potential overlap</span>}
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
        <button className="am-btn small" onClick={() => onSimulate?.()} data-testid="api-mock-simulate"><FlaskIcon size={13} /> Simulate</button>
      </div>

      <div className="am-builder-tabs" role="tablist" aria-label="Route editor sections" onKeyDown={handleTabListArrowKeys}>
        {BUILDER_TABS.map(t => {
          const active = tab === t.id;
          const badge = t.id === 'match'
            ? (leaves > 0 ? leaves : null)
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
                    menuMinWidth={240}
                    aria-label="Route method"
                    data-testid="api-mock-method-select"
                  />
                  <input
                    className="am-input wide"
                    value={route.path.value}
                    onChange={e => onUpdate({
                      path: {
                        ...route.path,
                        kind: inferPathKind(e.target.value, route.path.kind),
                        value: e.target.value,
                      },
                    })}
                    placeholder="/users/:id"
                    data-testid="api-mock-path-input"
                  />
                  <span
                    className="am-badge info"
                    title={`Path is matched as "${route.path.kind}"`}
                    data-testid="api-mock-path-kind"
                  >{route.path.kind}</span>
                  <button
                    className="am-icon-btn"
                    aria-label="Open pattern toolbox"
                    title="Open pattern toolbox"
                    onClick={() => { setToolboxPredicateId(undefined); setToolboxOpen(true); }}
                    data-testid="api-mock-path-toolbox"
                  ><WandIcon /></button>
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
              Match conditions
              <span className="am-spacer" />
              <span className="am-hint">Applied after the method and path above.</span>
            </div>

            {renderGroup(group, 0)}

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
          <ApiMockResponseEditor
            route={route}
            onUpdateRoute={onUpdate}
            sequencePosition={sequencePosition}
            variables={variables}
            timeoutHoldMaxMs={timeoutHoldMaxMs}
          />
        )}
        {tab === 'behavior' && (
          <div className="am-behavior-panel">
            <div className="am-behavior-section">
              <div className="am-behavior-section-head">
                <span className="am-behavior-section-icon" aria-hidden="true">&#9201;</span>
                <span className="am-behavior-section-title">Timing</span>
              </div>
            <div className="am-form-grid am-form-grid--aligned">
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
                  <span className="am-hint">ms fixed delay before response</span>
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
                  <span className="am-hint">random \u00b1 added to latency</span>
                </div>
              </div>
            </div>
              {(defaultVariant?.behavior.delayMs ?? 0) > 0 && (
                <div className="am-behavior-timing-summary" data-testid="api-mock-behavior-timing-summary">
                  Response will arrive in{' '}
                  <strong>
                    {(defaultVariant?.behavior.jitterMs ?? 0) > 0
                      ? `${Math.max(0, (defaultVariant?.behavior.delayMs ?? 0) - (defaultVariant?.behavior.jitterMs ?? 0))}\u2013${(defaultVariant?.behavior.delayMs ?? 0) + (defaultVariant?.behavior.jitterMs ?? 0)} ms`
                      : `${defaultVariant?.behavior.delayMs ?? 0} ms`}
                  </strong>
                </div>
              )}
            </div>

            <div className={`am-behavior-section${defaultVariant?.behavior.fault && defaultVariant.behavior.fault !== 'none' ? ' am-behavior-section--active-fault' : ''}`}>
              <div className="am-behavior-section-head">
                <span className="am-behavior-section-icon" aria-hidden="true">&#9889;</span>
                <span className="am-behavior-section-title">Fault injection</span>
                {defaultVariant?.behavior.fault && defaultVariant.behavior.fault !== 'none' && (
                  <span className="am-behavior-fault-badge">Active</span>
                )}
              </div>
              <div className="am-form-grid am-form-grid--aligned">
                <div className="am-form-row">
                  <div className="am-form-label">Fault type</div>
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
                {defaultVariant?.behavior.fault && defaultVariant.behavior.fault !== 'none' && (
                  <div className="am-form-row">
                    <div className="am-form-label">Probability</div>
                    <div className="am-form-control">
                      <input
                        className="am-input num mono"
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={defaultVariant?.behavior.probability ?? 1}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          updateDefaultBehavior({ probability: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1 });
                        }}
                        data-testid="api-mock-behavior-probability"
                      />
                      <span className="am-hint">0\u20131; fraction of requests that trigger the fault</span>
                    </div>
                  </div>
                )}
              </div>
              {defaultVariant?.behavior.fault && defaultVariant.behavior.fault !== 'none' && (
                <div className="am-behavior-fault-hint">
                  {defaultVariant.behavior.fault === 'timeout' && 'The server will accept the connection but never send a response — the client sees a hang.'}
                  {defaultVariant.behavior.fault === 'close' && 'The socket is closed abruptly before any response bytes are sent.'}
                  {defaultVariant.behavior.fault === 'reset' && 'A TCP RST is sent, forcefully tearing down the connection.'}
                  {defaultVariant.behavior.fault === 'malformed' && 'Garbage bytes are written instead of a valid HTTP response.'}
                  {defaultVariant.behavior.fault === 'dribble' && 'The response body is streamed one byte at a time with long pauses between chunks.'}
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'examples' && (
          <ApiMockExamplesPanel
            samples={routeSamples}
            attachRouteId={route.id}
            onSimulate={onSimulate}
            onUpdateSample={onUpdateSample}
            onDeleteSample={onDeleteSample}
            onTryInRequests={onTrySampleInRequests}
          />
        )}
        {tab === 'docs' && (
          <div className="am-docs-panel">
            <div className="am-docs-section">
              <div className="am-docs-section-head">
                <span className="am-docs-section-icon" aria-hidden="true">&#128196;</span>
                <span className="am-docs-section-title">Description</span>
              </div>
              <div className="am-form-grid am-form-grid--aligned am-docs-form-grid">
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
                    <span className="am-hint">Maps to the OpenAPI operationId field</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="am-docs-section">
              <div className="am-docs-section-head">
                <span className="am-docs-section-icon" aria-hidden="true">&#128193;</span>
                <span className="am-docs-section-title">Organization</span>
              </div>
              <div className="am-form-grid am-form-grid--aligned am-docs-form-grid">
                <div className="am-form-row">
                  <div className="am-form-label">Folder</div>
                  <div className="am-form-control">
                    <CustomSelect
                      value={route.folderId ?? ''}
                      onChange={v => onUpdate({ folderId: v || undefined })}
                      options={[
                        { value: '', label: 'Ungrouped' },
                        ...folders.map(f => ({ value: f.id, label: f.name })),
                      ]}
                      className="am-cs wide"
                      aria-label="Route folder"
                      data-testid="api-mock-docs-folder"
                    />
                    <span className="am-hint">
                      {folders.length === 0 ? 'Create a folder in the rules panel first.' : 'Groups this rule in the rules panel.'}
                    </span>
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
                    <span className="am-hint">Comma-separated; used for filtering and export grouping</span>
                  </div>
                </div>
              </div>
              {route.tags.length > 0 && (
                <div className="am-docs-tags-preview">
                  {route.tags.map(tag => (
                    <span key={tag} className="am-docs-tag-chip">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {toolboxOpen && (() => {
        const toolboxPred = toolboxPredicateId
          ? findLeafInTree(group, toolboxPredicateId)
          : undefined;
        return (
        <ApiMockPatternToolboxModal
          initial={route.path}
          initialTab={toolboxPred
            ? toolboxTabForOperator(toolboxPred.operator)
            : 'path'}
          predicateExpected={toolboxPred?.expected}
          predicateOperator={toolboxPred?.operator}
          predicateSource={toolboxPred?.source}
          predicateSelector={toolboxPred?.selector}
          predicateCaseInsensitive={toolboxPred
            ? toolboxPred.options?.caseSensitive === false
            : undefined}
          contextLabel={toolboxPred
            ? `${pathTitle} · ${SOURCE_LABELS[toolboxPred.source]} “${toolboxPred.selector || '—'}”`
            : `${pathTitle} · Request path`}
          onApply={m => {
            if (toolboxPredicateId) {
              const existing = findLeafInTree(group, toolboxPredicateId);
              if (existing?.operator !== 'regex' && existing?.operator !== 'glob') return;
              const regexOrGlob = m.kind === 'glob' || m.kind === 'regex';
              updateCondition(toolboxPredicateId, {
                expected: m.value,
                operator: m.kind === 'glob' ? 'glob' : m.kind === 'regex' ? 'regex' : existing.operator,
                ...(regexOrGlob ? {
                  options: {
                    ...existing.options,
                    caseSensitive: m.flags?.caseInsensitive ? false : true,
                  },
                } : {}),
              });
              return;
            }
            onUpdate({ path: m });
          }}
          onApplyPredicate={toolboxPredicateId
            ? patch => updateCondition(toolboxPredicateId, patch)
            : undefined}
          onApplyConditions={preds => {
            if (preds.length > 0) updateGroup({ children: [...group.children, ...preds] });
          }}
          onClose={() => { setToolboxOpen(false); setToolboxPredicateId(undefined); }}
        />
        );
      })()}
    </div>
  );
}
