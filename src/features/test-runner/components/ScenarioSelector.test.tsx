/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioSelector, { buildSelectedTests } from './ScenarioSelector';
import type { FeatureGroup } from '../../../shared/types';

const mockFeatureGroups: FeatureGroup[] = [
  {
    id: 'fg1',
    name: 'User API',
    scenarios: [
      {
        id: 'sc1',
        name: 'User CRUD',
        tests: [
          {
            id: 't1',
            name: 'Create User',
            method: 'POST',
            url: 'https://api.example.com/users',
            headers: [],
            validation: { mode: 'none' },
            auth: { type: 'none' },
          },
          {
            id: 't2',
            name: 'Get User',
            method: 'GET',
            url: 'https://api.example.com/users/1',
            headers: [],
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
        tests: [
          {
            id: 't3',
            name: 'Create Order',
            method: 'POST',
            url: 'https://api.example.com/orders',
            headers: [],
            validation: { mode: 'none' },
            auth: { type: 'none' },
          },
        ],
      },
    ],
  },
];

const defaultProps = {
  featureGroups: mockFeatureGroups,
  selectedScenarios: new Set<string>(),
  onSelectedScenariosChange: vi.fn(),
  weights: {},
  onWeightsChange: vi.fn(),
  skipValidation: false,
  onSkipValidationChange: vi.fn(),
  validationOverride: 'default' as const,
  onValidationOverrideChange: vi.fn(),
  forceUnordered: false,
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

describe('ScenarioSelector', () => {
  it('renders feature groups', () => {
    render(<ScenarioSelector {...defaultProps} />);
    
    expect(screen.getByText('User API')).toBeInTheDocument();
    expect(screen.getByText('Order API')).toBeInTheDocument();
  });

  it('renders scenarios within feature groups', () => {
    render(<ScenarioSelector {...defaultProps} />);
    
    expect(screen.getByText('User CRUD')).toBeInTheDocument();
    expect(screen.getByText('Order Flow')).toBeInTheDocument();
  });

  it('shows test count badge', () => {
    render(<ScenarioSelector {...defaultProps} />);
    
    expect(screen.getByText('2 tests')).toBeInTheDocument();
    expect(screen.getByText('1 test')).toBeInTheDocument();
  });

  it('calls onSelectedScenariosChange when scenario is toggled', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );
    
    const checkbox = screen.getByRole('checkbox', { name: /User CRUD/i });
    fireEvent.click(checkbox);
    
    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0];
    expect(newSelection.has('sc1')).toBe(true);
  });

  it('shows selected count in header', () => {
    render(
      <ScenarioSelector
        {...defaultProps}
        selectedScenarios={new Set(['sc1'])}
      />
    );
    
    expect(screen.getByText(/1 scenario.*selected/)).toBeInTheDocument();
    // "2 tests" appears in both header and as count badge, check for the header version
    const filterCount = screen.getByText(/scenario.*selected.*2 test/i);
    expect(filterCount).toBeInTheDocument();
  });

  it('deselect all button clears selection', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        selectedScenarios={new Set(['sc1', 'sc2'])}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );
    
    fireEvent.click(screen.getByText('Deselect All'));
    
    expect(onSelectedScenariosChange).toHaveBeenCalledWith(new Set());
  });

  it('disables controls when disabled prop is true', () => {
    render(<ScenarioSelector {...defaultProps} disabled={true} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeDisabled();
    });
    
    expect(screen.getByText('Deselect All')).toBeDisabled();
  });

  it('shows skip validation checkbox', () => {
    const onSkipValidationChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onSkipValidationChange={onSkipValidationChange}
      />
    );
    
    const skipCheckbox = screen.getByRole('checkbox', { name: /Skip validation/i });
    expect(skipCheckbox).toBeInTheDocument();
    
    fireEvent.click(skipCheckbox);
    expect(onSkipValidationChange).toHaveBeenCalledWith(true);
  });
});

describe('buildSelectedTests', () => {
  it('returns empty array when no scenarios selected', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(),
      'hardcoded',
      '',
      undefined,
      false,
      'default',
      false,
      [],
    );
    expect(result).toEqual([]);
  });

  it('returns tests for selected scenarios', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'hardcoded',
      '',
      undefined,
      false,
      'default',
      false,
      [],
    );
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Create User');
    expect(result[1].name).toBe('Get User');
  });

  it('replaces host when settings mode is used', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'settings',
      '',
      'https://staging.example.com',
      false,
      'default',
      false,
      [],
    );
    
    expect(result[0].url).toBe('https://staging.example.com/users');
    expect(result[1].url).toBe('https://staging.example.com/users/1');
  });

  it('replaces host when custom mode is used', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'custom',
      'https://custom.example.com',
      undefined,
      false,
      'default',
      false,
      [],
    );
    
    expect(result[0].url).toBe('https://custom.example.com/users');
  });

  it('adds feature and group names to tests', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'hardcoded',
      '',
      undefined,
      false,
      'default',
      false,
      [],
    );
    
    expect(result[0].featureGroupName).toBe('User API');
    expect(result[0].groupName).toBe('User CRUD');
  });
});
