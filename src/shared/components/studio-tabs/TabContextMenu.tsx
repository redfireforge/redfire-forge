import { useCallback, useEffect, useRef, useState, type ReactNode, type MouseEvent as RMouseEvent } from 'react';

export interface TabContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  dividerBefore?: boolean;
}

export interface TabContextMenuProps {
  x: number;
  y: number;
  items: TabContextMenuItem[];
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export function TabContextMenu({ x, y, items, onAction, onClose }: TabContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${Math.max(0, vw - rect.width - 4)}px`;
    if (rect.bottom > vh) el.style.top = `${Math.max(0, vh - rect.height - 4)}px`;
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="studio-tab-ctx-menu"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="studio-tab-ctx-menu"
    >
      {items.map((item) => (
        <ContextMenuItem key={item.id} item={item} onAction={onAction} />
      ))}
    </div>
  );
}

function ContextMenuItem({ item, onAction }: { item: TabContextMenuItem; onAction: (id: string) => void }) {
  return (
    <>
      {item.dividerBefore && <div className="studio-tab-ctx-divider" role="separator" />}
      <button
        type="button"
        role="menuitem"
        className={`studio-tab-ctx-item${item.danger ? ' studio-tab-ctx-item--danger' : ''}`}
        disabled={item.disabled}
        onClick={() => onAction(item.id)}
        data-testid={`studio-tab-ctx-${item.id}`}
      >
        {item.label}
      </button>
    </>
  );
}

// ─── Context Menu Builder ──────────────────────────────────────────

export interface BuildContextMenuItemsOptions {
  tabId: string;
  tabLabel: string;
  tabIndex: number;
  totalTabs: number;
  canDuplicate: boolean;
  canClose: boolean;
  /** Appended after the close group — e.g. a destructive "Delete" entry. */
  extraItems?: TabContextMenuItem[];
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildContextMenuItems({
  tabIndex,
  totalTabs,
  canDuplicate,
  canClose,
  extraItems = [],
}: BuildContextMenuItemsOptions): TabContextMenuItem[] {
  return [
    { id: 'rename', label: 'Rename Tab' },
    { id: 'duplicate', label: 'Duplicate Tab', disabled: !canDuplicate },
    { id: 'copy-label', label: 'Copy Label', dividerBefore: true },
    { id: 'close', label: 'Close Tab', dividerBefore: true, disabled: !canClose },
    { id: 'close-others', label: 'Close Other Tabs', disabled: totalTabs <= 1 },
    { id: 'close-right', label: 'Close Tabs to the Right', disabled: tabIndex >= totalTabs - 1 },
    ...extraItems,
  ];
}

// ─── Context Menu State Hook ───────────────────────────────────────

export interface TabContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTabContextMenu(): {
  menuState: TabContextMenuState | null;
  openMenu: (tabId: string, e: RMouseEvent) => void;
  closeMenu: () => void;
  renderMenu: (
    items: TabContextMenuItem[],
    onAction: (actionId: string) => void,
  ) => ReactNode;
} {
  const [menuState, setMenuState] = useState<TabContextMenuState | null>(null);

  const openMenu = useCallback((tabId: string, e: RMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setMenuState(null), []);

  const renderMenu = useCallback(
    (items: TabContextMenuItem[], onAction: (actionId: string) => void): ReactNode => {
      if (!menuState) return null;
      return (
        <TabContextMenu
          x={menuState.x}
          y={menuState.y}
          items={items}
          onAction={(actionId) => {
            onAction(actionId);
            setMenuState(null);
          }}
          onClose={() => setMenuState(null)}
        />
      );
    },
    [menuState],
  );

  return { menuState, openMenu, closeMenu, renderMenu };
}
