import { useState, useMemo, useEffect } from 'react';
import type { AuthConfig, ExecutionMode, FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, LoadProfileConfig, LoadProfileType } from '../types';
import { useTestExecution } from '../hooks/useTestExecution';
import type { TimeSeriesPoint } from '../hooks/useTestExecution';
import { getTargetConcurrency } from '../engine/executor';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../utils/storage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

type HostMode = 'hardcoded' | 'settings' | 'custom';

const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  durationSec: 60,
  maxConcurrency: 5,
  rampUpSec: 30,
  spikeConcurrency: 10,
  spikeStartSec: 20,
  spikeDurationSec: 10,
};

interface RunnerConfig {
  concurrency: number;
  totalTransactions: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
}

const defaultConfig: RunnerConfig = {
  concurrency: 1, totalTransactions: 1, selectedScenarios: [], weights: {},
  skipValidation: false, hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

interface Props {
  featureGroups: FeatureGroup[];
  onComplete: () => void;
  envName?: string;
  svcName?: string;
  projectName?: string;
  projectId?: string;
  envId?: string;
  svcId?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles?: GlobalAuthProfile[];
}

function replaceHost(testUrl: string, baseUrl: string): string {
  if (!baseUrl) return testUrl;
  try {
    const original = new URL(testUrl);
    const base = new URL(baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    original.protocol = base.protocol;
    original.host = base.host;
    const basePath = base.pathname.replace(/\/+$/, '');
    if (basePath && !original.pathname.startsWith(basePath)) {
      original.pathname = basePath + original.pathname;
    }
    return original.toString();
  } catch {
    return testUrl;
  }
}

// ---------------------------------------------------------------------------
// SVG Profile Preview
// ---------------------------------------------------------------------------

function ProfilePreview({ profile }: { profile: LoadProfileConfig }) {
  const w = 220;
  const h = 60;
  const pad = 4;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const maxC = Math.max(
    profile.maxConcurrency,
    profile.spikeConcurrency ?? 0,
    1
  );

  const points: string[] = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * profile.durationSec * 1000;
    const c = getTargetConcurrency(profile, t);
    const x = pad + (i / steps) * innerW;
    const y = pad + innerH - (c / maxC) * innerH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const baseY = pad + innerH;
  const polyPoints = `${pad},${baseY} ${points.join(' ')} ${pad + innerW},${baseY}`;

  return (
    <svg className="profile-preview-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={polyPoints} />
      <polyline points={points.join(' ')} fill="none" strokeWidth="2" />
      <text x={pad} y={h - 1} className="profile-preview-label">{profile.durationSec}s</text>
      <text x={w - pad} y={pad + 9} textAnchor="end" className="profile-preview-label">{maxC}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Live Streaming Charts
// ---------------------------------------------------------------------------

const chartTooltipStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.78rem' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMs = (v: any) => [`${v} ms`, 'Avg'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTps = (v: any) => [`${v}`, 'TPS'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtErr = (v: any) => [`${v}%`, 'Errors'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtConc = (v: any) => [`${v}`, 'In-Flight'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtLabel = (l: any) => `${l}s`;

function LiveCharts({ data, isTimeBased }: { data: TimeSeriesPoint[]; isTimeBased: boolean }) {
  return (
    <div className="live-charts">
      <div className="live-chart-card">
        <div className="live-chart-title">Response Time (ms)</div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradResp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3498db" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3498db" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtMs} labelFormatter={fmtLabel} />
            <Area type="monotone" dataKey="avgResponseTime" stroke="#3498db" fill="url(#gradResp)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="live-chart-card">
        <div className="live-chart-title">Throughput (TPS)</div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradTps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#27ae60" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#27ae60" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtTps} labelFormatter={fmtLabel} />
            <Area type="monotone" dataKey="tps" stroke="#27ae60" fill="url(#gradTps)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="live-chart-card">
        <div className="live-chart-title">Error Rate (%)</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} domain={[0, 'auto']} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={fmtErr} labelFormatter={fmtLabel} />
            <Line type="monotone" dataKey="errorRate" stroke="#e74c3c" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isTimeBased && data.some(d => d.concurrency > 0) && (
        <div className="live-chart-card">
          <div className="live-chart-title">Concurrency</div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradConc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9b59b6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#9b59b6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="elapsedSec" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: number) => `${v}s`} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={45} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={fmtConc} labelFormatter={fmtLabel} />
              <Area type="stepAfter" dataKey="concurrency" stroke="#9b59b6" fill="url(#gradConc)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const profileDescriptions: Record<LoadProfileType, string> = {
  'ramp-up': 'Gradually increase from 1 to N concurrent users over a ramp period, then sustain',
  'sustained': 'Maintain a constant number of concurrent users for the full duration',
  'spike': 'Run at base concurrency, then burst to a peak for a short window',
};

// ---------------------------------------------------------------------------
// TestRunner Component
// ---------------------------------------------------------------------------

export default function TestRunner({ featureGroups, onComplete, envName, svcName, projectName, projectId, envId, svcId, resolvedBaseUrl, globalAuthProfiles = [] }: Props) {
  const configContextKey = [projectId, envId, svcId].filter(Boolean).join(':') || undefined;

  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [totalTransactions, setTotalTransactions] = useState(defaultConfig.totalTransactions);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [skipValidation, setSkipValidation] = useState(false);
  const [hostMode, setHostMode] = useState<HostMode>('settings');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [loadProfile, setLoadProfile] = useState<LoadProfileConfig>({ ...defaultLoadProfile });
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(() => new Set(featureGroups.map(fg => fg.id)));
  const [configLoaded, setConfigLoaded] = useState(false);

  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

  useEffect(() => {
    setConfigLoaded(false);
    loadRunnerConfigAsync(configContextKey).then((raw) => {
      if (raw) {
        const saved = raw as RunnerConfig;
        setConcurrency(saved.concurrency ?? defaultConfig.concurrency);
        setTotalTransactions(saved.totalTransactions ?? defaultConfig.totalTransactions);
        setSelectedScenarios(new Set(saved.selectedScenarios ?? []));
        setWeights(saved.weights ?? {});
        setSkipValidation(saved.skipValidation ?? false);
        setHostMode(saved.hostMode ?? 'settings');
        setCustomBaseUrl(saved.customBaseUrl ?? '');
        setExecutionMode(saved.executionMode ?? 'batch');
        if (saved.loadProfile) setLoadProfile(saved.loadProfile);
      } else {
        setConcurrency(defaultConfig.concurrency);
        setTotalTransactions(defaultConfig.totalTransactions);
        setSelectedScenarios(new Set());
        setWeights({});
        setSkipValidation(defaultConfig.skipValidation);
        setHostMode(defaultConfig.hostMode);
        setCustomBaseUrl(defaultConfig.customBaseUrl);
        setExecutionMode(defaultConfig.executionMode);
        setLoadProfile({ ...defaultLoadProfile });
      }
      setConfigLoaded(true);
    });
  }, [configContextKey]);

  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      totalTransactions,
      selectedScenarios: Array.from(selectedScenarios),
      weights,
      skipValidation,
      hostMode,
      customBaseUrl,
      executionMode,
      loadProfile,
    }, configContextKey);
  }, [configLoaded, configContextKey, concurrency, totalTransactions, selectedScenarios, weights, skipValidation, hostMode, customBaseUrl, executionMode, loadProfile]);

  const selectedTests: Scenario[] = useMemo(() => {
    const resolveAuth = (test: Scenario, sc: { auth?: AuthConfig }, fg: FeatureGroup): AuthConfig => {
      if (test.auth.type !== 'inherit' && test.auth.type !== 'none') return test.auth;
      const scAuth = sc.auth;
      if (scAuth && scAuth.type !== 'none' && scAuth.type !== 'inherit') return scAuth as AuthConfig;
      const fgAuth = fg.auth;
      if (fgAuth && fgAuth.type !== 'none' && fgAuth.type !== 'inherit') return fgAuth as AuthConfig;
      if (fg.globalAuthProfileId) {
        const profile = globalAuthProfiles.find((p) => p.id === fg.globalAuthProfileId);
        if (profile && profile.auth.type !== 'none') return profile.auth;
      }
      return { type: 'none' };
    };
    const tests: Scenario[] = [];
    for (const fg of featureGroups) {
      for (const sc of fg.scenarios) {
        if (selectedScenarios.has(sc.id)) {
          for (const test of sc.tests) {
            const effectiveBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || '') : hostMode === 'custom' ? customBaseUrl.trim() : '';
            const url = effectiveBaseUrl ? replaceHost(test.url, effectiveBaseUrl) : test.url;
            const validation = skipValidation ? { mode: 'none' as const } : test.validation;
            const auth = resolveAuth(test, sc, fg);
            tests.push({ ...test, url, auth, validation });
          }
        }
      }
    }
    return tests;
  }, [featureGroups, selectedScenarios, resolvedBaseUrl, skipValidation, hostMode, customBaseUrl, globalAuthProfiles]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    const w: Record<string, number> = {};
    selectedTests.forEach((t) => (w[t.id] = weights[t.id] ?? 1));
    if (JSON.stringify(w) !== JSON.stringify(weights)) {
      setWeights(w);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTests]);

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      next.has(featureId) ? next.delete(featureId) : next.add(featureId);
      return next;
    });
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      next.has(scenarioId) ? next.delete(scenarioId) : next.add(scenarioId);
      return next;
    });
  };

  const toggleAllInFeature = (fg: FeatureGroup) => {
    const allSelected = fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
    setSelectedScenarios((prev) => {
      const next = new Set(prev);
      fg.scenarios.forEach((sc) => {
        if (allSelected) next.delete(sc.id); else next.add(sc.id);
      });
      return next;
    });
  };

  const selectAll = () => {
    const allIds = featureGroups.flatMap((fg) => fg.scenarios.map((sc) => sc.id));
    setSelectedScenarios(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedScenarios(new Set());
  };

  const activeTestCount = selectedTests.filter((t) => (weights[t.id] ?? 1) > 0).length;
  const isLoadProfile = executionMode === 'load-profile';

  const handleRun = () => {
    const scenarioWeights: ScenarioWeight[] = selectedTests.map((t) => ({
      scenarioId: t.id,
      weight: weights[t.id] ?? 1,
    }));
    const config: TestConfig = {
      concurrency: isLoadProfile ? loadProfile.maxConcurrency : concurrency,
      totalTransactions: isLoadProfile ? 0 : totalTransactions,
      scenarioWeights,
      executionMode,
      ...(isLoadProfile ? { loadProfile } : {}),
    };
    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    execute(config, selectedTests, { projectName, envName, svcName, baseUrl: usedBaseUrl });
  };

  const isTimeBased = isLoadProfile || (isRunning && total === -1);
  const progressPct = isTimeBased
    ? (profileMeta ? Math.min(100, Math.round((profileMeta.elapsedMs / profileMeta.durationMs) * 100)) : 0)
    : (total > 0 ? Math.round((completed / total) * 100) : 0);
  const hasAnyTests = featureGroups.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0));

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const profileLabel = (type: LoadProfileType): string => {
    switch (type) {
      case 'ramp-up': return 'Ramp-Up';
      case 'sustained': return 'Sustained';
      case 'spike': return 'Spike';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Test Runner</h2>
        <div className="context-tags">
          {projectName && <span className="context-tag project-tag">{projectName}</span>}
          {svcName && <span className="context-tag svc-tag">{svcName}</span>}
          {envName && <span className="context-tag env-tag">{envName}</span>}
        </div>
      </div>
      <div className="runner-host-selector">
        <span className="runner-host-label">Host:</span>
        <label className="radio-label">
          <input type="radio" name="hostMode" checked={hostMode === 'hardcoded'} onChange={() => setHostMode('hardcoded')} disabled={isRunning} />
          Original
        </label>
        <label className={`radio-label ${!resolvedBaseUrl ? 'disabled' : ''}`}>
          <input type="radio" name="hostMode" checked={hostMode === 'settings'} onChange={() => setHostMode('settings')} disabled={isRunning || !resolvedBaseUrl} />
          Settings
          {resolvedBaseUrl
            ? <code className="runner-host-url">{resolvedBaseUrl}</code>
            : <span className="option-hint"> — configure base URL in Settings first</span>
          }
        </label>
        <label className="radio-label">
          <input type="radio" name="hostMode" checked={hostMode === 'custom'} onChange={() => setHostMode('custom')} disabled={isRunning} />
          Custom
        </label>
        {(
          <input
            className="runner-custom-url-input"
            type="text"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder="https://my-host.example.com:8080"
            disabled={isRunning || hostMode !== 'custom'}
          />
        )}
      </div>

      <div className="runner-option-boxes">
        <div className="runner-option-box">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={skipValidation}
              onChange={(e) => setSkipValidation(e.target.checked)}
              disabled={isRunning}
            />
            Skip validation
          </label>
        </div>

        <div className="runner-option-box" style={{ flex: 1 }}>
          <span className="runner-exec-label">Execution Mode:</span>
          <label className="radio-label" title="Executes requests one by one in sequence. No parallelism.">
            <input type="radio" name="execMode" checked={executionMode === 'sequential'} onChange={() => setExecutionMode('sequential')} disabled={isRunning} />
            Sequential
          </label>
          <label className="radio-label" title="Fires N requests, waits for ALL to finish, then fires the next N.">
            <input type="radio" name="execMode" checked={executionMode === 'batch'} onChange={() => setExecutionMode('batch')} disabled={isRunning} />
            Batch
          </label>
          <label className="radio-label" title="Maintains N concurrent requests at all times.">
            <input type="radio" name="execMode" checked={executionMode === 'pool'} onChange={() => setExecutionMode('pool')} disabled={isRunning} />
            Continuous Pool
          </label>
          <label className="radio-label" title="Time-based load profiles: ramp-up, sustained, spike, soak">
            <input type="radio" name="execMode" checked={executionMode === 'load-profile'} onChange={() => setExecutionMode('load-profile')} disabled={isRunning} />
            Load Profile
          </label>
          <span className="exec-mode-hint">
            {executionMode === 'sequential'
              ? 'Executes one request at a time in order — no parallelism'
              : executionMode === 'batch'
                ? 'Fires N requests, waits for all to complete, then fires next N'
                : executionMode === 'pool'
                  ? 'Keeps N requests in-flight at all times — a new request starts as soon as one finishes'
                  : 'Time-based execution with dynamic concurrency shaping'}
          </span>
        </div>
      </div>

      {!hasAnyTests ? (
        <div className="empty-state">No tests defined. Go to Feature Groups tab to add some first.</div>
      ) : (
        <>
          {/* Scenario selection */}
          <div className="config-form">
            <div className="selection-header">
              <h3>Select Scenarios to Test</h3>
              <div className="selection-actions">
                <button className="btn btn-sm" onClick={selectAll} disabled={isRunning}>Select All</button>
                <button className="btn btn-sm" onClick={deselectAll} disabled={isRunning}>Deselect All</button>
                <span className="filter-count">
                  {selectedScenarios.size} scenario{selectedScenarios.size !== 1 ? 's' : ''} selected
                  ({selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            <div className="selection-tree">
              {featureGroups.map((fg) => {
                if (fg.scenarios.length === 0) return null;
                const allSelected = fg.scenarios.length > 0 && fg.scenarios.every((sc) => selectedScenarios.has(sc.id));
                const someSelected = fg.scenarios.some((sc) => selectedScenarios.has(sc.id));
                return (
                  <div key={fg.id} className="selection-feature">
                    <div className="selection-feature-header">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={() => toggleAllInFeature(fg)}
                          disabled={isRunning}
                        />
                        <strong>{fg.name}</strong>
                      </label>
                      <span className="expand-toggle" onClick={() => toggleFeature(fg.id)}>
                        {expandedFeatures.has(fg.id) ? '−' : '+'}
                      </span>
                    </div>
                    {expandedFeatures.has(fg.id) && (
                      <div className="selection-scenarios">
                        {fg.scenarios.map((sc) => {
                          if (sc.tests.length === 0) return null;
                          return (
                            <div key={sc.id} className="selection-scenario">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={selectedScenarios.has(sc.id)}
                                  onChange={() => toggleScenario(sc.id)}
                                  disabled={isRunning}
                                />
                                <span>{sc.name}</span>
                                <span className="count-badge">{sc.tests.length} test{sc.tests.length !== 1 ? 's' : ''}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Config */}
          {selectedTests.length > 0 && (
            <div className="config-form" style={{ marginTop: 16 }}>

              {/* Count-based config (non-load-profile) */}
              {!isLoadProfile && (
                <div className="form-row" style={{ display: 'flex', gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label>Concurrency (parallel requests)</label>
                    <input type="number" min={1} max={100} value={executionMode === 'sequential' ? 1 : concurrency} onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning || executionMode === 'sequential'} />
                    {executionMode === 'sequential' && <span className="field-hint">Fixed to 1 in sequential mode</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Total Transactions</label>
                    <input type="number" min={1} max={100000} value={totalTransactions} onChange={(e) => setTotalTransactions(Math.max(1, parseInt(e.target.value) || 1))} disabled={isRunning} />
                    {totalTransactions < activeTestCount && (
                      <span className="field-hint">{activeTestCount} tests active — top-weighted {totalTransactions} will be picked</span>
                    )}
                  </div>
                </div>
              )}

              {/* Load Profile config */}
              {isLoadProfile && (
                <div className="load-profile-panel">
                  <div className="load-profile-header">
                    <h4>Load Profile Configuration</h4>
                    <div className="profile-preview-container">
                      <ProfilePreview profile={loadProfile} />
                    </div>
                  </div>

                  <div className="profile-type-selector">
                    {(['ramp-up', 'sustained', 'spike'] as LoadProfileType[]).map((pt) => (
                      <button
                        key={pt}
                        className={`profile-type-btn ${loadProfile.type === pt ? 'active' : ''}`}
                        onClick={() => updateProfile({ type: pt })}
                        disabled={isRunning}
                      >
                        {profileLabel(pt)}
                      </button>
                    ))}
                  </div>
                  <div className="profile-type-desc">{profileDescriptions[loadProfile.type]}</div>

                  <div className="profile-fields">
                    <div className="profile-field-row">
                      <div className="profile-field">
                        <label>Duration (seconds)</label>
                        <input
                          type="number" min={5} max={3600}
                          value={loadProfile.durationSec}
                          onChange={(e) => updateProfile({ durationSec: Math.max(5, parseInt(e.target.value) || 60) })}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="profile-field">
                        <label>{loadProfile.type === 'spike' ? 'Base Concurrency' : 'Max Concurrency'}</label>
                        <input
                          type="number" min={1} max={100}
                          value={loadProfile.maxConcurrency}
                          onChange={(e) => updateProfile({ maxConcurrency: Math.max(1, parseInt(e.target.value) || 10) })}
                          disabled={isRunning}
                        />
                      </div>
                    </div>

                    {loadProfile.type === 'ramp-up' && (
                      <div className="profile-field-row">
                        <div className="profile-field">
                          <label>Ramp Duration (seconds)</label>
                          <input
                            type="number" min={1} max={loadProfile.durationSec}
                            value={loadProfile.rampUpSec ?? 30}
                            onChange={(e) => updateProfile({ rampUpSec: Math.max(1, parseInt(e.target.value) || 30) })}
                            disabled={isRunning}
                          />
                          <span className="field-hint">Time to reach max concurrency (sustains after)</span>
                        </div>
                      </div>
                    )}

                    {loadProfile.type === 'spike' && (
                      <div className="profile-field-row">
                        <div className="profile-field">
                          <label>Spike Concurrency</label>
                          <input
                            type="number" min={1} max={500}
                            value={loadProfile.spikeConcurrency ?? 30}
                            onChange={(e) => updateProfile({ spikeConcurrency: Math.max(1, parseInt(e.target.value) || 30) })}
                            disabled={isRunning}
                          />
                        </div>
                        <div className="profile-field">
                          <label>Spike Start (seconds)</label>
                          <input
                            type="number" min={0} max={loadProfile.durationSec}
                            value={loadProfile.spikeStartSec ?? 20}
                            onChange={(e) => updateProfile({ spikeStartSec: Math.max(0, parseInt(e.target.value) || 20) })}
                            disabled={isRunning}
                          />
                        </div>
                        <div className="profile-field">
                          <label>Spike Duration (seconds)</label>
                          <input
                            type="number" min={1} max={loadProfile.durationSec}
                            value={loadProfile.spikeDurationSec ?? 10}
                            onChange={(e) => updateProfile({ spikeDurationSec: Math.max(1, parseInt(e.target.value) || 10) })}
                            disabled={isRunning}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <fieldset>
                <legend>Test Distribution (weights)</legend>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-xs" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 1); setWeights(w); }}>Reset All to 1</button>
                  <button className="btn btn-xs" disabled={isRunning} onClick={() => { const w: Record<string, number> = {}; selectedTests.forEach((t) => w[t.id] = 0); setWeights(w); }}>Reset All to 0</button>
                </div>
                {selectedTests.map((t, idx) => (
                  <div key={t.id} className="weight-row">
                    <div className="weight-label">
                      <span className="test-number">{idx + 1}</span>
                      <span className={`method-badge method-${t.method.toLowerCase()}`}>{t.method}</span>
                      {t.name}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights[t.id] ?? 1}
                      onChange={(e) => setWeights({ ...weights, [t.id]: Math.max(0, parseInt(e.target.value) || 0) })}
                      disabled={isRunning}
                      className="weight-input"
                    />
                  </div>
                ))}
              </fieldset>

              <div className="form-actions">
                {!isRunning ? (
                  <button className="btn btn-primary btn-lg" onClick={handleRun} disabled={selectedTests.length === 0}>
                    ▶ Run Test
                  </button>
                ) : (
                  <button className="btn btn-danger btn-lg" onClick={abort}>
                    ■ Stop
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Progress */}
          {(isRunning || liveSummary) && (
            <div className="progress-section">
              <h3>Progress <span className="progress-mode-tag">
                {isTimeBased ? (
                  <>
                    {profileLabel(loadProfile.type)}
                    {' · '}Peak:{loadProfile.maxConcurrency}
                    {' · '}{loadProfile.durationSec}s
                    {loadProfile.type === 'ramp-up' && ` · ramp ${loadProfile.rampUpSec ?? loadProfile.durationSec}s`}
                    {loadProfile.type === 'spike' && ` · spike to ${loadProfile.spikeConcurrency ?? loadProfile.maxConcurrency * 3}`}
                  </>
                ) : (
                  <>
                    {executionMode === 'pool' ? 'Continuous Pool' : executionMode === 'sequential' ? 'Sequential' : 'Batch'}
                    {' · '}C:{executionMode === 'sequential' ? 1 : concurrency}
                    {' · '}T:{total}
                    {' · '}{executionMode === 'sequential'
                      ? 'One request at a time'
                      : executionMode === 'batch'
                        ? `${concurrency} parallel, wait for all, repeat`
                        : `${concurrency} always in-flight`}
                  </>
                )}
              </span></h3>

              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${progressPct}%` }}></div>
                <span className="progress-text">
                  {isTimeBased ? (
                    <>
                      {profileMeta ? `${(profileMeta.elapsedMs / 1000).toFixed(1)}s` : '0s'} / {profileMeta ? (profileMeta.durationMs / 1000).toFixed(0) : loadProfile.durationSec}s
                      {' '}({completed} requests)
                    </>
                  ) : (
                    <>{completed} / {total} ({progressPct}%)</>
                  )}
                </span>
              </div>

              {liveSummary && (
                <div className="live-metrics">
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.tps}</div>
                    <div className="metric-label">TPS</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.avgResponseTime} ms</div>
                    <div className="metric-label">Avg Response</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.errorRate}%</div>
                    <div className="metric-label">Error Rate</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">{liveSummary.failedValidations}</div>
                    <div className="metric-label">Validation Failures</div>
                  </div>
                  {isTimeBased && profileMeta && (
                    <div className="metric-card">
                      <div className="metric-value">{profileMeta.currentInFlight} / {profileMeta.targetConcurrency}</div>
                      <div className="metric-label">Concurrency</div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Charts */}
              {timeSeries.length >= 2 && (
                <LiveCharts data={timeSeries} isTimeBased={isTimeBased} />
              )}
            </div>
          )}

          {/* Completion */}
          {finalRun && !isRunning && (
            <div className="completion-section">
              <div className="completion-banner">
                Test completed — {finalRun.results.length} requests in {(finalRun.summary.totalDurationMs / 1000).toFixed(2)}s
              </div>
              <button className="btn btn-primary" onClick={onComplete}>
                View Full Results →
              </button>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {pendingRun && (
            <div className="storage-quota-banner">
              <div className="storage-quota-msg">
                <strong>Storage full</strong> — the test completed successfully but could not be saved due to a storage error.
                Would you like to remove old runs and retry?
              </div>
              <div className="storage-quota-actions">
                <button className="btn btn-primary btn-sm" onClick={confirmSavePendingRun}>Yes, remove old runs &amp; save</button>
                <button className="btn btn-sm" onClick={dismissPendingRun}>Discard this run</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
