/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WebSocketMessageDetail } from './WebSocketMessageDetail';
import { buildHexDump, tokenizeJson, isValidJson, prettyJson } from './wsMessageUtils';
import type { WsFrame } from '@shared/websocket/types';

function makeFrame(overrides?: Partial<WsFrame>): WsFrame {
  return {
    id: 'f1',
    direction: 'received',
    type: 'text',
    data: '{"key":"value"}',
    size: 15,
    timestamp: '2026-06-07T12:00:01.234Z',
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<Parameters<typeof WebSocketMessageDetail>[0]>) {
  return {
    frame: makeFrame(),
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    hasPrev: true,
    hasNext: true,
    ...overrides,
  };
}

describe('WebSocketMessageDetail', () => {
  it('renders the detail panel', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    expect(screen.getByTestId('detail-panel')).toBeTruthy();
  });

  it('shows direction, time, and size in header', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const meta = screen.getByTestId('detail-panel').querySelector('.ws-detail-meta');
    expect(meta?.textContent).toContain('Received');
    expect(meta?.textContent).toContain('15 B');
  });

  it('defaults to JSON tab when data is valid JSON', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const jsonTab = screen.getByTestId('tab-json');
    expect(jsonTab.className).toContain('active');
  });

  it('defaults to Raw tab when data is not JSON', () => {
    render(<WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ data: 'plain text' }) })} />);
    expect(screen.queryByTestId('tab-json')).toBeNull();
    const rawTab = screen.getByTestId('tab-raw');
    expect(rawTab.className).toContain('active');
  });

  it('defaults to Hex tab when type is binary', () => {
    render(<WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ type: 'binary', data: 'binary data' }) })} />);
    const hexTab = screen.getByTestId('tab-hex');
    expect(hexTab.className).toContain('active');
  });

  it('shows JSON tab only when data is valid JSON', () => {
    render(<WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ data: 'not json' }) })} />);
    expect(screen.queryByTestId('tab-json')).toBeNull();
    expect(screen.getByTestId('tab-raw')).toBeTruthy();
    expect(screen.getByTestId('tab-hex')).toBeTruthy();
  });

  it('renders pretty-printed JSON with syntax coloring', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const content = screen.getByTestId('detail-content');
    expect(content.querySelector('.ws-json-key')).toBeTruthy();
    expect(content.querySelector('.ws-json-string')).toBeTruthy();
  });

  it('renders raw content when Raw tab is clicked', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('tab-raw'));
    const content = screen.getByTestId('detail-content');
    expect(content.textContent).toBe('{"key":"value"}');
  });

  it('renders hexdump when Hex tab is clicked', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('tab-hex'));
    const content = screen.getByTestId('detail-content');
    expect(content.textContent).toContain('00000000');
  });

  it('calls onClose when × is clicked', () => {
    const props = defaultProps();
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.click(screen.getByTestId('detail-close'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const props = defaultProps();
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onPrev on ArrowUp key', () => {
    const props = defaultProps();
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowUp' });
    expect(props.onPrev).toHaveBeenCalled();
  });

  it('calls onNext on ArrowDown key', () => {
    const props = defaultProps();
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowDown' });
    expect(props.onNext).toHaveBeenCalled();
  });

  it('disables prev/next buttons appropriately', () => {
    render(<WebSocketMessageDetail {...defaultProps({ hasPrev: false, hasNext: false })} />);
    expect((screen.getByTestId('detail-prev') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('detail-next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('toggles word wrap', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const content = screen.getByTestId('detail-content');
    expect(content.className).toContain('wrap');
    fireEvent.click(screen.getByTestId('detail-wrap'));
    expect(screen.getByTestId('detail-content').className).not.toContain('wrap');
  });

  it('renders resize handle', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    expect(screen.getByTestId('detail-resize')).toBeTruthy();
  });

  it('shows sent direction correctly', () => {
    render(<WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ direction: 'sent' }) })} />);
    const meta = screen.getByTestId('detail-panel').querySelector('.ws-detail-meta');
    expect(meta?.textContent).toContain('Sent');
  });
});

describe('buildHexDump', () => {
  it('creates hexdump for short string', () => {
    const result = buildHexDump('Hello');
    expect(result).toContain('00000000');
    expect(result).toContain('48 65 6c 6c 6f');
    expect(result).toContain('|Hello');
  });

  it('handles empty string', () => {
    expect(buildHexDump('')).toBe('(empty)');
  });

  it('replaces control characters with dot', () => {
    const result = buildHexDump('\x00\x01\x02');
    expect(result).toContain('|...');
  });

  it('wraps at 16 bytes per line', () => {
    const result = buildHexDump('ABCDEFGHIJKLMNOPQR');
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('00000000');
    expect(lines[1]).toContain('00000010');
  });
});

describe('tokenizeJson', () => {
  it('identifies keys, strings, numbers, booleans, null', () => {
    const tokens = tokenizeJson('{"name": "test", "count": 42, "active": true, "data": null}');
    const types = tokens.map((t) => t.type);
    expect(types).toContain('key');
    expect(types).toContain('string');
    expect(types).toContain('number');
    expect(types).toContain('bool');
    expect(types).toContain('null');
  });

  it('produces correct key tokens', () => {
    const tokens = tokenizeJson('{"a": 1}');
    const keyTokens = tokens.filter((t) => t.type === 'key');
    expect(keyTokens).toHaveLength(1);
    expect(keyTokens[0].text).toBe('"a"');
  });
});

describe('isValidJson', () => {
  it('returns true for valid JSON', () => {
    expect(isValidJson('{"a":1}')).toBe(true);
    expect(isValidJson('[1,2,3]')).toBe(true);
    expect(isValidJson('"string"')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    expect(isValidJson('not json')).toBe(false);
    expect(isValidJson('{broken')).toBe(false);
  });
});

describe('prettyJson', () => {
  it('formats valid JSON', () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('returns original for invalid JSON', () => {
    expect(prettyJson('not json')).toBe('not json');
  });
});

describe('WebSocketMessageDetail — additional coverage', () => {
  it('copies content to clipboard on copy button click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const props = defaultProps();
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.click(screen.getByTestId('detail-copy'));
    expect(writeText).toHaveBeenCalled();
  });

  it('handles resize via mouse events on resize handle', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const handle = screen.getByTestId('detail-resize');
    // Start resize
    fireEvent.mouseDown(handle, { clientY: 300 });
    // Move mouse
    fireEvent.mouseMove(document, { clientY: 250 });
    // End resize
    fireEvent.mouseUp(document);
    // Panel should still be rendered
    expect(screen.getByTestId('detail-panel')).toBeTruthy();
  });

  it('resets tab when frame changes', () => {
    const { rerender } = render(
      <WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ id: 'f1', data: '{"a":1}' }) })} />
    );
    // Click to Raw tab
    fireEvent.click(screen.getByTestId('tab-raw'));
    expect(screen.getByTestId('tab-raw').className).toContain('active');

    // Change frame - should reset to JSON tab
    rerender(
      <WebSocketMessageDetail {...defaultProps({ frame: makeFrame({ id: 'f2', data: '{"b":2}' }) })} />
    );
    expect(screen.getByTestId('tab-json').className).toContain('active');
  });

  it('shows hex content for binary frame type', () => {
    const frame = makeFrame({ type: 'binary', data: 'AQID' }); // base64 for [1,2,3]
    render(<WebSocketMessageDetail {...defaultProps({ frame })} />);
    // Should default to Hex tab for binary
    const content = screen.getByTestId('detail-content');
    expect(content.textContent).toContain('00000000');
  });

  it('does not call onPrev when hasPrev is false and ArrowUp pressed', () => {
    const props = defaultProps({ hasPrev: false });
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowUp' });
    expect(props.onPrev).not.toHaveBeenCalled();
  });

  it('does not call onNext when hasNext is false and ArrowDown pressed', () => {
    const props = defaultProps({ hasNext: false });
    render(<WebSocketMessageDetail {...props} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowDown' });
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('renders close type frames with raw tab', () => {
    const frame = makeFrame({ type: 'close', data: 'Code: 1000' });
    render(<WebSocketMessageDetail {...defaultProps({ frame })} />);
    // Close frames should default to raw tab (not JSON)
    const rawTab = screen.getByTestId('tab-raw');
    expect(rawTab.className).toContain('active');
  });

  it('renders validation tab when validationResults provided', () => {
    const frame = makeFrame({ data: '{"key":"value"}' });
    const validationResults = [
      {
        schemaId: 'schema-1',
        schemaName: 'Test Schema',
        valid: false,
        errors: [{ path: '/key', keyword: 'type', message: 'expected number' }],
      },
    ];
    render(<WebSocketMessageDetail {...defaultProps({ frame, validationResults })} />);
    expect(screen.getByTestId('tab-validation')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tab-validation'));
    expect(screen.getByTestId('detail-validation')).toBeTruthy();
    expect(screen.getByTestId('detail-validation').textContent).toContain('expected number');
  });

  it('shows valid indicator in validation tab', () => {
    const frame = makeFrame({ data: '{"key":"value"}' });
    const validationResults = [
      { schemaId: 'schema-1', schemaName: 'Test Schema', valid: true, errors: [] },
    ];
    render(<WebSocketMessageDetail {...defaultProps({ frame, validationResults })} />);
    expect(screen.getByTestId('tab-validation').textContent).toContain('✓');
  });

  it('auto-switches from validation tab when results become unavailable', () => {
    const frame = makeFrame({ data: '{"key":"value"}' });
    const validationResults = [
      { schemaId: 'schema-1', schemaName: 'Test Schema', valid: true, errors: [] },
    ];
    const { rerender } = render(
      <WebSocketMessageDetail {...defaultProps({ frame, validationResults })} />,
    );
    fireEvent.click(screen.getByTestId('tab-validation'));
    expect(screen.getByTestId('detail-validation')).toBeTruthy();
    // Remove validation results
    rerender(<WebSocketMessageDetail {...defaultProps({ frame, validationResults: null })} />);
    expect(screen.queryByTestId('detail-validation')).toBeNull();
    // Should switch to JSON tab since data is JSON
    expect(screen.getByTestId('tab-json').className).toContain('active');
  });

  it('renders diff prev button when onDiffPrev provided', () => {
    const onDiffPrev = vi.fn();
    render(<WebSocketMessageDetail {...defaultProps({ onDiffPrev })} />);
    expect(screen.getByTestId('detail-diff-prev')).toBeTruthy();
    fireEvent.click(screen.getByTestId('detail-diff-prev'));
    expect(onDiffPrev).toHaveBeenCalledOnce();
  });

  it('renders diff next button when onDiffNext provided', () => {
    const onDiffNext = vi.fn();
    render(<WebSocketMessageDetail {...defaultProps({ onDiffNext })} />);
    expect(screen.getByTestId('detail-diff-next')).toBeTruthy();
    fireEvent.click(screen.getByTestId('detail-diff-next'));
    expect(onDiffNext).toHaveBeenCalledOnce();
  });

  it('hides diff buttons when not provided', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    expect(screen.queryByTestId('detail-diff-prev')).toBeNull();
    expect(screen.queryByTestId('detail-diff-next')).toBeNull();
  });

  it('copy button calls clipboard API', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WebSocketMessageDetail {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('detail-copy'));
    expect(writeText).toHaveBeenCalled();
  });

  it('handles clipboard write failure gracefully', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    render(<WebSocketMessageDetail {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('detail-copy'));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalled();
  });

  it('does not call onPrev when hasPrev is false', () => {
    const onPrev = vi.fn();
    render(<WebSocketMessageDetail {...defaultProps({ hasPrev: false, onPrev })} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowUp' });
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('does not call onNext when hasNext is false', () => {
    const onNext = vi.fn();
    render(<WebSocketMessageDetail {...defaultProps({ hasNext: false, onNext })} />);
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'ArrowDown' });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows plural validation error count', () => {
    const validationResults = [
      {
        schemaId: 's1',
        schemaName: 'Schema',
        valid: false,
        errors: [
          { path: '/a', keyword: 'type', message: 'bad' },
          { path: '/b', keyword: 'type', message: 'bad' },
        ],
      },
    ];
    render(<WebSocketMessageDetail {...defaultProps({ validationResults })} />);
    fireEvent.click(screen.getByTestId('tab-validation'));
    expect(screen.getByText('2 errors')).toBeTruthy();
  });

  it('falls back to hex tab for binary when validation tab becomes unavailable', () => {
    const frame = makeFrame({ type: 'binary', data: 'deadbeef' });
    const validationResults = [
      { schemaId: 's1', schemaName: 'Schema', valid: true, errors: [] },
    ];
    const { rerender } = render(
      <WebSocketMessageDetail {...defaultProps({ frame, validationResults })} />,
    );
    fireEvent.click(screen.getByTestId('tab-validation'));
    rerender(<WebSocketMessageDetail {...defaultProps({ frame, validationResults: null })} />);
    expect(screen.getByTestId('tab-hex').className).toContain('active');
  });

  it('resize handle triggers resize on mousedown + mousemove', () => {
    render(<WebSocketMessageDetail {...defaultProps()} />);
    const handle = screen.getByTestId('detail-resize');
    act(() => {
      fireEvent.mouseDown(handle, { clientY: 500 });
      const moveEvent = new MouseEvent('mousemove', { clientY: 400 });
      document.dispatchEvent(moveEvent);
      const upEvent = new MouseEvent('mouseup');
      document.dispatchEvent(upEvent);
    });
    expect(screen.getByTestId('detail-panel')).toBeTruthy();
  });
});
