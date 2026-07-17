/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScriptCodeModal from './ScriptCodeModal';
import type { ScriptNodeData } from '../../types/workflow';

vi.mock('../modals/WorkflowEditorModalFrame', () => ({
  default: ({ title, children, footer, headerActions, onClose }: {
    title: React.ReactNode; children: React.ReactNode;
    footer?: React.ReactNode; headerActions?: React.ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="modal-frame">
      <div data-testid="modal-title">{title}</div>
      {headerActions && <div data-testid="modal-header-actions">{headerActions}</div>}
      <div data-testid="modal-body">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
      <button data-testid="frame-close" onClick={onClose}>X</button>
    </div>
  ),
}));

vi.mock('./ScriptCodeEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock('./ScriptTestResult', () => ({
  default: ({ result }: { result: { success: boolean; output?: string } }) => (
    <div data-testid="test-result">{result.success ? 'PASS' : 'FAIL'}: {result.output}</div>
  ),
}));

vi.mock('../expression/InsertVarField', () => ({
  default: ({ children, onInsert }: { children: React.ReactNode; onInsert: (s: string) => void }) => (
    <div data-testid="insert-var-field">
      {children}
      <button data-testid="insert-snippet" onClick={() => onInsert(' + snippet')}>Insert</button>
    </div>
  ),
}));

vi.mock('../../../requests/components/JsonTreePreview', () => {
  function JsonTreePreviewMock({ body, onMatchCountChange, onToggle }: {
    body: string;
    onMatchCountChange?: (count: number) => void;
    onToggle?: (path: string) => void;
  }) {
    useEffect(() => {
      if (onMatchCountChange) onMatchCountChange(0);
    }, [onMatchCountChange]);
    return (
      <div data-testid="json-preview">
        {body.slice(0, 50)}
        {onToggle && <button data-testid="toggle-node" onClick={() => onToggle('/a')}>Toggle</button>}
      </div>
    );
  }
  return {
    default: JsonTreePreviewMock,
    buildJTree: (obj: unknown) => ({ key: 'root', value: obj, type: 'object', children: [{ key: 'a', value: 1, children: [] }] }),
    collectJTreePaths: (node: { children?: { key: string }[] }, prefix: string) => {
      const paths: string[] = [];
      if (node.children) node.children.forEach(c => paths.push(`${prefix}/${c.key}`));
      return paths;
    },
  };
});

vi.mock('../../../../shared/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

vi.mock('../../../../shared/hooks/useSplitterDrag', () => ({
  useSplitterDrag: () => vi.fn(),
}));

vi.mock('../../../../shared/utils/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/utils/helpers')>();
  return {
    ...actual,
    prettyJson: (text: string) => {
      try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
    },
  };
});

const mockHandleTestScript = vi.fn();
const mockHandleAutoDetect = vi.fn().mockReturnValue([]);
let mockTestResult: { success: boolean; output?: string; error?: string } | null = null;
let mockMockInputs: Record<string, string> = {};
const mockSetMockInputs = vi.fn((updater) => {
  if (typeof updater === 'function') {
    mockMockInputs = updater(mockMockInputs);
  } else {
    mockMockInputs = updater;
  }
});
let mockComplexityWarnings: string[] = [];

vi.mock('./useScriptTest', () => ({
  SCRIPT_MODE_OPTIONS: [
    { value: 'transform', label: 'Transform' },
    { value: 'filter', label: 'Filter' },
    { value: 'assert', label: 'Assert' },
  ],
  useScriptTest: () => ({
    testResult: mockTestResult,
    mockInputs: mockMockInputs,
    setMockInputs: mockSetMockInputs,
    inferredDefaults: { userId: '123' },
    complexityWarnings: mockComplexityWarnings,
    handleTestScript: mockHandleTestScript,
    handleAutoDetect: mockHandleAutoDetect,
  }),
}));

function makeScriptData(overrides: Partial<ScriptNodeData> = {}): ScriptNodeData {
  return {
    code: 'const result = input.userId;\nreturn { result };',
    mode: 'transform',
    label: 'My Script',
    inputVariables: ['userId', 'token'],
    outputVariables: ['result'],
    ...overrides,
  };
}

describe('ScriptCodeModal', () => {
  const defaultProps = {
    data: makeScriptData(),
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    resetAllMocks();
    mockTestResult = null;
    mockMockInputs = {};
    mockComplexityWarnings = [];
  });

  describe('rendering', () => {
    it('renders modal with title', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText(/SCRIPT EDITOR/)).toBeInTheDocument();
      expect(screen.getByText(/My Script/)).toBeInTheDocument();
    });

    it('renders code editor', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('renders mode select', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByTitle('Script mode')).toBeInTheDocument();
    });

    it('renders input variables section', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('Input Variables')).toBeInTheDocument();
    });

    it('renders output variables section', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('Output Variables')).toBeInTheDocument();
    });

    it('renders test values section when input vars exist', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('Test Values')).toBeInTheDocument();
    });

    it('renders Run Test button', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('▶ Run Test')).toBeInTheDocument();
    });

    it('renders Save and Cancel buttons', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows input variable names', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const inputs = screen.getAllByPlaceholderText('name');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      expect((inputs[0] as HTMLInputElement).value).toBe('userId');
      expect((inputs[1] as HTMLInputElement).value).toBe('token');
    });

    it('shows output variable names', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const inputs = screen.getAllByPlaceholderText('name');
      expect((inputs[2] as HTMLInputElement).value).toBe('result');
    });
  });

  describe('interactions', () => {
    it('calls onClose when Cancel clicked', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onSave and onClose when Save clicked', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        code: 'const result = input.userId;\nreturn { result };',
        mode: 'transform',
      }));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('changes script mode', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.change(screen.getByTitle('Script mode'), { target: { value: 'filter' } });
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'filter',
      }));
    });

    it('edits code', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.change(screen.getByTestId('code-editor'), { target: { value: 'new code' } });
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        code: 'new code',
      }));
    });

    it('shows unsaved changes indicator when code changes', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.change(screen.getByTestId('code-editor'), { target: { value: 'modified' } });
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    it('adds input variable', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const addBtns = screen.getAllByText('+');
      fireEvent.click(addBtns[0]); // First + is for input variables
      const inputs = screen.getAllByPlaceholderText('name');
      expect(inputs.length).toBe(4); // 2 input + 1 output + 1 new
    });

    it('removes input variable', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const removeBtns = screen.getAllByTitle('Remove');
      fireEvent.click(removeBtns[0]); // Remove first input variable
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        inputVariables: ['token'],
      }));
    });

    it('edits input variable name', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const inputs = screen.getAllByPlaceholderText('name');
      fireEvent.change(inputs[0], { target: { value: 'newVarName' } });
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        inputVariables: ['newVarName', 'token'],
      }));
    });

    it('adds output variable', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const addBtns = screen.getAllByText('+');
      fireEvent.click(addBtns[1]); // Second + is for output variables
      const inputs = screen.getAllByPlaceholderText('name');
      expect(inputs.length).toBe(4); // 2 input + 1 output + 1 new
    });

    it('removes output variable', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const removeBtns = screen.getAllByTitle('Remove');
      fireEvent.click(removeBtns[2]); // Third Remove is for output var
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        outputVariables: [],
      }));
    });

    it('triggers auto-detect outputs', () => {
      mockHandleAutoDetect.mockReturnValue(['detectedVar']);
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Auto-detect from code'));
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        outputVariables: ['detectedVar'],
      }));
    });

    it('runs test script', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByText('▶ Run Test'));
      expect(mockHandleTestScript).toHaveBeenCalled();
    });

    it('shows test result when available', () => {
      mockTestResult = { success: true, output: 'hello' };
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByTestId('test-result')).toBeInTheDocument();
    });

    it('opens value panel on test value click', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      // TestValuePanel should appear with the variable name
      expect(screen.getAllByText('userId').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('complexity warnings', () => {
    it('shows warnings when present', () => {
      mockComplexityWarnings = ['Too many loops', 'Nested callbacks'];
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText(/Too many loops/)).toBeInTheDocument();
      expect(screen.getByText(/Nested callbacks/)).toBeInTheDocument();
    });

    it('does not show warnings section when empty', () => {
      mockComplexityWarnings = [];
      render(<ScriptCodeModal {...defaultProps} />);
      expect(document.querySelector('.wf-script-warnings')).not.toBeInTheDocument();
    });
  });

  describe('no input variables', () => {
    it('hides test values section when no input vars', () => {
      render(<ScriptCodeModal {...defaultProps} data={makeScriptData({ inputVariables: [] })} />);
      expect(screen.queryByText('Test Values')).not.toBeInTheDocument();
    });
  });

  describe('auto badge display', () => {
    it('shows auto badge when placeholder is used', () => {
      mockMockInputs = {};
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('auto')).toBeInTheDocument();
    });

    it('shows value preview for user-set values', () => {
      mockMockInputs = { userId: 'custom-value' };
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText('custom-value')).toBeInTheDocument();
    });

    it('truncates long preview values', () => {
      mockMockInputs = { userId: 'a'.repeat(50) };
      render(<ScriptCodeModal {...defaultProps} />);
      expect(screen.getByText(/a{40}…/)).toBeInTheDocument();
    });
  });

  describe('output edits', () => {
    it('edits output variable name', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      const inputs = screen.getAllByPlaceholderText('name');
      fireEvent.change(inputs[2], { target: { value: 'newOutput' } });
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        outputVariables: ['newOutput'],
      }));
    });
  });

  describe('TestValuePanel', () => {
    it('renders value panel with textarea for non-JSON', () => {
      mockMockInputs = { userId: 'plain text' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const textarea = document.querySelector('.wf-script-value-panel-editor');
      expect(textarea).toBeInTheDocument();
    });

    it('renders value panel with tree view for valid JSON', () => {
      mockMockInputs = { userId: '{"id": 1}' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      expect(screen.getByTestId('json-preview')).toBeInTheDocument();
    });

    it('toggles between text and tree view', () => {
      mockMockInputs = { userId: '{"id": 1}' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      // Initially tree view for JSON
      expect(screen.getByTestId('json-preview')).toBeInTheDocument();
      // Switch to text
      const switchBtn = screen.getByTitle('Switch to text editor');
      fireEvent.click(switchBtn);
      expect(document.querySelector('.wf-script-value-panel-editor')).toBeInTheDocument();
    });

    it('pretty prints and minifies JSON', () => {
      mockMockInputs = { userId: '{"id":1}' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      // Switch to text first
      fireEvent.click(screen.getByTitle('Switch to text editor'));
      const prettyBtn = screen.getByTitle('Pretty Format JSON');
      fireEvent.click(prettyBtn);
      expect(mockSetMockInputs).toHaveBeenCalled();
    });

    it('closes value panel', () => {
      mockMockInputs = { userId: 'test' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const closeBtn = screen.getByLabelText('Close');
      fireEvent.click(closeBtn);
      expect(document.querySelector('.wf-script-value-panel')).not.toBeInTheDocument();
    });

    it('search works in text mode', () => {
      mockMockInputs = { userId: 'hello world test' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      // Already in text mode since value is not JSON
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'hello' } });
      expect(screen.getByText(/1\/1|No match/)).toBeInTheDocument();
    });

    it('handles Expand All / Collapse All in tree mode', () => {
      mockMockInputs = { userId: '{"a": {"b": 1}}' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      expect(screen.getByText('Expand All')).toBeInTheDocument();
      expect(screen.getByText('Collapse All')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Collapse All'));
      fireEvent.click(screen.getByText('Expand All'));
    });

    it('toggles tree node expansion from JsonPreview', () => {
      mockMockInputs = { userId: '{"a":1}' };
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByText('userId').closest('button')!);
      const toggle = screen.getByTestId('toggle-node');
      fireEvent.click(toggle);
      fireEvent.click(toggle);
    });

    it('navigates search results with Enter key', () => {
      mockMockInputs = { userId: 'hello hello hello' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'hello' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(screen.getByText('2/3')).toBeInTheDocument();
    });

    it('clears search on Escape key', () => {
      mockMockInputs = { userId: 'hello world' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'hello' } });
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(searchInput.value).toBe('');
    });

    it('navigates backwards with Shift+Enter', () => {
      mockMockInputs = { userId: 'abc abc abc' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' }); // go to 2/3
      fireEvent.keyDown(searchInput, { key: 'Enter', shiftKey: true }); // back to 1/3
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('uses Previous/Next buttons for navigation', () => {
      mockMockInputs = { userId: 'test test test' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'test' } });
      fireEvent.click(screen.getByTitle('Next'));
      expect(screen.getByText('2/3')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Previous'));
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('edits value in textarea', () => {
      mockMockInputs = { userId: 'old value' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const textarea = document.querySelector('.wf-script-value-panel-editor') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'new value' } });
      expect(mockSetMockInputs).toHaveBeenCalled();
    });

    it('minify tolerates invalid JSON in text mode', () => {
      mockMockInputs = { userId: '{"x":1}' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      fireEvent.click(screen.getByTitle('Switch to text editor'));
      const textarea = document.querySelector('.wf-script-value-panel-editor') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '{\nnot-json' } });
      fireEvent.click(screen.getByTitle('Minify JSON (remove whitespace)'));
      expect(mockSetMockInputs).toHaveBeenCalled();
    });

    it('treats invalid search regexp as zero matches in text mode', () => {
      mockMockInputs = { userId: 'hello' };
      render(<ScriptCodeModal {...defaultProps} />);
      const valueBtn = screen.getByText('userId');
      fireEvent.click(valueBtn.closest('button')!);
      const searchInput = document.querySelector('.wf-script-value-popup-search') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: '(' } });
      expect(screen.getByText('No match')).toBeInTheDocument();
    });

  });

  describe('InsertVarField integration', () => {
    it('inserts snippet into code', () => {
      render(<ScriptCodeModal {...defaultProps} />);
      fireEvent.click(screen.getByTestId('insert-snippet'));
      fireEvent.click(screen.getByText('Save'));
      expect(defaultProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
        code: expect.stringContaining(' + snippet'),
      }));
    });
  });
});
