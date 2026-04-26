/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import ComposeStrip, { createLiteralId } from './ComposeStrip';
import type { ComposeToken } from './ComposeStrip';

const makeVarToken = (id: string, name: string): ComposeToken => ({
  id,
  kind: 'variable',
  value: `{{${name}}}`,
  displayLabel: name,
});

const makeLitToken = (id: string, text: string): ComposeToken => ({
  id,
  kind: 'literal',
  value: text,
  displayLabel: text,
});

describe('ComposeStrip', () => {
  const defaultProps = {
    tokens: [] as ComposeToken[],
    onTokensChange: vi.fn(),
    onInsertAll: vi.fn(),
    onClear: vi.fn(),
  };

  it('shows empty state when no tokens', () => {
    render(<ComposeStrip {...defaultProps} />);
    expect(screen.getByText(/Check variables above/)).toBeTruthy();
  });

  it('shows token count', () => {
    const tokens = [makeVarToken('1', 'foo'), makeVarToken('2', 'bar')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(screen.getByText('2 tokens')).toBeTruthy();
  });

  it('shows singular token count', () => {
    const tokens = [makeVarToken('1', 'foo')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(screen.getByText('1 token')).toBeTruthy();
  });

  it('renders token labels', () => {
    const tokens = [makeVarToken('1', 'jobId'), makeLitToken('2', '---')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(screen.getByText('jobId')).toBeTruthy();
    expect(screen.getByText('---')).toBeTruthy();
  });

  it('shows preview of composed template', () => {
    const tokens = [makeVarToken('1', 'a'), makeLitToken('2', '-'), makeVarToken('3', 'b')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(screen.getByText('{{a}}-{{b}}')).toBeTruthy();
  });

  it('removes a token when × is clicked', () => {
    const onTokensChange = vi.fn();
    const tokens = [makeVarToken('1', 'foo'), makeVarToken('2', 'bar')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} onTokensChange={onTokensChange} />);
    const removeButtons = screen.getAllByLabelText(/Remove/);
    fireEvent.click(removeButtons[0]); // Remove foo
    expect(onTokensChange).toHaveBeenCalledWith([tokens[1]]);
  });

  it('calls onClear when Clear is clicked', () => {
    const onClear = vi.fn();
    const tokens = [makeVarToken('1', 'foo')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} onClear={onClear} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onInsertAll when Insert All is clicked', () => {
    const onInsertAll = vi.fn();
    const tokens = [makeVarToken('1', 'foo')];
    render(<ComposeStrip {...defaultProps} tokens={tokens} onInsertAll={onInsertAll} />);
    fireEvent.click(screen.getByText('Insert All (1)'));
    expect(onInsertAll).toHaveBeenCalledTimes(1);
  });

  it('disables Clear and Insert All when no tokens', () => {
    const { container } = render(<ComposeStrip {...defaultProps} />);
    const clearBtn = container.querySelector('.wf-compose-clear-btn') as HTMLButtonElement;
    const insertBtn = container.querySelector('.wf-compose-insert-btn') as HTMLButtonElement;
    expect(clearBtn.disabled).toBe(true);
    expect(insertBtn.disabled).toBe(true);
  });

  it('shows literal text input when "+ literal text" is clicked', () => {
    render(<ComposeStrip {...defaultProps} />);
    fireEvent.click(screen.getByText('+ literal text'));
    expect(screen.getByPlaceholderText('Type text…')).toBeTruthy();
  });

  it('adds a literal token on Enter', () => {
    const onTokensChange = vi.fn();
    render(<ComposeStrip {...defaultProps} onTokensChange={onTokensChange} />);
    fireEvent.click(screen.getByText('+ literal text'));
    const input = screen.getByPlaceholderText('Type text…');
    fireEvent.change(input, { target: { value: ' — ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTokensChange).toHaveBeenCalledTimes(1);
    const newTokens = onTokensChange.mock.calls[0][0];
    expect(newTokens.length).toBe(1);
    expect(newTokens[0].kind).toBe('literal');
    expect(newTokens[0].value).toBe(' — ');
  });

  it('adds a literal token on Add button click', () => {
    const onTokensChange = vi.fn();
    render(<ComposeStrip {...defaultProps} onTokensChange={onTokensChange} />);
    fireEvent.click(screen.getByText('+ literal text'));
    const input = screen.getByPlaceholderText('Type text…');
    fireEvent.change(input, { target: { value: 'sep' } });
    fireEvent.click(screen.getByText('Add'));
    expect(onTokensChange).toHaveBeenCalledTimes(1);
    expect(onTokensChange.mock.calls[0][0][0].value).toBe('sep');
  });

  it('cancels literal input on Escape', () => {
    render(<ComposeStrip {...defaultProps} />);
    fireEvent.click(screen.getByText('+ literal text'));
    const input = screen.getByPlaceholderText('Type text…');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Type text…')).toBeNull();
  });

  it('cancels literal input on Cancel click', () => {
    render(<ComposeStrip {...defaultProps} />);
    fireEvent.click(screen.getByText('+ literal text'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Type text…')).toBeNull();
  });

  it('does not add empty literal', () => {
    const onTokensChange = vi.fn();
    render(<ComposeStrip {...defaultProps} onTokensChange={onTokensChange} />);
    fireEvent.click(screen.getByText('+ literal text'));
    const input = screen.getByPlaceholderText('Type text…');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTokensChange).not.toHaveBeenCalled();
  });

  it('renders drag handles on tokens', () => {
    const tokens = [makeVarToken('1', 'foo')];
    const { container } = render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(container.querySelector('.wf-compose-token-drag')).toBeTruthy();
  });

  it('tokens are draggable', () => {
    const tokens = [makeVarToken('1', 'foo')];
    const { container } = render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    const token = container.querySelector('.wf-compose-token')!;
    expect(token.getAttribute('draggable')).toBe('true');
  });

  it('reorders tokens on drag and drop', () => {
    const onTokensChange = vi.fn();
    const tokens = [makeVarToken('1', 'first'), makeVarToken('2', 'second')];
    const { container } = render(<ComposeStrip {...defaultProps} tokens={tokens} onTokensChange={onTokensChange} />);
    const tokenEls = container.querySelectorAll('.wf-compose-token');
    // Drag first to second position
    fireEvent.dragStart(tokenEls[0], { dataTransfer: { effectAllowed: 'move', setData: vi.fn() } });
    fireEvent.dragOver(tokenEls[1], { dataTransfer: { dropEffect: 'move' }, preventDefault: vi.fn() });
    fireEvent.drop(tokenEls[1], { dataTransfer: {}, preventDefault: vi.fn() });
    expect(onTokensChange).toHaveBeenCalledTimes(1);
    const reordered = onTokensChange.mock.calls[0][0];
    expect(reordered[0].displayLabel).toBe('second');
    expect(reordered[1].displayLabel).toBe('first');
  });

  it('applies correct CSS class for variable tokens', () => {
    const tokens = [makeVarToken('1', 'foo')];
    const { container } = render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(container.querySelector('.wf-compose-token-variable')).toBeTruthy();
  });

  it('applies correct CSS class for literal tokens', () => {
    const tokens = [makeLitToken('1', 'text')];
    const { container } = render(<ComposeStrip {...defaultProps} tokens={tokens} />);
    expect(container.querySelector('.wf-compose-token-literal')).toBeTruthy();
  });
});

describe('createLiteralId', () => {
  it('returns unique IDs', () => {
    const a = createLiteralId();
    const b = createLiteralId();
    expect(a).not.toBe(b);
    expect(a.startsWith('lit-')).toBe(true);
  });
});
