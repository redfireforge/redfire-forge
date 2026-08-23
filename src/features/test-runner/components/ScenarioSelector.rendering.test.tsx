/**
 * ScenarioSelector Rendering Tests
 * Split from monolithic ScenarioSelector.test.tsx (979 lines)
 * Tests: Basic rendering, display, and UI tests
 */
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  selectOptionByIndex,
  isCustomSelectDisabled,
} from '@test-utils/customSelectHelper';
import '@testing-library/jest-dom';
import ScenarioSelector from './ScenarioSelector';
import { defaultProps, mockFeatureGroups } from './ScenarioSelector.test.utils';
import type { FeatureGroup } from '@shared/types';

describe('ScenarioSelector - Rendering', () => {
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

  it('ignores stale scenario IDs that are not in current feature groups', () => {
    render(
      <ScenarioSelector
        {...defaultProps}
        selectedScenarios={new Set(['sc1', 'deleted-from-other-env'])}
      />
    );

    expect(screen.getByText(/1 scenario.*selected/)).toBeInTheDocument();
    expect(screen.queryByText(/2 scenarios? selected/)).not.toBeInTheDocument();
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

  it('sets skipValidation when Body: Skip is selected', () => {
    const onSkipValidationChange = vi.fn();
    const onValidationOverrideChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onSkipValidationChange={onSkipValidationChange}
        onValidationOverrideChange={onValidationOverrideChange}
      />
    );

    selectOptionByIndex(document.querySelector('.selection-actions')!, 0, 'None');
    expect(onValidationOverrideChange).toHaveBeenCalledWith('none');
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

    selectOptionByIndex(document.querySelector('.selection-actions')!, 0, 'Full');
    expect(onValidationOverrideChange).toHaveBeenCalledWith('full');
  });

  it('shows unordered arrays dropdown and calls handler', () => {
    const onForceUnorderedChange = vi.fn();
    render(
      <ScenarioSelector
        {...defaultProps}
        onForceUnorderedChange={onForceUnorderedChange}
      />
    );

    selectOptionByIndex(document.querySelector('.selection-actions')!, 1, 'On');
    expect(onForceUnorderedChange).toHaveBeenCalledWith('force-on');
  });

  it('disables unordered arrays dropdown when skipValidation is true', () => {
    render(
      <ScenarioSelector {...defaultProps} skipValidation={true} />
    );

    // Body Validation shows "None" when skipValidation=true, so only one "Default" select remains
    expect(isCustomSelectDisabled(document.querySelectorAll('.selection-actions .cs-wrapper')[1]!)).toBe(true);
  });

  it('disables unordered arrays dropdown when validationOverride is none', () => {
    render(
      <ScenarioSelector {...defaultProps} validationOverride="none" />
    );

    // Body Validation shows "None", so only one "Default" select remains
    expect(isCustomSelectDisabled(document.querySelectorAll('.selection-actions .cs-wrapper')[1]!)).toBe(true);
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

    selectOptionByIndex(document.querySelector('.selection-actions')!, 2, 'JSON');
    expect(onAutoReportFormatChange).toHaveBeenCalledWith('json');
  });

  it('hides auto-report format select when autoReport is disabled', () => {
    render(<ScenarioSelector {...defaultProps} autoReport={false} />);
    const actions = document.querySelector('.selection-actions')!;
    expect(actions.querySelectorAll('.cs-wrapper')).toHaveLength(2);
    expect(Array.from(actions.querySelectorAll('.cs-text')).some((el) => el.textContent === 'HTML')).toBe(false);
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

  it('select all button selects both user and gallery scenarios', () => {
    const galleryFgs: FeatureGroup[] = [
      { id: 'fg-user', name: 'User Tests', scenarios: [{ id: 'sc-u', name: 'U', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
      { id: 'fg-gal', name: 'Gallery', source: 'gallery', scenarios: [{ id: 'sc-g', name: 'G', tests: [{ id: 't2', name: 'T2', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] }] },
    ];
    const onSelectedScenariosChange = vi.fn();
    render(<ScenarioSelector {...defaultProps} featureGroups={galleryFgs} onSelectedScenariosChange={onSelectedScenariosChange} />);
    fireEvent.click(screen.getByText('Select All'));
    expect(onSelectedScenariosChange).toHaveBeenCalled();
    const newSelection = onSelectedScenariosChange.mock.calls[0][0] as Set<string>;
    expect(newSelection.has('sc-u')).toBe(true);
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

  it('renders spec lineage and multi-version chips on scenario rows', () => {
    const fgs: FeatureGroup[] = [{
      id: 'fg1',
      name: 'Lineage',
      scenarios: [{
        id: 'sc-lined',
        name: 'Traced',
        tests: [
          { id: 't1', name: 'A', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' }, sourceSpecVersionLabel: '1.0.0' },
          { id: 't2', name: 'B', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' }, sourceSpecVersionLabel: '2.0.0' },
          { id: 't3', name: 'C', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' }, sourceRequestId: 'rq-9' },
          { id: 't4', name: 'D', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' }, sourceRequestId: 'rq-8' },
        ],
      }],
    }];
    render(<ScenarioSelector {...defaultProps} featureGroups={fgs} />);
    expect(screen.getByTitle(/Spec versions:/)).toHaveTextContent(/v1\.0\.0/);
    expect(screen.getByTitle(/2 tests from Requests/)).toHaveTextContent('2');
  });

  describe('kind filter', () => {
    const mixedFgs: FeatureGroup[] = [
      {
        id: 'fg1',
        name: 'Mixed Group',
        scenarios: [
          { id: 'sc-std', name: 'Standard Scenario', kind: 'standard', tests: [{ id: 't1', name: 'Normal', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
          { id: 'sc-param', name: 'Param Scenario', kind: 'parameterized', tests: [{ id: 't2', name: 'Data', method: 'POST', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' }, dataSource: { columns: [{ id: 'c1', name: 'col' }], rows: [{ id: 'r1', values: { c1: 'v1' }, enabled: true }] } }] },
        ],
      },
    ];

    it('shows all scenarios when kind is undefined', () => {
      render(<ScenarioSelector {...defaultProps} featureGroups={mixedFgs} />);
      expect(screen.getByText('Standard Scenario')).toBeInTheDocument();
      expect(screen.getByText('Param Scenario')).toBeInTheDocument();
    });

    it('shows only standard scenarios when kind is standard', () => {
      render(<ScenarioSelector {...defaultProps} featureGroups={mixedFgs} kind="standard" />);
      expect(screen.getByText('Standard Scenario')).toBeInTheDocument();
      expect(screen.queryByText('Param Scenario')).not.toBeInTheDocument();
    });

    it('shows only parameterized scenarios when kind is parameterized', () => {
      render(<ScenarioSelector {...defaultProps} featureGroups={mixedFgs} kind="parameterized" />);
      expect(screen.queryByText('Standard Scenario')).not.toBeInTheDocument();
      expect(screen.getByText('Param Scenario')).toBeInTheDocument();
    });

    it('hides feature group entirely when all its scenarios are filtered out', () => {
      const fgs: FeatureGroup[] = [
        { id: 'fg1', name: 'Only Standard', scenarios: [
          { id: 'sc1', name: 'Std', kind: 'standard', tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
        ]},
      ];
      render(<ScenarioSelector {...defaultProps} featureGroups={fgs} kind="parameterized" />);
      expect(screen.queryByText('Only Standard')).not.toBeInTheDocument();
    });
  });

  describe('scenario tag filter', () => {
    const taggedFgs: FeatureGroup[] = [
      {
        id: 'fg1',
        name: 'Tagged Group',
        scenarios: [
          { id: 'sc-smoke', name: 'Smoke Tests', tags: ['smoke', 'critical'], tests: [{ id: 't1', name: 'Quick', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
          { id: 'sc-regression', name: 'Regression Tests', tags: ['regression'], tests: [{ id: 't2', name: 'Full', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
          { id: 'sc-untagged', name: 'Untagged Tests', tests: [{ id: 't3', name: 'Plain', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
        ],
      },
    ];

    it('shows tag filter bar when allScenarioTags is provided', () => {
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression', 'critical']}
          scenarioTagCounts={{ smoke: 1, regression: 1, critical: 1 }}
        />
      );
      expect(screen.getByText('Tags:')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('smoke (1)')).toBeInTheDocument();
      expect(screen.getByText('regression (1)')).toBeInTheDocument();
      expect(screen.getByText('critical (1)')).toBeInTheDocument();
    });

    it('hides tag filter bar when no scenario tags exist', () => {
      render(<ScenarioSelector {...defaultProps} featureGroups={mockFeatureGroups} />);
      expect(screen.queryByText('Tags:')).not.toBeInTheDocument();
    });

    it('clicking tag button calls onScenarioTagFilterChange', () => {
      const onScenarioTagFilterChange = vi.fn();
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          onScenarioTagFilterChange={onScenarioTagFilterChange}
        />
      );
      fireEvent.click(screen.getByText('smoke (1)'));
      expect(onScenarioTagFilterChange).toHaveBeenCalledWith(['smoke']);
    });

    it('clicking "All" clears the tag filter', () => {
      const onScenarioTagFilterChange = vi.fn();
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={['smoke']}
          onScenarioTagFilterChange={onScenarioTagFilterChange}
        />
      );
      fireEvent.click(screen.getByText('All'));
      expect(onScenarioTagFilterChange).toHaveBeenCalledWith([]);
    });

    it('filters scenarios by tag when scenarioTagFilter is set', () => {
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={['smoke']}
        />
      );
      expect(screen.getByText('Smoke Tests')).toBeInTheDocument();
      expect(screen.queryByText('Regression Tests')).not.toBeInTheDocument();
      expect(screen.queryByText('Untagged Tests')).not.toBeInTheDocument();
    });

    it('shows all scenarios when tag filter is empty', () => {
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={[]}
        />
      );
      expect(screen.getByText('Smoke Tests')).toBeInTheDocument();
      expect(screen.getByText('Regression Tests')).toBeInTheDocument();
      expect(screen.getByText('Untagged Tests')).toBeInTheDocument();
    });

    it('toggles tag off when clicked while already active', () => {
      const onScenarioTagFilterChange = vi.fn();
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={['smoke']}
          onScenarioTagFilterChange={onScenarioTagFilterChange}
        />
      );
      fireEvent.click(screen.getByText('smoke (1)'));
      expect(onScenarioTagFilterChange).toHaveBeenCalledWith([]);
    });

    it('adds tag when clicked while another is active', () => {
      const onScenarioTagFilterChange = vi.fn();
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={['smoke']}
          onScenarioTagFilterChange={onScenarioTagFilterChange}
        />
      );
      fireEvent.click(screen.getByText('regression (1)'));
      expect(onScenarioTagFilterChange).toHaveBeenCalledWith(['smoke', 'regression']);
    });

    it('shows tag pills on scenario rows', () => {
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression', 'critical']}
          scenarioTagCounts={{ smoke: 1, regression: 1, critical: 1 }}
        />
      );
      // Tag pills should appear on scenario rows
      const smokePills = screen.getAllByTitle('Tag: smoke');
      expect(smokePills.length).toBeGreaterThan(0);
    });

    it('disables tag buttons when disabled prop is true', () => {
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          disabled={true}
        />
      );
      expect(screen.getByText('All')).toBeDisabled();
      expect(screen.getByText('smoke (1)')).toBeDisabled();
    });

    it('kind filter and tag filter compose correctly', () => {
      const mixedTaggedFgs: FeatureGroup[] = [{
        id: 'fg1',
        name: 'Mixed',
        scenarios: [
          { id: 'sc1', name: 'Standard Smoke', kind: 'standard', tags: ['smoke'], tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
          { id: 'sc2', name: 'Standard Regression', kind: 'standard', tags: ['regression'], tests: [{ id: 't2', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
          { id: 'sc3', name: 'Param Smoke', kind: 'parameterized', tags: ['smoke'], tests: [{ id: 't3', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
        ],
      }];
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={mixedTaggedFgs}
          kind="standard"
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 2, regression: 1 }}
          scenarioTagFilter={['smoke']}
        />
      );
      // Only standard scenarios with smoke tag
      expect(screen.getByText('Standard Smoke')).toBeInTheDocument();
      expect(screen.queryByText('Standard Regression')).not.toBeInTheDocument();
      expect(screen.queryByText('Param Smoke')).not.toBeInTheDocument();
    });

    it('buildSelectedTests only includes visible+selected scenarios', () => {
      // When a scenario is selected but hidden by tag filter, it should NOT be in selectedTests
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={taggedFgs}
          selectedScenarios={new Set(['sc-smoke', 'sc-regression'])} // Both selected
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 1, regression: 1 }}
          scenarioTagFilter={['smoke']} // Only smoke visible
        />
      );
      // The header shows "2 scenarios selected" (all selected)
      // But "(1 test)" because only the smoke scenario's test is visible
      expect(screen.getByText(/2 scenarios? selected/)).toBeInTheDocument();
      expect(screen.getByText(/\(1 test\)/)).toBeInTheDocument();
    });

    it('hides feature group when all its scenarios are filtered out by tag', () => {
      const fgsWithSingleTag: FeatureGroup[] = [{
        id: 'fg1',
        name: 'Only Regression',
        scenarios: [
          { id: 'sc1', name: 'Reg Test', tags: ['regression'], tests: [{ id: 't1', name: 'T', method: 'GET', url: '/', headers: [], validation: { mode: 'none' }, auth: { type: 'none' } }] },
        ],
      }];
      render(
        <ScenarioSelector
          {...defaultProps}
          featureGroups={fgsWithSingleTag}
          allScenarioTags={['smoke', 'regression']}
          scenarioTagCounts={{ smoke: 0, regression: 1 }}
          scenarioTagFilter={['smoke']} // Filter for smoke, but group only has regression
        />
      );
      expect(screen.queryByText('Only Regression')).not.toBeInTheDocument();
    });
  });
});
