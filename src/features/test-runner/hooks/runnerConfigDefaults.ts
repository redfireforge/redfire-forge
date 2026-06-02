import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig, ArrivalRateConfig, KafkaResultsPublishConfig } from '../../../shared/types';
import type { ReportOptions } from '../../results/utils/reportGenerator';

export type HostMode = 'hardcoded' | 'settings' | 'custom';
export type UnorderedOverride = 'default' | 'force-on' | 'force-off';

export interface RunnerConfig {
  concurrency: number;
  iterations: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  skipAssertions: boolean;
  validationOverride: 'default' | 'none' | 'selective' | 'full';
  forceUnordered: UnorderedOverride;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile?: LoadProfileConfig;
  arrivalRate?: ArrivalRateConfig;
  thinkTime?: ThinkTimeConfig;
  timeoutSec?: number;
  retryCount?: number;
  retryDelayMs?: number;
  errorPolicy?: ErrorPolicy;
  maxErrors?: number;
  maxErrorRate?: number;
  autoReport?: boolean;
  autoReportFormat?: ReportOptions['format'];
  /** Optional Kafka results publishing configuration. When present and enabled, run summaries are published after completion. */
  kafkaResultsPublish?: KafkaResultsPublishConfig;
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

export const defaultConfig: RunnerConfig = {
  concurrency: 1, iterations: 1, selectedScenarios: [], weights: {},
  skipValidation: false, skipAssertions: false, validationOverride: 'default', forceUnordered: 'default' as UnorderedOverride,
  hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

export interface ResolvedConfig {
  concurrency: number;
  iterations: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  skipAssertions: boolean;
  validationOverride: 'default' | 'none' | 'selective' | 'full';
  forceUnordered: UnorderedOverride;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile: LoadProfileConfig;
  arrivalRate?: ArrivalRateConfig;
  thinkTime: ThinkTimeConfig;
  timeoutSec: number;
  retryCount: number;
  retryDelayMs: number;
  errorPolicy: ErrorPolicy;
  maxErrors: number;
  maxErrorRate: number;
  autoReport: boolean;
  autoReportFormat: ReportOptions['format'];
  /** Optional Kafka results publishing configuration. Passed through as-is from saved config (no default applied — field is opt-in). */
  kafkaResultsPublish?: KafkaResultsPublishConfig;
}

/**
 * Resolves a (possibly sparse) saved config blob into a full config with all defaults applied.
 * Returns null when raw is null (no saved config), signaling that defaults should be used directly.
 */
export function resolveLoadedConfig(raw: unknown): ResolvedConfig | null {
  if (!raw) return null;
  const saved = raw as RunnerConfig;
  return {
    concurrency: saved.concurrency ?? defaultConfig.concurrency,
    iterations: saved.iterations ?? defaultConfig.iterations,
    selectedScenarios: saved.selectedScenarios ?? [],
    weights: saved.weights ?? {},
    skipValidation: saved.skipValidation ?? false,
    skipAssertions: saved.skipAssertions ?? false,
    validationOverride: saved.validationOverride ?? 'default',
    forceUnordered: typeof saved.forceUnordered === 'boolean'
      ? (saved.forceUnordered ? 'force-on' : 'default')
      : (saved.forceUnordered ?? 'default'),
    hostMode: saved.hostMode ?? 'settings',
    customBaseUrl: saved.customBaseUrl ?? '',
    executionMode: saved.executionMode ?? 'batch',
    loadProfile: saved.loadProfile ?? { ...defaultLoadProfile },
    arrivalRate: saved.arrivalRate,
    thinkTime: saved.thinkTime ?? { ...defaultThinkTime },
    timeoutSec: saved.timeoutSec ?? 10,
    retryCount: saved.retryCount ?? 0,
    retryDelayMs: saved.retryDelayMs ?? 1000,
    errorPolicy: saved.errorPolicy ?? 'continue',
    maxErrors: saved.maxErrors ?? 10,
    maxErrorRate: saved.maxErrorRate ?? 50,
    autoReport: saved.autoReport ?? false,
    autoReportFormat: saved.autoReportFormat ?? 'html',
    kafkaResultsPublish: saved.kafkaResultsPublish,
  };
}
