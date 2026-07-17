import { useState, useMemo, useEffect, useRef } from 'react';
import type { FeatureGroup, GlobalAuthProfile, Microservice, Scenario, SlaTarget, TestConfig, ScenarioWeight, SharedDataSource, ScenarioKind, ExecutionMode, ArrivalRateConfig } from '../../../shared/types';
import { buildGrpcHarnessEnvFromRunnerContext } from '../../../shared/grpc/grpcHarnessRuntimeContext';
import type { LoadProfileConfig } from '../../../shared/types';
import type { AllocationSummary } from '../../../engine/allocationEngine';
import { useTestExecution } from './useTestExecution';
import { useRunnerConfig } from './useRunnerConfig';
import { resolveSharedDataSources, collectAllScenarioTags, countScenariosByTag } from '../../../engine/dataSourceExpander';
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
  microservices?: Microservice[];
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
  isConstantArrival: boolean;
  isGalleryEnv: boolean;
  weightsExpanded: boolean;
  setWeightsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  runnerTagFilter: string;
  setRunnerTagFilter: React.Dispatch<React.SetStateAction<string>>;
  /** Scenario-level tag filter */
  scenarioTagFilter: string[];
  setScenarioTagFilter: React.Dispatch<React.SetStateAction<string[]>>;
  /** All unique scenario tags */
  allScenarioTags: string[];
  /** Tag → scenario count */
  scenarioTagCounts: Record<string, number>;
  savedProgress: PersistedProgress | null;
  handleClearProgress: () => void;
  handleRun: () => void;
  /** Session-scoped SLA override targets (not persisted). Runner wins on metric+scenarioName conflict. */
  runnerSlaTargets: SlaTarget[];
  setRunnerSlaTargets: React.Dispatch<React.SetStateAction<SlaTarget[]>>;
  /** Scenario names for all currently selected scenarios — used to populate SlaTargetEditor dropdown. */
  selectedSlaScenarioNames: string[];
  /** Test names for all currently selected scenarios — used for test-level scope in SLA override. */
  selectedSlaTestNames: string[];
  /** Total auto-collected definition targets (FG + scenario + test level) for selected scenarios. */
  definitionSlaTargetCount: number;
  /** Full list of auto-collected definition SLA targets with scope info — for display in override panel. */
  definitionSlaTargets: Array<SlaTarget & { scopeLabel: string }>;
  updateProfile: (patch: Partial<LoadProfileConfig>) => void;
  updateArrivalRate: (patch: Partial<ArrivalRateConfig>) => void;
  showProgress: boolean;
  displaySummary: PersistedProgress['summary'] | null;
  displayTimeSeries: PersistedProgress['timeSeries'];
  displayCompleted: number;
  displayTotal: number;
  displayProfileMeta: PersistedProgress['profileMeta'] | null;
  displayExecMode: ExecutionMode;
  displayConc: number;
  displayLoadProfile: LoadProfileConfig;
  displayArrivalRate: ArrivalRateConfig;
  displayThinkTime: import('../../../shared/types').ThinkTimeConfig;
  hostLabel: string;
}

export function useRunnerOrchestration(opts: RunnerOrchestrationOptions): RunnerOrchestrationResult {
  const {
    featureGroups, kind, envId, svcId, envName, svcName,
    resolvedBaseUrl, microservices, globalAuthProfiles, envFallbackAuth, sharedDataSources,
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
    skipValidation, skipAssertions, validationOverride, forceUnordered,
    hostMode, customBaseUrl, executionMode, loadProfile, setLoadProfile,
    arrivalRate, setArrivalRate,
    thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy,
    maxErrors, maxErrorRate, autoReport, autoReportFormat,
  } = config;

  const isLoadProfile = executionMode === 'load-profile';
  const isConstantArrival = executionMode === 'constant-arrival';

  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [runnerTagFilter, setRunnerTagFilter] = useState('');
  const [scenarioTagFilter, setScenarioTagFilter] = useState<string[]>([]);
  const [runnerSlaTargets, setRunnerSlaTargets] = useState<SlaTarget[]>([]);
  const autoReportFiredRef = useRef<string | null>(null);

  // Compute all scenario tags and counts from original (unfiltered) feature groups
  const allScenarioTags = useMemo(() => collectAllScenarioTags(featureGroups), [featureGroups]);
  const scenarioTagCounts = useMemo(() => countScenariosByTag(featureGroups), [featureGroups]);

  // ── SLA-B5: scenario names + definition target count for selected scenarios ──
  const selectedSlaScenarioNames = useMemo(
    () => featureGroups.flatMap((fg) =>
      fg.scenarios.filter((sc) => selectedScenarios.has(sc.id)).map((sc) => sc.name)
    ),
    [featureGroups, selectedScenarios],
  );
  const selectedSlaTestNames = useMemo(
    () => featureGroups.flatMap((fg) =>
      fg.scenarios.filter((sc) => selectedScenarios.has(sc.id))
        .flatMap((sc) => sc.tests.map((t) => t.name))
    ),
    [featureGroups, selectedScenarios],
  );
  const definitionSlaTargets = useMemo(() => {
    const result: Array<SlaTarget & { scopeLabel: string }> = [];
    for (const fg of featureGroups) {
      for (const t of fg.slaTargets ?? []) result.push({ ...t, scopeLabel: `FG: ${fg.name}` });
      for (const sc of fg.scenarios.filter((sc) => selectedScenarios.has(sc.id))) {
        for (const t of sc.slaTargets ?? []) result.push({ ...t, scenarioName: sc.name, scopeLabel: `Scenario: ${sc.name}` });
        for (const test of sc.tests) {
          for (const t of test.slaTargets ?? []) result.push({ ...t, scenarioName: test.name, scopeLabel: `Test: ${test.name}` });
        }
      }
    }
    return result;
  }, [featureGroups, selectedScenarios]);
  const definitionSlaTargetCount = definitionSlaTargets.length;

  const execution = useTestExecution(config.kafkaResultsPublish);
  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, finalRun } = execution;

  const selectedTests = useMemo(
    () => buildSelectedTests(
      featureGroups, selectedScenarios, hostMode, customBaseUrl,
      resolvedBaseUrl, skipValidation, skipAssertions, validationOverride, forceUnordered,
      globalAuthProfiles, envFallbackAuth,
    ),
    [featureGroups, selectedScenarios, hostMode, customBaseUrl, resolvedBaseUrl,
     skipValidation, skipAssertions, validationOverride, forceUnordered, globalAuthProfiles, envFallbackAuth]
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
        isTimeBased: executionMode === 'load-profile' || executionMode === 'constant-arrival',
        executionMode,
        concurrency,
        loadProfile,
        ...(isConstantArrival ? { arrivalRate } : {}),
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

    // ── SLA-B5: collect definition targets + merge with runner overrides ──
    const baseFgTargets = featureGroups.flatMap((fg) => fg.slaTargets ?? []);
    const baseScTargets = featureGroups.flatMap((fg) =>
      fg.scenarios
        .filter((sc) => selectedScenarios.has(sc.id))
        .flatMap((sc) => (sc.slaTargets ?? []).map((t) => ({ ...t, scenarioName: sc.name })))
    );
    // Collect SLA targets from individual tests (stamped with scenarioName = test.name)
    const baseTestTargets = featureGroups.flatMap((fg) =>
      fg.scenarios
        .filter((sc) => selectedScenarios.has(sc.id))
        .flatMap((sc) => sc.tests.flatMap((test) =>
          (test.slaTargets ?? []).map((t) => ({ ...t, scenarioName: test.name }))
        ))
    );
    const baseTargets = [...baseFgTargets, ...baseScTargets, ...baseTestTargets];
    const conflictKey = (t: SlaTarget) => `${t.metric}:${t.scenarioName ?? ''}`;
    const overrideKeys = new Set(runnerSlaTargets.map(conflictKey));
    const mergedSlaTargets = [
      ...baseTargets.filter((t) => !overrideKeys.has(conflictKey(t))),
      ...runnerSlaTargets,
    ];

    const cfg: TestConfig = {
      concurrency: isLoadProfile ? loadProfile.maxConcurrency : (isConstantArrival ? 1 : concurrency),
      iterations: (isLoadProfile || isConstantArrival) ? 0 : iterations,
      scenarioWeights,
      executionMode,
      ...(isLoadProfile ? { loadProfile } : {}),
      ...(isConstantArrival ? { arrivalRate } : {}),
      thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      ...(mergedSlaTargets.length > 0 ? { slaTargets: mergedSlaTargets } : {}),
    };

    const usedBaseUrl = hostMode === 'settings' ? (resolvedBaseUrl || undefined) : hostMode === 'custom' ? (customBaseUrl.trim() || undefined) : undefined;
    const resolvedTests = resolveSharedDataSources(testsToRun, sharedDataSources);
    const grpcHarnessEnv = buildGrpcHarnessEnvFromRunnerContext(microservices, svcId, envId, envName);
    execution.execute(cfg, resolvedTests, { envName, svcName, baseUrl: usedBaseUrl, grpcHarnessEnv });
  };

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const updateArrivalRate = (patch: Partial<ArrivalRateConfig>) => {
    setArrivalRate((prev) => ({ ...prev, ...patch }));
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
  const displayArrivalRate = hasLiveProgress ? arrivalRate : savedProgress?.arrivalRate ?? arrivalRate;
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const hostLabel = hostMode === 'settings' && resolvedBaseUrl ? resolvedBaseUrl : hostMode === 'custom' && customBaseUrl.trim() ? customBaseUrl.trim() : 'Original';

  return {
    config, execution, selectedTests, activeTests: activeTests as Scenario[],
    activeTestCount, allocation, isLoadProfile, isConstantArrival, isGalleryEnv,
    weightsExpanded, setWeightsExpanded, runnerTagFilter, setRunnerTagFilter,
    scenarioTagFilter, setScenarioTagFilter, allScenarioTags, scenarioTagCounts,
    savedProgress, handleClearProgress, handleRun, updateProfile, updateArrivalRate,
    showProgress, displaySummary, displayTimeSeries, displayCompleted,
    displayTotal, displayProfileMeta, displayExecMode, displayConc,
    displayLoadProfile, displayArrivalRate, displayThinkTime, hostLabel,
    runnerSlaTargets, setRunnerSlaTargets,
    selectedSlaScenarioNames, selectedSlaTestNames,
    definitionSlaTargetCount, definitionSlaTargets,
  };
}
