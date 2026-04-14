import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, FeatureGroup, AuthType, AuthConfig, ValidationMode, KeyValue, GlobalAuthProfile, ResponseVersion, FailureDetail } from '../types';
import { parseCurl } from '../utils/curlParser';
import { proxyFetch, acquireOAuth2Token } from '../engine/executor';
import { validate } from '../engine/validator';
import CsvTemplateExportModal from './CsvTemplateExportModal';
import JsonPathBuilder from './JsonPathBuilder';
import ResponseVersionPanel from './ResponseVersionPanel';

export const emptyTest = (): Scenario => ({
  id: uuidv4(),
  name: '',
  url: '',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  body: '',
  auth: { type: 'inherit' },
  validation: { mode: 'none', expectedFields: [] },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function canonicalize(val: any): any {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(val).sort()) out[k] = canonicalize(val[k]);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripPaths(obj: any, paths: string[]): any {
  if (!paths.length || obj === null || obj === undefined || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const p of paths) {
    const segments = p.replace(/^\$\.?/, '').split('.').filter(Boolean);
    if (!segments.length) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cursor: any = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const bracketMatch = seg.match(/^(.+)\[(\d+)\]$/);
      if (bracketMatch) {
        cursor = cursor?.[bracketMatch[1]];
        cursor = Array.isArray(cursor) ? (cursor = [...cursor]) : cursor;
        cursor = cursor?.[Number(bracketMatch[2])];
      } else {
        if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) cursor[seg] = { ...cursor[seg] };
        cursor = cursor?.[seg];
      }
      if (!cursor || typeof cursor !== 'object') break;
    }
    if (cursor && typeof cursor === 'object') {
      const last = segments[segments.length - 1];
      delete cursor[last];
    }
  }
  return clone;
}

function jsonEqual(a: string, b: string, excludedPaths?: string[]): boolean {
  try {
    let objA = JSON.parse(a);
    let objB = JSON.parse(b);
    if (excludedPaths?.length) {
      objA = stripPaths(objA, excludedPaths);
      objB = stripPaths(objB, excludedPaths);
    }
    return JSON.stringify(canonicalize(objA)) === JSON.stringify(canonicalize(objB));
  } catch {
    return a === b;
  }
}

export type TestEditorTab = 'params' | 'body' | 'auth' | 'headers' | 'validation';
export type TestEditorInputMode = 'builder' | 'curlImport' | 'curlExport';

export type TestEditingContext = { fgId: string; scenarioId: string; testId: string | 'new' };

function parseQueryParams(url: string): KeyValue[] {
  try {
    const u = new URL(url);
    const params: KeyValue[] = [];
    u.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    if (params.length === 0) params.push({ key: '', value: '' });
    return params;
  } catch {
    return [{ key: '', value: '' }];
  }
}

function rebuildUrl(url: string, params: KeyValue[]): string {
  try {
    const u = new URL(url);
    u.search = '';
    const nonEmpty = params.filter((p) => p.key.trim());
    nonEmpty.forEach((p) => u.searchParams.set(p.key.trim(), p.value));
    return u.toString();
  } catch {
    return url;
  }
}

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function unwrapImport(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function pickJsonFile(onLoad: (data: unknown) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        onLoad(JSON.parse(ev.target?.result as string));
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

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
  const [queryParams, setQueryParams] = useState<KeyValue[]>(() => parseQueryParams(draft.url));

  const [fetchingResponse, setFetchingResponse] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchHostOverride, setFetchHostOverride] = useState(draft.fetchHostOverride || '');
  const [fetchHostEnabled, setFetchHostEnabled] = useState(!!draft.fetchHostEnabled);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ passed: boolean; failures: FailureDetail[]; httpStatus?: number; responseJson?: string } | null>(null);

  const [authVerifying, setAuthVerifying] = useState(false);
  const [authVerifyResult, setAuthVerifyResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setQueryParams(parseQueryParams(draft.url));
    setCurlText('');
    setGeneratedCurl('');
    setFetchError(null);
    setFetchHostOverride(draft.fetchHostOverride || '');
    setFetchHostEnabled(!!draft.fetchHostEnabled);
    setAuthVerifyResult(null);
  }, [editingTest.fgId, editingTest.scenarioId, editingTest.testId, draft.id]);

  useEffect(() => {
    const prev = draftRef.current;
    if (prev.fetchHostOverride !== fetchHostOverride || !!prev.fetchHostEnabled !== fetchHostEnabled) {
      onDraftChange({ ...prev, fetchHostOverride, fetchHostEnabled });
    }
  }, [fetchHostOverride, fetchHostEnabled, onDraftChange]);

  const syncParamsFromUrl = useCallback((url: string) => {
    setQueryParams(parseQueryParams(url));
  }, []);

  const updateQueryParam = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...queryParams];
    next[index] = { ...next[index], [field]: val };
    setQueryParams(next);
    const cur = draftRef.current;
    if (cur.url) {
      onDraftChange({ ...cur, url: rebuildUrl(cur.url, next) });
    }
  };

  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '' }]);

  const removeQueryParam = (index: number) => {
    const next = queryParams.filter((_, i) => i !== index);
    if (next.length === 0) next.push({ key: '', value: '' });
    setQueryParams(next);
    const cur = draftRef.current;
    if (cur.url) {
      onDraftChange({ ...cur, url: rebuildUrl(cur.url, next) });
    }
  };

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

  const verifyAuth = useCallback(async (auth: AuthConfig) => {
    setAuthVerifying(true);
    setAuthVerifyResult(null);
    try {
      if (auth.type === 'oauth2') {
        if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
          const missing = [!auth.tokenUrl && 'Token URL', !auth.clientId && 'Client ID', !auth.clientSecret && 'Client Secret'].filter(Boolean).join(', ');
          setAuthVerifyResult({ ok: false, message: `Missing: ${missing}` });
          return;
        }
        const token = await acquireOAuth2Token(auth);
        const parts = token.split('.');
        let detail = `Token: ${token.slice(0, 20)}...${token.slice(-10)}`;
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp) {
              const expDate = new Date(payload.exp * 1000);
              detail += `\nExpires: ${expDate.toLocaleString()}`;
            }
            if (payload.scope) detail += `\nScope: ${payload.scope}`;
          } catch { /* not a JWT */ }
        }
        setAuthVerifyResult({ ok: true, message: 'Token acquired successfully', detail });
      } else if (auth.type === 'basic') {
        if (!auth.username) { setAuthVerifyResult({ ok: false, message: 'Username is required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'Basic Auth configured', detail: `Username: ${auth.username}` });
      } else if (auth.type === 'bearer') {
        if (!auth.token) { setAuthVerifyResult({ ok: false, message: 'Token is required' }); return; }
        const prefix = auth.prefix?.trim() || 'Bearer';
        setAuthVerifyResult({ ok: true, message: 'Bearer Token configured', detail: `${prefix} ${auth.token.slice(0, 20)}...` });
      } else if (auth.type === 'apikey') {
        if (!auth.apiKeyName || !auth.apiKeyValue) { setAuthVerifyResult({ ok: false, message: 'Key Name and Key Value are required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'API Key configured', detail: `${auth.apiKeyName} → ${auth.apiKeyIn === 'query' ? 'Query Param' : 'Header'}` });
      } else if (auth.type === 'digest') {
        if (!auth.username) { setAuthVerifyResult({ ok: false, message: 'Username is required' }); return; }
        setAuthVerifyResult({ ok: true, message: 'Digest Auth configured', detail: `Username: ${auth.username}` });
      } else {
        setAuthVerifyResult({ ok: false, message: 'No auth type selected' });
      }
    } catch (err) {
      setAuthVerifyResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setAuthVerifying(false);
    }
  }, []);

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
  }, [draft.auth, editingTest.fgId, editingTest.scenarioId, featureGroups, allAuthProfiles]);

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
      if (cur.body && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
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

      let fetchUrl = cur.url;
      if (fetchHostEnabled && fetchHostOverride.trim()) {
        try {
          const orig = new URL(fetchUrl);
          const base = new URL(fetchHostOverride.trim().endsWith('/') ? fetchHostOverride.trim() : `${fetchHostOverride.trim()}/`);
          orig.protocol = base.protocol;
          orig.host = base.host;
          fetchUrl = orig.toString();
        } catch { /* keep original */ }
      }
      if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyIn === 'query' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
        try {
          const u = new URL(fetchUrl);
          u.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
          fetchUrl = u.toString();
        } catch { /* keep original */ }
      }

      const reqBody = (cur.body && cur.method !== 'GET') ? cur.body : undefined;
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
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingResponse(false);
    }
  }, [fetchHostEnabled, fetchHostOverride, onDraftChange, resolveEffectiveAuth]);

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
      if (cur.body && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
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

      let fetchUrl = cur.url;
      if (fetchHostEnabled && fetchHostOverride.trim()) {
        try {
          const orig = new URL(fetchUrl);
          const base = new URL(fetchHostOverride.trim().endsWith('/') ? fetchHostOverride.trim() : `${fetchHostOverride.trim()}/`);
          orig.protocol = base.protocol;
          orig.host = base.host;
          fetchUrl = orig.toString();
        } catch { /* keep original */ }
      }
      if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyIn === 'query' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
        try {
          const u = new URL(fetchUrl);
          u.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
          fetchUrl = u.toString();
        } catch { /* keep original */ }
      }

      const reqBody = (cur.body && cur.method !== 'GET') ? cur.body : undefined;
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
      setValidationResult({ passed: false, failures: [{ path: '(error)', expected: 'success', actual: err instanceof Error ? err.message : String(err) }] });
    } finally {
      setValidating(false);
    }
  }, [fetchHostEnabled, fetchHostOverride, resolveEffectiveAuth]);

  const handleBaseUrlChange = (newBaseUrl: string) => {
    const cur = draftRef.current;
    const nonEmptyParams = queryParams.filter((p) => p.key.trim());
    if (nonEmptyParams.length > 0) {
      try {
        const u = new URL(newBaseUrl);
        nonEmptyParams.forEach((p) => u.searchParams.set(p.key.trim(), p.value));
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
    onDraftChange({ ...cur, ...parsed, validation: cur.validation });
    syncParamsFromUrl(parsed.url || '');
    onInputModeChange('builder');
    setCurlText('');
  };

  const generateCurl = useCallback(async (): Promise<string> => {
    const cur = draftRef.current;
    const parts: string[] = ['curl'];

    if (cur.method !== 'GET') {
      parts.push(`-X ${cur.method}`);
    }

    parts.push(`'${cur.url}'`);

    const headerEntries: { key: string; value: string }[] = [];
    const { auth: effectiveAuth } = resolveEffectiveAuth();

    for (const h of cur.headers) {
      if (!h.key.trim()) continue;
      if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
      headerEntries.push({ key: h.key.trim(), value: h.value });
    }

    if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
      const encoded = btoa(`${effectiveAuth.username}:${effectiveAuth.password ?? ''}`);
      headerEntries.push({ key: 'Authorization', value: `Basic ${encoded}` });
    } else if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
      const prefix = effectiveAuth.prefix?.trim() || 'Bearer';
      headerEntries.push({ key: 'Authorization', value: `${prefix} ${effectiveAuth.token}` });
    } else if (effectiveAuth.type === 'apikey' && effectiveAuth.apiKeyName && effectiveAuth.apiKeyValue) {
      if (effectiveAuth.apiKeyIn === 'query') {
        try {
          const url = new URL(cur.url);
          url.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
          parts[parts.indexOf(`'${cur.url}'`)] = `'${url.toString()}'`;
        } catch { /* keep original URL */ }
      } else {
        headerEntries.push({ key: effectiveAuth.apiKeyName, value: effectiveAuth.apiKeyValue });
      }
    } else if (effectiveAuth.type === 'digest' && effectiveAuth.username) {
      parts.push('--digest');
      parts.push(`-u '${effectiveAuth.username}:${effectiveAuth.password ?? ''}'`);
    } else if (effectiveAuth.type === 'oauth2') {
      try {
        const token = await acquireOAuth2Token(effectiveAuth);
        headerEntries.push({ key: 'Authorization', value: `Bearer ${token}` });
      } catch {
        headerEntries.push({ key: 'Authorization', value: 'Bearer <TOKEN_ERROR: check OAuth2 config>' });
      }
    }

    if (cur.body && !headerEntries.some((h) => h.key.toLowerCase() === 'content-type')) {
      headerEntries.push({ key: 'Content-Type', value: 'application/json' });
    }

    for (const h of headerEntries) {
      parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
    }

    if (cur.body) {
      const escaped = cur.body.replace(/'/g, "'\\''");
      parts.push(`\\\n  -d '${escaped}'`);
    }

    return parts.join(' ');
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
      setGeneratedCurl(`# Error generating cURL: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCurlGenerating(false);
    }
  }, [generateCurl]);

  const [csvExportOpen, setCsvExportOpen] = useState(false);

  const paramCount = useMemo(() => queryParams.filter((p) => p.key.trim()).length, [queryParams]);
  const headerCount = useMemo(() => draft.headers.filter((h) => h.key.trim()).length, [draft.headers]);
  const baseUrl = useMemo(() => (draft.url ? getBaseUrl(draft.url) : ''), [draft.url]);

  return (
    <div className="modal-overlay">
      <div className="modal insomnia-modal">
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
            <button type="button" className="mode-btn" onClick={() => setCsvExportOpen(true)}>CSV Template</button>
          </div>
          <div className="insomnia-top-actions">
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
                  Body {draft.body ? <span className="tab-badge-dot" /> : null}
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
            </div>

            <div className="builder-tab-content">
              {activeTab === 'params' && (
                <div className="kv-section">
                  <div className="kv-header">
                    <span>QUERY PARAMETERS</span>
                  </div>
                  {queryParams.map((p, i) => (
                    <div key={i} className="kv-row">
                      <input value={p.key} onChange={(e) => updateQueryParam(i, 'key', e.target.value)} placeholder="Parameter name" />
                      <input value={p.value} onChange={(e) => updateQueryParam(i, 'value', e.target.value)} placeholder="Value" />
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQueryParam(i)}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={addQueryParam}>+ Add</button>
                </div>
              )}

              {activeTab === 'body' && draft.method !== 'GET' && (
                <div>
                  <textarea
                    className="body-editor"
                    rows={14}
                    value={draft.body}
                    onChange={(e) => onDraftChange({ ...draft, body: e.target.value })}
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}

              {activeTab === 'auth' && (
                <div>
                  <div className="auth-type-select">
                    <label>Type</label>
                    <select
                      value={draft.auth.type}
                      onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, type: e.target.value as AuthType } })}
                    >
                      <option value="inherit">Inherit from Scenario</option>
                      <option value="none">No Auth</option>
                      <option value="basic">Basic Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="apikey">API Key</option>
                      <option value="digest">Digest Auth</option>
                      <option value="oauth2">OAuth2 Client Credentials</option>
                    </select>
                  </div>
                  {draft.auth.type === 'inherit' && (() => {
                    const fg = featureGroups.find((f) => f.id === editingTest.fgId);
                    const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
                    const scAuth = sc?.auth;
                    const fgAuth = fg?.auth;
                    const authLabel: Record<string, string> = {
                      basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
                      digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
                    };
                    let hint: string;
                    if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') {
                      hint = `Will use scenario-level ${authLabel[scAuth.type] ?? scAuth.type}`;
                    } else if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
                      hint = `Will use feature-level ${authLabel[fgAuth.type] ?? fgAuth.type}`;
                      if (scAuth?.type === 'inherit') hint += ' (scenario inherits from feature)';
                    } else if (fgAuth?.type === 'inherit' && fg?.globalAuthProfileId) {
                      const profile = allAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                      hint = profile
                        ? `Will use global profile "${profile.name}" (${authLabel[profile.auth.type] ?? profile.auth.type})`
                        : 'Feature references a missing global profile.';
                      if (scAuth?.type === 'inherit') hint += ' (via scenario → feature → global)';
                    } else {
                      hint = 'No auth configured at scenario or feature level.';
                    }
                    return <div className="auth-inherit-hint">{hint}</div>;
                  })()}
                  {draft.auth.type === 'basic' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Username</label>
                        <input value={draft.auth.username || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
                      </div>
                      <div>
                        <label>Password</label>
                        <input type="password" value={draft.auth.password || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
                      </div>
                    </div>
                  )}
                  {draft.auth.type === 'bearer' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Token</label>
                        <input value={draft.auth.token || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, token: e.target.value } })} placeholder="eyJhbGciOi..." />
                      </div>
                      <div>
                        <label>Prefix</label>
                        <input value={draft.auth.prefix ?? 'Bearer'} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, prefix: e.target.value } })} placeholder="Bearer" />
                      </div>
                    </div>
                  )}
                  {draft.auth.type === 'apikey' && (
                    <>
                      <div className="form-row two-col">
                        <div>
                          <label>Key Name</label>
                          <input value={draft.auth.apiKeyName || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyName: e.target.value } })} placeholder="X-API-Key" />
                        </div>
                        <div>
                          <label>Key Value</label>
                          <input value={draft.auth.apiKeyValue || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyValue: e.target.value } })} placeholder="your-api-key" />
                        </div>
                      </div>
                      <div className="form-row">
                        <label>Add to</label>
                        <div className="radio-group">
                          <label className="radio-label">
                            <input type="radio" checked={draft.auth.apiKeyIn !== 'query'} onChange={() => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyIn: 'header' } })} />
                            Header
                          </label>
                          <label className="radio-label">
                            <input type="radio" checked={draft.auth.apiKeyIn === 'query'} onChange={() => onDraftChange({ ...draft, auth: { ...draft.auth, apiKeyIn: 'query' } })} />
                            Query Parameter
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                  {draft.auth.type === 'digest' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Username</label>
                        <input value={draft.auth.username || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
                      </div>
                      <div>
                        <label>Password</label>
                        <input type="password" value={draft.auth.password || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
                      </div>
                    </div>
                  )}
                  {draft.auth.type === 'oauth2' && (
                    <>
                      <div className="form-row">
                        <label>Token URL</label>
                        <input value={draft.auth.tokenUrl || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, tokenUrl: e.target.value } })} placeholder="https://auth.example.com/oauth/token" />
                      </div>
                      <div className="form-row two-col">
                        <div>
                          <label>Client ID</label>
                          <input value={draft.auth.clientId || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, clientId: e.target.value } })} />
                        </div>
                        <div>
                          <label>Client Secret</label>
                          <div className="secret-input-wrap">
                            <input type={showSecret ? 'text' : 'password'} value={draft.auth.clientSecret || ''} onChange={(e) => onDraftChange({ ...draft, auth: { ...draft.auth, clientSecret: e.target.value } })} />
                            <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {draft.auth.type !== 'none' && draft.auth.type !== 'inherit' && (
                    <div className="auth-verify-section">
                      <button
                        type="button"
                        className="btn btn-sm btn-verify"
                        onClick={() => { setAuthVerifyResult(null); void verifyAuth(draft.auth); }}
                        disabled={authVerifying}
                      >
                        {authVerifying ? 'Verifying...' : 'Verify Auth'}
                      </button>
                      {authVerifyResult && (
                        <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
                          <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                          <div className="auth-verify-body">
                            <span className="auth-verify-msg">{authVerifyResult.message}</span>
                            {authVerifyResult.detail && <pre className="auth-verify-detail">{authVerifyResult.detail}</pre>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {draft.auth.type === 'inherit' && (() => {
                    const { auth: resolved, source } = resolveEffectiveAuth();
                    if (resolved.type === 'none') return null;
                    return (
                      <div className="auth-verify-section">
                        <button
                          type="button"
                          className="btn btn-sm btn-verify"
                          onClick={() => { setAuthVerifyResult(null); void verifyAuth(resolved); }}
                          disabled={authVerifying}
                        >
                          {authVerifying ? 'Verifying...' : `Verify Inherited Auth (${source})`}
                        </button>
                        {authVerifyResult && (
                          <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
                            <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                            <div className="auth-verify-body">
                              <span className="auth-verify-msg">{authVerifyResult.message}</span>
                              {authVerifyResult.detail && <pre className="auth-verify-detail">{authVerifyResult.detail}</pre>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
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
                <div>
                  <div className="radio-group">
                    {(['none', 'full', 'selective'] as ValidationMode[]).map((m) => (
                      <label key={m} className="radio-label">
                        <input type="radio" name="validationMode" checked={draft.validation.mode === m} onChange={() => onDraftChange({ ...draft, validation: { ...draft.validation, mode: m } })} />
                        {m === 'none' ? 'No Validation' : m === 'full' ? 'Full JSON Match' : 'Selective Fields'}
                      </label>
                    ))}
                  </div>
                  {draft.validation.mode === 'full' && (
                    <div className="form-row">
                      <label>Expected JSON Response</label>
                      <textarea
                        rows={10}
                        value={draft.validation.expectedJson || ''}
                        onChange={(e) => onDraftChange({ ...draft, validation: { ...draft.validation, expectedJson: e.target.value } })}
                        placeholder='Paste the complete expected JSON response here'
                      />
                    </div>
                  )}
                  {draft.validation.mode === 'selective' && (
                    <>
                      <div className="validation-options">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={draft.validation.unorderedArrays || false}
                            onChange={(e) => {
                              const prev = draftRef.current;
                              onDraftChange({ ...prev, validation: { ...prev.validation, unorderedArrays: e.target.checked } });
                            }}
                          />
                          Unordered array matching
                          <span className="option-hint">— ignore array item positions, match by value instead</span>
                        </label>
                      </div>
                      <div className="fetch-host-override-row">
                        <button
                          type="button"
                          className="btn btn-sm btn-accent"
                          onClick={() => void handleFetchSampleResponse()}
                          disabled={fetchingResponse}
                        >
                          {fetchingResponse ? 'Fetching...' : 'Fetch Response'}
                        </button>
                        <label className="checkbox-label fetch-host-toggle">
                          <input
                            type="checkbox"
                            checked={fetchHostEnabled}
                            onChange={(e) => setFetchHostEnabled(e.target.checked)}
                          />
                          Host Override
                        </label>
                        <input
                          value={fetchHostOverride}
                          onChange={(e) => setFetchHostOverride(e.target.value)}
                          placeholder={resolvedBaseUrl || 'Enter base URL'}
                          disabled={!fetchHostEnabled}
                        />
                        {fetchHostEnabled && resolvedBaseUrl && !fetchHostOverride && (
                          <button type="button" className="btn btn-sm" onClick={() => setFetchHostOverride(resolvedBaseUrl)} title="Use Settings base URL">Use Settings</button>
                        )}
                      </div>
                      {fetchError && <div className="fetch-error-inline">{fetchError}</div>}
                      <JsonPathBuilder
                        sampleJson={draft.validation.sampleJson || ''}
                        onSampleJsonChange={(json) => {
                          const prev = draftRef.current;
                          onDraftChange({ ...prev, validation: { ...prev.validation, sampleJson: json } });
                        }}
                        selectiveMode={draft.validation.selectiveMode || 'include'}
                        expectedFields={draft.validation.expectedFields || []}
                        excludedPaths={draft.validation.excludedPaths || []}
                        onUpdate={(patch) => {
                          const prev = draftRef.current;
                          onDraftChange({ ...prev, validation: { ...prev.validation, ...patch } });
                        }}
                      />

                      {/* Validate Response button + results */}
                      {draft.validation.mode !== 'none' && (draft.validation.expectedFields || []).length > 0 && (
                        <div className="validate-response-section">
                          <div className="validate-response-row">
                            <button
                              type="button"
                              className="btn btn-sm btn-validate"
                              onClick={() => void handleValidateResponse()}
                              disabled={validating}
                            >
                              {validating ? 'Validating...' : 'Verify Rules'}
                            </button>
                            <label className="checkbox-label fetch-host-toggle">
                              <input
                                type="checkbox"
                                checked={fetchHostEnabled}
                                onChange={(e) => setFetchHostEnabled(e.target.checked)}
                              />
                              Host Override
                            </label>
                            <input
                              className="validate-host-input"
                              value={fetchHostOverride}
                              onChange={(e) => setFetchHostOverride(e.target.value)}
                              placeholder={resolvedBaseUrl || 'Enter base URL'}
                              disabled={!fetchHostEnabled}
                            />
                            {fetchHostEnabled && resolvedBaseUrl && !fetchHostOverride && (
                              <button type="button" className="btn btn-sm" onClick={() => setFetchHostOverride(resolvedBaseUrl)} title="Use Settings base URL">Use Settings</button>
                            )}
                          </div>
                          {validationResult && (
                            <div className={`validate-result ${validationResult.passed ? 'validate-pass' : 'validate-fail'}`}>
                              <div className="validate-result-header">
                                <span className={`validate-badge ${validationResult.passed ? 'badge-pass' : 'badge-fail'}`}>
                                  {validationResult.passed ? 'PASSED' : 'FAILED'}
                                </span>
                                {validationResult.httpStatus && (
                                  <span className="validate-http-status">HTTP {validationResult.httpStatus}</span>
                                )}
                                <span className="validate-summary">
                                  {validationResult.passed
                                    ? `All ${(draft.validation.expectedFields || []).length} rules matched`
                                    : `${validationResult.failures.length} discrepanc${validationResult.failures.length === 1 ? 'y' : 'ies'} found`}
                                </span>
                                <button className="btn btn-xs" onClick={() => setValidationResult(null)}>×</button>
                              </div>
                              {!validationResult.passed && validationResult.failures.length > 0 && (
                                <table className="validate-failures-table">
                                  <thead>
                                    <tr>
                                      <th>Path</th>
                                      <th>Expected</th>
                                      <th>Actual</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {validationResult.failures.map((f, i) => (
                                      <tr key={i}>
                                        <td><code>{f.path}</code></td>
                                        <td className="val-expected">{f.expected}</td>
                                        <td className="val-actual">{f.actual}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <ResponseVersionPanel
                        versions={draft.validation.responseVersions || []}
                        currentJson={draft.validation.sampleJson || ''}
                        currentValidation={draft.validation}
                        excludedPaths={draft.validation.excludedPaths}
                        onSaveVersion={() => {
                          const prev = draftRef.current;
                          const v = prev.validation;
                          const json = v.sampleJson || '';
                          if (!json.trim()) return;
                          const prevVersions = v.responseVersions || [];
                          const newVersion: ResponseVersion = {
                            id: uuidv4(), timestamp: Date.now(), json,
                            validationMode: v.mode, selectiveMode: v.selectiveMode,
                            expectedFields: v.expectedFields ? [...v.expectedFields] : [],
                            excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
                            unorderedArrays: v.unorderedArrays,
                          };
                          onDraftChange({ ...prev, validation: { ...v, responseVersions: [...prevVersions, newVersion] } });
                        }}
                        onRestore={(ver) => {
                          const prev = draftRef.current;
                          onDraftChange({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              sampleJson: ver.json,
                              mode: ver.validationMode || prev.validation.mode,
                              selectiveMode: ver.selectiveMode || prev.validation.selectiveMode,
                              expectedFields: ver.expectedFields || [],
                              excludedPaths: ver.excludedPaths || prev.validation.excludedPaths || [],
                              unorderedArrays: ver.unorderedArrays ?? prev.validation.unorderedArrays,
                            },
                          });
                        }}
                        onDeleteVersion={(id) => {
                          const prev = draftRef.current;
                          onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).filter((v) => v.id !== id) } });
                        }}
                        onRenameVersion={(id, label) => {
                          const prev = draftRef.current;
                          onDraftChange({ ...prev, validation: { ...prev.validation, responseVersions: (prev.validation.responseVersions || []).map((v) => v.id === id ? { ...v, label } : v) } });
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
