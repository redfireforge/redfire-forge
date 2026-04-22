import { useState, useMemo, useCallback } from 'react';
import type {
  HttpNodeData,
  WorkflowService,
} from '../../types/workflow';
import {
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import type { Scenario, KeyValue } from '../../types';
import ExtractionEditor from '../ExtractionEditor';
import type { ExtractionFetchSampleProps } from '../ExtractionPathPickerModal';
import { ParamsEditor } from '../ParamsEditor';
import type { ParamEntry } from '../ParamsEditor';

export type HttpTab = 'url' | 'headers' | 'body' | 'extract';

// ── Query-param utilities ─────────────────────────────

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

// ── Variable-ref hints ────────────────────────────────

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

// ── Main component ────────────────────────────────────

export default function HttpConfig({ data, onChange, activeTab, onTabChange, lastRunError, lastQuickTestRequestUrl, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, variableHints = [], onRequestVariableInsert, workflowServices = [] }: {
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
