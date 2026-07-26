import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ExportChoice, ImportChoice } from './ImportExportChoiceModal';

type TestEditorInputMode = 'builder' | 'curlImport' | 'curlExport';

interface TestEditorModalHeaderActionsProps {
  inputMode: TestEditorInputMode;
  onInputModeChange: (mode: TestEditorInputMode) => void;
  isHttp: boolean;
  triggerCurlGeneration: () => void;
  importDropdownOpen: boolean;
  setImportDropdownOpen: Dispatch<SetStateAction<boolean>>;
  exportDropdownOpen: boolean;
  setExportDropdownOpen: Dispatch<SetStateAction<boolean>>;
  importDropdownRef: MutableRefObject<HTMLDivElement | null>;
  exportDropdownRef: MutableRefObject<HTMLDivElement | null>;
  hasDataSource: boolean;
  onImportChoice: (choice: ImportChoice) => void;
  onExportChoice: (choice: ExportChoice) => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
}

export default function TestEditorModalHeaderActions({
  inputMode,
  onInputModeChange,
  isHttp,
  triggerCurlGeneration,
  importDropdownOpen,
  setImportDropdownOpen,
  exportDropdownOpen,
  setExportDropdownOpen,
  importDropdownRef,
  exportDropdownRef,
  hasDataSource,
  onImportChoice,
  onExportChoice,
  onCancel,
  onSave,
  canSave,
}: TestEditorModalHeaderActionsProps) {
  return (
    <>
      <div className="mode-toggle">
        <button type="button" className={`mode-btn ${inputMode === 'builder' ? 'active' : ''}`} onClick={() => onInputModeChange('builder')}>Builder</button>
        {isHttp && (
          <button type="button" className={`mode-btn ${inputMode === 'curlImport' ? 'active' : ''}`} onClick={() => onInputModeChange('curlImport')}>cURL Import</button>
        )}
        {isHttp && (
          <button
            type="button"
            className={`mode-btn ${inputMode === 'curlExport' ? 'active' : ''}`}
            onClick={() => {
              onInputModeChange('curlExport');
              triggerCurlGeneration();
            }}
          >
            cURL Export
          </button>
        )}
        <div className="mode-btn-dropdown-wrapper" ref={importDropdownRef}>
          <button
            type="button"
            className={`mode-btn ${importDropdownOpen ? 'active' : ''}`}
            onClick={() => { setImportDropdownOpen((value) => !value); setExportDropdownOpen(false); }}
          >
            Import ▾
          </button>
          {importDropdownOpen && (
            <div className="mode-btn-dropdown">
              <button type="button" className="mode-btn-dropdown-item" onClick={() => onImportChoice('test-definition')}>
                <span className="mode-btn-dropdown-label">Test Definition</span>
                <span className="mode-btn-dropdown-desc">Load a saved test configuration (.json)</span>
              </button>
              <button type="button" className="mode-btn-dropdown-item" disabled={!hasDataSource} onClick={() => onImportChoice('data-rows')}>
                <span className="mode-btn-dropdown-label">Data Rows</span>
                <span className="mode-btn-dropdown-desc">Import CSV or JSON data into the Data Source</span>
              </button>
            </div>
          )}
        </div>
        <div className="mode-btn-dropdown-wrapper" ref={exportDropdownRef}>
          <button
            type="button"
            className={`mode-btn ${exportDropdownOpen ? 'active' : ''}`}
            onClick={() => { setExportDropdownOpen((value) => !value); setImportDropdownOpen(false); }}
          >
            Export ▾
          </button>
          {exportDropdownOpen && (
            <div className="mode-btn-dropdown">
              <button type="button" className="mode-btn-dropdown-item" onClick={() => onExportChoice('test-definition')}>
                <span className="mode-btn-dropdown-label">Test Definition</span>
                <span className="mode-btn-dropdown-desc">Save test configuration as .json</span>
              </button>
              <button type="button" className="mode-btn-dropdown-item" onClick={() => onExportChoice('excel-template')}>
                <span className="mode-btn-dropdown-label">Excel Template</span>
                <span className="mode-btn-dropdown-desc">Structured .xlsx with metadata and data rows</span>
              </button>
              <button type="button" className="mode-btn-dropdown-item" disabled={!hasDataSource} onClick={() => onExportChoice('data-csv')}>
                <span className="mode-btn-dropdown-label">Data as CSV</span>
                <span className="mode-btn-dropdown-desc">Export Data Source rows as .csv</span>
              </button>
              <button type="button" className="mode-btn-dropdown-item" disabled={!hasDataSource} onClick={() => onExportChoice('data-json')}>
                <span className="mode-btn-dropdown-label">Data as JSON</span>
                <span className="mode-btn-dropdown-desc">Export Data Source rows as .json</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <button type="button" className="btn" data-testid="te-cancel-btn" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-primary" data-testid="te-save-btn" onClick={onSave} disabled={!canSave}>Save</button>
    </>
  );
}