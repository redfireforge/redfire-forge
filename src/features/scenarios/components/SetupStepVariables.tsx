/**
 * Step 1: Variables — Path, Query, Header, Body variable detection and auth config.
 * Single-column top-down layout with collapsible sections.
 */
import { useState } from 'react';
import type { Scenario } from '../../../shared/types';
import type { PathSegmentChoice } from '../utils/csvTemplateTypes';
import { sanitizeVariableName } from '../utils/dataSourceSetupUtils';
import { CustomSelect } from '../../../shared/components/CustomSelect';

interface HeaderCandidate {
  key: string;
  value: string;
  suggestedName: string;
  suggestedEnabled: boolean;
}

export interface SetupStepVariablesProps {
  analysis: { segments: PathSegmentChoice[] };
  selections: Record<number, { checked: boolean; name: string }>;
  toggleSegment: (index: number) => void;
  setVarName: (index: number, name: string) => void;
  autoUrlTemplate: string;
  urlTemplateInput: string;
  setUrlTemplateInput: (v: string) => void;
  isTemplateCustomized: boolean;
  setIsTemplateCustomized: (v: boolean) => void;
  urlParams: { key: string; value: string }[];
  paramSelections: Record<string, { enabled: boolean; name: string }>;
  setParamSelection: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
  headerCandidates: HeaderCandidate[];
  headerSelections: Record<string, { enabled: boolean; name: string }>;
  setHeaderSelection: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
  bodyVariableCandidates: string[];
  bodySelections: Record<string, { enabled: boolean; name: string }>;
  setBodySelection: (key: string, patch: Partial<{ enabled: boolean; name: string }>) => void;
  workingAuth: Scenario['auth'];
  setWorkingAuthType: (type: Scenario['auth']['type']) => void;
  patchWorkingAuth: (patch: Partial<Scenario['auth']>) => void;
  test: Pick<Scenario, 'method' | 'headers' | 'body'>;
}

export default function SetupStepVariables({
  analysis, selections, toggleSegment, setVarName,
  autoUrlTemplate, urlTemplateInput, setUrlTemplateInput,
  isTemplateCustomized, setIsTemplateCustomized,
  urlParams, paramSelections, setParamSelection,
  headerCandidates, headerSelections, setHeaderSelection,
  bodyVariableCandidates, bodySelections, setBodySelection,
  workingAuth, setWorkingAuthType, patchWorkingAuth,
  test,
}: SetupStepVariablesProps) {
  const pathCount = Object.values(selections).filter(s => s?.checked).length;
  const queryCount = urlParams.filter(p => (paramSelections[p.key] ?? { enabled: true }).enabled).length;
  const headerCount = Object.values(headerSelections).filter(s => s?.enabled).length;
  const bodyCount = Object.values(bodySelections).filter(s => s?.enabled).length;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const isOpen = (key: string) => !collapsed[key];

  return (
    <div className="excel-step-content ds-step-variables-vertical">
      {/* ─── Path Variables ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('path')}
          aria-expanded={isOpen('path')}
        >
          <span className="ds-section-arrow">{isOpen('path') ? '▼' : '▶'}</span>
          <span className="ds-section-label">Path Variables</span>
          <span className="ds-section-badge">{pathCount} selected</span>
        </button>
        {isOpen('path') && (
          <div className="ds-section-body">
            <p className="ds-section-hint">Select variable path segments and assign clear variable names.</p>
            <div className="path-segment-list">
              {analysis.segments.map(seg => {
                const sel = selections[seg.index];
                const isChecked = sel?.checked ?? false;
                return (
                  <div key={seg.index} className={`path-seg ${isChecked ? 'path-seg-active' : ''}`}>
                    <label className="path-seg-label">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSegment(seg.index)} />
                      <code>/{seg.segment}</code>
                    </label>
                    <div className="path-seg-spacer" />
                    {isChecked && (
                      <input
                        type="text"
                        className="path-var-input"
                        placeholder="variable name"
                        value={sel?.name ?? ''}
                        onChange={(e) => setVarName(seg.index, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        autoFocus
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ─── URL Template Preview ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('url')}
          aria-expanded={isOpen('url')}
        >
          <span className="ds-section-arrow">{isOpen('url') ? '▼' : '▶'}</span>
          <span className="ds-section-label">URL Template Preview</span>
        </button>
        {isOpen('url') && (
          <div className="ds-section-body">
            <code className="url-pattern-box">{autoUrlTemplate}</code>
            <p className="ds-section-hint" style={{ marginTop: 6 }}>Customize template if needed before proceeding.</p>
            <textarea
              className="url-template-input"
              value={urlTemplateInput}
              onChange={(e) => {
                setIsTemplateCustomized(true);
                setUrlTemplateInput(e.target.value);
              }}
              rows={4}
              placeholder="https://api.example.com/v1/items/{{id}}?country={{country}}"
            />
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setIsTemplateCustomized(false);
                  setUrlTemplateInput(autoUrlTemplate);
                }}
                disabled={!isTemplateCustomized}
              >
                Reset to Auto Template
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Query Variables ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('query')}
          aria-expanded={isOpen('query')}
        >
          <span className="ds-section-arrow">{isOpen('query') ? '▼' : '▶'}</span>
          <span className="ds-section-label">Query Variables</span>
          <span className="ds-section-badge">{queryCount}/{urlParams.length}</span>
        </button>
        {isOpen('query') && (
          <div className="ds-section-body">
            <div className="csv-fixed-list">
              {urlParams.length > 0 ? urlParams.map(p => {
                const cfg = paramSelections[p.key] ?? { enabled: true, name: p.key };
                return (
                  <div key={p.key} className="csv-fixed-item">
                    <label className="csv-variable-toggle">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setParamSelection(p.key, { enabled: e.target.checked })}
                      />
                      <span className="csv-fixed-key" title={p.key}>{p.key}</span>
                    </label>
                    <input
                      className="csv-variable-name-input"
                      value={cfg.name}
                      onChange={(e) => setParamSelection(p.key, { name: sanitizeVariableName(e.target.value) })}
                      placeholder="variable name"
                      disabled={!cfg.enabled}
                    />
                    <span className="text-muted">{p.value}</span>
                  </div>
                );
              }) : (
                <div className="csv-fixed-item"><span className="text-muted">No query parameters</span></div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── Header Variables ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('headers')}
          aria-expanded={isOpen('headers')}
        >
          <span className="ds-section-arrow">{isOpen('headers') ? '▼' : '▶'}</span>
          <span className="ds-section-label">Header Variables</span>
          <span className="ds-section-badge">{headerCount}/{headerCandidates.length}</span>
        </button>
        {isOpen('headers') && (
          <div className="ds-section-body">
            <p className="ds-section-hint">Optional: mark headers that should vary per data row.</p>
            <div className="csv-fixed-list">
              {headerCandidates.length > 0 ? headerCandidates.map(h => {
                const cfg = headerSelections[h.key] ?? { enabled: false, name: h.suggestedName };
                return (
                  <div key={h.key} className="csv-fixed-item">
                    <label className="csv-variable-toggle">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setHeaderSelection(h.key, { enabled: e.target.checked })}
                      />
                      <span className="csv-fixed-key" title={h.key}>{h.key}</span>
                    </label>
                    <input
                      className="csv-variable-name-input"
                      value={cfg.name}
                      onChange={(e) => setHeaderSelection(h.key, { name: sanitizeVariableName(e.target.value) })}
                      placeholder="variable name"
                      disabled={!cfg.enabled}
                    />
                    <span className="text-muted">{h.value}</span>
                  </div>
                );
              }) : (
                <div className="csv-fixed-item"><span className="text-muted">No headers</span></div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── Body Variables ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('body')}
          aria-expanded={isOpen('body')}
        >
          <span className="ds-section-arrow">{isOpen('body') ? '▼' : '▶'}</span>
          <span className="ds-section-label">Body Variables</span>
          <span className="ds-section-badge">{bodyCount}/{bodyVariableCandidates.length}</span>
        </button>
        {isOpen('body') && (
          <div className="ds-section-body">
            <p className="ds-section-hint">Optional: body placeholders from cURL (e.g. {'{{payloadVar}}'}).</p>
            <div className="csv-fixed-list">
              {bodyVariableCandidates.length > 0 ? bodyVariableCandidates.map(v => {
                const cfg = bodySelections[v] ?? { enabled: true, name: v };
                return (
                  <div key={v} className="csv-fixed-item">
                    <label className="csv-variable-toggle">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => setBodySelection(v, { enabled: e.target.checked })}
                      />
                      <span className="csv-fixed-key">{v}</span>
                    </label>
                    <input
                      className="csv-variable-name-input"
                      value={cfg.name}
                      onChange={(e) => setBodySelection(v, { name: sanitizeVariableName(e.target.value) })}
                      placeholder="variable name"
                      disabled={!cfg.enabled}
                    />
                  </div>
                );
              }) : (
                <div className="csv-fixed-item"><span className="text-muted">No body placeholders found</span></div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── Auth Configuration ─── */}
      <section className="ds-section ds-section-collapsible">
        <button
          type="button"
          className="ds-section-toggle"
          onClick={() => toggle('auth')}
          aria-expanded={isOpen('auth')}
        >
          <span className="ds-section-arrow">{isOpen('auth') ? '▼' : '▶'}</span>
          <span className="ds-section-label">Auth Configuration</span>
          <span className="ds-section-badge">{workingAuth.type}</span>
        </button>
        {isOpen('auth') && (
          <div className="ds-section-body">
            <div className="ds-auth-config">
              <div className="ds-auth-fields">
                <div className="ds-auth-field-row">
                  <span className="ds-auth-field-label">Type</span>
                  <div className="ds-auth-field-ctrl">
                    <CustomSelect
                      className="ds-auth-select"
                      value={workingAuth.type}
                      onChange={(v) => setWorkingAuthType(v as Scenario['auth']['type'])}
                      options={[
                        { value: 'inherit', label: 'Inherit' },
                        { value: 'none', label: 'No Auth' },
                        { value: 'bearer', label: 'Bearer Token' },
                        { value: 'basic', label: 'Basic Auth' },
                        { value: 'apikey', label: 'API Key' },
                        { value: 'oauth2', label: 'OAuth2 Client Credentials' },
                      ]}
                    />
                  </div>
                </div>

                {workingAuth.type === 'bearer' && (
                  <>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Prefix</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="Bearer"
                          value={workingAuth.prefix ?? 'Bearer'}
                          onChange={(e) => patchWorkingAuth({ prefix: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Token</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="eyJhbGciOi..."
                          value={workingAuth.token ?? ''}
                          onChange={(e) => patchWorkingAuth({ token: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {workingAuth.type === 'basic' && (
                  <>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Username</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="Enter username"
                          value={workingAuth.username ?? ''}
                          onChange={(e) => patchWorkingAuth({ username: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Password</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="password"
                          placeholder="Enter password"
                          value={workingAuth.password ?? ''}
                          onChange={(e) => patchWorkingAuth({ password: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {workingAuth.type === 'apikey' && (
                  <>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Key Name</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="X-API-Key"
                          value={workingAuth.apiKeyName ?? ''}
                          onChange={(e) => patchWorkingAuth({ apiKeyName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Key Value</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="your-api-key"
                          value={workingAuth.apiKeyValue ?? ''}
                          onChange={(e) => patchWorkingAuth({ apiKeyValue: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Add to</span>
                      <div className="ds-auth-field-ctrl">
                        <CustomSelect
                          className="ds-auth-select"
                          value={workingAuth.apiKeyIn ?? 'header'}
                          onChange={(v) => patchWorkingAuth({ apiKeyIn: v as 'header' | 'query' })}
                          options={[
                            { value: 'header', label: 'Header' },
                            { value: 'query', label: 'Query String' },
                          ]}
                        />
                      </div>
                    </div>
                  </>
                )}

                {workingAuth.type === 'oauth2' && (
                  <>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Token URL</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="https://auth.example.com/oauth/token"
                          value={workingAuth.tokenUrl ?? ''}
                          onChange={(e) => patchWorkingAuth({ tokenUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Client ID</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="text"
                          placeholder="Enter client ID"
                          value={workingAuth.clientId ?? ''}
                          onChange={(e) => patchWorkingAuth({ clientId: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="ds-auth-field-row">
                      <span className="ds-auth-field-label">Client Secret</span>
                      <div className="ds-auth-field-ctrl">
                        <input
                          className="ds-auth-input"
                          type="password"
                          placeholder="Enter client secret"
                          value={workingAuth.clientSecret ?? ''}
                          onChange={(e) => patchWorkingAuth({ clientSecret: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Fixed Configuration (always visible, not collapsible) ─── */}
      <section className="ds-section ds-section--muted">
        <div className="ds-section-heading">
          <span className="ds-section-label">Fixed Configuration</span>
        </div>
        <p className="ds-section-hint">Not parameterized — same for all rows.</p>
        <div className="ds-fixed-summary">
          <div className="ds-fixed-row">
            <span className="ds-fixed-key">Method</span>
            <span className={`method-badge method-${test.method.toLowerCase()}`}>{test.method}</span>
          </div>
          <div className="ds-fixed-row">
            <span className="ds-fixed-key">Headers</span>
            <span>{test.headers.filter(h => h.key.trim()).map(h => h.key).join(', ') || 'None'}</span>
          </div>
          <div className="ds-fixed-row">
            <span className="ds-fixed-key">Auth</span>
            <span>{workingAuth.type}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
