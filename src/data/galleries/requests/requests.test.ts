import { describe, it, expect } from 'vitest';
import { requestSampleCatalog } from './index';

describe('requestSampleCatalog', () => {
  it('has 12 entries', () => {
    expect(requestSampleCatalog).toHaveLength(12);
  });

  it('every entry has a unique id', () => {
    const ids = requestSampleCatalog.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has domain "requests"', () => {
    for (const entry of requestSampleCatalog) {
      expect(entry.domain).toBe('requests');
    }
  });

  it('every entry has at least one liveApi', () => {
    for (const entry of requestSampleCatalog) {
      expect(entry.liveApis.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every entry has at least one tag', () => {
    for (const entry of requestSampleCatalog) {
      expect(entry.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every factory returns a valid Scenario', () => {
    for (const entry of requestSampleCatalog) {
      const scenario = entry.factory();
      expect(scenario.id).toBeTruthy();
      expect(scenario.url).toMatch(/^https:\/\//);
      expect(scenario.method).toBe(entry.method);
      expect(scenario.auth).toBeDefined();
      expect(scenario.validation).toBeDefined();
    }
  });

  it('covers all difficulty levels', () => {
    const diffs = new Set(requestSampleCatalog.map(e => e.difficulty));
    expect(diffs).toContain('easy');
    expect(diffs).toContain('medium');
    expect(diffs).toContain('advanced');
  });

  it('method matches the Scenario method from factory', () => {
    for (const entry of requestSampleCatalog) {
      const scenario = entry.factory();
      expect(entry.method).toBe(scenario.method);
    }
  });
});
