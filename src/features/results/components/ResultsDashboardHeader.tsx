import { useRef } from 'react';
import type { TestRun } from '../../../shared/types';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { exportJson, exportCsv } from '../../../shared/utils/export';
import { hasExecutionTrace } from '../../../shared/utils/traceCompression';
import { ResultsContextTags } from './ResultsContextTags';

type RunTypeFilter = 'all' | 'test' | 'workflow';

interface Props {
  selectedRun: TestRun | null;
  importError: string | null;
  traceLoading: boolean;
  reportMenuOpen: boolean;
  onRefresh: () => void;
  onImportTrace: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenResultsExplorer: () => void;
  onGenerateReport: (format: 'html' | 'json' | 'markdown') => void;
  onDelete: (runId: string) => void;
  onReportMenuToggle: () => void;
  setImportError: (error: string | null) => void;
  setReplayTrace: (trace: WorkflowExecutionTrace | null) => void;
  setImportedFileName: (name: string | null) => void;
  setShowReplayModal: (show: boolean) => void;
}

export function ResultsDashboardHeader({
  selectedRun,
  importError,
  traceLoading,
  reportMenuOpen,
  onRefresh,
  onImportTrace,
  onOpenResultsExplorer,
  onGenerateReport,
  onDelete,
  onReportMenuToggle,
}: Props) {
  const importFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="results-top-row">
      <h2>Results</h2>
      {selectedRun && (
        <ResultsContextTags selectedRun={selectedRun} />
      )}
      {importError && <div className="results-import-error">{importError}</div>}
      <div className="results-top-actions">
        <button className="btn" onClick={onRefresh}>Refresh</button>
        <button className="btn" onClick={() => importFileRef.current?.click()} title="Import a previously exported trace JSON file">
          📂 Import Trace
        </button>
        <input ref={importFileRef} type="file" accept=".json" onChange={onImportTrace} style={{ display: 'none' }} data-testid="import-trace-input" />
        {selectedRun && (
          <>
            {hasExecutionTrace(selectedRun) && (
              <button
                className="btn btn-primary"
                onClick={onOpenResultsExplorer}
                disabled={traceLoading}
                title="Explore execution results"
              >
                {traceLoading ? '⏳ Loading trace…' : '📊 Results Explorer'}
              </button>
            )}
            <button className="btn" onClick={() => exportJson(selectedRun)} data-testid="results-export-json-btn">Export JSON</button>
            <button className="btn" onClick={() => exportCsv(selectedRun.results, selectedRun.envName, selectedRun.svcName)}>Export CSV</button>
            <div className="report-menu-wrapper">
              <button className="btn" onClick={onReportMenuToggle}>Generate Report ▾</button>
              {reportMenuOpen && (
                <div className="report-menu-dropdown">
                  <button className="report-menu-item" onClick={() => onGenerateReport('html')}>HTML Report</button>
                  <button className="report-menu-item" onClick={() => onGenerateReport('json')}>JSON Report</button>
                  <button className="report-menu-item" onClick={() => onGenerateReport('markdown')}>Markdown Report</button>
                </div>
              )}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(selectedRun.id)}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
}

interface RunTypeFilterTabsProps {
  runTypeFilter: RunTypeFilter;
  runCounts: { all: number; test: number; workflow: number };
  onFilterChange: (filter: RunTypeFilter) => void;
}

export function RunTypeFilterTabs({ runTypeFilter, runCounts, onFilterChange }: RunTypeFilterTabsProps) {
  return (
    <div className="results-run-filter-tabs">
      <button
        className={`run-filter-tab ${runTypeFilter === 'all' ? 'active' : ''}`}
        onClick={() => onFilterChange('all')}
      >
        All Runs ({runCounts.all})
      </button>
      <button
        className={`run-filter-tab ${runTypeFilter === 'test' ? 'active' : ''}`}
        onClick={() => onFilterChange('test')}
      >
        🧪 Test Runs ({runCounts.test})
      </button>
      <button
        className={`run-filter-tab ${runTypeFilter === 'workflow' ? 'active' : ''}`}
        onClick={() => onFilterChange('workflow')}
      >
        ⚡ Workflow Runs ({runCounts.workflow})
      </button>
    </div>
  );
}
