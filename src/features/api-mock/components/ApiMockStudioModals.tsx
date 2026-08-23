import AppModalFrame from '@shared/components/AppModalFrame';
import type { ApiMockRouteFolderV1, ApiMockServerDefinitionV1, ApiMockSimulationSampleV1 } from '@shared/api-mock/contracts';
import { ApiMockServerSettingsModal } from './ApiMockServerSettingsModal';
import { ApiMockSimulateModal } from './ApiMockSimulateModal';
import { ApiMockImportReview } from './ApiMockImportReview';
import { ApiMockExportConfirm } from './ApiMockExportConfirm';
import type { ApiMockExportResult } from '../apiMockExportActions';
import { deriveSimulateDefaults } from '../apiMockPageHelpers';

interface ApiMockStudioModalsProps {
  activeServer: ApiMockServerDefinitionV1 | undefined;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  runtimeStatus: string;
  libraryServers?: Array<{ id: string; name: string; port: number }>;
  onUpdateServer: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  simulateOpen: boolean;
  setSimulateOpen: (open: boolean) => void;
  selectedRoute: ApiMockServerDefinitionV1['routes'][0] | undefined;
  simulateSeed: { path: string; method: string; sampleId?: string } | undefined;
  setSimulateSeed: (seed: { path: string; method: string; sampleId?: string } | undefined) => void;
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
  importSource: 'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har';
  lastNativeExport?: string;
  exportResult: ApiMockExportResult | null;
  onCloseExport: () => void;
  onImportRoutes: (
    routes: ApiMockServerDefinitionV1['routes'],
    options?: { mode: 'merge' | 'replace' | 'copy'; newFolderName?: string },
  ) => void;
  folders: ApiMockRouteFolderV1[];
  onSaveSample?: (sample: ApiMockSimulationSampleV1) => void;
  onUpdateSample?: (sample: ApiMockSimulationSampleV1) => void;
}

export function ApiMockStudioModals({
  activeServer,
  settingsOpen,
  setSettingsOpen,
  runtimeStatus,
  libraryServers,
  onUpdateServer,
  simulateOpen,
  setSimulateOpen,
  selectedRoute,
  simulateSeed,
  setSimulateSeed,
  importOpen,
  setImportOpen,
  importSource,
  lastNativeExport,
  exportResult,
  onCloseExport,
  onImportRoutes,
  folders,
  onSaveSample,
  onUpdateSample,
}: ApiMockStudioModalsProps) {
  if (!activeServer) return null;

  const closeImport = () => setImportOpen(false);

  return (
    <>
      {settingsOpen && (
        <ApiMockServerSettingsModal
          server={activeServer}
          libraryServers={libraryServers}
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
              onSaveSample={onSaveSample}
              onUpdateSample={onUpdateSample}
              onClose={() => { setSimulateOpen(false); setSimulateSeed(undefined); }}
            />
          );
        })()
      )}
      {importOpen && (
        <AppModalFrame
          title="Import & Promotion"
          onClose={closeImport}
          dialogClassName="modal am-studio-modal"
          bodyClassName="am-studio-modal-body"
          footerClassName="am-studio-modal-footer"
          showExpandButton={false}
          closeOnOverlayClick={false}
          footer={
            <div className="api-mock-root am-in-modal am-modal-toolbar" style={{ width: '100%' }}>
              <span className="am-faint">Imported rules stay inactive until you enable them.</span>
              <span className="am-spacer" />
              <button className="am-btn" onClick={closeImport} data-testid="api-mock-import-close">Cancel</button>
            </div>
          }
        >
          <ApiMockImportReview
            key={importSource}
            folders={folders}
            initialSource={importSource}
            lastNativeExport={lastNativeExport}
            onImport={onImportRoutes}
            onCancel={closeImport}
          />
        </AppModalFrame>
      )}
      {exportResult && (
        <ApiMockExportConfirm result={exportResult} onClose={onCloseExport} />
      )}
    </>
  );
}
