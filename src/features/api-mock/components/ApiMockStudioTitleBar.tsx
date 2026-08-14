import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { ApiMockServerTabs, type ApiMockRuntimeStatus } from './ApiMockServerTabs';

interface Props {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onCloseMany?: (ids: string[]) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onOpenLibrary?: () => void;
  /** Total saved servers, open tabs included. */
  savedCount?: number;
  /** Saved servers without an open tab. */
  parkedCount?: number;
  statusById?: Record<string, ApiMockRuntimeStatus>;
  dirtyById?: Record<string, boolean>;
}

/**
 * Server tab strip + saved-server library entry.
 * Protocol chrome already names this view — no page title/tagline.
 */
export function ApiMockStudioTitleBar({
  servers,
  activeServerId,
  onSelect,
  onCreate,
  onClose,
  onCloseMany,
  onDelete,
  onRename,
  onDuplicate,
  onReorder,
  onOpenLibrary,
  savedCount,
  parkedCount = 0,
  statusById,
  dirtyById,
}: Props) {
  return (
    <div className="api-mock-titlebar" data-testid="api-mock-titlebar">
      <ApiMockServerTabs
        servers={servers}
        activeServerId={activeServerId}
        onSelect={onSelect}
        onCreate={onCreate}
        onClose={onClose}
        onCloseMany={onCloseMany}
        onDelete={onDelete}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onReorder={onReorder}
        statusById={statusById}
        dirtyById={dirtyById}
        embedded
      />
      {onOpenLibrary && (
        <button
          type="button"
          className="am-btn am-saved-servers-btn"
          onClick={onOpenLibrary}
          title="Browse every saved mock server, including closed tabs"
          data-testid="api-mock-open-library"
        >
          Saved servers
          <span className="am-saved-servers-count">{savedCount ?? 0}</span>
          {parkedCount > 0 && (
            <span className="am-saved-servers-parked" data-testid="api-mock-parked-count">
              {parkedCount} closed
            </span>
          )}
        </button>
      )}
    </div>
  );
}
