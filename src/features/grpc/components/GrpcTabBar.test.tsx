/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GrpcTabBar } from './GrpcTabBar';
import type { GrpcStudioTabState } from '../grpcStudioTypes';

function makeTab(id: string, overrides: Partial<GrpcStudioTabState> = {}): GrpcStudioTabState {
  return {
    id,
    title: `Tab ${id}`,
    target: 'localhost:50051',
    tlsMode: 'plaintext',
    lifecycle: 'idle',
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
    body: {},
    metadata: {},
    requestMode: 'form',
    ...overrides,
  } as GrpcStudioTabState;
}

describe('GrpcTabBar', () => {
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

  it('renders tabs and selects on click', () => {
    const onSelect = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('adds tab and closes with stopPropagation', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={onAdd}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-add-tab'));
    expect(onAdd).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId('grpc-tab-close-b'));
    expect(onClose).toHaveBeenCalledWith('b');
  });

  it('duplicates tab and shows call type pill when method bound', () => {
    const onDuplicate = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { service: 'echo.Echo', method: 'Echo' })]}
        activeTabId="a"
        canAddTab
        tabCallTypes={{ a: 'unary' }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={onDuplicate}
        onRename={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-tab-duplicate-a'));
    expect(onDuplicate).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('grpc-tab-call-type-pill-a')).toBeTruthy();
  });

  it('shows tab call count badge when calls have been executed', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        tabCallCounts={{ a: 3 }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-tab-call-count-a').textContent).toContain('=3');
    expect(screen.queryByTestId('grpc-tab-call-count-b')).toBeNull();
  });

  it('renders method subtitle and descriptive tab title when method is selected', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { service: 'echo.v1.EchoService', method: 'Echo' })]}
        activeTabId="a"
        canAddTab
        tabCallCounts={{ a: 2 }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-tab-method-a').textContent).toBe('EchoService/Echo');
    const tab = screen.getByTestId('a');
    expect(tab.getAttribute('title')).toContain('EchoService/Echo');
    expect(tab.getAttribute('title')).toContain('Calls: 2');
  });

  it('supports inline rename via double-click and Enter', () => {
    const onRename = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={onRename}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const input = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('a', 'Renamed');
  });

  it('commits rename on blur and ignores blank values', () => {
    const onRename = vi.fn();
    const { rerender } = render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={onRename}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const input = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Blur Name' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('a', 'Blur Name');

    rerender(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={onRename}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const blankInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(blankInput, { target: { value: '   ' } });
    fireEvent.blur(blankInput);
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('cancels rename on Escape and marks in-flight tabs', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { streamLifecycle: 'streaming' })]}
        activeTabId="a"
        canAddTab={false}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    const input = screen.getByLabelText('Rename tab');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText('Rename tab')).toBeNull();
    expect(screen.getByTestId('a').className).toContain('grpc-tab--in-flight');
    expect(screen.getByTestId('grpc-add-tab')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-tab-duplicate-a')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-tab-close-a')).toHaveProperty('disabled', true);
  });

  it('does not select tab when clicking inside rename input', () => {
    const onSelect = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.doubleClick(screen.getByTestId('a'));
    fireEvent.click(screen.getByLabelText('Rename tab'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('supports keyboard tab selection and rename start', () => {
    const onSelect = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const tabB = screen.getByTestId('b');
    fireEvent.keyDown(tabB, { key: 'Enter' });
    fireEvent.keyDown(tabB, { key: ' ' });
    fireEvent.keyDown(tabB, { key: 'F2' });
    expect(onSelect).toHaveBeenNthCalledWith(1, 'b');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'b');
    expect(screen.getByLabelText('Rename tab')).toBeTruthy();
  });

  it('ignores unrelated keyboard input without side effects', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={onSelect}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'A' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('supports ArrowLeft, ArrowRight, Home, and End focus movement', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b'), makeTab('c')]}
        activeTabId="b"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const tabA = screen.getByTestId('a');
    const tabB = screen.getByTestId('b');
    const tabC = screen.getByTestId('c');
    tabB.focus();
    fireEvent.keyDown(tabB, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabA);
    fireEvent.keyDown(tabA, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabB);
    fireEvent.keyDown(tabB, { key: 'End' });
    expect(document.activeElement).toBe(tabC);
    fireEvent.keyDown(tabC, { key: 'Home' });
    expect(document.activeElement).toBe(tabA);
  });

  it('Delete closes only closable tabs and restores focus after rerender', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const tabA = screen.getByTestId('a');
    tabA.focus();
    fireEvent.keyDown(tabA, { key: 'Delete' });
    expect(onClose).toHaveBeenCalledWith('a');

    rerender(
      <GrpcTabBar
        tabs={[makeTab('b')]}
        activeTabId="b"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByTestId('b'));
  });

  it('clears pending focus when Delete is followed by rerender without shrinking tab count', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    const tabA = screen.getByTestId('a');
    tabA.focus();
    fireEvent.keyDown(tabA, { key: 'Delete' });

    rerender(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="b"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(tabA);
  });

  it('Delete does not close single-tab or in-flight tabs', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'Delete' });
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <GrpcTabBar
        tabs={[makeTab('a', { streamLifecycle: 'streaming' }), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('a'), { key: 'Delete' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('executes drag-and-drop handlers and reorder callback', () => {
    const onReorder = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
        onReorder={onReorder}
      />,
    );
    const tabA = screen.getByTestId('a');
    const tabB = screen.getByTestId('b') as HTMLDivElement;
    const rectSpy = vi.spyOn(tabB, 'getBoundingClientRect').mockReturnValue({
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
      types: ['text/x-grpc-tab-index'],
      setData: vi.fn(),
      getData: vi.fn(() => '0'),
    };

    fireEvent.dragStart(tabA, { dataTransfer });
    fireEvent.dragOver(tabB, { dataTransfer, clientX: 180 });
    fireEvent.dragLeave(tabB, { dataTransfer });
    fireEvent.drop(tabB, { dataTransfer, clientX: 180 });
    fireEvent.dragEnd(tabA);

    expect(onReorder).toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('opens context menu and dispatches rename, duplicate, copy, close, close-others, and close-right', () => {
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    const onCloseOthers = vi.fn();
    const onCloseRight = vi.fn();
    render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b'), makeTab('c')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={onClose}
        onDuplicate={onDuplicate}
        onRename={vi.fn()}
        onCloseOthers={onCloseOthers}
        onCloseRight={onCloseRight}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));
    expect(screen.getByLabelText('Rename tab')).toBeTruthy();

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith('b');

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Tab b');

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
    expect(onClose).toHaveBeenCalledWith('b');

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
    expect(onCloseOthers).toHaveBeenCalledWith('b');

    fireEvent.contextMenu(screen.getByTestId('b'));
    fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
    expect(onCloseRight).toHaveBeenCalledWith('b');
  });

  it('disables menu actions when add is blocked or the tab is not closable', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { streamLifecycle: 'streaming' }), makeTab('b')]}
        activeTabId="a"
        canAddTab={false}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    fireEvent.contextMenu(screen.getByTestId('a'));
    expect((screen.getByTestId('studio-tab-ctx-duplicate') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('studio-tab-ctx-close') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders add button count title and hides method/call-type pill without full method binding', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a', { service: 'echo.v1.EchoService' }), makeTab('b')]}
        activeTabId="a"
        canAddTab
        maxTabs={8}
        tabCallTypes={{ a: 'unary' }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-add-tab').getAttribute('title')).toBe('2 of 8 tabs');
    expect(screen.queryByTestId('grpc-tab-method-a')).toBeNull();
    expect(screen.queryByTestId('grpc-tab-call-type-pill-a')).toBeNull();
  });

  it('uses singular call-count title for exactly one call', () => {
    render(
      <GrpcTabBar
        tabs={[makeTab('a')]}
        activeTabId="a"
        canAddTab
        tabCallCounts={{ a: 1 }}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );
    expect(screen.getByTestId('grpc-tab-call-count-a').getAttribute('title')).toBe('1 call in this tab');
  });

  it('disables close-related menu actions when the targeted tab disappears before render', () => {
    const { rerender } = render(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('b'), makeTab('c')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('b'));
    rerender(
      <GrpcTabBar
        tabs={[makeTab('a'), makeTab('c')]}
        activeTabId="a"
        canAddTab
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    expect((screen.getByTestId('studio-tab-ctx-close') as HTMLButtonElement).disabled).toBe(true);
  });
});
