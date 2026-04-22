import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type {
  WorkflowNode,
  HttpNodeData,
  ConditionNodeData,
  DelayNodeData,
  WorkflowNodeData,
  WorkflowService,
} from '../../types/workflow';
import {
  guessConditionLeftMode,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
  parseSingleVariableRef,
  validateConditionLeftRefs,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import type { Scenario, KeyValue } from '../../types';
import ExtractionEditor from '../ExtractionEditor';
import type { ExtractionFetchSampleProps } from '../ExtractionPathPickerModal';
import { useWorkflowInspect } from './WorkflowInspectContext';
import { ParamsEditor } from '../ParamsEditor';
import type { ParamEntry } from '../ParamsEditor';

interface Props {
  node: WorkflowNode | null;
  /** Workflow-wide defaults (saved on the workflow). */
  workflowVariables: Record<string, string>;
  onUpdateWorkflowVariables: (variables: Record<string, string>) => void;
  /** Merged shallowly into the node’s current `data` (avoids dropping `initialVariables` when HTTP fields update). */
  onUpdateNode: (id: string, patch: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (id: string) => void;
  /** Final URL from the last Quick Test (success or fail) for debugging. */
  lastQuickTestRequestUrl?: string | null;
  /** HTTP step error line from the last run (kept off node `data` in the designer). */
  lastRunStepError?: string | null;
  /**
   * For the selected HTTP node: resolved base after per-request host override, else harness.
   * Used for Extract → Fetch sample and URL hints.
   */
  effectiveQuickTestBaseUrl: string;
  /** Last successful Fetch Response body for Extract → Pick JSON path. */
  extractionSampleResponseBody?: string;
  /** Fetch handler + loading/error for Extract modal (omit `host`; HttpConfig adds it from scenario). */
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  /**
   * When configuring a condition node: workflow vars, upstream HTTP extractions (unscoped + `node:id.name`),
   * and `status`. Used to validate `{{name}}` / `{{node:id.name}}` references.
   */
  conditionVariableHints?: WorkflowVariableHint[];
  /** Upstream + workflow variable templates for the selected HTTP step (URL, params, headers, body). */
  httpVariableHints?: WorkflowVariableHint[];
  /** Workflow-level services from the Service Registry. */
  workflowServices?: WorkflowService[];
}

type HttpTab = 'url' | 'headers' | 'body' | 'extract';

export default function WorkflowConfigPanel({ node, workflowVariables, onUpdateWorkflowVariables, onUpdateNode, onDeleteNode, lastQuickTestRequestUrl, lastRunStepError, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, conditionVariableHints = [], httpVariableHints = [], workflowServices = [] }: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [variableInsertOpen, setVariableInsertOpen] = useState(false);
  const [variableInsertShortRef, setVariableInsertShortRef] = useState(false);
  const [variableInsertInitialSearch, setVariableInsertInitialSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const insertApplyRef = useRef<(snippet: string) => void>(() => {});

  // Reset to inline view when a different node is selected
  useEffect(() => {
    setExpanded(false);
  }, [node?.id]);

  const workflowOnlyPickerHints = useMemo(
    (): WorkflowVariableHint[] =>
      Object.keys(workflowVariables)
        .filter((k) => k.trim().length > 0)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => {
          const t = k.trim();
          return { ref: t, label: `${t} (workflow)` };
        }),
    [workflowVariables],
  );

  /** Always fold in this step’s `initialVariables` + workflow defaults; parent graph hints can be empty if type/id desync. */
  const variableInsertHints = useMemo((): WorkflowVariableHint[] => {
    if (!node || !isHttpWorkflowNode(node)) return workflowOnlyPickerHints;
    const data = node.data as HttpNodeData;
    const withStep = mergeHttpVariableHintsWithStepInitialVars(httpVariableHints, data);
    const byRef = new Map<string, WorkflowVariableHint>(withStep.map((h) => [h.ref, h]));
    for (const h of workflowOnlyPickerHints) {
      if (!byRef.has(h.ref)) byRef.set(h.ref, h);
    }
    return Array.from(byRef.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [node, httpVariableHints, workflowOnlyPickerHints]);

  const requestVariableInsert = useCallback((apply: (snippet: string) => void, shortRef = false, initialSearch = '') => {
    insertApplyRef.current = apply;
    setVariableInsertShortRef(shortRef);
    setVariableInsertInitialSearch(initialSearch);
    setVariableInsertOpen(true);
  }, []);

  const handleVariableInsertPicked = useCallback((template: string) => {
    insertApplyRef.current(template);
    setVariableInsertOpen(false);
  }, []);

  /** Shared config body rendered in both inline and expanded modal views. */
  const configContent = node ? (
    <>
      {isHttpWorkflowNode(node) && (
        <HttpConfig
          data={node.data as HttpNodeData}
          onChange={(patch) => onUpdateNode(node.id, patch)}
          activeTab={httpTab}
          onTabChange={setHttpTab}
          lastRunError={lastRunStepError ?? undefined}
          lastQuickTestRequestUrl={lastQuickTestRequestUrl}
          effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
          extractionSampleResponseBody={extractionSampleResponseBody}
          extractionFetchSample={extractionFetchSample}
          variableHints={httpVariableHints}
          onRequestVariableInsert={requestVariableInsert}
          workflowServices={workflowServices}
        />
      )}

      {node.type === 'condition' && (
        <ConditionConfig
          key={node.id}
          data={node.data as ConditionNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
          variableHints={conditionVariableHints}
        />
      )}

      {node.type === 'delay' && (
        <DelayConfig
          data={node.data as DelayNodeData}
          onChange={(data) => onUpdateNode(node.id, data)}
        />
      )}

      {(!node || isHttpWorkflowNode(node)) && (
        <VariablesSection
          title={node && isHttpWorkflowNode(node) ? 'Initial variables (this step)' : 'Workflow defaults'}
          hint={
            node && isHttpWorkflowNode(node)
              ? 'Per-step values override upstream for the same name. To target a specific earlier HTTP step, use {{node:<step id>.name}} in Params or the URL (see the list under Params), or remove this row so {{name}} resolves from upstream.'
              : 'Available as {{name}} on every HTTP step unless that step sets its own. Save the workflow to persist.'
          }
          variables={
            node && isHttpWorkflowNode(node)
              ? (node.data as HttpNodeData).initialVariables ?? {}
              : workflowVariables
          }
          onUpdateVariables={
            node && isHttpWorkflowNode(node)
              ? (vars) => onUpdateNode(node.id, { initialVariables: vars })
              : (vars) => onUpdateWorkflowVariables(vars)
          }
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
        />
      )}
    </>
  ) : null;

  return (
    <div className="wf-config-panel">
      {!node && (
        <div className="wf-config-empty">
          <p>Select a node to configure</p>
          <p className="wf-config-hint">Click any step on the canvas, or add one from the palette</p>
        </div>
      )}

      {node && !expanded && (
        <>
          <div className="wf-config-header">
            <span className="wf-config-type">{node.type.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm" onClick={() => setExpanded(true)} title="Expand to full screen">⛶</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
            </div>
          </div>
          {configContent}
        </>
      )}

      {node && expanded && (
        <>
          <div className="wf-config-header">
            <span className="wf-config-type">{node.type.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm" onClick={() => setExpanded(true)} title="Expand to full screen">⛶</button>
              <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
            </div>
          </div>
          <div
            className="modal-overlay wf-expand-modal-overlay"
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
          >
            <div
              className="modal ram-modal wf-expand-modal"
              role="dialog"
              aria-labelledby="wf-expand-title"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ram-header">
                <h3 id="wf-expand-title">{node.type.toUpperCase()} — {(node.data as HttpNodeData).label || 'Step Config'}</h3>
                <button type="button" className="ram-modal-close" onClick={() => setExpanded(false)} aria-label="Close">&times;</button>
              </div>
              <div className="wf-expand-modal-body">
                {configContent}
              </div>
            </div>
          </div>
        </>
      )}

      {!node && (
        <VariablesSection
          title="Workflow defaults"
          hint="Available as {{name}} on every HTTP step unless that step sets its own. Save the workflow to persist."
          variables={workflowVariables}
          onUpdateVariables={(vars) => onUpdateWorkflowVariables(vars)}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
          deprecatedKeys={workflowServices.length > 0 ? ['baseUrl'] : []}
        />
      )}

      <WorkflowVariableInsertModal
        open={variableInsertOpen}
        hints={variableInsertHints}
        shortRef={variableInsertShortRef}
        initialSearch={variableInsertInitialSearch}
        onClose={() => setVariableInsertOpen(false)}
        onPick={handleVariableInsertPicked}
      />
    </div>
  );
}

// ── HTTP Config ───────────────────────────────────────

function parseQueryParams(url: string): KeyValue[] {
  try {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return [];
    const params = new URLSearchParams(url.slice(qIdx + 1));
    const result: KeyValue[] = [];
    params.forEach((v, k) => result.push({ key: k, value: v }));
    return result;
  } catch { return []; }
}

/** Encode query parts unless they contain `{{var}}` templates (encoding breaks substitution). */
function encodeQueryPart(raw: string, kind: 'key' | 'value'): string {
  const t = kind === 'key' ? raw.trim() : raw;
  if (/\{\{[\s\S]*?\}\}/.test(t)) return t;
  return encodeURIComponent(t);
}

function rebuildUrl(baseUrl: string, entries: ParamEntry[]): string {
  const qIdx = baseUrl.indexOf('?');
  const path = qIdx === -1 ? baseUrl : baseUrl.slice(0, qIdx);
  const active = entries.filter(e => e.enabled && e.key.trim());
  if (active.length === 0) return path;
  const qs = active.map(e => `${encodeQueryPart(e.key, 'key')}=${encodeQueryPart(e.value, 'value')}`).join('&');
  return `${path}?${qs}`;
}

function HttpVariableRefHints({ hints }: { hints: WorkflowVariableHint[] }) {
  const sorted = useMemo(
    () =>
      [...hints].sort((a, b) => {
        const ap = a.ref.startsWith('node:') ? 0 : 1;
        const bp = b.ref.startsWith('node:') ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.ref.localeCompare(b.ref);
      }),
    [hints],
  );
  if (sorted.length === 0) return null;
  return (
    <details className="wf-http-var-hints">
      <summary>Variables you can paste (workflow + upstream)</summary>
      <p className="wf-config-hint-text" style={{ marginTop: 8 }}>
        <code>{'{{name}}'}</code> uses the latest value. If several steps define the same name, use{' '}
        <code>{'{{node:<step id>.name}}'}</code> to choose one step — copy the template below (the id matches the node on the canvas).
      </p>
      <ul className="wf-http-var-hints-list" role="list">
        {sorted.map((h) => (
          <li key={h.ref} className="wf-http-var-hints-item">
            <span className="wf-http-var-hints-label">{h.label}</span>
            <code className="wf-http-var-hints-code">{`{{${h.ref}}}`}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

function HttpConfig({ data, onChange, activeTab, onTabChange, lastRunError, lastQuickTestRequestUrl, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, variableHints = [], onRequestVariableInsert, workflowServices = [] }: {
  data: HttpNodeData;
  /** Partial patch merged in the parent — never pass full `data` here. */
  onChange: (patch: Partial<HttpNodeData>) => void;
  activeTab: HttpTab;
  onTabChange: (tab: HttpTab) => void;
  /** From last Quick Test — helps debug without opening DevTools. */
  lastRunError?: string;
  lastQuickTestRequestUrl?: string | null;
  effectiveQuickTestBaseUrl: string;
  extractionSampleResponseBody?: string;
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  variableHints?: WorkflowVariableHint[];
  /** Opens variable picker; call with a function that appends the chosen `{{…}}` snippet to the target field. */
  onRequestVariableInsert: (apply: (snippet: string) => void, shortRef?: boolean, initialSearch?: string) => void;
  /** Workflow-level services from the Service Registry. */
  workflowServices?: WorkflowService[];
}) {
  const s = data.scenario;
  const update = (patch: Partial<Scenario>) => onChange({ scenario: { ...s, ...patch } });

  const [extraEmptyRows, setExtraEmptyRows] = useState(0);

  const queryParams = useMemo<ParamEntry[]>(() => {
    const parsed = parseQueryParams(s.url);
    const base: ParamEntry[] = parsed.length === 0
      ? [{ key: '', value: '', enabled: true, description: '' }]
      : parsed.map(kv => ({ ...kv, enabled: true, description: '' }));
    for (let i = 0; i < extraEmptyRows; i++) {
      base.push({ key: '', value: '', enabled: true, description: '' });
    }
    return base;
  }, [s.url, extraEmptyRows]);

  const paramCount = useMemo(() => queryParams.filter(p => p.key.trim() && p.enabled).length, [queryParams]);

  const handleParamsChange = useCallback((entries: ParamEntry[]) => {
    // Count trailing empty rows to preserve them as local state
    let trailing = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (!entries[i].key.trim() && !entries[i].value.trim()) trailing++;
      else break;
    }
    // Always keep at least one empty row (the default), extras beyond that are tracked
    const filledCount = entries.filter(e => e.key.trim()).length;
    const newExtra = Math.max(0, trailing - (filledCount === 0 ? 1 : 0));
    setExtraEmptyRows(newExtra);
    const newUrl = rebuildUrl(s.url, entries);
    update({ url: newUrl });
  }, [s.url, update]);

  return (
    <div className="wf-config-body">
      {lastRunError && (
        <div className="wf-config-run-error" role="alert">
          <span className="wf-config-run-error-title">Last run error</span>
          <pre className="wf-config-run-error-text">{lastRunError}</pre>
        </div>
      )}
      {lastQuickTestRequestUrl && (
        <div className="wf-config-last-req-url">
          <span className="wf-config-last-req-url-label">Last request URL (resolved)</span>
          <code className="wf-config-last-req-url-value" title={lastQuickTestRequestUrl}>{lastQuickTestRequestUrl}</code>
        </div>
      )}
      <div className="wf-config-managed-note" role="note" aria-label="Host and auth are managed at workflow level">
        <span className="wf-config-managed-note-title">Service</span>
        <select
          value={data.serviceId ?? ''}
          onChange={(e) => {
            const svcId = e.target.value || undefined;
            const svc = workflowServices.find((s) => s.id === svcId);
            onChange({ serviceId: svcId, label: svc ? svc.name : data.label });
          }}
          className="wf-config-service-select"
        >
          <option value="">None (use harness bar)</option>
          {workflowServices.map((svc) => (
            <option key={svc.id} value={svc.id}>{svc.name}</option>
          ))}
        </select>
        {workflowServices.length === 0 && (
          <p className="wf-config-managed-note-text">
            Click the <strong>🔗 Services</strong> button in the toolbar to register external services.
          </p>
        )}
      </div>
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>

      <div className="wf-config-url-row">
        <select value={s.method} onChange={(e) => update({ method: e.target.value as Scenario['method'] })} className="wf-config-method-select">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="wf-config-url-field-wrap">
          <input
            value={s.url.replace(/\{\{node:"[^"]+"\.([^}]+)\}\}/g, '{{$1}}')}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="https://api.example.com/..."
            className="wf-config-url-input"
            title={s.url}
          />
          <button
            type="button"
            className="btn btn-sm wf-config-insert-var-btn"
            title="Insert variable from workflow or upstream step"
            onClick={() => onRequestVariableInsert((snippet) => update({ url: s.url + snippet }), true)}
          >
            Insert…
          </button>
        </div>
      </div>

      <div className="wf-config-tabs">
        {(['url', 'headers', 'body', 'extract'] as HttpTab[]).map(tab => (
          <button key={tab} className={`wf-config-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => onTabChange(tab)}>
            {tab === 'url' ? 'Params' : tab === 'extract' ? 'Extract' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'url' && paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
            {tab === 'extract' && (s.extractions?.length ?? 0) > 0 && <span className="tab-badge">{s.extractions!.length}</span>}
            {tab === 'headers' && s.headers.filter(h => h.key.trim()).length > 0 && <span className="tab-badge">{s.headers.filter(h => h.key.trim()).length}</span>}
          </button>
        ))}
      </div>

      <div className="wf-config-tab-content">
        {activeTab === 'url' && (
          <div>
            <p className="wf-config-hint-text" style={{ marginBottom: 8 }}>
              Use <code>{'{{variable}}'}</code> in the URL and params — values are substituted at run time.
              Templates are not URL-encoded (so <code>country={'{{country}}'}</code> becomes <code>US</code>, not literal braces).
            </p>
            <HttpVariableRefHints hints={variableHints} />
            <ParamsEditor
              params={queryParams}
              onChange={handleParamsChange}
              onInsertVariable={(rowIndex, paramKey) =>
                onRequestVariableInsert((snippet) => {
                  const next = queryParams.map((p, idx) =>
                    idx === rowIndex ? { ...p, value: snippet } : p,
                  );
                  handleParamsChange(next);
                }, false, paramKey)
              }
            />
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="wf-config-kv-list">
            {s.headers.map((h, i) => (
              <div key={i} className="wf-config-kv-row">
                <input value={h.key} placeholder="Header name" onChange={(e) => {
                  const next = [...s.headers]; next[i] = { ...h, key: e.target.value }; update({ headers: next });
                }} />
                <div className="wf-config-kv-val-wrap">
                  <input value={h.value} placeholder="Value (supports {{var}})" onChange={(e) => {
                    const next = [...s.headers]; next[i] = { ...h, value: e.target.value }; update({ headers: next });
                  }} />
                  <button
                    type="button"
                    className="btn btn-sm wf-config-insert-var-btn"
                    title="Insert variable"
                    onClick={() =>
                      onRequestVariableInsert((snippet) => {
                        const next = [...s.headers];
                        next[i] = { ...h, value: snippet };
                        update({ headers: next });
                      }, false, h.key)
                    }
                  >
                    Insert…
                  </button>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => update({ headers: s.headers.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => update({ headers: [...s.headers, { key: '', value: '' }] })}>+ Add Header</button>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="wf-config-field wf-config-body-field-wrap">
            <label>Body (supports {'{{var}}'})</label>
            <div className="wf-config-body-insert-row">
              <button
                type="button"
                className="btn btn-sm"
                title="Insert variable from workflow or upstream step"
                onClick={() => onRequestVariableInsert((snippet) => update({ body: s.body + snippet }), true)}
              >
                Insert variable…
              </button>
            </div>
            <textarea
              value={s.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder='{"key": "{{value}}"}'
              rows={6}
              className="wf-config-textarea"
            />
          </div>
        )}

        {activeTab === 'extract' && (
          <ExtractionEditor
            extractions={s.extractions ?? []}
            onChange={(extractions) => update({ extractions })}
            sampleResponseBody={extractionSampleResponseBody}
            fetchSample={
              extractionFetchSample
                ? {
                    ...extractionFetchSample,
                    host: {
                      enabled: !!s.fetchHostEnabled,
                      setEnabled: (v) => update({ fetchHostEnabled: v }),
                      override: s.fetchHostOverride ?? '',
                      setOverride: (v) => update({ fetchHostOverride: v }),
                      resolvedBaseUrl: effectiveQuickTestBaseUrl,
                    },
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

// ── Condition Config ──────────────────────────────────

const CUSTOM_SELECT = '__custom__';

function ConditionConfig({
  data,
  onChange,
  variableHints,
}: {
  data: ConditionNodeData;
  onChange: (d: ConditionNodeData) => void;
  variableHints: WorkflowVariableHint[];
}) {
  const [uiMode, setUiMode] = useState<'pick' | 'expr'>(() => guessConditionLeftMode(data.left));
  const [pickCustom, setPickCustom] = useState(false);

  const singleName = useMemo(() => parseSingleVariableRef(data.left), [data.left]);
  const hintSet = useMemo(() => new Set(variableHints.map((h) => h.ref)), [variableHints]);
  const validation = useMemo(
    () => validateConditionLeftRefs(data.left, variableHints),
    [data.left, variableHints],
  );

  useEffect(() => {
    const sn = parseSingleVariableRef(data.left);
    if (sn !== null && !hintSet.has(sn)) setPickCustom(true);
    else if (sn !== null && hintSet.has(sn)) setPickCustom(false);
  }, [data.left, hintSet]);

  const selectValue = useMemo(() => {
    if (singleName !== null && hintSet.has(singleName)) return singleName;
    if (pickCustom || (singleName !== null && !hintSet.has(singleName))) return CUSTOM_SELECT;
    return '';
  }, [singleName, hintSet, pickCustom]);

  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Left operand</label>
        <div className="wf-condition-left-mode" role="group" aria-label="Left operand mode">
          <label className="wf-config-inline-radio">
            <input
              type="radio"
              name="wf-condition-left-mode"
              checked={uiMode === 'pick'}
              onChange={() => setUiMode('pick')}
            />
            Choose variable
          </label>
          <label className="wf-config-inline-radio">
            <input
              type="radio"
              name="wf-condition-left-mode"
              checked={uiMode === 'expr'}
              onChange={() => setUiMode('expr')}
            />
            Expression
          </label>
        </div>

        {uiMode === 'pick' && (
          <>
            <select
              className={!validation.ok && singleName !== null ? 'wf-input-invalid' : undefined}
              value={selectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') {
                  setPickCustom(false);
                  onChange({ ...data, left: '' });
                  return;
                }
                if (v === CUSTOM_SELECT) {
                  setPickCustom(true);
                  onChange({ ...data, left: '' });
                  return;
                }
                setPickCustom(false);
                onChange({ ...data, left: `{{${v}}}` });
              }}
              aria-label="Variable for left operand"
            >
              <option value="">— Select variable —</option>
              {variableHints.map((h) => (
                <option key={h.ref} value={h.ref} title={h.label}>
                  {h.label}
                </option>
              ))}
              <option value={CUSTOM_SELECT}>Custom name…</option>
            </select>
            {selectValue === CUSTOM_SELECT && (
              <input
                className={!validation.ok && singleName !== null && !hintSet.has(singleName) ? 'wf-input-invalid' : undefined}
                style={{ marginTop: 6 }}
                placeholder="name or node:stepId.name"
                value={singleName ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^a-zA-Z0-9_.:\-"]/g, '');
                  onChange({ ...data, left: raw ? `{{${raw}}}` : '' });
                }}
                aria-label="Custom variable name or node-scoped ref"
              />
            )}
            {variableHints.length === 0 && (
              <p className="wf-config-hint-text" style={{ marginTop: 6 }}>
                No names yet. Add Initial variables below, or connect an HTTP step above and define extractions.
              </p>
            )}
          </>
        )}

        {uiMode === 'expr' && (
          <textarea
            className={`wf-config-textarea ${!validation.ok ? 'wf-input-invalid' : ''}`}
            value={data.left}
            onChange={(e) => onChange({ ...data, left: e.target.value })}
            rows={3}
            placeholder="Literal text or {{var}} placeholders"
            spellCheck={false}
            aria-label="Left operand expression"
          />
        )}

        {!validation.ok && (
          <p className="wf-config-field-error" role="alert">
            Unknown variable
            {validation.unknown.length > 1 ? 's' : ''}
            {': '}
            {validation.unknown.map((u) => (
              <code key={u}>{`{{${u}}}`}</code>
            ))}
            . Use a hint from the dropdown, or <code>{'{{node:<step id>.<name>}}'}</code> for a specific HTTP step.
          </p>
        )}

        <p className="wf-config-hint-text" style={{ marginTop: 4 }}>
          Valid names appear in the dropdown. Unscoped names refer to the latest value; scoped refs target one HTTP
          step when several share a name. After a request runs, <code>status</code> is the response code unless you
          extract a different <code>status</code> from the body.
        </p>
      </div>
      <div className="wf-config-field">
        <label>Operator</label>
        <select value={data.operator} onChange={(e) => onChange({ ...data, operator: e.target.value as ConditionNodeData['operator'] })}>
          <option value="==">== (equals)</option>
          <option value="!=">!= (not equals)</option>
          <option value=">">{'>'} (greater than)</option>
          <option value="<">{'<'} (less than)</option>
          <option value=">=">{'≥'} (greater or equal)</option>
          <option value="<=">{'≤'} (less or equal)</option>
          <option value="contains">contains</option>
          <option value="not-contains">not contains</option>
          <option value="regex">regex match</option>
        </select>
      </div>
      <div className="wf-config-field">
        <label>Right (value to compare)</label>
        <input value={data.right} onChange={(e) => onChange({ ...data, right: e.target.value })} placeholder="200" />
      </div>
      <p className="wf-config-hint-text" style={{ marginTop: 4 }}>
        Connect multiple HTTP (or other) steps to the same Yes or No handle to run them all when that branch is taken; steps on the other branch are skipped.
      </p>
    </div>
  );
}

// ── Delay Config ──────────────────────────────────────

function DelayConfig({ data, onChange }: { data: DelayNodeData; onChange: (d: DelayNodeData) => void }) {
  return (
    <div className="wf-config-body">
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ ...data, label: e.target.value })} />
      </div>
      <div className="wf-config-field">
        <label>Mode</label>
        <select value={data.mode} onChange={(e) => onChange({ ...data, mode: e.target.value as 'fixed' | 'random' })}>
          <option value="fixed">Fixed</option>
          <option value="random">Random Range</option>
        </select>
      </div>
      {data.mode === 'fixed' && (
        <div className="wf-config-field">
          <label>Delay (ms)</label>
          <input type="number" min={0} max={60000} value={data.delayMs} onChange={(e) => onChange({ ...data, delayMs: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {data.mode === 'random' && (
        <>
          <div className="wf-config-field">
            <label>Min (ms)</label>
            <input type="number" min={0} value={data.minMs ?? 0} onChange={(e) => onChange({ ...data, minMs: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="wf-config-field">
            <label>Max (ms)</label>
            <input type="number" min={0} value={data.maxMs ?? data.delayMs} onChange={(e) => onChange({ ...data, maxMs: parseInt(e.target.value) || 0 })} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Variables Section (always visible in config panel) ─

const VAR_NAME_COL_MIN = 100;
const VAR_NAME_COL_MAX = 420;
const VAR_NAME_COL_DEFAULT = 200;
/** Values longer than this use View + modal instead of a cramped single-line input. */
const VAR_VALUE_LONG = 100;

function VariablesSection({ title, hint, variables, onUpdateVariables, newVarKey, setNewVarKey, newVarValue, setNewVarValue, onRequestVariableInsert, deprecatedKeys = [] }: {
  title: string;
  hint: string;
  variables: Record<string, string>;
  onUpdateVariables: (v: Record<string, string>) => void;
  newVarKey: string; setNewVarKey: (s: string) => void;
  newVarValue: string; setNewVarValue: (s: string) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void, shortRef?: boolean, initialSearch?: string) => void;
  deprecatedKeys?: string[];
}) {
  const { openVariableDetail } = useWorkflowInspect();
  const entries = Object.entries(variables);
  const [nameColWidth, setNameColWidth] = useState(VAR_NAME_COL_DEFAULT);
  const resizeDrag = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeDrag.current) return;
      const delta = e.clientX - resizeDrag.current.startX;
      const next = Math.min(VAR_NAME_COL_MAX, Math.max(VAR_NAME_COL_MIN, resizeDrag.current.startW + delta));
      setNameColWidth(next);
    };
    const onUp = () => {
      resizeDrag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDrag.current = { startX: e.clientX, startW: nameColWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const addVar = () => {
    const key = newVarKey.trim().replace(/[{}]/g, '');
    if (!key) return;
    onUpdateVariables({ ...variables, [key]: newVarValue });
    setNewVarKey('');
    setNewVarValue('');
  };

  return (
    <div className="wf-config-vars">
      <div className="wf-config-vars-title">{title}</div>
      <p className="wf-config-hint-text" style={{ margin: '0 0 6px' }}>
        {hint} Drag the divider to resize the name column.
      </p>
      {entries.map(([key, value], index) => {
        const isLong = value.length > VAR_VALUE_LONG || value.includes('\n');
        const isDeprecated = deprecatedKeys.includes(key);
        return (
        /* index key: variable *name* changes while typing during rename; key={key} remounts the row and drops focus */
        <div key={index} className={`wf-config-kv-row wf-config-kv-row-vars${isDeprecated ? ' wf-var-deprecated' : ''}`}>
          <div className="wf-var-name-cell" style={{ width: nameColWidth }}>
            <input
              className="wf-var-key-input"
              value={key}
              onChange={(e) => {
                const newKey = e.target.value.replace(/[{}]/g, '').trim();
                if (!newKey || newKey === key) return;
                const next: Record<string, string> = {};
                for (const [k, v] of Object.entries(variables)) {
                  next[k === key ? newKey : k] = v;
                }
                onUpdateVariables(next);
              }}
              title={isDeprecated ? `"${key}" is managed by the Service Registry and can be removed` : undefined}
            />
          </div>
          <div className="wf-var-col-resize" onMouseDown={onResizeStart} title="Drag to resize name column" role="separator" aria-orientation="vertical" />
          {isLong ? (
            <div className="wf-var-value-long-wrap">
              <input
                className="wf-var-value-input wf-var-value-preview"
                readOnly
                value={value.length > 72 ? `${value.slice(0, 72)}…` : value}
                title={value}
                onClick={() => openVariableDetail(key)}
              />
              {onRequestVariableInsert && (
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable"
                  onClick={() =>
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }), false, key)
                  }
                >
                  Insert…
                </button>
              )}
              <button type="button" className="btn btn-sm wf-var-view-btn" onClick={() => openVariableDetail(key)}>
                View…
              </button>
            </div>
          ) : (
            <div className="wf-var-value-with-insert">
              <input
                className="wf-var-value-input"
                value={value}
                onChange={(e) => {
                  onUpdateVariables({ ...variables, [key]: e.target.value });
                }}
              />
              {onRequestVariableInsert && (
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable from workflow or upstream step"
                  onClick={() =>
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }), false, key)
                  }
                >
                  Insert…
                </button>
              )}
            </div>
          )}
          <button type="button" className="btn btn-sm btn-danger" onClick={() => {
            const next = { ...variables }; delete next[key]; onUpdateVariables(next);
          }}>×</button>
        </div>
        );
      })}
      <div className="wf-config-kv-row wf-config-kv-row-vars" style={{ marginTop: 4 }}>
        <div className="wf-var-name-cell" style={{ width: nameColWidth }}>
          <input value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="name" onKeyDown={(e) => e.key === 'Enter' && addVar()} onBlur={() => { if (newVarKey.trim() && newVarValue) addVar(); }} className="wf-var-key-input" />
        </div>
        <div className="wf-var-col-resize wf-var-col-resize-inert" aria-hidden />
        <div className="wf-var-new-row-value">
          <input
            className="wf-var-value-input"
            value={newVarValue}
            onChange={(e) => setNewVarValue(e.target.value)}
            placeholder="value"
            onKeyDown={(e) => e.key === 'Enter' && addVar()}
            onBlur={() => { if (newVarKey.trim()) addVar(); }}
          />
          {onRequestVariableInsert && (
            <button
              type="button"
              className="btn btn-sm wf-config-insert-var-btn"
              title="Insert variable"
              onClick={() => onRequestVariableInsert((snippet) => setNewVarValue(newVarValue + snippet))}
            >
              Insert…
            </button>
          )}
        </div>
        <button type="button" className="btn btn-sm" onClick={addVar}>+</button>
      </div>
    </div>
  );
}
