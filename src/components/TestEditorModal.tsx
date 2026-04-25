import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, FeatureGroup, AuthConfig, KeyValue, GlobalAuthProfile, FailureDetail, ResponseVersion } from '../types';
import { parseCurl } from '../utils/curlParser';
import { buildCurlCommand } from '../utils/curlGenerator';
import {
  getBaseUrl,
  jsonEqual,
  parseQueryParams,
  pickJsonFile,
  rebuildUrl,
  unwrapImport,
} from '../utils/testEditorUtils';
import { serializeWithContentType, getEffectiveBodyType } from '../utils/bodySerializer';
import { toErrorMessage } from '../utils/helpers';
import { BodyEditor } from './BodyEditor';
import { ParamsEditor, toParamEntries, fromParamEntries, type ParamEntry } from './ParamsEditor';
import { proxyFetch, acquireOAuth2Token } from '../engine/executor';
import { useAuthVerify } from '../hooks/useAuthVerify';
import { useModalExpand } from '../hooks/useModalExpand';
import { useModalResize } from '../hooks/useModalResize';
import { validate } from '../engine/validator';
import CsvTemplateExportModal from './CsvTemplateExportModal';
import TestEditorAuthTab from './TestEditorAuthTab';
import TestEditorValidationTab from './TestEditorValidationTab';
import ExtractionEditor from './ExtractionEditor';
import ModalExpandButton from './shared/ModalExpandButton';
import ModalResizeHandles from './shared/ModalResizeHandles';

// emptyTest is imported directly from '../utils/testEditorUtils' by consumers

export type TestEditorTab = 'params' | 'body' | 'auth' | 'headers' | 'validation' | 'extract';
export type TestEditorInputMode = 'builder' | 'curlImport' | 'curlExport';

export type TestEditingContext = { fgId: string; scenarioId: string; testId: string | 'new' };

export interface TestEditorModalProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
  inputMode: TestEditorInputMode;
  onInputModeChange: (mode: TestEditorInputMode) => void;
  activeTab: TestEditorTab;
  onActiveTabChange: (tab: TestEditorTab) => void;
  resolvedBaseUrl: string;
  allAuthProfiles: GlobalAuthProfile[];
  featureGroups: FeatureGroup[];
  /** Parent feature group id, scenario id, and test id for auth inheritance resolution */
  editingTest: TestEditingContext;
  onExportTest: (scenario: Scenario) => void;
}

export default function TestEditorModal({
  draft,
  onDraftChange,
  onSave,
  onCancel,
  isNew,
  inputMode,
  onInputModeChange,
  activeTab,
  onActiveTabChange,
  resolvedBaseUrl,
  allAuthProfiles,
  featureGroups,
  editingTest,
  onExportTest,
}: TestEditorModalProps) {
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [queryParams, setQueryParams] = useState<ParamEntry[]>(() => toParamEntries(parseQueryParams(draft.url)));

  const [fetchingResponse, setFetchingResponse] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchHostOverride, setFetchHostOverride] = useState(draft.fetchHostOverride || '');
  const [fetchHostEnabled, setFetchHostEnabled] = useState(!!draft.fetchHostEnabled);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ passed: boolean; failures: FailureDetail[]; httpStatus?: number; responseJson?: string } | null>(null);

  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth } = useAuthVerify();
  const [showSecret, setShowSecret] = useState(false);
  const { expanded, toggleExpand, expandClass } = useModalExpand();
  const { resizeStyle, onRightEdge, onCorner } = useModalResize();

  useEffect(() => {
    setQueryParams(toParamEntries(parseQueryParams(draft.url)));
    setCurlText('');
    setGeneratedCurl('');
    setFetchError(null);
    setFetchHostOverride(draft.fetchHostOverride || '');
    setFetchHostEnabled(!!draft.fetchHostEnabled);
    setAuthVerifyResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally sync local state only on test switch; adding draft.fetchHostOverride/fetchHostEnabled would loop
  }, [editingTest.fgId, editingTest.scenarioId, editingTest.testId, draft.id]);

  useEffect(() => {
    const prev = draftRef.current;
    if (prev.fetchHostOverride !== fetchHostOverride || !!prev.fetchHostEnabled !== fetchHostEnabled) {
      onDraftChange({ ...prev, fetchHostOverride, fetchHostEnabled });
    }
  }, [fetchHostOverride, fetchHostEnabled, onDraftChange]);

  const syncParamsFromUrl = useCallback((url: string) => {
    setQueryParams(toParamEntries(parseQueryParams(url)));
  }, []);

  const handleParamsChange = useCallback((entries: ParamEntry[]) => {
    setQueryParams(entries);
    const cur = draftRef.current;
    if (cur.url) {
      onDraftChange({ ...cur, url: rebuildUrl(cur.url, fromParamEntries(entries)) });
    }
  }, [onDraftChange]);

  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const cur = draftRef.current;
    const headers = [...cur.headers];
    headers[index] = { ...headers[index], [field]: val };
    onDraftChange({ ...cur, headers });
  };

  const addHeader = () => {
    const cur = draftRef.current;
    onDraftChange({ ...cur, headers: [...cur.headers, { key: '', value: '' }] });
  };

  const removeHeader = (index: number) => {
    const cur = draftRef.current;
    onDraftChange({ ...cur, headers: cur.headers.filter((_, i) => i !== index) });
  };

  const resolveEffectiveAuth = useCallback((): { auth: AuthConfig; source: string } => {
    const cur = draftRef.current;
    if (cur.auth.type !== 'inherit' && cur.auth.type !== 'none') {
      return { auth: cur.auth, source: 'test' };
    }
    const fg = featureGroups.find((f) => f.id === editingTest.fgId);
    const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
    if (cur.auth.type === 'inherit' || cur.auth.type === 'none') {
      if (sc?.auth && sc.auth.type !== 'none' && sc.auth.type !== 'inherit') {
        return { auth: sc.auth, source: 'scenario' };
      }
      if (fg?.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit') {
        return { auth: fg.auth, source: 'feature' };
      }
      if (fg?.auth?.type === 'inherit' && fg.globalAuthProfileId) {
        const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
        if (profile && profile.auth.type !== 'none') {
          return { auth: profile.auth, source: `global:${profile.name}` };
        }
      }
      if ((!fg?.auth || fg.auth.type === 'none') && fg?.globalAuthProfileId) {
        const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
        if (profile && profile.auth.type !== 'none') {
          return { auth: profile.auth, source: `global:${profile.name}` };
        }
      }
    }
    return { auth: { type: 'none' }, source: 'none' };
  }, [editingTest.fgId, editingTest.scenarioId, featureGroups, allAuthProfiles]);

  /** Apply host override and API-key query param to a URL before fetching. */
  const applyFetchUrlOverrides = useCallback((url: string, auth: AuthConfig): string => {
    let fetchUrl = url;
    if (fetchHostEnabled && fetchHostOverride.trim()) {
      try {
        const orig = new URL(fetchUrl);
        const base = new URL(fetchHostOverride.trim().endsWith('/') ? fetchHostOverride.trim() : `${fetchHostOverride.trim()}/`);
        orig.protocol = base.protocol;
        orig.host = base.host;
        fetchUrl = orig.toString();
      } catch { /* keep original */ }
    }
    if (auth.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName && auth.apiKeyValue) {
      try {
        const u = new URL(fetchUrl);
        u.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
        fetchUrl = u.toString();
      } catch { /* keep original */ }
    }
    return fetchUrl;
  }, [fetchHostEnabled, fetchHostOverride]);

  const handleFetchSampleResponse = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setFetchError('URL is required');
      return;
    }
    setFetchingResponse(true);
    setFetchError(null);
    try {
      const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();

      const reqHeaders: Record<string, string> = {};
      for (const h of cur.headers) {
        if (!h.key.trim()) continue;
        if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
        reqHeaders[h.key.trim()] = h.value;
      }
      const { body: reqBody, contentType: autoContentType } = serializeWithContentType(cur);
      const bt = getEffectiveBodyType(cur);
      if (bt === 'form-data' && autoContentType) {
        reqHeaders['Content-Type'] = autoContentType;
      } else if (!reqHeaders['Content-Type'] && autoContentType) {
        reqHeaders['Content-Type'] = autoContentType;
      }

      if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
        const encoded = btoa(`${effectiveAuth.username}:${effectiveAuth.password ?? ''}`);
        reqHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
        const prefix = effectiveAuth.prefix?.trim() || 'Bearer';
        reqHeaders['Authorization'] = `${prefix} ${effectiveAuth.token}`;
      } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
        if (effectiveAuth.apiKeyIn === 'header') {
          reqHeaders[effectiveAuth.apiKeyName] = effectiveAuth.apiKeyValue;
        }
      } else if (effectiveAuth.type === 'digest' && effectiveAuth.username) {
        const encoded = btoa(`${effectiveAuth.username}:${effectiveAuth.password ?? ''}`);
        reqHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (effectiveAuth.type === 'oauth2') {
        if (!effectiveAuth.tokenUrl || !effectiveAuth.clientId || !effectiveAuth.clientSecret) {
          const missing = [
            !effectiveAuth.tokenUrl && 'tokenUrl',
            !effectiveAuth.clientId && 'clientId',
            !effectiveAuth.clientSecret && 'clientSecret',
          ].filter(Boolean).join(', ');
          setFetchError(`OAuth2 missing: ${missing} (auth source: ${authSource}). Configure OAuth2 credentials in the scenario auth panel.`);
          setFetchingResponse(false);
          return;
        }
        const token = await acquireOAuth2Token(effectiveAuth);
        reqHeaders['Authorization'] = `Bearer ${token}`;
      }

      const fetchUrl = applyFetchUrlOverrides(cur.url, effectiveAuth);

      const result = await proxyFetch(fetchUrl, cur.method, reqHeaders, reqBody);
      const latest = draftRef.current;
      if (result.error) {
        setFetchError(result.error);
      } else if (result.status >= 400) {
        setFetchError(`HTTP ${result.status}: ${result.statusText}`);
        if (result.body) {
          let pretty: string;
          try { pretty = JSON.stringify(JSON.parse(result.body), null, 2); } catch { pretty = result.body; }
          onDraftChange({ ...latest, validation: { ...latest.validation, sampleJson: pretty } });
        }
      } else {
        let pretty: string;
        try {
          pretty = JSON.stringify(JSON.parse(result.body), null, 2);
        } catch {
          pretty = result.body;
        }
        const v = latest.validation;
        const prevVersions = v.responseVersions || [];
        const latestVersion = prevVersions.length > 0 ? prevVersions[prevVersions.length - 1] : null;
        const isDuplicate = latestVersion ? jsonEqual(latestVersion.json, pretty, v.excludedPaths) : false;
        const updatedVersions = isDuplicate
          ? prevVersions
          : [...prevVersions, {
              id: uuidv4(), timestamp: Date.now(), json: pretty,
              validationMode: v.mode, selectiveMode: v.selectiveMode,
              expectedFields: v.expectedFields ? [...v.expectedFields] : [],
              excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
              unorderedArrays: v.unorderedArrays,
            } as ResponseVersion];
        onDraftChange({
          ...latest,
          validation: {
            ...latest.validation,
            sampleJson: pretty,
            expectedFields: [],
            responseVersions: updatedVersions,
          },
        });
        setFetchError(null);
      }
    } catch (err) {
      setFetchError(toErrorMessage(err));
    } finally {
      setFetchingResponse(false);
    }
  }, [applyFetchUrlOverrides, onDraftChange, resolveEffectiveAuth]);

  const handleValidateResponse = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setValidationResult({ passed: false, failures: [{ path: '(url)', expected: 'a URL', actual: 'empty' }] });
      return;
    }
    const v = cur.validation;
    if (v.mode === 'none' || ((v.expectedFields || []).length === 0 && v.mode === 'selective')) {
      setValidationResult({ passed: false, failures: [{ path: '(config)', expected: 'validation rules', actual: 'no rules configured' }] });
      return;
    }

    setValidating(true);
    setValidationResult(null);
    try {
      const { auth: effectiveAuth } = resolveEffectiveAuth();
      const reqHeaders: Record<string, string> = {};
      for (const h of cur.headers) {
        if (!h.key.trim()) continue;
        if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
        reqHeaders[h.key.trim()] = h.value;
      }
      const { body: reqBody, contentType: autoContentType } = serializeWithContentType(cur);
      const bt = getEffectiveBodyType(cur);
      if (bt === 'form-data' && autoContentType) {
        reqHeaders['Content-Type'] = autoContentType;
      } else if (!reqHeaders['Content-Type'] && autoContentType) {
        reqHeaders['Content-Type'] = autoContentType;
      }

      if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
        const encoded = btoa(`${effectiveAuth.username}:${effectiveAuth.password ?? ''}`);
        reqHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
        const prefix = effectiveAuth.prefix?.trim() || 'Bearer';
        reqHeaders['Authorization'] = `${prefix} ${effectiveAuth.token}`;
      } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
        if (effectiveAuth.apiKeyIn === 'header') reqHeaders[effectiveAuth.apiKeyName] = effectiveAuth.apiKeyValue;
      } else if (effectiveAuth.type === 'oauth2') {
        if (!effectiveAuth.tokenUrl || !effectiveAuth.clientId || !effectiveAuth.clientSecret) {
          setValidationResult({ passed: false, failures: [{ path: '(auth)', expected: 'OAuth2 credentials', actual: 'missing tokenUrl/clientId/clientSecret' }] });
          setValidating(false);
          return;
        }
        const token = await acquireOAuth2Token(effectiveAuth);
        reqHeaders['Authorization'] = `Bearer ${token}`;
      }

      const fetchUrl = applyFetchUrlOverrides(cur.url, effectiveAuth);

      const result = await proxyFetch(fetchUrl, cur.method, reqHeaders, reqBody);

      if (result.error) {
        setValidationResult({ passed: false, failures: [{ path: '(network)', expected: 'response', actual: result.error }] });
        return;
      }
      if (result.status >= 400) {
        setValidationResult({
          passed: false,
          httpStatus: result.status,
          failures: [{ path: '(http)', expected: '2xx', actual: `${result.status} ${result.statusText}` }],
          responseJson: result.body,
        });
        return;
      }

      let responseObj: unknown;
      try { responseObj = JSON.parse(result.body); } catch { responseObj = result.body; }

      const failures = validate(v, responseObj);
      setValidationResult({
        passed: failures.length === 0,
        failures,
        httpStatus: result.status,
        responseJson: result.body,
      });
    } catch (err) {
      setValidationResult({ passed: false, failures: [{ path: '(error)', expected: 'success', actual: toErrorMessage(err) }] });
    } finally {
      setValidating(false);
    }
  }, [applyFetchUrlOverrides, resolveEffectiveAuth]);

  const handleBaseUrlChange = (newBaseUrl: string) => {
    const cur = draftRef.current;
    const enabledParams = fromParamEntries(queryParams);
    if (enabledParams.length > 0) {
      try {
        const u = new URL(newBaseUrl);
        enabledParams.forEach((p) => u.searchParams.set(p.key.trim(), p.value));
        onDraftChange({ ...cur, url: u.toString() });
      } catch {
        onDraftChange({ ...cur, url: newBaseUrl });
      }
    } else {
      onDraftChange({ ...cur, url: newBaseUrl });
    }
  };

  const handleCurlImport = () => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    const cur = draftRef.current;
    // Preserve cur.id so the React key doesn't change and cause a remount
    const { id: _discardId, ...parsedWithoutId } = parsed;
    onDraftChange({ ...cur, ...parsedWithoutId, validation: cur.validation });
    syncParamsFromUrl(parsed.url || '');
    onInputModeChange('builder');
    setCurlText('');
    if (parsed.bodyType && parsed.bodyType !== 'none' && parsed.method !== 'GET') {
      onActiveTabChange('body');
    }
  };

  const generateCurl = useCallback(async (): Promise<string> => {
    const cur = draftRef.current;
    const { auth: effectiveAuth } = resolveEffectiveAuth();
    return buildCurlCommand(cur, effectiveAuth);
  }, [resolveEffectiveAuth]);

  const triggerCurlGeneration = useCallback(async () => {
    const cur = draftRef.current;
    if (!cur.url.trim()) {
      setGeneratedCurl('');
      return;
    }
    setCurlGenerating(true);
    try {
      const cmd = await generateCurl();
      setGeneratedCurl(cmd);
    } catch (err) {
      setGeneratedCurl(`# Error generating cURL: ${toErrorMessage(err)}`);
    } finally {
      setCurlGenerating(false);
    }
  }, [generateCurl]);

  const [csvExportOpen, setCsvExportOpen] = useState(false);

  const paramCount = useMemo(() => queryParams.filter((p) => p.key.trim() && p.enabled).length, [queryParams]);
  const headerCount = useMemo(() => draft.headers.filter((h) => h.key.trim()).length, [draft.headers]);
  const baseUrl = useMemo(() => (draft.url ? getBaseUrl(draft.url) : ''), [draft.url]);

  return (
    <div className="modal-overlay">
      <div className={`modal insomnia-modal ${expandClass}`} style={resizeStyle}>
        <div className="insomnia-top-bar">
          <h3>{isNew ? 'New Test' : 'Edit Test'}</h3>
          <div className="mode-toggle">
            <button type="button" className={`mode-btn ${inputMode === 'builder' ? 'active' : ''}`} onClick={() => onInputModeChange('builder')}>Builder</button>
            <button type="button" className={`mode-btn ${inputMode === 'curlImport' ? 'active' : ''}`} onClick={() => onInputModeChange('curlImport')}>cURL Import</button>
            <button
              type="button"
              className={`mode-btn ${inputMode === 'curlExport' ? 'active' : ''}`}
              onClick={() => {
                onInputModeChange('curlExport');
                void triggerCurlGeneration();
              }}
            >
              cURL Export
            </button>
            <button
              type="button"
              className="mode-btn"
              onClick={() => pickJsonFile((raw) => {
                const data = unwrapImport(raw);
                const t = data as Scenario;
                if (!t.name || !t.url || !t.method) { alert('Invalid file: expected a test with name, url, and method.'); return; }
                const cur = draftRef.current;
                onDraftChange({ ...t, id: cur.id });
                syncParamsFromUrl(t.url || '');
                onInputModeChange('builder');
              })}
            >
              Import
            </button>
            <button type="button" className="mode-btn" onClick={() => onExportTest(draft)}>Export</button>
            <button type="button" className="mode-btn" onClick={() => setCsvExportOpen(true)}>Export Template</button>
          </div>
          <div className="insomnia-top-actions">
            <ModalExpandButton expanded={expanded} onToggle={toggleExpand} />
            <button type="button" className="btn" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={!draft.name.trim() || !draft.url.trim()}>Save</button>
          </div>
        </div>

        {inputMode === 'curlImport' && (
          <div className="curl-mode-panel">
            <label>Paste your cURL command</label>
            <textarea
              rows={10}
              autoFocus
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              placeholder={`curl -X POST https://api.example.com/data \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token123' \\
  -d '{"key": "value"}'`}
            />
            <div className="curl-actions">
              <button type="button" className="btn btn-primary" disabled={!curlText.trim()} onClick={handleCurlImport}>
                Import &amp; Switch to Builder
              </button>
            </div>
            {draft.url && (
              <div className="curl-preview">
                <strong>Current test:</strong> {draft.method} {draft.url}
              </div>
            )}
          </div>
        )}

        {inputMode === 'curlExport' && (
          <div className="curl-mode-panel">
            <label>Generated cURL command</label>
            {draft.url.trim() ? (
              <>
                <textarea
                  rows={12}
                  readOnly
                  value={curlGenerating ? 'Generating cURL (acquiring token)...' : generatedCurl}
                  className="curl-export-textarea"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <div className="curl-actions">
                  <button type="button" className="btn btn-primary" disabled={curlGenerating || !generatedCurl} onClick={() => {
                    void navigator.clipboard.writeText(generatedCurl);
                  }}>Copy to Clipboard</button>
                  <button type="button" className="btn" disabled={curlGenerating} onClick={() => void triggerCurlGeneration()}>
                    {curlGenerating ? 'Generating...' : 'Refresh'}
                  </button>
                </div>
                {resolveEffectiveAuth().auth.type === 'oauth2' && !curlGenerating && (
                  <div className="curl-preview">
                    <strong>Note:</strong> The OAuth2 token above is a real token acquired from the token endpoint. It may expire — click <strong>Refresh</strong> to get a new one.
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">Configure the test URL in the Builder first to generate a cURL command.</div>
            )}
          </div>
        )}

        {inputMode === 'builder' && (
          <div className="builder-panel">
            <div className="form-row">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} placeholder="e.g. Get User Profile" />
            </div>

            <div className="url-bar">
              <select
                className={`method-select method-color-${draft.method.toLowerCase()}`}
                value={draft.method}
                onChange={(e) => onDraftChange({ ...draft, method: e.target.value as Scenario['method'] })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                className="url-input"
                value={baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder={resolvedBaseUrl ? `${resolvedBaseUrl}/...` : 'https://api.example.com/endpoint'}
              />
              {resolvedBaseUrl && !draft.url && (
                <button type="button" className="btn btn-sm url-fill-btn" onClick={() => handleBaseUrlChange(resolvedBaseUrl)} title="Use resolved base URL">Use</button>
              )}
            </div>

            {paramCount > 0 && draft.url && (
              <div className="url-preview">
                <span className="url-preview-label">URL PREVIEW</span>
                <code>{draft.url}</code>
              </div>
            )}

            <div className="builder-tabs">
              <button type="button" className={`builder-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => onActiveTabChange('params')}>
                Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
              </button>
              {draft.method !== 'GET' && (
                <button type="button" className={`builder-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => onActiveTabChange('body')}>
                  Body {(draft.body || (draft.bodyForm ?? []).some(kv => kv.key.trim())) ? <span className="tab-badge-dot" /> : null}
                </button>
              )}
              <button type="button" className={`builder-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => onActiveTabChange('auth')}>
                Auth {draft.auth.type !== 'none' && <span className="tab-badge-dot" />}
              </button>
              <button type="button" className={`builder-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => onActiveTabChange('headers')}>
                Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
              </button>
              <button type="button" className={`builder-tab ${activeTab === 'validation' ? 'active' : ''}`} onClick={() => onActiveTabChange('validation')}>
                Validation {draft.validation.mode !== 'none' && <span className="tab-badge-dot" />}
              </button>
              <button type="button" className={`builder-tab ${activeTab === 'extract' ? 'active' : ''}`} onClick={() => onActiveTabChange('extract')}>
                Extract {(draft.extractions?.length ?? 0) > 0 && <span className="tab-badge">{draft.extractions!.length}</span>}
              </button>
            </div>

            <div className="builder-tab-content">
              {activeTab === 'params' && (
                <ParamsEditor params={queryParams} onChange={handleParamsChange} />
              )}

              {activeTab === 'body' && draft.method !== 'GET' && (
                <BodyEditor draft={draft} onDraftChange={onDraftChange} />
              )}

              {activeTab === 'auth' && (
                <TestEditorAuthTab
                  draft={draft}
                  onDraftChange={onDraftChange}
                  featureGroups={featureGroups}
                  editingTest={editingTest}
                  allAuthProfiles={allAuthProfiles}
                  verifyAuth={verifyAuth}
                  resolveEffectiveAuth={resolveEffectiveAuth}
                  authVerifying={authVerifying}
                  authVerifyResult={authVerifyResult}
                  setAuthVerifyResult={setAuthVerifyResult}
                  showSecret={showSecret}
                  setShowSecret={setShowSecret}
                />
              )}

              {activeTab === 'headers' && (
                <div className="kv-section">
                  <div className="kv-header">
                    <span>REQUEST HEADERS</span>
                  </div>
                  {draft.headers.map((h: KeyValue, i: number) => (
                    <div key={i} className="kv-row">
                      <input value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                      <input value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} placeholder="Header value" />
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeHeader(i)}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={addHeader}>+ Add</button>
                </div>
              )}

              {activeTab === 'validation' && (
                <TestEditorValidationTab
                  draft={draft}
                  onDraftChange={onDraftChange}
                  draftRef={draftRef}
                  resolvedBaseUrl={resolvedBaseUrl}
                  fetchingResponse={fetchingResponse}
                  fetchError={fetchError}
                  fetchHostOverride={fetchHostOverride}
                  setFetchHostOverride={setFetchHostOverride}
                  fetchHostEnabled={fetchHostEnabled}
                  setFetchHostEnabled={setFetchHostEnabled}
                  onFetchSampleResponse={handleFetchSampleResponse}
                  validating={validating}
                  validationResult={validationResult}
                  setValidationResult={setValidationResult}
                  onValidateResponse={handleValidateResponse}
                />
              )}

              {activeTab === 'extract' && (
                <ExtractionEditor
                  extractions={draft.extractions ?? []}
                  onChange={(extractions) => onDraftChange({ ...draft, extractions })}
                  sampleResponseBody={
                    (draft.validation.sampleJson && draft.validation.sampleJson.trim())
                      ? draft.validation.sampleJson
                      : validationResult?.responseJson
                  }
                  fetchSample={{
                    onFetch: handleFetchSampleResponse,
                    fetching: fetchingResponse,
                    error: fetchError,
                    host: {
                      enabled: fetchHostEnabled,
                      setEnabled: setFetchHostEnabled,
                      override: fetchHostOverride,
                      setOverride: setFetchHostOverride,
                      resolvedBaseUrl,
                    },
                  }}
                />
              )}
            </div>
          </div>
        )}
        <div className="insomnia-footer" style={{ display: 'flex', padding: '8px 16px', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
          <ModalExpandButton expanded={expanded} onToggle={toggleExpand} position="footer" />
        </div>
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} />
      </div>

      {csvExportOpen && (
        <CsvTemplateExportModal
          test={draft}
          onClose={() => setCsvExportOpen(false)}
        />
      )}
    </div>
  );
}
