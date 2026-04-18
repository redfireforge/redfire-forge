import { useState, useCallback, useMemo } from 'react';
import type { CatalogEndpoint, CatalogServer, HostConfig, CatalogResponse } from '../../types/catalog';
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
  GET: '#49cc90', POST: '#fca130', PUT: '#61affe', PATCH: '#50e3c2', DELETE: '#f93e3e',
};
const METHOD_BG: Record<string, string> = {
  GET: 'rgba(73,204,144,0.1)', POST: 'rgba(252,161,48,0.1)',
  PUT: 'rgba(97,175,254,0.1)', PATCH: 'rgba(80,227,194,0.1)',
  DELETE: 'rgba(249,62,62,0.1)',
};
const METHOD_BORDER: Record<string, string> = {
  GET: '#49cc90', POST: '#fca130', PUT: '#61affe', PATCH: '#50e3c2', DELETE: '#f93e3e',
};

export default function CatalogEndpointCard({ endpoint, servers, hostConfig, auth }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tryItOpen, setTryItOpen] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('');
  const [bodyInited, setBodyInited] = useState(false);
  const [response, setResponse] = useState<{
    status: number; statusText: string;
    headers: Record<string, string>; body: string; timeMs: number;
  } | null>(null);
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
      fullUrl, endpoint.method, reqHeaders,
      bodyText.trim() && endpoint.method !== 'GET' ? bodyText : undefined,
    );
    const timeMs = Math.round(performance.now() - start);
    setResponse({ ...resp, timeMs });
    setLoading(false);
  }, [endpoint, servers, hostConfig, paramValues, headerValues, bodyText, auth]);

  const curlCommand = useMemo(() => {
    if (!showCurl) return '';
    return buildCatalogCurlCommand({ endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth });
  }, [showCurl, endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth]);

  const handleCopy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }, []);

  const allParams = endpoint.parameters;
  const hasSecurity = endpoint.security && endpoint.security.length > 0;
  const borderColor = METHOD_BORDER[endpoint.method] ?? '#888';

  return (
    <div className="cep-card" style={{ border: `1px solid ${borderColor}` }}>
      {/* ── Header row ────────────────────────────── */}
      <div
        className="cep-header"
        style={{ background: METHOD_BG[endpoint.method] }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="cep-method" style={{ background: METHOD_COLORS[endpoint.method] }}>
          {endpoint.method}
        </span>
        <span className="cep-path">{endpoint.path}</span>
        <span className="cep-summary">{endpoint.summary}</span>
        {endpoint.deprecated && <span className="cep-deprecated">deprecated</span>}
        {hasSecurity && <span className="cep-lock" title="Requires authentication">🔒</span>}
        <span className={`cep-chevron ${expanded ? 'open' : ''}`}>▾</span>
      </div>

      {/* ── Expanded body ─────────────────────────── */}
      {expanded && (
        <div className="cep-body">
          {endpoint.description && (
            <p className="cep-description">{endpoint.description}</p>
          )}

          {/* ── Parameters section (Swagger UI style) ── */}
          {allParams.length > 0 && (
            <div className="cep-section">
              <div className="cep-section-header">
                <h4 className="cep-section-title">Parameters</h4>
                <button className={`cep-tryit-toggle ${tryItOpen ? 'active' : ''}`} onClick={handleTryIt}>
                  {tryItOpen ? 'Cancel' : 'Try it out'}
                </button>
              </div>

              <div className="cep-params-grid">
                <div className="cep-params-grid-header">
                  <span>Name</span>
                  <span>Description</span>
                </div>
                {allParams.map(p => (
                  <div key={`${p.in}-${p.name}`} className="cep-param-row">
                    <div className="cep-param-left">
                      <span className="cep-param-name">
                        {p.name}
                        {p.required && <span className="cep-required-star"> *</span>}
                        {p.required && <span className="cep-required-label">required</span>}
                      </span>
                      <span className="cep-param-meta">
                        {p.schema?.type ?? 'string'}
                        {p.schema?.format ? <span className="cep-param-format">(${p.schema.format})</span> : ''}
                      </span>
                      <span className={`cep-param-in cep-in-${p.in}`}>({p.in})</span>
                    </div>
                    <div className="cep-param-right">
                      <div className="cep-param-description">{p.description || ''}</div>
                      {tryItOpen ? (
                        <input
                          className="cep-param-input"
                          placeholder={p.schema?.example?.toString() || p.name}
                          value={
                            p.in === 'header'
                              ? (headerValues[p.name] ?? '')
                              : (paramValues[p.name] ?? '')
                          }
                          onChange={e => {
                            if (p.in === 'header') {
                              setHeaderValues(prev => ({ ...prev, [p.name]: e.target.value }));
                            } else {
                              setParamValues(prev => ({ ...prev, [p.name]: e.target.value }));
                            }
                          }}
                        />
                      ) : (
                        <div className="cep-param-placeholder">{p.name}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── No-parameter endpoint: still show Try it out ── */}
          {allParams.length === 0 && (
            <div className="cep-section">
              <div className="cep-section-header">
                <h4 className="cep-section-title">Parameters</h4>
                <button className={`cep-tryit-toggle ${tryItOpen ? 'active' : ''}`} onClick={handleTryIt}>
                  {tryItOpen ? 'Cancel' : 'Try it out'}
                </button>
              </div>
              <div className="cep-no-params">No parameters</div>
            </div>
          )}

          {/* ── Request body ──────────────────────────── */}
          {hasBody && (
            <div className="cep-section">
              <div className="cep-section-header">
                <h4 className="cep-section-title">Request body</h4>
                <span className="cep-content-type-badge">{jsonContentType!.mediaType}</span>
                {endpoint.requestBody!.required && <span className="cep-required-label">required</span>}
              </div>
              {tryItOpen ? (
                <textarea
                  className="cep-tryit-body"
                  rows={12}
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <div className="cep-example-block">
                  <div className="cep-example-tabs">
                    <span className="cep-example-tab active">Example Value</span>
                    <span className="cep-example-tab">Model</span>
                  </div>
                  <pre className="cep-json-block">{generateStubJson(jsonContentType!.schema)}</pre>
                </div>
              )}
            </div>
          )}

          {/* ── Execute + cURL (when try-it-out is open) ── */}
          {tryItOpen && (
            <div className="cep-execute-bar">
              <button
                className="cep-execute-btn"
                style={{ background: METHOD_COLORS[endpoint.method] }}
                onClick={handleExecute}
                disabled={loading}
              >
                {loading ? 'Executing...' : 'Execute'}
              </button>
              <button className="cep-curl-toggle" onClick={() => setShowCurl(!showCurl)}>
                {showCurl ? 'Hide cURL' : 'cURL'}
              </button>
            </div>
          )}

          {/* ── cURL preview ──────────────────────────── */}
          {showCurl && tryItOpen && (
            <div className="cep-curl-section">
              <div className="cep-curl-header">
                <span>Curl</span>
                <button className="cep-copy-btn" onClick={() => handleCopy(curlCommand)}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="cep-json-block cep-curl-code">{curlCommand}</pre>
            </div>
          )}

          {/* ── Live response (when executed) ─────────── */}
          {response && tryItOpen && (
            <div className="cep-section">
              <h4 className="cep-section-title">Server response</h4>
              <div className="cep-live-response">
                <div className="cep-live-response-header">
                  <div className="cep-live-response-meta">
                    <span className="cep-live-status-label">Code</span>
                    <span className="cep-live-desc-label">Details</span>
                  </div>
                  <div className="cep-live-response-row">
                    <span className={`cep-status-code cep-status-${String(response.status)[0]}`}>
                      {response.status}
                    </span>
                    <div className="cep-live-response-detail">
                      <div className="cep-live-response-badges">
                        <span className="cep-live-time">{response.timeMs}ms</span>
                        <button className="cep-copy-btn" onClick={() => handleCopy(response.body)}>
                          Copy
                        </button>
                      </div>
                      {Object.keys(response.headers).length > 0 && (
                        <details className="cep-response-headers-detail">
                          <summary className="cep-response-headers-toggle">
                            Response headers
                          </summary>
                          <pre className="cep-json-block cep-headers-block">
                            {Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                          </pre>
                        </details>
                      )}
                      <div className="cep-example-block">
                        <div className="cep-example-tabs">
                          <span className="cep-example-tab active">Response body</span>
                        </div>
                        <pre className="cep-json-block">{formatBody(response.body)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Responses section (spec-defined) ──────── */}
          {endpoint.responses.length > 0 && (
            <div className="cep-section">
              <h4 className="cep-section-title">Responses</h4>
              <div className="cep-responses-table">
                <div className="cep-responses-header-row">
                  <span className="cep-resp-col-code">Code</span>
                  <span className="cep-resp-col-desc">Description</span>
                </div>
                {endpoint.responses.map(r => (
                  <ResponseBlock key={r.statusCode} resp={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponseBlock({ resp }: { resp: CatalogResponse }) {
  const [tab, setTab] = useState<'example' | 'model'>('example');
  const hasSchema = !!resp.schema;
  const exampleJson = resp.example
    ? JSON.stringify(resp.example, null, 2)
    : (resp.schema ? generateStubJson(resp.schema) : null);
  const modelView = resp.schema ? buildModelView(resp.schema, 0) : null;

  return (
    <div className="cep-resp-block">
      <div className="cep-resp-row">
        <span className={`cep-status-code cep-status-${resp.statusCode[0]}`}>
          {resp.statusCode}
        </span>
        <div className="cep-resp-detail">
          <div className="cep-resp-description">{resp.description}</div>
          {(exampleJson || hasSchema) && (
            <div className="cep-example-block">
              <div className="cep-example-tabs">
                <span
                  className={`cep-example-tab ${tab === 'example' ? 'active' : ''}`}
                  onClick={() => setTab('example')}
                >Example Value</span>
                {hasSchema && (
                  <span
                    className={`cep-example-tab ${tab === 'model' ? 'active' : ''}`}
                    onClick={() => setTab('model')}
                  >Model</span>
                )}
              </div>
              {tab === 'example' && exampleJson && (
                <pre className="cep-json-block">{exampleJson}</pre>
              )}
              {tab === 'model' && modelView && (
                <pre className="cep-json-block cep-model-block">{modelView}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildModelView(schema: NonNullable<CatalogResponse['schema']>, depth: number): string {
  if (depth > 6) return '...';
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  if (schema.type === 'object' || schema.properties) {
    lines.push(`${indent}{`);
    for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
      const req = schema.required?.includes(key) ? '' : '?';
      const type = propSchema.type ?? 'any';
      const desc = propSchema.description ? `  // ${propSchema.description}` : '';
      if (propSchema.type === 'object' || propSchema.properties) {
        lines.push(`${indent}  ${key}${req}: ${buildModelView(propSchema, depth + 1).trim()}${desc}`);
      } else if (propSchema.type === 'array') {
        const itemType = propSchema.items
          ? (propSchema.items.type === 'object' || propSchema.items.properties
            ? buildModelView(propSchema.items, depth + 2).trim()
            : propSchema.items.type ?? 'any')
          : 'any';
        lines.push(`${indent}  ${key}${req}: [${itemType}]${desc}`);
      } else {
        const enumStr = propSchema.enum ? ` enum: [${propSchema.enum.join(', ')}]` : '';
        lines.push(`${indent}  ${key}${req}: ${type}${propSchema.format ? `($${propSchema.format})` : ''}${enumStr}${desc}`);
      }
    }
    lines.push(`${indent}}`);
  } else if (schema.type === 'array') {
    const itemView = schema.items
      ? buildModelView(schema.items, depth + 1).trim()
      : 'any';
    lines.push(`[${itemView}]`);
  } else {
    lines.push(`${schema.type ?? 'any'}${schema.format ? ` (${schema.format})` : ''}`);
  }
  return lines.join('\n');
}

function formatBody(body: string): string {
  try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
}
