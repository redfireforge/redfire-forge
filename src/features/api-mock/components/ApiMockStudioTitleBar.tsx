import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { ApiMockServerTabs, type ApiMockRuntimeStatus } from './ApiMockServerTabs';

interface Props {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  statusById?: Record<string, ApiMockRuntimeStatus>;
  dirtyById?: Record<string, boolean>;
}

/**
 * Mockup 01 page titlebar: title + subtitle, server tabs.
 * Import / Export moved to ApiMockWorkspaceNav (tab-scoped actions).
 */
export function ApiMockStudioTitleBar({
  servers,
  activeServerId,
  onSelect,
  onCreate,
  onClose,
  statusById,
  dirtyById,
}: Props) {
  return (
    <div className="api-mock-titlebar" data-testid="api-mock-titlebar">
      <div className="am-title-block">
        <div className="am-page-title">API Mock Studio</div>
        <div className="am-page-subtitle">Independent local mock servers with deterministic rules</div>
      </div>

      <div className="am-titlebar-tabs">
        <ApiMockServerTabs
          servers={servers}
          activeServerId={activeServerId}
          onSelect={onSelect}
          onCreate={onCreate}
          onClose={onClose}
          statusById={statusById}
          dirtyById={dirtyById}
          embedded
        />
      </div>
    </div>
  );
}
