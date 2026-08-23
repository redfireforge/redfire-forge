import { describe, it, expect } from 'vitest';
import { STANDARD_VARIANT, PARAMETERIZED_VARIANT } from './runnerVariants';
import type { FeatureGroup } from '@shared/types';

const makeFg = (overrides: Partial<FeatureGroup> = {}): FeatureGroup => ({
  id: 'fg1',
  name: 'FG',
  scenarios: [],
  ...overrides,
});

describe('STANDARD_VARIANT', () => {
  it('has correct metadata', () => {
    expect(STANDARD_VARIANT.kind).toBe('standard');
    expect(STANDARD_VARIANT.title).toBe('Test Runner');
    expect(STANDARD_VARIANT.namePrefix).toBe('test-runner');
  });

  it('hasContent returns true when any scenario has tests', () => {
    const fgs = [makeFg({
      scenarios: [{
        id: 's1', name: 'S1', kind: 'standard',
        url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' },
        tests: [{ id: 't1', name: 'T1', kind: 'standard', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, expectedFields: [] }],
        expectedFields: [],
      }],
    })];
    expect(STANDARD_VARIANT.hasContent(fgs as unknown as FeatureGroup[])).toBe(true);
  });

  it('hasContent returns false when no tests', () => {
    const fgs = [makeFg({
      scenarios: [{
        id: 's1', name: 'S1', kind: 'standard',
        url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' },
        tests: [],
        expectedFields: [],
      }],
    })];
    expect(STANDARD_VARIANT.hasContent(fgs as unknown as FeatureGroup[])).toBe(false);
  });
});

describe('PARAMETERIZED_VARIANT', () => {
  it('has correct metadata', () => {
    expect(PARAMETERIZED_VARIANT.kind).toBe('parameterized');
    expect(PARAMETERIZED_VARIANT.title).toBe('Parameterized Runner');
    expect(PARAMETERIZED_VARIANT.namePrefix).toBe('param-runner');
  });

  it('hasContent returns true for parameterized scenarios with tests', () => {
    const fgs = [makeFg({
      scenarios: [{
        id: 's1', name: 'S1', kind: 'parameterized',
        url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' },
        tests: [{ id: 't1', name: 'T1', kind: 'parameterized', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, expectedFields: [] }],
        expectedFields: [],
      }],
    })];
    expect(PARAMETERIZED_VARIANT.hasContent(fgs as unknown as FeatureGroup[])).toBe(true);
  });

  it('hasContent returns false for standard scenarios', () => {
    const fgs = [makeFg({
      scenarios: [{
        id: 's1', name: 'S1', kind: 'standard',
        url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' },
        tests: [{ id: 't1', name: 'T1', kind: 'standard', url: '', method: 'GET', headers: [], body: '', auth: { type: 'none' }, expectedFields: [] }],
        expectedFields: [],
      }],
    })];
    expect(PARAMETERIZED_VARIANT.hasContent(fgs as unknown as FeatureGroup[])).toBe(false);
  });
});
