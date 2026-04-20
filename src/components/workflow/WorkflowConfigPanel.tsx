import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import WorkflowVariableInsertModal from './WorkflowVariableInsertModal';
import type { WorkflowNode, HttpNodeData, ConditionNodeData, DelayNodeData, WorkflowNodeData } from '../../types/workflow';
import {
  guessConditionLeftMode,
  isHttpWorkflowNode,
  mergeHttpVariableHintsWithStepInitialVars,
  parseSingleVariableRef,
  validateConditionLeftRefs,
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import type { Scenario, Extraction, ExtractionSource, KeyValue, GlobalAuthProfile, AuthConfig, Environment, Microservice } from '../../types';
import { resolveHttpNodeBaseUrl } from '../../utils/workflowHostResolve';
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
  globalAuthProfiles: GlobalAuthProfile[];
  /** Final URL from the last Quick Test (success or fail) for debugging. */
  lastQuickTestRequestUrl?: string | null;
  /** HTTP step error line from the last run (kept off node `data` in the designer). */
  lastRunStepError?: string | null;
  /**
   * Global harness selection only — for “Use harness bar” preview in HTTP step host UI.
   * (Per-step config may override.)
   */
  harnessBaseUrl: string;
  /**
   * For the selected HTTP node: resolved base after per-request host override, else harness.
   * Used for Extract → Fetch sample and URL hints.
   */
  effectiveQuickTestBaseUrl: string;
  /** Populate per-request Environment / Microservice on HTTP nodes. */
  workflowEnvironments: Environment[];
  workflowMicroservices: Microservice[];
  harnessEnvironmentId: string;
  harnessMicroserviceId: string;
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
}

type HttpTab = 'url' | 'headers' | 'body' | 'auth' | 'extract';

export default function WorkflowConfigPanel({ node, workflowVariables, onUpdateWorkflowVariables, onUpdateNode, onDeleteNode, globalAuthProfiles, lastQuickTestRequestUrl, lastRunStepError, harnessBaseUrl, effectiveQuickTestBaseUrl, workflowEnvironments, workflowMicroservices, harnessEnvironmentId, harnessMicroserviceId, extractionSampleResponseBody, extractionFetchSample, conditionVariableHints = [], httpVariableHints = [] }: Props) {
  const [httpTab, setHttpTab] = useState<HttpTab>('url');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [variableInsertOpen, setVariableInsertOpen] = useState(false);
  const insertApplyRef = useRef<(snippet: string) => void>(() => {});

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

  const requestVariableInsert = useCallback((apply: (snippet: string) => void) => {
    insertApplyRef.current = apply;
    setVariableInsertOpen(true);
  }, []);

  const handleVariableInsertPicked = useCallback((template: string) => {
    insertApplyRef.current(template);
    setVariableInsertOpen(false);
  }, []);

  return (
    <div className="wf-config-panel">
      {!node && (
        <div className="wf-config-empty">
          <p>Select a node to configure</p>
          <p className="wf-config-hint">Click any step on the canvas, or add one from the palette</p>
        </div>
      )}

      {node && (
        <>
          <div className="wf-config-header">
            <span className="wf-config-type">{node.type.toUpperCase()}</span>
            <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node.id)} title="Delete node">×</button>
          </div>

          {isHttpWorkflowNode(node) && (
            <HttpConfig
              data={node.data as HttpNodeData}
              onChange={(patch) => onUpdateNode(node.id, patch)}
              activeTab={httpTab}
              onTabChange={setHttpTab}
              globalAuthProfiles={globalAuthProfiles}
              lastRunError={lastRunStepError ?? undefined}
              lastQuickTestRequestUrl={lastQuickTestRequestUrl}
              harnessBaseUrl={harnessBaseUrl}
              effectiveQuickTestBaseUrl={effectiveQuickTestBaseUrl}
              workflowEnvironments={workflowEnvironments}
              workflowMicroservices={workflowMicroservices}
              harnessEnvironmentId={harnessEnvironmentId}
              harnessMicroserviceId={harnessMicroserviceId}
              extractionSampleResponseBody={extractionSampleResponseBody}
              extractionFetchSample={extractionFetchSample}
              variableHints={httpVariableHints}
              onRequestVariableInsert={requestVariableInsert}
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
        </>
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
              : onUpdateWorkflowVariables
          }
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          onRequestVariableInsert={requestVariableInsert}
        />
      )}

      <WorkflowVariableInsertModal
        open={variableInsertOpen}
        hints={variableInsertHints}
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

function HttpHostFields({
  data,
  onChange,
  environments,
  microservices,
  harnessEnvId,
  harnessSvcId,
  harnessBaseUrl,
}: {
  data: HttpNodeData;
  /** Partial patch only — never spread full `data` (avoids wiping `initialVariables`). */
  onChange: (patch: Partial<HttpNodeData>) => void;
  environments: Environment[];
  microservices: Microservice[];
  harnessEnvId: string;
  harnessSvcId: string;
  harnessBaseUrl: string;
}) {
  const hasExplicitBase = !!data.hostBaseUrl?.trim();
  const hasPair = !!(data.hostEnvironmentId && data.hostMicroserviceId);
  const perRequest = hasExplicitBase || hasPair;

  const microservicesForEnv = useMemo(
    () => (data.hostEnvironmentId ? microservices.filter((s) => data.hostEnvironmentId! in s.baseUrls) : []),
    [microservices, data.hostEnvironmentId],
  );

  const preview = useMemo(
    () => resolveHttpNodeBaseUrl(data, microservices) || harnessBaseUrl.trim() || '—',
    [data, microservices, harnessBaseUrl],
  );

  const handleEnvChange = (envId: string) => {
    if (!envId) {
      onChange({ hostEnvironmentId: undefined, hostMicroserviceId: undefined, hostBaseUrl: undefined });
      return;
    }
    const svcs = microservices.filter((s) => envId in s.baseUrls);
    let svcId = data.hostMicroserviceId;
    if (!svcId || !svcs.some((s) => s.id === svcId)) {
      svcId = svcs[0]?.id;
    }
    onChange({ hostEnvironmentId: envId, hostMicroserviceId: svcId, hostBaseUrl: undefined });
  };

  const handleSvcChange = (svcId: string) => {
    if (!svcId) {
      onChange({ hostEnvironmentId: undefined, hostMicroserviceId: undefined, hostBaseUrl: undefined });
      return;
    }
    const svc = microservices.find((m) => m.id === svcId);
    let envId = data.hostEnvironmentId;
    if (svc && envId && !(envId in svc.baseUrls)) {
      envId = Object.keys(svc.baseUrls)[0];
    }
    onChange({ hostMicroserviceId: svcId, hostEnvironmentId: envId, hostBaseUrl: undefined });
  };

  return (
    <div className="wf-config-field wf-config-host">
      <label>Quick Test host</label>
      <div className="wf-host-mode" role="group" aria-label="Quick Test host mode">
        <label className="wf-config-inline-radio">
          <input
            type="radio"
            name="wf-http-host-mode"
            checked={!perRequest}
            onChange={() =>
              onChange({ hostEnvironmentId: undefined, hostMicroserviceId: undefined, hostBaseUrl: undefined })
            }
          />
          Harness bar (default)
        </label>
        <label className="wf-config-inline-radio">
          <input
            type="radio"
            name="wf-http-host-mode"
            checked={perRequest}
            onChange={() => {
              const envId = harnessEnvId || environments[0]?.id;
              if (!envId) return;
              const svcs = microservices.filter((s) => envId in s.baseUrls);
              const svcId = (harnessSvcId && svcs.some((s) => s.id === harnessSvcId))
                ? harnessSvcId
                : svcs[0]?.id;
              if (!svcId) return;
              onChange({ hostEnvironmentId: envId, hostMicroserviceId: svcId, hostBaseUrl: undefined });
            }}
          />
          This request only
        </label>
      </div>
      {perRequest && hasExplicitBase && !hasPair && (
        <p className="wf-config-hint-text" style={{ marginTop: 4 }}>
          Base URL comes from this request’s URL collection. Use Environment and Microservice below to use a
          registered host instead.
        </p>
      )}
      {perRequest && (
        <>
          <select
            className="wf-config-host-select"
            value={data.hostEnvironmentId ?? ''}
            onChange={(e) => handleEnvChange(e.target.value)}
            aria-label="Environment for this request"
          >
            <option value="">Environment…</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className="wf-config-host-select"
            value={data.hostMicroserviceId ?? ''}
            onChange={(e) => handleSvcChange(e.target.value)}
            disabled={!data.hostEnvironmentId}
            aria-label="Microservice for this request"
          >
            <option value="">Microservice…</option>
            {microservicesForEnv.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}
      <p className="wf-config-hint-text" style={{ marginTop: 8 }}>
        Resolved base for this step: <code>{preview}</code>
      </p>
    </div>
  );
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

function HttpConfig({ data, onChange, activeTab, onTabChange, globalAuthProfiles, lastRunError, lastQuickTestRequestUrl, harnessBaseUrl, effectiveQuickTestBaseUrl, workflowEnvironments, workflowMicroservices, harnessEnvironmentId, harnessMicroserviceId, extractionSampleResponseBody, extractionFetchSample, variableHints = [], onRequestVariableInsert }: {
  data: HttpNodeData;
  /** Partial patch merged in the parent — never pass full `data` here. */
  onChange: (patch: Partial<HttpNodeData>) => void;
  activeTab: HttpTab;
  onTabChange: (tab: HttpTab) => void;
  globalAuthProfiles: GlobalAuthProfile[];
  /** From last Quick Test — helps debug without opening DevTools. */
  lastRunError?: string;
  lastQuickTestRequestUrl?: string | null;
  harnessBaseUrl: string;
  effectiveQuickTestBaseUrl: string;
  workflowEnvironments: Environment[];
  workflowMicroservices: Microservice[];
  harnessEnvironmentId: string;
  harnessMicroserviceId: string;
  extractionSampleResponseBody?: string;
  extractionFetchSample?: Pick<ExtractionFetchSampleProps, 'onFetch' | 'fetching' | 'error'>;
  variableHints?: WorkflowVariableHint[];
  /** Opens variable picker; call with a function that appends the chosen `{{…}}` snippet to the target field. */
  onRequestVariableInsert: (apply: (snippet: string) => void) => void;
}) {
  const s = data.scenario;
  const update = (patch: Partial<Scenario>) => onChange({ scenario: { ...s, ...patch } });

  const queryParams = useMemo<ParamEntry[]>(() => {
    const parsed = parseQueryParams(s.url);
    if (parsed.length === 0) return [{ key: '', value: '', enabled: true, description: '' }];
    return parsed.map(kv => ({ ...kv, enabled: true, description: '' }));
  }, [s.url]);

  const paramCount = useMemo(() => queryParams.filter(p => p.key.trim() && p.enabled).length, [queryParams]);

  const handleParamsChange = useCallback((entries: ParamEntry[]) => {
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
      {workflowEnvironments.length > 0 && workflowMicroservices.length > 0 && (
        <HttpHostFields
          data={data}
          onChange={onChange}
          environments={workflowEnvironments}
          microservices={workflowMicroservices}
          harnessEnvId={harnessEnvironmentId}
          harnessSvcId={harnessMicroserviceId}
          harnessBaseUrl={harnessBaseUrl}
        />
      )}
      <div className="wf-config-field">
        <label>Label</label>
        <input value={data.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>

      <div className="wf-config-url-row">
        <select value={s.method} onChange={(e) => update({ method: e.target.value as Scenario['method'] })} className="wf-config-method-select">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="wf-config-url-field-wrap">
          <input value={s.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://api.example.com/..." className="wf-config-url-input" />
          <button
            type="button"
            className="btn btn-sm wf-config-insert-var-btn"
            title="Insert variable from workflow or upstream step"
            onClick={() => onRequestVariableInsert((snippet) => update({ url: s.url + snippet }))}
          >
            Insert…
          </button>
        </div>
      </div>

      <div className="wf-config-tabs">
        {(['url', 'headers', 'body', 'auth', 'extract'] as HttpTab[]).map(tab => (
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
              onInsertVariable={(rowIndex) =>
                onRequestVariableInsert((snippet) => {
                  const next = queryParams.map((p, idx) =>
                    idx === rowIndex ? { ...p, value: p.value + snippet } : p,
                  );
                  handleParamsChange(next);
                })
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
                        next[i] = { ...h, value: h.value + snippet };
                        update({ headers: next });
                      })
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
                onClick={() => onRequestVariableInsert((snippet) => update({ body: s.body + snippet }))}
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

        {activeTab === 'auth' && (
          <WorkflowAuthEditor
            auth={s.auth}
            globalAuthProfiles={globalAuthProfiles}
            onUpdate={(auth) => update({ auth })}
          />
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

// ── Workflow Auth Editor ──────────────────────────────

function WorkflowAuthEditor({ auth, globalAuthProfiles, onUpdate }: {
  auth: AuthConfig;
  globalAuthProfiles: GlobalAuthProfile[];
  onUpdate: (auth: AuthConfig) => void;
}) {
  const authSelectValue = (auth as any).globalProfileId ? 'global-profile' : auth.type;

  const handleTypeChange = (val: string) => {
    if (val === 'global-profile') {
      const first = globalAuthProfiles[0];
      if (first) onUpdate({ ...first.auth, globalProfileId: first.id } as any);
    } else {
      onUpdate({ type: val as AuthConfig['type'] });
    }
  };

  const handleProfileChange = (profileId: string) => {
    const profile = globalAuthProfiles.find(p => p.id === profileId);
    if (profile) onUpdate({ ...profile.auth, globalProfileId: profile.id } as any);
  };

  const selectedProfile = (auth as any).globalProfileId
    ? globalAuthProfiles.find(p => p.id === (auth as any).globalProfileId)
    : null;

  return (
    <div className="wf-config-auth">
      <div className="wf-config-field">
        <label>Auth Type</label>
        <select value={authSelectValue} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="none">None</option>
          {globalAuthProfiles.length > 0 && <option value="global-profile">Global Auth Profile</option>}
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
          <option value="oauth2">OAuth2 Client Credentials</option>
        </select>
      </div>

      {authSelectValue === 'global-profile' && (
        <div className="wf-config-field">
          <label>Select Profile</label>
          <select value={(auth as any).globalProfileId ?? ''} onChange={(e) => handleProfileChange(e.target.value)}>
            {globalAuthProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
            ))}
          </select>
          {selectedProfile && (
            <div className="wf-auth-profile-badge">
              <span className="wf-auth-type-badge">{selectedProfile.auth.type.toUpperCase()}</span>
              <span>{selectedProfile.name}</span>
            </div>
          )}
        </div>
      )}

      {auth.type === 'bearer' && !selectedProfile && (
        <>
          <div className="wf-config-field">
            <label>Prefix</label>
            <input value={auth.prefix ?? 'Bearer'} onChange={(e) => onUpdate({ ...auth, prefix: e.target.value })} placeholder="Bearer" />
          </div>
          <div className="wf-config-field">
            <label>Token (supports {'{{var}}'})</label>
            <input value={auth.token ?? ''} onChange={(e) => onUpdate({ ...auth, token: e.target.value })} placeholder="{{authToken}}" />
          </div>
        </>
      )}

      {auth.type === 'basic' && !selectedProfile && (
        <>
          <div className="wf-config-field">
            <label>Username</label>
            <input value={auth.username ?? ''} onChange={(e) => onUpdate({ ...auth, username: e.target.value })} />
          </div>
          <div className="wf-config-field">
            <label>Password</label>
            <input value={auth.password ?? ''} onChange={(e) => onUpdate({ ...auth, password: e.target.value })} type="password" />
          </div>
        </>
      )}

      {auth.type === 'apikey' && !selectedProfile && (
        <>
          <div className="wf-config-field">
            <label>Key Name</label>
            <input value={auth.apiKeyName ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyName: e.target.value })} />
          </div>
          <div className="wf-config-field">
            <label>Key Value</label>
            <input value={auth.apiKeyValue ?? ''} onChange={(e) => onUpdate({ ...auth, apiKeyValue: e.target.value })} />
          </div>
          <div className="wf-config-field">
            <label>Send In</label>
            <select value={auth.apiKeyIn ?? 'header'} onChange={(e) => onUpdate({ ...auth, apiKeyIn: e.target.value as 'header' | 'query' })}>
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </select>
          </div>
        </>
      )}

      {auth.type === 'oauth2' && !selectedProfile && (
        <>
          <div className="wf-config-field">
            <label>Token URL</label>
            <input value={auth.tokenUrl ?? ''} onChange={(e) => onUpdate({ ...auth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="wf-config-field">
            <label>Client ID</label>
            <input value={auth.clientId ?? ''} onChange={(e) => onUpdate({ ...auth, clientId: e.target.value })} />
          </div>
          <div className="wf-config-field">
            <label>Client Secret</label>
            <input value={auth.clientSecret ?? ''} onChange={(e) => onUpdate({ ...auth, clientSecret: e.target.value })} type="password" />
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

function VariablesSection({ title, hint, variables, onUpdateVariables, newVarKey, setNewVarKey, newVarValue, setNewVarValue, onRequestVariableInsert }: {
  title: string;
  hint: string;
  variables: Record<string, string>;
  onUpdateVariables: (v: Record<string, string>) => void;
  newVarKey: string; setNewVarKey: (s: string) => void;
  newVarValue: string; setNewVarValue: (s: string) => void;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
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
        return (
        /* index key: variable *name* changes while typing during rename; key={key} remounts the row and drops focus */
        <div key={index} className="wf-config-kv-row wf-config-kv-row-vars">
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
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }))
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
                onChange={(e) => onUpdateVariables({ ...variables, [key]: e.target.value })}
              />
              {onRequestVariableInsert && (
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable from workflow or upstream step"
                  onClick={() =>
                    onRequestVariableInsert((snippet) => onUpdateVariables({ ...variables, [key]: value + snippet }))
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
          <input value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="name" onKeyDown={(e) => e.key === 'Enter' && addVar()} className="wf-var-key-input" />
        </div>
        <div className="wf-var-col-resize wf-var-col-resize-inert" aria-hidden />
        <div className="wf-var-new-row-value">
          <input
            className="wf-var-value-input"
            value={newVarValue}
            onChange={(e) => setNewVarValue(e.target.value)}
            placeholder="value"
            onKeyDown={(e) => e.key === 'Enter' && addVar()}
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
