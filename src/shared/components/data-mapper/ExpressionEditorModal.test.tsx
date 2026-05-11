/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExpressionEditorModal from './ExpressionEditorModal';
import type { Mapping, MapperSource } from './types';

// Mock Monaco editor — renders a textarea in test environment
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, onMount: _onMount }: { value: string; onChange: (v: string) => void; onMount?: (e: unknown, m: unknown) => void }) => {
    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='e.g. $upper($.name) or $concat($.firstName, " ", $.lastName)'
      />
    );
  },
}));

const sources: MapperSource[] = [
  { id: 's1', label: 'Response', sampleData: { name: 'Alice', age: 30 } },
];

const baseMapping: Mapping = {
  id: 'm1',
  sourcePath: 'name',
  sourceId: 's1',
  targetPath: 'userName',
};

function renderModal(overrides?: Partial<Parameters<typeof ExpressionEditorModal>[0]>) {
  const defaults = {
    mapping: baseMapping,
    sources,
    activeSourceId: 's1',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  const result = render(<ExpressionEditorModal {...props} />);
  return { ...result, props };
}

describe('ExpressionEditorModal', () => {
  it('renders with expression editor title', () => {
    renderModal();
    expect(screen.getByText('Expression Editor')).toBeTruthy();
  });

  it('shows target path', () => {
    renderModal();
    expect(screen.getByText(/userName/)).toBeTruthy();
  });

  it('pre-fills with mapping.sourcePath when no expression', () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('name');
  });

  it('pre-fills with mapping.expression when present', () => {
    const mapping = { ...baseMapping, expression: '$upper($.name)' };
    renderModal({ mapping });
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('$upper($.name)');
  });

  it('shows live preview for valid expression (debounced)', async () => {
    vi.useFakeTimers();
    const mapping = { ...baseMapping, expression: '$upper($.name)' };
    renderModal({ mapping });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('ALICE')).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows preview for unknown function expression (debounced)', async () => {
    vi.useFakeTimers();
    const mapping = { ...baseMapping, expression: '$unknownFn($.name)' };
    const { container } = renderModal({ mapping });
    await act(async () => { vi.advanceTimersByTime(250); });
    const previewDiv = container.querySelector('.dm-expr-preview-value');
    expect(previewDiv).toBeTruthy();
    expect(previewDiv?.textContent).toBeTruthy();
    vi.useRealTimers();
  });

  it('calls onSave when Save button clicked', () => {
    const { props } = renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '$lower($.name)' } });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(props.onSave).toHaveBeenCalledWith('m1', '$lower($.name)');
  });

  it('calls onCancel when Cancel button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Close expression editor'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders function catalog with categories', () => {
    const { container } = renderModal();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
    const catNames = Array.from(catButtons).map((b) => b.textContent);
    expect(catNames).toContain('String');
    expect(catNames).toContain('Math');
    expect(catNames).toContain('Conditional');
  });

  it('shows function docs when a function is clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('$upper'));
    expect(screen.getByText(/UPPERCASE/)).toBeTruthy();
  });

  it('inserts function template when clicked', () => {
    renderModal();
    fireEvent.click(screen.getByText('$upper'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('$upper(');
  });

  it('filters functions by category', () => {
    renderModal();
    fireEvent.click(screen.getAllByText('Math')[0]);
    expect(screen.getByText('$abs')).toBeTruthy();
  });

  it('shows "All" category by default', () => {
    renderModal();
    expect(screen.getByText('$upper')).toBeTruthy();
    expect(screen.getByText('$abs')).toBeTruthy();
  });

  it('shows hint about $.path syntax', () => {
    renderModal();
    expect(screen.getByText(/source fields/)).toBeTruthy();
  });
});

describe('ExpressionEditorModal – keyboard shortcuts', () => {
  it('Cmd+Enter saves', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', metaKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('Escape cancels', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ExpressionEditorModal – custom functions', () => {
  it('shows custom functions in sidebar', () => {
    const customFns = [{
      name: '$myFn',
      category: 'Custom',
      signature: '$myFn(x) → string',
      description: 'My custom fn',
      args: [{ name: 'x', type: 'string', required: true, description: 'Input' }],
      returnType: 'string',
      examples: [],
      evaluate: (v: unknown) => `custom:${v}`,
    }];
    const { container } = renderModal({ customFunctions: customFns });
    expect(screen.getByText('$myFn')).toBeTruthy();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
    const catNames = Array.from(catButtons).map((b) => b.textContent);
    expect(catNames).toContain('Custom');
  });
});

describe('ExpressionEditorModal – additional coverage', () => {
  it('resets expression when mapping.id changes', async () => {
    const { rerender, props } = renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('name');

    const newMapping = { ...baseMapping, id: 'm2', sourcePath: 'age', expression: '$abs($.age)' };
    rerender(
      <ExpressionEditorModal {...props} mapping={newMapping} />,
    );
    const updated = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(updated.value).toBe('$abs($.age)');
  });

  it('shows placeholder preview for empty expression', async () => {
    vi.useFakeTimers();
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    await act(async () => { vi.advanceTimersByTime(250); });
    const previewDiv = document.querySelector('.dm-expr-preview-value');
    expect(previewDiv?.textContent).toBe('Enter an expression above');
    vi.useRealTimers();
  });

  it('Ctrl+Enter saves (not just Cmd+Enter)', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('filters by category when category button is clicked', () => {
    const { container } = renderModal();
    const catButtons = container.querySelectorAll('.dm-expr-cat-btn');
    const mathBtn = Array.from(catButtons).find(b => b.textContent === 'Math');
    fireEvent.click(mathBtn!);
    expect(screen.getByText('$add')).toBeTruthy();
    const allBtn = Array.from(container.querySelectorAll('.dm-expr-cat-btn')).find(b => b.textContent === 'All');
    fireEvent.click(allBtn!);
    expect(screen.getByText('$upper')).toBeTruthy();
  });

  it('shows function docs panel when function is clicked', () => {
    renderModal();
    const fnItem = screen.getByText('$upper').closest('.dm-expr-fn-item')!;
    fireEvent.click(fnItem);
    expect(document.querySelector('.dm-expr-doc-desc')).toBeTruthy();
    expect(document.querySelector('.dm-expr-doc-sig')).toBeTruthy();
  });

  it('inserts function template on click', () => {
    renderModal();
    const fnItem = screen.getByText('$upper').closest('.dm-expr-fn-item')!;
    fireEvent.click(fnItem);
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('$upper(');
  });
});

describe('ExpressionEditorModal – Monaco integration', () => {
  it('renders Monaco editor mock (data-testid present)', () => {
    renderModal();
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });

  it('Monaco editor reflects value changes', () => {
    renderModal();
    const editor = screen.getByTestId('monaco-editor') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: '$upper($.name)' } });
    expect(editor.value).toBe('$upper($.name)');
  });

  it('shows updated hint about $. for source fields and $ for functions', () => {
    renderModal();
    const hint = screen.getByText(/source fields/);
    expect(hint).toBeTruthy();
    expect(hint.closest('.dm-expr-source-hint')).toBeTruthy();
  });

  it('shows Ctrl+Enter hint text', () => {
    renderModal();
    expect(screen.getByText(/Ctrl\+Enter/)).toBeTruthy();
  });

  it('Ctrl+Enter from overlay saves expression', () => {
    const { props } = renderModal();
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('saves current expression on Cmd+Enter', () => {
    const { props } = renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    const overlay = screen.getByText('Expression Editor').closest('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', metaKey: true });
    expect(props.onSave).toHaveBeenCalledWith('m1', '$upper($.name)');
  });

  it('renders with string sampleData source', () => {
    const strSources: MapperSource[] = [
      { id: 's1', label: 'Response', sampleData: '{"user": "Alice"}' },
    ];
    renderModal({ sources: strSources });
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });

  it('handles null sampleData gracefully', () => {
    const nullSources: MapperSource[] = [
      { id: 's1', label: 'Response', sampleData: null },
    ];
    renderModal({ sources: nullSources });
    expect(screen.getByTestId('monaco-editor')).toBeTruthy();
  });
});

describe('ExpressionEditorModal – Step-Through Debugger', () => {
  it('renders Step Debug button', () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    expect(screen.getByText('Step Debug')).toBeTruthy();
  });

  it('shows debugger panel when Step Debug is clicked', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    const btn = screen.getByText('Step Debug');
    fireEvent.click(btn);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Step-through debugger')).toBeTruthy();
  });

  it('shows step counter', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText(/Step \d+ \/ \d+/)).toBeTruthy();
  });

  it('has prev/next buttons', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Previous step')).toBeTruthy();
    expect(screen.getByLabelText('Next step')).toBeTruthy();
  });

  it('shows Final Result step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText('Final Result')).toBeTruthy();
  });

  it('shows Path Resolution step for path expressions', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByText('Path Resolution')).toBeTruthy();
  });

  it('hides debugger when toggled off', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    const btn = screen.getByText('Step Debug');
    fireEvent.click(btn);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByLabelText('Step-through debugger')).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByLabelText('Step-through debugger')).toBeNull();
  });

  it('marks debug button as active when debugger is open', () => {
    renderModal({ mapping: { ...baseMapping, expression: '$.name' } });
    const btn = screen.getByText('Step Debug');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('does NOT open debugger when expression is empty', () => {
    renderModal();
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '' } });
    fireEvent.click(screen.getByText('Step Debug'));
    expect(screen.queryByLabelText('Step-through debugger')).toBeNull();
    expect(screen.getByText('Step Debug').getAttribute('aria-pressed')).toBe('false');
  });

  it('navigates steps with prev/next buttons', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$concat($.name, " test")' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const counter = screen.getByText(/Step \d+ \/ \d+/);
    expect(counter).toBeTruthy();
    const prevBtn = screen.getByLabelText('Previous step');
    const nextBtn = screen.getByLabelText('Next step');
    fireEvent.click(prevBtn);
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step \d+ \/ \d+/)).toBeTruthy();
  });

  it('allows clicking a step to select it', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.click(steps[0]);
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('allows keyboard (Enter) to select a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.keyDown(steps[0], { key: 'Enter' });
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('allows keyboard (Space) to select a step', async () => {
    renderModal({ mapping: { ...baseMapping, expression: '$upper($.name)' } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const steps = document.querySelectorAll('.dm-expr-step');
    if (steps.length > 1) {
      fireEvent.keyDown(steps[0], { key: ' ' });
      expect(steps[0].className).toContain('dm-expr-step--active');
    }
  });

  it('shows title tooltip on truncated step values', async () => {
    const longExpr = '$concat($.name, "' + 'x'.repeat(100) + '")';
    renderModal({ mapping: { ...baseMapping, expression: longExpr } });
    fireEvent.click(screen.getByText('Step Debug'));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const codeEls = document.querySelectorAll('.dm-expr-step-value');
    if (codeEls.length > 0) {
      expect(codeEls[codeEls.length - 1].getAttribute('title')).toBeTruthy();
    }
  });

  it('shows function parameters and examples in docs panel', () => {
    renderModal();
    fireEvent.click(screen.getByText('$concat'));
    expect(document.querySelector('.dm-expr-doc-args')).toBeTruthy();
    expect(document.querySelector('.dm-expr-doc-returns')).toBeTruthy();
  });

  it('shows doc-empty panel when no function selected', () => {
    renderModal();
    expect(document.querySelector('.dm-expr-doc-empty')).toBeTruthy();
  });

  it('inserts function without args as fnName()', () => {
    const noArgFns = [{
      name: '$myNoArgs',
      category: 'Custom' as const,
      signature: '$myNoArgs() → number',
      description: 'No args function',
      args: [],
      returnType: 'number' as const,
      examples: [],
      evaluate: () => 42,
    }];
    renderModal({ customFunctions: noArgFns });
    fireEvent.click(screen.getByText('$myNoArgs'));
    const textarea = screen.getByPlaceholderText(/\$upper/) as HTMLTextAreaElement;
    expect(textarea.value).toContain('$myNoArgs()');
  });
});

describe('ExpressionEditorModal — error confirmation', () => {
  it('shows confirm dialog when saving with evaluation error and blocks save on cancel', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const evalMod = await import('./utils/mapperExpressionEvaluator');
    const evalSpy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValue({
      value: undefined, preview: '', error: 'Unknown function',
    });

    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$bad($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    evalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('saves when user confirms despite evaluation error', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const evalMod = await import('./utils/mapperExpressionEvaluator');
    const evalSpy = vi.spyOn(evalMod, 'evaluateMapperExpression').mockReturnValue({
      value: undefined, preview: '', error: 'Unknown function',
    });

    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$bad($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('m1', '$bad($.name)');
    confirmSpy.mockRestore();
    evalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('saves without confirm when expression has no error', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$upper($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('m1', '$upper($.name)');
    confirmSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – Ctrl+Enter keyboard shortcut', () => {
  it('fires handleSave when Ctrl+Enter pressed in overlay', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const overlay = container.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Enter', ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith('m1', '$.name');
    vi.useRealTimers();
  });

  it('fires onCancel when Escape pressed in overlay', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$.name' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    const overlay = container.querySelector('.dm-expr-overlay')!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ExpressionEditorModal – function insert without editor', () => {
  it('appends function template to expression when no Monaco editor', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const fnBtn = screen.getByText('$upper');
    fireEvent.click(fnBtn);
    // Monaco not mounted in test → falls back to appending to expression via setExpression
    // Verify the expression was updated by saving
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    const savedExpr = onSave.mock.calls[0]?.[1] ?? '';
    expect(savedExpr).toContain('$upper');
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – initializes from sourcePath when no expression', () => {
  it('defaults expression to mapping.sourcePath', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    render(
      <ExpressionEditorModal
        mapping={{ id: 'm1', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail' }}
        sources={sources}
        activeSourceId="s1"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Save Expression'));
    expect(onSave).toHaveBeenCalledWith('m1', 'email');
    vi.useRealTimers();
  });
});

describe('ExpressionEditorModal – step debugger toggle', () => {
  it('toggles debugger on and off', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '$upper($.name)' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    const toggleBtn = screen.getByText('Step Debug');
    fireEvent.click(toggleBtn);
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.dm-expr-step-debugger')).toBeTruthy();
    // Toggle off
    fireEvent.click(toggleBtn);
    expect(container.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });

  it('does not enable debugger with empty expression', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <ExpressionEditorModal
        mapping={{ ...baseMapping, expression: '' }}
        sources={sources}
        activeSourceId="s1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByText('Step Debug'));
    expect(container.querySelector('.dm-expr-step-debugger')).toBeNull();
    vi.useRealTimers();
  });
});
