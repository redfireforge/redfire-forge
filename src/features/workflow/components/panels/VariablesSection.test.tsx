/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VariablesSection from './VariablesSection';
import { WorkflowInspectProvider } from './WorkflowInspectContext';

const inspectActions = {
  openStepDetail: vi.fn(),
  openVariableDetail: vi.fn(),
  openNodeConfig: vi.fn(),
  navigateToWorkflow: vi.fn(),
};

function renderVars(overrides: Partial<React.ComponentProps<typeof VariablesSection>> = {}) {
  const defaults: React.ComponentProps<typeof VariablesSection> = {
    title: 'Variables',
    hint: 'Define key/value pairs.',
    variables: {},
    onUpdateVariables: vi.fn(),
    newVarKey: '',
    setNewVarKey: vi.fn(),
    newVarValue: '',
    setNewVarValue: vi.fn(),
    ...overrides,
  };

  return render(
    <WorkflowInspectProvider value={inspectActions}>
      <VariablesSection {...defaults} />
    </WorkflowInspectProvider>,
  );
}

describe('VariablesSection', () => {
  it('renders title and hint', () => {
    renderVars({ title: 'My Vars', hint: 'Some hint.' });
    expect(screen.getByText('My Vars')).toBeTruthy();
    expect(screen.getByText(/Some hint/)).toBeTruthy();
  });

  it('renders existing variables', () => {
    renderVars({ variables: { host: 'localhost', port: '3000' } });
    expect(screen.getByDisplayValue('host')).toBeTruthy();
    expect(screen.getByDisplayValue('localhost')).toBeTruthy();
    expect(screen.getByDisplayValue('port')).toBeTruthy();
    expect(screen.getByDisplayValue('3000')).toBeTruthy();
  });

  it('calls onUpdateVariables when value changes', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { foo: 'bar' }, onUpdateVariables });
    fireEvent.change(screen.getByDisplayValue('bar'), { target: { value: 'baz' } });
    expect(onUpdateVariables).toHaveBeenCalledWith({ foo: 'baz' });
  });

  it('deletes a variable on × click', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { a: '1', b: '2' }, onUpdateVariables });
    const deleteButtons = screen.getAllByText('×');
    fireEvent.click(deleteButtons[0]);
    expect(onUpdateVariables).toHaveBeenCalledWith({ b: '2' });
  });

  it('adds a new variable via the + button', () => {
    const onUpdateVariables = vi.fn();
    const setNewVarKey = vi.fn();
    const setNewVarValue = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'myKey',
      setNewVarKey,
      newVarValue: 'myVal',
      setNewVarValue,
    });
    fireEvent.click(screen.getByText('+'));
    expect(onUpdateVariables).toHaveBeenCalledWith({ myKey: 'myVal' });
    expect(setNewVarKey).toHaveBeenCalledWith('');
    expect(setNewVarValue).toHaveBeenCalledWith('');
  });

  it('strips braces from key on add', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: '{{wrapped}}',
      newVarValue: 'v',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    fireEvent.click(screen.getByText('+'));
    expect(onUpdateVariables).toHaveBeenCalledWith({ wrapped: 'v' });
  });

  it('does not add when key is empty', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: '',
      newVarValue: 'v',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    fireEvent.click(screen.getByText('+'));
    expect(onUpdateVariables).not.toHaveBeenCalled();
  });

  it('renders Insert… button when onRequestVariableInsert is provided', () => {
    renderVars({
      variables: { x: '1' },
      onRequestVariableInsert: vi.fn(),
    });
    const insertButtons = screen.getAllByText('Insert…');
    expect(insertButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render Insert… buttons when onRequestVariableInsert is omitted', () => {
    renderVars({ variables: { x: '1' } });
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('shows View… for long values', () => {
    const longValue = 'a'.repeat(101);
    renderVars({ variables: { big: longValue } });
    expect(screen.getByText('View…')).toBeTruthy();
  });

  it('shows View… for multiline values', () => {
    renderVars({ variables: { multi: 'line1\nline2' } });
    expect(screen.getByText('View…')).toBeTruthy();
  });

  it('renames a variable key', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { oldKey: 'val' }, onUpdateVariables });
    fireEvent.change(screen.getByDisplayValue('oldKey'), { target: { value: 'newKey' } });
    expect(onUpdateVariables).toHaveBeenCalledWith({ newKey: 'val' });
  });

  it('renames a key when other variables are present', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { a: '1', b: '2' }, onUpdateVariables });
    fireEvent.change(screen.getByDisplayValue('a'), { target: { value: 'aa' } });
    expect(onUpdateVariables).toHaveBeenCalledWith({ aa: '1', b: '2' });
  });

  it('ignores rename when new key is empty after trim', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { k: 'v' }, onUpdateVariables });
    fireEvent.change(screen.getByDisplayValue('k'), { target: { value: '  ' } });
    expect(onUpdateVariables).not.toHaveBeenCalled();
  });

  it('ignores rename when key unchanged after stripping braces', () => {
    const onUpdateVariables = vi.fn();
    renderVars({ variables: { host: 'x' }, onUpdateVariables });
    fireEvent.change(screen.getByDisplayValue('host'), { target: { value: '{{host}}' } });
    expect(onUpdateVariables).not.toHaveBeenCalled();
  });

  it('does not add variable on name blur when value is empty', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'onlyKey',
      newVarValue: '',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    fireEvent.blur(screen.getByPlaceholderText('name'));
    expect(onUpdateVariables).not.toHaveBeenCalled();
  });

  it('adds variable on value blur when key is set even if value empty', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'k',
      newVarValue: '',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    fireEvent.blur(screen.getByPlaceholderText('value'));
    expect(onUpdateVariables).toHaveBeenCalledWith({ k: '' });
  });

  it('does not add on value blur when key is blank', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: '   ',
      newVarValue: 'x',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    fireEvent.blur(screen.getByPlaceholderText('value'));
    expect(onUpdateVariables).not.toHaveBeenCalled();
  });

  it('ignores column resize mouse moves when drag has not started', () => {
    renderVars({ variables: { a: '1' } });
    expect(() => fireEvent.mouseMove(window, { clientX: 50 })).not.toThrow();
  });

  it('adds new variable on Enter keydown in key input', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'enter',
      newVarValue: 'v',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    const keyInput = screen.getByPlaceholderText('name');
    fireEvent.keyDown(keyInput, { key: 'Enter' });
    expect(onUpdateVariables).toHaveBeenCalledWith({ enter: 'v' });
  });

  it('marks deprecated keys', () => {
    const { container } = renderVars({
      variables: { oldVar: 'x' },
      deprecatedKeys: ['oldVar'],
    });
    const deprecatedRow = container.querySelector('.wf-var-deprecated');
    expect(deprecatedRow).toBeTruthy();
  });

  it('renders column headers', () => {
    renderVars();
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('source')).toBeTruthy();
    expect(screen.getByText('value')).toBeTruthy();
  });

  it('handles resize drag on divider', () => {
    renderVars({ variables: { k: 'v' } });
    const divider = document.querySelector('.wf-var-col-resize:not(.wf-var-col-resize-inert)') as HTMLElement;
    fireEvent.mouseDown(divider, { clientX: 300, preventDefault: vi.fn() });
    expect(document.body.style.cursor).toBe('col-resize');
    fireEvent.mouseMove(window, { clientX: 350 });
    fireEvent.mouseUp(window);
    expect(document.body.style.cursor).toBe('');
  });

  it('opens variable detail for long value view button', () => {
    const longValue = 'a'.repeat(150);
    renderVars({ variables: { longKey: longValue } });
    fireEvent.click(screen.getByText('View…'));
    expect(inspectActions.openVariableDetail).toHaveBeenCalledWith('longKey', longValue, expect.any(Function));
  });

  it('calls onRequestVariableInsert for existing variable Insert button', () => {
    const onRequestVariableInsert = vi.fn();
    renderVars({ variables: { x: '1' }, onRequestVariableInsert });
    fireEvent.click(screen.getAllByText('Insert…')[0]);
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  it('calls onRequestVariableInsert for long value row with variable key ref', () => {
    const onRequestVariableInsert = vi.fn();
    const longValue = 'a'.repeat(101);
    renderVars({ variables: { rowKey: longValue }, onRequestVariableInsert });
    const longWrap = document.querySelector('.wf-var-value-long-wrap');
    const insertBtn = longWrap?.querySelector('.wf-config-insert-var-btn');
    expect(insertBtn).toBeTruthy();
    fireEvent.click(insertBtn!);
    expect(onRequestVariableInsert).toHaveBeenCalledWith(expect.any(Function), false, 'rowKey');
  });

  it('calls onRequestVariableInsert for new row Insert button', () => {
    const onRequestVariableInsert = vi.fn();
    renderVars({ variables: {}, onRequestVariableInsert });
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequestVariableInsert).toHaveBeenCalled();
  });

  it('adds variable on value input blur when key is set', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'blurKey',
      newVarValue: 'v',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    const valueInput = screen.getByPlaceholderText('value');
    fireEvent.blur(valueInput);
    expect(onUpdateVariables).toHaveBeenCalledWith({ blurKey: 'v' });
  });

  it('adds variable on key input blur when key and value are set', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'blurKey',
      newVarValue: 'val',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    const keyInput = screen.getByPlaceholderText('name');
    fireEvent.blur(keyInput);
    expect(onUpdateVariables).toHaveBeenCalledWith({ blurKey: 'val' });
  });

  it('adds new variable on Enter keydown in value input', () => {
    const onUpdateVariables = vi.fn();
    renderVars({
      variables: {},
      onUpdateVariables,
      newVarKey: 'enterVal',
      newVarValue: 'v',
      setNewVarKey: vi.fn(),
      setNewVarValue: vi.fn(),
    });
    const valueInput = screen.getByPlaceholderText('value');
    fireEvent.keyDown(valueInput, { key: 'Enter' });
    expect(onUpdateVariables).toHaveBeenCalledWith({ enterVal: 'v' });
  });

  it('shows long value Insert button when onRequestVariableInsert is provided', () => {
    const onRequestVariableInsert = vi.fn();
    const longValue = 'a'.repeat(101);
    renderVars({ variables: { big: longValue }, onRequestVariableInsert });
    const insertButtons = screen.getAllByText('Insert…');
    expect(insertButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders source from variable hints and workflow defaults', () => {
    renderVars({
      variables: { vin: '{{vin}}' },
      variableHints: [{ ref: 'vin', label: 'VIN (workflow)' }],
      workflowVariables: { vin: 'default' },
    });
    const sourceInputs = document.querySelectorAll('.wf-var-source-input');
    expect(sourceInputs[0]).toHaveProperty('value', 'Default');
  });

  it('truncates long value preview in read-only input', () => {
    const longValue = 'z'.repeat(101);
    renderVars({ variables: { k: longValue } });
    const preview = document.querySelector('.wf-var-value-preview') as HTMLInputElement;
    expect(preview.value.length).toBe(73);
    expect(preview.value.endsWith('…') || preview.value.endsWith('...')).toBe(true);
  });

  it('opens variable detail when clicking long value preview', () => {
    const longValue = 'z'.repeat(101);
    renderVars({ variables: { k: longValue } });
    fireEvent.click(document.querySelector('.wf-var-value-preview')!);
    expect(inspectActions.openVariableDetail).toHaveBeenCalledWith('k', longValue, expect.any(Function));
  });

  it('updates new row value via onChange', () => {
    const setNewVarValue = vi.fn();
    renderVars({
      newVarKey: 'k',
      newVarValue: 'start',
      setNewVarValue,
      setNewVarKey: vi.fn(),
    });
    fireEvent.change(screen.getByPlaceholderText('value'), { target: { value: 'edited' } });
    expect(setNewVarValue).toHaveBeenCalledWith('edited');
  });
});
