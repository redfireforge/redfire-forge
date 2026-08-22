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
  statusById?: Record<string, ApiMockRuntimeStatus>;
  dirtyById?: Record<string, boolean>;
}

/**
 * Server tab strip. The saved-server list lives in the left sidebar now.
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
    </div>
  );
}
