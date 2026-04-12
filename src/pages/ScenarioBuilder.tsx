import { useState, useMemo, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup, Microservice, AuthType, AuthConfig, ValidationMode, KeyValue, ExpectedField, GlobalAuthProfile } from '../types';
import { parseCurl } from '../utils/curlParser';
import { proxyFetch, acquireOAuth2Token, buildHeaders } from '../engine/executor';
import { saveJsonFile, buildExportFilename } from '../utils/fileSaver';
import JsonPathBuilder from '../components/JsonPathBuilder';

const emptyTest = (): Scenario => ({
  id: uuidv4(),
  name: '',
  url: '',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  body: '',
  auth: { type: 'inherit' },
  validation: { mode: 'none', expectedFields: [] },
});

type BuilderTab = 'params' | 'body' | 'auth' | 'headers' | 'validation';
type InputMode = 'builder' | 'curl' | 'curl-export';

// Parse query params from a URL string
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

// Rebuild URL from base + query params
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

// Get base URL without query string
function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

interface Props {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  resolvedBaseUrl?: string;
  selectedSvcId?: string;
  selectedSvcName?: string;
  selectedEnvId?: string;
  selectedEnvName?: string;
  unassociatedFeatureGroups?: FeatureGroup[];
  microservices?: Microservice[];
  environments?: { id: string; name: string }[];
  globalAuthProfiles?: GlobalAuthProfile[];
}

export default function ScenarioBuilder({ featureGroups, setFeatureGroups, resolvedBaseUrl, selectedSvcId, selectedSvcName, selectedEnvId, selectedEnvName, unassociatedFeatureGroups = [], microservices = [], environments = [], globalAuthProfiles = [] }: Props) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  const [namingFeature, setNamingFeature] = useState(false);
  const [namingScenario, setNamingScenario] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [editingFeatureName, setEditingFeatureName] = useState<string | null>(null);
  const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Feature auth editing
  const [editingFeatureAuth, setEditingFeatureAuth] = useState<string | null>(null);

  // Scenario auth editing
  const [editingScenarioAuth, setEditingScenarioAuth] = useState<string | null>(null);

  const [editingTest, setEditingTest] = useState<{ featureId: string; scenarioId: string; testId: string | 'new' } | null>(null);
  const [draft, setDraft] = useState<Scenario>(emptyTest());

  // Builder state
  const [inputMode, setInputMode] = useState<InputMode>('builder');
  const [activeTab, setActiveTab] = useState<BuilderTab>('params');
  const [curlText, setCurlText] = useState('');
  const [generatedCurl, setGeneratedCurl] = useState('');
  const [curlGenerating, setCurlGenerating] = useState(false);
  const [queryParams, setQueryParams] = useState<KeyValue[]>([{ key: '', value: '' }]);

  // Drag-and-drop state
  const [dragScenario, setDragScenario] = useState<{ scenarioId: string; fromFeatureId: string } | null>(null);
  const [dragTest, setDragTest] = useState<{ testId: string; fromFeatureId: string; fromScenarioId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'scenario' | 'test'; featureId: string; scenarioId?: string; position?: 'before' | 'after'; targetId?: string } | null>(null);
  const dragHandleActive = useRef(false);

  // load/save is handled by App.tsx to avoid overwriting unfiltered groups

  // Sync query params when URL changes externally (e.g., from cURL parse)
  const syncParamsFromUrl = useCallback((url: string) => {
    setQueryParams(parseQueryParams(url));
  }, []);

  // Feature Group CRUD
  const addFeatureGroup = () => {
    if (!newName.trim() || !selectedSvcId || !selectedEnvId) return;
    const fg: FeatureGroup = { id: uuidv4(), name: newName.trim(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: [] };
    setFeatureGroups((prev) => [...prev, fg]);
    setExpandedFeatures((prev) => new Set(prev).add(fg.id));
    setNamingFeature(false);
    setNewName('');
  };

  const assignFeatureGroup = (fgId: string, svcId: string, envId: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === fgId ? { ...fg, microserviceId: svcId, environmentId: envId } : fg
    ));
  };

  const removeFeatureGroup = (id: string) => {
    const fg = [...featureGroups, ...unassociatedFeatureGroups].find((f) => f.id === id);
    const testCount = fg ? fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0) : 0;
    const detail = testCount > 0 ? ` It contains ${fg!.scenarios.length} scenario(s) and ${testCount} test(s).` : '';
    if (!window.confirm(`Delete feature group "${fg?.name}"?${detail} This cannot be undone.`)) return;
    setFeatureGroups((prev) => prev.filter((f) => f.id !== id));
  };

  const renameFeatureGroup = (id: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) => fg.id === id ? { ...fg, name: editName.trim() } : fg));
    setEditingFeatureName(null);
    setEditName('');
  };

  const addScenario = (featureId: string) => {
    if (!newName.trim()) return;
    const sc: TestScenario = { id: uuidv4(), name: newName.trim(), tests: [] };
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, scenarios: [...fg.scenarios, sc] } : fg
    ));
    setExpandedScenarios((prev) => new Set(prev).add(sc.id));
    setNamingScenario(null);
    setNewName('');
  };

  const removeScenario = (featureId: string, scenarioId: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) } : fg
    ));
  };

  const renameScenario = (featureId: string, scenarioId: string) => {
    if (!editName.trim()) return;
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, name: editName.trim() } : sc) }
        : fg
    ));
    setEditingScenarioName(null);
    setEditName('');
  };

  // Feature auth
  const updateFeatureAuth = (featureId: string, auth: AuthConfig, globalAuthProfileId?: string) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, auth, globalAuthProfileId: globalAuthProfileId ?? (auth.type === 'inherit' ? fg.globalAuthProfileId : undefined) } : fg
    ));
  };

  const toggleFeatureAuth = (featureId: string) => {
    setAuthVerifyResult(null);
    if (editingFeatureAuth === featureId) {
      setEditingFeatureAuth(null);
    } else {
      setEditingFeatureAuth(featureId);
      const fg = featureGroups.find((f) => f.id === featureId);
      if (fg && !fg.auth) {
        updateFeatureAuth(featureId, { type: 'none' });
      }
    }
  };

  // Scenario auth
  const updateScenarioAuth = (featureId: string, scenarioId: string, auth: AuthConfig) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, auth } : sc) }
        : fg
    ));
  };

  const toggleScenarioAuth = (featureId: string, scenarioId: string) => {
    setAuthVerifyResult(null);
    setEditingFeatureAuth(null);
    if (editingScenarioAuth === scenarioId) {
      setEditingScenarioAuth(null);
    } else {
      setEditingScenarioAuth(scenarioId);
      const fg = featureGroups.find((f) => f.id === featureId);
      const sc = fg?.scenarios.find((s) => s.id === scenarioId);
      if (sc && !sc.auth) {
        updateScenarioAuth(featureId, scenarioId, { type: 'none' });
      }
    }
  };

  // Test CRUD
  const startNewTest = (featureId: string, scenarioId: string) => {
    const t = emptyTest();
    setDraft(t);
    setEditingTest({ featureId, scenarioId, testId: 'new' });
    setInputMode('builder');
    setActiveTab('params');
    setCurlText('');
    setQueryParams([{ key: '', value: '' }]);
    setAuthVerifyResult(null);
  };

  const startEditTest = (featureId: string, scenarioId: string, test: Scenario) => {
    setDraft({
      ...test,
      headers: [...test.headers],
      validation: { ...test.validation, expectedFields: test.validation.expectedFields ? [...test.validation.expectedFields] : [] },
    });
    setEditingTest({ featureId, scenarioId, testId: test.id });
    setInputMode('builder');
    setActiveTab('params');
    setCurlText('');
    syncParamsFromUrl(test.url);
  };

  const saveTest = () => {
    if (!editingTest || !draft.name.trim() || !draft.url.trim()) return;
    const { featureId, scenarioId, testId } = editingTest;
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          if (testId === 'new') return { ...sc, tests: [...sc.tests, draft] };
          return { ...sc, tests: sc.tests.map((t) => t.id === draft.id ? draft : t) };
        }),
      };
    }));
    setEditingTest(null);
  };

  const removeTest = (featureId: string, scenarioId: string, testId: string) => {
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
        }),
      };
    }));
  };

  // Copy test — shows destination picker
  const [copyingTest, setCopyingTest] = useState<{ test: Scenario; sourceFeatureId: string; sourceScenarioId: string } | null>(null);
  const [copyTargetFeature, setCopyTargetFeature] = useState('');
  const [copyTargetScenario, setCopyTargetScenario] = useState('');

  const startCopyTest = (featureId: string, scenarioId: string, test: Scenario) => {
    setCopyingTest({ test, sourceFeatureId: featureId, sourceScenarioId: scenarioId });
    setCopyTargetFeature(featureId);
    setCopyTargetScenario(scenarioId);
  };

  const confirmCopyTest = () => {
    if (!copyingTest || !copyTargetFeature || !copyTargetScenario) return;
    const copy: Scenario = {
      ...copyingTest.test,
      id: uuidv4(),
      name: `${copyingTest.test.name} (copy)`,
      headers: copyingTest.test.headers.map((h) => ({ ...h })),
      validation: { ...copyingTest.test.validation, expectedFields: copyingTest.test.validation.expectedFields?.map((f) => ({ ...f })) },
    };
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== copyTargetFeature) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== copyTargetScenario) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
    }));
    setCopyingTest(null);
  };

  // Query param helpers
  const updateQueryParam = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...queryParams];
    next[index] = { ...next[index], [field]: val };
    setQueryParams(next);
    if (draft.url) {
      setDraft((prev) => ({ ...prev, url: rebuildUrl(prev.url, next) }));
    }
  };
  const addQueryParam = () => setQueryParams([...queryParams, { key: '', value: '' }]);
  const removeQueryParam = (index: number) => {
    const next = queryParams.filter((_, i) => i !== index);
    if (next.length === 0) next.push({ key: '', value: '' });
    setQueryParams(next);
    if (draft.url) {
      setDraft((prev) => ({ ...prev, url: rebuildUrl(prev.url, next) }));
    }
  };

  // Header helpers
  const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
    const headers = [...draft.headers];
    headers[index] = { ...headers[index], [field]: val };
    setDraft({ ...draft, headers });
  };
  const addHeader = () => setDraft({ ...draft, headers: [...draft.headers, { key: '', value: '' }] });
  const removeHeader = (index: number) => setDraft({ ...draft, headers: draft.headers.filter((_, i) => i !== index) });

  // Validation field helpers
  const updateExpectedField = (index: number, field: keyof ExpectedField, val: string) => {
    const fields = [...(draft.validation.expectedFields || [])];
    fields[index] = { ...fields[index], [field]: val };
    setDraft({ ...draft, validation: { ...draft.validation, expectedFields: fields } });
  };
  const addExpectedField = () => {
    setDraft({
      ...draft,
      validation: {
        ...draft.validation,
        expectedFields: [...(draft.validation.expectedFields || []), { jsonPath: '', expectedValue: '' }],
      },
    });
  };
  const removeExpectedField = (index: number) => {
    setDraft({
      ...draft,
      validation: {
        ...draft.validation,
        expectedFields: (draft.validation.expectedFields || []).filter((_, i) => i !== index),
      },
    });
  };

  const [fetchingResponse, setFetchingResponse] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchHostOverride, setFetchHostOverride] = useState('');
  const [fetchHostEnabled, setFetchHostEnabled] = useState(false);

  const [authVerifying, setAuthVerifying] = useState(false);
  const [authVerifyResult, setAuthVerifyResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

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

  // Resolve effective auth with priority chain: Test → Scenario → Feature
  // Auth resolution chain: Test → Scenario → Feature → Global Profile
  const resolveEffectiveAuth = useCallback((): { auth: AuthConfig; source: string } => {
    if (draft.auth.type !== 'inherit' && draft.auth.type !== 'none') {
      return { auth: draft.auth, source: 'test' };
    }
    if (editingTest) {
      const fg = featureGroups.find((f) => f.id === editingTest.featureId);
      const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
      if (draft.auth.type === 'inherit' || draft.auth.type === 'none') {
        if (sc?.auth && sc.auth.type !== 'none' && sc.auth.type !== 'inherit') {
          return { auth: sc.auth, source: 'scenario' };
        }
        if (fg?.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit') {
          return { auth: fg.auth, source: 'feature' };
        }
        // Feature inherits from global profile
        if (fg?.auth?.type === 'inherit' && fg.globalAuthProfileId) {
          const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
          if (profile && profile.auth.type !== 'none') {
            return { auth: profile.auth, source: `global:${profile.name}` };
          }
        }
        // Feature has no auth but has a global profile linked
        if ((!fg?.auth || fg.auth.type === 'none') && fg?.globalAuthProfileId) {
          const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
          if (profile && profile.auth.type !== 'none') {
            return { auth: profile.auth, source: `global:${profile.name}` };
          }
        }
      }
    }
    return { auth: { type: 'none' }, source: 'none' };
  }, [draft.auth, editingTest, featureGroups, globalAuthProfiles]);

  const handleFetchSampleResponse = useCallback(async () => {
    if (!draft.url.trim()) {
      setFetchError('URL is required');
      return;
    }
    setFetchingResponse(true);
    setFetchError(null);
    try {
      const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();

      // Build headers — skip manual Authorization when auth is configured (same as executor)
      const reqHeaders: Record<string, string> = {};
      for (const h of draft.headers) {
        if (!h.key.trim()) continue;
        if (h.key.trim().toLowerCase() === 'authorization' && effectiveAuth.type !== 'none') continue;
        reqHeaders[h.key.trim()] = h.value;
      }
      if (draft.body && !reqHeaders['Content-Type']) {
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

      let fetchUrl = draft.url;
      if (fetchHostEnabled && fetchHostOverride.trim()) {
        try {
          const orig = new URL(fetchUrl);
          const base = new URL(fetchHostOverride.trim().endsWith('/') ? fetchHostOverride.trim() : fetchHostOverride.trim() + '/');
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

      const reqBody = (draft.body && draft.method !== 'GET') ? draft.body : undefined;
      const result = await proxyFetch(fetchUrl, draft.method, reqHeaders, reqBody);
      if (result.error) {
        setFetchError(result.error);
      } else if (result.status >= 400) {
        setFetchError(`HTTP ${result.status}: ${result.statusText}`);
        if (result.body) {
          let pretty: string;
          try { pretty = JSON.stringify(JSON.parse(result.body), null, 2); } catch { pretty = result.body; }
          setDraft((prev) => ({ ...prev, validation: { ...prev.validation, sampleJson: pretty } }));
        }
      } else {
        let pretty: string;
        try {
          pretty = JSON.stringify(JSON.parse(result.body), null, 2);
        } catch {
          pretty = result.body;
        }
        setDraft((prev) => ({
          ...prev,
          validation: {
            ...prev.validation,
            sampleJson: pretty,
            expectedFields: [],
            excludedPaths: [],
          },
        }));
        setFetchError(null);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingResponse(false);
    }
  }, [draft, editingTest, featureGroups, resolveEffectiveAuth]);

  // Handle URL bar change — update base URL, keep params
  const handleBaseUrlChange = (newBaseUrl: string) => {
    const nonEmptyParams = queryParams.filter((p) => p.key.trim());
    if (nonEmptyParams.length > 0) {
      try {
        const u = new URL(newBaseUrl);
        nonEmptyParams.forEach((p) => u.searchParams.set(p.key.trim(), p.value));
        setDraft({ ...draft, url: u.toString() });
      } catch {
        setDraft({ ...draft, url: newBaseUrl });
      }
    } else {
      setDraft({ ...draft, url: newBaseUrl });
    }
  };

  // Handle cURL import
  const handleCurlImport = () => {
    if (!curlText.trim()) return;
    const parsed = parseCurl(curlText);
    setDraft((prev) => ({ ...prev, ...parsed, validation: prev.validation }));
    syncParamsFromUrl(parsed.url || '');
    setInputMode('builder');
    setCurlText('');
  };

  // Generate cURL command from the current draft configuration (async to acquire real token)
  const generateCurl = useCallback(async (): Promise<string> => {
    const parts: string[] = ['curl'];

    if (draft.method !== 'GET') {
      parts.push(`-X ${draft.method}`);
    }

    parts.push(`'${draft.url}'`);

    const headerEntries: { key: string; value: string }[] = [];
    const { auth: effectiveAuth } = resolveEffectiveAuth();

    for (const h of draft.headers) {
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
          const url = new URL(draft.url);
          url.searchParams.set(effectiveAuth.apiKeyName, effectiveAuth.apiKeyValue);
          parts[parts.indexOf(`'${draft.url}'`)] = `'${url.toString()}'`;
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

    if (draft.body && !headerEntries.some((h) => h.key.toLowerCase() === 'content-type')) {
      headerEntries.push({ key: 'Content-Type', value: 'application/json' });
    }

    for (const h of headerEntries) {
      parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
    }

    if (draft.body) {
      const escaped = draft.body.replace(/'/g, "'\\''");
      parts.push(`\\\n  -d '${escaped}'`);
    }

    return parts.join(' ');
  }, [draft, resolveEffectiveAuth]);

  const triggerCurlGeneration = useCallback(async () => {
    if (!draft.url.trim()) {
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
  }, [draft, generateCurl]);

  // ── Export / Import helpers ──
  const downloadJson = (data: unknown, filename: string) => saveJsonFile(data, filename);

  const pickJsonFile = (onLoad: (data: unknown) => void) => {
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
        } catch { alert('Failed to parse JSON file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const reIdScenarios = (scenarios: TestScenario[]) =>
    scenarios.map((sc) => ({ ...sc, id: uuidv4(), tests: sc.tests.map((t) => ({ ...t, id: uuidv4() })) }));

  const wrapExport = (data: unknown, level: string) => ({
    _exportMeta: {
      microservice: selectedSvcName || undefined,
      environment: selectedEnvName || undefined,
      exportedAt: new Date().toISOString(),
      level,
    },
    data,
  });

  const fname = (level: string, name?: string) =>
    buildExportFilename({ env: selectedEnvName, svc: selectedSvcName, level, name });

  const unwrapImport = (raw: unknown): unknown => {
    if (raw && typeof raw === 'object' && '_exportMeta' in raw && 'data' in raw) {
      return (raw as { data: unknown }).data;
    }
    return raw;
  };

  // All feature groups
  const exportAll = () => downloadJson(wrapExport(featureGroups, 'feature-groups'), fname('feature-groups'));

  const importAll = () => {
    if (!selectedSvcId || !selectedEnvId) { alert('Select a microservice and environment first.'); return; }
    pickJsonFile((raw) => {
      const data = unwrapImport(raw);
      const items = Array.isArray(data) ? data as FeatureGroup[] : [data as FeatureGroup];
      if (!items.every((fg) => fg.name && Array.isArray(fg.scenarios))) {
        alert('Invalid file: expected feature group(s).'); return;
      }
      const existingNames = new Set(featureGroups.map((fg) => fg.name.toLowerCase()));
      const existingIds = new Set(featureGroups.map((fg) => fg.id));
      const conflicts = items.filter((fg) => existingNames.has(fg.name.toLowerCase()) || existingIds.has(fg.id));
      if (conflicts.length > 0) {
        const names = conflicts.map((fg) => `  • "${fg.name}"`).join('\n');
        if (!window.confirm(`The following feature groups already exist:\n${names}\n\nImport as new copies with fresh IDs?`)) return;
      }
      const imported = items.map((fg) => ({ ...fg, id: uuidv4(), microserviceId: selectedSvcId, environmentId: selectedEnvId, scenarios: reIdScenarios(fg.scenarios) }));
      setFeatureGroups((prev) => [...prev, ...imported]);
    });
  };

  // Single feature group
  const exportFeatureGroup = (fg: FeatureGroup) =>
    downloadJson(wrapExport(fg, 'feature-group'), fname('feature', fg.name));

  const importScenariosInto = (featureId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as TestScenario[] : [data as TestScenario];
    if (!items.every((sc) => sc.name && Array.isArray(sc.tests))) {
      alert('Invalid file: expected scenario(s) with a name and tests array.'); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    if (fg) {
      const existingNames = new Set(fg.scenarios.map((sc) => sc.name.toLowerCase()));
      const dupes = items.filter((sc) => existingNames.has(sc.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((sc) => `  • "${sc.name}"`).join('\n');
        if (!window.confirm(`These scenarios already exist in "${fg.name}":\n${names}\n\nImport as new copies?`)) return;
      }
    }
    const imported = reIdScenarios(items);
    setFeatureGroups((prev) => prev.map((f) =>
      f.id === featureId ? { ...f, scenarios: [...f.scenarios, ...imported] } : f
    ));
  });

  // Single scenario
  const exportScenario = (sc: TestScenario) =>
    downloadJson(wrapExport(sc, 'scenario'), fname('scenario', sc.name));

  const importTestsInto = (featureId: string, scenarioId: string) => pickJsonFile((raw) => {
    const data = unwrapImport(raw);
    const items = Array.isArray(data) ? data as Scenario[] : [data as Scenario];
    if (!items.every((t) => t.name && t.url && t.method)) {
      alert('Invalid file: expected test(s) with name, url, and method.'); return;
    }
    const fg = featureGroups.find((f) => f.id === featureId);
    const sc = fg?.scenarios.find((s) => s.id === scenarioId);
    if (sc) {
      const existingNames = new Set(sc.tests.map((t) => t.name.toLowerCase()));
      const dupes = items.filter((t) => existingNames.has(t.name.toLowerCase()));
      if (dupes.length > 0) {
        const names = dupes.map((t) => `  • "${t.name}"`).join('\n');
        if (!window.confirm(`These tests already exist in "${sc.name}":\n${names}\n\nImport as new copies?`)) return;
      }
    }
    const imported = items.map((t) => ({ ...t, id: uuidv4() }));
    setFeatureGroups((prev) => prev.map((f) => {
      if (f.id !== featureId) return f;
      return { ...f, scenarios: f.scenarios.map((s) =>
        s.id === scenarioId ? { ...s, tests: [...s.tests, ...imported] } : s
      )};
    }));
  });

  // Single test
  const exportTest = (t: Scenario) =>
    downloadJson(wrapExport(t, 'test'), fname('test', t.name));

  const toggleFeature = (id: string) => {
    setExpandedFeatures((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleScenario = (id: string) => {
    setExpandedScenarios((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Counts for tab badges
  const paramCount = useMemo(() => queryParams.filter((p) => p.key.trim()).length, [queryParams]);
  const headerCount = useMemo(() => draft.headers.filter((h) => h.key.trim()).length, [draft.headers]);
  const totalTests = featureGroups.reduce((sum, fg) => sum + fg.scenarios.reduce((s2, sc) => s2 + sc.tests.length, 0), 0);

  const baseUrl = useMemo(() => draft.url ? getBaseUrl(draft.url) : '', [draft.url]);

  // ── Drag-and-drop handlers ──
  const moveScenario = useCallback((scenarioId: string, fromFgId: string, toFgId: string, beforeScId?: string) => {
    if (fromFgId === toFgId && !beforeScId) return;
    setFeatureGroups((prev) => {
      let scenario: TestScenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        scenario = fg.scenarios.find((sc) => sc.id === scenarioId);
        return { ...fg, scenarios: fg.scenarios.filter((sc) => sc.id !== scenarioId) };
      });
      if (!scenario) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        const scenarios = fg.scenarios.filter((sc) => sc.id !== scenarioId);
        if (beforeScId) {
          const idx = scenarios.findIndex((sc) => sc.id === beforeScId);
          if (idx >= 0) { scenarios.splice(idx, 0, scenario!); return { ...fg, scenarios }; }
        }
        scenarios.push(scenario!);
        return { ...fg, scenarios };
      });
    });
  }, [setFeatureGroups]);

  const moveTest = useCallback((testId: string, fromFgId: string, fromScId: string, toFgId: string, toScId: string, beforeTestId?: string) => {
    if (fromFgId === toFgId && fromScId === toScId && !beforeTestId) return;
    setFeatureGroups((prev) => {
      let test: Scenario | undefined;
      const without = prev.map((fg) => {
        if (fg.id !== fromFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== fromScId) return sc;
            test = sc.tests.find((t) => t.id === testId);
            return { ...sc, tests: sc.tests.filter((t) => t.id !== testId) };
          }),
        };
      });
      if (!test) return prev;
      return without.map((fg) => {
        if (fg.id !== toFgId) return fg;
        return {
          ...fg,
          scenarios: fg.scenarios.map((sc) => {
            if (sc.id !== toScId) return sc;
            const tests = sc.tests.filter((t) => t.id !== testId);
            if (beforeTestId) {
              const idx = tests.findIndex((t) => t.id === beforeTestId);
              if (idx >= 0) { tests.splice(idx, 0, test!); return { ...sc, tests }; }
            }
            tests.push(test!);
            return { ...sc, tests };
          }),
        };
      });
    });
  }, [setFeatureGroups]);

  const handleDragEnd = useCallback(() => {
    if (dragScenario && dropTarget?.type === 'scenario') {
      moveScenario(dragScenario.scenarioId, dragScenario.fromFeatureId, dropTarget.featureId, dropTarget.targetId);
    }
    if (dragTest && dropTarget?.type === 'test' && dropTarget.scenarioId) {
      moveTest(dragTest.testId, dragTest.fromFeatureId, dragTest.fromScenarioId, dropTarget.featureId, dropTarget.scenarioId, dropTarget.targetId);
    }
    setDragScenario(null);
    setDragTest(null);
    setDropTarget(null);
  }, [dragScenario, dragTest, dropTarget, moveScenario, moveTest]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-block">
          <h2>Feature Groups</h2>
          {(selectedSvcName || selectedEnvName) && (
            <div className="context-tags">
              {selectedSvcName && <span className="context-tag svc-tag">{selectedSvcName}</span>}
              {selectedEnvName && <span className="context-tag env-tag">{selectedEnvName}</span>}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button className="btn" onClick={importAll} disabled={!selectedSvcId || !selectedEnvId}>Import</button>
          <button className="btn" onClick={exportAll} disabled={featureGroups.length === 0}>Export</button>
          <button className="btn btn-primary" onClick={() => { setNamingFeature(true); setNewName(''); }} disabled={!selectedSvcId || !selectedEnvId}>+ Add Feature Group</button>
        </div>
      </div>

      {(!selectedSvcId || !selectedEnvId) && (
        <div className="empty-state">Select both a microservice and an environment from the sidebar to view and manage feature groups.</div>
      )}

      {selectedSvcId && selectedEnvId && namingFeature && (
        <div className="inline-name-form">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFeatureGroup(); if (e.key === 'Escape') setNamingFeature(false); }}
            placeholder="Feature group name (e.g. Onboarding)" />
          <button className="btn btn-primary btn-sm" onClick={addFeatureGroup} disabled={!newName.trim()}>Create</button>
          <button className="btn btn-sm" onClick={() => setNamingFeature(false)}>Cancel</button>
        </div>
      )}

      {selectedSvcId && selectedEnvId && featureGroups.length === 0 && !namingFeature && (
        <div className="empty-state">No feature groups for this microservice + environment. Click "+ Add Feature Group" to get started.</div>
      )}

      <div className="feature-tree">
        {featureGroups.map((fg) => (
          <div key={fg.id} className="feature-group-card">
            <div className="feature-group-header" onClick={() => toggleFeature(fg.id)}>
              <span className={`expand-icon ${expandedFeatures.has(fg.id) ? 'expanded' : ''}`}>&#9654;</span>
              {editingFeatureName === fg.id ? (
                <input className="inline-edit-input" autoFocus value={editName}
                  onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') renameFeatureGroup(fg.id); if (e.key === 'Escape') setEditingFeatureName(null); }}
                  onBlur={() => renameFeatureGroup(fg.id)} />
              ) : (
                <strong className="feature-group-name">{fg.name}</strong>
              )}
              <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
              <span className="count-badge">{fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0)} test{fg.scenarios.reduce((s, sc) => s + sc.tests.length, 0) !== 1 ? 's' : ''}</span>
              {fg.auth && fg.auth.type === 'inherit' && fg.globalAuthProfileId && (() => {
                const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                return profile
                  ? <span className="count-badge auth-badge auth-badge-global">Auth: {profile.name}</span>
                  : <span className="count-badge auth-badge auth-badge-feature">Auth: inherit (missing profile)</span>;
              })()}
              {fg.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-feature">Auth: {fg.auth.type}</span>}
              <div className="feature-group-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => { setEditingFeatureName(fg.id); setEditName(fg.name); }}>Rename</button>
                <button
                  className={`btn btn-sm ${editingFeatureAuth === fg.id ? 'btn-active' : ''}`}
                  onClick={() => toggleFeatureAuth(fg.id)}
                >Auth</button>
                <button className="btn btn-sm" onClick={() => { setNamingScenario(fg.id); setNewName(''); }}>+ Scenario</button>
                <button className="btn btn-sm" onClick={() => importScenariosInto(fg.id)} title="Import scenarios into this feature group">Import</button>
                <button className="btn btn-sm" onClick={() => exportFeatureGroup(fg)} title="Export this feature group">Export</button>
                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>

            {/* Feature-level auth config panel */}
            {editingFeatureAuth === fg.id && (() => {
              const fgAuth = fg.auth || { type: 'none' as AuthType };
              return (
                <div className="scenario-auth-panel feature-auth-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="scenario-auth-header">
                    <strong>Feature Auth</strong>
                    <span className="auth-hint">Inherited by all scenarios in this feature (unless overridden)</span>
                  </div>
                  <div className="auth-type-select">
                    <label>Type</label>
                    <select
                      value={fgAuth.type}
                      onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, type: e.target.value as AuthType })}
                    >
                      {globalAuthProfiles.length > 0 && <option value="inherit">Inherit from Global Profile</option>}
                      <option value="none">No Auth</option>
                      <option value="basic">Basic Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="apikey">API Key</option>
                      <option value="digest">Digest Auth</option>
                      <option value="oauth2">OAuth2 Client Credentials</option>
                    </select>
                  </div>
                  {fgAuth.type === 'inherit' && globalAuthProfiles.length > 0 && (() => {
                    const selectedProfile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                    return (
                      <div className="global-profile-selector">
                        <label>Global Profile</label>
                        <select
                          value={fg.globalAuthProfileId || ''}
                          onChange={(e) => updateFeatureAuth(fg.id, fgAuth, e.target.value || undefined)}
                        >
                          <option value="">— Select a profile —</option>
                          {globalAuthProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                          ))}
                        </select>
                        {selectedProfile && (
                          <span className="auth-inherit-hint">
                            Using <strong>{selectedProfile.name}</strong> — {selectedProfile.auth.type.toUpperCase()}
                          </span>
                        )}
                        {!selectedProfile && fg.globalAuthProfileId && (
                          <span className="auth-inherit-hint auth-inherit-warn">
                            ⚠ Selected profile no longer exists
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  {fgAuth.type === 'basic' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Username</label>
                        <input value={fgAuth.username || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, username: e.target.value })} />
                      </div>
                      <div>
                        <label>Password</label>
                        <input type="password" value={fgAuth.password || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, password: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {fgAuth.type === 'bearer' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Token</label>
                        <input value={fgAuth.token || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, token: e.target.value })} placeholder="eyJhbGciOi..." />
                      </div>
                      <div>
                        <label>Prefix</label>
                        <input value={fgAuth.prefix ?? 'Bearer'} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, prefix: e.target.value })} placeholder="Bearer" />
                      </div>
                    </div>
                  )}
                  {fgAuth.type === 'apikey' && (
                    <>
                      <div className="form-row two-col">
                        <div>
                          <label>Key Name</label>
                          <input value={fgAuth.apiKeyName || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, apiKeyName: e.target.value })} placeholder="X-API-Key" />
                        </div>
                        <div>
                          <label>Key Value</label>
                          <input value={fgAuth.apiKeyValue || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, apiKeyValue: e.target.value })} placeholder="your-api-key" />
                        </div>
                      </div>
                      <div className="form-row">
                        <label>Add to</label>
                        <div className="radio-group">
                          <label className="radio-label">
                            <input type="radio" checked={fgAuth.apiKeyIn !== 'query'} onChange={() => updateFeatureAuth(fg.id, { ...fgAuth, apiKeyIn: 'header' })} />
                            Header
                          </label>
                          <label className="radio-label">
                            <input type="radio" checked={fgAuth.apiKeyIn === 'query'} onChange={() => updateFeatureAuth(fg.id, { ...fgAuth, apiKeyIn: 'query' })} />
                            Query Parameter
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                  {fgAuth.type === 'digest' && (
                    <div className="form-row two-col">
                      <div>
                        <label>Username</label>
                        <input value={fgAuth.username || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, username: e.target.value })} />
                      </div>
                      <div>
                        <label>Password</label>
                        <input type="password" value={fgAuth.password || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, password: e.target.value })} />
                      </div>
                    </div>
                  )}
                  {fgAuth.type === 'oauth2' && (
                    <>
                      <div className="form-row">
                        <label>Token URL</label>
                        <input value={fgAuth.tokenUrl || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
                      </div>
                      <div className="form-row two-col">
                        <div>
                          <label>Client ID</label>
                          <input value={fgAuth.clientId || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, clientId: e.target.value })} />
                        </div>
                        <div>
                          <label>Client Secret</label>
                          <div className="secret-input-wrap">
                            <input type={showSecret ? 'text' : 'password'} value={fgAuth.clientSecret || ''} onChange={(e) => updateFeatureAuth(fg.id, { ...fgAuth, clientSecret: e.target.value })} />
                            <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {fgAuth.type !== 'none' && (() => {
                    const authToVerify = fgAuth.type === 'inherit' && fg.globalAuthProfileId
                      ? globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId)?.auth
                      : fgAuth;
                    return (
                      <div className="auth-verify-section">
                        <button
                          className="btn btn-sm btn-verify"
                          onClick={() => { setAuthVerifyResult(null); if (authToVerify && authToVerify.type !== 'none') verifyAuth(authToVerify); }}
                          disabled={authVerifying || !authToVerify || authToVerify.type === 'none'}
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
                    );
                  })()}
                </div>
              );
            })()}

            {expandedFeatures.has(fg.id) && (
              <div className="feature-group-body">
                {namingScenario === fg.id && (
                  <div className="inline-name-form nested">
                    <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addScenario(fg.id); if (e.key === 'Escape') setNamingScenario(null); }}
                      placeholder="Scenario name (e.g. Happy Path)" />
                    <button className="btn btn-primary btn-sm" onClick={() => addScenario(fg.id)} disabled={!newName.trim()}>Create</button>
                    <button className="btn btn-sm" onClick={() => setNamingScenario(null)}>Cancel</button>
                  </div>
                )}
                {fg.scenarios.length === 0 && namingScenario !== fg.id && (
                  <div
                    className={`empty-hint ${dragScenario && dragScenario.fromFeatureId !== fg.id ? 'drop-zone-active' : ''} ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    {dragScenario ? 'Drop scenario here' : 'No scenarios. Click "+ Scenario" to add one.'}
                  </div>
                )}
                {fg.scenarios.map((sc) => {
                  const scAuth = sc.auth || { type: 'none' as AuthType };
                  const isScDragOver = dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && dropTarget.targetId === sc.id;
                  const isSelfScDrag = dragScenario?.scenarioId === sc.id && dragScenario?.fromFeatureId === fg.id;
                  return (
                  <div
                    key={`${fg.id}-${sc.id}`}
                    className={`scenario-group-card ${isSelfScDrag ? 'dragging' : ''} ${isScDragOver ? 'drop-target-before' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      if (!dragHandleActive.current) { e.preventDefault(); return; }
                      dragHandleActive.current = false;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', `sc:${fg.id}:${sc.id}`);
                      requestAnimationFrame(() => {
                        setDragScenario({ scenarioId: sc.id, fromFeatureId: fg.id });
                        setDragTest(null);
                      });
                    }}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (!dragScenario || isSelfScDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropTarget({ type: 'scenario', featureId: fg.id, targetId: sc.id });
                    }}
                  >
                    <div className="scenario-group-header" onClick={() => toggleScenario(sc.id)}>
                      <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                      <span className={`expand-icon small ${expandedScenarios.has(sc.id) ? 'expanded' : ''}`}>&#9654;</span>
                      {editingScenarioName === sc.id ? (
                        <input className="inline-edit-input" autoFocus value={editName}
                          onClick={(e) => e.stopPropagation()} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') renameScenario(fg.id, sc.id); if (e.key === 'Escape') setEditingScenarioName(null); }}
                          onBlur={() => renameScenario(fg.id, sc.id)} />
                      ) : (
                        <span className="scenario-group-name">{sc.name}</span>
                      )}
                      <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                      {scAuth.type !== 'none' && scAuth.type !== 'inherit' && <span className="count-badge auth-badge auth-badge-scenario">Auth: {scAuth.type}</span>}
                      {scAuth.type === 'inherit' && <span className="count-badge auth-badge auth-badge-scenario-inherit">Auth: inherit</span>}
                      <div className="scenario-group-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => { setEditingScenarioName(sc.id); setEditName(sc.name); }}>Rename</button>
                        <button
                          className={`btn btn-sm ${editingScenarioAuth === sc.id ? 'btn-active' : ''}`}
                          onClick={() => toggleScenarioAuth(fg.id, sc.id)}
                        >Auth</button>
                        <button className="btn btn-sm" onClick={() => startNewTest(fg.id, sc.id)}>+ Test</button>
                        <button className="btn btn-sm" onClick={() => importTestsInto(fg.id, sc.id)} title="Import tests into this scenario">Import</button>
                        <button className="btn btn-sm" onClick={() => exportScenario(sc)} title="Export this scenario">Export</button>
                        <button className="btn btn-sm btn-danger" onClick={() => removeScenario(fg.id, sc.id)}>Delete</button>
                      </div>
                    </div>

                    {/* Scenario-level auth config panel */}
                    {editingScenarioAuth === sc.id && (
                      <div className="scenario-auth-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="scenario-auth-header">
                          <strong>Scenario Auth</strong>
                          <span className="auth-hint">Applied to all tests in this scenario (unless overridden at test level)</span>
                        </div>
                        <div className="auth-type-select">
                          <label>Type</label>
                          <select
                            value={scAuth.type}
                            onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, type: e.target.value as AuthType })}
                          >
                            <option value="inherit">Inherit from Feature</option>
                            <option value="none">No Auth</option>
                            <option value="basic">Basic Auth</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="apikey">API Key</option>
                            <option value="digest">Digest Auth</option>
                            <option value="oauth2">OAuth2 Client Credentials</option>
                          </select>
                        </div>
                        {scAuth.type === 'inherit' && (() => {
                          const fgAuth = fg.auth;
                          const authLabel: Record<string, string> = {
                            basic: 'Basic Auth', bearer: 'Bearer Token', apikey: 'API Key',
                            digest: 'Digest Auth', oauth2: 'OAuth2 Client Credentials',
                          };
                          let hint: string;
                          if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') {
                            hint = `Will use feature-level ${authLabel[fgAuth.type] ?? fgAuth.type}`;
                          } else if (fgAuth?.type === 'inherit' && fg.globalAuthProfileId) {
                            const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
                            hint = profile
                              ? `Will use global profile "${profile.name}" (${authLabel[profile.auth.type] ?? profile.auth.type})`
                              : 'Feature references a missing global profile.';
                          } else {
                            hint = 'No auth configured at feature level. Configure it via the "Auth" button on the feature group.';
                          }
                          return <div className="auth-inherit-hint">{hint}</div>;
                        })()}
                        {scAuth.type === 'basic' && (
                          <div className="form-row two-col">
                            <div>
                              <label>Username</label>
                              <input value={scAuth.username || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, username: e.target.value })} />
                            </div>
                            <div>
                              <label>Password</label>
                              <input type="password" value={scAuth.password || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, password: e.target.value })} />
                            </div>
                          </div>
                        )}
                        {scAuth.type === 'bearer' && (
                          <div className="form-row two-col">
                            <div>
                              <label>Token</label>
                              <input value={scAuth.token || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, token: e.target.value })} placeholder="eyJhbGciOi..." />
                            </div>
                            <div>
                              <label>Prefix</label>
                              <input value={scAuth.prefix ?? 'Bearer'} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, prefix: e.target.value })} placeholder="Bearer" />
                            </div>
                          </div>
                        )}
                        {scAuth.type === 'apikey' && (
                          <>
                            <div className="form-row two-col">
                              <div>
                                <label>Key Name</label>
                                <input value={scAuth.apiKeyName || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, apiKeyName: e.target.value })} placeholder="X-API-Key" />
                              </div>
                              <div>
                                <label>Key Value</label>
                                <input value={scAuth.apiKeyValue || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, apiKeyValue: e.target.value })} placeholder="your-api-key" />
                              </div>
                            </div>
                            <div className="form-row">
                              <label>Add to</label>
                              <div className="radio-group">
                                <label className="radio-label">
                                  <input type="radio" checked={scAuth.apiKeyIn !== 'query'} onChange={() => updateScenarioAuth(fg.id, sc.id, { ...scAuth, apiKeyIn: 'header' })} />
                                  Header
                                </label>
                                <label className="radio-label">
                                  <input type="radio" checked={scAuth.apiKeyIn === 'query'} onChange={() => updateScenarioAuth(fg.id, sc.id, { ...scAuth, apiKeyIn: 'query' })} />
                                  Query Parameter
                                </label>
                              </div>
                            </div>
                          </>
                        )}
                        {scAuth.type === 'digest' && (
                          <div className="form-row two-col">
                            <div>
                              <label>Username</label>
                              <input value={scAuth.username || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, username: e.target.value })} />
                            </div>
                            <div>
                              <label>Password</label>
                              <input type="password" value={scAuth.password || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, password: e.target.value })} />
                            </div>
                          </div>
                        )}
                        {scAuth.type === 'oauth2' && (
                          <>
                            <div className="form-row">
                              <label>Token URL</label>
                              <input value={scAuth.tokenUrl || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, tokenUrl: e.target.value })} placeholder="https://auth.example.com/oauth/token" />
                            </div>
                            <div className="form-row two-col">
                              <div>
                                <label>Client ID</label>
                                <input value={scAuth.clientId || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, clientId: e.target.value })} />
                              </div>
                              <div>
                                <label>Client Secret</label>
                                <div className="secret-input-wrap">
                                  <input type={showSecret ? 'text' : 'password'} value={scAuth.clientSecret || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, clientSecret: e.target.value })} />
                                  <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        {scAuth.type !== 'none' && scAuth.type !== 'inherit' && (
                          <div className="auth-verify-section">
                            <button
                              className="btn btn-sm btn-verify"
                              onClick={() => { setAuthVerifyResult(null); verifyAuth(scAuth); }}
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
                        {scAuth.type === 'inherit' && (() => {
                          const fgAuth = fg.auth;
                          if (!fgAuth || fgAuth.type === 'none') return null;
                          return (
                            <div className="auth-verify-section">
                              <button
                                className="btn btn-sm btn-verify"
                                onClick={() => { setAuthVerifyResult(null); verifyAuth(fgAuth); }}
                                disabled={authVerifying}
                              >
                                {authVerifying ? 'Verifying...' : 'Verify Inherited Auth (feature)'}
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

                    {expandedScenarios.has(sc.id) && (
                      <div
                        className="scenario-group-body"
                        onDragOver={(e) => { if (dragTest && sc.tests.length === 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                        onDrop={() => { if (dragTest && sc.tests.length === 0) handleDragEnd(); }}
                      >
                        {sc.tests.length === 0 && (
                          <div className={`empty-hint ${dragTest ? 'drop-zone-active' : ''} ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}>
                            {dragTest ? 'Drop test here' : 'No tests. Click "+ Test" to add an HTTP request.'}
                          </div>
                        )}
                        {sc.tests.map((t, tIdx) => {
                          const isTestDragOver = dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && dropTarget.targetId === t.id;
                          const isSelfTestDrag = dragTest?.testId === t.id && dragTest?.fromFeatureId === fg.id && dragTest?.fromScenarioId === sc.id;
                          return (
                          <div
                            key={`${fg.id}-${sc.id}-${t.id}`}
                            className={`test-card ${isSelfTestDrag ? 'dragging' : ''} ${isTestDragOver ? 'drop-target-before' : ''}`}
                            draggable
                            onDragStart={(e) => {
                              if (!dragHandleActive.current) { e.preventDefault(); return; }
                              dragHandleActive.current = false;
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', `t:${fg.id}:${sc.id}:${t.id}`);
                              requestAnimationFrame(() => {
                                setDragTest({ testId: t.id, fromFeatureId: fg.id, fromScenarioId: sc.id });
                                setDragScenario(null);
                              });
                            }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => { if (dragTest && !isSelfTestDrag) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id, targetId: t.id }); } }}
                          >
                            <div className="test-card-info">
                              <span className="drag-handle" title="Drag to reorder or move" onMouseDown={() => { dragHandleActive.current = true; }} onMouseUp={() => { dragHandleActive.current = false; }}>⠿</span>
                              <span className="test-number">{tIdx + 1}</span>
                              <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                              <strong>{t.name}</strong>
                            </div>
                            <div className="test-card-meta">
                              {t.auth.type !== 'none' && t.auth.type !== 'inherit'
                                ? <span className="tag auth-badge auth-badge-test-own">Auth: {t.auth.type} (own)</span>
                                : scAuth.type !== 'none' && scAuth.type !== 'inherit'
                                  ? <span className="tag auth-badge auth-badge-test-scenario">Auth: {scAuth.type} (scenario)</span>
                                  : fg.auth && fg.auth.type !== 'none' && fg.auth.type !== 'inherit'
                                    ? <span className="tag auth-badge auth-badge-test-feature">Auth: {fg.auth.type} (feature)</span>
                                    : fg.auth?.type === 'inherit' && fg.globalAuthProfileId
                                      ? <span className="tag auth-badge auth-badge-test-global">{(() => { const p = globalAuthProfiles.find((gp) => gp.id === fg.globalAuthProfileId); return p ? `Auth: ${p.auth.type} (${p.name})` : 'Auth: global (missing)'; })()}</span>
                                      : <span className="tag auth-badge auth-badge-test-none">Auth: none</span>
                              }
                              <span className="tag">Validation: {t.validation.mode}</span>
                            </div>
                            <div className="test-card-actions">
                              <button className="btn btn-sm" onClick={() => startEditTest(fg.id, sc.id, t)}>Edit</button>
                              <button className="btn btn-sm" onClick={() => startCopyTest(fg.id, sc.id, t)} title="Copy to another scenario">Copy</button>
                              <button className="btn btn-sm" onClick={() => exportTest(t)} title="Export this test">Export</button>
                              <button className="btn btn-sm btn-danger" onClick={() => removeTest(fg.id, sc.id, t.id)}>Delete</button>
                            </div>
                          </div>
                          );
                        })}
                        {dragTest && sc.tests.length > 0 && (
                          <div
                            className={`drop-zone-end drop-zone-end-sm ${dropTarget?.type === 'test' && dropTarget.scenarioId === sc.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                            onDragOver={(e) => { if (dragTest) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'test', featureId: fg.id, scenarioId: sc.id }); } }}
                            onDrop={handleDragEnd}
                          >
                            Drop here
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
                {dragScenario && fg.scenarios.length > 0 && (
                  <div
                    className={`drop-zone-end ${dropTarget?.type === 'scenario' && dropTarget.featureId === fg.id && !dropTarget.targetId ? 'drop-zone-hover' : ''}`}
                    onDragOver={(e) => { if (dragScenario) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ type: 'scenario', featureId: fg.id }); } }}
                    onDragLeave={() => { if (dropTarget?.featureId === fg.id && !dropTarget.targetId) setDropTarget(null); }}
                    onDrop={handleDragEnd}
                  >
                    Drop here to add at end
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {featureGroups.length > 0 && (
        <div className="tree-summary">
          {featureGroups.length} feature group{featureGroups.length !== 1 ? 's' : ''} &middot; {featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0)} scenario{featureGroups.reduce((s, fg) => s + fg.scenarios.length, 0) !== 1 ? 's' : ''} &middot; {totalTests} test{totalTests !== 1 ? 's' : ''}
        </div>
      )}

      {unassociatedFeatureGroups.length > 0 && (
        <div className="unassociated-section">
          <h3>Unassigned Feature Groups ({unassociatedFeatureGroups.length})</h3>
          <p className="unassociated-hint">These feature groups need a microservice and environment assignment. {selectedSvcId && selectedEnvId ? 'Click "Assign here" to assign to the current selection.' : 'Select both from the sidebar, or use the dropdowns below.'}</p>
          {unassociatedFeatureGroups.map((fg) => (
            <div key={fg.id} className="unassociated-card">
              <div className="unassociated-info">
                <strong>{fg.name}</strong>
                <span className="count-badge">{fg.scenarios.length} scenario{fg.scenarios.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="unassociated-actions">
                {selectedSvcId && selectedEnvId ? (
                  <button className="btn btn-sm btn-primary" onClick={() => assignFeatureGroup(fg.id, selectedSvcId, selectedEnvId)}>
                    Assign here
                  </button>
                ) : (
                  <>
                    <select id={`svc-${fg.id}`} defaultValue="">
                      <option value="" disabled>Microservice…</option>
                      {microservices.map((svc) => (
                        <option key={svc.id} value={svc.id}>{svc.name}</option>
                      ))}
                    </select>
                    <select id={`env-${fg.id}`} defaultValue="">
                      <option value="" disabled>Environment…</option>
                      {environments.map((env) => (
                        <option key={env.id} value={env.id}>{env.name}</option>
                      ))}
                    </select>
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      const svcEl = document.getElementById(`svc-${fg.id}`) as HTMLSelectElement;
                      const envEl = document.getElementById(`env-${fg.id}`) as HTMLSelectElement;
                      if (svcEl?.value && envEl?.value) assignFeatureGroup(fg.id, svcEl.value, envEl.value);
                      else alert('Select both a microservice and an environment.');
                    }}>Assign</button>
                  </>
                )}
                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Copy Test Destination Picker ===== */}
      {copyingTest && (
        <div className="modal-overlay" onClick={() => setCopyingTest(null)}>
          <div className="modal copy-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Copy Test To...</h3>
            <p className="copy-test-name">Copying: <strong>{copyingTest.test.name}</strong></p>

            <div className="form-row">
              <label>Feature Group</label>
              <select value={copyTargetFeature} onChange={(e) => {
                setCopyTargetFeature(e.target.value);
                const fg = featureGroups.find((f) => f.id === e.target.value);
                setCopyTargetScenario(fg?.scenarios[0]?.id || '');
              }}>
                {featureGroups.map((fg) => (
                  <option key={fg.id} value={fg.id}>{fg.name}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label>Scenario</label>
              <select value={copyTargetScenario} onChange={(e) => setCopyTargetScenario(e.target.value)}>
                {featureGroups.find((f) => f.id === copyTargetFeature)?.scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                    {sc.id === copyingTest.sourceScenarioId && copyTargetFeature === copyingTest.sourceFeatureId ? ' (current)' : ''}
                  </option>
                )) || <option value="">No scenarios</option>}
              </select>
            </div>

            <div className="copy-modal-actions">
              <button className="btn" onClick={() => setCopyingTest(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmCopyTest} disabled={!copyTargetScenario}>Copy Here</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Full-screen Test Editor Modal ===== */}
      {editingTest && (
        <div className="modal-overlay">
          <div className="modal insomnia-modal">
            {/* Top bar: mode toggle + name */}
            <div className="insomnia-top-bar">
              <h3>{editingTest.testId === 'new' ? 'New Test' : 'Edit Test'}</h3>
              <div className="mode-toggle">
                <button className={`mode-btn ${inputMode === 'builder' ? 'active' : ''}`} onClick={() => setInputMode('builder')}>Builder</button>
                <button className={`mode-btn ${inputMode === 'curl' ? 'active' : ''}`} onClick={() => setInputMode('curl')}>cURL Import</button>
                <button className={`mode-btn ${inputMode === 'curl-export' ? 'active' : ''}`} onClick={() => { setInputMode('curl-export'); triggerCurlGeneration(); }}>cURL Export</button>
                <button className="mode-btn" onClick={() => pickJsonFile((raw) => {
                  const data = unwrapImport(raw);
                  const t = data as Scenario;
                  if (!t.name || !t.url || !t.method) { alert('Invalid file: expected a test with name, url, and method.'); return; }
                  setDraft({ ...t, id: draft.id });
                  syncParamsFromUrl(t.url || '');
                  setInputMode('builder');
                })}>Import</button>
                <button className="mode-btn" onClick={() => exportTest(draft)}>Export</button>
              </div>
              <div className="insomnia-top-actions">
                <button className="btn" onClick={() => setEditingTest(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveTest} disabled={!draft.name.trim() || !draft.url.trim()}>Save</button>
              </div>
            </div>

            {/* cURL mode */}
            {inputMode === 'curl' && (
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
                  <button className="btn btn-primary" disabled={!curlText.trim()} onClick={handleCurlImport}>
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

            {/* cURL export mode */}
            {inputMode === 'curl-export' && (
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
                      <button className="btn btn-primary" disabled={curlGenerating || !generatedCurl} onClick={() => {
                        navigator.clipboard.writeText(generatedCurl);
                      }}>Copy to Clipboard</button>
                      <button className="btn" disabled={curlGenerating} onClick={triggerCurlGeneration}>
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

            {/* Builder mode */}
            {inputMode === 'builder' && (
              <div className="builder-panel">
                {/* Name */}
                <div className="form-row">
                  <label>Name</label>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Get User Profile" />
                </div>

                {/* URL bar */}
                <div className="url-bar">
                  <select
                    className={`method-select method-color-${draft.method.toLowerCase()}`}
                    value={draft.method}
                    onChange={(e) => setDraft({ ...draft, method: e.target.value as Scenario['method'] })}
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
                    <button className="btn btn-sm url-fill-btn" onClick={() => handleBaseUrlChange(resolvedBaseUrl)} title="Use resolved base URL">Use</button>
                  )}
                </div>

                {/* URL preview when params exist */}
                {paramCount > 0 && draft.url && (
                  <div className="url-preview">
                    <span className="url-preview-label">URL PREVIEW</span>
                    <code>{draft.url}</code>
                  </div>
                )}

                {/* Tabs */}
                <div className="builder-tabs">
                  <button className={`builder-tab ${activeTab === 'params' ? 'active' : ''}`} onClick={() => setActiveTab('params')}>
                    Params {paramCount > 0 && <span className="tab-badge">{paramCount}</span>}
                  </button>
                  {draft.method !== 'GET' && (
                    <button className={`builder-tab ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
                      Body {draft.body ? <span className="tab-badge-dot" /> : null}
                    </button>
                  )}
                  <button className={`builder-tab ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>
                    Auth {draft.auth.type !== 'none' && <span className="tab-badge-dot" />}
                  </button>
                  <button className={`builder-tab ${activeTab === 'headers' ? 'active' : ''}`} onClick={() => setActiveTab('headers')}>
                    Headers {headerCount > 0 && <span className="tab-badge">{headerCount}</span>}
                  </button>
                  <button className={`builder-tab ${activeTab === 'validation' ? 'active' : ''}`} onClick={() => setActiveTab('validation')}>
                    Validation {draft.validation.mode !== 'none' && <span className="tab-badge-dot" />}
                  </button>
                </div>

                {/* Tab content */}
                <div className="builder-tab-content">
                  {/* Params tab */}
                  {activeTab === 'params' && (
                    <div className="kv-section">
                      <div className="kv-header">
                        <span>QUERY PARAMETERS</span>
                      </div>
                      {queryParams.map((p, i) => (
                        <div key={i} className="kv-row">
                          <input value={p.key} onChange={(e) => updateQueryParam(i, 'key', e.target.value)} placeholder="Parameter name" />
                          <input value={p.value} onChange={(e) => updateQueryParam(i, 'value', e.target.value)} placeholder="Value" />
                          <button className="btn btn-sm btn-danger" onClick={() => removeQueryParam(i)}>×</button>
                        </div>
                      ))}
                      <button className="btn btn-sm" onClick={addQueryParam}>+ Add</button>
                    </div>
                  )}

                  {/* Body tab */}
                  {activeTab === 'body' && draft.method !== 'GET' && (
                    <div>
                      <textarea
                        className="body-editor"
                        rows={14}
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        placeholder='{"key": "value"}'
                      />
                    </div>
                  )}

                  {/* Auth tab */}
                  {activeTab === 'auth' && (
                    <div>
                      <div className="auth-type-select">
                        <label>Type</label>
                        <select
                          value={draft.auth.type}
                          onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, type: e.target.value as AuthType } })}
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
                        const fg = editingTest ? featureGroups.find((f) => f.id === editingTest.featureId) : undefined;
                        const sc = fg?.scenarios.find((s) => s.id === editingTest?.scenarioId);
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
                          const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
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
                            <input value={draft.auth.username || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
                          </div>
                          <div>
                            <label>Password</label>
                            <input type="password" value={draft.auth.password || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
                          </div>
                        </div>
                      )}
                      {draft.auth.type === 'bearer' && (
                        <div className="form-row two-col">
                          <div>
                            <label>Token</label>
                            <input value={draft.auth.token || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, token: e.target.value } })} placeholder="eyJhbGciOi..." />
                          </div>
                          <div>
                            <label>Prefix</label>
                            <input value={draft.auth.prefix ?? 'Bearer'} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, prefix: e.target.value } })} placeholder="Bearer" />
                          </div>
                        </div>
                      )}
                      {draft.auth.type === 'apikey' && (
                        <>
                          <div className="form-row two-col">
                            <div>
                              <label>Key Name</label>
                              <input value={draft.auth.apiKeyName || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, apiKeyName: e.target.value } })} placeholder="X-API-Key" />
                            </div>
                            <div>
                              <label>Key Value</label>
                              <input value={draft.auth.apiKeyValue || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, apiKeyValue: e.target.value } })} placeholder="your-api-key" />
                            </div>
                          </div>
                          <div className="form-row">
                            <label>Add to</label>
                            <div className="radio-group">
                              <label className="radio-label">
                                <input type="radio" checked={draft.auth.apiKeyIn !== 'query'} onChange={() => setDraft({ ...draft, auth: { ...draft.auth, apiKeyIn: 'header' } })} />
                                Header
                              </label>
                              <label className="radio-label">
                                <input type="radio" checked={draft.auth.apiKeyIn === 'query'} onChange={() => setDraft({ ...draft, auth: { ...draft.auth, apiKeyIn: 'query' } })} />
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
                            <input value={draft.auth.username || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, username: e.target.value } })} />
                          </div>
                          <div>
                            <label>Password</label>
                            <input type="password" value={draft.auth.password || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, password: e.target.value } })} />
                          </div>
                        </div>
                      )}
                      {draft.auth.type === 'oauth2' && (
                        <>
                          <div className="form-row">
                            <label>Token URL</label>
                            <input value={draft.auth.tokenUrl || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, tokenUrl: e.target.value } })} placeholder="https://auth.example.com/oauth/token" />
                          </div>
                          <div className="form-row two-col">
                            <div>
                              <label>Client ID</label>
                              <input value={draft.auth.clientId || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, clientId: e.target.value } })} />
                            </div>
                            <div>
                              <label>Client Secret</label>
                              <div className="secret-input-wrap">
                                <input type={showSecret ? 'text' : 'password'} value={draft.auth.clientSecret || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, clientSecret: e.target.value } })} />
                                <button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {draft.auth.type !== 'none' && draft.auth.type !== 'inherit' && (
                        <div className="auth-verify-section">
                          <button
                            className="btn btn-sm btn-verify"
                            onClick={() => { setAuthVerifyResult(null); verifyAuth(draft.auth); }}
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
                              className="btn btn-sm btn-verify"
                              onClick={() => { setAuthVerifyResult(null); verifyAuth(resolved); }}
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

                  {/* Headers tab */}
                  {activeTab === 'headers' && (
                    <div className="kv-section">
                      <div className="kv-header">
                        <span>REQUEST HEADERS</span>
                      </div>
                      {draft.headers.map((h: KeyValue, i: number) => (
                        <div key={i} className="kv-row">
                          <input value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} placeholder="Header name" />
                          <input value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} placeholder="Header value" />
                          <button className="btn btn-sm btn-danger" onClick={() => removeHeader(i)}>×</button>
                        </div>
                      ))}
                      <button className="btn btn-sm" onClick={addHeader}>+ Add</button>
                    </div>
                  )}

                  {/* Validation tab */}
                  {activeTab === 'validation' && (
                    <div>
                      <div className="radio-group">
                        {(['none', 'full', 'selective'] as ValidationMode[]).map((m) => (
                          <label key={m} className="radio-label">
                            <input type="radio" name="validationMode" checked={draft.validation.mode === m} onChange={() => setDraft({ ...draft, validation: { ...draft.validation, mode: m } })} />
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
                            onChange={(e) => setDraft({ ...draft, validation: { ...draft.validation, expectedJson: e.target.value } })}
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
                                onChange={(e) => setDraft((prev) => ({ ...prev, validation: { ...prev.validation, unorderedArrays: e.target.checked } }))}
                              />
                              Unordered array matching
                              <span className="option-hint">— ignore array item positions, match by value instead</span>
                            </label>
                          </div>
                          <div className="fetch-host-override-row">
                            <button
                              className="btn btn-sm btn-accent"
                              onClick={handleFetchSampleResponse}
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
                              <button className="btn btn-sm" onClick={() => setFetchHostOverride(resolvedBaseUrl)} title="Use Settings base URL">Use Settings</button>
                            )}
                          </div>
                          {fetchError && <div className="fetch-error-inline">{fetchError}</div>}
                          <JsonPathBuilder
                            sampleJson={draft.validation.sampleJson || ''}
                            onSampleJsonChange={(json) => setDraft((prev) => ({ ...prev, validation: { ...prev.validation, sampleJson: json } }))}
                            selectiveMode={draft.validation.selectiveMode || 'include'}
                            expectedFields={draft.validation.expectedFields || []}
                            excludedPaths={draft.validation.excludedPaths || []}
                            onUpdate={(patch) => setDraft((prev) => ({ ...prev, validation: { ...prev.validation, ...patch } }))}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

