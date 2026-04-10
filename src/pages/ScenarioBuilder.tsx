import { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, TestScenario, FeatureGroup, AuthType, AuthConfig, ValidationMode, KeyValue, ExpectedField } from '../types';
import { saveFeatureGroups, loadFeatureGroups } from '../utils/storage';
import { parseCurl } from '../utils/curlParser';
import { proxyFetch, acquireOAuth2Token, buildHeaders } from '../engine/executor';
import JsonPathBuilder from '../components/JsonPathBuilder';

const emptyTest = (): Scenario => ({
  id: uuidv4(),
  name: '',
  url: '',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  body: '',
  auth: { type: 'none' },
  validation: { mode: 'none', expectedFields: [] },
});

type BuilderTab = 'params' | 'body' | 'auth' | 'headers' | 'validation';
type InputMode = 'builder' | 'curl';

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
}

export default function ScenarioBuilder({ featureGroups, setFeatureGroups }: Props) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  const [namingFeature, setNamingFeature] = useState(false);
  const [namingScenario, setNamingScenario] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [editingFeatureName, setEditingFeatureName] = useState<string | null>(null);
  const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Scenario auth editing
  const [editingScenarioAuth, setEditingScenarioAuth] = useState<string | null>(null);

  const [editingTest, setEditingTest] = useState<{ featureId: string; scenarioId: string; testId: string | 'new' } | null>(null);
  const [draft, setDraft] = useState<Scenario>(emptyTest());

  // Builder state
  const [inputMode, setInputMode] = useState<InputMode>('builder');
  const [activeTab, setActiveTab] = useState<BuilderTab>('params');
  const [curlText, setCurlText] = useState('');
  const [queryParams, setQueryParams] = useState<KeyValue[]>([{ key: '', value: '' }]);

  useEffect(() => {
    const saved = loadFeatureGroups();
    if (saved.length > 0) {
      setFeatureGroups(saved);
    }
  }, [setFeatureGroups]);

  useEffect(() => {
    if (featureGroups.length > 0) {
      saveFeatureGroups(featureGroups);
    }
  }, [featureGroups]);

  // Sync query params when URL changes externally (e.g., from cURL parse)
  const syncParamsFromUrl = useCallback((url: string) => {
    setQueryParams(parseQueryParams(url));
  }, []);

  // Feature Group CRUD
  const addFeatureGroup = () => {
    if (!newName.trim()) return;
    const fg: FeatureGroup = { id: uuidv4(), name: newName.trim(), scenarios: [] };
    setFeatureGroups((prev) => [...prev, fg]);
    setExpandedFeatures((prev) => new Set(prev).add(fg.id));
    setNamingFeature(false);
    setNewName('');
  };

  const removeFeatureGroup = (id: string) => {
    setFeatureGroups((prev) => prev.filter((fg) => fg.id !== id));
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

  // Scenario auth
  const updateScenarioAuth = (featureId: string, scenarioId: string, auth: AuthConfig) => {
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId
        ? { ...fg, scenarios: fg.scenarios.map((sc) => sc.id === scenarioId ? { ...sc, auth } : sc) }
        : fg
    ));
  };

  const toggleScenarioAuth = (featureId: string, scenarioId: string) => {
    if (editingScenarioAuth === scenarioId) {
      setEditingScenarioAuth(null);
    } else {
      setEditingScenarioAuth(scenarioId);
      // Ensure auth config exists
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

  const duplicateTest = (featureId: string, scenarioId: string, test: Scenario) => {
    const copy: Scenario = {
      ...test,
      id: uuidv4(),
      name: `${test.name} (copy)`,
      headers: test.headers.map((h) => ({ ...h })),
      validation: { ...test.validation, expectedFields: test.validation.expectedFields?.map((f) => ({ ...f })) },
    };
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return {
        ...fg,
        scenarios: fg.scenarios.map((sc) => {
          if (sc.id !== scenarioId) return sc;
          return { ...sc, tests: [...sc.tests, copy] };
        }),
      };
    }));
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

  // Resolve effective auth: test-level > scenario-level > header-level
  const resolveEffectiveAuth = useCallback((): { auth: AuthConfig; source: string } => {
    if (draft.auth.type !== 'none') return { auth: draft.auth, source: 'test' };
    if (editingTest) {
      const fg = featureGroups.find((f) => f.id === editingTest.featureId);
      const sc = fg?.scenarios.find((s) => s.id === editingTest.scenarioId);
      if (sc?.auth && sc.auth.type !== 'none') return { auth: sc.auth, source: 'scenario' };
    }
    return { auth: draft.auth, source: 'none' };
  }, [draft.auth, editingTest, featureGroups]);

  const handleFetchSampleResponse = useCallback(async () => {
    if (!draft.url.trim()) {
      setFetchError('URL is required');
      return;
    }
    setFetchingResponse(true);
    setFetchError(null);
    try {
      const { auth: effectiveAuth, source: authSource } = resolveEffectiveAuth();

      // Build headers manually to handle all auth types inline
      const reqHeaders: Record<string, string> = {};
      for (const h of draft.headers) {
        if (h.key.trim()) reqHeaders[h.key.trim()] = h.value;
      }
      if (draft.body && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }

      if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
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
      } else if (effectiveAuth.type === 'none' && authSource === 'none') {
        // No auth configured anywhere — check if there's a manual Authorization header
        if (!reqHeaders['Authorization']) {
          // Proceed without auth (API might not require it)
        }
      }

      const reqBody = (draft.body && draft.method !== 'GET') ? draft.body : undefined;
      const result = await proxyFetch(draft.url, draft.method, reqHeaders, reqBody);
      if (result.error) {
        setFetchError(result.error);
      } else if (result.status >= 400) {
        setFetchError(`HTTP ${result.status}: ${result.statusText}`);
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

  // ── Export / Import helpers ──
  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  const stamp = () => new Date().toISOString().slice(0, 10);

  const reIdScenarios = (scenarios: TestScenario[]) =>
    scenarios.map((sc) => ({ ...sc, id: uuidv4(), tests: sc.tests.map((t) => ({ ...t, id: uuidv4() })) }));

  // All feature groups
  const exportAll = () => downloadJson(featureGroups, `features-all-${stamp()}.json`);

  const importAll = () => pickJsonFile((data) => {
    const items = Array.isArray(data) ? data as FeatureGroup[] : [data as FeatureGroup];
    if (!items.every((fg) => fg.name && Array.isArray(fg.scenarios))) {
      alert('Invalid file: expected feature group(s).'); return;
    }
    const imported = items.map((fg) => ({ ...fg, id: uuidv4(), scenarios: reIdScenarios(fg.scenarios) }));
    setFeatureGroups((prev) => [...prev, ...imported]);
  });

  // Single feature group
  const exportFeatureGroup = (fg: FeatureGroup) =>
    downloadJson(fg, `feature-${fg.name}-${stamp()}.json`);

  const importScenariosInto = (featureId: string) => pickJsonFile((data) => {
    const items = Array.isArray(data) ? data as TestScenario[] : [data as TestScenario];
    if (!items.every((sc) => sc.name && Array.isArray(sc.tests))) {
      alert('Invalid file: expected scenario(s) with a name and tests array.'); return;
    }
    const imported = reIdScenarios(items);
    setFeatureGroups((prev) => prev.map((fg) =>
      fg.id === featureId ? { ...fg, scenarios: [...fg.scenarios, ...imported] } : fg
    ));
  });

  // Single scenario
  const exportScenario = (sc: TestScenario) =>
    downloadJson(sc, `scenario-${sc.name}-${stamp()}.json`);

  const importTestsInto = (featureId: string, scenarioId: string) => pickJsonFile((data) => {
    const items = Array.isArray(data) ? data as Scenario[] : [data as Scenario];
    if (!items.every((t) => t.name && t.url && t.method)) {
      alert('Invalid file: expected test(s) with name, url, and method.'); return;
    }
    const imported = items.map((t) => ({ ...t, id: uuidv4() }));
    setFeatureGroups((prev) => prev.map((fg) => {
      if (fg.id !== featureId) return fg;
      return { ...fg, scenarios: fg.scenarios.map((sc) =>
        sc.id === scenarioId ? { ...sc, tests: [...sc.tests, ...imported] } : sc
      )};
    }));
  });

  // Single test
  const exportTest = (t: Scenario) =>
    downloadJson(t, `test-${t.name}-${stamp()}.json`);

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

  return (
    <div className="page">
      <div className="page-header">
        <h2>Feature Groups</h2>
        <div className="header-actions">
          <button className="btn" onClick={importAll}>Import</button>
          <button className="btn" onClick={exportAll} disabled={featureGroups.length === 0}>Export</button>
          <button className="btn btn-primary" onClick={() => { setNamingFeature(true); setNewName(''); }}>+ Add Feature Group</button>
        </div>
      </div>

      {namingFeature && (
        <div className="inline-name-form">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFeatureGroup(); if (e.key === 'Escape') setNamingFeature(false); }}
            placeholder="Feature group name (e.g. Onboarding)" />
          <button className="btn btn-primary btn-sm" onClick={addFeatureGroup} disabled={!newName.trim()}>Create</button>
          <button className="btn btn-sm" onClick={() => setNamingFeature(false)}>Cancel</button>
        </div>
      )}

      {featureGroups.length === 0 && !namingFeature && (
        <div className="empty-state">No feature groups yet. Click "+ Add Feature Group" to organize your tests.</div>
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
              <div className="feature-group-actions" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-sm" onClick={() => { setEditingFeatureName(fg.id); setEditName(fg.name); }}>Rename</button>
                <button className="btn btn-sm" onClick={() => { setNamingScenario(fg.id); setNewName(''); }}>+ Scenario</button>
                <button className="btn btn-sm" onClick={() => importScenariosInto(fg.id)} title="Import scenarios into this feature group">Import</button>
                <button className="btn btn-sm" onClick={() => exportFeatureGroup(fg)} title="Export this feature group">Export</button>
                <button className="btn btn-sm btn-danger" onClick={() => removeFeatureGroup(fg.id)}>Delete</button>
              </div>
            </div>

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
                  <div className="empty-hint">No scenarios. Click "+ Scenario" to add one.</div>
                )}
                {fg.scenarios.map((sc) => {
                  const scAuth = sc.auth || { type: 'none' as AuthType };
                  return (
                  <div key={sc.id} className="scenario-group-card">
                    <div className="scenario-group-header" onClick={() => toggleScenario(sc.id)}>
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
                      {scAuth.type !== 'none' && <span className="count-badge auth-badge">Auth: {scAuth.type}</span>}
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
                        <div className="radio-group">
                          {(['none', 'basic', 'oauth2'] as AuthType[]).map((t) => (
                            <label key={t} className="radio-label">
                              <input type="radio" name={`scenarioAuth-${sc.id}`} checked={scAuth.type === t}
                                onChange={() => updateScenarioAuth(fg.id, sc.id, { ...scAuth, type: t })} />
                              {t === 'none' ? 'None' : t === 'basic' ? 'Basic Auth' : 'OAuth2 Client Credentials'}
                            </label>
                          ))}
                        </div>
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
                                <input type="password" value={scAuth.clientSecret || ''} onChange={(e) => updateScenarioAuth(fg.id, sc.id, { ...scAuth, clientSecret: e.target.value })} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {expandedScenarios.has(sc.id) && (
                      <div className="scenario-group-body">
                        {sc.tests.length === 0 && <div className="empty-hint">No tests. Click "+ Test" to add an HTTP request.</div>}
                        {sc.tests.map((t) => (
                          <div key={t.id} className="test-card">
                            <div className="test-card-info">
                              <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                              <strong>{t.name}</strong>
                              <span className="scenario-url">{t.url}</span>
                            </div>
                            <div className="test-card-meta">
                              {t.auth.type !== 'none'
                                ? <span className="tag">Auth: {t.auth.type} (own)</span>
                                : scAuth.type !== 'none'
                                  ? <span className="tag">Auth: {scAuth.type} (scenario)</span>
                                  : <span className="tag">Auth: none</span>
                              }
                              <span className="tag">Validation: {t.validation.mode}</span>
                            </div>
                            <div className="test-card-actions">
                              <button className="btn btn-sm" onClick={() => startEditTest(fg.id, sc.id, t)}>Edit</button>
                              <button className="btn btn-sm" onClick={() => duplicateTest(fg.id, sc.id, t)} title="Duplicate this test">Copy</button>
                              <button className="btn btn-sm" onClick={() => exportTest(t)} title="Export this test">Export</button>
                              <button className="btn btn-sm btn-danger" onClick={() => removeTest(fg.id, sc.id, t.id)}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
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

      {/* ===== Full-screen Test Editor Modal ===== */}
      {editingTest && (
        <div className="modal-overlay">
          <div className="modal insomnia-modal">
            {/* Top bar: mode toggle + name */}
            <div className="insomnia-top-bar">
              <h3>{editingTest.testId === 'new' ? 'New Test' : 'Edit Test'}</h3>
              <div className="mode-toggle">
                <button className={`mode-btn ${inputMode === 'builder' ? 'active' : ''}`} onClick={() => setInputMode('builder')}>Builder</button>
                <button className={`mode-btn ${inputMode === 'curl' ? 'active' : ''}`} onClick={() => setInputMode('curl')}>cURL</button>
                <button className="mode-btn" onClick={() => pickJsonFile((data) => {
                  const t = data as Scenario;
                  if (!t.name || !t.url || !t.method) { alert('Invalid file: expected a test with name, url, and method.'); return; }
                  setDraft({ ...t, id: draft.id });
                  syncParamsFromUrl(t.url || '');
                  setInputMode('builder');
                })}>Import</button>
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
                    placeholder="https://api.example.com/endpoint"
                  />
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
                      <div className="radio-group">
                        {(['none', 'basic', 'oauth2'] as AuthType[]).map((t) => (
                          <label key={t} className="radio-label">
                            <input type="radio" name="authType" checked={draft.auth.type === t} onChange={() => setDraft({ ...draft, auth: { ...draft.auth, type: t } })} />
                            {t === 'none' ? 'None' : t === 'basic' ? 'Basic Auth' : 'OAuth2 Client Credentials'}
                          </label>
                        ))}
                      </div>
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
                              <input type="password" value={draft.auth.clientSecret || ''} onChange={(e) => setDraft({ ...draft, auth: { ...draft.auth, clientSecret: e.target.value } })} />
                            </div>
                          </div>
                        </>
                      )}
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
                        <JsonPathBuilder
                          sampleJson={draft.validation.sampleJson || ''}
                          onSampleJsonChange={(json) => setDraft((prev) => ({ ...prev, validation: { ...prev.validation, sampleJson: json } }))}
                          selectiveMode={draft.validation.selectiveMode || 'include'}
                          expectedFields={draft.validation.expectedFields || []}
                          excludedPaths={draft.validation.excludedPaths || []}
                          onUpdate={(patch) => setDraft((prev) => ({ ...prev, validation: { ...prev.validation, ...patch } }))}
                          onFetchSample={handleFetchSampleResponse}
                          fetchingResponse={fetchingResponse}
                          fetchError={fetchError}
                        />
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

