import { describe, it, expect } from 'vitest';
import {
  createAuthTokenRotationTest,
  createCountryValidationSuiteTest,
  createMultiEndpointRegressionTest,
  createPokemonContractSweepTest,
  createProductSearchMatrixTest,
  createRowTagsDemoTest,
  createUserLookupSweepTest,
} from './parameterizedPresets';

describe('parameterized presets', () => {
  it.each([
    ['userSweep', createUserLookupSweepTest],
    ['productMatrix', createProductSearchMatrixTest],
    ['countrySuite', createCountryValidationSuiteTest],
    ['pokemonSuite', createPokemonContractSweepTest],
    ['multiEndpoint', createMultiEndpointRegressionTest],
    ['rowTags', createRowTagsDemoTest],
    ['authRotation', createAuthTokenRotationTest],
  ] as const)('%s preset returns gallery FeatureGroup with data-source rows', (_name, create) => {
    const fg = create();
    expect(fg.source).toBe('gallery');
    const tests = fg.scenarios.flatMap(s => s.tests);
    expect(tests.length).toBeGreaterThan(0);
    for (const t of tests) {
      expect(t.dataSource).toBeDefined();
      expect((t.dataSource?.rows ?? []).length).toBeGreaterThan(0);
    }
  });

  it('user lookup exposes blank description fallback on column omitting explanation', () => {
    const fg = createUserLookupSweepTest();
    const ds = fg.scenarios.flatMap(sc => sc.tests)[0]?.dataSource;
    const nameCol = ds?.columns.find(c => c.id === 'c-name');
    expect(nameCol?.description).toBe('');
  });

  it('row-tags preset includes explicitly disabled boundary row', () => {
    const fg = createRowTagsDemoTest();
    const ds = fg.scenarios.flatMap(sc => sc.tests)[0]?.dataSource;
    const row8 = ds?.rows.find(r => r.id === 'r8');
    expect(row8?.enabled).toBe(false);
  });

  it('differentiates lookup rows without tags versus matrix rows carrying tags', () => {
    const lookup = createUserLookupSweepTest();
    const matrix = createProductSearchMatrixTest();
    const lookupRows = lookup.scenarios.flatMap(sc => sc.tests)[0]?.dataSource?.rows ?? [];
    expect(lookupRows.length).toBeGreaterThan(3);
    expect(lookupRows.every(r => !r.tags?.length)).toBe(true);
    const matrixRows = matrix.scenarios.flatMap(sc => sc.tests)[0]?.dataSource?.rows ?? [];
    expect(matrixRows.every(r => (r.tags?.length ?? 0) > 0)).toBe(true);
  });

  it('multi-endpoint regression covers users, products, recipes, quotes sweeps', () => {
    const fg = createMultiEndpointRegressionTest();
    expect(fg.scenarios.map(s => s.id)).toEqual([
      'sc-param-multi-users',
      'sc-param-multi-products',
      'sc-param-multi-recipes',
      'sc-param-multi-quotes',
    ]);
    for (const sc of fg.scenarios) {
      const ds = sc.tests[0]?.dataSource;
      expect(ds?.rows.length ?? 0).toBeGreaterThan(0);
    }
  });
});
