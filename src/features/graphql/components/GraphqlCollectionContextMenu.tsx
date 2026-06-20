/**
 * CollectionContextMenu — right-click context menu for GraphQL collection items,
 * folders, and collections.
 * Extracted from GraphqlCollections.tsx to reduce its line count.
 */
import type { ContextMenuState } from './graphqlCollectionsTypes';

export interface CollectionContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onRename: (type: 'collection' | 'folder' | 'item', id: string, name: string) => void;
  onDelete: (type: 'collection' | 'folder' | 'item', id: string) => void;
  onFork: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEditItemScripts: (id: string) => void;
  onEditCollectionScripts: (id: string, name: string) => void;
  itemIsPinned?: boolean;
  onTogglePin?: (id: string, pinned: boolean) => void;
}

export function CollectionContextMenu({
  menu, onClose, onRename, onDelete, onFork, onDuplicate, onEditItemScripts, onEditCollectionScripts,
  itemIsPinned, onTogglePin,
}: CollectionContextMenuProps) {
  return (
    <div
      className="gql-history-context-menu"
      style={{ top: menu.y, left: menu.x }}
      role="menu"
      onMouseLeave={onClose}
    >
      <button type="button" role="menuitem" onClick={() => { onRename(menu.type, menu.id, menu.name); onClose(); }}>Rename</button>
      {menu.type === 'collection' && (
        <>
          <button type="button" role="menuitem" onClick={() => { onFork(menu.id); onClose(); }}>Fork collection</button>
          <button type="button" role="menuitem" onClick={() => { onEditCollectionScripts(menu.id, menu.name); }}>Edit collection scripts</button>
        </>
      )}
      {menu.type === 'item' && (
        <>
          <button type="button" role="menuitem" onClick={() => { onDuplicate(menu.id); onClose(); }}>Duplicate</button>
          <button type="button" role="menuitem" onClick={() => { onEditItemScripts(menu.id); }}>Edit scripts</button>
          {onTogglePin && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { onTogglePin(menu.id, !itemIsPinned); onClose(); }}
              data-testid="gql-ctx-pin"
            >
              {itemIsPinned ? 'Unpin' : 'Pin to top'}
            </button>
          )}
        </>
      )}
      <button type="button" role="menuitem" className="gql-history-ctx-danger" onClick={() => onDelete(menu.type, menu.id)}>Delete</button>
    </div>
  );
}
