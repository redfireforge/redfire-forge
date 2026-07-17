/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  createUserLookupSweepTest,
  createProductSearchMatrixTest,
  createCountryValidationSuiteTest,
  createPokemonContractSweepTest,
  createMultiEndpointRegressionTest,
  createRowTagsDemoTest,
  createAuthTokenRotationTest,
} from './parameterizedPresets';
import {
  createCatalogExportDemoTest,
  createTrashRecoveryDemo,
  createApiHealthSlaTest,
  createPerformanceRegressionBaselineTest,
} from './presets-advanced';
import {
  createSharedUserIdsFeatureGroup,
  createSharedUserIdsDataSource,
  createSharedProductCatalogFeatureGroup,
  createSharedProductCatalogDataSource,
  createCrossFgPokemonFeatureGroup1,
  createCrossFgPokemonFeatureGroup2,
  createSharedPokemonRosterDataSource,
  createSharedAuthUsersFeatureGroup,
  createSharedAuthUsersDataSource,
} from './sharedDataSourcePresets';
import { testSampleCatalog } from './index';

describe('tests gallery coverage gaps', () => {
  it('executes every catalog factory and returns populated samples', () => {
    const generated = testSampleCatalog.map((entry) => ({
      id: entry.id,
      sample: entry.factory(),
      shared: entry.sharedDataSourceFactory?.() ?? [],
      extra: entry.additionalFeatureGroupsFactory?.() ?? [],
    }));

    expect(generated.length).toBeGreaterThan(10);
    for (const { id, sample, shared, extra } of generated) {
      expect(sample.id.length).toBeGreaterThan(0);
      expect(sample.name.length).toBeGreaterThan(0);
      expect(sample.scenarios.length).toBeGreaterThan(0);
      expect(id.length).toBeGreaterThan(0);
      expect(Array.isArray(shared)).toBe(true);
      expect(Array.isArray(extra)).toBe(true);
    }
  });

  it('builds parameterized presets with inline data sources', () => {
    const groups = [
      createUserLookupSweepTest(),
      createProductSearchMatrixTest(),
      createCountryValidationSuiteTest(),
      createPokemonContractSweepTest(),
      createMultiEndpointRegressionTest(),
      createRowTagsDemoTest(),
      createAuthTokenRotationTest(),
    ];

    for (const group of groups) {
      expect(group.scenarios.length).toBeGreaterThan(0);
      for (const scenario of group.scenarios) {
        expect(scenario.kind).toBe('parameterized');
        expect(scenario.tests.length).toBeGreaterThan(0);
        expect(scenario.tests.some((test) => test.dataSource || test.sharedDataSourceId)).toBe(true);
      }
    }
  });

  it('builds advanced presets with expected scenario structures', () => {
    const advancedGroups = [
      createCatalogExportDemoTest(),
      createTrashRecoveryDemo(),
      createApiHealthSlaTest(),
      createPerformanceRegressionBaselineTest(),
    ];

    expect(advancedGroups[0]?.scenarios).toHaveLength(3);
    expect(advancedGroups[1]?.scenarios).toHaveLength(2);
    expect(advancedGroups[2]?.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(advancedGroups[3]?.scenarios.length).toBeGreaterThanOrEqual(1);

    for (const group of advancedGroups) {
      for (const scenario of group.scenarios) {
        expect(scenario.tests.length).toBeGreaterThan(0);
      }
    }
  });

  it('builds shared data source feature groups and shared data source records', () => {
    const featureGroups = [
      createSharedUserIdsFeatureGroup(),
      createSharedProductCatalogFeatureGroup(),
      createCrossFgPokemonFeatureGroup1(),
      createCrossFgPokemonFeatureGroup2(),
      createSharedAuthUsersFeatureGroup(),
    ];
    const sharedSources = [
      createSharedUserIdsDataSource(),
      createSharedProductCatalogDataSource(),
      createSharedPokemonRosterDataSource(),
      createSharedAuthUsersDataSource(),
    ];

    for (const group of featureGroups) {
      expect(group.scenarios.length).toBeGreaterThan(0);
      expect(group.scenarios.some((scenario) => scenario.tests.some((test) => Boolean(test.sharedDataSourceId)))).toBe(true);
    }

    for (const source of sharedSources) {
      expect(source.id.length).toBeGreaterThan(0);
      expect(source.name.length).toBeGreaterThan(0);
      expect(source.dataSource.columns.length).toBeGreaterThan(0);
      expect(source.dataSource.rows.length).toBeGreaterThan(0);
      expect(source.createdAt).toBeGreaterThan(0);
      expect(source.updatedAt).toBeGreaterThan(0);
    }
  });
});
