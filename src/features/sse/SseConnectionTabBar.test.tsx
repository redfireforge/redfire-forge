/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SseConnectionTabBar, computeDropIndex, type SseConnectionTabBarProps } from './SseConnectionTabBar';
import type { SseConnectionState, SseConnectionTab } from './sseTypes';
import { createDefaultSseTab } from './sseTypes';

function makeTab(id: string, label = `Tab ${id}`): SseConnectionTab {
  return { ...createDefaultSseTab(id, label) };
}

function defaultProps(overrides: Partial<SseConnectionTabBarProps> = {}): SseConnectionTabBarProps {
  return {
    tabs: [makeTab('t1', 'Tab 1'), makeTab('t2', 'Tab 2')],
    activeTabId: 't1',
    connectionStates: {} as Record<string, SseConnectionState>,
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  };
}

describe('SseConnectionTabBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders tab items and add button', () => {
    render(<SseConnectionTabBar {...defaultProps()} />);
    expect(screen.getByTestId('sse-conn-tab-bar')).toBeTruthy();
    const items = screen.getAllByTestId('sse-conn-tab-item');
    expect(items).toHaveLength(2);
    expect(screen.getByTestId('sse-conn-tab-add')).toBeTruthy();
  });

  it('marks the active tab with aria-selected', () => {
    render(<SseConnectionTabBar {...defaultProps()} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    expect(items[0].getAttribute('aria-selected')).toBe('true');
    expect(items[1].getAttribute('aria-selected')).toBe('false');
  });

  it('calls onSelect when a tab is clicked', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.click(items[1]);
    expect(props.onSelect).toHaveBeenCalledWith('t2');
  });

  it('calls onAdd when + button is clicked', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('sse-conn-tab-add'));
    expect(props.onAdd).toHaveBeenCalledOnce();
  });

  it('hides add button when at max tabs', () => {
    const tabs = Array.from({ length: 8 }, (_, i) => makeTab(`t${i}`));
    render(<SseConnectionTabBar {...defaultProps({ tabs })} />);
    expect(screen.queryByTestId('sse-conn-tab-add')).toBeNull();
  });

  it('shows close button only when >1 tab', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1')] })} />);
    expect(screen.queryByTestId('sse-conn-tab-close')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const closeButtons = screen.getAllByTestId('sse-conn-tab-close');
    fireEvent.click(closeButtons[0]);
    expect(props.onClose).toHaveBeenCalledWith('t1');
  });

  it('enters rename mode on double-click', () => {
    render(<SseConnectionTabBar {...defaultProps()} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.doubleClick(items[0]);
    expect(screen.getByTestId('sse-conn-tab-rename')).toBeTruthy();
  });

  it('commits rename on Enter', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getAllByTestId('sse-conn-tab-item')[0]);
    const input = screen.getByTestId('sse-conn-tab-rename') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('t1', 'Renamed');
  });

  it('cancels rename on Escape', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getAllByTestId('sse-conn-tab-item')[0]);
    const input = screen.getByTestId('sse-conn-tab-rename');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('sse-conn-tab-rename')).toBeNull();
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('does not commit blank rename on blur', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getAllByTestId('sse-conn-tab-item')[0]);
    const input = screen.getByTestId('sse-conn-tab-rename');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('keeps rename input open when double-clicking inside the input', () => {
    render(<SseConnectionTabBar {...defaultProps()} />);
    fireEvent.doubleClick(screen.getAllByTestId('sse-conn-tab-item')[0]);
    const input = screen.getByTestId('sse-conn-tab-rename');
    fireEvent.doubleClick(input);
    expect(screen.getByTestId('sse-conn-tab-rename')).toBeTruthy();
  });

  it('does not select the tab when clicking inside the rename input', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getAllByTestId('sse-conn-tab-item')[0]);
    const input = screen.getByTestId('sse-conn-tab-rename');
    fireEvent.click(input);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('closes tab on middle-click', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    fireEvent.mouseDown(screen.getAllByTestId('sse-conn-tab-item')[1], { button: 1 });
    expect(props.onClose).toHaveBeenCalledWith('t2');
  });

  it('renders connection state indicators', () => {
    const states: Record<string, SseConnectionState> = { t1: 'connected', t2: 'error' };
    const { container } = render(<SseConnectionTabBar {...defaultProps({ connectionStates: states })} />);
    const indicators = container.querySelectorAll('.sse-conn-tab-indicator');
    expect(indicators).toHaveLength(2);
  });

  // ── Keyboard navigation ────────────────────────────────────────

  it('navigates with ArrowRight/ArrowLeft', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('navigates with Home and End keys', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')], activeTabId: 't2' })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[1].focus();
    fireEvent.keyDown(items[1], { key: 'End' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('wraps ArrowLeft from first tab and ArrowRight from last tab', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')] })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('moves left from a middle tab to the previous tab', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')], activeTabId: 't2' })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[1].focus();
    fireEvent.keyDown(items[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('does not move focus on Home/End when already at boundary', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')] })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    items[2].focus();
    fireEvent.keyDown(items[2], { key: 'End' });
    expect(document.activeElement).toBe(items[2]);
  });

  it('closes tab on Delete key', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.keyDown(items[0], { key: 'Delete' });
    expect(props.onClose).toHaveBeenCalledWith('t1');
  });

  it('moves focus to the active tab after Delete-triggered close rerender', () => {
    const props = defaultProps();
    const { rerender } = render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'Delete' });
    rerender(
      <SseConnectionTabBar
        {...props}
        tabs={[makeTab('t2', 'Tab 2')]}
        activeTabId="t2"
      />,
    );
    expect(document.activeElement).toBe(screen.getByTestId('sse-conn-tab-item'));
  });

  it('clears pending focus when Delete is followed by rerender without shrinking tab count', () => {
    const props = defaultProps();
    const { rerender } = render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'Delete' });
    rerender(<SseConnectionTabBar {...props} activeTabId="t2" />);
    expect(document.activeElement).toBe(items[0]);
  });

  it('starts rename on F2 key', () => {
    render(<SseConnectionTabBar {...defaultProps()} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.keyDown(items[0], { key: 'F2' });
    expect(screen.getByTestId('sse-conn-tab-rename')).toBeTruthy();
  });

  it('selects tab on Enter key', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.keyDown(items[1], { key: 'Enter' });
    expect(props.onSelect).toHaveBeenCalledWith('t2');
  });

  it('selects tab on Space key and ignores unknown keys', () => {
    const props = defaultProps();
    render(<SseConnectionTabBar {...props} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.keyDown(items[1], { key: ' ' });
    fireEvent.keyDown(items[1], { key: 'A' });
    expect(props.onSelect).toHaveBeenCalledOnce();
    expect(props.onSelect).toHaveBeenCalledWith('t2');
  });

  it('blocks drag start while editing and exercises DnD reorder handlers otherwise', () => {
    const onReorder = vi.fn();
    const { rerender } = render(<SseConnectionTabBar {...defaultProps({ onReorder })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    fireEvent.doubleClick(items[0]);
    fireEvent.dragStart(items[0], {
      preventDefault: vi.fn(),
      dataTransfer: {
        effectAllowed: 'move',
        types: ['text/x-sse-tab-index'],
        setData: vi.fn(),
        getData: vi.fn(() => '0'),
      },
    });

    rerender(<SseConnectionTabBar {...defaultProps({ onReorder })} />);
    const freshItems = screen.getAllByTestId('sse-conn-tab-item');
    const target = freshItems[1] as HTMLDivElement;
    const rectSpy = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      types: ['text/x-sse-tab-index'],
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
    };

    fireEvent.dragStart(freshItems[0], { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer, clientX: 180 });
    fireEvent.dragLeave(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer, clientX: 180 });
    fireEvent.dragEnd(freshItems[0]);

    expect(onReorder).toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('ignores dragOver on the same tab while dragging', () => {
    const onReorder = vi.fn();
    render(<SseConnectionTabBar {...defaultProps({ onReorder })} />);
    const item = screen.getAllByTestId('sse-conn-tab-item')[0] as HTMLDivElement;
    const rectSpy = vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      types: ['text/x-sse-tab-index'],
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
    };

    fireEvent.dragStart(item, { dataTransfer });
    fireEvent.dragOver(item, { dataTransfer, clientX: 100 });
    expect(onReorder).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('ignores dragOver with wrong MIME and drop with invalid source index', () => {
    const onReorder = vi.fn();
    render(<SseConnectionTabBar {...defaultProps({ onReorder })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    const rectSpy = vi.spyOn(items[1], 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });

    fireEvent.dragOver(items[1], {
      dataTransfer: {
        types: ['text/plain'],
      },
      clientX: 10,
    });
    fireEvent.drop(items[1], {
      dataTransfer: {
        getData: vi.fn(() => 'not-a-number'),
      },
      clientX: 10,
    });

    expect(onReorder).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('ignores drop when drag payload is empty', () => {
    const onReorder = vi.fn();
    render(<SseConnectionTabBar {...defaultProps({ onReorder })} />);
    const item = screen.getAllByTestId('sse-conn-tab-item')[1];
    fireEvent.drop(item, {
      dataTransfer: {
        getData: vi.fn(() => ''),
      },
      clientX: 20,
    });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('keeps dragOver state when dragLeave fires for a different tab', () => {
    const onReorder = vi.fn();
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')], onReorder })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    const rectSpy = vi.spyOn(items[1], 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 40,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      types: ['text/x-sse-tab-index'],
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
    };

    fireEvent.dragStart(items[0], { dataTransfer });
    fireEvent.dragOver(items[1], { dataTransfer, clientX: 180 });
    fireEvent.dragLeave(items[2], { dataTransfer });

    expect(items[1].className).toContain('sse-conn-tab-drop-after');
    rectSpy.mockRestore();
  });

  it('retains no drop class when a drag target is not currently active', () => {
    render(<SseConnectionTabBar {...defaultProps({ tabs: [makeTab('t1'), makeTab('t2'), makeTab('t3')] })} />);
    const items = screen.getAllByTestId('sse-conn-tab-item');
    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      types: ['text/x-sse-tab-index'],
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
    };

    fireEvent.dragStart(items[0], { dataTransfer });
    expect(items[2].className).not.toContain('sse-conn-tab-drop-before');
    expect(items[2].className).not.toContain('sse-conn-tab-drop-after');
  });

  it('opens context menu and dispatches rename, duplicate, copy label, close, close-others, and close-right', () => {
    const onClose = vi.fn();
    const onDuplicate = vi.fn();
    const onRename = vi.fn();
    render(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1'), makeTab('t2', 'Tab 2'), makeTab('t3', 'Tab 3')],
          connectionStates: { t1: 'idle', t2: 'idle', t3: 'idle' },
          onClose,
          onRename,
          onDuplicate,
        })}
      />,
    );

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));
    expect(screen.getByTestId('sse-conn-tab-rename')).toBeTruthy();

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith('t2');

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Tab 2');

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
    expect(onClose).toHaveBeenCalledWith('t2');

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
    expect(onClose).toHaveBeenCalledWith('t1');
    expect(onClose).toHaveBeenCalledWith('t3');

    onClose.mockClear();
    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
    expect(onClose).toHaveBeenCalledWith('t3');
  });

  it('context menu close filters skip connected and connecting tabs', () => {
    const onClose = vi.fn();
    render(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1'), makeTab('t2', 'Tab 2'), makeTab('t3', 'Tab 3'), makeTab('t4', 'Tab 4')],
          connectionStates: { t1: 'connected', t2: 'idle', t3: 'connecting', t4: 'error' },
          onClose,
        })}
      />,
    );

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('t4');

    onClose.mockClear();
    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('t4');
  });

  it('disables duplicate when at max tabs and close-right for the last tab', () => {
    const tabs = Array.from({ length: 8 }, (_, i) => makeTab(`t${i + 1}`, `Tab ${i + 1}`));
    render(
      <SseConnectionTabBar
        {...defaultProps({
          tabs,
          activeTabId: 't8',
          onDuplicate: vi.fn(),
        })}
      />,
    );

    const lastItem = screen.getAllByTestId('sse-conn-tab-item')[7];
    fireEvent.contextMenu(lastItem);
    expect((screen.getByTestId('studio-tab-ctx-duplicate') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('studio-tab-ctx-close-right') as HTMLButtonElement).disabled).toBe(true);
  });

  it('ignores context-menu actions when the selected tab disappears before action dispatch', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1'), makeTab('t2', 'Tab 2')],
          onClose,
          onDuplicate: vi.fn(),
        })}
      />,
    );

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    rerender(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1')],
          activeTabId: 't1',
          onClose,
          onDuplicate: vi.fn(),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores an enabled context-menu action when the selected tab disappears before dispatch', () => {
    const onDuplicate = vi.fn();
    const { rerender } = render(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1'), makeTab('t2', 'Tab 2'), makeTab('t3', 'Tab 3')],
          onDuplicate,
        })}
      />,
    );

    fireEvent.contextMenu(screen.getAllByTestId('sse-conn-tab-item')[1]);
    rerender(
      <SseConnectionTabBar
        {...defaultProps({
          tabs: [makeTab('t1', 'Tab 1'), makeTab('t3', 'Tab 3')],
          activeTabId: 't1',
          onDuplicate,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
    expect(onDuplicate).not.toHaveBeenCalled();
  });
});

describe('computeDropIndex', () => {
  it('returns null when from and to are the same', () => {
    expect(computeDropIndex(0, 0, 50, 0, 100)).toBeNull();
  });

  it('returns the correct index for left-half drop', () => {
    expect(computeDropIndex(0, 2, 40, 0, 100)).toBe(1);
  });

  it('returns the correct index for right-half drop', () => {
    expect(computeDropIndex(0, 1, 80, 0, 100)).toBe(1);
  });
});
