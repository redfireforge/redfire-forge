/**
 * CollectionItemRow — a single row in the GraphQL collection tree.
 * Extracted from GraphqlCollections.tsx to reduce its line count.
 */
import type { GraphqlCollectionItem } from '@shared/types/graphql';

export interface CollectionItemRowProps {
  item: GraphqlCollectionItem;
  depth: number;
  isInvalid: boolean;
  onRun: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onEditScripts: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  editingId: string | null;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onCommitRename: (type: 'item', id: string) => void;
}

export function CollectionItemRow({
  item, depth, isInvalid, onRun, onLoad, onDelete, onEditScripts, onContextMenu,
  editingId, editingName, onEditingNameChange, onCommitRename,
}: CollectionItemRowProps) {
  const opType = item.operation.operationType;
  const badge = opType === 'query' ? 'Q' : opType === 'mutation' ? 'M' : 'S';
  const hasScripts = !!(item.scripts?.preRequest || item.scripts?.postResponse);
  const isEditingItem = editingId === `item:${item.id}`;

  return (
    <div
      className={`gql-col-item${item.isPinned ? ' gql-col-item--pinned' : ''}`}
      style={{ '--gql-depth': depth } as React.CSSProperties}
      role="treeitem"
      onDoubleClick={isEditingItem ? undefined : onLoad}
      onContextMenu={onContextMenu}
      title={isEditingItem ? undefined : item.name}
      data-testid="gql-col-item"
    >
      <span className={`gql-history-badge gql-history-badge--${opType}`}>{badge}</span>
      {isEditingItem ? (
        <input
          autoFocus
          className="gql-col-inline-rename"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => onCommitRename('item', item.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename('item', item.id);
            if (e.key === 'Escape') onEditingNameChange(item.name);
          }}
          onClick={(e) => e.stopPropagation()}
          data-testid="gql-col-item-rename-input"
        />
      ) : (
        <span className="gql-col-item-name">{item.name}</span>
      )}
      {isInvalid && <span className="gql-col-invalid-badge" title="Schema validation error">⚠</span>}
      {item.isPinned && <span className="gql-col-pin-badge" title="Pinned">📌</span>}
      {hasScripts && (
        <span
          className={`gql-col-script-badge${item.scripts?.enabled === false ? ' gql-col-script-badge--disabled' : ''}`}
          title={item.scripts?.enabled === false ? 'Scripts defined but disabled' : 'Has scripts'}
        >
          [Script]
        </span>
      )}
      <button
        type="button"
        className={`gql-col-item-script-btn${hasScripts ? ' gql-col-item-script-btn--active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onEditScripts(); }}
        aria-label={`Edit scripts for ${item.name}`}
        title="Edit scripts"
        data-testid="gql-col-item-scripts"
      >
        {'{…}'}
      </button>
      <button type="button" className="gql-col-item-run-btn" onClick={(e) => { e.stopPropagation(); onRun(); }} aria-label={`Run ${item.name}`} title="Run">▶</button>
      <button type="button" className="gql-col-item-del-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={`Delete ${item.name}`} title="Delete">✕</button>
    </div>
  );
}
