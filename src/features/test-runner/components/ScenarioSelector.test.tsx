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

  it('toggles feature group expand/collapse', () => {
    render(<ScenarioSelector {...defaultProps} />);

    // Initially expanded — scenarios are visible
    expect(screen.getByText('User CRUD')).toBeInTheDocument();

    // Click the collapse toggle for the first feature group
    const toggles = document.querySelectorAll('.expand-toggle');
    fireEvent.click(toggles[0]);

    // After collapsing, the scenario should be hidden
    expect(screen.queryByText('User CRUD')).not.toBeInTheDocument();

    // Click again to re-expand
    fireEvent.click(toggles[0]);
    expect(screen.getByText('User CRUD')).toBeInTheDocument();
  });

  it('selects all scenarios in a feature group', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );

    // Click the feature-group-level checkbox (User API) to select all in that group
    const fgCheckbox = screen.getByRole('checkbox', { name: /User API/i });
    fireEvent.click(fgCheckbox);

    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc1')).toBe(true);
  });

  it('deselects all scenarios in a feature group when all are selected', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        selectedScenarios={new Set(['sc1'])}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );

    // User API group has only sc1 — which is already selected
    const fgCheckbox = screen.getByRole('checkbox', { name: /User API/i });
    fireEvent.click(fgCheckbox);

    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc1')).toBe(false);
  });

  it('deselects a scenario when toggled while already selected', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        selectedScenarios={new Set(['sc1'])}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /User CRUD/i });
    fireEvent.click(checkbox);

    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc1')).toBe(false);
  });

  it('shows validation override select and calls handler on change', () => {
    const onValidationOverrideChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onValidationOverrideChange={onValidationOverrideChange}
      />
    );

    const select = screen.getByDisplayValue('Validation: Default');
    fireEvent.change(select, { target: { value: 'full' } });
    expect(onValidationOverrideChange).toHaveBeenCalledWith('full');
  });

  it('shows force unordered checkbox and calls handler', () => {
    const onForceUnorderedChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onForceUnorderedChange={onForceUnorderedChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Unordered arrays/i });
    fireEvent.click(checkbox);
    expect(onForceUnorderedChange).toHaveBeenCalledWith(true);
  });

  it('disables unordered arrays when skipValidation is true', () => {
    render(
      <ScenarioSelector {...defaultProps} skipValidation={true} />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Unordered arrays/i });
    expect(checkbox).toBeDisabled();
  });

  it('disables unordered arrays when validationOverride is none', () => {
    render(
      <ScenarioSelector {...defaultProps} validationOverride="none" />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Unordered arrays/i });
    expect(checkbox).toBeDisabled();
  });

  it('shows auto-report checkbox and calls handler', () => {
    const onAutoReportChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onAutoReportChange={onAutoReportChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Auto-report/i });
    fireEvent.click(checkbox);
    expect(onAutoReportChange).toHaveBeenCalledWith(true);
  });

  it('shows auto-report format select when autoReport is enabled', () => {
    const onAutoReportFormatChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        autoReport={true}
        onAutoReportFormatChange={onAutoReportFormatChange}
      />
    );

    const select = screen.getByDisplayValue('HTML');
    fireEvent.change(select, { target: { value: 'json' } });
    expect(onAutoReportFormatChange).toHaveBeenCalledWith('json');
  });

  it('hides auto-report format select when autoReport is disabled', () => {
    render(<ScenarioSelector {...defaultProps} autoReport={false} />);
    expect(screen.queryByDisplayValue('HTML')).not.toBeInTheDocument();
  });

  it('shows Select All button and selects all user tests', () => {
    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );

    const selectAllBtn = screen.getByText('Select All');
    fireEvent.click(selectAllBtn);
    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc1')).toBe(true);
    expect(newSelection.has('sc2')).toBe(true);
  });

  it('shows data source row count badge', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1',
      name: 'Data Test',
      scenarios: [{
        id: 'sc1',
        name: 'With Data',
        tests: [{
          id: 't1',
          name: 'Test',
          method: 'GET',
          url: '/api',
          headers: [],
          validation: { mode: 'none' },
          auth: { type: 'none' },
          dataSource: {
            columns: [{ id: 'c1', name: 'col' }],
            rows: [
              { id: 'r1', enabled: true, values: { c1: 'v1' } },
              { id: 'r2', enabled: true, values: { c1: 'v2' } },
              { id: 'r3', enabled: false, values: { c1: 'v3' } },
            ],
          },
        }],
      }],
    }];
    render(<ScenarioSelector {...defaultProps} featureGroups={fgs} />);
    expect(screen.getByText('📊 2 rows')).toBeInTheDocument();
  });

  it('handles gallery and user mutual exclusion', () => {
    const galleryFgs: FeatureGroup[] = [
      {
        id: 'fg-user',
        name: 'My API',
        source: undefined,
        scenarios: [{ id: 'sc-u1', name: 'User Test', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/a', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }],
      },
      {
        id: 'fg-gallery',
        name: 'Gallery Sample',
        source: 'gallery',
        scenarios: [{ id: 'sc-g1', name: 'Gallery Test', tests: [{ id: 't2', name: 'T2', method: 'GET', url: '/b', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }],
      },
    ];

    const onSelectedScenariosChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        featureGroups={galleryFgs}
        selectedScenarios={new Set(['sc-u1'])}
        onSelectedScenariosChange={onSelectedScenariosChange}
      />
    );

    // Select a gallery scenario — should exclude user scenarios
    const galCheckbox = screen.getByRole('checkbox', { name: /Gallery Test/i });
    fireEvent.click(galCheckbox);

    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc-g1')).toBe(true);
    expect(newSelection.has('sc-u1')).toBe(false);
  });

  it('shows gallery section with mutual exclusion hint', () => {
    const galleryFgs: FeatureGroup[] = [
      { id: 'fg-user', name: 'User Tests', scenarios: [{ id: 'sc-u', name: 'U', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
      { id: 'fg-gal', name: 'Gallery', source: 'gallery', scenarios: [{ id: 'sc-g', name: 'G', tests: [{ id: 't2', name: 'T2', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
    ];
    render(<ScenarioSelector {...defaultProps} featureGroups={galleryFgs} />);
    expect(screen.getByText(/Selecting gallery tests will deselect/)).toBeInTheDocument();
  });

  it('select all gallery button works', () => {
    const galleryFgs: FeatureGroup[] = [
      { id: 'fg-user', name: 'User Tests', scenarios: [{ id: 'sc-u', name: 'U', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
      { id: 'fg-gal', name: 'Gallery', source: 'gallery', scenarios: [{ id: 'sc-g', name: 'G', tests: [{ id: 't2', name: 'T2', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
    ];
    const onSelectedScenariosChange = vi.fn();
    render(<ScenarioSelector {...defaultProps} featureGroups={galleryFgs} onSelectedScenariosChange={onSelectedScenariosChange} />);
    const selectAllBtns = screen.getAllByText('Select All');
    // The second Select All is for gallery
    fireEvent.click(selectAllBtns[1]);
    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc-g')).toBe(true);
  });

  it('does not render feature group with no scenarios', () => {
    const fgs: FeatureGroup[] = [
      { id: 'fg-empty', name: 'Empty Group', scenarios: [] },
      { id: 'fg-real', name: 'Real Group', scenarios: [{ id: 'sc1', name: 'Test', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
    ];
    render(<ScenarioSelector {...defaultProps} featureGroups={fgs} />);
    expect(screen.queryByText('Empty Group')).not.toBeInTheDocument();
    expect(screen.getByText('Real Group')).toBeInTheDocument();
  });

  it('does not render scenario with no tests', () => {
    const fgs: FeatureGroup[] = [
      { id: 'fg1', name: 'Group', scenarios: [
        { id: 'sc-empty', name: 'Empty Scenario', tests: [] },
        { id: 'sc-real', name: 'Real Scenario', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
      ]},
    ];
    render(<ScenarioSelector {...defaultProps} featureGroups={fgs} />);
    expect(screen.queryByText('Empty Scenario')).not.toBeInTheDocument();
    expect(screen.getByText('Real Scenario')).toBeInTheDocument();
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

  it('applies validationOverride to dataSource rows', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1',
      name: 'API',
      scenarios: [{
        id: 'sc1',
        name: 'Test',
        tests: [{
          id: 't1',
          name: 'T',
          method: 'GET',
          url: '/api',
          headers: [],
          validation: { mode: 'none' },
          auth: { type: 'none' },
          dataSource: { columns: [], rows: [{ id: 'r1', enabled: true, values: {} }] },
        }],
      }],
    }];

    const result = buildSelectedTests(fgs, new Set(['sc1']), 'hardcoded', '', undefined, false, 'full', false, []);
    expect(result[0].dataSource?.validationMode).toBe('full');
  });

  it('sets validation to none when skipValidation and no dataSource', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'hardcoded',
      '',
      undefined,
      true,
      'default',
      false,
      [],
    );
    expect(result[0].validation).toEqual({ mode: 'none' });
  });

  it('applies forceUnordered to selective validation', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1',
      name: 'API',
      scenarios: [{
        id: 'sc1',
        name: 'Test',
        tests: [{
          id: 't1',
          name: 'T',
          method: 'GET',
          url: '/api',
          headers: [],
          validation: { mode: 'selective', fields: [] },
          auth: { type: 'none' },
        }],
      }],
    }];

    const result = buildSelectedTests(fgs, new Set(['sc1']), 'hardcoded', '', undefined, false, 'default', true, []);
    expect((result[0].validation as { unorderedArrays?: boolean }).unorderedArrays).toBe(true);
  });

  it('does not apply forceUnordered to non-selective validation', () => {
    const result = buildSelectedTests(
      mockFeatureGroups,
      new Set(['sc1']),
      'hardcoded',
      '',
      undefined,
      false,
      'default',
      true,
      [],
    );
    expect((result[0].validation as { unorderedArrays?: boolean }).unorderedArrays).toBeUndefined();
  });

  it('does not replace host for gallery sources', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg-gal',
      name: 'Gallery',
      source: 'gallery',
      scenarios: [{
        id: 'sc-g',
        name: 'G',
        tests: [{ id: 't1', name: 'T', method: 'GET', url: 'https://gallery.api/items', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }],
      }],
    }];

    const result = buildSelectedTests(fgs, new Set(['sc-g']), 'settings', '', 'https://staging.com', false, 'default', false, []);
    expect(result[0].url).toBe('https://gallery.api/items');
  });
});
