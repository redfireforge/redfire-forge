import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';

export type ApiMockRuntimeStatus = 'stopped' | 'starting' | 'running' | 'draining' | 'applying' | 'error';

/** Panel id the server tabs control (the workspace region). */
export const API_MOCK_WORKSPACE_PANEL_ID = 'api-mock-workspace-panel';

interface Props {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  /** Optional per-server runtime status; defaults to 'stopped'. */
  statusById?: Record<string, ApiMockRuntimeStatus>;
  /** Optional per-server dirty flag (unapplied draft changes). */
  dirtyById?: Record<string, boolean>;
  /** When true, omit outer chrome so the tablist nests in the title bar (mockup 01). */
  embedded?: boolean;
}

const STATUS_TITLE: Record<ApiMockRuntimeStatus, string> = {
  stopped: 'Stopped', starting: 'Starting', running: 'Running',
  draining: 'Draining', applying: 'Applying', error: 'Error',
};

export function ApiMockServerTabs({ servers, activeServerId, onSelect, onCreate, onClose, statusById, dirtyById, embedded = false }: Props) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const el = document.activeElement as HTMLElement | null;
      const id = el?.getAttribute('data-server-id');
      if (id) { e.preventDefault(); onClose(id); return; }
    }
    handleTabListArrowKeys(e);
  };

  return (
    <div
      className={`api-mock-server-tabs${embedded ? ' embedded' : ''}`}
      role="tablist"
      aria-label="Mock server tabs"
      data-testid="api-mock-server-tabs"
      onKeyDown={onKeyDown}
    >
      {servers.map(srv => {
        const status = statusById?.[srv.id] ?? 'stopped';
        const dirty = dirtyById?.[srv.id] ?? false;
        const active = srv.id === activeServerId;
        return (
          <button
            key={srv.id}
            id={`api-mock-tabhdr-${srv.id}`}
            role="tab"
            aria-selected={active}
            aria-controls={API_MOCK_WORKSPACE_PANEL_ID}
            tabIndex={active ? 0 : -1}
            data-server-id={srv.id}
            className={`am-server-tab${active ? ' active' : ''}`}
            onClick={() => onSelect(srv.id)}
            title={`${srv.name} — ${STATUS_TITLE[status]}${dirty ? ' · unapplied changes' : ''}`}
            data-testid={`api-mock-tab-${srv.id}`}
          >
            <span className={`am-status-dot ${status}`} title={STATUS_TITLE[status]} />
            <span>{srv.name}</span>
            <span className="am-mono am-muted">:{srv.port}</span>
            {dirty && <span className="am-dirty-dot" title="Unapplied changes" aria-label="Unapplied changes" role="img" />}
            <span
              className="am-tab-close"
              role="button"
              tabIndex={-1}
              aria-label={`Close ${srv.name}`}
              title={`Close ${srv.name}`}
              onClick={e => { e.stopPropagation(); onClose(srv.id); }}
              data-testid={`api-mock-tab-close-${srv.id}`}
            >×</span>
          </button>
        );
      })}
      <button className="am-icon-btn" aria-label="New mock server" title="New mock server" onClick={onCreate} data-testid="api-mock-tab-add">+</button>
    </div>
  );
}
