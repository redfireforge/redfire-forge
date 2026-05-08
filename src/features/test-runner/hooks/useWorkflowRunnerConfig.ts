/**
 * Hook that manages the WorkflowRunner's persisted configuration state.
 * Simplified version of useRunnerConfig, without scenario-specific state.
 */
import { useState, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '../../../shared/utils/storage';
import { defaultLoadProfile, defaultThinkTime } from './useRunnerConfig';

export interface WorkflowRunnerConfig {
  concurrency: number;
  totalTransactions: number;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
  /** Last selected workflow ID */
  selectedWorkflowId?: string;
}

const defaultConfig: WorkflowRunnerConfig = {
  concurrency: 1,
  totalTransactions: 1,
  executionMode: 'batch',
};

export interface UseWorkflowRunnerConfigResult {
  concurrency: number;
  setConcurrency: React.Dispatch<React.SetStateAction<number>>;
  totalTransactions: number;
  setTotalTransactions: React.Dispatch<React.SetStateAction<number>>;
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
  selectedWorkflowId: string | null;
  setSelectedWorkflowId: React.Dispatch<React.SetStateAction<string | null>>;
  configLoaded: boolean;
}

/**
 * Manages workflow runner configuration state and auto-persists to storage.
 * Uses a separate storage key from the regular TestRunner.
 */
export function useWorkflowRunnerConfig(): UseWorkflowRunnerConfigResult {
  const storageKey = '_workflow_runner';
  
  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [totalTransactions, setTotalTransactions] = useState(defaultConfig.totalTransactions);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('batch');
  const [loadProfile, setLoadProfile] = useState<LoadProfileConfig>({ ...defaultLoadProfile });
  const [thinkTime, setThinkTime] = useState<ThinkTimeConfig>({ ...defaultThinkTime });
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelayMs, setRetryDelayMs] = useState(1000);
  const [errorPolicy, setErrorPolicy] = useState<ErrorPolicy>('continue');
  const [maxErrors, setMaxErrors] = useState(10);
  const [maxErrorRate, setMaxErrorRate] = useState(50);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config from storage on mount
  useEffect(() => {
    setConfigLoaded(false);
    loadRunnerConfigAsync(storageKey).then((raw) => {
      if (raw) {
        const saved = raw as WorkflowRunnerConfig;
        setConcurrency(saved.concurrency ?? defaultConfig.concurrency);
        setTotalTransactions(saved.totalTransactions ?? defaultConfig.totalTransactions);
        // Sanitize: 'workflow' is an internal execution mode and should never appear
        // in the Workflow Runner's UI config (valid options: sequential, batch, pool, load-profile)
        const savedMode = saved.executionMode;
        const validUiModes: ExecutionMode[] = ['sequential', 'batch', 'pool', 'load-profile'];
        setExecutionMode(validUiModes.includes(savedMode) ? savedMode : 'batch');
        if (saved.loadProfile) setLoadProfile(saved.loadProfile);
        if (saved.thinkTime) setThinkTime(saved.thinkTime);
        setTimeoutSec(saved.timeoutSec ?? 10);
        setRetryCount(saved.retryCount ?? 0);
        setRetryDelayMs(saved.retryDelayMs ?? 1000);
        setErrorPolicy(saved.errorPolicy ?? 'continue');
        setMaxErrors(saved.maxErrors ?? 10);
        setMaxErrorRate(saved.maxErrorRate ?? 50);
        setSelectedWorkflowId(saved.selectedWorkflowId ?? null);
      }
      setConfigLoaded(true);
    });
  }, []);

  // Auto-save config to storage whenever it changes
  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      totalTransactions,
      selectedScenarios: [],
      weights: {},
      skipValidation: false,
      validationOverride: 'default',
      forceUnordered: false,
      hostMode: 'hardcoded',
      customBaseUrl: '',
      executionMode,
      loadProfile,
      thinkTime,
      timeoutSec,
      retryCount,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      selectedWorkflowId: selectedWorkflowId ?? undefined,
    } as WorkflowRunnerConfig, storageKey);
  }, [configLoaded, concurrency, totalTransactions, executionMode, loadProfile, thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors, maxErrorRate, selectedWorkflowId]);

  return {
    concurrency, setConcurrency,
    totalTransactions, setTotalTransactions,
    executionMode, setExecutionMode,
    loadProfile, setLoadProfile,
    thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec,
    retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs,
    errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors,
    maxErrorRate, setMaxErrorRate,
    selectedWorkflowId, setSelectedWorkflowId,
    configLoaded,
  };
}
