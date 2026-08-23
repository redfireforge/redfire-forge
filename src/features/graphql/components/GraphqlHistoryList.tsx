/** History list rows with optional compare-mode marking. */
import type { GraphqlHistoryItem } from '@shared/types/graphql';

export interface HistoryGroupProps {
  label: string;
  items: GraphqlHistoryItem[];
  selected: GraphqlHistoryItem | null;
  compareMode: boolean;
  compareAId: string | null;
  compareBId: string | null;
  onCompareMark: (itemId: string, e: React.MouseEvent) => void;
  onItemClick: (item: GraphqlHistoryItem) => void;
  onItemDoubleClick: (item: GraphqlHistoryItem) => void;
  onContextMenu: (e: React.MouseEvent, item: GraphqlHistoryItem) => void;
}

export function HistoryGroup({
  label, items, selected, compareMode, compareAId, compareBId, onCompareMark,
  onItemClick, onItemDoubleClick, onContextMenu,
}: HistoryGroupProps) {
  return (
    <div className="gql-history-group">
      <div className="gql-history-group-label">{label}</div>
      {items.map((item) => (
        <HistoryEntryRow
          key={item.id}
          item={item}
          selected={selected?.id === item.id}
          compareMode={compareMode}
          compareSlot={compareAId === item.id ? 'A' : compareBId === item.id ? 'B' : null}
          onCompareMark={(e) => onCompareMark(item.id, e)}
          onClick={() => onItemClick(item)}
          onDoubleClick={() => onItemDoubleClick(item)}
          onContextMenu={(e) => onContextMenu(e, item)}
        />
      ))}
    </div>
  );
}

interface HistoryEntryRowProps {
  item: GraphqlHistoryItem;
  selected: boolean;
  compareMode: boolean;
  compareSlot: 'A' | 'B' | null;
  onCompareMark: (e: React.MouseEvent) => void;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function HistoryEntryRow({
  item, selected, compareMode, compareSlot, onCompareMark,
  onClick, onDoubleClick, onContextMenu,
}: HistoryEntryRowProps) {
  const opType = item.operation.operationType;
  const badge = opType === 'query' ? 'Q' : opType === 'mutation' ? 'M' : 'S';
  const badgeClass = `gql-history-badge gql-history-badge--${opType}`;
  const opName = item.operation.name ?? '(anonymous)';
  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`gql-history-entry${selected ? ' gql-history-entry--selected' : ''}${compareSlot ? ` gql-history-entry--compare-${compareSlot.toLowerCase()}` : ''}`}
      role="option"
      aria-selected={selected}
      data-compare-slot={compareSlot ?? undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={`${opType}: ${opName} — ${item.latencyMs}ms`}
      data-testid="gql-history-entry"
    >
      {compareMode && (
        <button
          type="button"
          className={`gql-history-compare-mark${compareSlot ? ` gql-history-compare-mark--${compareSlot.toLowerCase()}` : ''}`}
          onClick={(e) => { e.stopPropagation(); onCompareMark(e); }}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-label={compareSlot ? `Unmark compare slot ${compareSlot}` : 'Mark for comparison'}
          title={compareSlot ? `Slot ${compareSlot} — click to unmark` : 'Mark for comparison'}
          data-testid="gql-history-compare-mark"
        >
          {compareSlot ?? '+'}
        </button>
      )}
      <span className={badgeClass}>{badge}</span>
      <span className="gql-history-entry-name">{opName}</span>
      <span className={`gql-history-status${item.status === 'error' ? ' gql-history-status--error' : ''}`}>
        {item.status === 'success' ? '✓' : '✗'}
      </span>
      <span className="gql-history-latency">{item.latencyMs}ms</span>
      <span className="gql-history-time">{time}</span>
    </div>
  );
}
