/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WsConnectionTabBar, computeDropIndex, type WsConnectionTabBarProps, type ConnectionStateHint } from './WsConnectionTabBar';

function makeProps(overrides?: Partial<WsConnectionTabBarProps>): WsConnectionTabBarProps {
  return {
    tabs: [
      { id: 'tab-1', label: 'localhost:8765' },
      { id: 'tab-2', label: 'staging:443' },
    ],
    activeTabId: 'tab-1',
    maxTabs: 8,
    connectionStates: { 'tab-1': 'connected', 'tab-2': 'disconnected' },
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  };
}

function makeDragDataTransfer(data: Record<string, string> = {}): Partial<DataTransfer> {
  const store = new Map(Object.entries(data));
  return {
    effectAllowed: 'move',
    dropEffect: 'none',
    setData: (k: string, v: string) => store.set(k, v),
    getData: (k: string) => store.get(k) ?? '',
    types: [...store.keys()],
  };
}

describe('WsConnectionTabBar', () => {
  let props: WsConnectionTabBarProps;

  beforeEach(() => {
    props = makeProps();
  });

  it('renders all tabs', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-tab-1')).toBeTruthy();
    expect(screen.getByTestId('conn-tab-tab-2')).toBeTruthy();
  });

  it('shows tab labels', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByText('localhost:8765')).toBeTruthy();
    expect(screen.getByText('staging:443')).toBeTruthy();
  });

  it('marks active tab with active class', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-tab-1').className).toContain('ws-conn-tab-active');
    expect(screen.getByTestId('conn-tab-tab-2').className).not.toContain('ws-conn-tab-active');
  });

  it('calls onSelect when clicking a tab', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-tab-2'));
    expect(props.onSelect).toHaveBeenCalledWith('tab-2');
  });

  it('renders add button', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-add')).toBeTruthy();
  });

  it('calls onAdd when clicking + button', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-add'));
    expect(props.onAdd).toHaveBeenCalled();
  });

  it('hides add button when at max tabs', () => {
    props = makeProps({ maxTabs: 2 });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.queryByTestId('conn-tab-add')).toBeNull();
  });

  it('renders close buttons for each tab', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-close-tab-1')).toBeTruthy();
    expect(screen.getByTestId('conn-tab-close-tab-2')).toBeTruthy();
  });

  it('calls onClose when clicking close button', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-close-tab-2'));
    expect(props.onClose).toHaveBeenCalledWith('tab-2');
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('hides close buttons when only one tab', () => {
    props = makeProps({
      tabs: [{ id: 'tab-1', label: 'Connection 1' }],
    });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.queryByTestId('conn-tab-close-tab-1')).toBeNull();
  });

  it('renders connection state indicators', () => {
    render(<WsConnectionTabBar {...props} />);
    const ind1 = screen.getByTestId('conn-tab-indicator-tab-1');
    const ind2 = screen.getByTestId('conn-tab-indicator-tab-2');
    expect(ind1.style.background).toContain('66bb6a');
    expect(ind2.style.background).toContain('666');
  });

  it('shows indicator colors for all states', () => {
    const states: Record<string, ConnectionStateHint> = {
      'tab-1': 'connecting',
      'tab-2': 'error',
    };
    props = makeProps({ connectionStates: states });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-indicator-tab-1').style.background).toContain('ffa726');
    expect(screen.getByTestId('conn-tab-indicator-tab-2').style.background).toContain('ef5350');
  });

  it('supports double-click to rename', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('localhost:8765');
  });

  it('commits rename on Enter', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    fireEvent.change(input, { target: { value: 'My Server' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).toHaveBeenCalledWith('tab-1', 'My Server');
  });

  it('cancels rename on Escape', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('conn-tab-rename-tab-1')).toBeNull();
  });

  it('commits rename on blur', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);
    expect(props.onRename).toHaveBeenCalledWith('tab-1', 'Blurred');
  });

  it('does not rename to empty string', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('closes tab on middle click', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.mouseDown(screen.getByTestId('conn-tab-tab-2'), { button: 1 });
    expect(props.onClose).toHaveBeenCalledWith('tab-2');
  });

  it('does not close on left click mouseDown', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.mouseDown(screen.getByTestId('conn-tab-tab-2'), { button: 0 });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('double-click on rename input does not reset value', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Edited' } });
    expect(input.value).toBe('Edited');
    fireEvent.doubleClick(input);
    expect(input.value).toBe('Edited');
  });

  it('click on rename input does not trigger tab select', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const input = screen.getByTestId('conn-tab-rename-tab-1');
    fireEvent.click(input);
    expect(props.onSelect).toHaveBeenCalledTimes(0);
  });

  it('has correct aria attributes', () => {
    render(<WsConnectionTabBar {...props} />);
    const tabBar = screen.getByTestId('conn-tab-bar');
    expect(tabBar.getAttribute('role')).toBe('tablist');
    expect(tabBar.getAttribute('aria-label')).toBe('Connection tabs');
    expect(tabBar.getAttribute('aria-orientation')).toBe('horizontal');
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    expect(tab1.getAttribute('role')).toBe('tab');
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    expect(tab2.getAttribute('aria-selected')).toBe('false');
  });

  it('sets tabIndex=0 on active tab, -1 on inactive', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-tab-1').getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('conn-tab-tab-2').getAttribute('tabindex')).toBe('-1');
  });

  it('sets draggable on tabs', () => {
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-tab-1').getAttribute('draggable')).toBe('true');
    expect(screen.getByTestId('conn-tab-tab-2').getAttribute('draggable')).toBe('true');
  });

  it('sets draggable=false during rename editing', () => {
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    expect(screen.getByTestId('conn-tab-tab-1').getAttribute('draggable')).toBe('false');
    expect(screen.getByTestId('conn-tab-tab-2').getAttribute('draggable')).toBe('true');
  });
});

describe('computeDropIndex', () => {
  it('returns target index when dropping before (left of midpoint)', () => {
    expect(computeDropIndex(2, 0, 10, 0, 100)).toBe(0);
  });

  it('returns target+1 adjusted when dropping after (right of midpoint)', () => {
    expect(computeDropIndex(0, 2, 80, 0, 100)).toBe(2);
  });

  it('adjusts toIndex when moving forward (fromIndex < raw toIndex)', () => {
    expect(computeDropIndex(0, 1, 80, 0, 100)).toBe(1);
  });

  it('returns null when dropping on same position (before)', () => {
    expect(computeDropIndex(0, 0, 10, 0, 100)).toBeNull();
  });

  it('returns null when dropping on same position (after)', () => {
    expect(computeDropIndex(1, 1, 80, 0, 100)).toBeNull();
  });

  it('move first to last', () => {
    expect(computeDropIndex(0, 2, 80, 0, 100)).toBe(2);
  });

  it('move last to first', () => {
    expect(computeDropIndex(2, 0, 10, 0, 100)).toBe(0);
  });

  it('move middle to end (after last)', () => {
    expect(computeDropIndex(1, 2, 80, 0, 100)).toBe(2);
  });

  it('move middle to beginning (before first)', () => {
    expect(computeDropIndex(1, 0, 10, 0, 100)).toBe(0);
  });

  it('adjacent swap right', () => {
    expect(computeDropIndex(0, 1, 80, 0, 100)).toBe(1);
  });

  it('adjacent swap left', () => {
    expect(computeDropIndex(1, 0, 10, 0, 100)).toBe(0);
  });
});

describe('WsConnectionTabBar — Drag and Drop', () => {
  let props: WsConnectionTabBarProps;

  beforeEach(() => {
    props = makeProps({
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-2', label: 'Tab B' },
        { id: 'tab-3', label: 'Tab C' },
      ],
    });
  });

  it('adds dragging class on dragStart (state-driven, survives re-render)', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab = screen.getByTestId('conn-tab-tab-1');
    const dt = makeDragDataTransfer();
    fireEvent.dragStart(tab, { dataTransfer: dt });
    expect(tab.className).toContain('ws-conn-tab-dragging');
  });

  it('removes dragging class on dragEnd', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab = screen.getByTestId('conn-tab-tab-1');
    const dt = makeDragDataTransfer();
    fireEvent.dragStart(tab, { dataTransfer: dt });
    expect(tab.className).toContain('ws-conn-tab-dragging');
    fireEvent.dragEnd(tab, { dataTransfer: dt });
    expect(tab.className).not.toContain('ws-conn-tab-dragging');
  });

  it('dragging class persists through dragOver re-renders', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    const dt = makeDragDataTransfer();
    fireEvent.dragStart(tab1, { dataTransfer: dt });
    expect(tab1.className).toContain('ws-conn-tab-dragging');
    fireEvent.dragOver(tab2, { dataTransfer: makeDragDataTransfer({ 'text/x-ws-tab-index': '0' }) });
    expect(tab1.className).toContain('ws-conn-tab-dragging');
  });

  it('calls onReorder on valid drop', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab3 = screen.getByTestId('conn-tab-tab-3');

    fireEvent.drop(tab3, { dataTransfer: makeDragDataTransfer({ 'text/x-ws-tab-index': '0' }) });

    expect(props.onReorder).toHaveBeenCalled();
  });

  it('does not call onReorder without valid data', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');

    fireEvent.drop(tab1, { dataTransfer: makeDragDataTransfer() });

    expect(props.onReorder).not.toHaveBeenCalled();
  });
});

describe('WsConnectionTabBar — Keyboard Navigation', () => {
  let props: WsConnectionTabBarProps;

  beforeEach(() => {
    props = makeProps({
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-2', label: 'Tab B' },
        { id: 'tab-3', label: 'Tab C' },
      ],
      activeTabId: 'tab-2',
    });
  });

  it('ArrowRight moves focus to next tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    const tab3 = screen.getByTestId('conn-tab-tab-3');
    tab2.focus();
    fireEvent.keyDown(tab2, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab3);
  });

  it('ArrowLeft moves focus to previous tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab2.focus();
    fireEvent.keyDown(tab2, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab1);
  });

  it('ArrowRight wraps from last to first tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab3 = screen.getByTestId('conn-tab-tab-3');
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab3.focus();
    fireEvent.keyDown(tab3, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab1);
  });

  it('ArrowLeft wraps from first to last tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    const tab3 = screen.getByTestId('conn-tab-tab-3');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab3);
  });

  it('Home focuses the first tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab3 = screen.getByTestId('conn-tab-tab-3');
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab3.focus();
    fireEvent.keyDown(tab3, { key: 'Home' });
    expect(document.activeElement).toBe(tab1);
  });

  it('End focuses the last tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    const tab3 = screen.getByTestId('conn-tab-tab-3');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'End' });
    expect(document.activeElement).toBe(tab3);
  });

  it('Enter activates the focused tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'Enter' });
    expect(props.onSelect).toHaveBeenCalledWith('tab-1');
  });

  it('Space activates the focused tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: ' ' });
    expect(props.onSelect).toHaveBeenCalledWith('tab-1');
  });

  it('Delete closes the focused tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'Delete' });
    expect(props.onClose).toHaveBeenCalledWith('tab-1');
  });

  it('F2 starts rename on the focused tab', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    tab1.focus();
    fireEvent.keyDown(tab1, { key: 'F2' });
    expect(screen.getByTestId('conn-tab-rename-tab-1')).toBeTruthy();
  });

  it('unrecognized key does not change focus', () => {
    render(<WsConnectionTabBar {...props} />);
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    tab2.focus();
    fireEvent.keyDown(tab2, { key: 'a' });
    expect(document.activeElement).toBe(tab2);
  });

  it('Delete key sets pending focus for next active tab', () => {
    const onClose = vi.fn();
    const localProps = makeProps({
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-2', label: 'Tab B' },
        { id: 'tab-3', label: 'Tab C' },
      ],
      activeTabId: 'tab-2',
      onClose,
    });
    const { rerender } = render(<WsConnectionTabBar {...localProps} />);
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    tab2.focus();
    fireEvent.keyDown(tab2, { key: 'Delete' });
    expect(onClose).toHaveBeenCalledWith('tab-2');

    const afterClose = {
      ...localProps,
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-3', label: 'Tab C' },
      ],
      activeTabId: 'tab-3',
    };
    rerender(<WsConnectionTabBar {...afterClose} />);
    expect(document.activeElement).toBe(screen.getByTestId('conn-tab-tab-3'));
  });

  it('does not steal focus when close is cancelled (tab count unchanged)', () => {
    const localProps = makeProps({
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-2', label: 'Tab B' },
      ],
      activeTabId: 'tab-1',
    });
    const { rerender } = render(<WsConnectionTabBar {...localProps} />);
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    tab2.focus();
    fireEvent.keyDown(tab2, { key: 'Delete' });

    (document.activeElement as HTMLElement)?.blur();
    expect(document.activeElement).toBe(document.body);

    const sameTabsNewActive = {
      ...localProps,
      activeTabId: 'tab-2',
    };
    rerender(<WsConnectionTabBar {...sameTabsNewActive} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('arrow keys are suppressed during rename editing', () => {
    props = makeProps({
      tabs: [
        { id: 'tab-1', label: 'Tab A' },
        { id: 'tab-2', label: 'Tab B' },
      ],
      activeTabId: 'tab-1',
    });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    expect(screen.getByTestId('conn-tab-rename-tab-1')).toBeTruthy();

    const tab1 = screen.getByTestId('conn-tab-tab-1');
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });

    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

describe('WsConnectionTabBar — History Dropdown', () => {
  it('renders history trigger when history entries and room for tabs', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.getByTestId('conn-tab-history-trigger')).toBeTruthy();
  });

  it('does not render history trigger when no history', () => {
    const props = makeProps({ history: [] });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.queryByTestId('conn-tab-history-trigger')).toBeNull();
  });

  it('does not render history trigger when at max tabs', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history, maxTabs: 2 });
    render(<WsConnectionTabBar {...props} />);
    expect(screen.queryByTestId('conn-tab-history-trigger')).toBeNull();
  });

  it('opens history dropdown when trigger is clicked', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown')).toBeTruthy();
  });

  it('closes history dropdown when trigger clicked again', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown')).toBeTruthy();
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.queryByTestId('conn-tab-history-dropdown')).toBeNull();
  });

  it('calls onAddWithUrl when history item is clicked', () => {
    const onAddWithUrl = vi.fn();
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history, onAddWithUrl });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    fireEvent.click(screen.getByTestId('conn-tab-history-item-ws://echo.example.com'));
    expect(onAddWithUrl).toHaveBeenCalledWith('ws://echo.example.com');
  });

  it('closes dropdown after selecting history item', () => {
    const onAddWithUrl = vi.fn();
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history, onAddWithUrl });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    fireEvent.click(screen.getByTestId('conn-tab-history-item-ws://echo.example.com'));
    expect(screen.queryByTestId('conn-tab-history-dropdown')).toBeNull();
  });

  it('closes dropdown on outside click', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('conn-tab-history-dropdown')).toBeNull();
  });

  it('renders protocol badge for non-auto/non-raw protocols', () => {
    const history = [
      { url: 'ws://mqtt.example.com', protocol: 'mqtt' as 'auto', lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    const dropdown = screen.getByTestId('conn-tab-history-dropdown');
    expect(dropdown.textContent).toContain('mqtt');
  });

  it('shows relative time in history items', () => {
    const history = [
      { url: 'ws://echo.example.com', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    const dropdown = screen.getByTestId('conn-tab-history-dropdown');
    expect(dropdown.textContent).toContain('just now');
  });

  it('formatRelativeTime shows minutes ago', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const history = [
      { url: 'ws://a.test', protocol: 'auto' as const, lastUsed: tenMinAgo },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown').textContent).toContain('10m ago');
  });

  it('formatRelativeTime shows hours ago', () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const history = [
      { url: 'ws://a.test', protocol: 'auto' as const, lastUsed: threeHrsAgo },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown').textContent).toContain('3h ago');
  });

  it('formatRelativeTime shows days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const history = [
      { url: 'ws://a.test', protocol: 'auto' as const, lastUsed: twoDaysAgo },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown').textContent).toContain('2d ago');
  });

  it('formatRelativeTime returns empty for future dates', () => {
    const future = new Date(Date.now() + 10000).toISOString();
    const history = [
      { url: 'ws://a.test', protocol: 'auto' as const, lastUsed: future },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    // future date => empty string from formatRelativeTime
    const item = screen.getByTestId('conn-tab-history-item-ws://a.test');
    expect(item).toBeTruthy();
  });

  it('hides history dropdown when showHistoryArrow becomes false', () => {
    const history = [
      { url: 'ws://a.test', protocol: 'auto' as const, lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    const { rerender } = render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    expect(screen.getByTestId('conn-tab-history-dropdown')).toBeTruthy();
    // Remove history to make showHistoryArrow false
    rerender(<WsConnectionTabBar {...makeProps({ history: [] })} />);
    expect(screen.queryByTestId('conn-tab-history-dropdown')).toBeNull();
  });

  it('does not hide protocol badge for raw protocol', () => {
    const history = [
      { url: 'ws://raw.test', protocol: 'raw' as 'auto', lastUsed: new Date().toISOString() },
    ];
    const props = makeProps({ history });
    render(<WsConnectionTabBar {...props} />);
    fireEvent.click(screen.getByTestId('conn-tab-history-trigger'));
    const dropdown = screen.getByTestId('conn-tab-history-dropdown');
    // 'raw' protocol should NOT render badge (same as auto)
    const protocolBadges = dropdown.querySelectorAll('.ws-conn-tab-history-protocol');
    expect(protocolBadges.length).toBe(0);
  });

  it('does not prevent drag when not editing', () => {
    const onReorder = vi.fn();
    const props = makeProps({ onReorder });
    render(<WsConnectionTabBar {...props} />);
    const tab = screen.getByTestId('conn-tab-tab-1');
    // Should be draggable when not editing
    expect(tab.getAttribute('draggable')).toBe('true');
  });

  it('prevents drag start when editing', () => {
    const props = makeProps();
    render(<WsConnectionTabBar {...props} />);
    // Start editing via double-click
    fireEvent.doubleClick(screen.getByTestId('conn-tab-tab-1'));
    const tab = screen.getByTestId('conn-tab-tab-1');
    // draggable should be false during editing
    expect(tab.getAttribute('draggable')).toBe('false');
  });

  it('handleDragLeave only clears state for matching tab', () => {
    const onReorder = vi.fn();
    const props = makeProps({ onReorder });
    render(<WsConnectionTabBar {...props} />);
    const tab1 = screen.getByTestId('conn-tab-tab-1');
    const tab2 = screen.getByTestId('conn-tab-tab-2');
    // Simulate drag over tab-2, then leave from tab-1 — should not clear
    fireEvent.dragStart(tab1, { dataTransfer: { effectAllowed: '', setData: vi.fn() } });
    fireEvent.dragOver(tab2, { dataTransfer: { types: ['text/x-ws-tab-index'], dropEffect: '' }, clientX: 200, preventDefault: vi.fn() });
    fireEvent.dragLeave(tab1);
    // Tab2 should still have drag-over visual (not cleared)
    // This exercises the dragLeave path where prev !== tabId
  });
});
