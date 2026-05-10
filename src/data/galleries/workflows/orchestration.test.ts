import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSubWorkflowOrchestrator,
  createSubWorkflowChild,
  createOrderPipelineWorkflow,
  createShippingChildWorkflow,
  createDeployOrchestratorWorkflow,
  createRegionDeployChildWorkflow,
  createRollbackChildWorkflow,
  createScriptAdvancedWorkflow,
} from './orchestration';

describe('orchestration gallery factories', () => {
  describe('timestamps', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-05-01T12:00:00.000Z') });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('writes stable createdAt/updatedAt when time is mocked', () => {
      vi.setSystemTime(new Date('2026-05-10T09:30:00.000Z'));
      const wf = createSubWorkflowOrchestrator();
      expect(wf.createdAt).toBe(new Date('2026-05-10T09:30:00.000Z').valueOf());
      expect(wf.updatedAt).toBe(wf.createdAt);
    });

    it('second call observes advanced clock for child workflow factories', () => {
      vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
      const child = createSubWorkflowChild();
      vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
      const child2 = createSubWorkflowChild();
      expect(child2.createdAt).toBeGreaterThanOrEqual(child.createdAt);
    });
  });

  it('createSubWorkflowOrchestrator — structure and condition edges', () => {
    const wf = createSubWorkflowOrchestrator();
    expect(wf.id).toBe('sample-workflow-sub-workflow');
    expect(wf.nodes).toHaveLength(9);
    const cond = wf.nodes.find(n => n.id === 'swf-cond');
    expect(cond?.type).toBe('condition');
    const trueOut = wf.edges.filter(e => e.source === 'swf-cond' && e.sourceHandle === 'true');
    const falseOut = wf.edges.filter(e => e.source === 'swf-cond' && e.sourceHandle === 'false');
    expect(trueOut).toHaveLength(1);
    expect(falseOut).toHaveLength(1);
    const sub = wf.nodes.find(n => n.id === 'swf-sub');
    expect(sub?.type).toBe('subWorkflow');
    expect(sub && 'data' in sub && sub.data && typeof sub.data === 'object' && 'multiInstance' in sub.data).toBe(true);
  });

  it('createSubWorkflowChild — HTTP node and path', () => {
    const wf = createSubWorkflowChild();
    expect(wf.id).toBe('sample-subwf-child');
    const start = wf.nodes.find(n => n.id === 'child-start');
    expect(start && 'data' in start && start.data && 'inputVariables' in start.data).toBe(true);
    if (start && 'data' in start && start.data && 'inputVariables' in start.data) {
      const iv = start.data.inputVariables as Record<string, string>;
      expect(iv.userId).toBe('1');
    }
    const fetch = wf.nodes.find(n => n.id === 'child-fetch');
    expect(fetch?.type).toBe('http');
  });

  it('createOrderPipelineWorkflow — express vs standard branch edges', () => {
    const wf = createOrderPipelineWorkflow();
    expect(wf.id).toBe('sample-workflow-order-pipeline');
    const t = wf.edges.filter(e => e.source === 'op-cond' && e.sourceHandle === 'true');
    const f = wf.edges.filter(e => e.source === 'op-cond' && e.sourceHandle === 'false');
    expect(t[0]?.target).toBe('op-sub-express');
    expect(f[0]?.target).toBe('op-sub-standard');
    const express = wf.nodes.find(n => n.id === 'op-sub-express');
    expect(express && 'data' in express && express.data && 'onChildFailure' in express.data).toBe(true);
    const standard = wf.nodes.find(n => n.id === 'op-sub-standard');
    expect(standard?.type).toBe('subWorkflow');
  });

  it('createShippingChildWorkflow — POST body and headers', () => {
    const wf = createShippingChildWorkflow();
    expect(wf.id).toBe('sample-shipping-child');
    const http = wf.nodes.find(n => n.id === 'ship-http');
    expect(http?.type).toBe('http');
  });

  it('createDeployOrchestratorWorkflow — fork/join, deploy condition, dynamic rollback id', () => {
    const wf = createDeployOrchestratorWorkflow();
    expect(wf.id).toBe('sample-workflow-deploy-orchestrator');
    expect(wf.nodes.some(n => n.type === 'fork')).toBe(true);
    expect(wf.nodes.some(n => n.type === 'join')).toBe(true);
    const rb = wf.nodes.find(n => n.id === 'dep-rollback');
    expect(rb && 'data' in rb && rb.data && 'workflowId' in rb.data).toBe(true);
    if (rb && 'data' in rb && rb.data && 'workflowId' in rb.data) {
      expect(rb.data.workflowId).toBe('{{rollbackWorkflowId}}');
    }
    const ok = wf.edges.filter(e => e.source === 'dep-cond' && e.sourceHandle === 'true');
    const fail = wf.edges.filter(e => e.source === 'dep-cond' && e.sourceHandle === 'false');
    expect(ok[0]?.target).toBe('dep-log-ok');
    expect(fail[0]?.target).toBe('dep-rollback');
  });

  it('createRegionDeployChildWorkflow', () => {
    const wf = createRegionDeployChildWorkflow();
    expect(wf.id).toBe('sample-region-deploy-child');
    expect(wf.edges).toHaveLength(3);
  });

  it('createRollbackChildWorkflow', () => {
    const wf = createRollbackChildWorkflow();
    expect(wf.id).toBe('sample-rollback-child');
    expect(wf.nodes.map(n => n.type)).toContain('logDebug');
  });

  it('createScriptAdvancedWorkflow — loop body/done edges and script code', () => {
    const wf = createScriptAdvancedWorkflow();
    expect(wf.id).toBe('sample-workflow-script-advanced');
    const body = wf.edges.filter(e => e.source === 'sa-loop' && e.sourceHandle === 'body');
    const done = wf.edges.filter(e => e.source === 'sa-loop' && e.sourceHandle === 'done');
    expect(body).toHaveLength(1);
    expect(done).toHaveLength(1);
    const pub = wf.edges.filter(e => e.source === 'sa-check-threshold' && e.sourceHandle === 'true');
    const skip = wf.edges.filter(e => e.source === 'sa-check-threshold' && e.sourceHandle === 'false');
    expect(pub[0]?.target).toBe('sa-publish');
    expect(skip[0]?.target).toBe('sa-skip-log');
    const transform = wf.nodes.find(n => n.id === 'sa-script-transform');
    expect(transform?.type).toBe('script');
    if (transform && 'data' in transform && transform.data && 'code' in transform.data) {
      const code = String(transform.data.code);
      expect(code).toContain('pageWordCount');
      expect(code).toContain('split(/\\s+/)');
    }
    const report = wf.nodes.find(n => n.id === 'sa-script-report');
    if (report && 'data' in report && report.data && 'code' in report.data) {
      expect(String(report.data.code)).toContain('avgWordsPerPost');
    }
  });
});
