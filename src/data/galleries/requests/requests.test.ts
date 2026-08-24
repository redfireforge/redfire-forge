import { describe, it, expect } from 'vitest';
import { requestSampleCatalog } from './index';
import {
  createGraphQLIntrospectScenario,
  createGraphQLCountryQueryScenario,
  createGraphQLMutationScenario,
} from './presets';

describe('requestSampleCatalog', () => {
  it('has 16 entries', () => {
    expect(requestSampleCatalog).toHaveLength(16);
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

  it('graphql entries use POST and graphql category', () => {
    const gql = requestSampleCatalog.filter(e => e.category === 'graphql');
    expect(gql).toHaveLength(3);
    for (const e of gql) {
      expect(e.method).toBe('POST');
      expect(e.liveApis.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('GraphQL request factories', () => {
  it('introspect: POST with JSON body, existence assertions', () => {
    const s = createGraphQLIntrospectScenario();
    expect(s.method).toBe('POST');
    expect(s.bodyType).toBe('json');
    const body = JSON.parse(s.body);
    expect(body.query).toContain('__typename');
    const assertions = s.validation.mode === 'full' ? s.validation.assertions : [];
    expect(assertions.some(a => a.type === 'existence')).toBe(true);
  });

  it('country query: POST with nested response assertions', () => {
    const s = createGraphQLCountryQueryScenario();
    expect(s.method).toBe('POST');
    const body = JSON.parse(s.body);
    expect(body.query).toContain('country');
    const assertions = s.validation.mode === 'full' ? s.validation.assertions : [];
    expect(assertions.some(a => a.type === 'existence' && a.type === 'existence')).toBe(true);
  });

  it('mutation: POST with mutation keyword in body', () => {
    const s = createGraphQLMutationScenario();
    expect(s.method).toBe('POST');
    const body = JSON.parse(s.body);
    expect(body.query).toContain('mutation');
    const assertions = s.validation.mode === 'full' ? s.validation.assertions : [];
    expect(assertions.some(a => a.type === 'existence')).toBe(true);
  });
});
