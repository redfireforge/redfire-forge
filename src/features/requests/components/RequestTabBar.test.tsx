/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequestTabBar, type RequestTabBarProps } from './RequestTabBar';
import type { RequestTab } from '../../../shared/types';
import { REQUEST_MAX_TABS } from '../../../shared/types/requests';

// ── Factories ──────────────────────────────────────────────────

let _id = 0;
function makeTab(overrides: Partial<RequestTab> = {}): RequestTab {
  const id = `tab-${++_id}`;
  return {
    id,
    collectionId: 'c1',
    requestId: `req-${_id}`,
    label: `Tab ${_id}`,
    activeSubTab: 'params',
    responseSubTab: 'preview',
    inputMode: 'builder',
    ...overrides,
  };
}

function renderBar(overrides: Partial<RequestTabBarProps> = {}) {
  const defaultProps: RequestTabBarProps = {
    tabs: [makeTab({ id: 't1', requestId: 'r1', label: 'Get Users' })],
    activeTabId: 't1',
    methodByRequestId: { r1: 'GET' },
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
    ...overrides,
  };
  return { ...render(<RequestTabBar {...defaultProps} />), props: defaultProps };
}

beforeEach(() => { _id = 0; });

// ── Tests ──────────────────────────────────────────────────────

describe('RequestTabBar', () => {
  describe('rendering', () => {
    it('renders tablist with role and aria-label', () => {
      renderBar();
      const tablist = screen.getByRole('tablist', { name: 'Request tabs' });
      expect(tablist).toBeInTheDocument();
    });

    it('renders each tab with method badge and label', () => {
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'Get Users' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'Create Post' }),
        ],
        activeTabId: 't1',
        methodByRequestId: { r1: 'GET', r2: 'POST' },
      });

      const tabs = screen.getAllByTestId('req-tab-item');
      expect(tabs).toHaveLength(2);

      expect(within(tabs[0]).getByText('GET')).toBeInTheDocument();
      expect(within(tabs[0]).getByText('Get Users')).toBeInTheDocument();

      expect(within(tabs[1]).getByText('POST')).toBeInTheDocument();
      expect(within(tabs[1]).getByText('Create Post')).toBeInTheDocument();
    });

    it('marks the active tab with aria-selected and CSS class', () => {
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't2',
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1].className).toContain('req-tab-bar__tab--active');
    });

    it('defaults to GET method when not specified', () => {
      renderBar({ methodByRequestId: {} });
      expect(screen.getByText('GET')).toBeInTheDocument();
    });

    it('shows counter in the + button', () => {
      renderBar();
      const addBtn = screen.getByTestId('req-tab-add');
      expect(addBtn.textContent).toContain(`1/${REQUEST_MAX_TABS}`);
    });
  });

  describe('close button', () => {
    it('hides close button when only 1 tab', () => {
      renderBar();
      expect(screen.queryByTestId('req-tab-close')).not.toBeInTheDocument();
    });

    it('shows close button when 2+ tabs', () => {
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
      });
      expect(screen.getAllByTestId('req-tab-close')).toHaveLength(2);
    });

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
        onClose,
      });
      fireEvent.click(screen.getAllByTestId('req-tab-close')[1]);
      expect(onClose).toHaveBeenCalledWith('t2');
    });

    it('close click does not trigger onSelect', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
        onSelect,
        onClose,
      });
      fireEvent.click(screen.getAllByTestId('req-tab-close')[1]);
      expect(onClose).toHaveBeenCalledWith('t2');
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('select', () => {
    it('calls onSelect when inactive tab is clicked', () => {
      const onSelect = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
        onSelect,
      });
      fireEvent.click(screen.getAllByTestId('req-tab-item')[1]);
      expect(onSelect).toHaveBeenCalledWith('t2');
    });
  });

  describe('add', () => {
    it('calls onAdd when + button is clicked', () => {
      const onAdd = vi.fn();
      renderBar({ onAdd });
      fireEvent.click(screen.getByTestId('req-tab-add'));
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('disables + button at REQUEST_MAX_TABS', () => {
      const tabs = Array.from({ length: REQUEST_MAX_TABS }, (_, i) =>
        makeTab({ id: `t${i}`, requestId: `r${i}`, label: `Tab ${i}` }),
      );
      renderBar({ tabs, activeTabId: 't0' });
      expect(screen.getByTestId('req-tab-add')).toBeDisabled();
    });
  });

  describe('rename (double-click)', () => {
    it('shows input on double-click and commits on Enter', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      const tab = screen.getByTestId('req-tab-item');
      fireEvent.doubleClick(tab);

      const input = screen.getByLabelText('Rename tab');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith('t1', 'Renamed');
    });

    it('cancels rename on Escape', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));

      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'X' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Rename tab')).not.toBeInTheDocument();
    });

    it('commits rename on blur', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));

      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'Blurred' } });
      fireEvent.blur(input);
      expect(onRename).toHaveBeenCalledWith('t1', 'Blurred');
    });

    it('truncates to 40 characters', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));

      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'A'.repeat(60) } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith('t1', 'A'.repeat(40));
    });

    it('Enter during rename does not trigger onSelect', () => {
      const onSelect = vi.fn();
      const onRename = vi.fn();
      renderBar({ onSelect, onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));

      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'X' } });
      onSelect.mockClear();
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not commit empty/whitespace-only name', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));

      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).not.toHaveBeenCalled();
    });

    it('ignores non-commit keys while editing', () => {
      const onRename = vi.fn();
      renderBar({ onRename });
      fireEvent.doubleClick(screen.getByTestId('req-tab-item'));
      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'Still Editing' } });
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Rename tab')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    function setupThreeTabs() {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
          makeTab({ id: 't3', requestId: 'r3', label: 'C' }),
        ],
        activeTabId: 't2',
        onSelect,
        onClose,
      });
      return { onSelect, onClose };
    }

    it('ArrowRight moves focus to next tab', () => {
      setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[2]);
    });

    it('ArrowRight wraps from last to first', () => {
      setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('ArrowLeft moves focus to previous tab', () => {
      setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('Home moves focus to first tab', () => {
      setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[1], { key: 'Home' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('End moves focus to last tab', () => {
      setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[0], { key: 'End' });
      expect(document.activeElement).toBe(tabs[2]);
    });

    it('Delete closes the tab', () => {
      const { onClose } = setupThreeTabs();
      const tab = screen.getAllByTestId('req-tab-item')[1]; // t2
      fireEvent.keyDown(tab, { key: 'Delete' });
      expect(onClose).toHaveBeenCalledWith('t2');
    });

    it('Delete does not close when only one tab exists', () => {
      const onClose = vi.fn();
      renderBar({
        tabs: [makeTab({ id: 't1', requestId: 'r1', label: 'Only' })],
        activeTabId: 't1',
        onClose,
      });
      fireEvent.keyDown(screen.getByTestId('req-tab-item'), { key: 'Delete' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Enter and Space select tab from keyboard', () => {
      const onSelect = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
        onSelect,
      });
      const second = screen.getAllByTestId('req-tab-item')[1];
      fireEvent.keyDown(second, { key: 'Enter' });
      fireEvent.keyDown(second, { key: ' ' });
      expect(onSelect).toHaveBeenNthCalledWith(1, 't2');
      expect(onSelect).toHaveBeenNthCalledWith(2, 't2');
    });

    it('F2 starts inline rename and unknown keys are ignored', () => {
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
      });
      const first = screen.getAllByTestId('req-tab-item')[0];
      fireEvent.keyDown(first, { key: 'F2' });
      expect(screen.getByLabelText('Rename tab')).toBeInTheDocument();
      fireEvent.keyDown(first, { key: 'Tab' });
      expect(screen.getByLabelText('Rename tab')).toBeInTheDocument();
    });

    it('Home and End on boundary tabs do not trigger selection', () => {
      const { onSelect } = setupThreeTabs();
      const tabs = screen.getAllByTestId('req-tab-item');
      fireEvent.keyDown(tabs[0], { key: 'Home' });
      fireEvent.keyDown(tabs[2], { key: 'End' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('ignores tab keyboard shortcuts while editing', () => {
      const onSelect = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
        onSelect,
      });
      fireEvent.doubleClick(screen.getAllByTestId('req-tab-item')[0]);
      fireEvent.keyDown(screen.getAllByTestId('req-tab-item')[0], { key: 'ArrowRight' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('safely handles pending delete focus when tab count does not shrink', () => {
      const { rerender, props } = renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
      });
      fireEvent.keyDown(screen.getAllByTestId('req-tab-item')[0], { key: 'Delete' });
      rerender(<RequestTabBar {...props} />);
      expect(screen.getAllByTestId('req-tab-item')).toHaveLength(2);
    });
  });

  describe('context menu actions', () => {
    it('renames and duplicates from context menu actions', () => {
      const onRename = vi.fn();
      const onDuplicate = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'Alpha' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'Beta' }),
        ],
        activeTabId: 't1',
        onRename,
        onDuplicate,
      });

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[0]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));
      const input = screen.getByLabelText('Rename tab');
      fireEvent.change(input, { target: { value: 'Renamed via menu' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith('t1', 'Renamed via menu');

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[0]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-duplicate'));
      expect(onDuplicate).toHaveBeenCalledWith('t1');
    });

    it('copies label to clipboard and handles close variants', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const onClose = vi.fn();
      const onCloseOthers = vi.fn();
      const onCloseRight = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'Alpha' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'Beta' }),
          makeTab({ id: 't3', requestId: 'r3', label: 'Gamma' }),
        ],
        activeTabId: 't2',
        onClose,
        onCloseOthers,
        onCloseRight,
      });

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[1]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
      expect(writeText).toHaveBeenCalledWith('Beta');

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[1]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close'));
      expect(onClose).toHaveBeenCalledWith('t2');

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[1]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close-others'));
      expect(onCloseOthers).toHaveBeenCalledWith('t2');

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[1]);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-close-right'));
      expect(onCloseRight).toHaveBeenCalledWith('t2');
    });

    it('keeps rename action safe when context tab disappears before action', () => {
      const onRename = vi.fn();
      const { rerender, props } = renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'Alpha' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'Beta' }),
        ],
        activeTabId: 't1',
        onRename,
      });

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[0]);
      rerender(<RequestTabBar {...props} tabs={[]} activeTabId="" />);

      fireEvent.click(screen.getByTestId('studio-tab-ctx-rename'));

      expect(onRename).not.toHaveBeenCalled();
    });

    it('does not copy label when context tab disappears before copy action', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const { rerender, props } = renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'Alpha' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'Beta' }),
        ],
        activeTabId: 't1',
      });

      fireEvent.contextMenu(screen.getAllByTestId('req-tab-item')[0]);
      rerender(<RequestTabBar {...props} tabs={[]} activeTabId="" />);
      fireEvent.click(screen.getByTestId('studio-tab-ctx-copy-label'));
      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe('drag and drop', () => {
    it('reorders tabs when dropped on another tab', () => {
      const onReorder = vi.fn();
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
          makeTab({ id: 't3', requestId: 'r3', label: 'C' }),
        ],
        activeTabId: 't1',
        onReorder,
      });

      const tabs = screen.getAllByTestId('req-tab-item');
      const dt = {
        effectAllowed: '',
        dropEffect: '',
        types: ['text/x-req-tab-index'],
        setData: vi.fn(),
        getData: vi.fn().mockReturnValue('0'),
      };

      fireEvent.dragStart(tabs[0], { dataTransfer: dt });
      fireEvent.dragOver(tabs[1], { dataTransfer: dt, clientX: 9999 });
      fireEvent.drop(tabs[1], { dataTransfer: dt, clientX: 9999 });
      expect(onReorder).toHaveBeenCalled();
    });

    it('blocks drag start while tab is in edit mode', () => {
      renderBar({
        tabs: [
          makeTab({ id: 't1', requestId: 'r1', label: 'A' }),
          makeTab({ id: 't2', requestId: 'r2', label: 'B' }),
        ],
        activeTabId: 't1',
      });

      fireEvent.doubleClick(screen.getAllByTestId('req-tab-item')[0]);
      const dt = {
        effectAllowed: '',
        dropEffect: '',
        types: ['text/x-req-tab-index'],
        setData: vi.fn(),
        getData: vi.fn(),
      };

      fireEvent.dragStart(screen.getAllByTestId('req-tab-item')[0], {
        dataTransfer: dt,
        preventDefault: vi.fn(),
      });
      expect(dt.setData).not.toHaveBeenCalled();
    });
  });

  describe('method badge colors', () => {
    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s badge renders inline color style',
      (method) => {
        renderBar({
          tabs: [makeTab({ id: 't1', requestId: 'r1', label: 'Test' })],
          activeTabId: 't1',
          methodByRequestId: { r1: method },
        });
        const badge = screen.getByLabelText(method);
        expect(badge.style.color).toBeTruthy();
        expect(badge.textContent).toBe(method);
      },
    );

    it('falls back to slate color for unknown methods', () => {
      renderBar({
        tabs: [makeTab({ id: 't1', requestId: 'r1', label: 'Test' })],
        activeTabId: 't1',
        methodByRequestId: { r1: 'BREW' },
      });
      expect(screen.getByLabelText('BREW')).toHaveStyle({ color: '#94a3b8' });
    });
  });
});
