import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';
import type { ReportOptions } from '../../results/utils/reportGenerator';

export type HostMode = 'hardcoded' | 'settings' | 'custom';

export interface RunnerConfig {
  concurrency: number;
  iterations: number;
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

export const defaultConfig: RunnerConfig = {
  concurrency: 1, iterations: 1, selectedScenarios: [], weights: {},
  skipValidation: false, validationOverride: 'default', forceUnordered: false,
  hostMode: 'settings', customBaseUrl: '', executionMode: 'batch',
};

export interface ResolvedConfig {
  concurrency: number;
  iterations: number;
  selectedScenarios: string[];
  weights: Record<string, number>;
  skipValidation: boolean;
  validationOverride: 'default' | 'none' | 'selective' | 'full';
  forceUnordered: boolean;
  hostMode: HostMode;
  customBaseUrl: string;
  executionMode: ExecutionMode;
  loadProfile: LoadProfileConfig;
  thinkTime: ThinkTimeConfig;
  timeoutSec: number;
  retryCount: number;
  retryDelayMs: number;
  errorPolicy: ErrorPolicy;
  maxErrors: number;
  maxErrorRate: number;
  autoReport: boolean;
  autoReportFormat: ReportOptions['format'];
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
    validationOverride: saved.validationOverride ?? 'default',
    forceUnordered: saved.forceUnordered ?? false,
    hostMode: saved.hostMode ?? 'settings',
    customBaseUrl: saved.customBaseUrl ?? '',
    executionMode: saved.executionMode ?? 'batch',
    loadProfile: saved.loadProfile ?? { ...defaultLoadProfile },
    thinkTime: saved.thinkTime ?? { ...defaultThinkTime },
    timeoutSec: saved.timeoutSec ?? 10,
    retryCount: saved.retryCount ?? 0,
    retryDelayMs: saved.retryDelayMs ?? 1000,
    errorPolicy: saved.errorPolicy ?? 'continue',
    maxErrors: saved.maxErrors ?? 10,
    maxErrorRate: saved.maxErrorRate ?? 50,
    autoReport: saved.autoReport ?? false,
    autoReportFormat: saved.autoReportFormat ?? 'html',
  };
}
