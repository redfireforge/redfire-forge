import { vi } from 'vitest';
import type { FeatureGroup } from '@shared/types';

export const mockFeatureGroups: FeatureGroup[] = [
  {
    id: 'fg1',
    name: 'User API',
    scenarios: [
      {
        id: 'sc1',
        name: 'User CRUD',
        kind: 'standard' as const,
        tests: [
          {
            id: 't1',
            name: 'Create User',
            method: 'POST',
            url: 'https://api.example.com/users',
            headers: [],
            body: '',
            validation: { mode: 'none' },
            auth: { type: 'none' },
          },
          {
            id: 't2',
            name: 'Get User',
            method: 'GET',
            url: 'https://api.example.com/users/1',
            headers: [],
            body: '',
            validation: { mode: 'none' },
            auth: { type: 'none' },
          },
        ],
      },
    ],
  },
  {
    id: 'fg2',
    name: 'Order API',
    scenarios: [
      {
        id: 'sc2',
        name: 'Order Flow',
        kind: 'standard' as const,
        tests: [
          {
            id: 't3',
            name: 'Create Order',
            method: 'POST',
            url: 'https://api.example.com/orders',
            headers: [],
            body: '',
            validation: { mode: 'none' },
            auth: { type: 'none' },
          },
        ],
      },
    ],
  },
];

export const defaultProps = {
  featureGroups: mockFeatureGroups,
  selectedScenarios: new Set<string>(),
  onSelectedScenariosChange: vi.fn(),
  weights: {},
  onWeightsChange: vi.fn(),
  skipValidation: false,
  onSkipValidationChange: vi.fn(),
  skipAssertions: false,
  onSkipAssertionsChange: vi.fn(),
  validationOverride: 'default' as const,
  onValidationOverrideChange: vi.fn(),
  forceUnordered: 'default' as const,
  onForceUnorderedChange: vi.fn(),
  autoReport: false,
  onAutoReportChange: vi.fn(),
  autoReportFormat: 'html' as const,
  onAutoReportFormatChange: vi.fn(),
  hostMode: 'hardcoded' as const,
  customBaseUrl: '',
  resolvedBaseUrl: undefined,
  globalAuthProfiles: [],
  envFallbackAuth: undefined,
  disabled: false,
};
