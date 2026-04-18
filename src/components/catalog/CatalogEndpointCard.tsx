import { useState, useCallback, useMemo } from 'react';
import type { CatalogEndpoint, CatalogServer, HostConfig } from '../../types/catalog';
import type { AuthConfig } from '../../types';
import { generateStubJson } from '../../utils/schemaStubGenerator';
import { buildCatalogCurlCommand, resolveBaseUrl, buildFullUrl } from '../../utils/catalogCurlGenerator';
import { httpFetch } from '../../utils/httpClient';

interface Props {
  endpoint: CatalogEndpoint;
  servers: CatalogServer[];
  hostConfig: HostConfig;
  auth: AuthConfig;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#f59e0b', PUT: '#3b82f6', PATCH: '#8b5cf6', DELETE: '#ef4444',
};
const METHOD_BG: Record<string, string> = {
  GET: 'rgba(34,197,94,0.08)', POST: 'rgba(245,158,11,0.08)',
  PUT: 'rgba(59,130,246,0.08)', PATCH: 'rgba(139,92,246,0.08)',
  DELETE: 'rgba(239,68,68,0.08)',
};

export default function CatalogEndpointCard({ endpoint, servers, hostConfig, auth }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tryItOpen, setTryItOpen] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('');
  const [bodyInited, setBodyInited] = useState(false);
  const [response, setResponse] = useState<{ status: number; statusText: string; headers: Record<string, string>; body: string; timeMs: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonContentType = endpoint.requestBody?.contentTypes.find(
    ct => ct.mediaType.includes('json')
  );
  const hasBody = endpoint.requestBody && jsonContentType;

  const initBody = useCallback(() => {
    if (!bodyInited && jsonContentType?.schema) {
      setBodyText(generateStubJson(jsonContentType.schema));
      setBodyInited(true);
    }
  }, [bodyInited, jsonContentType]);

  const handleTryIt = useCallback(() => {
    if (!tryItOpen) initBody();
    setTryItOpen(!tryItOpen);
    setResponse(null);
  }, [tryItOpen, initBody]);

  const handleExecute = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const baseUrl = resolveBaseUrl(hostConfig, servers);
    const fullUrl = buildFullUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters);

    const reqHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headerValues)) {
      if (k.trim() && v.trim()) reqHeaders[k.trim()] = v.trim();
    }

    if (auth.type === 'basic' && auth.username) {
      reqHeaders['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password ?? ''}`)}`;
    } else if (auth.type === 'bearer' && auth.token) {
      reqHeaders['Authorization'] = `${auth.prefix?.trim() || 'Bearer'} ${auth.token}`;
    } else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue) {
      if (auth.apiKeyIn !== 'query') {
        reqHeaders[auth.apiKeyName] = auth.apiKeyValue;
      }
    }

    if (bodyText.trim() && endpoint.method !== 'GET') {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
    }

    const start = performance.now();
    const resp = await httpFetch(
      fullUrl,
      endpoint.method,
      reqHeaders,
      bodyText.trim() && endpoint.method !== 'GET' ? bodyText : undefined,
    );
    const timeMs = Math.round(performance.now() - start);

    setResponse({ ...resp, timeMs });
    setLoading(false);
  }, [endpoint, servers, hostConfig, paramValues, headerValues, bodyText, auth]);

  const curlCommand = useMemo(() => {
    if (!showCurl) return '';
    return buildCatalogCurlCommand({
      endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth,
    });
  }, [showCurl, endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth]);

  const handleCopy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }, []);

  const pathParams = endpoint.parameters.filter(p => p.in === 'path');
  const queryParams = endpoint.parameters.filter(p => p.in === 'query');
  const headerParams = endpoint.parameters.filter(p => p.in === 'header');

  return (
    <div className="cep-card" style={{ borderLeftColor: METHOD_COLORS[endpoint.method] ?? '#888' }}>
      {/* ── Collapsed header ─────────────────────── */}
      <div
        className="cep-header"
        style={{ background: expanded ? METHOD_BG[endpoint.method] : undefined }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="cep-method" style={{ background: METHOD_COLORS[endpoint.method] }}>
          {endpoint.method}
        </span>
        <span className="cep-path">{endpoint.path}</span>
        <span className="cep-summary">{endpoint.summary}</span>
        {endpoint.deprecated && <span className="cep-deprecated">deprecated</span>}
        <span className={`cep-chevron ${expanded ? 'open' : ''}`}>▾</span>
      </div>

      {/* ── Expanded body ────────────────────────── */}
      {expanded && (
        <div className="cep-body" style={{ background: METHOD_BG[endpoint.method] }}>
          {endpoint.description && (
            <p className="cep-description">{endpoint.description}</p>
          )}

          {/* Parameters */}
          {(pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0) && (
            <div className="cep-section">
              <h4 className="cep-section-title">Parameters</h4>
              <table className="cep-param-table">
                <thead>
                  <tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {[...pathParams, ...queryParams, ...headerParams].map(p => (
                    <tr key={`${p.in}-${p.name}`}>
                      <td className="cep-param-name">{p.name}</td>
                      <td><span className={`cep-param-in cep-in-${p.in}`}>{p.in}</span></td>
                      <td className="cep-param-type">{p.schema?.type ?? '—'}{p.schema?.format ? ` (${p.schema.format})` : ''}</td>
                      <td>{p.required ? <span className="cep-required">*required</span> : 'no'}</td>
                      <td className="cep-param-desc">{p.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Request body schema */}
          {hasBody && (
            <div className="cep-section">
              <h4 className="cep-section-title">Request Body</h4>
              <div className="cep-schema-info">
                <span className="cep-content-type">{jsonContentType!.mediaType}</span>
                {endpoint.requestBody!.required && <span className="cep-required">required</span>}
              </div>
              {jsonContentType!.schema && (
                <pre className="cep-schema-preview">{generateStubJson(jsonContentType!.schema)}</pre>
              )}
            </div>
          )}

          {/* Responses */}
          {endpoint.responses.length > 0 && (
            <div className="cep-section">
              <h4 className="cep-section-title">Responses</h4>
              <div className="cep-responses">
                {endpoint.responses.map(r => (
                  <div key={r.statusCode} className="cep-response-row">
                    <span className={`cep-status-code cep-status-${r.statusCode[0]}`}>{r.statusCode}</span>
                    <span className="cep-response-desc">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Try It Out + cURL */}
          <div className="cep-actions">
            <button className="cat-btn cat-btn-primary" onClick={handleTryIt}>
              {tryItOpen ? 'Cancel' : 'Try it out'}
            </button>
            <button className="cat-btn" onClick={() => setShowCurl(!showCurl)}>
              {showCurl ? 'Hide cURL' : 'cURL'}
            </button>
          </div>

          {/* cURL preview */}
          {showCurl && (
            <div className="cep-curl-section">
              <div className="cep-curl-header">
                <span>cURL</span>
                <button className="cep-copy-btn" onClick={() => handleCopy(curlCommand)}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="cep-curl-code">{curlCommand}</pre>
            </div>
          )}

          {/* Try-it-out form */}
          {tryItOpen && (
            <div className="cep-tryit">
              {/* Path parameters */}
              {pathParams.length > 0 && (
                <div className="cep-tryit-group">
                  <label className="cep-tryit-label">Path Parameters</label>
                  {pathParams.map(p => (
                    <div key={p.name} className="cep-tryit-field">
                      <label className="cep-field-name">{p.name} {p.required && <span className="cep-required">*</span>}</label>
                      <input
                        className="cep-field-input"
                        placeholder={p.schema?.example?.toString() || p.schema?.type || 'value'}
                        value={paramValues[p.name] ?? ''}
                        onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Query parameters */}
              {queryParams.length > 0 && (
                <div className="cep-tryit-group">
                  <label className="cep-tryit-label">Query Parameters</label>
                  {queryParams.map(p => (
                    <div key={p.name} className="cep-tryit-field">
                      <label className="cep-field-name">{p.name} {p.required && <span className="cep-required">*</span>}</label>
                      <input
                        className="cep-field-input"
                        placeholder={p.schema?.example?.toString() || p.schema?.type || 'value'}
                        value={paramValues[p.name] ?? ''}
                        onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Header parameters */}
              {headerParams.length > 0 && (
                <div className="cep-tryit-group">
                  <label className="cep-tryit-label">Header Parameters</label>
                  {headerParams.map(p => (
                    <div key={p.name} className="cep-tryit-field">
                      <label className="cep-field-name">{p.name}</label>
                      <input
                        className="cep-field-input"
                        placeholder={p.schema?.example?.toString() || 'value'}
                        value={headerValues[p.name] ?? ''}
                        onChange={e => setHeaderValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Request body */}
              {hasBody && (
                <div className="cep-tryit-group">
                  <label className="cep-tryit-label">Request Body</label>
                  <textarea
                    className="cep-tryit-body"
                    rows={10}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}

              <button
                className="cat-btn cat-btn-primary cep-execute-btn"
                onClick={handleExecute}
                disabled={loading}
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>

              {/* Response */}
              {response && (
                <div className="cep-response">
                  <div className="cep-response-header">
                    <span className={`cep-status-badge cep-status-${String(response.status)[0]}`}>
                      {response.status} {response.statusText}
                    </span>
                    <span className="cep-response-time">{response.timeMs}ms</span>
                    <button className="cep-copy-btn" onClick={() => handleCopy(response.body)}>
                      Copy Body
                    </button>
                  </div>
                  {Object.keys(response.headers).length > 0 && (
                    <details className="cep-response-headers-detail">
                      <summary className="cep-response-headers-toggle">
                        Response Headers ({Object.keys(response.headers).length})
                      </summary>
                      <div className="cep-response-headers">
                        {Object.entries(response.headers).map(([k, v]) => (
                          <div key={k} className="cep-header-row">
                            <span className="cep-header-key">{k}:</span> <span className="cep-header-val">{v}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <pre className="cep-response-body">{formatBody(response.body)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
