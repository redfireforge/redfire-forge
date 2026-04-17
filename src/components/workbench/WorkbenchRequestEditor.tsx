import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  WorkbenchCollection, WorkbenchRequest, WorkbenchEnv,
  GlobalAuthProfile, KeyValue, HttpMethod, Scenario,
} from '../../types';
import { httpFetch } from '../../utils/httpClient';
import type { HttpResponse } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { BodyEditor } from '../BodyEditor';
import { ParamsEditor, toParamEntries, fromParamEntries } from '../ParamsEditor';
import type { ParamEntry } from '../ParamsEditor';

type EditorTab = 'params' | 'headers' | 'body' | 'auth';

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

export default function WorkbenchRequestEditor({
  collection, request, environments, selectedEnvId, onEnvChange,
  onUpdateRequest, resolveUrl, appGlobalAuthProfiles,
}: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>('params');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [sendAllResults, setSendAllResults] = useState<{ envName: string; response: HttpResponse; time: number }[] | null>(null);
  const [reqNameEditing, setReqNameEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const queryParams = useMemo(() => toParamEntries(parseQueryParams(request.url)), [request.url]);
  const headerCount = useMemo(() => request.headers.filter((h) => h.key.trim()).length, [request.headers]);

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

    const auth = request.auth?.type !== 'none' && request.auth?.type !== 'inherit'
      ? request.auth
      : collection.auth;

    if (auth?.type === 'bearer' && auth.token) {
      h['Authorization'] = `${auth.prefix || 'Bearer'} ${auth.token}`;
    } else if (auth?.type === 'basic' && auth.username) {
      h['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password || ''}`)}`;
    } else if (auth?.type === 'api-key' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === 'header') {
      h[auth.apiKeyName] = auth.apiKeyValue;
    }

    return h;
  }, [request.auth, collection.auth]);

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
        status: 0,
        statusText: 'Error',
        headers: {},
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

      const scenario: Scenario = {
        ...asDraftScenario(),
        url: fullUrl,
      };
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

  const handleNameBlur = () => {
    setReqNameEditing(false);
  };

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
      {/* Request name */}
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
          {queryParams.filter(p => p.key.trim() && p.enabled).length > 0 && (
            <span className="tab-badge">{queryParams.filter(p => p.key.trim() && p.enabled).length}</span>
          )}
        </button>
        <button className={`wb-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>Body</button>
        <button className={`wb-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
          Headers
          {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
        </button>
        <button className={`wb-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>Auth</button>
      </div>

      {/* Tab content */}
      <div className="wb-tab-content">
        {activeTab === 'params' && (
          <ParamsEditor params={queryParams} onChange={handleParamsChange} />
        )}

        {activeTab === 'body' && (
          <BodyEditor draft={draftScenario} onDraftChange={handleDraftChange} />
        )}

        {activeTab === 'headers' && (
          <div className="wb-headers-editor">
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
              onChange={(e) => onUpdateRequest({ auth: { ...request.auth, type: e.target.value as any } })}
            >
              <option value="inherit">Inherit from Collection</option>
              <option value="none">No Auth</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="api-key">API Key</option>
            </select>

            {request.auth.type === 'bearer' && (
              <div className="wb-auth-fields">
                <input
                  className="wb-input"
                  value={request.auth.prefix ?? 'Bearer'}
                  onChange={(e) => onUpdateRequest({ auth: { ...request.auth, prefix: e.target.value } })}
                  placeholder="Prefix (default: Bearer)"
                />
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
                <input
                  className="wb-input"
                  value={request.auth.username ?? ''}
                  onChange={(e) => onUpdateRequest({ auth: { ...request.auth, username: e.target.value } })}
                  placeholder="Username"
                />
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
                <input
                  className="wb-input"
                  value={request.auth.apiKeyName ?? ''}
                  onChange={(e) => onUpdateRequest({ auth: { ...request.auth, apiKeyName: e.target.value } })}
                  placeholder="Key name"
                />
                <input
                  className="wb-input"
                  value={request.auth.apiKeyValue ?? ''}
                  onChange={(e) => onUpdateRequest({ auth: { ...request.auth, apiKeyValue: e.target.value } })}
                  placeholder="Key value"
                />
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

            {request.auth.type === 'inherit' && collection.auth?.type === 'bearer' && (
              <div className="wb-auth-inherit-info">
                Inheriting Bearer Token from collection "{collection.name}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Response area */}
      <div className="wb-response-area">
        {sending && (
          <div className="wb-response-loading">
            <div className="wb-spinner" />
            Sending request...
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
