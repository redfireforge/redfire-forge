import { describe, it, expect } from 'vitest';
import { buildWorkflowRunnerTestConfig } from './buildWorkflowRunnerTestConfig';
import type { Workflow } from '../workflow/types/workflow';

const baseWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Test',
  nodes: [],
  edges: [],
  slaTargets: [{ metric: 'p95', threshold: 500, scenarioName: 's1' }],
};

const baseParams = {
  runWorkflow: baseWorkflow,
  runWorkflowId: 'wf-1',
  runVariables: {} as Record<string, string>,
  isWaitForReal: false,
  runIsLoadProfile: false,
  runLoadProfile: { maxConcurrency: 10, durationSec: 60, rampUpSec: 0 },
  runConcurrency: 5,
  runIterations: 3,
  thinkTime: { mode: 'none' as const },
  timeoutSec: 30,
  retryCount: 0,
  retryDelayMs: 100,
  errorPolicy: 'continue' as const,
  maxErrors: 10,
  maxErrorRate: 0.1,
  workflowSlaOverrides: [] as typeof baseWorkflow.slaTargets,
  hasCorrelationWait: false,
  hasWaitForCondition: false,
  maxConcurrentPolls: 2,
  traceOptions: { enabled: false },
};

describe('buildWorkflowRunnerTestConfig', () => {
  it('uses load profile concurrency and iterations when enabled', () => {
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      runIsLoadProfile: true,
      runLoadProfile: { maxConcurrency: 20, durationSec: 120, rampUpSec: 5 },
    });
    expect(cfg.concurrency).toBe(20);
    expect(cfg.iterations).toBe(0);
    expect(cfg.loadProfile).toEqual({ maxConcurrency: 20, durationSec: 120, rampUpSec: 5 });
  });

  it('forces single iteration when wait-for-real', () => {
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      isWaitForReal: true,
      runIsLoadProfile: true,
      runConcurrency: 50,
      runIterations: 10,
    });
    expect(cfg.concurrency).toBe(1);
    expect(cfg.iterations).toBe(1);
    expect(cfg.loadProfile).toBeUndefined();
  });

  it('resolves workflowBaseUrl from variables then resolvedBaseUrl', () => {
    expect(
      buildWorkflowRunnerTestConfig({
        ...baseParams,
        runVariables: { baseUrl: '  http://vars.test  ' },
        resolvedBaseUrl: 'http://resolved.test',
      }).workflowBaseUrl,
    ).toBe('http://vars.test');
    expect(
      buildWorkflowRunnerTestConfig({
        ...baseParams,
        resolvedBaseUrl: 'http://resolved.test',
      }).workflowBaseUrl,
    ).toBe('http://resolved.test');
  });

  it('omits optional fields when defaults are empty', () => {
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      runWorkflow: { ...baseWorkflow, slaTargets: undefined },
      timeoutSec: 0,
      thinkTime: { mode: 'none' },
    });
    expect(cfg.timeoutSec).toBeUndefined();
    expect(cfg.thinkTime).toBeUndefined();
    expect(cfg.workflowVariables).toBeUndefined();
    expect(cfg.slaTargets).toBeUndefined();
  });

  it('merges SLA overrides and drops conflicting workflow targets', () => {
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      workflowSlaOverrides: [{ metric: 'p95', threshold: 100, scenarioName: 's1' }],
    });
    expect(cfg.slaTargets).toEqual([{ metric: 'p95', threshold: 100, scenarioName: 's1' }]);
  });

  it('includes correlation wait and poll config when flags set', () => {
    const waitCfg = { pollIntervalMs: 500, timeoutSec: 30 };
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      hasCorrelationWait: true,
      correlationWaitConfig: waitCfg,
      hasWaitForCondition: true,
      maxConcurrentPolls: 4,
    });
    expect(cfg.correlationWaitConfig).toEqual(waitCfg);
    expect(cfg.maxConcurrentPolls).toBe(4);
  });

  it('includes thinkTime and retry when configured', () => {
    const cfg = buildWorkflowRunnerTestConfig({
      ...baseParams,
      thinkTime: { mode: 'fixed', ms: 250 },
      retryCount: 2,
    });
    expect(cfg.thinkTime).toEqual({ mode: 'fixed', ms: 250 });
    expect(cfg.retryCount).toBe(2);
  });
});
