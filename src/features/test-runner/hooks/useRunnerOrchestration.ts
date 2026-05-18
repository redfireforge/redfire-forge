import { useState, useMemo, useEffect, useRef } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Scenario, TestConfig, ScenarioWeight, SharedDataSource, ScenarioKind, ExecutionMode } from '../../../shared/types';
import type { LoadProfileConfig } from '../../../shared/types';
import type { AllocationSummary } from '../../../engine/allocationEngine';
import { useTestExecution } from './useTestExecution';
import { useRunnerConfig } from './useRunnerConfig';
import { resolveSharedDataSources } from '../../../engine/dataSourceExpander';
import { computeAllocation } from '../../../engine/allocationEngine';
import { buildSelectedTests } from '../utils/buildSelectedTests';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress } from '../utils/runnerProgressStorage';
import { generateReport, downloadReport } from '../../results/utils/reportGenerator';

interface RunnerOrchestrationOptions {
  featureGroups: FeatureGroup[];
  kind: ScenarioKind;
  envId?: string;
  svcId?: string;
  envName?: string;
  svcName?: string;
  resolvedBaseUrl?: string;
  globalAuthProfiles: GlobalAuthProfile[];
  envFallbackAuth?: import('../../../shared/types').AuthConfig;
  sharedDataSources: SharedDataSource[];
}

export interface RunnerOrchestrationResult {
  config: ReturnType<typeof useRunnerConfig>;
  execution: ReturnType<typeof useTestExecution>;
  selectedTests: ReturnType<typeof buildSelectedTests>;
  activeTests: Scenario[];
  activeTestCount: number;
  allocation: AllocationSummary;
  isLoadProfile: boolean;
  isGalleryEnv: boolean;
  weightsExpanded: boolean;
  setWeightsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  runnerTagFilter: string;
  setRunnerTagFilter: React.Dispatch<React.SetStateAction<string>>;
  savedProgress: PersistedProgress | null;
  handleClearProgress: () => void;
  handleRun: () => void;
  updateProfile: (patch: Partial<LoadProfileConfig>) => void;
  showProgress: boolean;
  displaySummary: PersistedProgress['summary'] | null;
  displayTimeSeries: PersistedProgress['timeSeries'];
  displayCompleted: number;
  displayTotal: number;
  displayProfileMeta: PersistedProgress['profileMeta'] | null;
  displayExecMode: ExecutionMode;
  displayConc: number;
  displayLoadProfile: LoadProfileConfig;
  displayThinkTime: import('../../../shared/types').ThinkTimeConfig;
  hostLabel: string;
}

export function useRunnerOrchestration(opts: RunnerOrchestrationOptions): RunnerOrchestrationResult {
  const {
    featureGroups, kind, envId, svcId, envName, svcName,
    resolvedBaseUrl, globalAuthProfiles, envFallbackAuth, sharedDataSources,
  } = opts;

  const configSuffix = kind === 'parameterized' ? 'param' : undefined;
  const configContextKey = [envId, svcId, configSuffix].filter(Boolean).join(':') || configSuffix;
  const progressKey = configSuffix
    ? `${configSuffix}:${[envId, svcId].filter(Boolean).join(':') || '_default'}`
    : [envId, svcId].filter(Boolean).join(':') || '_default';
  const isGalleryEnv = svcName === 'Gallery Samples';

  const config = useRunnerConfig(configContextKey);
  const {
    concurrency, iterations, selectedScenarios, weights, setWeights,
    skipValidation, validationOverride, forceUnordered,
    hostMode, customBaseUrl, executionMode, loadProfile, setLoadProfile,
    thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy,
    maxErrors, maxErrorRate, autoReport, autoReportFormat,
  } = config;

  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [runnerTagFilter, setRunnerTagFilter] = useState('');
  const autoReportFiredRef = useRef<string | null>(null);

  const execution = useTestExecution();
  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, finalRun } = execution;

  const selectedTests = useMemo(
    () => buildSelectedTests(
      featureGroups, selectedScenarios, hostMode, customBaseUrl,
      resolvedBaseUrl, skipValidation, validationOverride, forceUnordered,
      globalAuthProfiles, envFallbackAuth,
    ),
    [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl,
     skipValidation, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth]
  );

  useEffect(() => {
    const w: Record<string, number> = {};
    selectedTests.forEach((t) => (w[t.id] = weights[t.id] ?? 1));
    if (JSON.stringify(w) !== JSON.stringify(weights)) {
      setWeights(w);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTests]);

  useEffect(() => {
    setSavedProgress(loadProgress(progressKey));
  }, [progressKey]);

  useEffect(() => {
    if (finalRun && liveSummary && !isRunning) {
      const data: PersistedProgress = {
        summary: liveSummary,
        timeSeries,
        completed,
        total,
        profileMeta,
        isTimeBased: executionMode === 'load-profile',
        executionMode,
        concurrency,
        loadProfile,
        thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
        resultCount: finalRun.results.length,
        durationMs: finalRun.summary.totalDurationMs,
      };
      saveProgress(progressKey, data);
      setSavedProgress(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRun, isRunning]);

  useEffect(() => {
    if (!autoReport || !finalRun || isRunning) return;
    if (autoReportFiredRef.current === finalRun.id) return;
    autoReportFiredRef.current = finalRun.id;
    const content = generateReport(finalRun, { format: autoReportFormat });
    const date = new Date(finalRun.timestamp).toISOString().slice(0, 10);
    const base = [finalRun.svcName, finalRun.envName, date].filter(Boolean).join('_');
    const ext = autoReportFormat === 'markdown' ? 'md' : autoReportFormat;
    const mime = autoReportFormat === 'html' ? 'text/html' : autoReportFormat === 'json' ? 'application/json' : 'text/markdown';
    downloadReport(content, `${base}_report.${ext}`, mime);
  }, [finalRun, isRunning, autoReport, autoReportFormat]);

  const handleClearProgress = () => {
    clearProgress(progressKey);
    setSavedProgress(null);
  };

  const activeTests = useMemo(() => selectedTests.filter((t) => (weights[t.id] ?? 1) > 0), [selectedTests, weights]);
  const activeTestCount = activeTests.length;
  const isLoadProfile = executionMode === 'load-profile';

  const allocation = useMemo(
    () => computeAllocation(activeTests as Scenario[], iterations, kind),
    [activeTests, iterations, kind],
  );

  const handleRun = () => {
    let testsToRun = selectedTests as Scenario[];
    if (runnerTagFilter) {
      const tags = runnerTagFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      testsToRun = selectedTests.map(t => {
        if (!t.dataSource || t.dataSource.rows.length === 0) return t;
        const filteredRows = t.dataSource.rows.filter(row => {
          const rowTags = row.tags ?? [];
          return rowTags.length > 0 && tags.some(ft => rowTags.includes(ft));
        });
        return { ...t, dataSource: { ...t.dataSource, rows: filteredRows } };
      }).filter(t => {
        if (t.dataSource && t.dataSource.columns.length > 0 && t.dataSource.rows.length === 0) return false;
        return true;
      });
    }

    const scenarioWeights: ScenarioWeight[] = testsToRun.map((t) => ({
      scenarioId: t.id,
      weight: weights[t.id] ?? 1,
    }));

    const cfg: TestConfig = {
      concurrency: isLoadProfile ? loadProfile.maxConcurrency : concurrency,
      iterations: isLoadProfile ? 0 : iterations,
      scenarioWeights,
      executionMode,
      ...(isLoadProfile ? { loadProfile } : {}),
      thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
    };

    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    const resolvedTests = resolveSharedDataSources(testsToRun, sharedDataSources);
    execution.execute(cfg, resolvedTests, { envName, svcName, baseUrl: usedBaseUrl });
  };

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = !!(hasLiveProgress || (!isRunning && savedProgress));

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = isRunning ? timeSeries : (timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? []);
  const displayCompleted = hasLiveProgress ? completed : savedProgress?.completed ?? 0;
  const displayTotal = hasLiveProgress ? total : savedProgress?.total ?? 0;
  const displayProfileMeta = profileMeta ?? savedProgress?.profileMeta ?? null;
  const displayExecMode = hasLiveProgress ? executionMode : savedProgress?.executionMode ?? executionMode;
  const displayConc = hasLiveProgress ? concurrency : savedProgress?.concurrency ?? concurrency;
  const displayLoadProfile = hasLiveProgress ? loadProfile : savedProgress?.loadProfile ?? loadProfile;
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const hostLabel = hostMode === 'settings' && resolvedBaseUrl ? resolvedBaseUrl : hostMode === 'custom' && customBaseUrl.trim() ? customBaseUrl.trim() : 'Original';

  return {
    config, execution, selectedTests, activeTests: activeTests as Scenario[],
    activeTestCount, allocation, isLoadProfile, isGalleryEnv,
    weightsExpanded, setWeightsExpanded, runnerTagFilter, setRunnerTagFilter,
    savedProgress, handleClearProgress, handleRun, updateProfile,
    showProgress, displaySummary, displayTimeSeries, displayCompleted,
    displayTotal, displayProfileMeta, displayExecMode, displayConc,
    displayLoadProfile, displayThinkTime, hostLabel,
  };
}
