import { useEffect, useRef, useState } from 'react';
import type { ApiMockImportSourceId } from './ApiMockImportReview';
import { DownloadIcon, UploadIcon, ChevronDownIcon } from './ApiMockIcons';

/**
 * Studio / Runtime / Conflicts — product IA matching mockup ops split.
 */
export type ApiMockMainView = 'studio' | 'runtime' | 'conflicts';

export type ApiMockExportScope = 'workspace' | 'servers' | 'routes';
export type ApiMockExportFormat = 'json' | 'yaml' | 'wiremock' | 'har';

export interface ApiMockExportRequest {
  scope: ApiMockExportScope;
  format: ApiMockExportFormat;
}

interface Props {
  view: ApiMockMainView;
  onChange: (view: ApiMockMainView) => void;
  transactionCount?: number;
  conflictCount?: number;
  onImport?: (source?: ApiMockImportSourceId) => void;
  onExport?: (req: ApiMockExportRequest) => void;
}

const TABS: Array<{ id: ApiMockMainView; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'conflicts', label: 'Conflicts' },
];

const EXPORT_GROUPS: Array<{
  id: string;
  label: string;
  testId: string;
  items: Array<{ req: ApiMockExportRequest; testId: string; label: string; hint: string }>;
}> = [
  {
    id: 'workspace',
    label: 'Workspace',
    testId: 'api-mock-export-group-workspace',
    items: [
      { req: { scope: 'workspace', format: 'json' }, testId: 'api-mock-export-workspace', label: 'Workspace JSON', hint: 'All servers (redacted)' },
      { req: { scope: 'workspace', format: 'yaml' }, testId: 'api-mock-export-workspace-yaml', label: 'Workspace YAML', hint: 'Source-control friendly' },
    ],
  },
  {
    id: 'server',
    label: 'This server',
    testId: 'api-mock-export-group-server',
    items: [
      { req: { scope: 'servers', format: 'json' }, testId: 'api-mock-export-servers', label: 'Active server JSON', hint: 'Current tab only' },
      { req: { scope: 'routes', format: 'json' }, testId: 'api-mock-export-routes', label: 'Active server routes', hint: 'Rules + samples' },
    ],
  },
  {
    id: 'interop',
    label: 'Interop',
    testId: 'api-mock-export-group-interop',
    items: [
      { req: { scope: 'routes', format: 'wiremock' }, testId: 'api-mock-export-wiremock', label: 'WireMock mappings', hint: 'Subset + loss report file' },
      { req: { scope: 'servers', format: 'har' }, testId: 'api-mock-export-har', label: 'HAR (journal)', hint: 'Captured traffic + loss report' },
    ],
  },
];

export function ApiMockWorkspaceNav({
  view,
  onChange,
  transactionCount = 0,
  conflictCount = 0,
  onImport,
  onExport,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target;
      if (exportRef.current?.contains(target as Node)) return;
      // Demo rings, ripples, and the live panel sit on document.body. A
      // mousedown there must not dismiss the menu mid-lesson (Acting then
      // waits for a confirm that never opens).
      if (
        target instanceof Element
        && target.closest('.demo-spotlight-ring, .demo-click-ripple, .demo-live-panel')
      ) {
        return;
      }
      setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportOpen]);

  return (
    <nav className="am-workspace-nav" aria-label="API Mock workspace" data-testid="api-mock-workspace-nav">
      <div className="am-workspace-nav-tabs" role="tablist" aria-label="Workspace views">
        {TABS.map(t => {
          const active = view === t.id;
          const count = t.id === 'runtime'
            ? transactionCount
            : t.id === 'conflicts'
              ? conflictCount
              : undefined;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`am-workspace-nav-tab${active ? ' active' : ''}`}
              data-testid={`api-mock-view-${t.id}`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
              {typeof count === 'number' && count > 0 && (
                <span className={`am-count-badge${t.id === 'conflicts' ? ' warning' : ''}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {(onImport || onExport) && (
        <div className="am-workspace-nav-actions">
          {onImport && (
            <button
              className="am-btn small"
              data-testid="api-mock-import-menu"
              onClick={() => { setExportOpen(false); onImport(); }}
            >
              <DownloadIcon /> Import
            </button>
          )}
          {onExport && (
            <div className="am-dropdown" ref={exportRef}>
              <button
                className="am-btn small"
                data-testid="api-mock-export"
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                onClick={() => setExportOpen(o => !o)}
              >
                <UploadIcon /> Export <ChevronDownIcon size={12} />
              </button>
              {exportOpen && (
                <div className="am-dropdown-menu open" role="menu" data-testid="api-mock-export-menu-panel">
                  {EXPORT_GROUPS.map(group => (
                    <div key={group.id} className="am-menu-group" data-testid={group.testId}>
                      <div className="am-menu-group-label">{group.label}</div>
                      {group.items.map(item => (
                        <button
                          key={item.testId}
                          className="am-menu-item"
                          role="menuitem"
                          data-testid={item.testId}
                          onClick={() => { setExportOpen(false); onExport(item.req); }}
                        >
                          <span className="am-menu-label">{item.label}</span>
                          <span className="am-menu-hint">{item.hint}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
