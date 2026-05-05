import type { Scenario, DataSource, FeatureGroup } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { createDataSourceWithTemplatizedUrl } from '../utils/dataSourceUtils';
import DataSourceSetupModal from './DataSourceSetupModal';
import type { HttpResponse } from '../../../shared/utils/httpClient';

interface DataSourceEmptyStateProps {
  draft: Scenario;
  onDraftChange: (s: Scenario) => void;
  onFetchRow?: (scenario: Scenario, rowId: string) => Promise<HttpResponse>;
  onCreateParameterizedCopy?: (copy: Scenario, targetFgId?: string, targetScenarioId?: string) => void;
  featureGroups?: FeatureGroup[];
  editingTest?: { fgId: string; scenarioId: string };
  showSetupModal: boolean;
  setShowSetupModal: (v: boolean) => void;
  handleSetupApply: (dataTable: DataSource, urlTemplate: string, options?: { auth?: Scenario['auth'] }) => void;
}

export default function DataSourceEmptyState({
  draft, onDraftChange, onFetchRow, onCreateParameterizedCopy,
  featureGroups, editingTest,
  showSetupModal, setShowSetupModal, handleSetupApply,
}: DataSourceEmptyStateProps) {
  return (
    <div className="params-editor">
      <div className="params-toolbar">
        <div className="params-toolbar-left">
          <span className="params-section-label">{onCreateParameterizedCopy ? 'PARAMETERIZE' : 'DATA SOURCE'}</span>
        </div>
      </div>
      {onCreateParameterizedCopy ? (
        <div className="data-source-empty parameterize-empty">
          <div className="parameterize-icon">📋</div>
          <h3>Parameterize This Test</h3>
          <p>Create a data-driven copy to test with multiple sets of input data.<br />Your current test will be preserved as-is.</p>
          <div className="data-source-empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => setShowSetupModal(true)}>
              📋 Create Parameterized Copy
            </button>
          </div>
        </div>
      ) : (
        <div className="data-source-empty">
          <p>No data source attached. Add a data source to run this test with multiple sets of input data.</p>
          <div className="data-source-empty-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => {
              const { dataSource: newDs } = createDataSourceWithTemplatizedUrl(draft);
              if (newDs.columns.length > 0) {
                onDraftChange({ ...draft, dataSource: newDs });
              } else {
                setShowSetupModal(true);
              }
            }}>
              ⚡ Quick Setup
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowSetupModal(true)}>
              Configure Wizard
            </button>
          </div>
        </div>
      )}
      {showSetupModal && (
        <DataSourceSetupModal
          test={draft}
          mode={onCreateParameterizedCopy ? 'parameterize' : 'configure'}
          onApply={onCreateParameterizedCopy ? (dataTable, urlTemplate, paramOpts) => {
            const copy: Scenario = {
              ...draft,
              id: uuidv4(),
              name: paramOpts?.copyName || `${draft.name} (Parameterized)`,
              headers: draft.headers.map((h) => ({ ...h })),
              validation: { ...draft.validation, expectedFields: draft.validation.expectedFields?.map((f) => ({ ...f })) },
              dataSource: dataTable,
              url: urlTemplate,
              sourceTestId: draft.id,
            };
            onCreateParameterizedCopy(copy, paramOpts?.targetFgId, paramOpts?.targetScenarioId);
          } : handleSetupApply}
          onClose={() => setShowSetupModal(false)}
          onFetchRow={onFetchRow}
          featureGroups={featureGroups}
          editingTest={editingTest}
          sourceName={draft.name}
        />
      )}
    </div>
  );
}
