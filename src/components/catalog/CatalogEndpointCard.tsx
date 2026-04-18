import { useState, useCallback, useMemo } from 'react';
import type { CatalogEndpoint, CatalogServer, HostConfig, CatalogResponse, CatalogParameter } from '../../types/catalog';
import type { AuthConfig } from '../../types';
import { generateStubJson } from '../../utils/schemaStubGenerator';
import { buildCatalogCurlCommand, resolveBaseUrl, buildFullUrl } from '../../utils/catalogCurlGenerator';
import { httpFetch } from '../../utils/httpClient';
import { highlightJson } from '../../utils/jsonHighlighter';

interface Props {
  endpoint: CatalogEndpoint;
  servers: CatalogServer[];
  hostConfig: HostConfig;
  auth: AuthConfig;
}

const MC: Record<string, string> = {
  GET: '#49cc90', POST: '#fca130', PUT: '#61affe', PATCH: '#50e3c2', DELETE: '#f93e3e',
};
const MBG: Record<string, string> = {
  GET: 'rgba(73,204,144,0.1)', POST: 'rgba(252,161,48,0.1)',
  PUT: 'rgba(97,175,254,0.1)', PATCH: 'rgba(80,227,194,0.1)',
  DELETE: 'rgba(249,62,62,0.1)',
};

export default function CatalogEndpointCard({ endpoint, servers, hostConfig, auth }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tryItOpen, setTryItOpen] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState('');
  const [bodyInited, setBodyInited] = useState(false);
  const [liveResponse, setLiveResponse] = useState<{
    status: number; statusText: string;
    headers: Record<string, string>; body: string; timeMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonCT = endpoint.requestBody?.contentTypes.find(ct => ct.mediaType.includes('json'));
  const hasBody = !!(endpoint.requestBody && jsonCT);

  const initBody = useCallback(() => {
    if (!bodyInited && jsonCT?.schema) {
      setBodyText(generateStubJson(jsonCT.schema));
      setBodyInited(true);
    }
  }, [bodyInited, jsonCT]);

  const handleTryIt = useCallback(() => {
    if (!tryItOpen) initBody();
    setTryItOpen(v => !v);
    setLiveResponse(null);
  }, [tryItOpen, initBody]);

  const handleExecute = useCallback(async () => {
    setLoading(true);
    setLiveResponse(null);
    const baseUrl = resolveBaseUrl(hostConfig, servers);
    const url = buildFullUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters);
    const hdrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(headerValues)) {
      if (k.trim() && v.trim()) hdrs[k.trim()] = v.trim();
    }
    if (auth.type === 'basic' && auth.username)
      hdrs['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password ?? ''}`)}`;
    else if (auth.type === 'bearer' && auth.token)
      hdrs['Authorization'] = `${auth.prefix?.trim() || 'Bearer'} ${auth.token}`;
    else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn !== 'query')
      hdrs[auth.apiKeyName] = auth.apiKeyValue;
    if (bodyText.trim() && endpoint.method !== 'GET')
      hdrs['Content-Type'] = hdrs['Content-Type'] || 'application/json';

    const t0 = performance.now();
    const r = await httpFetch(url, endpoint.method, hdrs,
      bodyText.trim() && endpoint.method !== 'GET' ? bodyText : undefined);
    setLiveResponse({ ...r, timeMs: Math.round(performance.now() - t0) });
    setLoading(false);
  }, [endpoint, servers, hostConfig, paramValues, headerValues, bodyText, auth]);

  const curlCmd = useMemo(() =>
    showCurl ? buildCatalogCurlCommand({ endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth }) : '',
    [showCurl, endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth],
  );

  const copy = useCallback(async (t: string) => {
    try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {/* */}
  }, []);

  const hasSec = endpoint.security && endpoint.security.length > 0;
  const color = MC[endpoint.method] ?? '#888';

  return (
    <div className="sw-card" style={{ borderColor: color }}>
      {/* ── HEADER ────────────────────────────────── */}
      <div className="sw-header" role="button" tabIndex={0} style={{ background: MBG[endpoint.method] }}
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(v => !v); } }}>
        <span className="sw-method" style={{ background: color }}>{endpoint.method}</span>
        <span className="sw-path">{endpoint.path}</span>
        <span className="sw-summary">{endpoint.summary}</span>
        {endpoint.deprecated && <span className="sw-deprecated">deprecated</span>}
        {hasSec && <span className="sw-lock">🔒</span>}
        <span className={`sw-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="sw-body">
          {endpoint.description && <p className="sw-desc">{endpoint.description}</p>}

          {/* ── PARAMETERS ────────────────────────── */}
          <div className="sw-section">
            <div className="sw-section-bar">
              <span className="sw-section-title">Parameters</span>
              <button className={`sw-tryit-btn ${tryItOpen ? 'cancel' : ''}`} onClick={handleTryIt}>
                {tryItOpen ? 'Cancel' : 'Try it out'}
              </button>
            </div>

            {endpoint.parameters.length === 0 ? (
              <div className="sw-no-params">No parameters</div>
            ) : (
              <div className="sw-param-table">
                <div className="sw-param-thead">
                  <div className="sw-param-col-name">Name</div>
                  <div className="sw-param-col-desc">Description</div>
                </div>
                {endpoint.parameters.map(p => (
                  <ParamRow
                    key={`${p.in}:${p.name}`}
                    param={p}
                    tryItOpen={tryItOpen}
                    value={p.in === 'header' ? (headerValues[p.name] ?? '') : (paramValues[p.name] ?? '')}
                    onChange={val => {
                      if (p.in === 'header') setHeaderValues(prev => ({ ...prev, [p.name]: val }));
                      else setParamValues(prev => ({ ...prev, [p.name]: val }));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── REQUEST BODY ──────────────────────── */}
          {hasBody && (
            <div className="sw-section">
              <div className="sw-section-bar">
                <span className="sw-section-title">Request body</span>
                <span className="sw-ct-badge">{jsonCT!.mediaType}</span>
                {endpoint.requestBody!.required && <span className="sw-req-label">required</span>}
              </div>
              {tryItOpen ? (
                <textarea className="sw-body-editor" rows={12} value={bodyText}
                  onChange={e => setBodyText(e.target.value)} spellCheck={false} />
              ) : (
                <JsonBlock json={generateStubJson(jsonCT!.schema)} label="Example Value" />
              )}
            </div>
          )}

          {/* ── EXECUTE BAR ───────────────────────── */}
          {tryItOpen && (
            <div className="sw-exec-bar">
              <button className="sw-exec-btn" style={{ background: color }}
                onClick={handleExecute} disabled={loading}>
                {loading ? 'Executing...' : 'Execute'}
              </button>
              <button className="sw-curl-btn" onClick={() => setShowCurl(v => !v)}>
                {showCurl ? 'Hide cURL' : 'cURL'}
              </button>
            </div>
          )}

          {showCurl && tryItOpen && (
            <div className="sw-curl-box">
              <div className="sw-curl-bar">
                <span>Curl</span>
                <button className="sw-copy-btn" onClick={() => copy(curlCmd)}>{copied ? '✓ Copied' : 'Copy'}</button>
              </div>
              <pre className="sw-code-block">{curlCmd}</pre>
            </div>
          )}

          {/* ── LIVE RESPONSE ─────────────────────── */}
          {liveResponse && tryItOpen && (
            <div className="sw-section">
              <div className="sw-section-bar">
                <span className="sw-section-title">Server response</span>
              </div>
              <div className="sw-resp-table">
                <div className="sw-resp-thead">
                  <div className="sw-resp-col-code">Code</div>
                  <div className="sw-resp-col-desc">Details</div>
                </div>
                <div className="sw-resp-row">
                  <div className={`sw-resp-code sw-sc-${String(liveResponse.status)[0]}`}>{liveResponse.status}</div>
                  <div className="sw-resp-detail">
                    <div className="sw-resp-description">
                      {liveResponse.statusText}
                      <span className="sw-resp-time">{liveResponse.timeMs}ms</span>
                      <button className="sw-copy-btn" onClick={() => copy(liveResponse.body)}>Copy</button>
                    </div>
                    {Object.keys(liveResponse.headers).length > 0 && (
                      <details className="sw-resp-headers-details">
                        <summary>Response headers</summary>
                        <pre className="sw-code-block sw-code-sm">
                          {Object.entries(liveResponse.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                        </pre>
                      </details>
                    )}
                    <JsonBlock json={fmtBody(liveResponse.body)} label="Response body" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RESPONSES (spec-defined) ──────────── */}
          {endpoint.responses.length > 0 && (
            <div className="sw-section">
              <div className="sw-section-bar">
                <span className="sw-section-title">Responses</span>
              </div>
              <div className="sw-resp-table">
                <div className="sw-resp-thead">
                  <div className="sw-resp-col-code">Code</div>
                  <div className="sw-resp-col-desc">Description</div>
                </div>
                {endpoint.responses.map(r => (
                  <RespRow key={r.statusCode} resp={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Parameter row ────────────────────────────────── */

function ParamRow({ param: p, tryItOpen, value, onChange }: {
  param: CatalogParameter; tryItOpen: boolean; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="sw-param-row">
      <div className="sw-param-col-name">
        <div className="sw-pname">
          {p.name}
          {p.required && <span className="sw-pname-req"> *<span className="sw-req-text"> required</span></span>}
        </div>
        <div className="sw-ptype">{p.schema?.type ?? 'string'}{p.schema?.format ? `(${p.schema.format})` : ''}</div>
        <div className={`sw-pin sw-pin-${p.in}`}>({p.in})</div>
      </div>
      <div className="sw-param-col-desc">
        {p.description && <div className="sw-pdesc">{p.description}</div>}
        {tryItOpen ? (
          <input className="sw-pinput" placeholder={p.name} value={value} onChange={e => onChange(e.target.value)} />
        ) : (
          <div className="sw-pinput-ro">{p.name}</div>
        )}
      </div>
    </div>
  );
}

/* ── Response row (spec-defined) ──────────────────── */

function RespRow({ resp: r }: { resp: CatalogResponse }) {
  const [tab, setTab] = useState<'example' | 'model'>('example');
  const hasSchema = !!r.schema;
  const exJson = r.example
    ? JSON.stringify(r.example, null, 2)
    : (r.schema ? generateStubJson(r.schema) : null);

  return (
    <div className="sw-resp-row">
      <div className={`sw-resp-code sw-sc-${r.statusCode[0]}`}>{r.statusCode}</div>
      <div className="sw-resp-detail">
        <div className="sw-resp-description">{r.description}</div>
        {(exJson || hasSchema) && (
          <div className="sw-example-box">
            <div className="sw-example-tabs">
              <button className={`sw-etab ${tab === 'example' ? 'active' : ''}`} onClick={() => setTab('example')}>
                Example Value
              </button>
              {hasSchema && (
                <button className={`sw-etab ${tab === 'model' ? 'active' : ''}`} onClick={() => setTab('model')}>
                  Model
                </button>
              )}
            </div>
            {tab === 'example' && exJson && (
              <pre className="sw-code-block sw-json">{highlightJson(exJson)}</pre>
            )}
            {tab === 'model' && hasSchema && (
              <pre className="sw-code-block sw-model">{buildModel(r.schema!, 0)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── JSON example block ───────────────────────────── */

function JsonBlock({ json, label }: { json: string; label: string }) {
  return (
    <div className="sw-example-box">
      <div className="sw-example-tabs">
        <button className="sw-etab active">{label}</button>
      </div>
      <pre className="sw-code-block sw-json">{highlightJson(json)}</pre>
    </div>
  );
}

/* ── Model view builder ───────────────────────────── */

function buildModel(s: NonNullable<CatalogResponse['schema']>, d: number): string {
  if (d > 6) return '...';
  const pad = '  '.repeat(d);
  if (s.type === 'object' || s.properties) {
    const lines = [`${pad}{`];
    for (const [k, v] of Object.entries(s.properties ?? {})) {
      const opt = s.required?.includes(k) ? '' : '?';
      const desc = v.description ? `  // ${v.description}` : '';
      if (v.type === 'object' || v.properties)
        lines.push(`${pad}  ${k}${opt}: ${buildModel(v, d + 1).trim()}${desc}`);
      else if (v.type === 'array')
        lines.push(`${pad}  ${k}${opt}: [${v.items ? (v.items.properties ? buildModel(v.items, d + 2).trim() : v.items.type ?? 'any') : 'any'}]${desc}`);
      else {
        const enm = v.enum ? ` enum:[${v.enum.join(',')}]` : '';
        lines.push(`${pad}  ${k}${opt}: ${v.type ?? 'any'}${v.format ? `(${v.format})` : ''}${enm}${desc}`);
      }
    }
    lines.push(`${pad}}`);
    return lines.join('\n');
  }
  if (s.type === 'array')
    return `[${s.items ? buildModel(s.items, d + 1).trim() : 'any'}]`;
  return `${s.type ?? 'any'}${s.format ? `(${s.format})` : ''}`;
}

function fmtBody(b: string): string {
  try { return JSON.stringify(JSON.parse(b), null, 2); } catch { return b; }
}
