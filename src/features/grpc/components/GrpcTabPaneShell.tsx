import { GRPC } from '../../../shared/selectors/grpc';
import type { GrpcStudioTabState } from '../grpcStudioTypes';

export interface GrpcTabPaneShellProps {
  tab: GrpcStudioTabState;
  tabPanelId: string;
  isActive: boolean;
  onPatch: (patch: Partial<GrpcStudioTabState>) => void;
}

/** Phase 1D placeholder — replaced by explorer + call/response panels in 1E–1G. */
export function GrpcTabPaneShell({ tab, tabPanelId, isActive, onPatch }: GrpcTabPaneShellProps) {
  return (
    <div
      className="grpc-tab-pane"
      id={tabPanelId}
      data-testid={tabPanelId}
      style={{ display: isActive ? 'flex' : 'none' }}
      role="tabpanel"
      aria-hidden={!isActive}
    >
      <div className="grpc-tab-pane-grid">
        <section className="grpc-tab-pane-section">
          <h3 className="grpc-tab-pane-heading">Tab state (Phase 1D)</h3>
          <dl className="grpc-tab-state-list">
            <div className="grpc-tab-state-row">
              <dt>Target</dt>
              <dd data-testid="grpc-tab-state-target">{tab.target || '—'}</dd>
            </div>
            <div className="grpc-tab-state-row">
              <dt>Service</dt>
              <dd data-testid="grpc-tab-state-service">{tab.service ?? '—'}</dd>
            </div>
            <div className="grpc-tab-state-row">
              <dt>Method</dt>
              <dd data-testid="grpc-tab-state-method">{tab.method ?? '—'}</dd>
            </div>
            <div className="grpc-tab-state-row">
              <dt>Lifecycle</dt>
              <dd data-testid="grpc-tab-state-lifecycle">{tab.lifecycle}</dd>
            </div>
            <div className="grpc-tab-state-row">
              <dt>Body</dt>
              <dd data-testid="grpc-tab-state-body">{JSON.stringify(tab.body)}</dd>
            </div>
          </dl>
        </section>
        <section className="grpc-tab-pane-section">
          <h3 className="grpc-tab-pane-heading">Dev controls (1E+ replaces)</h3>
          <label className="grpc-dev-field">
            <span>Service</span>
            <input
              value={tab.service ?? ''}
              onChange={(event) => onPatch({ service: event.target.value || undefined })}
              placeholder="echo.EchoService"
            />
          </label>
          <label className="grpc-dev-field">
            <span>Method</span>
            <input
              value={tab.method ?? ''}
              onChange={(event) => onPatch({ method: event.target.value || undefined })}
              placeholder="Echo"
            />
          </label>
          <label className="grpc-dev-field">
            <span>Body JSON</span>
            <textarea
              value={JSON.stringify(tab.body, null, 2)}
              onChange={(event) => {
                try {
                  const parsed = JSON.parse(event.target.value) as Record<string, unknown>;
                  onPatch({ body: parsed });
                } catch {
                  /* ignore invalid JSON while typing */
                }
              }}
              rows={6}
            />
          </label>
        </section>
      </div>
    </div>
  );
}

export { GRPC };
