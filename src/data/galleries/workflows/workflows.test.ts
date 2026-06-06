import { describe, it, expect } from 'vitest';
import { sampleWorkflowCatalog, type SampleCategory } from './index';

const VALID_CATEGORIES: SampleCategory[] = ['api-patterns', 'flow-control', 'event-driven', 'orchestration', 'performance'];

describe('galleries/workflows — sampleWorkflowCatalog', () => {
  it('has 41 entries', () => {
    expect(sampleWorkflowCatalog).toHaveLength(41);
  });

  it('every entry has a unique id', () => {
    const ids = sampleWorkflowCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has domain "workflows"', () => {
    for (const entry of sampleWorkflowCatalog) {
      expect(entry.domain).toBe('workflows');
    }
  });

  it('every entry has a valid category', () => {
    for (const entry of sampleWorkflowCatalog) {
      expect(VALID_CATEGORIES).toContain(entry.category);
    }
  });

  it('every entry has at least one tag', () => {
    for (const entry of sampleWorkflowCatalog) {
      expect(entry.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has at least one liveApi', () => {
    for (const entry of sampleWorkflowCatalog) {
      expect(entry.liveApis.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every factory returns a valid Workflow', () => {
    for (const entry of sampleWorkflowCatalog) {
      const wf = entry.factory();
      expect(wf.id).toBeTruthy();
      expect(wf.name).toBeTruthy();
      expect(wf.nodes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('nodeCount matches factory output', () => {
    for (const entry of sampleWorkflowCatalog) {
      const wf = entry.factory();
      expect(wf.nodes.length).toBe(entry.nodeCount);
    }
  });

  it('simulator entries reference valid main entries', () => {
    const ids = new Set(sampleWorkflowCatalog.map(e => e.id));
    const simulators = sampleWorkflowCatalog.filter(e => e.simulatorOf);
    expect(simulators.length).toBeGreaterThan(0);
    for (const sim of simulators) {
      expect(ids).toContain(sim.simulatorOf);
    }
  });
});
