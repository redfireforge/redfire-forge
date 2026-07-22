/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { selectOption, selectOptionByIndex, getCustomSelectValue } from '../../../../test-utils/customSelectHelper';
import LoopConfig from './LoopConfig';
import { LoopNodeData } from '../../types/workflow';

vi.mock('../../../scenarios/components/DataSourceEditor', () => ({
  __esModule: true,
  default: ({ onDraftChange }: { onDraftChange: (s: { dataSource?: unknown }) => void }) => (
    <div data-testid="loop-ds-editor">
      <button
        type="button"
        onClick={() =>
          onDraftChange({
            dataSource: {
              id: 'ds',
              columns: [],
              rows: [{ id: 'r1', values: {}, enabled: true }],
              source: { type: 'inline' },
            },
          })
        }
      >
        Mock add row
      </button>
    </div>
  ),
}));

function makeData(overrides: Partial<LoopNodeData> = {}): LoopNodeData {
  return {
    label: 'Test Loop',
    mode: 'count',
    count: 5,
    maxIterations: 100,
    ...overrides,
  } as LoopNodeData;
}

describe('LoopConfig', () => {
  it('renders label input', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('Test Loop')).toBeTruthy();
  });

  it('renders mode selector with count selected', () => {
    const onChange = vi.fn();
    const { container } = render(<LoopConfig data={makeData()} onChange={onChange} />);
    expect(getCustomSelectValue(container)).toBe('Repeat N times');
  });

  it('renders iterations input in count mode', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('updates label', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Test Loop'), { target: { value: 'My Loop' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Loop' }));
  });

  it('updates mode', () => {
    const onChange = vi.fn();
    const { container } = render(<LoopConfig data={makeData()} onChange={onChange} />);
    selectOption(container, 'For Each');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'forEach' }));
  });

  it('renders forEach fields when mode is forEach', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('{{items}}')).toBeTruthy();
    expect(screen.getByDisplayValue('item')).toBeTruthy();
  });

  it('renders while fields when mode is while', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('{{status}}')).toBeTruthy();
    expect(screen.getByDisplayValue('200')).toBeTruthy();
  });

  it('updates max iterations', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    const maxInput = screen.getByDisplayValue('100');
    fireEvent.change(maxInput, { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxIterations: 50 }));
  });

  it('updates count', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
  });

  it('updates count expression', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData()} onChange={onChange} />);
    const exprInput = screen.getByPlaceholderText('e.g. {{retryCount}} (overrides fixed count)');
    fireEvent.change(exprInput, { target: { value: '{{n}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ countExpression: '{{n}}' }));
  });

  it('updates index variable in count mode', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData({ indexVariable: 'i' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('i'), { target: { value: 'idx' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indexVariable: 'idx' }));
  });

  it('updates source expression in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{items}}'), { target: { value: '{{data}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceExpression: '{{data}}' }));
  });

  it('updates item variable in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('item'), { target: { value: 'row' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ itemVariable: 'row' }));
  });

  it('updates index variable in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('i'), { target: { value: 'idx' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ indexVariable: 'idx' }));
  });

  it('updates whileLeft operand', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{{status}}'), { target: { value: '{{code}}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileLeft: '{{code}}' }));
  });

  it('updates while operator', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    const { container } = render(<LoopConfig data={data} onChange={onChange} />);
    selectOptionByIndex(container, 1, '!=');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileOperator: '!=' }));
  });

  it('updates whileRight operand', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: '{{status}}', whileOperator: '==', whileRight: '200' });
    render(<LoopConfig data={data} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('200'), { target: { value: '404' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileRight: '404' }));
  });

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    render(<LoopConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    render(<LoopConfig data={makeData()} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert when Insert button is clicked', () => {
    const onRequest = vi.fn();
    render(<LoopConfig data={makeData()} onChange={vi.fn()} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalled();
  });

  it('renders Available Variables section when variableHints are provided', () => {
    const hints = [{ ref: 'status', label: 'status (latest)' }];
    render(<LoopConfig data={makeData()} onChange={vi.fn()} variableHints={hints} />);
    expect(screen.getByText(/Available variables/)).toBeTruthy();
  });

  it('defaults count to 1 when input is empty (NaN)', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData({ count: 5 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  it('defaults maxIterations to 100 when input is empty (NaN)', () => {
    const onChange = vi.fn();
    render(<LoopConfig data={makeData({ maxIterations: 50 })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxIterations: 100 }));
  });

  it('renders default values for count mode when count/indexVariable are undefined', () => {
    const onChange = vi.fn();
    const data = makeData({ count: undefined, indexVariable: undefined, countExpression: undefined });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('1')).toBeTruthy(); // default count
    expect(screen.getByDisplayValue('i')).toBeTruthy(); // default indexVariable
  });

  it('renders default values for forEach mode when item/index vars are undefined', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{x}}', itemVariable: undefined, indexVariable: undefined });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('item')).toBeTruthy();
    expect(screen.getByDisplayValue('i')).toBeTruthy();
  });

  it('renders default values for while mode when whileLeft/Right/Operator are undefined', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'while', whileLeft: undefined, whileOperator: undefined, whileRight: undefined });
    const { container } = render(<LoopConfig data={data} onChange={onChange} />);
    expect(getCustomSelectValue(container, 1)).toBe('==');
  });

  it('calls onRequestVariableInsert with apply callback for forEach source', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} onRequestVariableInsert={onRequest} />);
    const insertButtons = screen.getAllByText('Insert…');
    fireEvent.click(insertButtons[0]);
    expect(onRequest).toHaveBeenCalled();
    // Execute the callback to trigger the insert
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{newVar}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sourceExpression: '{{items}}{{newVar}}' }));
  });

  it('mode hint text shows correct description for forEach', () => {
    render(<LoopConfig data={makeData({ mode: 'forEach', sourceExpression: '', itemVariable: 'item', indexVariable: 'i' })} onChange={vi.fn()} />);
    expect(screen.getByText('Iterate over a JSON array')).toBeTruthy();
  });

  it('mode hint text shows correct description for while', () => {
    render(<LoopConfig data={makeData({ mode: 'while', whileLeft: '', whileOperator: '==', whileRight: '' })} onChange={vi.fn()} />);
    expect(screen.getByText('Repeat while a condition is true')).toBeTruthy();
  });

  it('handles undefined countExpression in count mode Insert', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    render(<LoopConfig data={makeData({ mode: 'count', countExpression: undefined })} onChange={onChange} onRequestVariableInsert={onRequest} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{n}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ countExpression: '{{n}}' }));
  });

  it('handles undefined whileLeft in while mode Insert', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    render(<LoopConfig data={makeData({ mode: 'while', whileLeft: undefined, whileOperator: '==', whileRight: 'x' })} onChange={onChange} onRequestVariableInsert={onRequest} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[0]);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{status}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileLeft: '{{status}}' }));
  });

  it('handles undefined whileRight in while mode Insert', () => {
    const onChange = vi.fn();
    const onRequest = vi.fn();
    render(<LoopConfig data={makeData({ mode: 'while', whileLeft: 'x', whileOperator: '==', whileRight: undefined })} onChange={onChange} onRequestVariableInsert={onRequest} />);
    const insertBtns = screen.getAllByText('Insert…');
    fireEvent.click(insertBtns[insertBtns.length - 1]);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{val}}');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ whileRight: '{{val}}' }));
  });

  it('toggles data source section in forEach mode', () => {
    const onChange = vi.fn();
    const data = makeData({ mode: 'forEach', sourceExpression: '{{x}}', itemVariable: 'item', indexVariable: 'i' });
    render(<LoopConfig data={data} onChange={onChange} />);
    expect(screen.queryByTestId('loop-ds-editor')).toBeNull();
    fireEvent.click(screen.getByText(/Data Source/));
    expect(screen.getByTestId('loop-ds-editor')).toBeTruthy();
    fireEvent.click(screen.getByText('Mock add row'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSource: expect.objectContaining({
          rows: [expect.objectContaining({ enabled: true })],
        }),
      }),
    );
  });

  it('shows data source override hint and disables source expression when loop has dataSource', () => {
    const ds = {
      id: 'd1',
      columns: [],
      rows: [{ id: 'r1', values: {}, enabled: true }],
      source: { type: 'inline' as const },
    };
    render(
      <LoopConfig
        data={makeData({ mode: 'forEach', sourceExpression: '{{items}}', itemVariable: 'item', indexVariable: 'i', dataSource: ds })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Using data source/)).toBeTruthy();
    expect((screen.getByDisplayValue('{{items}}') as HTMLInputElement).disabled).toBe(true);
  });
});
