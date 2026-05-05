/**
 * Hook that manages the TestRunner's persisted configuration state.
 * Extracted from TestRunner.tsx to reduce component size and isolate config concerns.
 */
import { useState, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../../../shared/utils/storage';
import type { ReportOptions } from '../../results/utils/reportGenerator';

export type HostMode = 'hardcoded' | 'settings' | 'custom';

export interface RunnerConfig {
  concurrency: number;
  totalTransactions: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  validationOverride: 'default' | 'none' | 'selective' | 'full';
  forceUnordered: boolean;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
  autoReport?: boolean;
  autoReportFormat?: ReportOptions['format'];
}

export const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  durationSec: 60,
  maxConcurrency: 5,
  rampUpSec: 30,
  spikeConcurrency: 10,
  spikeStartSec: 20,
  spikeDurationSec: 10,
};

export const defaultThinkTime: ThinkTimeConfig = { mode: 'none' };

const defaultConfig: RunnerConfig = {
  concurrency: 1, totalTransactions: 1, selectedScenarios: [], weights: {},
  skipValidation: false, validationOverride: 'default', forceUnordered: false,
  hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

export interface UseRunnerConfigResult {
  concurrency: number;
  setConcurrency: React.Dispatch<React.SetStateAction<number>>;
  totalTransactions: number;
  setTotalTransactions: React.Dispatch<React.SetStateAction<number>>;
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
  const [totalTransactions, setTotalTransactions] = useState(defaultConfig.totalTransactions);
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
      if (raw) {
        const saved = raw as RunnerConfig;
        setConcurrency(saved.concurrency ?? defaultConfig.concurrency);
        setTotalTransactions(saved.totalTransactions ?? defaultConfig.totalTransactions);
        setSelectedScenarios(new Set(saved.selectedScenarios ?? []));
        setWeights(saved.weights ?? {});
        setSkipValidation(saved.skipValidation ?? false);
        setValidationOverride(saved.validationOverride ?? 'default');
        setForceUnordered(saved.forceUnordered ?? false);
        setHostMode(saved.hostMode ?? 'settings');
        setCustomBaseUrl(saved.customBaseUrl ?? '');
        setExecutionMode(saved.executionMode ?? 'batch');
        if (saved.loadProfile) setLoadProfile(saved.loadProfile);
        if (saved.thinkTime) setThinkTime(saved.thinkTime);
        setTimeoutSec(saved.timeoutSec ?? 10);
        setRetryCount(saved.retryCount ?? 0);
        setRetryDelayMs(saved.retryDelayMs ?? 1000);
        setErrorPolicy(saved.errorPolicy ?? 'continue');
        setMaxErrors(saved.maxErrors ?? 10);
        setMaxErrorRate(saved.maxErrorRate ?? 50);
        setAutoReport(saved.autoReport ?? false);
        setAutoReportFormat(saved.autoReportFormat ?? 'html');
      } else {
        setConcurrency(defaultConfig.concurrency);
        setTotalTransactions(defaultConfig.totalTransactions);
        setSelectedScenarios(new Set());
        setWeights({});
        setSkipValidation(defaultConfig.skipValidation);
        setValidationOverride(defaultConfig.validationOverride);
        setForceUnordered(defaultConfig.forceUnordered);
        setHostMode(defaultConfig.hostMode);
        setCustomBaseUrl(defaultConfig.customBaseUrl);
        setExecutionMode(defaultConfig.executionMode);
        setLoadProfile({ ...defaultLoadProfile });
        setThinkTime({ ...defaultThinkTime });
        setTimeoutSec(10);
        setRetryCount(0);
        setRetryDelayMs(1000);
        setErrorPolicy('continue');
        setMaxErrors(10);
        setMaxErrorRate(50);
        setAutoReport(false);
        setAutoReportFormat('html');
      }
      setConfigLoaded(true);
    });
  }, [configContextKey]);

  // Auto-save config to storage whenever it changes
  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      totalTransactions,
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
  }, [configLoaded, configContextKey, concurrency, totalTransactions, selectedScenarios, weights,
    skipValidation, validationOverride, forceUnordered, hostMode, customBaseUrl, executionMode,
    loadProfile, thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors,
    maxErrorRate, autoReport, autoReportFormat]);

  return {
    concurrency, setConcurrency,
    totalTransactions, setTotalTransactions,
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
