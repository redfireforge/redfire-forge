/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import ScriptConfig from './ScriptConfig';
import type { ScriptNodeData } from '../../types/workflow';

// Mock Monaco editor component to render as a simple textarea
vi.mock('./ScriptCodeEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="mock-code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock ScriptTemplateGallery
vi.mock('./ScriptTemplateGallery', () => ({
  __esModule: true,
  default: ({ onSelect, onClose }: { onSelect: (t: unknown) => void; onClose: () => void }) => (
    <div data-testid="mock-template-gallery">
      <button onClick={() => onSelect({ code: '// template', mode: 'validate', inputVariables: ['a'], outputVariables: ['b'] })}>Apply Template</button>
      <button onClick={onClose}>Close Gallery</button>
    </div>
  ),
}));

// Mock ScriptLibraryManager
vi.mock('./ScriptLibraryManager', () => ({
  __esModule: true,
  default: ({ onLibrariesChange, onSelectionChange, onClose }: { onLibrariesChange: (libs: unknown[]) => void; onSelectionChange: (ids: string[]) => void; onClose: () => void }) => (
    <div data-testid="mock-library-manager">
      <button onClick={() => onSelectionChange(['lib-1'])}>Select Lib</button>
      <button onClick={() => onLibrariesChange([])}>Update Libs</button>
      <button onClick={onClose}>Close Libraries</button>
    </div>
  ),
}));

vi.mock('./ScriptCodeModal', () => ({
  __esModule: true,
  default: ({ onClose, onSave }: { onClose: () => void; onSave: (d: unknown) => void }) => (
    <div data-testid="mock-script-code-modal">
      <button type="button" onClick={onClose}>Close Code Modal</button>
      <button
        type="button"
        onClick={() =>
          onSave({
            label: 'From Modal',
            code: 'output.x = 1;',
            mode: 'transform',
            inputVariables: [],
            outputVariables: ['x'],
            timeoutMs: 5000,
            captureConsole: true,
          })
        }
      >
        Save Code Modal
      </button>
    </div>
  ),
}));

// Mock scriptLibraries
vi.mock('../../engine/scriptLibraries', () => ({
  loadScriptLibraries: () => [],
  saveScriptLibraries: vi.fn(),
  buildLibraryPreamble: () => '',
}));

import { saveScriptLibraries } from '../../engine/scriptLibraries';

function makeData(overrides: Partial<ScriptNodeData> = {}): ScriptNodeData {
  return {
    label: 'Script',
    code: 'output.result = input.value;',
    mode: 'transform',
    inputVariables: [],
    outputVariables: [],
    timeoutMs: 5000,
    captureConsole: true,
    ...overrides,
  };
}

describe('ScriptConfig', () => {
  // ── Rendering ──

  it('renders label, mode, and code fields', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Script')).toBeTruthy();
    expect(screen.getByTestId('mock-code-editor')).toBeTruthy();
  });

  it('renders all mode options', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    const options = screen.getAllByRole('option');
    const labels = options.map(o => o.textContent);
    expect(labels).toContain('Transform');
    expect(labels).toContain('Validate');
    expect(labels).toContain('Generate');
  });

  it('renders mode description hint', () => {
    render(<ScriptConfig data={makeData({ mode: 'validate' })} onChange={vi.fn()} />);
    expect(screen.getByText(/set output\.result to true\/false/)).toBeTruthy();
  });

  // ── Label editing ──

  it('calls onChange when label is edited', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Script'), { target: { value: 'My Script' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Script' }));
  });

  // ── Mode editing ──

  it('calls onChange when mode is changed', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Transform'), { target: { value: 'validate' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'validate' }));
  });

  // ── Code editing ──

  it('calls onChange when code is edited via Monaco', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('mock-code-editor'), {
      target: { value: 'output.x = 1;' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ code: 'output.x = 1;' }));
  });

  // ── Timeout editing ──

  it('calls onChange when timeout is edited', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '10000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 10000 }));
  });

  it('clamps timeout to minimum 100', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '50' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 100 }));
  });

  it('clamps timeout to maximum 30000', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '99999' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 30000 }));
  });

  it('defaults timeout to 5000 for non-numeric input', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  // ── Console checkbox ──

  it('calls onChange when captureConsole is toggled', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Capture console/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ captureConsole: false }));
  });

  it('toggles captureConsole from false to true', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData({ captureConsole: false })} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Capture console/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ captureConsole: true }));
  });

  // ── Input Variables ──

  it('renders existing input variables', () => {
    render(<ScriptConfig data={makeData({ inputVariables: ['status', 'userId'] })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('status')).toBeTruthy();
    expect(screen.getByDisplayValue('userId')).toBeTruthy();
  });

  it('adds an input variable when clicking add button', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Input Variable'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputVariables: [''] }),
    );
  });

  it('removes an input variable when clicking remove button', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData({ inputVariables: ['a', 'b'] })} onChange={onChange} />);
    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[0]); // Remove first input var
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputVariables: ['b'] }),
    );
  });

  it('edits an input variable', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData({ inputVariables: ['old'] })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('old'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ inputVariables: ['new'] }),
    );
  });

  // ── Output Variables ──

  it('renders existing output variables', () => {
    render(<ScriptConfig data={makeData({ outputVariables: ['result'] })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('result')).toBeTruthy();
  });

  it('adds an output variable when clicking add button', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Output Variable'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ outputVariables: [''] }),
    );
  });

  it('removes an output variable when clicking remove button', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData({ outputVariables: ['x', 'y'] })} onChange={onChange} />);
    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ outputVariables: ['y'] }),
    );
  });

  it('edits an output variable', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData({ outputVariables: ['oldOut'] })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('oldOut'), { target: { value: 'newOut' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ outputVariables: ['newOut'] }),
    );
  });

  // ── Auto-detect Output Variables (Phase B) ──

  it('renders auto-detect button', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('Auto-detect from code')).toBeTruthy();
  });

  it('auto-detects output variables from code', () => {
    const onChange = vi.fn();
    const data = makeData({
      code: 'output.name = "test";\noutput.count = 5;',
    });
    render(<ScriptConfig data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Auto-detect from code'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ outputVariables: ['count', 'name'] }),
    );
  });

  it('does not call onChange when auto-detect finds nothing', () => {
    const onChange = vi.fn();
    const data = makeData({ code: '// no output assignments' });
    render(<ScriptConfig data={data} onChange={onChange} />);
    fireEvent.click(screen.getByText('Auto-detect from code'));
    expect(onChange).not.toHaveBeenCalled();
  });

  // ── Test Script Button (Phase B) ──

  it('renders Test Script button', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText(/Test Script/)).toBeTruthy();
  });

  it('shows pass result when test script succeeds', () => {
    render(<ScriptConfig data={makeData({ code: 'output.result = "ok";', outputVariables: ['result'] })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText(/Passed/)).toBeTruthy();
  });

  it('shows fail result when test script errors', () => {
    render(<ScriptConfig data={makeData({ code: 'throw new Error("boom");' })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText(/Failed/)).toBeTruthy();
    const errorDiv = document.querySelector('.wf-script-test-error');
    expect(errorDiv?.textContent).toContain('boom');
  });

  it('shows outputs in test result', () => {
    render(<ScriptConfig data={makeData({ code: 'output.result = "hello";', outputVariables: ['result'] })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText('Outputs:')).toBeTruthy();
    expect(screen.getByText('result')).toBeTruthy();
  });

  it('shows console output in test result', () => {
    render(<ScriptConfig data={makeData({ code: 'console.log("debug msg"); output.result = "ok";', outputVariables: ['result'] })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText('Console:')).toBeTruthy();
    expect(screen.getByText('debug msg')).toBeTruthy();
  });

  it('skips empty input variable names when building mock inputs', () => {
    render(<ScriptConfig data={makeData({ code: 'output.result = "ok";', inputVariables: ['', 'valid'], outputVariables: ['result'] })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText(/Passed/)).toBeTruthy();
  });

  it('uses inferred defaults when test inputs are empty', () => {
    // userJson should auto-default to a skeleton object based on code analysis
    render(<ScriptConfig data={makeData({ code: 'var d = JSON.parse(input.userJson); output.name = d.name;', inputVariables: ['userJson'], outputVariables: ['name'] })} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText(/Passed/)).toBeTruthy();
  });

  it('renders Test Inputs section when input variables exist', () => {
    render(<ScriptConfig data={makeData({ inputVariables: ['userJson'] })} onChange={vi.fn()} />);
    expect(screen.getByText('Test Inputs')).toBeTruthy();
  });

  it('does not render Test Inputs section when no input variables', () => {
    render(<ScriptConfig data={makeData({ inputVariables: [] })} onChange={vi.fn()} />);
    expect(screen.queryByText('Test Inputs')).toBeNull();
  });

  it('uses mock input values when testing script', () => {
    render(<ScriptConfig data={makeData({ code: 'var d = JSON.parse(input.userJson); output.name = d.name;', inputVariables: ['userJson'], outputVariables: ['name'] })} onChange={vi.fn()} />);
    // Find the input field by its role within the test inputs section
    const inputs = document.querySelectorAll('.wf-script-test-input-row input');
    fireEvent.change(inputs[0], { target: { value: '{"name":"Alice"}' } });
    fireEvent.click(screen.getByText(/Test Script/));
    expect(screen.getByText(/Passed/)).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  // ── Complexity Warnings (Phase C) ──

  it('shows complexity warnings for dangerous code', () => {
    const data = makeData({ code: 'eval("x"); while(true) { break; }' });
    const { container } = render(<ScriptConfig data={data} onChange={vi.fn()} />);
    const warnings = container.querySelectorAll('.wf-script-warning');
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show warnings for safe code', () => {
    const data = makeData({ code: 'output.result = "ok";' });
    render(<ScriptConfig data={data} onChange={vi.fn()} />);
    expect(screen.queryByText(/infinite loop/)).toBeNull();
    expect(screen.queryByText(/eval\(\)/)).toBeNull();
  });

  // ── Variable Insert ──

  it('does not render Insert button when onRequestVariableInsert is not provided', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByText('Insert…')).toBeNull();
  });

  it('renders Insert button when onRequestVariableInsert is provided', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} onRequestVariableInsert={vi.fn()} />);
    expect(screen.getByText('Insert…')).toBeTruthy();
  });

  it('calls onRequestVariableInsert and applies snippet to code', () => {
    const onRequest = vi.fn();
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} onRequestVariableInsert={onRequest} />);
    fireEvent.click(screen.getByText('Insert…'));
    expect(onRequest).toHaveBeenCalledTimes(1);
    const applyFn = onRequest.mock.calls[0][0];
    applyFn('{{userId}}');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'output.result = input.value;{{userId}}' }),
    );
  });

  // ── Info section ──

  it('renders how-it-works section with max output size info', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByText(/Maximum output size/)).toBeTruthy();
  });

  // ── Templates & Libraries (Phase D) ──

  it('shows Templates and Libraries buttons', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByText('Templates')).toBeTruthy();
    expect(screen.getByText('Libraries')).toBeTruthy();
  });

  it('toggles template gallery on Templates button click', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('mock-template-gallery')).toBeNull();
    fireEvent.click(screen.getByText('Templates'));
    expect(screen.getByTestId('mock-template-gallery')).toBeTruthy();
    expect(screen.getByText('Hide Templates')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide Templates'));
    expect(screen.queryByTestId('mock-template-gallery')).toBeNull();
  });

  it('toggles library manager on Libraries button click', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('mock-library-manager')).toBeNull();
    fireEvent.click(screen.getByText('Libraries'));
    expect(screen.getByTestId('mock-library-manager')).toBeTruthy();
    expect(screen.getByText('Hide Libraries')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide Libraries'));
    expect(screen.queryByTestId('mock-library-manager')).toBeNull();
  });

  it('applies template via gallery onSelect', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('Apply Template'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      code: '// template',
      mode: 'validate',
      inputVariables: ['a'],
      outputVariables: ['b'],
    }));
    // Gallery should close after applying
    expect(screen.queryByTestId('mock-template-gallery')).toBeNull();
  });

  it('closes template gallery via onClose', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Templates'));
    expect(screen.getByTestId('mock-template-gallery')).toBeTruthy();
    fireEvent.click(screen.getByText('Close Gallery'));
    expect(screen.queryByTestId('mock-template-gallery')).toBeNull();
  });

  it('updates library selection via library manager', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Libraries'));
    fireEvent.click(screen.getByText('Select Lib'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      libraryIds: ['lib-1'],
    }));
  });

  it('closes library manager via onClose', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Libraries'));
    expect(screen.getByTestId('mock-library-manager')).toBeTruthy();
    fireEvent.click(screen.getByText('Close Libraries'));
    expect(screen.queryByTestId('mock-library-manager')).toBeNull();
  });

  it('opens full-screen code modal from Open Editor', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.queryByTestId('mock-script-code-modal')).toBeNull();
    fireEvent.click(screen.getByText(/Open Editor/));
    expect(screen.getByTestId('mock-script-code-modal')).toBeTruthy();
  });

  it('closes code modal', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Open Editor/));
    fireEvent.click(screen.getByText('Close Code Modal'));
    expect(screen.queryByTestId('mock-script-code-modal')).toBeNull();
  });

  it('applies script data from code modal onSave', () => {
    const onChange = vi.fn();
    render(<ScriptConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Open Editor/));
    fireEvent.click(screen.getByText('Save Code Modal'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      label: 'From Modal',
      code: 'output.x = 1;',
      outputVariables: ['x'],
    }));
    expect(screen.getByTestId('mock-script-code-modal')).toBeTruthy();
  });

  it('persists libraries when library manager updates the catalog', () => {
    render(<ScriptConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Libraries'));
    fireEvent.click(screen.getByText('Update Libs'));
    expect(saveScriptLibraries).toHaveBeenCalledWith([]);
  });
});
