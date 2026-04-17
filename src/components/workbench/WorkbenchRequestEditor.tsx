import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  WorkbenchCollection, WorkbenchRequest, WorkbenchEnv,
  GlobalAuthProfile, KeyValue, HttpMethod, Scenario, AuthConfig,
} from '../../types';
import { httpFetch } from '../../utils/httpClient';
import type { HttpResponse } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { parseCurl } from '../../utils/curlParser';
import { buildCurlCommand } from '../../utils/curlGenerator';
import { pickJsonFile, unwrapImport } from '../../utils/testEditorUtils';
import { BodyEditor } from '../BodyEditor';
import { ParamsEditor, toParamEntries, fromParamEntries } from '../ParamsEditor';
import type { ParamEntry } from '../ParamsEditor';

type EditorTab = 'params' | 'headers' | 'body' | 'auth';
type InputMode = 'builder' | 'curlImport' | 'curlExport';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
};

interface Props {
  collection: WorkbenchCollection;
  request: WorkbenchRequest;
  environments: WorkbenchEnv[];
  selectedEnvId?: string;
  onEnvChange: (envId: string | undefined) => void;
  onUpdateRequest: (patch: Partial<WorkbenchRequest>) => void;
  resolveUrl: (request: WorkbenchRequest) => string;
  appGlobalAuthProfiles: GlobalAuthProfile[];
}

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

function buildUrl(base: string, params: ParamEntry[]): string {
  const qIdx = base.indexOf('?');
  const basePart = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const active = fromParamEntries(params);
  if (active.length === 0) return basePart;
  const qs = active.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return `${basePart}?${qs}`;
}

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch { return url; }
}

export default function WorkbenchRequestEditor({
  collection, request, environments, selectedEnvId, onEnvChange,
  onUpdateRequest, resolveUrl, appGlobalAuthProfiles,
}: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>('params');
  const [inputMode, setInputMode] = useState<InputMode>('builder');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [sendAllResults, setSendAllResults] = useState<{ envName: string; response: HttpResponse; time: number }[] | null>(null);
  const [reqNameEditing, setReqNameEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // cURL Import/Export state
  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  const queryParams = useMemo(() => toParamEntries(parseQueryParams(request.url)), [request.url]);
  const headerCount = useMemo(() => request.headers.filter((h) => h.key.trim()).length, [request.headers]);
  const paramCount = useMemo(() => queryParams.filter(p => p.key.trim() && p.enabled).length, [queryParams]);
  const baseUrl = useMemo(() => (request.url ? getBaseUrl(request.url) : ''), [request.url]);

  const handleMethodChange = (method: HttpMethod) => onUpdateRequest({ method });

  const handleUrlChange = (url: string) => onUpdateRequest({ url });

  const handleParamsChange = useCallback((params: ParamEntry[]) => {
    onUpdateRequest({ url: buildUrl(request.url, params) });
  }, [request.url, onUpdateRequest]);

  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    const headers = [...request.headers];
    headers[idx] = { ...headers[idx], [field]: val };
    onUpdateRequest({ headers });
  };

  const addHeader = () => {
    onUpdateRequest({ headers: [...request.headers, { key: '', value: '' }] });
  };

  const removeHeader = (idx: number) => {
    const headers = request.headers.filter((_, i) => i !== idx);
    onUpdateRequest({ headers: headers.length > 0 ? headers : [{ key: '', value: '' }] });
  };

  const asDraftScenario = useCallback((): Scenario => ({
    id: request.id,
    name: request.name,
    url: resolveUrl(request),
    method: request.method,
    headers: request.headers,
    body: request.body,
    bodyType: request.bodyType,
    bodyForm: request.bodyForm,
    auth: request.auth,
    validation: { mode: 'none' },
  }), [request, resolveUrl]);

  const resolveEffectiveAuth = useCallback((): AuthConfig => {
    if (request.auth?.type !== 'none' && request.auth?.type !== 'inherit') {
      return request.auth;
    }
    if (collection.auth?.type && collection.auth.type !== 'none') {
      return collection.auth;
    }
    return { type: 'none' };
  }, [request.auth, collection.auth]);

  const buildRequestHeaders = useCallback((scenario: Scenario, contentType: string | null): Record<string, string> => {
    const h: Record<string, string> = {};
    for (const kv of scenario.headers) {
      if (kv.key.trim()) h[kv.key.trim()] = kv.value;
    }

    if (contentType) {
      if (contentType.startsWith('multipart/form-data')) {
        h['Content-Type'] = contentType;
      } else if (!h['Content-Type']) {
        h['Content-Type'] = contentType;
      }
    }

    const auth = resolveEffectiveAuth();

    if (auth?.type === 'bearer' && auth.token) {
      h['Authorization'] = `${auth.prefix || 'Bearer'} ${auth.token}`;
    } else if (auth?.type === 'basic' && auth.username) {
      h['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password || ''}`)}`;
    } else if (auth?.type === 'api-key' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === 'header') {
      h[auth.apiKeyName] = auth.apiKeyValue;
    }

    return h;
  }, [resolveEffectiveAuth]);

  // ─── cURL Import ────────────────────────────────────

  const handleCurlImport = useCallback(() => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    const { id: _discardId, validation: _discardVal, ...parsedFields } = parsed as Scenario;
    onUpdateRequest({
      ...parsedFields,
    });
    setInputMode('builder');
    setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') {
      setActiveTab('body');
    }
  }, [curlText, onUpdateRequest]);

  // ─── cURL Export ────────────────────────────────────

  const triggerCurlGeneration = useCallback(async () => {
    if (!request.url.trim()) {
      setGeneratedCurl('');
      return;
    }
    setCurlGenerating(true);
    try {
      const scenario = asDraftScenario();
      const auth = resolveEffectiveAuth();
      const cmd = await buildCurlCommand(scenario, auth);
      setGeneratedCurl(cmd);
    } catch (err) {
      setGeneratedCurl(`# Error generating cURL: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCurlGenerating(false);
    }
  }, [asDraftScenario, resolveEffectiveAuth, request.url]);

  const handleCopyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generatedCurl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  }, [generatedCurl]);

  // ─── JSON Import ────────────────────────────────────

  const handleJsonImport = useCallback(() => {
    pickJsonFile((raw) => {
      const data = unwrapImport(raw) as Record<string, unknown>;
      if (!data.name || !data.url || !data.method) {
        alert('Invalid file: expected a request with name, url, and method.');
        return;
      }
      const imported = data as unknown as WorkbenchRequest;
      onUpdateRequest({
        name: imported.name,
        method: imported.method,
        url: imported.url,
        headers: imported.headers || [{ key: '', value: '' }],
        body: imported.body || '',
        bodyType: imported.bodyType,
        bodyForm: imported.bodyForm,
        auth: imported.auth || { type: 'inherit' },
      });
      setInputMode('builder');
    });
  }, [onUpdateRequest]);

  // ─── JSON Export ────────────────────────────────────

  const handleJsonExport = useCallback(() => {
    const payload = {
      _exportMeta: { type: 'workbench-request', version: 1, exportedAt: new Date().toISOString() },
      data: {
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        bodyType: request.bodyType,
        bodyForm: request.bodyForm,
        auth: request.auth,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${request.name || 'request'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [request]);

  // ─── Send ───────────────────────────────────────────

  const handleSend = useCallback(async () => {
    setSending(true);
    setResponse(null);
    setSendAllResults(null);
    try {
      const scenario = asDraftScenario();
      const { body: reqBody, contentType } = serializeWithContentType(scenario);
      const headers = buildRequestHeaders(scenario, contentType);
      const t0 = performance.now();
      const resp = await httpFetch(scenario.url, scenario.method, headers, reqBody);
      const elapsed = Math.round(performance.now() - t0);
      setResponse(resp);
      setResponseTime(elapsed);
    } catch (err) {
      setResponse({
        status: 0, statusText: 'Error', headers: {},
        body: err instanceof Error ? err.message : String(err),
        error: err instanceof Error ? err.message : String(err),
      });
      setResponseTime(0);
    }
    setSending(false);
  }, [asDraftScenario, buildRequestHeaders]);

  const handleSendAll = useCallback(async () => {
    if (collection.mode !== 'multi-env') return;
    setSending(true);
    setResponse(null);
    setSendAllResults(null);
    const results: { envName: string; response: HttpResponse; time: number }[] = [];

    for (const env of environments) {
      const base = collection.baseUrls?.[env.id]?.replace(/\/+$/, '') ?? '';
      const path = request.url.startsWith('/') ? request.url : `/${request.url}`;
      const fullUrl = request.url.startsWith('http') ? request.url : `${base}${path}`;

      const scenario: Scenario = { ...asDraftScenario(), url: fullUrl };
      const { body: reqBody, contentType } = serializeWithContentType(scenario);
      const headers = buildRequestHeaders(scenario, contentType);
      try {
        const t0 = performance.now();
        const resp = await httpFetch(fullUrl, scenario.method, headers, reqBody);
        const elapsed = Math.round(performance.now() - t0);
        results.push({ envName: env.name, response: resp, time: elapsed });
      } catch (err) {
        results.push({
          envName: env.name,
          response: {
            status: 0, statusText: 'Error', headers: {},
            body: err instanceof Error ? err.message : String(err),
            error: err instanceof Error ? err.message : String(err),
          },
          time: 0,
        });
      }
    }

    setSendAllResults(results);
    setSending(false);
  }, [collection, environments, request, asDraftScenario, buildRequestHeaders]);

  const handleNameBlur = () => setReqNameEditing(false);

  const handleDraftChange = useCallback((draft: Scenario) => {
    onUpdateRequest({
      body: draft.body,
      bodyType: draft.bodyType,
      bodyForm: draft.bodyForm,
    });
  }, [onUpdateRequest]);

  const draftScenario = asDraftScenario();

  return (
    <div className="wb-editor">
      {/* Top bar: request name + mode toolbar */}
      <div className="wb-top-bar">
        <div className="wb-req-name-bar">
          {reqNameEditing ? (
            <input
              ref={nameInputRef}
              className="wb-req-name-input"
              value={request.name}
              onChange={(e) => onUpdateRequest({ name: e.target.value })}
              onBlur={handleNameBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameBlur(); }}
              autoFocus
            />
          ) : (
            <span className="wb-req-name-display" onClick={() => setReqNameEditing(true)}>
              {request.name || 'Untitled Request'}
              <span className="wb-edit-hint">&#9998;</span>
            </span>
          )}
        </div>

        <div className="wb-mode-toggle">
          <button
            className={`wb-mode-btn ${inputMode === 'builder' ? 'active' : ''}`}
            onClick={() => setInputMode('builder')}
          >
            Builder
          </button>
          <button
            className={`wb-mode-btn ${inputMode === 'curlImport' ? 'active' : ''}`}
            onClick={() => setInputMode('curlImport')}
          >
            cURL Import
          </button>
          <button
            className={`wb-mode-btn ${inputMode === 'curlExport' ? 'active' : ''}`}
            onClick={() => { setInputMode('curlExport'); void triggerCurlGeneration(); }}
          >
            cURL Export
          </button>
          <button className="wb-mode-btn" onClick={handleJsonImport}>Import</button>
          <button className="wb-mode-btn" onClick={handleJsonExport}>Export</button>
        </div>
      </div>

      {/* cURL Import panel */}
      {inputMode === 'curlImport' && (
        <div className="wb-curl-panel">
          <label className="wb-curl-label">Paste your cURL command</label>
          <textarea
            className="wb-curl-textarea"
            rows={8}
            autoFocus
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder={`curl -X POST https://api.example.com/data \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"key": "value"}'`}
          />
          <div className="wb-curl-actions">
            <button
              className="btn btn-primary"
              disabled={!curlText.trim()}
              onClick={handleCurlImport}
            >
              Import &amp; Switch to Builder
            </button>
          </div>
          {request.url && (
            <div className="wb-curl-preview">
              <strong>Current request:</strong> {request.method} {request.url}
            </div>
          )}
        </div>
      )}

      {/* cURL Export panel */}
      {inputMode === 'curlExport' && (
        <div className="wb-curl-panel">
          <label className="wb-curl-label">Generated cURL command</label>
          {request.url.trim() ? (
            <>
              <textarea
                className="wb-curl-textarea wb-curl-export"
                rows={10}
                readOnly
                value={curlGenerating ? 'Generating cURL...' : generatedCurl}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="wb-curl-actions">
                <button
                  className="btn btn-primary"
                  disabled={curlGenerating || !generatedCurl}
                  onClick={handleCopyToClipboard}
                >
                  {curlCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  className="btn"
                  disabled={curlGenerating}
                  onClick={() => void triggerCurlGeneration()}
                >
                  {curlGenerating ? 'Generating...' : 'Refresh'}
                </button>
              </div>
            </>
          ) : (
            <div className="wb-curl-empty">
              Configure the request URL in the Builder first to generate a cURL command.
            </div>
          )}
        </div>
      )}

      {/* Builder mode */}
      {inputMode === 'builder' && (
        <>
          {/* Environment switcher for multi-env */}
          {collection.mode === 'multi-env' && environments.length > 0 && (
            <div className="wb-env-bar">
              <span className="wb-env-bar-label">Environment:</span>
              <div className="wb-env-pills">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    className={`wb-env-pill ${selectedEnvId === env.id ? 'active' : ''}`}
                    onClick={() => onEnvChange(env.id)}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
              {environments.length > 1 && (
                <button
                  className="btn btn-sm wb-send-all-btn"
                  onClick={handleSendAll}
                  disabled={sending}
                  title="Send request to all environments"
                >
                  Send to All
                </button>
              )}
            </div>
          )}

          {/* URL bar */}
          <div className="wb-url-bar">
            <select
              className="wb-method-select"
              value={request.method}
              onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
              style={{ color: METHOD_COLORS[request.method] }}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
              ))}
            </select>
            <input
              className="wb-url-input"
              value={request.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={collection.mode === 'multi-env' ? '/v1/endpoint' : 'https://api.example.com/v1/endpoint'}
            />
            <button
              className="btn btn-primary wb-send-btn"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {/* URL preview */}
          {paramCount > 0 && request.url && (
            <div className="wb-url-preview">
              <span className="wb-url-preview-label">URL PREVIEW</span>
              <code>{request.url}</code>
            </div>
          )}

          {/* Resolved URL preview for multi-env */}
          {collection.mode === 'multi-env' && selectedEnvId && !request.url.startsWith('http') && (
            <div className="wb-resolved-url">
              {resolveUrl(request) || 'Select an environment to resolve the full URL'}
            </div>
          )}

          {/* Tabs */}
          <div className="wb-tabs">
            <button className={`wb-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>
              Params
              {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
            </button>
            {request.method !== 'GET' && (
              <button className={`wb-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
                Body
                {(request.body || (request.bodyForm ?? []).some(kv => kv.key.trim())) ? <span className="wb-tab-dot" /> : null}
              </button>
            )}
            <button className={`wb-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
              Headers
              {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
            </button>
            <button className={`wb-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>
              Auth
              {request.auth.type !== 'none' && request.auth.type !== 'inherit' && <span className="wb-tab-dot" />}
            </button>
          </div>

          {/* Tab content */}
          <div className="wb-tab-content">
            {activeTab === 'params' && (
              <ParamsEditor params={queryParams} onChange={handleParamsChange} />
            )}

            {activeTab === 'body' && request.method !== 'GET' && (
              <BodyEditor draft={draftScenario} onDraftChange={handleDraftChange} />
            )}

            {activeTab === 'headers' && (
              <div className="wb-headers-editor">
                <div className="wb-kv-header">
                  <span>REQUEST HEADERS</span>
                </div>
                {request.headers.map((h, i) => (
                  <div key={i} className="wb-header-row">
                    <input
                      className="wb-input"
                      value={h.key}
                      onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                      placeholder="Header name"
                    />
                    <input
                      className="wb-input"
                      value={h.value}
                      onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                      placeholder="Value"
                    />
                    <button className="wb-icon-btn danger" onClick={() => removeHeader(i)}>&times;</button>
                  </div>
                ))}
                <button className="btn btn-sm" onClick={addHeader}>+ Add Header</button>
              </div>
            )}

            {activeTab === 'auth' && (
              <div className="wb-auth-editor">
                <select
                  className="wb-select"
                  value={request.auth.type}
                  onChange={(e) => onUpdateRequest({ auth: { ...request.auth, type: e.target.value as AuthConfig['type'] } })}
                >
                  <option value="inherit">Inherit from Collection</option>
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="api-key">API Key</option>
                  <option value="oauth2">OAuth2 Client Credentials</option>
                </select>

                {request.auth.type === 'bearer' && (
                  <div className="wb-auth-fields">
                    <label className="wb-auth-label">Prefix</label>
                    <input
                      className="wb-input"
                      value={request.auth.prefix ?? 'Bearer'}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, prefix: e.target.value } })}
                      placeholder="Prefix (default: Bearer)"
                    />
                    <label className="wb-auth-label">Token</label>
                    <input
                      className="wb-input"
                      value={request.auth.token ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, token: e.target.value } })}
                      placeholder="Token"
                    />
                  </div>
                )}

                {request.auth.type === 'basic' && (
                  <div className="wb-auth-fields">
                    <label className="wb-auth-label">Username</label>
                    <input
                      className="wb-input"
                      value={request.auth.username ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, username: e.target.value } })}
                      placeholder="Username"
                    />
                    <label className="wb-auth-label">Password</label>
                    <input
                      className="wb-input"
                      type="password"
                      value={request.auth.password ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, password: e.target.value } })}
                      placeholder="Password"
                    />
                  </div>
                )}

                {request.auth.type === 'api-key' && (
                  <div className="wb-auth-fields">
                    <label className="wb-auth-label">Key Name</label>
                    <input
                      className="wb-input"
                      value={request.auth.apiKeyName ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, apiKeyName: e.target.value } })}
                      placeholder="Key name"
                    />
                    <label className="wb-auth-label">Key Value</label>
                    <input
                      className="wb-input"
                      value={request.auth.apiKeyValue ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, apiKeyValue: e.target.value } })}
                      placeholder="Key value"
                    />
                    <label className="wb-auth-label">Add To</label>
                    <select
                      className="wb-select"
                      value={request.auth.apiKeyIn ?? 'header'}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, apiKeyIn: e.target.value as 'header' | 'query' } })}
                    >
                      <option value="header">Header</option>
                      <option value="query">Query String</option>
                    </select>
                  </div>
                )}

                {request.auth.type === 'oauth2' && (
                  <div className="wb-auth-fields">
                    <label className="wb-auth-label">Token URL</label>
                    <input
                      className="wb-input"
                      value={request.auth.tokenUrl ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, tokenUrl: e.target.value } })}
                      placeholder="https://auth.example.com/oauth/token"
                    />
                    <label className="wb-auth-label">Client ID</label>
                    <input
                      className="wb-input"
                      value={request.auth.clientId ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, clientId: e.target.value } })}
                      placeholder="Client ID"
                    />
                    <label className="wb-auth-label">Client Secret</label>
                    <input
                      className="wb-input"
                      type="password"
                      value={request.auth.clientSecret ?? ''}
                      onChange={(e) => onUpdateRequest({ auth: { ...request.auth, clientSecret: e.target.value } })}
                      placeholder="Client Secret"
                    />
                  </div>
                )}

                {request.auth.type === 'inherit' && collection.auth && collection.auth.type !== 'none' && (
                  <div className="wb-auth-inherit-info">
                    Inheriting <strong>{collection.auth.type}</strong> auth from collection "{collection.name}"
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Response area */}
      <div className="wb-response-area">
        {sending && (
          <div className="wb-response-loading">
            <div className="wb-spinner" />
            Sending request...
          </div>
        )}

        {!sending && !response && !sendAllResults && (
          <div className="wb-response-placeholder">
            Click <strong>Send</strong> to get a response
          </div>
        )}

        {!sending && response && !sendAllResults && (
          <div className="wb-response-panel">
            <div className="wb-response-header">
              <span className="wb-response-title">Response</span>
              <span className={`wb-status-badge ${response.status >= 200 && response.status < 300 ? 'success' : response.status >= 400 ? 'error' : 'warn'}`}>
                {response.status} {response.statusText}
              </span>
              <span className="wb-response-time">{responseTime} ms</span>
              <span className="wb-response-size">{(response.body?.length ?? 0).toLocaleString()} chars</span>
            </div>
            <div className="wb-response-tabs">
              <ResponseBody body={response.body} error={response.error} />
            </div>
          </div>
        )}

        {!sending && sendAllResults && (
          <div className="wb-response-panel">
            <div className="wb-response-header">
              <span className="wb-response-title">Multi-Environment Results</span>
            </div>
            <div className="wb-multi-results">
              {sendAllResults.map((r, i) => (
                <MultiEnvResultRow key={i} {...r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResponseBody({ body, error }: { body: string; error?: string }) {
  const [wrap, setWrap] = useState(false);

  const formatted = useMemo(() => {
    if (error) return error;
    if (!body) return '(empty response)';
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }, [body, error]);

  return (
    <div className="wb-response-body-container">
      <div className="wb-response-body-toolbar">
        <label className="wb-toggle-label">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
          Wrap
        </label>
      </div>
      <pre className={`wb-response-body ${wrap ? 'wrap' : ''}`}>{formatted}</pre>
    </div>
  );
}

function MultiEnvResultRow({ envName, response, time }: { envName: string; response: HttpResponse; time: number }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = response.status >= 200 && response.status < 300;

  return (
    <div className={`wb-multi-row ${isSuccess ? 'success' : 'error'}`}>
      <div className="wb-multi-row-header" onClick={() => setExpanded(!expanded)}>
        <span className="wb-multi-arrow">{expanded ? '▾' : '▸'}</span>
        <span className="wb-multi-env">{envName}</span>
        <span className={`wb-status-badge ${isSuccess ? 'success' : 'error'}`}>
          {response.status || 'ERR'}
        </span>
        <span className="wb-response-time">{time} ms</span>
      </div>
      {expanded && (
        <div className="wb-multi-row-body">
          <ResponseBody body={response.body} error={response.error} />
        </div>
      )}
    </div>
  );
}
