import { useEffect, useRef, useState } from 'react';
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
  onImportCurl: () => void;
  onExport: () => void;
}

/**
 * Mockup 01 page titlebar: title + subtitle, server tabs, Import ▾, Export.
 */
export function ApiMockStudioTitleBar({
  servers,
  activeServerId,
  onSelect,
  onCreate,
  onClose,
  statusById,
  dirtyById,
  onImportCurl,
  onExport,
}: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!importOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setImportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [importOpen]);

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

      <div className="am-dropdown" ref={dropdownRef}>
        <button
          className="am-btn"
          data-testid="api-mock-import-menu"
          aria-haspopup="menu"
          aria-expanded={importOpen}
          onClick={() => setImportOpen(o => !o)}
        >
          Import ▾
        </button>
        {importOpen && (
          <div className="am-dropdown-menu open" role="menu" data-testid="api-mock-import-menu-panel">
            <button
              className="am-menu-item"
              role="menuitem"
              data-testid="api-mock-import-curl"
              onClick={() => { setImportOpen(false); onImportCurl(); }}
            >
              <span>
                cURL command
                <small>Generate rule and sample</small>
              </span>
            </button>
            <button className="am-menu-item" role="menuitem" disabled title="Coming soon">
              <span>
                Catalog endpoints
                <small>Select one or many operations</small>
              </span>
            </button>
            <button className="am-menu-item" role="menuitem" disabled title="Coming soon">
              <span>
                Requests collection
                <small>Promote items or folders</small>
              </span>
            </button>
            <button className="am-menu-item" role="menuitem" disabled title="Coming soon">
              <span>
                OpenAPI / WireMock
                <small>Review compatibility first</small>
              </span>
            </button>
          </div>
        )}
      </div>

      <button className="am-btn" onClick={onExport} data-testid="api-mock-export">Export</button>
    </div>
  );
}
