/**
 * Shared test factories for HttpConfig.test.tsx splits.
 *
 * The `vi.mock(...)` declarations and the mock spy vars (e.g.
 * `lastExtractionEditorProps`) remain in each test file because vi.mock must be
 * hoisted to the top of the importing file.
 */
import { vi } from 'vitest';
import type { HttpNodeData } from '../../../types/workflow';
import type { Scenario } from '../../../../../shared/types';

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Scenario',
    url: '/api/users',
    method: 'GET',
    headers: [{ key: '', value: '' }],
    body: '',
    auth: { type: 'none' },
    validation: {},
    ...overrides,
  } as Scenario;
}

export function makeHttpData(overrides: Partial<HttpNodeData> = {}): HttpNodeData {
  return {
    label: 'Get Users',
    scenario: makeScenario(),
    ...overrides,
  } as HttpNodeData;
}

export function makeDefaultProps() {
  return {
    data: makeHttpData(),
    onChange: vi.fn() as ReturnType<typeof vi.fn>,
    activeTab: 'url' as const,
    onTabChange: vi.fn(),
    effectiveQuickTestBaseUrl: 'http://localhost:3000',
    onRequestVariableInsert: vi.fn(),
  };
}
