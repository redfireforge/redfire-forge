import { describe, expect, it } from 'vitest';
import { API_MOCK_RUNTIME } from './apiMockRuntimeSelectors';

describe('apiMockRuntimeSelectors dynamic builders', () => {
  it('builds all dynamic selectors', () => {
    expect(API_MOCK_RUNTIME.dockTab('transactions')).toBe('[data-testid="api-mock-dock-tab-transactions"]');
    expect(API_MOCK_RUNTIME.consoleFilter('errors')).toBe('[data-testid="api-mock-console-filter-errors"]');
    expect(API_MOCK_RUNTIME.redactHeaderChip('authorization')).toBe('[data-testid="api-mock-redact-header-chip-authorization"]');
    expect(API_MOCK_RUNTIME.tx('tx-7')).toBe('[data-testid="api-mock-tx-tx-7"]');

    expect(API_MOCK_RUNTIME.conflictFilter('shadowed')).toBe('[data-testid="api-mock-conflict-filter-shadowed"]');
    expect(API_MOCK_RUNTIME.finding('f-1')).toBe('[data-testid="api-mock-finding-f-1"]');
    expect(API_MOCK_RUNTIME.findingByKind('duplicate')).toBe('[data-testid="api-mock-conflict-list"] button[data-kind="duplicate"]');

    expect(API_MOCK_RUNTIME.toolboxXPathPreset('Root element')).toBe('[data-testid="api-mock-toolbox-xpath-preset-Root element"]');
    expect(API_MOCK_RUNTIME.toolboxSchemaPreset('JSON object')).toBe('[data-testid="api-mock-toolbox-schema-preset-JSON object"]');
    expect(API_MOCK_RUNTIME.toolboxTab('regex')).toBe('[data-testid="api-mock-toolbox-tab-regex"]');
    expect(API_MOCK_RUNTIME.toolboxSegment(2)).toBe('[data-testid="api-mock-toolbox-segment-2"]');
    expect(API_MOCK_RUNTIME.toolboxPreset('Email')).toBe('[data-testid="api-mock-toolbox-preset-Email"]');
    expect(API_MOCK_RUNTIME.toolboxLib('UUID')).toBe('[data-testid="api-mock-toolbox-lib-UUID"]');

    expect(API_MOCK_RUNTIME.toolboxSampleRow('p0')).toBe('[data-testid="api-mock-toolbox-sample-row-p0"]');
    expect(API_MOCK_RUNTIME.toolboxSampleValue('p0')).toBe('[data-testid="api-mock-toolbox-sample-value-p0"]');
    expect(API_MOCK_RUNTIME.toolboxSampleExpect('p0')).toBe('[data-testid="api-mock-toolbox-sample-expect-p0"]');
    expect(API_MOCK_RUNTIME.toolboxSampleActual('p0')).toBe('[data-testid="api-mock-toolbox-sample-actual-p0"]');
    expect(API_MOCK_RUNTIME.toolboxSampleCheck('p0')).toBe('[data-testid="api-mock-toolbox-sample-check-p0"]');

    expect(API_MOCK_RUNTIME.toolboxConstraint('c1')).toBe('[data-testid="api-mock-toolbox-constraint-c1"]');
    expect(API_MOCK_RUNTIME.toolboxConstraintSource('c1')).toBe('[data-testid="api-mock-toolbox-constraint-source-c1"]');
    expect(API_MOCK_RUNTIME.toolboxConstraintName('c1')).toBe('[data-testid="api-mock-toolbox-constraint-name-c1"]');
    expect(API_MOCK_RUNTIME.toolboxConstraintOperator('c1')).toBe('[data-testid="api-mock-toolbox-constraint-operator-c1"]');
    expect(API_MOCK_RUNTIME.toolboxConstraintValue('c1')).toBe('[data-testid="api-mock-toolbox-constraint-value-c1"]');

    expect(API_MOCK_RUNTIME.importSource('curl')).toBe('[data-testid="api-mock-import-source-curl"]');

    expect(API_MOCK_RUNTIME.headersExpandName('h1')).toBe('[data-testid="api-mock-headers-expand-name-h1"]');
    expect(API_MOCK_RUNTIME.headersExpandValue('h1')).toBe('[data-testid="api-mock-headers-expand-value-h1"]');
    expect(API_MOCK_RUNTIME.headersExpandRemove('h1')).toBe('[data-testid="api-mock-headers-expand-remove-h1"]');

    expect(API_MOCK_RUNTIME.simSample('saved-1')).toBe('[data-testid="api-mock-sim-sample-saved-1"]');
    expect(API_MOCK_RUNTIME.simSampleBtn('saved-1')).toBe('[data-testid="api-mock-sim-sample-saved-1"] .am-sim-sample-btn');
    expect(API_MOCK_RUNTIME.simTab('trace')).toBe('[data-testid="api-mock-sim-tab-trace"]');
    expect(API_MOCK_RUNTIME.simSpecificityRow('route-a')).toBe('[data-testid="api-mock-sim-specificity-route-a"]');
    expect(API_MOCK_RUNTIME.simCandidate('route-a')).toBe('[data-testid="api-mock-sim-candidate-route-a"]');
    expect(API_MOCK_RUNTIME.simPredicateRows('route-a')).toBe('[data-testid="api-mock-sim-candidate-route-a"] .am-predicate');

    expect(API_MOCK_RUNTIME.settingsTab('tls')).toBe('[data-testid="api-mock-settings-tab-tls"]');
  });
});
