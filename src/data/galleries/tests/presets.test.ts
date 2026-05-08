import { describe, it, expect } from 'vitest';
import {
  presetsBareScenarioProbe,
  createAuthFlowTest,
  createCountrySearchTest,
  createEcommerceFullSuiteTest,
  createMultiApiLoadTest,
  createPaginatedRegressionTest,
  createPokemonContractTest,
  createProductListingTest,
  createUserApiSmokeTest,
} from './presets';

describe('presets factories', () => {
  it('presetsBareScenarioProbe covers validation.none when assertions are omitted', () => {
    const sc = presetsBareScenarioProbe();
    expect(sc.validation.mode).toBe('none');
    expect(sc.validation.assertions).toBeUndefined();
  });

  const factories = [
    createUserApiSmokeTest,
    createProductListingTest,
    createPaginatedRegressionTest,
    createPokemonContractTest,
    createCountrySearchTest,
    createAuthFlowTest,
    createEcommerceFullSuiteTest,
    createMultiApiLoadTest,
  ] as const;

  it('each preset returns HTTPS scenarios with validation', () => {
    for (const factory of factories) {
      const fg = factory();
      expect(fg.id).toMatch(/^test-/);
      expect(fg.name.length).toBeGreaterThan(0);
      expect(fg.scenarios.length).toBeGreaterThanOrEqual(1);
      for (const scenario of fg.scenarios) {
        expect(scenario.tests.length).toBeGreaterThanOrEqual(1);
        for (const t of scenario.tests) {
          expect(t.url.startsWith('https://')).toBe(true);
          expect(t.method).toBeTruthy();
          expect(t.headers).toBeDefined();
          expect(t.body).toBeDefined();
          expect(t.auth?.type === 'none').toBe(true);
          expect(['none', 'full']).toContain(t.validation?.mode ?? 'none');
        }
      }
    }
  });

  it('covers responseTime assertions branch in Multi-API load preset', () => {
    const fg = createMultiApiLoadTest();
    const hasResponseTimeAssertion = fg.scenarios.some(sc =>
      sc.tests.some(te => te.validation?.assertions?.some(a => (a as { type?: string }).type === 'responseTime')),
    );
    expect(hasResponseTimeAssertion).toBe(true);
  });
});
