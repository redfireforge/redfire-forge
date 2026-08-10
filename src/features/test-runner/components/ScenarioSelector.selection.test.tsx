/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOptionByIndex } from '../../../test-utils/customSelectHelper';
import '@testing-library/jest-dom';
import ScenarioSelector from './ScenarioSelector';
import { defaultProps } from './ScenarioSelector.test.utils';
import type { FeatureGroup } from '../../../shared/types';

describe('ScenarioSelector - Selection', () => {
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
});
