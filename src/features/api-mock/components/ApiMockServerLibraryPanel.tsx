import { useMemo, useState } from 'react';
import {
  describeLibraryEntry,
  filterLibraryEntries,
  formatLibraryTimestamp,
  type ApiMockLibraryEntry,
} from '../apiMockServerLibrary';

interface Props {
  entries: ApiMockLibraryEntry[];
  activeServerId?: string;
  /** No further tab can be opened until one is closed. */
  atTabLimit: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate?: () => void;
  /** `page` renders the standalone "no tabs open" landing; `modal` renders inside the dialog. */
  variant?: 'page' | 'modal';
}

/**
 * Browse every saved mock server. Open tabs are listed first so the user can see
 * that closing a tab only parked the definition — deleting is the separate,
 * explicit action on each row.
 */
export function ApiMockServerLibraryPanel({
  entries,
  activeServerId,
  atTabLimit,
  onOpen,
  onDelete,
  onCreate,
  variant = 'modal',
}: Props) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterLibraryEntries(entries, query), [entries, query]);
  const parkedCount = entries.filter(e => !e.open).length;

  return (
    <div className={`am-library am-library--${variant}`} data-testid="api-mock-library">
      <div className="am-library-toolbar">
        <input
          className="am-input am-library-search"
          type="search"
          value={query}
          placeholder="Search by name, port, or rule path"
          aria-label="Search saved mock servers"
          onChange={e => setQuery(e.target.value)}
          data-testid="api-mock-library-search"
        />
        <span className="am-library-count" data-testid="api-mock-library-count">
          {visible.length} of {entries.length} saved · {parkedCount} closed
        </span>
        {onCreate && (
          <button
            type="button"
            className="am-btn primary"
            onClick={onCreate}
            data-testid="api-mock-library-create"
          >
            New mock server
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="am-library-empty" data-testid="api-mock-library-empty">
          {entries.length === 0
            ? 'No saved mock servers yet. Create one to get started.'
            : 'No saved mock server matches this search.'}
        </div>
      ) : (
        <ul className="am-library-list" data-testid="api-mock-library-list">
          {visible.map(entry => {
            const { server } = entry;
            const isActive = entry.open && server.id === activeServerId;
            const openDisabled = !entry.open && atTabLimit;
            return (
              <li
                key={server.id}
                className={`am-library-row${entry.open ? ' am-library-row--open' : ''}${isActive ? ' am-library-row--active' : ''}`}
                data-testid={`api-mock-library-row-${server.id}`}
              >
                <div className="am-library-row-main">
                  <div className="am-library-row-title">
                    <span className="am-library-name">{server.name}</span>
                    <span className="am-library-port">:{server.port}</span>
                    {entry.open && (
                      <span className="am-library-badge" data-testid={`api-mock-library-open-badge-${server.id}`}>
                        {isActive ? 'Current tab' : 'Open'}
                      </span>
                    )}
                  </div>
                  <div className="am-library-row-meta">
                    {describeLibraryEntry(entry)} · {formatLibraryTimestamp(server.updatedAt)}
                  </div>
                </div>
                <div className="am-library-row-actions">
                  <button
                    type="button"
                    className="am-btn"
                    disabled={openDisabled}
                    title={openDisabled ? 'Close a tab first — the tab limit is reached.' : undefined}
                    onClick={() => onOpen(server.id)}
                    data-testid={`api-mock-library-open-${server.id}`}
                  >
                    {entry.open ? 'Go to tab' : 'Open'}
                  </button>
                  <button
                    type="button"
                    className="am-btn danger"
                    onClick={() => onDelete(server.id)}
                    data-testid={`api-mock-library-delete-${server.id}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
