import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type {
  WorkbenchCollection, WorkbenchRequest, WorkbenchEnv,
  GlobalAuthProfile, KeyValue, HttpMethod, Scenario, AuthConfig,
} from '../../types';
import { httpFetch } from '../../utils/httpClient';
import { serializeWithContentType } from '../../utils/bodySerializer';
import { parseCurl } from '../../utils/curlParser';
import { buildCurlCommand } from '../../utils/curlGenerator';
import { acquireOAuth2Token } from '../../engine/tokenManager';
import { pickJsonFile, unwrapImport } from '../../utils/testEditorUtils';
import { useResponseCache } from '../../hooks/useResponseCache';
import type { ConsoleLine } from '../../hooks/useResponseCache';
import { BodyEditor } from '../BodyEditor';
import { ParamsEditor, fromParamEntries } from '../ParamsEditor';
import type { ParamEntry } from '../ParamsEditor';
import RequestAuthEditor from './RequestAuthEditor';
import JsonPreview, { buildJTree } from './JsonTreePreview';
import type { JNode } from './JsonTreePreview';
import ConsoleLog from './ConsoleLog';
import MultiEnvResultRow from './MultiEnvResultRow';
import { ResponseHistoryDropdown } from './ResponseHistoryDropdown';

type EditorTab = 'params' | 'headers' | 'body' | 'auth';
type InputMode = 'builder' | 'curlImport' | 'curlExport';
type ResponseTab = 'preview' | 'headers' | 'console';

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
  parentSubCollection?: import('../../types').WorkbenchFolder;
  environments: WorkbenchEnv[];
  selectedEnvId?: string;
  onEnvChange: (envId: string | undefined) => void;
  onUpdateRequest: (patch: Partial<WorkbenchRequest>) => void;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WorkbenchRequestEditor({
  collection, request, parentSubCollection, environments, selectedEnvId, onEnvChange,
  onUpdateRequest, appGlobalAuthProfiles,
}: Props) {
  const [activeTab, setActiveTab] = useState<EditorTab>('params');
  const [inputMode, setInputMode] = useState<InputMode>('builder');
  const [sending, setSending] = useState(false);
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [reqNameEditing, setReqNameEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [responseSearch, setResponseSearch] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const handleTreeToggle = useCallback((path: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const {
    response, setResponse,
    responseTime, setResponseTime,
    sendAllResults, setSendAllResults,
    consoleLines, setConsoleLines,
    history, pushHistory, restoreFromHistory, deleteHistoryEntry, clearHistory,
  } = useResponseCache(request.id);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const prevReqIdForUI = useRef<string>(request.id);
  useEffect(() => {
    if (prevReqIdForUI.current !== request.id) {
      prevReqIdForUI.current = request.id;
      setResponseSearch('');
      setSearchMatchIdx(0);
      setInputMode('builder');
      setCurlText('');
      setGeneratedCurl('');
    }
  }, [request.id]);

  const responseTree = useMemo(() => {
    if (!response?.body) return null;
    try { return buildJTree(JSON.parse(response.body), ''); } catch { return null; }
  }, [response?.body]);
  const allTreePaths = useMemo(() => {
    if (!responseTree) return new Set<string>();
    const paths = new Set<string>();
    (function walk(node: JNode, p: string) {
      if (node.children?.length) { paths.add(p); node.children.forEach((c) => walk(c, `${p}/${c.key}`)); }
    })(responseTree, '');
    return paths;
  }, [responseTree]);
  const isAllCollapsed = collapsedSet.size > 0 && collapsedSet.size >= allTreePaths.size;
  const handleCollapseAll = useCallback(() => setCollapsedSet(new Set(allTreePaths)), [allTreePaths]);
  const handleExpandAll = useCallback(() => setCollapsedSet(new Set()), []);
  const searchMatchIdxRef = useRef(searchMatchIdx);
  searchMatchIdxRef.current = searchMatchIdx;
  const handleMatchCountChange = useCallback((count: number) => {
    setSearchMatchCount(count);
    if (searchMatchIdxRef.current >= count) setSearchMatchIdx(Math.max(0, count - 1));
  }, []);

  const queryParams = useMemo(() => {
    if (request.savedQueryParams && request.savedQueryParams.length > 0) {
      return request.savedQueryParams.map(p => ({
        key: p.key, value: p.value, enabled: p.enabled, description: p.description ?? '',
      }));
    }
    const parsed = parseQueryParams(request.url);
    if (parsed.length === 0) return [{ key: '', value: '', enabled: true, description: '' }];
    return parsed.map(kv => ({ ...kv, enabled: true, description: '' }));
  }, [request.url, request.savedQueryParams]);
  const headerCount = useMemo(() => request.headers.filter((h) => h.key.trim()).length, [request.headers]);
  const paramCount = useMemo(() => queryParams.filter(p => p.key.trim() && p.enabled).length, [queryParams]);

  const handleMethodChange = (method: HttpMethod) => onUpdateRequest({ method });

  const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
    const headers = [...request.headers];
    headers[idx] = { ...headers[idx], [field]: val };
    onUpdateRequest({ headers });
  };

  const addHeader = () => onUpdateRequest({ headers: [...request.headers, { key: '', value: '' }] });

  const removeHeader = (idx: number) => {
    const headers = request.headers.filter((_, i) => i !== idx);
    onUpdateRequest({ headers: headers.length > 0 ? headers : [{ key: '', value: '' }] });
  };

  const subColEnvId = useMemo(() => {
    if (!parentSubCollection) return undefined;
    if (parentSubCollection.selectedEnvId) return parentSubCollection.selectedEnvId;
    const matched = environments.find(e => e.name.toLowerCase() === parentSubCollection.name.toLowerCase());
    return matched?.id;
  }, [parentSubCollection, environments]);

  const allKnownBaseUrls = useMemo(() => {
    const urls: string[] = [];
    for (const u of Object.values(collection.baseUrls ?? {})) urls.push(u.replace(/\/+$/, ''));
    if (parentSubCollection?.baseUrls) {
      for (const u of Object.values(parentSubCollection.baseUrls)) urls.push(u.replace(/\/+$/, ''));
    }
    return urls.sort((a, b) => b.length - a.length);
  }, [collection.baseUrls, parentSubCollection?.baseUrls]);

  const stripToRelative = useCallback((url: string): string => {
    if (collection.mode !== 'multi-env') return url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
    const matched = allKnownBaseUrls.find(b => url.startsWith(b));
    if (matched) return url.slice(matched.length) || '/';
    try { return new URL(url).pathname + new URL(url).search + new URL(url).hash; } catch {}
    return url;
  }, [collection.mode, allKnownBaseUrls]);

  const handleUrlChange = useCallback((url: string) => {
    onUpdateRequest({ url: stripToRelative(url) });
  }, [onUpdateRequest, stripToRelative]);

  const handleParamsChange = useCallback((params: ParamEntry[]) => {
    const hasDisabled = params.some(p => !p.enabled && p.key.trim());
    const nonEmpty = params.filter(p => p.key.trim());
    const hasEmptyTrailing = params.length > 0 && !params[params.length - 1].key.trim();
    const toSave = hasEmptyTrailing
      ? [...nonEmpty, { key: '', value: '', enabled: true, description: '' }]
      : nonEmpty;
    onUpdateRequest({
      url: buildUrl(request.url, params),
      savedQueryParams: hasDisabled || toSave.length > 0
        ? toSave.map(p => ({ key: p.key, value: p.value, enabled: p.enabled, description: p.description }))
        : undefined,
    });
  }, [request.url, onUpdateRequest]);

  const relativePath = useMemo(() => stripToRelative(request.url), [request.url, stripToRelative]);

  const displayUrl = useMemo(() => {
    if (collection.mode === 'direct') return relativePath;
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
    const effectiveEnvId = subColEnvId || selectedEnvId;

    let targetBase: string | null = null;
    if (parentSubCollection?.baseUrls) {
      const subBaseUrls = parentSubCollection.baseUrls;
      if (subColEnvId && subBaseUrls[subColEnvId]) {
        targetBase = subBaseUrls[subColEnvId].replace(/\/+$/, '');
      } else {
        const firstBase = Object.values(subBaseUrls)[0];
        if (firstBase) targetBase = firstBase.replace(/\/+$/, '');
      }
    }
    if (!targetBase && effectiveEnvId && collection.baseUrls?.[effectiveEnvId]) {
      targetBase = collection.baseUrls[effectiveEnvId].replace(/\/+$/, '');
    }

    if (!targetBase) return relativePath;
    const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return `${targetBase}${path}`;
  }, [relativePath, collection.mode, collection.baseUrls, selectedEnvId, subColEnvId, parentSubCollection]);

  const asDraftScenario = useCallback((): Scenario => ({
    id: request.id, name: request.name, url: displayUrl,
    method: request.method, headers: request.headers, body: request.body,
    bodyType: request.bodyType, bodyForm: request.bodyForm,
    auth: request.auth, validation: { mode: 'none' },
  }), [request, displayUrl]);

  const resolveEffectiveAuth = useCallback((envId?: string): AuthConfig => {
    if (request.auth?.type !== 'none' && request.auth?.type !== 'inherit') return request.auth;
    if (parentSubCollection?.auth?.type && parentSubCollection.auth.type !== 'none' && parentSubCollection.auth.type !== 'inherit') {
      return parentSubCollection.auth;
    }
    if (envId && collection.authPerEnv?.[envId]) {
      const envAuth = collection.authPerEnv[envId];
      if (envAuth.type && envAuth.type !== 'none') return envAuth;
    }
    if (collection.auth?.type && collection.auth.type !== 'none') return collection.auth;
    return { type: 'none' };
  }, [request.auth, parentSubCollection?.auth, collection.auth, collection.authPerEnv]);

  const buildRequestHeaders = useCallback(async (scenario: Scenario, contentType: string | null, envId?: string): Promise<Record<string, string>> => {
    const h: Record<string, string> = {};
    for (const kv of scenario.headers) { if (kv.key.trim()) h[kv.key.trim()] = kv.value; }
    if (contentType) {
      if (contentType.startsWith('multipart/form-data')) h['Content-Type'] = contentType;
      else if (!h['Content-Type']) h['Content-Type'] = contentType;
    }
    const auth = resolveEffectiveAuth(envId);
    if (auth?.type === 'oauth2' && auth.tokenUrl) {
      const token = await acquireOAuth2Token(auth);
      h['Authorization'] = `Bearer ${token}`;
    } else if (auth?.type === 'bearer' && auth.token) {
      h['Authorization'] = `${auth.prefix || 'Bearer'} ${auth.token}`;
    } else if (auth?.type === 'basic' && auth.username) {
      h['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password || ''}`)}`;
    } else if (auth?.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === 'header') {
      h[auth.apiKeyName] = auth.apiKeyValue;
    }
    return h;
  }, [resolveEffectiveAuth]);


  const handleCurlImport = useCallback(() => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    const { id: _discardId, validation: _discardVal, name: parsedName, ...parsedFields } = parsed as Scenario;
    const patch: Partial<typeof parsedFields & { name?: string }> = {
      ...parsedFields,
      url: stripToRelative(parsedFields.url),
    };
    if (!request.name.trim() && parsedName) patch.name = parsedName;
    onUpdateRequest(patch);
    setInputMode('builder'); setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') setActiveTab('body');
  }, [curlText, onUpdateRequest, stripToRelative, request.name]);

  const triggerCurlGeneration = useCallback(async () => {
    if (!request.url.trim()) { setGeneratedCurl(''); return; }
    setCurlGenerating(true);
    try {
      const cmd = await buildCurlCommand(asDraftScenario(), resolveEffectiveAuth());
      setGeneratedCurl(cmd);
    } catch (err) { setGeneratedCurl(`# Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setCurlGenerating(false); }
  }, [asDraftScenario, resolveEffectiveAuth, request.url]);

  const handleCopyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generatedCurl);
    setCurlCopied(true); setTimeout(() => setCurlCopied(false), 2000);
  }, [generatedCurl]);

  const handleJsonImport = useCallback(() => {
    pickJsonFile((raw) => {
      const data = unwrapImport(raw) as Record<string, unknown>;
      if (!data.name || !data.url || !data.method) { alert('Invalid file: expected a request with name, url, and method.'); return; }
      const imported = data as unknown as WorkbenchRequest;
      onUpdateRequest({ name: imported.name, method: imported.method, url: stripToRelative(imported.url),
        headers: imported.headers || [{ key: '', value: '' }], body: imported.body || '',
        bodyType: imported.bodyType, bodyForm: imported.bodyForm, auth: imported.auth || { type: 'inherit' },
      });
      setInputMode('builder');
    });
  }, [onUpdateRequest, stripToRelative]);

  const handleJsonExport = useCallback(() => {
    const payload = { _exportMeta: { type: 'workbench-request', version: 1, exportedAt: new Date().toISOString() },
      data: { name: request.name, method: request.method, url: request.url, headers: request.headers,
        body: request.body, bodyType: request.bodyType, bodyForm: request.bodyForm, auth: request.auth },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${request.name || 'request'}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [request]);

  const handleSend = useCallback(async () => {
    setSending(true); setResponse(null); setSendAllResults(null);
    const log: ConsoleLine[] = [];
    const info = (t: string) => log.push({ prefix: '*', text: t });
    const out = (t: string) => log.push({ prefix: '>', text: t });
    const inp = (t: string) => log.push({ prefix: '<', text: t });

    let sendUrl = '';
    let sendMethod = '';

    try {
      const scenario = asDraftScenario();
      sendMethod = scenario.method;

      if (!scenario.url.startsWith('http://') && !scenario.url.startsWith('https://')) {
        const envId = subColEnvId || selectedEnvId;
        let base: string | null = null;
        if (parentSubCollection?.baseUrls) {
          const subBaseUrls = parentSubCollection.baseUrls;
          if (envId && subBaseUrls[envId]) {
            base = subBaseUrls[envId].replace(/\/+$/, '');
          } else {
            const firstBase = Object.values(subBaseUrls)[0];
            if (firstBase) base = firstBase.replace(/\/+$/, '');
          }
        }
        if (!base && envId && collection.baseUrls?.[envId]) {
          base = collection.baseUrls[envId].replace(/\/+$/, '');
        }
        if (base) {
          const path = scenario.url.startsWith('/') ? scenario.url : `/${scenario.url}`;
          scenario.url = `${base}${path}`;
        } else {
          const errMsg = collection.mode === 'multi-env'
            ? 'Cannot send: no base URL configured for the selected environment. Edit collection settings to add hostnames.'
            : 'Cannot send: URL must be a full URL (e.g. https://api.example.com/...).';
          info(`ERROR: ${errMsg}`);
          setConsoleLines(log);
          setResponse({ status: 0, statusText: 'Error', headers: {}, body: errMsg, error: errMsg });
          setSending(false);
          return;
        }
      }
      sendUrl = scenario.url;

      const { body: reqBody, contentType } = serializeWithContentType(scenario);

      log.push({ prefix: '', text: `Preparing request to ${scenario.url}` });
      info(`Current time is ${new Date().toISOString()}`);

      const effectiveEnvId = subColEnvId || selectedEnvId;
      const auth = resolveEffectiveAuth(effectiveEnvId);
      if (auth.type === 'oauth2' && auth.tokenUrl) {
        info(`Acquiring OAuth2 token from ${auth.tokenUrl}`);
        info(`Client ID: ${auth.clientId}`);
        info(`Grant type: client_credentials`);
      }

      const headers = await buildRequestHeaders(scenario, contentType, effectiveEnvId);

      if (auth.type === 'oauth2') info('OAuth2 token acquired successfully');
      if (auth.type === 'bearer') info('Using Bearer token authentication');
      if (auth.type === 'basic') info('Using Basic authentication');
      if (auth.type === 'apikey') info(`Using API Key in ${auth.apiKeyIn ?? 'header'}`);

      let hostname = '';
      try { hostname = new URL(scenario.url).hostname; } catch {}
      if (hostname) info(`Connecting to ${hostname}...`);
      info('Using browser fetch API');
      if (scenario.url.startsWith('https')) info('SSL/TLS handled by browser');

      log.push({ prefix: '', text: '' });
      out(`${scenario.method} ${scenario.url.replace(/https?:\/\/[^/]+/, '')} HTTP/1.1`);
      if (hostname) out(`Host: ${hostname}`);
      for (const [k, v] of Object.entries(headers)) {
        out(`${k}: ${v}`);
      }
      out('');

      if (reqBody && reqBody.length > 0) {
        info(`Request body: ${formatBytes(reqBody.length)}`);
        if (reqBody.length <= 500) {
          log.push({ prefix: '#', text: reqBody });
        } else {
          log.push({ prefix: '#', text: reqBody.slice(0, 500) + `... (${reqBody.length - 500} more bytes)` });
        }
        log.push({ prefix: '', text: '' });
      }

      const t0 = performance.now();
      const resp = await httpFetch(scenario.url, scenario.method, headers, reqBody);
      const elapsed = Math.round(performance.now() - t0);

      log.push({ prefix: '', text: '' });
      inp(`HTTP/1.1 ${resp.status} ${resp.statusText}`);
      for (const [k, v] of Object.entries(resp.headers)) {
        inp(`${k}: ${v}`);
      }
      inp('');

      info(`Received ${formatBytes(resp.body?.length ?? 0)} in ${elapsed} ms`);
      info(`Response status: ${resp.status} ${resp.statusText}`);

      setResponse(resp); setResponseTime(elapsed);
      setConsoleLines(log);

      const hid = pushHistory({ timestamp: Date.now(), method: sendMethod, url: sendUrl, response: resp, responseTime: elapsed, consoleLines: log });
      setActiveHistoryId(hid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.push({ prefix: '', text: '' });
      info(`ERROR: ${msg}`);
      const errResp = { status: 0, statusText: 'Error', headers: {} as Record<string, string>, body: msg, error: msg };
      setResponse(errResp);
      setResponseTime(0);
      setConsoleLines(log);

      const hid = pushHistory({ timestamp: Date.now(), method: sendMethod || 'GET', url: sendUrl || request.url, response: errResp, responseTime: 0, consoleLines: log });
      setActiveHistoryId(hid);
    }
    setSending(false);
  }, [asDraftScenario, buildRequestHeaders, resolveEffectiveAuth, subColEnvId, selectedEnvId, collection, parentSubCollection, pushHistory, request.url]);

  const handleDraftChange = useCallback((draft: Scenario) => {
    onUpdateRequest({ body: draft.body, bodyType: draft.bodyType, bodyForm: draft.bodyForm });
  }, [onUpdateRequest]);

  const draftScenario = asDraftScenario();
  const responseHeaderCount = response ? Object.keys(response.headers).length : 0;

  return (
    <div className="wb-editor">
      {/* ── Request name ── */}
      <div className="wb-req-name-bar">
        {reqNameEditing ? (
          <input ref={nameInputRef} className="wb-req-name-input" value={request.name}
            onChange={(e) => onUpdateRequest({ name: e.target.value })}
            onBlur={() => setReqNameEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setReqNameEditing(false); }} autoFocus />
        ) : (
          <span className="wb-req-name-display" onClick={() => setReqNameEditing(true)}>
            {request.name || 'Untitled Request'} <span className="wb-edit-hint">&#9998;</span>
          </span>
        )}
      </div>

      {/* ── URL bar + status ── */}
      <div className="wb-url-row">
        <select className="wb-method-select" value={request.method}
          onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
          style={{ color: METHOD_COLORS[request.method] }}>
          {METHODS.map((m) => <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>)}
        </select>
        <input className="wb-url-input"
          value={relativePath}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={collection.mode === 'multi-env' ? '/v1/endpoint' : 'https://api.example.com/v1/endpoint'} />
        <button className="wb-send-btn" onClick={handleSend} disabled={sending}>
          {sending ? '...' : 'Send'}
        </button>
        <div className="wb-status-row">
          {response && !sending && (
            <>
              <span className={`wb-status-pill ${response.status >= 200 && response.status < 300 ? 'success' : response.status >= 400 ? 'error' : 'warn'}`}>
                {response.status} {response.statusText}
              </span>
              <span className="wb-stat">{responseTime} ms</span>
              <span className="wb-stat">{formatBytes(response.body?.length ?? 0)}</span>
            </>
          )}
          <ResponseHistoryDropdown
            history={history}
            currentEntryId={activeHistoryId}
            onRestore={(id) => { restoreFromHistory(id); setActiveHistoryId(id); }}
            onDeleteEntry={(id) => {
              deleteHistoryEntry(id);
              if (id === activeHistoryId) {
                setActiveHistoryId(null);
                setResponse(null);
              }
            }}
            onClearHistory={() => { clearHistory(); setActiveHistoryId(null); }}
          />
        </div>
      </div>

      {/* ── Env bar + resolved URL (multi-env only) ── */}
      {collection.mode === 'multi-env' && (environments.length > 0 || parentSubCollection) && (() => {
        const envName = subColEnvId
          ? environments.find(e => e.id === subColEnvId)?.name
          : parentSubCollection?.name ?? null;
        const hasBaseUrls = Object.keys(collection.baseUrls ?? {}).length > 0
          || Object.keys(parentSubCollection?.baseUrls ?? {}).length > 0;
        return (
        <div className="wb-env-bar">
          <span className="wb-env-bar-label">Env:</span>
          {parentSubCollection ? (
            <span className="wb-env-pill active pinned">{envName ?? parentSubCollection.name}</span>
          ) : (
            <div className="wb-env-pills">
              {environments.map((env) => (
                <button key={env.id} className={`wb-env-pill ${selectedEnvId === env.id ? 'active' : ''}`}
                  onClick={() => onEnvChange(env.id)}>{env.name}</button>
              ))}
            </div>
          )}
          {displayUrl !== relativePath && (
            <>
              <span className="wb-resolved-url-arrow">&#8594;</span>
              <span className="wb-resolved-url-full" title={displayUrl}>{displayUrl}</span>
            </>
          )}
          {!hasBaseUrls && (
            <span className="wb-env-hint">Base URLs not configured — edit collection or sub-collection to add hostnames</span>
          )}
        </div>
        );
      })()}

      {/* ── Split pane: request (left) + response (right) ── */}
      <div className="wb-split-pane">

        {/* LEFT: Request editor */}
        <div className="wb-pane-left">
          {/* Tabs row with action menu */}
          <div className="wb-tabs">
            <button className={`wb-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => { setActiveTab('params'); setInputMode('builder'); }}>
              Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
            </button>
            <button className={`wb-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => { setActiveTab('body'); setInputMode('builder'); }}>Body</button>
            <button className={`wb-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => { setActiveTab('auth'); setInputMode('builder'); }}>
              Auth {request.auth.type !== 'none' && request.auth.type !== 'inherit' && <span className="wb-tab-dot" />}
            </button>
            <button className={`wb-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => { setActiveTab('headers'); setInputMode('builder'); }}>
              Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
            </button>

            <div className="wb-action-menu-wrapper">
              <button className="wb-action-menu-btn" onClick={() => setShowActionMenu(!showActionMenu)}
                title="Import / Export">&#9662;</button>
              {showActionMenu && (
                <div className="wb-action-dropdown" onClick={() => setShowActionMenu(false)}>
                  <button onClick={() => setInputMode('curlImport')}>cURL Import</button>
                  <button onClick={() => { setInputMode('curlExport'); void triggerCurlGeneration(); }}>cURL Export</button>
                  <div className="wb-dropdown-divider" />
                  <button onClick={handleJsonImport}>Import JSON</button>
                  <button onClick={handleJsonExport}>Export JSON</button>
                </div>
              )}
            </div>
          </div>

          {/* Tab / cURL content */}
          <div className="wb-tab-content">
            {/* cURL Import panel */}
            {inputMode === 'curlImport' && (
              <div className="wb-curl-panel">
                <label className="wb-curl-label">Paste your cURL command</label>
                <textarea className="wb-curl-textarea" rows={8} autoFocus value={curlText}
                  onChange={(e) => setCurlText(e.target.value)}
                  placeholder={`curl -X POST https://api.example.com \\
  -H 'Authorization: Bearer token' \\
  -d '{"key": "value"}'`} />
                <div className="wb-curl-actions">
                  <button className="btn btn-primary" disabled={!curlText.trim()} onClick={handleCurlImport}>Import &amp; Apply</button>
                  <button className="btn btn-ghost" onClick={() => setInputMode('builder')}>Cancel</button>
                </div>
              </div>
            )}

            {/* cURL Export panel */}
            {inputMode === 'curlExport' && (
              <div className="wb-curl-panel">
                <label className="wb-curl-label">Generated cURL command</label>
                {request.url.trim() ? (<>
                  <textarea className="wb-curl-textarea wb-curl-export" rows={10} readOnly
                    value={curlGenerating ? 'Generating...' : generatedCurl}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                  <div className="wb-curl-actions">
                    <button className="btn btn-primary" disabled={curlGenerating || !generatedCurl} onClick={handleCopyToClipboard}>
                      {curlCopied ? 'Copied!' : 'Copy'}</button>
                    <button className="btn" disabled={curlGenerating} onClick={() => void triggerCurlGeneration()}>Refresh</button>
                    <button className="btn btn-ghost" onClick={() => setInputMode('builder')}>Close</button>
                  </div>
                </>) : <div className="wb-curl-empty">Set a URL first.</div>}
              </div>
            )}

            {/* Builder content */}
            {inputMode === 'builder' && (<>
              {activeTab === 'params' && <ParamsEditor params={queryParams} onChange={handleParamsChange} />}
              {activeTab === 'body' && <BodyEditor draft={draftScenario} onDraftChange={handleDraftChange} />}

              {activeTab === 'headers' && (
                <div className="wb-headers-editor">
                  <div className="wb-kv-toolbar">
                    <button className="btn btn-sm" onClick={addHeader}>+ Add</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => onUpdateRequest({ headers: [{ key: '', value: '' }] })}>Delete all</button>
                  </div>
                  {request.headers.map((h, i) => (
                    <div key={i} className="wb-header-row">
                      <input className="wb-input" value={h.key} onChange={(e) => handleHeaderChange(i, 'key', e.target.value)} placeholder="Header name" />
                      <input className="wb-input" value={h.value} onChange={(e) => handleHeaderChange(i, 'value', e.target.value)} placeholder="Value" />
                      <button className="wb-icon-btn danger" onClick={() => removeHeader(i)}>&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'auth' && (
                <RequestAuthEditor
                  auth={request.auth}
                  collection={collection}
                  globalAuthProfiles={appGlobalAuthProfiles}
                  onUpdate={(auth) => onUpdateRequest({ auth })}
                />
              )}
            </>)}
          </div>
        </div>

        {/* RIGHT: Response panel */}
        <div className="wb-pane-right">
          {/* Response tabs */}
          <div className="wb-tabs wb-resp-tabs">
            <button className={`wb-tab ${responseTab === 'preview' ? 'active' : ''}`} onClick={() => setResponseTab('preview')}>Preview</button>
            <button className={`wb-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')}>
              Headers {responseHeaderCount > 0 && <span className="tab-badge">{responseHeaderCount}</span>}
            </button>
            <button className={`wb-tab ${responseTab === 'console' ? 'active' : ''}`} onClick={() => setResponseTab('console')}>
              Console
            </button>
          </div>

          {responseTab === 'preview' && (
            <div className="wb-resp-search">
              <button
                className="wb-tree-toggle-btn"
                title={isAllCollapsed ? 'Expand All' : 'Collapse All'}
                onClick={isAllCollapsed ? handleExpandAll : handleCollapseAll}
              >{isAllCollapsed ? '⊞' : '⊟'}</button>
              <input
                className="wb-resp-search-input"
                type="text"
                placeholder="Search response..."
                value={responseSearch}
                onChange={(e) => { setResponseSearch(e.target.value); setSearchMatchIdx(0); }}
              />
              {responseSearch && (
                <>
                  <span className="wb-resp-search-count">
                    {searchMatchCount > 0 ? `${searchMatchIdx + 1}/${searchMatchCount}` : 'No match'}
                  </span>
                  <button className="wb-resp-search-nav" title="Previous" disabled={searchMatchCount === 0}
                    onClick={() => setSearchMatchIdx(prev => prev > 0 ? prev - 1 : searchMatchCount - 1)}>&#9650;</button>
                  <button className="wb-resp-search-nav" title="Next" disabled={searchMatchCount === 0}
                    onClick={() => setSearchMatchIdx(prev => prev < searchMatchCount - 1 ? prev + 1 : 0)}>&#9660;</button>
                  <button className="wb-resp-search-clear" onClick={() => { setResponseSearch(''); setSearchMatchIdx(0); setSearchMatchCount(0); }}>×</button>
                </>
              )}
            </div>
          )}

          <div className="wb-resp-content">
            {sending && (
              <div className="wb-response-loading"><div className="wb-spinner" /> Sending...</div>
            )}

            {!sending && !response && !sendAllResults && (
              <div className="wb-response-placeholder">Click <strong>Send</strong> to get a response</div>
            )}

            {!sending && response && !sendAllResults && responseTab === 'preview' && (
              <JsonPreview body={response.body} error={response.error} search={responseSearch}
                collapsedSet={collapsedSet} onToggle={handleTreeToggle} prebuiltTree={responseTree}
                currentMatchIdx={searchMatchIdx} onMatchCountChange={handleMatchCountChange} />
            )}

            {!sending && response && !sendAllResults && responseTab === 'headers' && (
              <div className="wb-resp-headers-list">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="wb-resp-header-row">
                    <span className="wb-resp-header-key">{k}</span>
                    <span className="wb-resp-header-val">{v}</span>
                  </div>
                ))}
                {Object.keys(response.headers).length === 0 && (
                  <div className="wb-response-placeholder">No response headers</div>
                )}
              </div>
            )}

            {responseTab === 'console' && (
              <ConsoleLog lines={consoleLines} />
            )}

            {!sending && sendAllResults && responseTab !== 'console' && (
              <div className="wb-multi-results">
                {sendAllResults.map((r, i) => <MultiEnvResultRow key={i} {...r} />)}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

