/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebSocketMessageDiff } from './WebSocketMessageDiff';
import type { WsFrame } from '../../shared/websocket/types';

function makeFrame(overrides: Partial<WsFrame> = {}): WsFrame {
  return {
    id: 'f1',
    direction: 'sent',
    type: 'text',
    data: '{"type":"ok","code":200}',
    size: 24,
    timestamp: '2026-06-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('WebSocketMessageDiff', () => {
  const left = makeFrame({ id: 'l1', data: '{"type":"ok","code":200}', size: 24 });
  const right = makeFrame({
    id: 'r1',
    data: '{"type":"error","code":500,"msg":"fail"}',
    size: 39,
    timestamp: '2026-06-09T10:00:05.000Z',
  });

  it('renders diff modal with header', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.getByTestId('diff-modal')).toBeTruthy();
    expect(screen.getByText('Message Diff')).toBeTruthy();
  });

  it('shows meta with A and B badges', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.getByTestId('diff-meta-left').textContent).toContain('A');
    expect(screen.getByTestId('diff-meta-right').textContent).toContain('B');
  });

  it('shows JSON structural diff summary', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    const summary = screen.getByTestId('diff-summary');
    expect(summary.textContent).toContain('structural change');
  });

  it('shows diff entries for JSON differences', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.getByTestId('diff-entries')).toBeTruthy();
    expect(screen.getByTestId('diff-entry-0')).toBeTruthy();
  });

  it('shows diff content with lines', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.getByTestId('diff-content')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<WebSocketMessageDiff left={left} right={right} onClose={onClose} onSwap={vi.fn()} />);
    fireEvent.click(screen.getByTestId('diff-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSwap when swap button clicked', () => {
    const onSwap = vi.fn();
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={onSwap} />);
    fireEvent.click(screen.getByTestId('diff-swap'));
    expect(onSwap).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<WebSocketMessageDiff left={left} right={right} onClose={onClose} onSwap={vi.fn()} />);
    fireEvent.keyDown(screen.getByTestId('diff-overlay'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows "Messages are identical" for identical messages', () => {
    const same = makeFrame();
    render(<WebSocketMessageDiff left={same} right={same} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.getByTestId('diff-identical')).toBeTruthy();
    expect(screen.getByText('Messages are identical')).toBeTruthy();
  });

  it('handles non-JSON text diff', () => {
    const textLeft = makeFrame({ data: 'hello world' });
    const textRight = makeFrame({ data: 'hello earth' });
    render(<WebSocketMessageDiff left={textLeft} right={textRight} onClose={vi.fn()} onSwap={vi.fn()} />);
    expect(screen.queryByTestId('diff-summary')).toBeNull();
    expect(screen.getByTestId('diff-content')).toBeTruthy();
  });

  it('shows size delta in meta', () => {
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    const metaRight = screen.getByTestId('diff-meta-right');
    expect(metaRight.textContent).toContain('+');
  });

  it('copies unified diff text', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WebSocketMessageDiff left={left} right={right} onClose={vi.fn()} onSwap={vi.fn()} />);
    fireEvent.click(screen.getByTestId('diff-copy'));
    expect(writeText).toHaveBeenCalledOnce();
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('---');
    expect(text).toContain('+++');
    expect(text).toContain('@@ @@');
  });
});
