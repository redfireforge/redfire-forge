import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type {
  HttpNodeData,
  WorkflowService,
  ServiceEndpoint,
} from '../../types/workflow';
import type { Environment } from '../../../../shared/types';
import {
  type WorkflowVariableHint,
} from '../../utils/workflowVariableHints';
import type { Scenario } from '../../../../shared/types';
import ExtractionEditor from '../../../requests/components/ExtractionEditor';
import type { ExtractionFetchSampleProps } from '../../../requests/components/ExtractionEditor';
import TestEditorValidationTab from '../../../scenarios/components/TestEditorValidationTab';
import type { TestEditorValidationTabProps } from '../../../scenarios/components/TestEditorValidationTab';
import { ParamsEditor } from '../../../requests/components/ParamsEditor';
import type { ParamEntry } from '../../../requests/components/ParamsEditor';
import ExpressionInput from '../expression/ExpressionInput';
import ExpressionTextarea from '../expression/ExpressionTextarea';
import DataSourceEditor from '../../../scenarios/components/DataSourceEditor';
import { DataMapperModal, createVariableBindingAdapter, collectTemplateSlots } from '../../../../shared/components/data-mapper';
import { useBodyBuilderSync } from '../../../../shared/components/data-mapper/hooks/useBodyBuilderSync';
import { createRequestBodyAdapter } from '../../../../shared/components/data-mapper/adapters/requestBodyAdapter';
import type { VariableHintForBody } from '../../../../shared/components/data-mapper/adapters/requestBodyAdapter';
import {
  decodeTemplateVars,
  parseQueryParams,
  rebuildUrl as rebuildUrlShared,
} from '../../../../shared/utils/queryParams';
import { stripTrailingSlash } from '../../utils/workflowHostResolve';
import { CustomSelect } from '../../../../shared/components/CustomSelect';
import { KafkaCard, KafkaFormRow } from './KafkaConfigUi';
import { HttpVariableRefHints } from './HttpVariableRefHints';
import { HttpAuthSection } from './HttpAuthSection';

export type HttpTab = 'url' | 'body' | 'auth' | 'headers' | 'validation' | 'extract' | 'data';

function rebuildUrl(baseUrl: string, entries: ParamEntry[]): string {
  const active = entries.filter((e) => e.enabled && e.key.trim());
  return rebuildUrlShared(baseUrl, active, { encode: true, preserveTemplates: true });
}

// ── Main component ────────────────────────────────────

export default function HttpConfig({ data, onChange, activeTab, onTabChange, lastRunError, lastQuickTestRequestUrl, effectiveQuickTestBaseUrl, extractionSampleResponseBody, extractionFetchSample, variableHints = [], onRequestVariableInsert, workflowServices = [], environments = [], selectedEnvId, validationProps }: {
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
  /** Available environments for environment override dropdown. */
  environments?: Environment[];
  /** Currently selected global environment. */
  selectedEnvId?: string;
  /** Props for the Validation tab — omit draft/onDraftChange/draftRef which are derived here. */
  validationProps?: Omit<TestEditorValidationTabProps, 'draft' | 'onDraftChange' | 'draftRef'>;
}) {
  const s = data.scenario;
  const update = useCallback((patch: Partial<Scenario>) => onChange({ scenario: { ...s, ...patch } }), [onChange, s]);
  const scenarioDraftRef = useRef<Scenario>(s);
  scenarioDraftRef.current = s;
  const handleScenarioDraftChange = useCallback((draft: Scenario) => onChange({ scenario: draft }), [onChange]);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [showVarMapper, setShowVarMapper] = useState(false);
  const [bodyMapperOpen, setBodyMapperOpen] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  const bodyHints: VariableHintForBody[] = useMemo(
    () => variableHints.map((h) => ({
      ref: h.ref,
      label: h.label,
      description: h.description,
      type: h.type,
      source: h.source,
    })),
    [variableHints],
  );

  const bodySources = useMemo(() => {
    const adapter = createRequestBodyAdapter({
      existingBody: s.body,
      variableHints: bodyHints,
    });
    return adapter.sources;
  }, [s.body, bodyHints]);

  const bodySync = useBodyBuilderSync(
    s.body,
    useCallback((newBody: string) => update({ body: newBody }), [update]),
    { sources: bodySources },
  );

  const templateSlots = useMemo(
    () => collectTemplateSlots({ url: s.url, headers: s.headers, body: s.body, bodyForm: s.bodyForm }),
    [s.url, s.headers, s.body, s.bodyForm],
  );

  const varBindingAdapter = useMemo(
    () => createVariableBindingAdapter({
      variableHints: variableHints.map((h) => ({
        ref: h.ref,
        label: h.label,
        description: h.description,
        type: h.type,
        source: h.source,
      })),
      templateSlots,
    }),
    [variableHints, templateSlots],
  );

  // Normalize encoded template vars on mount / when URL changes externally
  useEffect(() => {
    const decoded = decodeTemplateVars(s.url);
    if (s.url !== decoded) {
      onChange({ scenario: { ...s, url: decoded } });
    }
  }, [s.url]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const dataSourceRowCount = useMemo(() => s.dataSource?.rows?.filter(r => r.enabled).length ?? 0, [s.dataSource]);
  const hasValidationConfig = (s.validation?.assertions ?? []).length > 0
    || (s.validation?.mode === 'selective' || (s.validation?.mode === 'full' && !!s.validation?.expectedJson?.trim()))
    || (s.validation?.expectedFields?.length ?? 0) > 0;

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

  /** Strip node-scoped refs to simple form: {{node:"Step".var}} → {{var}} */
  const simplifyRefs = (u: string) => u.replace(/\{\{node:"[^"]+"\.([^}]+)\}\}/g, '{{$1}}');

  /** Resolve known workflow variables in a URL string using variableHints defaults. */
  const resolveKnownVars = useCallback((u: string) =>
    u.replace(/\{\{([^}]+)\}\}/g, (match, name) => {
      const hint = variableHints.find(h => h.ref === name || h.label === name);
      return hint?.defaultValue ?? match;
    }), [variableHints]);

  // Live preview: combine effective base URL + current path
  const previewUrl = useMemo(() => {
    const url = simplifyRefs(decodeTemplateVars(s.url.trim()));
    if (!url) return effectiveQuickTestBaseUrl || '';
    // If URL is already absolute, show it as-is
    if (/^https?:\/\//i.test(url)) return simplifyRefs(decodeTemplateVars(url));
    // Try resolving known workflow variables (e.g. {{baseUrl}} → https://...)
    const resolved = resolveKnownVars(url);
    if (/^https?:\/\//i.test(resolved)) return resolved;
    const base = effectiveQuickTestBaseUrl.replace(/\/+$/, '');
    const path = resolved.startsWith('/') ? resolved : `/${resolved}`;
    return simplifyRefs(decodeTemplateVars(`${base}${path}`));
  }, [s.url, effectiveQuickTestBaseUrl, resolveKnownVars]);

  // Show last Quick Test URL when available, otherwise the live preview
  const displayUrl = lastQuickTestRequestUrl || previewUrl;

  return (
    <div className="wf-config-body wf-http-config" data-testid="http-config">
      {lastRunError && (
        <div className="wf-config-run-error" role="alert">
          <span className="wf-config-run-error-title">Last run error</span>
          <pre className="wf-config-run-error-text">{lastRunError}</pre>
        </div>
      )}

      <KafkaCard
        title="Request"
        hint="Service binding, label, and timeout for this HTTP step."
      >
        <div className="wf-kafka-form wf-kafka-form--connection wf-kafka-form--http">
          <KafkaFormRow
            label="Service"
            hint="None = use a raw absolute URL"
            compact
          >
            <CustomSelect
              value={data.serviceId ?? ''}
              onChange={(svcIdRaw) => {
                const svcId = svcIdRaw || undefined;
                const svc = workflowServices.find((s) => s.id === svcId);
                const patch: Partial<HttpNodeData> = {
                  serviceId: svcId,
                  envOverride: undefined,
                };

                const currentUrl = data.scenario?.url ?? '';
                if (svcId && svc) {
                  const ep = svc.endpoints?.find(ep2 => ep2.enabled && ep2.url.trim());
                  const svcBase = ep ? stripTrailingSlash(ep.url) : undefined;
                  if (svcBase && currentUrl.startsWith(svcBase)) {
                    const pathOnly = currentUrl.slice(svcBase.length) || '/';
                    patch.scenario = { ...data.scenario, url: pathOnly };
                  }
                } else if (!svcId && data.serviceId) {
                  const prevSvc = workflowServices.find(s => s.id === data.serviceId);
                  const prevEp = prevSvc?.endpoints?.find(ep2 => ep2.enabled && ep2.url.trim());
                  const prevBase = prevEp ? stripTrailingSlash(prevEp.url) : undefined;
                  if (prevBase && !currentUrl.startsWith('http')) {
                    patch.scenario = { ...data.scenario, url: `${prevBase}${currentUrl.startsWith('/') ? '' : '/'}${currentUrl}` };
                  }
                }

                onChange(patch);
              }}
              className="wf-config-service-select"
              placeholder="None (raw URL)"
              options={[
                { value: '', label: 'None (raw URL)' },
                ...workflowServices.map((svc) => ({ value: svc.id, label: svc.name })),
              ]}
            />
          </KafkaFormRow>

          {workflowServices.length === 0 && (
            <p className="wf-config-managed-note-text wf-http-service-hint">
              Click the <strong>Services</strong> button in the toolbar to register external services.
            </p>
          )}

          {data.serviceId && (() => {
            const svc = workflowServices.find((s) => s.id === data.serviceId);
            const enabledEps = (svc?.endpoints ?? []).filter((ep: ServiceEndpoint) => ep.enabled && ep.url.trim());
            if (enabledEps.length <= 1) return null;
            const envLabel = (envId: string) => {
              if (envId === '__adhoc__') return 'adhoc';
              return environments.find((e) => e.id === envId)?.name ?? envId;
            };
            const globalLabel = selectedEnvId ? envLabel(selectedEnvId) : 'global';
            return (
              <div className="wf-config-env-override">
                <KafkaFormRow label="Environment" hint="Override the global env for this step" compact>
                  <div className="wf-http-env-override-ctrl">
                    <CustomSelect
                      value={data.envOverride ?? ''}
                      onChange={(v) => onChange({ envOverride: v || undefined })}
                      placeholder={`Use global (${globalLabel})`}
                      options={[
                        { value: '', label: `Use global (${globalLabel})` },
                        ...enabledEps.map((ep: ServiceEndpoint) => ({ value: ep.envId, label: envLabel(ep.envId) })),
                      ]}
                    />
                    {data.envOverride && (
                      <span className="wf-config-env-override-badge" title="This step uses a different environment than the global selection">
                        {envLabel(data.envOverride)}
                      </span>
                    )}
                  </div>
                </KafkaFormRow>
              </div>
            );
          })()}

          <KafkaFormRow label="Label" hint="Canvas node title" compact>
            <input
              className="wf-kafka-form-input"
              value={data.label}
              onChange={(e) => onChange({ label: e.target.value })}
              aria-label="HTTP label"
            />
          </KafkaFormRow>

          <KafkaFormRow label="Timeout" hint="0 = no timeout" compact>
            <div className="wf-http-timeout-ctrl">
              <input
                type="number"
                min={0}
                max={300}
                value={data.timeoutSec ?? 0}
                onChange={(e) => onChange({ timeoutSec: Math.max(0, Math.min(300, parseInt(e.target.value, 10) || 0)) })}
                className="wf-kafka-form-input wf-config-timeout-input"
                aria-label="Timeout"
              />
              <span className="unit">sec</span>
            </div>
          </KafkaFormRow>

          {data.sourceSpecVersionId && (
            <KafkaFormRow label="Spec version" hint="Catalog version tracking" compact>
              <div className="wf-config-version-mode-row">
                <CustomSelect
                  value={data.specVersionMode ?? 'latest'}
                  onChange={(v) => onChange({ specVersionMode: v as 'pinned' | 'latest' })}
                  className="wf-config-version-select"
                  options={[
                    { value: 'latest', label: 'Latest (tracks active version)' },
                    {
                      value: 'pinned',
                      label: `Pinned${data.sourceSpecVersionLabel ? ` — v${data.sourceSpecVersionLabel}` : ''}`,
                    },
                  ]}
                />
                {data.sourceSpecVersionLabel && (
                  <span className="wf-config-version-label">v{data.sourceSpecVersionLabel}</span>
                )}
              </div>
            </KafkaFormRow>
          )}
        </div>
      </KafkaCard>

      <KafkaCard
        title="Endpoint"
        hint={<>Method + URL. Use <code>{'{{variable}}'}</code> placeholders — resolved at run time.</>}
      >
        <div className="wf-kafka-form wf-kafka-form--http">
          <KafkaFormRow label="URL" hint="Absolute URL or path when a service is bound" compact>
            <div className="wf-http-url-row">
              <CustomSelect
                value={s.method}
                onChange={(v) => update({ method: v as Scenario['method'] })}
                className="wf-config-method-select"
                options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))}
              />
              <div className="wf-config-url-field-wrap">
                <ExpressionInput
                  ref={urlInputRef}
                  value={decodeTemplateVars(s.url).replace(/\{\{node:"[^"]+"\.([^}]+)\}\}/g, '{{$1}}')}
                  onChange={(val) => update({ url: val })}
                  placeholder="https://api.example.com/..."
                  className="wf-config-url-input"
                  variableHints={variableHints}
                />
                <button
                  type="button"
                  className="btn btn-sm wf-config-insert-var-btn"
                  title="Insert variable at cursor position (or append if no cursor)"
                  onClick={() => onRequestVariableInsert((snippet) => {
                    const el = urlInputRef.current;
                    if (el && typeof el.selectionStart === 'number') {
                      const start = el.selectionStart;
                      const end = el.selectionEnd ?? start;
                      const current = decodeTemplateVars(s.url).replace(/\{\{node:"[^"]+"\.([^}]+)\}\}/g, '{{$1}}');
                      const newUrl = current.slice(0, start) + snippet + current.slice(end);
                      update({ url: newUrl });
                      requestAnimationFrame(() => {
                        el.focus();
                        el.setSelectionRange(start + snippet.length, start + snippet.length);
                      });
                    } else {
                      update({ url: s.url + snippet });
                    }
                  }, true)}
                >
                  Insert…
                </button>
              </div>
            </div>
          </KafkaFormRow>
        </div>

        {displayUrl && (
          <div className="wf-config-last-req-url">
            <span className="wf-config-last-req-url-label">{lastQuickTestRequestUrl ? 'Last request URL (resolved)' : 'Resolved URL (preview)'}</span>
            <code className="wf-config-last-req-url-value" title={displayUrl}>{displayUrl}</code>
          </div>
        )}

        {templateSlots.length > 0 && (
          <div className="wf-var-mapper-bar">
            <button
              type="button"
              className="wf-extract-var-mapper-btn"
              onClick={() => setShowVarMapper(true)}
              title="Visually map upstream variables to this step's template slots"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                <path d="M10 7h4l-4 10h4" />
              </svg>
              Visual Variables ({templateSlots.length} slot{templateSlots.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}
      </KafkaCard>

      <KafkaCard
        title="Request details"
        hint="Params, body, auth, headers, validation, extract, and data source."
      >
      <div className="wf-http-details-inner">
      <div className="wf-config-tabs">
        {(['url', 'body', 'auth', 'headers', 'validation', 'extract', 'data'] as HttpTab[]).map(tab => {
          const tabLabel = tab === 'url' ? 'Params' : tab === 'extract' ? 'Extract' : tab === 'data' ? 'Data Source' : tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button key={tab} className={`wf-config-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => onTabChange(tab)}>
              {tabLabel}
              {tab === 'url' && paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
              {tab === 'extract' && (s.extractions?.length ?? 0) > 0 && <span className="tab-badge">{s.extractions!.length}</span>}
              {tab === 'headers' && s.headers.filter(h => h.key.trim()).length > 0 && <span className="tab-badge">{s.headers.filter(h => h.key.trim()).length}</span>}
              {tab === 'auth' && s.auth.type !== 'none' && s.auth.type !== 'inherit' && <span className="tab-badge-dot" />}
              {tab === 'data' && dataSourceRowCount > 0 && <span className="tab-badge">{dataSourceRowCount}</span>}
              {tab === 'validation' && hasValidationConfig && <span className="tab-badge-dot" />}
            </button>
          );
        })}
      </div>

      <div className="wf-config-tab-content">
        {activeTab === 'url' && (
          <div>
            <p className="wf-config-hint-text wf-http-params-hint">
              Use <code>{'{{variable}}'}</code> in the URL and params — values are substituted at run time.
              Templates are not URL-encoded (so <code>country={'{{country}}'}</code> becomes <code>US</code>, not literal braces).
            </p>
            <HttpVariableRefHints hints={variableHints} />
            <ParamsEditor
              params={queryParams}
              onChange={handleParamsChange}
              variableHints={variableHints}
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
          <div className="wf-http-headers-panel">
            <p className="wf-config-hint-text wf-http-headers-hint">
              Sent with the request. Values support <code>{'{{variable}}'}</code> placeholders resolved at run time.
            </p>
            {s.headers.length === 0 ? (
              <div className="wf-http-headers-empty">
                <p className="wf-http-headers-empty-title">No headers yet</p>
                <p className="wf-http-headers-empty-text">
                  Add headers such as <code>Authorization</code> or <code>Content-Type</code>.
                </p>
              </div>
            ) : (
              <div className="wf-http-headers-list" role="table" aria-label="Request headers">
                <div className="wf-http-headers-head" role="row">
                  <span className="wf-http-headers-col-name" role="columnheader">Name</span>
                  <span className="wf-http-headers-col-value" role="columnheader">Value</span>
                  <span className="wf-http-headers-col-actions" aria-hidden />
                </div>
                {s.headers.map((h, i) => (
                  <div key={i} className="wf-http-headers-row" role="row">
                    <div className="wf-http-headers-col-name" role="cell">
                      <input
                        className="wf-kafka-form-input"
                        value={h.key}
                        placeholder="Header name"
                        onChange={(e) => {
                          const next = [...s.headers];
                          next[i] = { ...h, key: e.target.value };
                          update({ headers: next });
                        }}
                        aria-label={`Header name ${i + 1}`}
                      />
                    </div>
                    <div className="wf-http-headers-col-value" role="cell">
                      <div className="wf-http-headers-value-wrap">
                        <ExpressionInput
                          value={h.value}
                          placeholder="Value (supports {{var}})"
                          onChange={(val) => {
                            const next = [...s.headers];
                            next[i] = { ...h, value: val };
                            update({ headers: next });
                          }}
                          variableHints={variableHints}
                          aria-label={`Header value ${i + 1}`}
                        />
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
                    </div>
                    <div className="wf-http-headers-col-actions" role="cell">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label={`Remove header ${h.key || i + 1}`}
                        onClick={() => update({ headers: s.headers.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="wf-http-headers-footer">
              <button
                type="button"
                className="wf-kafka-add-btn"
                onClick={() => update({ headers: [...s.headers, { key: '', value: '' }] })}
              >
                + Add Header
              </button>
            </div>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="wf-config-field wf-config-body-field-wrap">
            <div className="wf-config-body-insert-row">
              <label>Body (supports {'{{var}}'})</label>
              <span className="wf-config-body-btn-group">
              <button
                type="button"
                className="btn btn-sm"
                title="Insert variable from workflow or upstream step"
                onClick={() => onRequestVariableInsert((snippet) => update({ body: s.body + snippet }), true)}
              >
                Insert variable…
              </button>
              <button
                type="button"
                className="btn btn-sm wf-config-pretty-btn"
                title="Pretty Format JSON"
                onClick={() => {
                  try {
                    const formatted = JSON.stringify(JSON.parse(s.body), null, 2);
                    bodySync.onBodyChange(formatted);
                  } catch { /* not valid JSON — ignore */ }
                }}
              >
                Pretty Format
              </button>
              <button
                type="button"
                className="btn btn-sm wf-config-pretty-btn"
                title="Minify JSON (remove whitespace)"
                onClick={() => {
                  try {
                    const minified = JSON.stringify(JSON.parse(s.body));
                    bodySync.onBodyChange(minified);
                  } catch { /* not valid JSON — ignore */ }
                }}
              >
                Minify
              </button>
              <button
                type="button"
                className="btn btn-sm wf-config-mapper-btn"
                title="Open Data Mapper to visually build the body"
                onClick={() => setBodyMapperOpen(true)}
              >
                ⚡ Data Mapper
              </button>
              </span>
            </div>
            <ExpressionTextarea
              value={s.body}
              onChange={(val) => bodySync.onBodyChange(val)}
              placeholder='{"key": "{{value}}"}'
              rows={8}
              className="wf-config-textarea"
              variableHints={variableHints}
            />
            {bodyMapperOpen && (
              <DataMapperModal<string>
                adapter={createRequestBodyAdapter({
                  existingBody: s.body,
                  variableHints: bodyHints,
                })}
                initialData={s.body}
                onSave={(newBody) => {
                  bodySync.onBodyChange(newBody);
                  setBodyMapperOpen(false);
                }}
                onCancel={() => setBodyMapperOpen(false)}
              />
            )}
          </div>
        )}

        {activeTab === 'auth' && (
          <HttpAuthSection
            auth={s.auth}
            serviceId={data.serviceId}
            workflowServices={workflowServices}
            showAuthPassword={showAuthPassword}
            setShowAuthPassword={setShowAuthPassword}
            onAuthChange={(auth) => update({ auth })}
          />
        )}

        {activeTab === 'validation' && validationProps && (
          <TestEditorValidationTab
            draft={s}
            onDraftChange={handleScenarioDraftChange}
            draftRef={scenarioDraftRef}
            {...validationProps}
          />
        )}
        {activeTab === 'validation' && !validationProps && (
          <div className="wf-config-empty-state">
            <p>Validation is not available in this context.</p>
          </div>
        )}

        {activeTab === 'extract' && (
          <ExtractionEditor
            extractions={s.extractions ?? []}
            onChange={(extractions) => update({ extractions })}
            sampleResponseBody={extractionSampleResponseBody}
            variableHints={variableHints}
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
            contextScope={s.id}
          />
        )}

        {activeTab === 'data' && (
          <DataSourceEditor
            draft={s}
            onDraftChange={(updated) => update(updated)}
          />
        )}
      </div>
      </div>
      </KafkaCard>

      {showVarMapper && (
        <DataMapperModal
          adapter={varBindingAdapter}
          onSave={() => setShowVarMapper(false)}
          onCancel={() => setShowVarMapper(false)}
          doneLabel="Close"
          contextScope={s.id}
        />
      )}
    </div>
  );
}
