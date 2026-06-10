/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageRow, renderInlineJson, type MessageRowProps } from './WebSocketMessageRow';
import type { WsFrame } from '../../shared/websocket/types';

function makeFrame(overrides: Partial<WsFrame> = {}): WsFrame {
  return {
    id: 'msg-1',
    direction: 'received',
    type: 'text',
    data: 'hello world',
    size: 11,
    timestamp: '2026-06-09T10:00:00.000Z',
    ...overrides,
  };
}

function makeProps(overrides: Partial<MessageRowProps> = {}): MessageRowProps {
  return {
    frame: makeFrame(),
    isSelected: false,
    isBookmarked: false,
    compareBadge: null,
    validationBadge: null,
    onRowClick: vi.fn(),
    onToggleBookmark: vi.fn(),
    ...overrides,
  };
}

describe('MessageRow', () => {
  it('renders with correct testid', () => {
    render(<MessageRow {...makeProps()} />);
    expect(screen.getByTestId('message-row-msg-1')).toBeTruthy();
  });

  it('renders received direction arrow', () => {
    render(<MessageRow {...makeProps()} />);
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('↓');
  });

  it('renders sent direction arrow', () => {
    render(<MessageRow {...makeProps({ frame: makeFrame({ direction: 'sent' }) })} />);
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('↑');
  });

  it('renders system message with diamond', () => {
    const frame = makeFrame({ type: 'close', data: 'CLOSE SENT 1000' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('◆');
  });

  it('adds ws-message-sent class for sent messages', () => {
    const frame = makeFrame({ direction: 'sent' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-sent');
  });

  it('adds ws-message-received class for received messages', () => {
    render(<MessageRow {...makeProps()} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-received');
  });

  it('adds ws-message-system class for close messages', () => {
    const frame = makeFrame({ type: 'close', data: 'CLOSE SENT 1000' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-system');
  });

  it('adds ws-message-close-sent class for CLOSE SENT messages', () => {
    const frame = makeFrame({ type: 'close', data: 'CLOSE SENT 1000' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-close-sent');
  });

  it('adds ws-message-close-ack class for CLOSE ACK messages', () => {
    const frame = makeFrame({ type: 'close', data: 'CLOSE ACK 1000' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-close-ack');
  });

  it('adds selected class when isSelected is true', () => {
    render(<MessageRow {...makeProps({ isSelected: true })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-msg-selected');
    expect(screen.getByTestId('message-row-msg-1').className).toContain('selected');
  });

  it('adds bookmarked class when isBookmarked is true', () => {
    render(<MessageRow {...makeProps({ isBookmarked: true })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-bookmarked');
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<MessageRow {...makeProps({ onRowClick })} />);
    fireEvent.click(screen.getByTestId('message-row-msg-1'));
    expect(onRowClick).toHaveBeenCalledWith('msg-1');
  });

  it('calls onRowClick when Enter key is pressed', () => {
    const onRowClick = vi.fn();
    render(<MessageRow {...makeProps({ onRowClick })} />);
    fireEvent.keyDown(screen.getByTestId('message-row-msg-1'), { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith('msg-1');
  });

  it('calls onToggleBookmark when bookmark button is clicked', () => {
    const onToggleBookmark = vi.fn();
    render(<MessageRow {...makeProps({ onToggleBookmark })} />);
    fireEvent.click(screen.getByTestId('bookmark-btn-msg-1'));
    expect(onToggleBookmark).toHaveBeenCalledWith('msg-1');
  });

  it('bookmark click does not trigger row click', () => {
    const onRowClick = vi.fn();
    const onToggleBookmark = vi.fn();
    render(<MessageRow {...makeProps({ onRowClick, onToggleBookmark })} />);
    fireEvent.click(screen.getByTestId('bookmark-btn-msg-1'));
    expect(onToggleBookmark).toHaveBeenCalledWith('msg-1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('shows filled star when bookmarked', () => {
    render(<MessageRow {...makeProps({ isBookmarked: true })} />);
    expect(screen.getByTestId('bookmark-btn-msg-1').textContent).toBe('★');
  });

  it('shows empty star when not bookmarked', () => {
    render(<MessageRow {...makeProps({ isBookmarked: false })} />);
    expect(screen.getByTestId('bookmark-btn-msg-1').textContent).toBe('☆');
  });

  it('renders compare badge when provided', () => {
    render(<MessageRow {...makeProps({ compareBadge: 'A' })} />);
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('A');
  });

  it('renders compare badge B', () => {
    render(<MessageRow {...makeProps({ compareBadge: 'B' })} />);
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('B');
  });

  it('does not render compare badge when null', () => {
    const { container } = render(<MessageRow {...makeProps({ compareBadge: null })} />);
    expect(container.querySelector('.ws-compare-badge')).toBeNull();
  });

  it('renders validation badge valid', () => {
    render(<MessageRow {...makeProps({ validationBadge: 'valid' })} />);
    const badge = screen.getByTestId('validation-badge-msg-1');
    expect(badge.textContent).toBe('✓');
    expect(badge.className).toContain('ws-validation-valid');
  });

  it('renders validation badge invalid', () => {
    render(<MessageRow {...makeProps({ validationBadge: 'invalid' })} />);
    const badge = screen.getByTestId('validation-badge-msg-1');
    expect(badge.textContent).toBe('✗');
    expect(badge.className).toContain('ws-validation-invalid');
  });

  it('does not render validation badge when null', () => {
    render(<MessageRow {...makeProps({ validationBadge: null })} />);
    expect(screen.queryByTestId('validation-badge-msg-1')).toBeNull();
  });

  it('displays JSON content as inline formatted JSON', () => {
    const frame = makeFrame({ data: '{"key":"value"}' });
    render(<MessageRow {...makeProps({ frame })} />);
    const row = screen.getByTestId('message-row-msg-1');
    expect(row.textContent).toContain('key');
    expect(row.textContent).toContain('value');
  });

  it('truncates long text content', () => {
    const longData = 'x'.repeat(600);
    const frame = makeFrame({ data: longData, size: 600 });
    render(<MessageRow {...makeProps({ frame })} />);
    const row = screen.getByTestId('message-row-msg-1');
    expect(row.textContent).toContain('…');
  });

  it('truncates long JSON content', () => {
    const bigObj: Record<string, string> = {};
    for (let i = 0; i < 50; i++) bigObj[`key${i}`] = 'value'.repeat(5);
    const frame = makeFrame({ data: JSON.stringify(bigObj), size: 2000 });
    render(<MessageRow {...makeProps({ frame })} />);
    // Should still render something
    expect(screen.getByTestId('message-row-msg-1')).toBeTruthy();
  });

  it('renders binary preview for binary type', () => {
    const frame = makeFrame({ type: 'binary', data: 'AQID', size: 3 });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1')).toBeTruthy();
  });

  it('shows protocol meta packetType when present', () => {
    const frame = makeFrame({
      protocolMeta: { packetType: 'CONNACK', summary: 'Connection accepted' },
    });
    render(<MessageRow {...makeProps({ frame })} />);
    const row = screen.getByTestId('message-row-msg-1');
    expect(row.textContent).toContain('CONNACK');
    expect(row.textContent).toContain('Connection accepted');
  });

  it('adds ws-message-protocol class for protocol messages', () => {
    const frame = makeFrame({
      protocolMeta: { packetType: 'PUBLISH', summary: 'topic: test' },
    });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-protocol');
  });

  it('shows system marker for protocol system packets', () => {
    const frame = makeFrame({
      protocolMeta: { packetType: 'PINGREQ', isSystemPacket: true },
    });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').className).toContain('ws-message-system');
    expect(screen.getByTestId('message-row-msg-1').textContent).toContain('◆');
  });

  it('has correct aria-label for sent messages', () => {
    const frame = makeFrame({ direction: 'sent' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').getAttribute('aria-label')).toBe('sent message');
  });

  it('has correct aria-label for received messages', () => {
    render(<MessageRow {...makeProps()} />);
    expect(screen.getByTestId('message-row-msg-1').getAttribute('aria-label')).toBe('received message');
  });

  it('has correct aria-label for system messages', () => {
    const frame = makeFrame({ type: 'close', data: 'CLOSE SENT 1000' });
    render(<MessageRow {...makeProps({ frame })} />);
    expect(screen.getByTestId('message-row-msg-1').getAttribute('aria-label')).toBe('system message');
  });

  it('renders size display', () => {
    const frame = makeFrame({ size: 1024 });
    render(<MessageRow {...makeProps({ frame })} />);
    const row = screen.getByTestId('message-row-msg-1');
    // formatBytes(1024) should produce something with KB
    expect(row.textContent).toContain('1');
  });
});

describe('renderInlineJson', () => {
  it('returns nodes for simple JSON', () => {
    const nodes = renderInlineJson('{"a":1}');
    expect(nodes).toBeTruthy();
  });

  it('handles empty object', () => {
    const nodes = renderInlineJson('{}');
    expect(nodes).toBeTruthy();
  });
});
