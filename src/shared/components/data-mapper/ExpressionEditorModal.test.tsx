/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExpressionEditorModal from './ExpressionEditorModal';
import type { Mapping, MapperSource } from './types';

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
    fireEvent.click(screen.getByTitle('Close'));
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
    expect(screen.getByText(/\$\.path/)).toBeTruthy();
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
