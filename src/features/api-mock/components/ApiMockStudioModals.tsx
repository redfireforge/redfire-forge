import AppModalFrame from '../../../shared/components/AppModalFrame';
import type { ApiMockRouteFolderV1, ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { ApiMockSimulateModal } from './ApiMockSimulateModal';
import { ApiMockImportReview } from './ApiMockImportReview';
import { deriveSimulateDefaults } from '../apiMockPageHelpers';

interface ApiMockStudioModalsProps {
  activeServer: ApiMockServerDefinitionV1 | undefined;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  runtimeStatus: string;
  onUpdateServer: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  simulateOpen: boolean;
  setSimulateOpen: (open: boolean) => void;
  selectedRoute: ApiMockServerDefinitionV1['routes'][0] | undefined;
  simulateSeed: { path: string; method: string; sampleId?: string } | undefined;
  setSimulateSeed: (seed: { path: string; method: string; sampleId?: string } | undefined) => void;
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
  importSource: 'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har';
  onImportRoutes: (
    routes: ApiMockServerDefinitionV1['routes'],
    options?: { mode: 'merge' | 'replace' | 'copy'; newFolderName?: string },
  ) => void;
  folders: ApiMockRouteFolderV1[];
}

export function ApiMockStudioModals({
  activeServer,
  settingsOpen,
  setSettingsOpen,
  runtimeStatus,
  onUpdateServer,
  simulateOpen,
  setSimulateOpen,
  selectedRoute,
  simulateSeed,
  setSimulateSeed,
  importOpen,
  setImportOpen,
  importSource,
  onImportRoutes,
  folders,
}: ApiMockStudioModalsProps) {
  if (!activeServer) return null;

  return (
    <>
      {settingsOpen && (
        <ApiMockServerSettingsModal
          server={activeServer}
          statusLabel={
            runtimeStatus === 'running' ? 'Running'
              : runtimeStatus === 'error' ? 'Error'
                : 'Stopped'
          }
          onSave={onUpdateServer}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {simulateOpen && (
        (() => {
          const defaults = deriveSimulateDefaults(selectedRoute);
          return (
            <ApiMockSimulateModal
              key={`${simulateSeed?.sampleId ?? 'adhoc'}:${simulateSeed?.method ?? ''}:${simulateSeed?.path ?? ''}`}
              server={activeServer}
              initialPath={simulateSeed?.path ?? defaults.initialPath}
              initialMethod={simulateSeed?.method ?? defaults.initialMethod}
              initialSampleId={simulateSeed?.sampleId}
              onClose={() => { setSimulateOpen(false); setSimulateSeed(undefined); }}
            />
          );
        })()
      )}
      {importOpen && (
        <AppModalFrame
          title="Import & Promotion"
          onClose={() => setImportOpen(false)}
          dialogClassName="modal am-studio-modal"
          bodyClassName="am-studio-modal-body"
          footerClassName="am-studio-modal-footer"
          showExpandButton={false}
          closeOnOverlayClick={false}
          footer={
            <div className="api-mock-root am-in-modal am-modal-toolbar" style={{ width: '100%' }}>
              <span className="am-faint">Imported rules stay inactive until you enable them.</span>
              <span className="am-spacer" />
              <button className="am-btn" onClick={() => setImportOpen(false)} data-testid="api-mock-import-close">Cancel</button>
            </div>
          }
        >
          <ApiMockImportReview
            key={importSource}
            folders={folders}
            initialSource={importSource}
            onImport={onImportRoutes}
            onCancel={() => setImportOpen(false)}
          />
        </AppModalFrame>
      )}
    </>
  );
}
