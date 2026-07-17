/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OperatorValueEditor from './OperatorValueEditor';
import type { Mapping } from './types';
import type { OperatorMeta } from './utils/operatorRegistry';
import { OPERATOR_REGISTRY } from './utils/operatorRegistry';

function makeRef<T>(value: T | null = null) {
  return { current: value };
}

const baseMapping: Mapping = {
  id: 'm1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName',
  operator: 'equals' as never,
  operatorValue: '42',
};

const _equalsMeta = OPERATOR_REGISTRY['equals'];
const isTypeMeta = OPERATOR_REGISTRY['is_type'] as OperatorMeta;
const betweenMeta = OPERATOR_REGISTRY['between'];
const existsMeta = OPERATOR_REGISTRY['exists'];

const gtMeta = OPERATOR_REGISTRY['greater_than'];

const baseProps = {
  mapping: baseMapping,
  currentOp: 'greater_than',
  currentOpMeta: gtMeta,
  isRangeOperator: false,
  editingOperatorValue: false,
  localOperatorValue: '',
  operatorValueRef: makeRef<HTMLInputElement>(),
  rangeSecondRef: makeRef<HTMLInputElement>(),
  typeSelectRef: makeRef<HTMLSelectElement>(),
  setLocalOperatorValue: vi.fn(),
  setEditingOperatorValue: vi.fn(),
  handleTypeSelectChange: vi.fn(),
  handleOperatorValueCommit: vi.fn(),
  handleOperatorValueKeyDown: vi.fn(),
  handleRangeCommit: vi.fn(),
  startEditOperatorValue: vi.fn(),
};

describe('OperatorValueEditor', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('returns null when operator does not need value', () => {
    const { container } = render(
      <OperatorValueEditor {...baseProps} currentOpMeta={existsMeta} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders display mode when not editing', () => {
    render(<OperatorValueEditor {...baseProps} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('clicking display mode triggers startEditOperatorValue', () => {
    const start = vi.fn();
    render(<OperatorValueEditor {...baseProps} startEditOperatorValue={start} />);
    fireEvent.click(screen.getByText('42'));
    expect(start).toHaveBeenCalled();
  });

  it('renders text input when editing regular operator', () => {
    render(
      <OperatorValueEditor
        {...baseProps}
        editingOperatorValue={true}
        localOperatorValue="test"
      />,
    );
    expect(screen.getByLabelText('Operator comparison value')).toBeTruthy();
  });

  it('renders type select when editing is_type operator', () => {
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="is_type"
        currentOpMeta={isTypeMeta}
        editingOperatorValue={true}
        localOperatorValue="string"
      />,
    );
    expect(screen.getByLabelText('Select expected type')).toBeTruthy();
  });

  it('changing type select triggers handleTypeSelectChange', () => {
    const handleChange = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="is_type"
        currentOpMeta={isTypeMeta}
        editingOperatorValue={true}
        handleTypeSelectChange={handleChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Select expected type'), { target: { value: 'number' } });
    expect(handleChange).toHaveBeenCalledWith('number');
  });

  it('renders range inputs when editing between operator', () => {
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
      />,
    );
    expect(screen.getByLabelText('min')).toBeTruthy();
    expect(screen.getByLabelText('max')).toBeTruthy();
  });

  it('Enter on first range input focuses second input', () => {
    const secondRef = makeRef<HTMLInputElement>();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        rangeSecondRef={secondRef}
      />,
    );
    const maxInput = screen.getByLabelText('max');
    secondRef.current = maxInput as HTMLInputElement;
    const focusSpy = vi.spyOn(maxInput, 'focus');
    fireEvent.keyDown(screen.getByLabelText('min'), { key: 'Enter' });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('Escape on first range input cancels editing', () => {
    const setEditing = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        setEditingOperatorValue={setEditing}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('min'), { key: 'Escape' });
    expect(setEditing).toHaveBeenCalledWith(false);
  });

  it('Enter on second range input commits', () => {
    const commitRange = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        handleRangeCommit={commitRange}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('max'), { key: 'Enter' });
    expect(commitRange).toHaveBeenCalled();
  });

  it('Escape on second range input cancels editing', () => {
    const setEditing = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        setEditingOperatorValue={setEditing}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('max'), { key: 'Escape' });
    expect(setEditing).toHaveBeenCalledWith(false);
  });

  it('blur on second range input commits', () => {
    const commitRange = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        handleRangeCommit={commitRange}
      />,
    );
    fireEvent.blur(screen.getByLabelText('max'));
    expect(commitRange).toHaveBeenCalled();
  });

  it('renders close_to range inputs with value/tolerance labels', () => {
    const closeToMeta = OPERATOR_REGISTRY['close_to'];
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="close_to"
        currentOpMeta={closeToMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="100, 5"
      />,
    );
    expect(screen.getByLabelText('value')).toBeTruthy();
    expect(screen.getByLabelText('tolerance')).toBeTruthy();
  });

  it('shows sourcePath when operatorValue is empty in display mode', () => {
    render(
      <OperatorValueEditor
        {...baseProps}
        mapping={{ ...baseMapping, operatorValue: undefined }}
      />,
    );
    expect(screen.getByText('name')).toBeTruthy();
  });

  it('click on type select stops propagation', () => {
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick}>
        <OperatorValueEditor
          {...baseProps}
          currentOp="is_type"
          currentOpMeta={isTypeMeta}
          editingOperatorValue={true}
        />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Select expected type'));
    expect(outerClick).not.toHaveBeenCalled();
  });

  it('click on range inputs stops propagation', () => {
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick}>
        <OperatorValueEditor
          {...baseProps}
          currentOp="between"
          currentOpMeta={betweenMeta}
          isRangeOperator={true}
          editingOperatorValue={true}
          localOperatorValue="10, 20"
        />
      </div>,
    );
    fireEvent.click(document.querySelector('.dm-range-inputs')!);
    expect(outerClick).not.toHaveBeenCalled();
  });

  it('click on regular value input stops propagation', () => {
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick}>
        <OperatorValueEditor
          {...baseProps}
          editingOperatorValue={true}
          localOperatorValue="test"
        />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Operator comparison value'));
    expect(outerClick).not.toHaveBeenCalled();
  });

  it('typing in regular input calls setLocalOperatorValue', () => {
    const setVal = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        editingOperatorValue={true}
        localOperatorValue=""
        setLocalOperatorValue={setVal}
      />,
    );
    fireEvent.change(screen.getByLabelText('Operator comparison value'), { target: { value: 'newVal' } });
    expect(setVal).toHaveBeenCalledWith('newVal');
  });

  it('non-Enter/Escape key on first range input does nothing', () => {
    const commitRange = vi.fn();
    const setEditing = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        handleRangeCommit={commitRange}
        setEditingOperatorValue={setEditing}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('min'), { key: 'Tab' });
    expect(commitRange).not.toHaveBeenCalled();
    expect(setEditing).not.toHaveBeenCalled();
  });

  it('non-Enter/Escape key on second range input does nothing', () => {
    const commitRange = vi.fn();
    const setEditing = vi.fn();
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue="10, 20"
        handleRangeCommit={commitRange}
        setEditingOperatorValue={setEditing}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText('max'), { key: 'Tab' });
    expect(commitRange).not.toHaveBeenCalled();
    expect(setEditing).not.toHaveBeenCalled();
  });

  it('renders range with empty localOperatorValue', () => {
    render(
      <OperatorValueEditor
        {...baseProps}
        currentOp="between"
        currentOpMeta={betweenMeta}
        isRangeOperator={true}
        editingOperatorValue={true}
        localOperatorValue=""
      />,
    );
    expect(screen.getByLabelText('min')).toBeTruthy();
    expect(screen.getByLabelText('max')).toBeTruthy();
  });
});
