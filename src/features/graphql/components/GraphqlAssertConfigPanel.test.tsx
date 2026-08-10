/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
import type { ReactNode } from 'react';

vi.mock('../../workflow/components/expression/InsertVarField', () => ({
  default: ({ children, onInsert }: { children: ReactNode; onInsert: (snippet: string) => void }) => (
    <div>
      <button type="button" data-testid="mock-insert-var" onClick={() => onInsert('{{runtime.user}}')}>insert</button>
      {children}
    </div>
  ),
}));

vi.mock('../../workflow/components/expression/ExpressionInput', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      data-testid="mock-expression-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../../workflow/components/expression/AvailableVariables', () => ({
  default: () => <div data-testid="mock-available-vars" />,
}));

import GraphqlAssertConfigPanel from './GraphqlAssertConfigPanel';
import type { GraphqlAssertNodeData } from '../../workflow/types/workflow';

function makeData(overrides: Partial<GraphqlAssertNodeData> = {}): GraphqlAssertNodeData {
  return {
    label: 'Assert',
    sourceVariable: 'queryData',
    assertions: [{
      id: 'a1',
      jsonPath: '$.user.id',
      operator: 'equals',
      expectedValue: '1',
    }],
    failBehavior: 'error',
    ...overrides,
  };
}

describe('GraphqlAssertConfigPanel Run test', () => {
  it('updates label field', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData()} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.change(screen.getByDisplayValue('Assert'), { target: { value: 'Assert Updated' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Assert Updated' }));
  });

  it('shows assertion count badge when assertions have no tab errors', () => {
    render(<GraphqlAssertConfigPanel data={makeData()} onChange={vi.fn()} runtimeVariables={{}} />);
    expect(screen.getByRole('button', { name: /Assertions/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows tab validation dots when source/assertions are invalid', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData({ sourceVariable: '  ', assertions: [{ id: 'a1', jsonPath: '', operator: 'equals', expectedValue: '' }] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('gql-wf-tab-error-dot').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no-data message when runtime variables are empty', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData()}
        onChange={vi.fn()}
        runtimeVariables={{}}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-wf-assert-run-test-btn'));
    expect(screen.getByTestId('gql-wf-assert-test-msg')).toHaveTextContent(/run the workflow first/i);
  });

  it('shows guidance message when assertions list is empty', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData({ assertions: [] })}
        onChange={vi.fn()}
        runtimeVariables={{ queryData: '{"user":{"id":1}}' }}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-assert-run-test-btn'));
    expect(screen.getByTestId('gql-wf-assert-test-msg')).toHaveTextContent('Add at least one assertion to test.');
    expect(screen.getByText(/No assertions yet/i)).toBeInTheDocument();
  });

  it('runs assertions against runtime variable snapshot', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData()}
        onChange={vi.fn()}
        runtimeVariables={{ queryData: '{"user":{"id":1}}' }}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-wf-assert-run-test-btn'));
    expect(screen.getByTestId('gql-wf-assert-test-summary')).toHaveTextContent(/passed/i);
    expect(screen.getByTestId('gql-wf-assert-test-result')).toHaveTextContent(/passed/i);
  });

  it('shows failed summary and inline row message when assertion fails', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData({ assertions: [{ id: 'a1', jsonPath: '$.user.id', operator: 'equals', expectedValue: '99' }] })}
        onChange={vi.fn()}
        runtimeVariables={{ queryData: '{"user":{"id":1}}' }}
      />,
    );

    fireEvent.click(screen.getByTestId('gql-wf-assert-run-test-btn'));
    expect(screen.getByTestId('gql-wf-assert-test-summary')).toHaveTextContent(/failed/i);
    expect(screen.getByTestId('gql-wf-assert-test-result')).toHaveTextContent(/✗/i);
  });

  it('adds a new assertion row', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData()} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.click(screen.getByTestId('gql-wf-assert-add-btn'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assertions: expect.arrayContaining([
          expect.objectContaining({ jsonPath: '$', operator: 'equals', expectedValue: '' }),
        ]),
      }),
    );
  });

  it('removes an assertion row', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData()} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.click(screen.getByRole('button', { name: /remove assertion 1/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assertions: [] }));
  });

  it('updates jsonPath, operator, expected value, and description', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData()} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.change(screen.getByTestId('gql-wf-assert-jsonpath'), { target: { value: '$.user.name' } });
    selectOption(screen.getByTestId('gql-wf-assert-operator'), 'contains');
    fireEvent.change(screen.getByTestId('gql-wf-assert-expected'), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByTestId('gql-wf-assert-description'), { target: { value: 'must include name' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assertions: expect.arrayContaining([expect.objectContaining({ jsonPath: '$.user.name' })]),
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assertions: expect.arrayContaining([expect.objectContaining({ operator: 'contains' })]),
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assertions: expect.arrayContaining([expect.objectContaining({ expectedValue: 'Alice' })]),
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        assertions: expect.arrayContaining([expect.objectContaining({ description: 'must include name' })]),
      }),
    );
  });

  it('hides expected value input for no-value operators', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData({ assertions: [{ id: 'a1', jsonPath: '$.user.id', operator: 'exists', expectedValue: 'ignored' }] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('gql-wf-assert-expected')).toBeNull();
  });

  it('shows JSONPath error for blank assertion path', () => {
    render(
      <GraphqlAssertConfigPanel
        data={makeData({ assertions: [{ id: 'a1', jsonPath: '   ', operator: 'equals', expectedValue: '1' }] })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('JSONPath is required')).toBeInTheDocument();
  });

  it('source tab updates source variable via expression input and insert button', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData({ sourceVariable: '' })} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.change(screen.getByTestId('mock-expression-input'), { target: { value: 'queryData' } });
    fireEvent.click(screen.getByTestId('mock-insert-var'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceVariable: 'queryData' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceVariable: '{{runtime.user}}' }));
    expect(screen.getByTestId('mock-available-vars')).toBeInTheDocument();
    expect(screen.getByText('Source variable is required')).toBeInTheDocument();
  });

  it('behavior tab toggles fail behavior to warn', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData({ failBehavior: undefined })} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Behavior' }));
    const errorRadio = screen.getByTestId('gql-wf-assert-fail-error') as HTMLInputElement;
    const warnRadio = screen.getByTestId('gql-wf-assert-fail-warn');

    expect(errorRadio.checked).toBe(true);
    fireEvent.click(warnRadio);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ failBehavior: 'warn' }));
  });

  it('behavior tab toggles fail behavior back to error when warn is selected', () => {
    const onChange = vi.fn();
    render(<GraphqlAssertConfigPanel data={makeData({ failBehavior: 'warn' })} onChange={onChange} runtimeVariables={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Behavior' }));
    fireEvent.click(screen.getByTestId('gql-wf-assert-fail-error'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ failBehavior: 'error' }));
  });
});
