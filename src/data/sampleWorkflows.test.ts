import { describe, it, expect } from 'vitest';
import { sampleWorkflowCatalog, type SampleCategory } from './sampleWorkflows';

describe('sampleWorkflowCatalog', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(sampleWorkflowCatalog)).toBe(true);
    expect(sampleWorkflowCatalog.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const entry of sampleWorkflowCatalog) {
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.icon).toBeTruthy();
      expect(typeof entry.nodeCount).toBe('number');
      expect(typeof entry.factory).toBe('function');
    }
  });

  it('has unique ids', () => {
    const ids = sampleWorkflowCatalog.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every category is valid', () => {
    const validCategories: SampleCategory[] = ['api-patterns', 'flow-control', 'event-driven', 'orchestration'];
    for (const entry of sampleWorkflowCatalog) {
      expect(validCategories).toContain(entry.category);
    }
  });

  it('factory() returns a valid workflow with nodes and edges', () => {
    for (const entry of sampleWorkflowCatalog) {
      const wf = entry.factory();
      expect(wf.id).toBeTruthy();
      expect(wf.name).toBeTruthy();
      expect(Array.isArray(wf.nodes)).toBe(true);
      expect(wf.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(wf.edges)).toBe(true);
      expect(typeof wf.createdAt).toBe('number');
      expect(typeof wf.updatedAt).toBe('number');
    }
  });

  it('factory nodeCount matches actual nodes', () => {
    for (const entry of sampleWorkflowCatalog) {
      const wf = entry.factory();
      expect(wf.nodes.length).toBe(entry.nodeCount);
    }
  });

  it('every edge references existing node ids', () => {
    for (const entry of sampleWorkflowCatalog) {
      const wf = entry.factory();
      const nodeIds = new Set(wf.nodes.map((n) => n.id));
      for (const edge of wf.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }
    }
  });

  it('companionFactories produce valid workflows', () => {
    for (const entry of sampleWorkflowCatalog) {
      if (!entry.companionFactories) continue;
      for (const cf of entry.companionFactories) {
        const wf = cf();
        expect(wf.id).toBeTruthy();
        expect(wf.name).toBeTruthy();
        expect(Array.isArray(wf.nodes)).toBe(true);
        expect(wf.nodes.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers all expected categories', () => {
    const categories = new Set(sampleWorkflowCatalog.map((e) => e.category));
    expect(categories.has('api-patterns')).toBe(true);
    expect(categories.has('event-driven')).toBe(true);
    expect(categories.has('flow-control')).toBe(true);
    expect(categories.has('orchestration')).toBe(true);
  });
});
