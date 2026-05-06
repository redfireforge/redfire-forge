/**
 * PopulateFromApiModal — Sends a request to the test's URL, detects arrays in the
 * JSON response, lets the user map response fields to data source columns, and
 * populates the data source with extracted rows.
 *
 * This modal has been refactored to use:
 * - usePopulateFromApi hook for state management and business logic
 * - PopulateFetchStep for the fetch step UI
 * - PopulateMapStep for the mapping step UI
 * - populateFromApiUtils for pure utility functions
 */
import { createPortal } from 'react-dom';
import type { Scenario, DataSource, DataSourceColumn, DataSourceRow } from '../../../shared/types';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { usePopulateFromApi, type ExtendedHttpResponse } from '../hooks/usePopulateFromApi';
import PopulateFetchStep from './PopulateFetchStep';
import PopulateMapStep from './PopulateMapStep';

interface Props {
  draft: Scenario;
  dataTable: DataSource;
  onApply: (columns: DataSourceColumn[], rows: DataSourceRow[], mode: 'append' | 'replace') => void;
  onClose: () => void;
  onFetchRow?: (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<ExtendedHttpResponse>;
}

export default function PopulateFromApiModal({ draft, dataTable, onApply, onClose, onFetchRow }: Props) {
  const {
    step,
    loading,
    error,
    selectedArray,
    fieldMappings,
    insertMode,
    setInsertMode,
    lastRequest,
    lastResponse,
    detectedArrays,
    arrayItems,
    enabledMappings,
    duplicateFlags,
    duplicateCount,
    effectiveSelections,
    selectedCount,
    setRowSelections,
    handleFetch,
    handleArrayChange,
    toggleField,
    changeFieldType,
    buildPopulatedData,
  } = usePopulateFromApi({ draft, dataTable, onFetchRow });

  const handlePopulate = () => {
    const data = buildPopulatedData();
    if (data) {
      onApply(data.columns, data.rows, insertMode);
      onClose();
    }
  };

  return createPortal(
    <AppModalFrame
      title="Populate from API Response"
      onClose={onClose}
      overlayClassName="populate-api-overlay modal-overlay"
      dialogClassName="populate-api-modal modal"
      bodyClassName="populate-api-body"
      showExpandButton={false}
      closeButtonKind="none"
      closeOnOverlayClick={false}
      footer={
        step === 'map' ? (
          <div className="populate-api-footer">
            <div className="populate-api-footer-top">
              <div className="populate-api-footer-info">
                {insertMode === 'append'
                  ? <>{selectedCount} of {arrayItems.length} rows selected{duplicateCount > 0 && <span className="populate-api-dedup-info"> · {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''}</span>} · {enabledMappings.length} fields mapped</>
                  : <>{arrayItems.length} rows from <code>{selectedArray}</code> · {enabledMappings.length} fields mapped</>
                }
              </div>
              <div className="populate-api-footer-controls">
                <select
                  className="populate-api-mode-select"
                  value={insertMode}
                  onChange={e => setInsertMode(e.target.value as 'append' | 'replace')}
                >
                  <option value="append">Append to existing rows</option>
                  <option value="replace">Replace all rows</option>
                </select>
              </div>
            </div>
            <div className="populate-api-footer-actions">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={enabledMappings.length === 0 || (insertMode === 'append' ? selectedCount === 0 : arrayItems.length === 0)}
                onClick={handlePopulate}
              >
                {insertMode === 'append'
                  ? `Populate ${selectedCount} Row${selectedCount !== 1 ? 's' : ''}`
                  : `Populate ${arrayItems.length} Rows`
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="populate-api-footer-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        )
      }
    >
      {step === 'fetch' && (
        <PopulateFetchStep
          draft={draft}
          dataTable={dataTable}
          loading={loading}
          error={error}
          lastRequest={lastRequest}
          lastResponse={lastResponse}
          onFetch={() => void handleFetch()}
        />
      )}

      {step === 'map' && (
        <PopulateMapStep
          detectedArrays={detectedArrays}
          selectedArray={selectedArray}
          onArrayChange={handleArrayChange}
          arrayItems={arrayItems}
          fieldMappings={fieldMappings}
          onToggleField={toggleField}
          onChangeFieldType={changeFieldType}
          enabledMappings={enabledMappings}
          insertMode={insertMode}
          duplicateFlags={duplicateFlags}
          duplicateCount={duplicateCount}
          effectiveSelections={effectiveSelections}
          onRowSelectionChange={setRowSelections}
        />
      )}
    </AppModalFrame>,
    document.body,
  );
}
