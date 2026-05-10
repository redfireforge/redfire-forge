/**
 * Hook that manages the TestRunner's persisted configuration state.
 * Extracted from TestRunner.tsx to reduce component size and isolate config concerns.
 */
import { useState, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../../../shared/utils/storage';
import type { ReportOptions } from '../../results/utils/reportGenerator';
import { defaultLoadProfile, defaultThinkTime, defaultConfig, resolveLoadedConfig } from './runnerConfigDefaults';
import type { HostMode } from './runnerConfigDefaults';

export { defaultLoadProfile, defaultThinkTime, defaultConfig, resolveLoadedConfig } from './runnerConfigDefaults';
export type { RunnerConfig, HostMode } from './runnerConfigDefaults';

export interface UseRunnerConfigResult {
  concurrency: number;
  setConcurrency: React.Dispatch<React.SetStateAction<number>>;
  iterations: number;
  setIterations: React.Dispatch<React.SetStateAction<number>>;
  selectedScenarios: Set<string>;
  setSelectedScenarios: React.Dispatch<React.SetStateAction<Set<string>>>;
  weights: Record<string, number>;
  setWeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  skipValidation: boolean;
  setSkipValidation: React.Dispatch<React.SetStateAction<boolean>>;
  validationOverride: 'default' | 'none' | 'selective' | 'full';
  setValidationOverride: React.Dispatch<React.SetStateAction<'default' | 'none' | 'selective' | 'full'>>;
  forceUnordered: boolean;
  setForceUnordered: React.Dispatch<React.SetStateAction<boolean>>;
  hostMode: HostMode;
  setHostMode: React.Dispatch<React.SetStateAction<HostMode>>;
  customBaseUrl: string;
  setCustomBaseUrl: React.Dispatch<React.SetStateAction<string>>;
  executionMode: ExecutionMode;
  setExecutionMode: React.Dispatch<React.SetStateAction<ExecutionMode>>;
  loadProfile: LoadProfileConfig;
  setLoadProfile: React.Dispatch<React.SetStateAction<LoadProfileConfig>>;
  thinkTime: ThinkTimeConfig;
  setThinkTime: React.Dispatch<React.SetStateAction<ThinkTimeConfig>>;
  timeoutSec: number;
  setTimeoutSec: React.Dispatch<React.SetStateAction<number>>;
  retryCount: number;
  setRetryCount: React.Dispatch<React.SetStateAction<number>>;
  retryDelayMs: number;
  setRetryDelayMs: React.Dispatch<React.SetStateAction<number>>;
  errorPolicy: ErrorPolicy;
  setErrorPolicy: React.Dispatch<React.SetStateAction<ErrorPolicy>>;
  maxErrors: number;
  setMaxErrors: React.Dispatch<React.SetStateAction<number>>;
  maxErrorRate: number;
  setMaxErrorRate: React.Dispatch<React.SetStateAction<number>>;
  autoReport: boolean;
  setAutoReport: React.Dispatch<React.SetStateAction<boolean>>;
  autoReportFormat: ReportOptions['format'];
  setAutoReportFormat: React.Dispatch<React.SetStateAction<ReportOptions['format']>>;
  configLoaded: boolean;
}

/**
 * Manages all runner configuration state and auto-persists to storage.
 * Loads previously saved config when the context key changes (env/svc switch).
 */
export function useRunnerConfig(configContextKey: string | undefined): UseRunnerConfigResult {
  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [iterations, setIterations] = useState(defaultConfig.iterations);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [skipValidation, setSkipValidation] = useState(false);
  const [validationOverride, setValidationOverride] = useState<'default' | 'none' | 'selective' | 'full'>('default');
  const [forceUnordered, setForceUnordered] = useState(false);
  const [hostMode, setHostMode] = useState<HostMode>('settings');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [loadProfile, setLoadProfile] = useState<LoadProfileConfig>({ ...defaultLoadProfile });
  const [thinkTime, setThinkTime] = useState<ThinkTimeConfig>({ ...defaultThinkTime });
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(1000);
  const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>('continue');
  const [maxErrors, setMaxErrors] = useState(10);
  const [maxErrorRate, setMaxErrorRate] = useState(50);
  const [autoReport, setAutoReport] = useState(false);
  const [autoReportFormat, setAutoReportFormat] = useState<ReportOptions['format']>('html');
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config from storage when context key changes
  useEffect(() => {
    setConfigLoaded(false);
    loadRunnerConfigAsync(configContextKey).then((raw) => {
      const resolved = resolveLoadedConfig(raw);
      const cfg = resolved ?? {
        ...defaultConfig,
        selectedScenarios: [],
        weights: {},
        loadProfile: { ...defaultLoadProfile },
        thinkTime: { ...defaultThinkTime },
        timeoutSec: 10, retryCount: 0, retryDelayMs: 1000,
        errorPolicy: 'continue' as const, maxErrors: 10, maxErrorRate: 50,
        autoReport: false, autoReportFormat: 'html' as const,
      };
      setConcurrency(cfg.concurrency);
      setIterations(cfg.iterations);
      setSelectedScenarios(new Set(cfg.selectedScenarios));
      setWeights(cfg.weights);
      setSkipValidation(cfg.skipValidation);
      setValidationOverride(cfg.validationOverride);
      setForceUnordered(cfg.forceUnordered);
      setHostMode(cfg.hostMode);
      setCustomBaseUrl(cfg.customBaseUrl);
      setExecutionMode(cfg.executionMode);
      setLoadProfile(cfg.loadProfile);
      setThinkTime(cfg.thinkTime);
      setTimeoutSec(cfg.timeoutSec);
      setRetryCount(cfg.retryCount);
      setRetryDelayMs(cfg.retryDelayMs);
      setErrorPolicy(cfg.errorPolicy);
      setMaxErrors(cfg.maxErrors);
      setMaxErrorRate(cfg.maxErrorRate);
      setAutoReport(cfg.autoReport);
      setAutoReportFormat(cfg.autoReportFormat);
      setConfigLoaded(true);
    });
  }, [configContextKey]);

  // Auto-save config to storage whenever it changes
  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      iterations,
      selectedScenarios: Array.from(selectedScenarios),
      weights,
      skipValidation,
      validationOverride,
      forceUnordered,
      hostMode,
      customBaseUrl,
      executionMode,
      loadProfile,
      thinkTime,
      timeoutSec,
      retryCount,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      autoReport,
      autoReportFormat,
    }, configContextKey);
  }, [configLoaded, configContextKey, concurrency, iterations, selectedScenarios, weights,
    skipValidation, validationOverride, forceUnordered, hostMode, customBaseUrl, executionMode,
    loadProfile, thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors,
    maxErrorRate, autoReport, autoReportFormat]);

  return {
    concurrency, setConcurrency,
    iterations, setIterations,
    selectedScenarios, setSelectedScenarios,
    weights, setWeights,
    skipValidation, setSkipValidation,
    validationOverride, setValidationOverride,
    forceUnordered, setForceUnordered,
    hostMode, setHostMode,
    customBaseUrl, setCustomBaseUrl,
    executionMode, setExecutionMode,
    loadProfile, setLoadProfile,
    thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec,
    retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs,
    errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors,
    maxErrorRate, setMaxErrorRate,
    autoReport, setAutoReport,
    autoReportFormat, setAutoReportFormat,
    configLoaded,
  };
}
