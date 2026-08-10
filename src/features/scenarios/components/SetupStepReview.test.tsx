/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOptionByIndex } from '../../../test-utils/customSelectHelper';
import SetupStepReview from './SetupStepReview';
import type { SetupStepReviewProps } from './SetupStepReview';

function createDefaultProps(overrides: Partial<SetupStepReviewProps> = {}): SetupStepReviewProps {
  return {
    copyName: 'Test Copy',
    setCopyName: vi.fn(),
    featureGroups: [
      {
        id: 'fg-1',
        name: 'Feature Group 1',
        scenarios: [{ id: 'sc-1', name: 'Scenario 1', tests: [] }],
      },
    ],
    targetFgId: 'fg-1',
    setTargetFgId: vi.fn(),
    targetScenarioId: 'sc-1',
    setTargetScenarioId: vi.fn(),
    targetFg: { id: 'fg-1', name: 'Feature Group 1', scenarios: [{ id: 'sc-1', name: 'Scenario 1', tests: [] }] },
    targetScenario: { id: 'sc-1', name: 'Scenario 1', tests: [] },
    workingAuth: { type: 'none' },
    validationModeLabel: 'Sample Rows Only',
    validateFieldCount: 5,
    reviewPathVariables: [{ variableName: 'userId', sourceValue: '123' }],
    queryParamsForReview: [],
    inputColumnsForReview: [{ type: 'path', mapping: 'id', customName: 'userId', valueSource: 'body' }],
    validateColumnsForReview: [{ type: 'validate', mapping: 'name', customName: 'userName', valueSource: 'body' }],
    buildUrlTemplate: () => 'https://api.example.com/users/{{userId}}',
    arrayPrefixes: [],
    arrayModes: {},
    testName: 'Original Test',
    columnDefs: [
      { type: 'path', mapping: 'id', customName: 'userId', valueSource: 'body' },
      { type: 'validate', mapping: 'name', customName: 'userName', valueSource: 'body' },
    ],
    ...overrides,
  };
}

describe('SetupStepReview', () => {
  it('renders review header', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('Review & Create')).toBeInTheDocument();
  });

  it('displays test name input with value', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    const input = screen.getByPlaceholderText('Name for the parameterized test');
    expect(input).toHaveValue('Test Copy');
  });

  it('calls setCopyName when test name changes', () => {
    const setCopyName = vi.fn();
    render(<SetupStepReview {...createDefaultProps({ setCopyName })} />);
    const input = screen.getByPlaceholderText('Name for the parameterized test');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(setCopyName).toHaveBeenCalledWith('New Name');
  });

  it('displays feature group selector', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('Feature Group 1')).toBeInTheDocument();
  });

  it('displays auth configuration', () => {
    render(<SetupStepReview {...createDefaultProps({ workingAuth: { type: 'bearer', token: 'abc', prefix: 'Bearer' } })} />);
    expect(screen.getByText('Auth')).toBeInTheDocument();
  });

  it('displays validation mode', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getAllByText('Sample Rows Only').length).toBeGreaterThan(0);
  });

  it('displays validate field count', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('5 fields')).toBeInTheDocument();
  });

  it('displays path variables', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('Path Variables')).toBeInTheDocument();
    // userId appears in multiple places - just verify it's there
    const elements = screen.getAllByText('userId');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('displays URL template', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('https://api.example.com/users/{{userId}}')).toBeInTheDocument();
  });

  it('displays file location preview', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText(/Original Test/)).toBeInTheDocument();
    expect(screen.getByText(/Test Copy/)).toBeInTheDocument();
  });

  it('shows stats badges', () => {
    render(<SetupStepReview {...createDefaultProps()} />);
    expect(screen.getByText('1 input')).toBeInTheDocument();
    expect(screen.getByText('1 validate')).toBeInTheDocument();
  });

  it('handles empty feature groups', () => {
    render(<SetupStepReview {...createDefaultProps({ featureGroups: [] })} />);
    expect(screen.queryByText('Feature Group')).not.toBeInTheDocument();
  });

  it('displays array prefixes with modes', () => {
    render(<SetupStepReview {...createDefaultProps({
      arrayPrefixes: ['items'],
      arrayModes: { items: 'unordered' },
    })} />);
    expect(screen.getByText('items')).toBeInTheDocument();
    expect(screen.getByText('Unordered')).toBeInTheDocument();
  });

  it('shows Ordered when array mode defaults', () => {
    render(<SetupStepReview {...createDefaultProps({
      arrayPrefixes: ['x'],
      arrayModes: {},
    })} />);
    expect(screen.getByText('Ordered')).toBeInTheDocument();
  });

  it('shows singular validate field label', () => {
    render(<SetupStepReview {...createDefaultProps({ validateFieldCount: 1 })} />);
    expect(screen.getByText('1 field')).toBeInTheDocument();
  });

  it('shows query variables section and template interpolation', () => {
    render(<SetupStepReview {...createDefaultProps({
      queryParamsForReview: [{ type: 'param', mapping: 'q', customName: '  search  ', valueSource: 'body' }],
      reviewPathVariables: [],
    })} />);
    expect(screen.getByText('Query Variables')).toBeInTheDocument();
    expect(screen.getByText('{{search}}')).toBeInTheDocument();
  });

  it('shows stats with zero vars when no path or query variables', () => {
    render(
      <SetupStepReview
        {...createDefaultProps({
          reviewPathVariables: [],
          queryParamsForReview: [],
        })}
      />,
    );
    expect(screen.getByText('0 vars')).toBeInTheDocument();
  });

  it('shows +N more when many validate columns', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      type: 'validate' as const,
      mapping: `f${i}`,
      customName: `c${i}`,
      valueSource: 'body' as const,
    }));
    render(<SetupStepReview {...createDefaultProps({
      validateColumnsForReview: many,
    })} />);
    expect(screen.getByText('+ 2 more')).toBeInTheDocument();
  });

  it('shows empty input columns state', () => {
    render(<SetupStepReview {...createDefaultProps({
      inputColumnsForReview: [],
      columnDefs: [{ type: 'validate', mapping: 'x', customName: 'y', valueSource: 'body' }],
      workingAuth: { type: 'bearer', token: 't', prefix: 'Bearer' },
    })} />);
    const inputCols = screen.getByText('Input Columns');
    expect(inputCols.parentElement?.textContent).toContain('None');
  });

  it('does not render feature group controls when featureGroups is undefined', () => {
    render(<SetupStepReview {...createDefaultProps({ featureGroups: undefined })} />);
    expect(screen.queryByText('Feature Group')).not.toBeInTheDocument();
  });

  it('resets scenario to CREATE_NEW when new feature group has no parameterized scenarios', () => {
    const setTargetFgId = vi.fn();
    const setTargetScenarioId = vi.fn();
    const fgA = { id: 'fg-a', name: 'A', scenarios: [{ id: 's1', name: 'S1', tests: [] }] };
    const fgB = { id: 'fg-b', name: 'B', scenarios: [] as { id: string; name: string; tests: [] }[] };
    render(
      <SetupStepReview
        {...createDefaultProps({
          featureGroups: [fgA, fgB],
          targetFgId: 'fg-a',
          targetScenarioId: 's1',
          targetFg: fgA,
          targetScenario: fgA.scenarios[0],
          setTargetFgId,
          setTargetScenarioId,
        })}
      />,
    );
    selectOptionByIndex(document.body, 0, 'B');
    expect(setTargetFgId).toHaveBeenCalledWith('fg-b');
    // Component always resets to CREATE_NEW when no parameterized scenario found
    expect(setTargetScenarioId).toHaveBeenCalledWith('__new__');
  });

  it('hides file location tree when targetFg or targetScenario missing', () => {
    render(<SetupStepReview {...createDefaultProps({
      targetFg: undefined,
      targetScenario: undefined,
    })} />);
    expect(screen.queryByText('File Location')).not.toBeInTheDocument();
  });

  it('resets scenario when feature group changes to one with a parameterized scenario', () => {
    const setTargetFgId = vi.fn();
    const setTargetScenarioId = vi.fn();
    const fgA = { id: 'fg-a', name: 'A', scenarios: [{ id: 's1', name: 'S1', tests: [] }] };
    // fgB has a parameterized scenario so firstParam.id branch is taken (line 91)
    const fgB = { id: 'fg-b', name: 'B', scenarios: [{ id: 's2', name: 'S2', tests: [], kind: 'parameterized' as const }] };
    render(
      <SetupStepReview
        {...createDefaultProps({
          featureGroups: [fgA, fgB],
          targetFgId: 'fg-a',
          targetScenarioId: 's1',
          targetFg: fgA,
          targetScenario: fgA.scenarios[0],
          setTargetFgId,
          setTargetScenarioId,
        })}
      />,
    );
    selectOptionByIndex(document.body, 0, 'B');
    expect(setTargetFgId).toHaveBeenCalledWith('fg-b');
    // firstParam.id branch: resets to the first parameterized scenario's id
    expect(setTargetScenarioId).toHaveBeenCalledWith('s2');
  });

  it('updates scenario from scenario select (paramScenarios map callback + onChange)', () => {
    const setTargetScenarioId = vi.fn();
    const fg = {
      id: 'fg-1',
      name: 'FG',
      // Both scenarios have kind: 'parameterized' so they appear in the dropdown
      // This exercises the paramScenarios.map() callback (line 54) and onChange (line 101)
      scenarios: [
        { id: 'sc-1', name: 'Scenario 1', tests: [], kind: 'parameterized' as const },
        { id: 'sc-2', name: 'Scenario 2', tests: [], kind: 'parameterized' as const },
      ],
    };
    render(
      <SetupStepReview
        {...createDefaultProps({
          featureGroups: [fg],
          targetFgId: 'fg-1',
          targetScenarioId: 'sc-1',
          targetFg: fg,
          targetScenario: fg.scenarios[0],
          setTargetScenarioId,
        })}
      />,
    );
    selectOptionByIndex(document.body, 1, 'Scenario 2');
    expect(setTargetScenarioId).toHaveBeenCalledWith('sc-2');
  });

  it('shows new scenario name input when targetScenarioId is __new__ (isCreatingNew branch + onChange)', () => {
    const setNewScenarioName = vi.fn();
    render(
      <SetupStepReview
        {...createDefaultProps({
          targetScenarioId: '__new__',
          newScenarioName: '',
          setNewScenarioName,
        })}
      />,
    );
    // isCreatingNew = true → input renders (line 106)
    const input = screen.getByTestId('param-new-scenario-name-input');
    expect(input).toBeInTheDocument();
    // Fire change to cover line 113: onChange={(e) => setNewScenarioName(e.target.value)}
    fireEvent.change(input, { target: { value: 'My Suite' } });
    expect(setNewScenarioName).toHaveBeenCalledWith('My Suite');
  });
});
