import type { KeyboardEvent, Ref } from 'react';
import { memo, useMemo, useState } from 'react';
import type { GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { groupMessageFields } from '../utils/grpcProtoFormValues';

interface GrpcProtoHybridNavigatorProps {
  schema: GrpcMessageSchema;
  selectedPath: string | null;
  disabled?: boolean;
  listRef?: Ref<HTMLDivElement>;
  onSelectPath: (path: string) => void;
}

interface NavigatorEntry {
  id: string;
  path: string;
  label: string;
  detail: string;
}

function entryId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function buildHybridNavigatorPaths(schema: GrpcMessageSchema): string[] {
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  const regularPaths = regular.map((field) => `field:${field.name}`);
  const oneofPaths = [...oneofGroups.keys()].map((groupName) => `oneof:${groupName}`);
  return [...regularPaths, ...oneofPaths];
}

export const GrpcProtoHybridNavigator = memo(function GrpcProtoHybridNavigatorImpl({
  schema,
  selectedPath,
  disabled = false,
  listRef,
  onSelectPath,
}: GrpcProtoHybridNavigatorProps) {
  const [filterQuery, setFilterQuery] = useState('');

  const entries = useMemo<NavigatorEntry[]>(() => {
    const { regular, oneofGroups } = groupMessageFields(schema.fields);
    const regularEntries = regular.map((field) => ({
      detail: [
        field.type,
        field.isMap ? 'map' : null,
        field.label === 'repeated' ? 'repeated' : null,
      ].filter(Boolean).join(' · '),
      id: entryId(`field:${field.name}`),
      path: `field:${field.name}`,
      label: field.name,
    }));
    const oneofEntries = [...oneofGroups.entries()].map(([groupName, members]) => ({
      id: entryId(`oneof:${groupName}`),
      path: `oneof:${groupName}`,
      label: groupName,
      detail: `oneof · ${members.length} options`,
    }));
    return [...regularEntries, ...oneofEntries];
  }, [schema.fields]);

  const visibleEntries = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => (
      entry.label.toLowerCase().includes(query)
      || entry.detail.toLowerCase().includes(query)
      || entry.path.toLowerCase().includes(query)
    ));
  }, [entries, filterQuery]);

  const selectedEntryId = useMemo(() => {
    const selected = visibleEntries.find((entry) => entry.path === selectedPath);
    return selected ? `grpc-hybrid-nav-option-${selected.id}` : undefined;
  }, [selectedPath, visibleEntries]);

  const handleItemKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (visibleEntries.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(index + 1, visibleEntries.length - 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(index - 1, 0);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleEntries.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const targetEntry = visibleEntries[nextIndex];
    if (!targetEntry) return;
    onSelectPath(targetEntry.path);
    const targetElement = document.getElementById(`grpc-hybrid-nav-option-${targetEntry.id}`);
    targetElement?.focus();
  };

  return (
    <aside className="grpc-hybrid-navigator" data-testid="grpc-hybrid-navigator">
      <div className="grpc-hybrid-navigator__header">
        <h4 className="grpc-hybrid-navigator__title">Schema Navigator</h4>
        <span className="grpc-hybrid-navigator__count">{visibleEntries.length}</span>
      </div>
      <div className="grpc-hybrid-navigator__search-row">
        <input
          type="search"
          className="grpc-hybrid-navigator__search"
          value={filterQuery}
          placeholder="Filter fields"
          aria-label="Filter hybrid navigator fields"
          data-testid="grpc-hybrid-navigator-search"
          onChange={(event) => setFilterQuery(event.target.value)}
        />
      </div>
      <div
        ref={listRef}
        className="grpc-hybrid-navigator__list"
        role="listbox"
        aria-activedescendant={selectedEntryId}
        aria-label="Hybrid navigator fields"
        data-testid="grpc-hybrid-navigator-list"
      >
        {visibleEntries.map((entry, index) => (
          <button
            key={entry.path}
            id={`grpc-hybrid-nav-option-${entry.id}`}
            type="button"
            role="option"
            aria-selected={selectedPath === entry.path}
            className={`grpc-hybrid-navigator__item${selectedPath === entry.path ? ' grpc-hybrid-navigator__item--active' : ''}`}
            data-testid={`grpc-hybrid-nav-item-${entry.id}`}
            disabled={disabled}
            onClick={() => onSelectPath(entry.path)}
            onKeyDown={(event) => handleItemKeyDown(event, index)}
          >
            <span className="grpc-hybrid-navigator__item-label">{entry.label}</span>
            <span className="grpc-hybrid-navigator__item-detail">{entry.detail}</span>
          </button>
        ))}
        {visibleEntries.length === 0 && (
          <p className="grpc-hybrid-navigator__empty" data-testid="grpc-hybrid-navigator-empty">
            No matching fields.
          </p>
        )}
      </div>
    </aside>
  );
});
