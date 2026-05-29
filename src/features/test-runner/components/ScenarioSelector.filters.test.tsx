/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScenarioSelector from './ScenarioSelector';
import { defaultProps } from './ScenarioSelector.test.utils';
import type { FeatureGroup } from '../../../shared/types';

describe('ScenarioSelector - Filters', () => {
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
      render(<ScenarioSelector {...defaultProps} />);
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
