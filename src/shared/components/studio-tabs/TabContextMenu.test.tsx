/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TabContextMenu, buildContextMenuItems } from './TabContextMenu';

describe('buildContextMenuItems', () => {
  it('marks close as disabled when canClose is false', () => {
    const items = buildContextMenuItems({
      tabId: 't1',
      tabLabel: 'Tab 1',
      tabIndex: 0,
      totalTabs: 1,
      canDuplicate: true,
      canClose: false,
    });
    const closeItem = items.find((i) => i.id === 'close');
    expect(closeItem?.disabled).toBe(true);
  });

  it('marks close-others as disabled when only 1 tab', () => {
    const items = buildContextMenuItems({
      tabId: 't1',
      tabLabel: 'Tab 1',
      tabIndex: 0,
      totalTabs: 1,
      canDuplicate: true,
      canClose: false,
    });
    const item = items.find((i) => i.id === 'close-others');
    expect(item?.disabled).toBe(true);
  });

  it('marks close-right as disabled when tab is last', () => {
    const items = buildContextMenuItems({
      tabId: 't2',
      tabLabel: 'Tab 2',
      tabIndex: 2,
      totalTabs: 3,
      canDuplicate: true,
      canClose: true,
    });
    const item = items.find((i) => i.id === 'close-right');
    expect(item?.disabled).toBe(true);
  });

  it('enables close-right when tabs exist to the right', () => {
    const items = buildContextMenuItems({
      tabId: 't1',
      tabLabel: 'Tab 1',
      tabIndex: 0,
      totalTabs: 3,
      canDuplicate: true,
      canClose: true,
    });
    const item = items.find((i) => i.id === 'close-right');
    expect(item?.disabled).toBe(false);
  });

  it('marks duplicate as disabled when canDuplicate is false', () => {
    const items = buildContextMenuItems({
      tabId: 't1',
      tabLabel: 'Tab 1',
      tabIndex: 0,
      totalTabs: 1,
      canDuplicate: false,
      canClose: false,
    });
    const item = items.find((i) => i.id === 'duplicate');
    expect(item?.disabled).toBe(true);
  });
});

describe('TabContextMenu', () => {
  it('renders menu items and fires onAction', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        x={100}
        y={200}
        items={[
          { id: 'rename', label: 'Rename Tab' },
          { id: 'close', label: 'Close Tab' },
        ]}
        onAction={onAction}
        onClose={onClose}
      />,
    );

    expect(screen.getByTestId('studio-tab-ctx-menu')).toBeInTheDocument();
    expect(screen.getByText('Rename Tab')).toBeInTheDocument();
    expect(screen.getByText('Close Tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rename Tab'));
    expect(onAction).toHaveBeenCalledWith('rename');
  });

  it('closes on Escape key', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        x={0}
        y={0}
        items={[{ id: 'close', label: 'Close' }]}
        onAction={onAction}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <TabContextMenu
          x={0}
          y={0}
          items={[{ id: 'close', label: 'Close' }]}
          onAction={vi.fn()}
          onClose={onClose}
        />
      </div>,
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders dividers for items with dividerBefore', () => {
    render(
      <TabContextMenu
        x={0}
        y={0}
        items={[
          { id: 'rename', label: 'Rename' },
          { id: 'close', label: 'Close', dividerBefore: true },
        ]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
});
