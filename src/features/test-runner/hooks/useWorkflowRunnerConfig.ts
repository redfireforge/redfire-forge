/**
 * Hook that manages the WorkflowRunner's persisted configuration state.
 * Simplified version of useRunnerConfig, without scenario-specific state.
 */
import { useState, useEffect } from 'react';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig, ExecutionTraceOptions, KafkaResultsPublishConfig } from '@shared/types';
import { saveRunnerConfig, loadRunnerConfig as loadRunnerConfigAsync } from '@shared/utils/storage';
import { defaultLoadProfile, defaultThinkTime } from './runnerConfigDefaults';

export interface WorkflowRunnerConfig {
  concurrency: number;
  iterations: number;
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
  /** Trace capture options */
  traceOptions?: ExecutionTraceOptions;
  /** Kafka results publishing configuration */
  kafkaResultsPublish?: KafkaResultsPublishConfig;
}

const defaultConfig: WorkflowRunnerConfig = {
  concurrency: 1,
  iterations: 1,
  executionMode: 'batch',
};

export interface UseWorkflowRunnerConfigResult {
  concurrency: number;
  setConcurrency: React.Dispatch<React.SetStateAction<number>>;
  iterations: number;
  setIterations: React.Dispatch<React.SetStateAction<number>>;
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
  traceOptions: ExecutionTraceOptions;
  setTraceOptions: React.Dispatch<React.SetStateAction<ExecutionTraceOptions>>;
  kafkaResultsPublish: KafkaResultsPublishConfig | undefined;
  setKafkaResultsPublish: React.Dispatch<React.SetStateAction<KafkaResultsPublishConfig | undefined>>;
  configLoaded: boolean;
}

/**
 * Manages workflow runner configuration state and auto-persists to storage.
 * Uses a separate storage key from the regular TestRunner.
 */
export function useWorkflowRunnerConfig(): UseWorkflowRunnerConfigResult {
  const storageKey = '_workflow_runner';
  
  const [concurrency, setConcurrency] = useState(defaultConfig.concurrency);
  const [iterations, setIterations] = useState(defaultConfig.iterations);
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
  const [traceOptions, setTraceOptions] = useState<ExecutionTraceOptions>({
    captureFullTrace: false,
    alwaysCaptureFailures: true,
  });
  const [kafkaResultsPublish, setKafkaResultsPublish] = useState<KafkaResultsPublishConfig | undefined>(undefined);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config from storage on mount
  useEffect(() => {
    setConfigLoaded(false);
    loadRunnerConfigAsync(storageKey).then((raw) => {
      if (raw) {
        const saved = raw as WorkflowRunnerConfig;
        setConcurrency(saved.concurrency ?? defaultConfig.concurrency);
        setIterations(saved.iterations ?? defaultConfig.iterations);
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
        if (saved.traceOptions) {
          setTraceOptions({
            captureFullTrace: saved.traceOptions.captureFullTrace ?? false,
            alwaysCaptureFailures: saved.traceOptions.alwaysCaptureFailures ?? true,
            samplingEnabled: saved.traceOptions.samplingEnabled,
            samplingThreshold: saved.traceOptions.samplingThreshold,
            traceLevel: saved.traceOptions.traceLevel,
          });
        }
        setKafkaResultsPublish(saved.kafkaResultsPublish);
      }
      setConfigLoaded(true);
    });
  }, []);

  // Auto-save config to storage whenever it changes
  useEffect(() => {
    if (!configLoaded) return;
    void saveRunnerConfig({
      concurrency,
      iterations,
      selectedScenarios: [],
      weights: {},
      skipValidation: false,
      validationOverride: 'default',
      forceUnordered: 'default',
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
      traceOptions,
      kafkaResultsPublish,
    } as WorkflowRunnerConfig, storageKey);
  }, [configLoaded, concurrency, iterations, executionMode, loadProfile, thinkTime, timeoutSec, retryCount, retryDelayMs, errorPolicy, maxErrors, maxErrorRate, selectedWorkflowId, traceOptions, kafkaResultsPublish]);

  return {
    concurrency, setConcurrency,
    iterations, setIterations,
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
    traceOptions, setTraceOptions,
    kafkaResultsPublish, setKafkaResultsPublish,
    configLoaded,
  };
}
