import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type {
  RequestCollection, RequestItem, RequestEnv,
  GlobalAuthProfile, HttpMethod, Scenario, AuthConfig,
} from '../../../shared/types';
import { httpFetch } from '../../../shared/utils/httpClient';
import { serializeWithContentType } from '../../../shared/utils/bodySerializer';
import { parseCurl } from '../../../shared/utils/curlParser';
import { buildCurlCommand } from '../../../shared/utils/curlGenerator';
import { applyAuthHeaders } from '../../../shared/utils/applyAuthHeaders';
import { pickJsonFile, unwrapImport } from '../../scenarios/utils/testEditorUtils';
import { useResponseCache } from '../hooks/useResponseCache';
import type { ConsoleLine } from '../hooks/useResponseCache';
import { buildDisplayUrl, resolveFullSendUrl } from '../utils/requestUrlResolver';
import { formatBytes, toErrorMessage } from '../../../shared/utils/helpers';
import { HttpMethodSelect } from './HttpMethodSelect';
import { saveFile } from '../../../shared/utils/fileSaver';
import type { UrlResolverContext } from '../utils/requestUrlResolver';
import { BodyEditor } from './BodyEditor';
import { ParamsEditor, fromParamEntries } from './ParamsEditor';
import type { ParamEntry } from './ParamsEditor';
import { KeyValueEditor } from '../../websocket/KeyValueEditor';
import type { WsKeyValueEntry } from '../../../shared/websocket/types';
import { PathParamsEditor } from './PathParamsEditor';
import type { PathParamEntry } from './PathParamsEditor';
import { resolvePathParamUrl } from '../utils/pathParamResolver';
import RequestAuthEditor from './RequestAuthEditor';
import JsonPreview, { buildJTreeFromBody, collectJTreePaths } from './JsonTreePreview';
import ConsoleLog from './ConsoleLog';
import MultiEnvResultRow from './MultiEnvResultRow';
import { ResponseHistoryDropdown } from './ResponseHistoryDropdown';
import { useJsonTreeCollapseState, useMatchCountChange } from '../../../shared/hooks/useJsonTreeCollapseState';

import { createSnapshot, restoreFromVersion, deleteVersion, renameVersion } from '../utils/requestDefinitionVersioning';
import RequestDefinitionVersionPanel from './RequestDefinitionVersionPanel';
import { useToast } from '../../../shared/hooks/useToast';
import RequestDefinitionVersionDiff from './RequestDefinitionVersionDiff';
import type { RequestDefinitionVersion } from '../../../shared/types';
import { SpecVersionSwitcher } from './SpecVersionSwitcher';
import { SpecVersionCompareModal } from './SpecVersionCompareModal';
import RequestCatalogApiInfoDrawer from './RequestCatalogApiInfoDrawer';
import { parseQueryParams, rebuildUrlEncoded } from '../../../shared/utils/queryParams';
import ResponseBodySearchBar from './ResponseBodySearchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';

type EditorTab = 'params' | 'headers' | 'body' | 'auth' | 'history';
type InputMode = 'builder' | 'curlImport' | 'curlExport';
type ResponseTab = 'preview' | 'headers' | 'console';

interface Props {
  collection: RequestCollection;
  request: RequestItem;
  parentSubCollection?: import('../../../shared/types').RequestFolder;
  environments: RequestEnv[];
  appMicroservices?: import('../../../shared/types').Microservice[];
  appEnvironments?: import('../../../shared/types').Environment[];
  selectedEnvId?: string;
  onEnvChange: (envId: string | undefined) => void;
  onUpdateRequest: (patch: Partial<RequestItem>) => void;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  onSendToHarness?: () => void;
  isInHarness?: boolean;
}

function buildUrl(base: string, params: ParamEntry[]): string {
  return rebuildUrlEncoded(base, fromParamEntries(params));
}

export default function RequestEditor({
  collection, request, parentSubCollection, environments, appMicroservices, appEnvironments,
  selectedEnvId, onEnvChange, onUpdateRequest, appGlobalAuthProfiles, onSendToHarness, isInHarness,
}: Props) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<EditorTab>('params');
  const [inputMode, setInputMode] = useState<InputMode>('builder');
  const [sending, setSending] = useState(false);
  const [responseTab, setResponseTab] = useState<ResponseTab>('preview');
  const [reqNameEditing, setReqNameEditing] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ older: RequestDefinitionVersion; newer: RequestDefinitionVersion } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [showApiInfo, setShowApiInfo] = useState(false);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const {
    searchQuery: responseSearch,
    setSearchQuery: setResponseSearch,
    currentMatchIndex: searchMatchIdx,
    setCurrentMatchIndex: setSearchMatchIdx,
    goNext: goNextSearchMatch,
    goPrev: goPrevSearchMatch,
    clear: clearResponseSearch,
  } = useSearchMatchNavigation(searchMatchCount);
  const { collapsedSet, handleTreeToggle, handleCollapseAll: collapseAll, handleExpandAll } = useJsonTreeCollapseState();

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
      setInputMode('builder');
      setCurlText('');
      setGeneratedCurl('');
      setShowApiInfo(false);
    }
  }, [request.id, setResponseSearch]);

  const responseTree = useMemo(() => {
    return buildJTreeFromBody(response?.body);
  }, [response?.body]);
  const allTreePaths = useMemo(() => {
    if (!responseTree) return new Set<string>();
    return new Set<string>(['', ...collectJTreePaths(responseTree, '')]);
  }, [responseTree]);
  const handleCollapseAll = () => collapseAll(allTreePaths);
  const searchMatchIdxRef = useRef(searchMatchIdx);
  searchMatchIdxRef.current = searchMatchIdx;
  const handleMatchCountChange = useMatchCountChange(setSearchMatchCount, setSearchMatchIdx, searchMatchIdxRef);

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

  const pathParams: PathParamEntry[] = useMemo(() => {
    return request.savedPathParams ?? [];
  }, [request.savedPathParams]);

  const headerCount = useMemo(() => request.headers.filter((h) => h.key.trim() && h.enabled !== false).length, [request.headers]);
  const paramCount = useMemo(() => queryParams.filter(p => p.key.trim() && p.enabled).length + pathParams.length, [queryParams, pathParams]);

  const handleMethodChange = (method: HttpMethod) => onUpdateRequest({ method });

  const headerEntries: WsKeyValueEntry[] = useMemo(
    () => request.headers.map((h) => ({ key: h.key, value: h.value, enabled: h.enabled !== false })),
    [request.headers],
  );

  const handleHeadersChange = useCallback((entries: WsKeyValueEntry[]) => {
    onUpdateRequest({
      headers: entries.map((e) =>
        e.enabled === false ? { key: e.key, value: e.value, enabled: false } : { key: e.key, value: e.value },
      ),
    });
  }, [onUpdateRequest]);

  const subColEnvId = useMemo(() => {
    if (!parentSubCollection) return undefined;
    if (parentSubCollection.selectedEnvId) return parentSubCollection.selectedEnvId;
    const matched = environments.find(e => e.name.toLowerCase() === parentSubCollection.name.toLowerCase());
    return matched?.id;
  }, [parentSubCollection, environments]);

  const linkedSvc = useMemo(
    () => collection.microserviceId ? appMicroservices?.find(s => s.id === collection.microserviceId) : undefined,
    [collection.microserviceId, appMicroservices],
  );

  const resolvedColBaseUrls = useMemo(() => {
    if (linkedSvc) {
      const allSvcEnvs = [...(appEnvironments ?? []), ...(linkedSvc.customEnvs ?? [])];
      const mapped: Record<string, string> = {};
      for (const [appEnvId, url] of Object.entries(linkedSvc.baseUrls)) {
        const appEnv = allSvcEnvs.find(e => e.id === appEnvId);
        if (!appEnv) continue;
        const wbEnv = environments.find(e => e.name === appEnv.name);
        if (wbEnv) mapped[wbEnv.id] = url as string;
      }
      return mapped;
    }
    return collection.baseUrls ?? {};
  }, [linkedSvc, collection.baseUrls, environments, appEnvironments]);

  const allKnownBaseUrls = useMemo(() => {
    const urls: string[] = [];
    for (const u of Object.values(resolvedColBaseUrls)) urls.push(u.replace(/\/+$/, ''));
    if (parentSubCollection?.baseUrls) {
      for (const u of Object.values(parentSubCollection.baseUrls)) urls.push((u as string).replace(/\/+$/, ''));
    }
    return urls.sort((a, b) => b.length - a.length);
  }, [resolvedColBaseUrls, parentSubCollection?.baseUrls]);

  const stripToRelative = useCallback((url: string): string => {
    if (collection.mode !== 'multi-env') return url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return url;
    const matched = allKnownBaseUrls.find(b => url.startsWith(b));
    if (matched) return url.slice(matched.length) || '/';
    try { return new URL(url).pathname + new URL(url).search + new URL(url).hash; } catch { /* intentionally empty */ }
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

  const handlePathParamsChange = useCallback((params: PathParamEntry[]) => {
    const originalPath = request.catalogMeta?.originalPath;
    if (!originalPath) {
      onUpdateRequest({ savedPathParams: params.length > 0 ? params : undefined });
      return;
    }

    const newUrl = resolvePathParamUrl(request.url, originalPath, params);
    const stripped = stripToRelative(newUrl);
    onUpdateRequest({
      url: stripped,
      savedPathParams: params.length > 0 ? params : undefined,
    });
  }, [request.url, request.catalogMeta, onUpdateRequest, stripToRelative]);

  const relativePath = useMemo(() => stripToRelative(request.url), [request.url, stripToRelative]);

  const urlCtx: UrlResolverContext = useMemo(() => ({
    collectionMode: collection.mode,
    resolvedColBaseUrls,
    parentSubCollection,
    subColEnvId,
    selectedEnvId,
  }), [collection.mode, resolvedColBaseUrls, parentSubCollection, subColEnvId, selectedEnvId]);

  const displayUrl = useMemo(
    () => buildDisplayUrl(relativePath, urlCtx),
    [relativePath, urlCtx],
  );

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
    if (linkedSvc?.authProfileIds && envId) {
      const wbEnv = environments.find(e => e.id === envId);
      const appEnv = wbEnv ? appEnvironments?.find(ae => ae.name === wbEnv.name) : undefined;
      const lookupId = appEnv?.id ?? envId;
      const profileId = linkedSvc.authProfileIds[lookupId];
      if (profileId) {
        const profile = appGlobalAuthProfiles.find(p => p.id === profileId);
        if (profile) return { ...profile.auth, globalProfileId: profile.id };
      }
    }
    return { type: 'none' };
  }, [request.auth, parentSubCollection?.auth, collection.auth, collection.authPerEnv, linkedSvc, appGlobalAuthProfiles, environments, appEnvironments]);

  const buildRequestHeaders = useCallback(async (scenario: Scenario, contentType: string | null, envId?: string): Promise<Record<string, string>> => {
    const h: Record<string, string> = {};
    for (const kv of scenario.headers) {
      if (kv.enabled === false) continue;
      if (kv.key.trim()) h[kv.key.trim()] = kv.value;
    }
    if (contentType) {
      if (contentType.startsWith('multipart/form-data')) h['Content-Type'] = contentType;
      else if (!h['Content-Type']) h['Content-Type'] = contentType;
    }
    const auth = resolveEffectiveAuth(envId);
    if (auth && auth.type !== 'none') {
      await applyAuthHeaders(auth, h);
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
      method: parsedFields.method as HttpMethod,
    };
    if (!request.name.trim() && parsedName) patch.name = parsedName;
    onUpdateRequest(patch as Partial<RequestItem>);
    setInputMode('builder'); setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') setActiveTab('body');
  }, [curlText, onUpdateRequest, stripToRelative, request.name]);

  const triggerCurlGeneration = useCallback(async () => {
    if (!request.url.trim()) { setGeneratedCurl(''); return; }
    setCurlGenerating(true);
    try {
      const effectiveEnvId = subColEnvId || selectedEnvId;
      const cmd = await buildCurlCommand(asDraftScenario(), resolveEffectiveAuth(effectiveEnvId));
      setGeneratedCurl(cmd);
    } catch (err) { setGeneratedCurl(`# Error: ${toErrorMessage(err)}`); }
    finally { setCurlGenerating(false); }
  }, [asDraftScenario, resolveEffectiveAuth, request.url, subColEnvId, selectedEnvId]);

  const handleCopyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(generatedCurl);
    setCurlCopied(true); setTimeout(() => setCurlCopied(false), 2000);
  }, [generatedCurl]);

  const handleJsonImport = useCallback(() => {
    pickJsonFile((raw) => {
      const data = unwrapImport(raw) as Record<string, unknown>;
      if (!data.name || !data.url || !data.method) { toast.show('error', 'Invalid file', 'Expected a request with name, url, and method.'); return; }
      const imported = data as unknown as RequestItem;
      onUpdateRequest({ name: imported.name, method: imported.method, url: stripToRelative(imported.url),
        headers: imported.headers || [{ key: '', value: '' }], body: imported.body || '',
        bodyType: imported.bodyType, bodyForm: imported.bodyForm, auth: imported.auth || { type: 'inherit' },
      });
      setInputMode('builder');
    });
  }, [onUpdateRequest, stripToRelative, toast]);

  const handleJsonExport = useCallback(async () => {
    const payload = { _exportMeta: { type: 'requests-request', version: 1, exportedAt: new Date().toISOString() },
      data: { name: request.name, method: request.method, url: request.url, headers: request.headers,
        body: request.body, bodyType: request.bodyType, bodyForm: request.bodyForm, auth: request.auth },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const filename = `${request.name || 'request'}.json`;
    await saveFile(blob, { filename, mimeType: 'application/json', description: 'JSON file' });
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

      {
        const { url: resolved, error: urlError } = resolveFullSendUrl(scenario.url, urlCtx);
        if (urlError) {
          info(`ERROR: ${urlError}`);
          setConsoleLines(log);
          setResponse({ status: 0, statusText: 'Error', headers: {}, body: urlError, error: urlError });
          setSending(false);
          return;
        }
        scenario.url = resolved;
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
      try { hostname = new URL(scenario.url).hostname; } catch { /* intentionally empty */ }
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
      const msg = toErrorMessage(err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asDraftScenario, buildRequestHeaders, resolveEffectiveAuth, urlCtx, pushHistory, request.url]);

  const handleDraftChange = useCallback((draft: Scenario) => {
    onUpdateRequest({ body: draft.body, bodyType: draft.bodyType, bodyForm: draft.bodyForm });
  }, [onUpdateRequest]);

  const draftScenario = asDraftScenario();
  const responseHeaderCount = response ? Object.keys(response.headers).length : 0;

  return (
    <>
    <div className="req-editor" data-testid="req-editor">
      {/* ── Request name ── */}
      <div className="req-req-name-bar">
        {reqNameEditing ? (
          <input ref={nameInputRef} className="req-req-name-input" value={request.name}
            onChange={(e) => onUpdateRequest({ name: e.target.value })}
            onBlur={() => setReqNameEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setReqNameEditing(false); }} autoFocus />
        ) : (
          <span className="req-req-name-display" onClick={() => setReqNameEditing(true)}>
            {request.name || 'Untitled Request'} <span className="req-edit-hint">&#9998;</span>
          </span>
        )}
        {isInHarness && (
          <span className="req-req-harness-badge" title="Promoted to Harness">IN HARNESS</span>
        )}
        <div className="req-name-bar-actions">
          {request.catalogMeta && (
            <button
              className={`req-api-info-btn ${showApiInfo ? 'active' : ''}`}
              onClick={() => setShowApiInfo(!showApiInfo)}
              title={showApiInfo ? 'Hide API Info' : 'Show API Info'}
            >&#9432; API Info</button>
          )}
          <SpecVersionSwitcher request={request} onUpdateRequest={onUpdateRequest} onCompare={() => setShowVersionCompare(true)} />
          {onSendToHarness && (
            <button className="req-send-harness-btn" data-testid="req-send-harness-btn" onClick={onSendToHarness} title="Send to Harness as a test">
              Send to Harness
            </button>
          )}
        </div>
      </div>

      {/* ── URL bar + status ── */}
      <div className="req-url-row">
        <HttpMethodSelect
          value={request.method}
          onChange={(m) => handleMethodChange(m as HttpMethod)}
        />
        <input className="req-url-input"
          value={relativePath}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={collection.mode === 'multi-env' ? '/v1/endpoint' : 'https://api.example.com/v1/endpoint'}
          data-testid="req-url-input" />
        <button className="req-send-btn" onClick={handleSend} disabled={sending} data-testid="req-send-btn">
          {sending ? '...' : 'Send'}
        </button>
        <div className="req-status-row">
          {response && !sending && (
            <>
              <span className={`req-status-pill ${response.status >= 200 && response.status < 300 ? 'success' : response.status >= 400 ? 'error' : 'warn'}`} data-testid="req-status-pill">
                {response.status} {response.statusText}
              </span>
              <span className="req-stat" data-testid="req-response-time">{responseTime} ms</span>
              <span className="req-stat" data-testid="req-response-size">{formatBytes(response.body?.length ?? 0)}</span>
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
        const hasBaseUrls = Object.keys(resolvedColBaseUrls).length > 0
          || Object.keys(parentSubCollection?.baseUrls ?? {}).length > 0;
        return (
        <div className="req-env-bar" data-testid="req-env-bar">
          <span className="req-env-bar-label">Env:</span>
          {parentSubCollection ? (
            <span className="req-env-pill active pinned" data-testid="req-env-pill">{envName ?? parentSubCollection.name}</span>
          ) : (
            <div className="req-env-pills">
              {environments.filter(env => !linkedSvc || resolvedColBaseUrls[env.id]).map((env) => (
                <button key={env.id} className={`req-env-pill ${selectedEnvId === env.id ? 'active' : ''}`}
                  data-testid="req-env-pill" data-env-name={env.name}
                  onClick={() => onEnvChange(env.id)}>{env.name}</button>
              ))}
            </div>
          )}
          {displayUrl !== relativePath && (
            <>
              <span className="req-resolved-url-arrow">&#8594;</span>
              <span className="req-resolved-url-full" data-testid="req-resolved-url" title={displayUrl}>{displayUrl}</span>
            </>
          )}
          {!hasBaseUrls && (
            <span className="req-env-hint">Base URLs not configured — edit collection or sub-collection to add hostnames</span>
          )}
        </div>
        );
      })()}

      {/* ── Split pane: request (left) + response (right) ── */}
      <div className="req-split-pane">

        {/* LEFT: Request editor */}
        <div className="req-pane-left">
          {/* Tabs row with action menu */}
          <div className="req-tabs">
            <button className={`req-tab ${activeTab === 'params' ? 'active' : ''}`} data-testid="req-tab-params" onClick={() => { setActiveTab('params'); setInputMode('builder'); }}>
              Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
            </button>
            <button className={`req-tab ${activeTab === 'body' ? 'active' : ''}`} data-testid="req-tab-body" onClick={() => { setActiveTab('body'); setInputMode('builder'); }}>Body</button>
            <button className={`req-tab ${activeTab === 'auth' ? 'active' : ''}`} data-testid="req-tab-auth" onClick={() => { setActiveTab('auth'); setInputMode('builder'); }}>
              Auth {request.auth.type !== 'none' && request.auth.type !== 'inherit' && <span className="req-tab-dot" />}
            </button>
            <button className={`req-tab ${activeTab === 'headers' ? 'active' : ''}`} data-testid="req-tab-headers" onClick={() => { setActiveTab('headers'); setInputMode('builder'); }}>
              Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
            </button>
            <button className={`req-tab ${activeTab === 'history' ? 'active' : ''}`} data-testid="req-tab-definition-history" onClick={() => { setActiveTab('history'); setInputMode('builder'); }}>
              History {(request.definitionVersions?.length ?? 0) > 0 && <span className="tab-badge">{request.definitionVersions!.length}</span>}
            </button>

            <div className="req-action-menu-wrapper">
              <button className="req-action-menu-btn" data-testid="req-action-menu-btn" onClick={() => setShowActionMenu(!showActionMenu)}
                title="Import / Export">&#9662;</button>
              {showActionMenu && (
                <div className="req-action-dropdown" data-testid="req-action-dropdown" onClick={() => setShowActionMenu(false)}>
                  <button data-testid="req-curl-import-btn" onClick={() => setInputMode('curlImport')}>cURL Import</button>
                  <button data-testid="req-curl-export-btn" onClick={() => { setInputMode('curlExport'); void triggerCurlGeneration(); }}>cURL Export</button>
                  <div className="req-dropdown-divider" />
                  <button onClick={handleJsonImport}>Import JSON</button>
                  <button onClick={handleJsonExport}>Export JSON</button>
                </div>
              )}
            </div>
          </div>

          {/* Tab / cURL content */}
          <div className="req-tab-content">
            {/* cURL Import panel */}
            {inputMode === 'curlImport' && (
              <div className="req-curl-panel" data-testid="req-curl-import-panel">
                <label className="req-curl-label">Paste your cURL command</label>
                <textarea className="req-curl-textarea" data-testid="req-curl-textarea" rows={8} autoFocus value={curlText}
                  onChange={(e) => setCurlText(e.target.value)}
                  placeholder={`curl -X POST https://api.example.com \\
  -H 'Authorization: Bearer token' \\
  -d '{"key": "value"}'`} />
                <div className="req-curl-actions">
                  <button className="btn btn-primary" data-testid="req-curl-apply-btn" disabled={!curlText.trim()} onClick={handleCurlImport}>Import &amp; Apply</button>
                  <button className="btn btn-ghost" onClick={() => setInputMode('builder')}>Cancel</button>
                </div>
              </div>
            )}

            {/* cURL Export panel */}
            {inputMode === 'curlExport' && (
              <div className="req-curl-panel" data-testid="req-curl-export-panel">
                <label className="req-curl-label">Generated cURL command</label>
                {request.url.trim() ? (<>
                  <textarea className="req-curl-textarea req-curl-export" data-testid="req-curl-export-textarea" rows={10} readOnly
                    value={curlGenerating ? 'Generating...' : generatedCurl}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
                  <div className="req-curl-actions">
                    <button className="btn btn-primary" disabled={curlGenerating || !generatedCurl} onClick={handleCopyToClipboard}>
                      {curlCopied ? 'Copied!' : 'Copy'}</button>
                    <button className="btn" disabled={curlGenerating} onClick={() => void triggerCurlGeneration()}>Refresh</button>
                    <button className="btn btn-ghost" onClick={() => setInputMode('builder')}>Close</button>
                  </div>
                </>) : <div className="req-curl-empty">Set a URL first.</div>}
              </div>
            )}

            {/* Builder content */}
            {inputMode === 'builder' && (<>
              {activeTab === 'params' && (
                <>
                  {pathParams.length > 0 && <PathParamsEditor params={pathParams} onChange={handlePathParamsChange} />}
                  <ParamsEditor params={queryParams} onChange={handleParamsChange} />
                </>
              )}
              {activeTab === 'body' && <BodyEditor draft={draftScenario} onDraftChange={handleDraftChange} />}

              {activeTab === 'headers' && (
                <div className="req-headers-editor req-headers-kv">
                  <KeyValueEditor
                    entries={headerEntries}
                    onChange={handleHeadersChange}
                    onDeleteAll={() => onUpdateRequest({ headers: [{ key: '', value: '' }] })}
                    label="Headers"
                    toggleVerb="send"
                    testIdPrefix="req-headers"
                  />
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

              {activeTab === 'history' && (
                <RequestDefinitionVersionPanel
                  versions={request.definitionVersions ?? []}
                  currentSnapshot={createSnapshot(request)}
                  onRestore={(v) => onUpdateRequest(restoreFromVersion(v))}
                  onDelete={(vId) => onUpdateRequest({ definitionVersions: deleteVersion(request.definitionVersions ?? [], vId) })}
                  onRename={(vId, label) => onUpdateRequest({ definitionVersions: renameVersion(request.definitionVersions ?? [], vId, label) })}
                  onCompare={(older, newer) => setDiffVersions({ older, newer })}
                />
              )}
            </>)}
          </div>
        </div>

        {/* RIGHT: Response panel or API Info drawer */}
        <div className="req-pane-right">
          {showApiInfo && request.catalogMeta ? (
            <RequestCatalogApiInfoDrawer
              method={request.method}
              catalogMeta={request.catalogMeta}
              onClose={() => setShowApiInfo(false)}
            />
          ) : (<>
          {/* Response tabs */}
          <div className="req-tabs req-resp-tabs">
            <button className={`req-tab ${responseTab === 'preview' ? 'active' : ''}`} onClick={() => setResponseTab('preview')} data-testid="req-resp-tab-preview">Preview</button>
            <button className={`req-tab ${responseTab === 'headers' ? 'active' : ''}`} onClick={() => setResponseTab('headers')} data-testid="req-resp-tab-headers">
              Headers {responseHeaderCount > 0 && <span className="tab-badge">{responseHeaderCount}</span>}
            </button>
            <button className={`req-tab ${responseTab === 'console' ? 'active' : ''}`} onClick={() => setResponseTab('console')} data-testid="req-resp-tab-console">
              Console
            </button>
          </div>

          {responseTab === 'preview' && (
            <ResponseBodySearchBar
              value={responseSearch}
              onChange={setResponseSearch}
              currentMatch={searchMatchIdx + 1}
              totalMatches={searchMatchCount}
              onPrev={goPrevSearchMatch}
              onNext={goNextSearchMatch}
              onClear={() => { clearResponseSearch(); setSearchMatchCount(0); }}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
            />
          )}

          <div className="req-resp-content">
            {sending && (
              <div className="req-response-loading"><div className="req-spinner" /> Sending...</div>
            )}

            {!sending && !response && !sendAllResults && (
              <div className="req-response-placeholder">Click <strong>Send</strong> to get a response</div>
            )}

            {!sending && response && !sendAllResults && responseTab === 'preview' && (
              <JsonPreview body={response.body} error={response.error} search={responseSearch}
                collapsedSet={collapsedSet} onToggle={handleTreeToggle} prebuiltTree={responseTree}
                currentMatchIdx={searchMatchIdx} onMatchCountChange={handleMatchCountChange} />
            )}

            {!sending && response && !sendAllResults && responseTab === 'headers' && (
              <div className="req-resp-headers-list">
                {Object.entries(response.headers).map(([k, v]) => (
                  <div key={k} className="req-resp-header-row">
                    <span className="req-resp-header-key">{k}</span>
                    <span className="req-resp-header-val">{v}</span>
                  </div>
                ))}
                {Object.keys(response.headers).length === 0 && (
                  <div className="req-response-placeholder">No response headers</div>
                )}
              </div>
            )}

            {responseTab === 'console' && (
              <ConsoleLog lines={consoleLines} />
            )}

            {!sending && sendAllResults && responseTab !== 'console' && (
              <div className="req-multi-results">
                {sendAllResults.map((r, i) => <MultiEnvResultRow key={i} {...r} />)}
              </div>
            )}
          </div>
          </>)}
        </div>
      </div>

    </div>

    {diffVersions && (
      <RequestDefinitionVersionDiff
        open
        older={diffVersions.older}
        newer={diffVersions.newer}
        onClose={() => setDiffVersions(null)}
      />
    )}
    {showVersionCompare && request.specVersions && request.specVersions.length > 1 && (
      <SpecVersionCompareModal request={request} onClose={() => setShowVersionCompare(false)} />
    )}
    </>
  );
}

