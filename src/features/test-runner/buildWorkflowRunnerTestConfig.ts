import type {
  TestConfig,
  LoadProfileConfig,
  ThinkTimeConfig,
  CorrelationWaitRunnerConfig,
  ErrorPolicy,
  SlaTarget,
  ExecutionTraceOptions,
} from '../../shared/types';
import type { Workflow } from '../workflow/types/workflow';

export interface BuildWorkflowRunnerTestConfigParams {
  runWorkflow: Workflow;
  runWorkflowId: string;
  runVariables: Record<string, string>;
  resolvedBaseUrl?: string;
  isWaitForReal: boolean;
  runIsLoadProfile: boolean;
  runLoadProfile: LoadProfileConfig;
  runConcurrency: number;
  runIterations: number;
  thinkTime: ThinkTimeConfig;
  timeoutSec: number;
  retryCount: number;
  retryDelayMs: number;
  errorPolicy: ErrorPolicy;
  maxErrors: number;
  maxErrorRate: number;
  workflowSlaOverrides: SlaTarget[];
  hasCorrelationWait: boolean;
  correlationWaitConfig?: CorrelationWaitRunnerConfig;
  hasWaitForCondition: boolean;
  maxConcurrentPolls: number;
  traceOptions: ExecutionTraceOptions;
}

export function buildWorkflowRunnerTestConfig(params: BuildWorkflowRunnerTestConfigParams): TestConfig {
  const {
    runWorkflow,
    runWorkflowId,
    runVariables,
    resolvedBaseUrl,
    isWaitForReal,
    runIsLoadProfile,
    runLoadProfile,
    runConcurrency,
    runIterations,
    thinkTime,
    timeoutSec,
    retryCount,
    retryDelayMs,
    errorPolicy,
    maxErrors,
    maxErrorRate,
    workflowSlaOverrides,
    hasCorrelationWait,
    correlationWaitConfig,
    hasWaitForCondition,
    maxConcurrentPolls,
    traceOptions,
  } = params;

  const effectiveBaseUrl = runVariables.baseUrl?.trim() || resolvedBaseUrl?.trim() || undefined;

  return {
    concurrency: isWaitForReal ? 1 : (runIsLoadProfile ? runLoadProfile.maxConcurrency : runConcurrency),
    iterations: isWaitForReal ? 1 : (runIsLoadProfile ? 0 : runIterations),
    scenarioWeights: [],
    executionMode: 'workflow',
    ...(runIsLoadProfile && !isWaitForReal ? { loadProfile: runLoadProfile } : {}),
    thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
    timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
    retryCount: retryCount > 0 ? retryCount : 0,
    retryDelayMs,
    errorPolicy,
    maxErrors,
    maxErrorRate,
    workflowVariables: Object.keys(runVariables).length > 0 ? runVariables : undefined,
    workflowId: runWorkflowId,
    slaTargets: (() => {
      const baseSla = runWorkflow.slaTargets ?? [];
      const conflictKey = (t: SlaTarget) => `${t.metric}:${t.scenarioName ?? ''}`;
      const overrideKeys = new Set(workflowSlaOverrides.map(conflictKey));
      const merged = [
        ...baseSla.filter((t) => !overrideKeys.has(conflictKey(t))),
        ...workflowSlaOverrides,
      ];
      return merged.length ? merged : undefined;
    })(),
    correlationWaitConfig: hasCorrelationWait ? correlationWaitConfig : undefined,
    maxConcurrentPolls: hasWaitForCondition ? maxConcurrentPolls : undefined,
    traceOptions,
    workflowBaseUrl: effectiveBaseUrl,
  };
}
