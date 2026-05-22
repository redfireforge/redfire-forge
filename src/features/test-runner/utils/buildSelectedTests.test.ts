import { describe, it, expect } from 'vitest';
import { buildSelectedTests } from './buildSelectedTests';
import { makeScenario } from '../../../test-utils/factories';
import type { FeatureGroup, Assertion, DataSource } from '../../../shared/types';

function makeFg(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'FG',
    scenarios: [{
      id: 'sc-1',
      name: 'Scenario 1',
      kind: 'standard',
      tests: [makeScenario()],
    }],
    ...overrides,
  };
}

const selectAll = (fg: FeatureGroup) => new Set(fg.scenarios.map(s => s.id));

describe('buildSelectedTests', () => {
  it('returns tests with featureGroupName and groupName', () => {
    const fg = makeFg();
    const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'default', []);
    expect(result).toHaveLength(1);
    expect(result[0].featureGroupName).toBe('FG');
    expect(result[0].groupName).toBe('Scenario 1');
  });

  it('skips unselected scenarios', () => {
    const fg = makeFg();
    const result = buildSelectedTests([fg], new Set(['non-existent']), 'hardcoded', '', undefined, false, false, 'default', 'default', []);
    expect(result).toHaveLength(0);
  });

  describe('skipValidation', () => {
    it('forces mode to none when skipValidation is true', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective', expectedFields: [{ path: '$.id', value: '1' }] } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, true, false, 'default', 'default', []);
      expect(result[0].validation.mode).toBe('none');
    });

    it('preserves assertions when skipValidation forces mode to none', () => {
      const assertions: Assertion[] = [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 5000 },
      ];
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective', assertions, expectedFields: [{ path: '$.id', value: '1' }] } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, true, false, 'default', 'default', []);
      expect(result[0].validation.mode).toBe('none');
      expect(result[0].validation.assertions).toEqual(assertions);
      expect(result[0].validation.expectedFields).toEqual([{ path: '$.id', value: '1' }]);
    });

    it('overrides validationOverride when skipValidation is true', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'full', expectedJson: '{}' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, true, false, 'full', 'default', []);
      expect(result[0].validation.mode).toBe('none');
    });
  });

  describe('validationOverride', () => {
    it('applies none override to non-data-source tests', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'none', 'default', []);
      expect(result[0].validation.mode).toBe('none');
    });

    it('keeps default when validationOverride is default', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'default', []);
      expect(result[0].validation.mode).toBe('selective');
    });

    it('applies override to data-source tests', () => {
      const ds: DataSource = { type: 'csv', rows: [], columns: [], validationMode: 'full' };
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ dataSource: ds, validation: { mode: 'selective' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'none', 'default', []);
      expect(result[0].dataSource?.validationMode).toBe('none');
    });
  });

  describe('forceUnordered', () => {
    it('force-on sets unorderedArrays on selective validation', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'force-on', []);
      expect(result[0].validation.unorderedArrays).toBe(true);
    });

    it('force-off clears unorderedArrays on selective validation', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective', unorderedArrays: true } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'force-off', []);
      expect(result[0].validation.unorderedArrays).toBe(false);
    });

    it('default preserves scenario unorderedArrays setting', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'selective', unorderedArrays: true } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'default', []);
      expect(result[0].validation.unorderedArrays).toBe(true);
    });

    it('does not set unorderedArrays on non-selective modes', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ validation: { mode: 'full' } })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'hardcoded', '', undefined, false, false, 'default', 'force-on', []);
      expect(result[0].validation.unorderedArrays).toBeUndefined();
    });
  });

  describe('host resolution', () => {
    it('prepends settings base URL to relative paths', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ url: '/api/test' })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'settings', '', 'https://new.com', false, false, 'default', 'default', []);
      expect(result[0].url).toBe('https://new.com/api/test');
    });

    it('prepends custom base URL to relative paths', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ url: '/api/test' })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'custom', 'https://custom.com', undefined, false, false, 'default', 'default', []);
      expect(result[0].url).toBe('https://custom.com/api/test');
    });

    it('preserves absolute URLs (does not replace host)', () => {
      const fg = makeFg({
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ url: 'https://httpbin.org/status/204' })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'settings', '', 'https://jsonplaceholder.typicode.com', false, false, 'default', 'default', []);
      expect(result[0].url).toBe('https://httpbin.org/status/204');
    });

    it('does not replace host for gallery feature groups', () => {
      const fg = makeFg({
        source: 'gallery',
        scenarios: [{
          id: 'sc-1', name: 'S', kind: 'standard',
          tests: [makeScenario({ url: 'https://gallery.com/api' })],
        }],
      });
      const result = buildSelectedTests([fg], selectAll(fg), 'settings', '', 'https://override.com', false, false, 'default', 'default', []);
      expect(result[0].url).toBe('https://gallery.com/api');
    });
  });
});
