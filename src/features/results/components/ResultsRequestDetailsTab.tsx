import { Fragment, useCallback } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { RequestResult, TestRun } from '../../../shared/types';
import type { GroupNode, GroupByLevel } from '../../test-runner/utils/resultsGrouping';
import { DataRowSummaryTable } from './DataRowSummaryTable';

interface Props {
  selectedRun: TestRun | null;
  filteredResults: RequestResult[];
  filterPassed: string;
  setFilterPassed: Dispatch<SetStateAction<string>>;
  resultTags: string[];
  resultTagFilter: string | null;
  setResultTagFilter: Dispatch<SetStateAction<string | null>>;
  groupBy: GroupByLevel;
  handleGroupByChange: (next: GroupByLevel) => void;
  subGroupOptions: Array<{ value: GroupByLevel; label: string }>;
  subGroupBy: GroupByLevel;
  setSubGroupBy: Dispatch<SetStateAction<GroupByLevel>>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  expanded: Set<string>;
  groupCount: number;
  isFlat: boolean;
  groupTree: GroupNode[];
  toggle: (key: string) => void;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  isWorkflowRun: boolean;
  onResultClick: (result: RequestResult) => void;
  renderErrorSnippet: (r: RequestResult) => ReactNode;
}

export function ResultsRequestDetailsTab({
  selectedRun,
  filteredResults,
  filterPassed,
  setFilterPassed,
  resultTags,
  resultTagFilter,
  setResultTagFilter,
  groupBy,
  handleGroupByChange,
  subGroupOptions,
  subGroupBy,
  setSubGroupBy,
  setExpanded,
  expanded,
  groupCount,
  isFlat,
  groupTree,
  toggle,
  searchTerm,
  setSearchTerm,
  page,
  setPage,
  pageSize,
  isWorkflowRun,
  onResultClick,
  renderErrorSnippet,
}: Props) {
  const applyDetailFilter = useCallback((results: RequestResult[]): RequestResult[] => {
    if (filterPassed === 'all') return results;
    return results.filter((r) => {
      const passed = !!r.passed;
      if (filterPassed === 'passed' && !passed) return false;
      if (filterPassed === 'failed' && passed) return false;
      if (filterPassed === 'failed-data-rows' && (passed || !r.dataRowId)) return false;
      return true;
    });
  }, [filterPassed]);

  const renderDetailRow = (r: RequestResult) => (
    <tr key={r.id} className={`group-detail-row ${r.passed ? '' : 'row-failed'} clickable-row`} onClick={() => onResultClick(r)}>
      <td className="result-id-cell">{r.id.replace(/^\D+/, '')}</td>
      <td className="group-detail-name">
        <span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span>
        {' '}{r.scenarioName}
        {r.dataRowLabel && <span className="data-row-label">{r.dataRowLabel}</span>}
      </td>
      <td colSpan={2} className="url-cell">{r.url}</td>
      <td>{r.httpStatus || 'ERR'}</td>
      <td><span className={`tag ${r.validationMode === 'none' ? 'tag-dim' : 'tag-info'}`}>{r.validationMode ?? 'none'}</span></td>
      <td>{r.responseTimeMs}</td>
      <td>{r.passed ? '✓' : '✗'}</td>
      <td className="failure-cell">
        {renderErrorSnippet(r)}
        {r.passed === false && !r.errorMessage && r.failureDetails.length > 0 && (
          <span className="error-snippet validation-snippet" onClick={(e) => { e.stopPropagation(); onResultClick(r); }} title="Click to view details">
            {r.failureDetails.length} validation failure{r.failureDetails.length > 1 ? 's' : ''}
          </span>
        )}
      </td>
    </tr>
  );

  const renderGroupRow = (g: GroupNode, depth: number, parentKey: string): ReactNode => {
    const nodeKey = parentKey ? `${parentKey}/${g.key}` : g.key;
    const isOpen = expanded.has(nodeKey);
    const allPassed = g.failed === 0 && g.validationFailed === 0;
    const hasChildren = g.children.length > 0;
    const indent = depth * 20;
    const visibleResults = applyDetailFilter(g.results);

    if (g.key === '' && depth === 0) {
      return (
        <Fragment key="__ungrouped__">
          {hasChildren && g.children.map((child) => renderGroupRow(child, depth, '__ungrouped__'))}
          {!hasChildren && visibleResults.length > 0 && (
            <>
              {visibleResults.some(r => r.dataRowId) && (
                <tr><td colSpan={9} className="data-row-summary-cell">
                  <DataRowSummaryTable results={visibleResults} scenarioName={g.key} onResultClick={onResultClick} />
                </td></tr>
              )}
              {!visibleResults.some(r => r.dataRowId) && (
                <>
                  <tr className="detail-header-row">
                    <th>ID</th><th>Test Name</th><th colSpan={2}>URL</th>
                    <th>Status</th><th>Validation</th><th>Time (ms)</th>
                    <th>Passed</th><th>Error / Details</th>
                  </tr>
                  {visibleResults.map(renderDetailRow)}
                </>
              )}
            </>
          )}
        </Fragment>
      );
    }

    return (
      <Fragment key={nodeKey}>
        <tr className={`group-header-row depth-${depth} ${allPassed ? '' : 'group-has-failures'}`} onClick={() => toggle(nodeKey)}>
          <td className="group-chevron" style={{ paddingLeft: indent }}>{isOpen ? '▼' : '▶'}</td>
          <td className="group-key">{g.key}</td>
          <td>{g.total}</td>
          <td className="group-passed">{g.passed}</td>
          <td className={g.failed > 0 ? 'group-failed' : ''}>{g.failed}</td>
          <td className={g.validationFailed > 0 ? 'group-val-failed' : ''}>{g.validationFailed}</td>
          <td>{g.avgTime}</td>
          <td>{g.minTime}</td>
          <td>{g.maxTime}</td>
        </tr>
        {isOpen && hasChildren && g.children.map((child) => renderGroupRow(child, depth + 1, nodeKey))}
        {isOpen && !hasChildren && visibleResults.length > 0 && (
          <>
            {visibleResults.some(r => r.dataRowId) && (
              <tr><td colSpan={9} className="data-row-summary-cell">
                <DataRowSummaryTable results={visibleResults} scenarioName={g.key} onResultClick={onResultClick} />
              </td></tr>
            )}
            {!visibleResults.some(r => r.dataRowId) && (
              <>
                <tr className="detail-header-row">
                  <th>ID</th>
                  <th>Test Name</th>
                  <th colSpan={2}>URL</th>
                  <th>Status</th>
                  <th>Validation</th>
                  <th>Time (ms)</th>
                  <th>Passed</th>
                  <th>Error / Details</th>
                </tr>
                {visibleResults.map(renderDetailRow)}
              </>
            )}
          </>
        )}
      </Fragment>
    );
  };

  return (
    <div className="section">
      <div className="filter-row">
        <select value={filterPassed} onChange={(e) => { setFilterPassed(e.target.value); setPage(0); }}>
          <option value="all">All Results</option>
          <option value="passed">Passed Only</option>
          <option value="failed">Failed Only</option>
          {selectedRun?.results.some(r => r.dataRowId) && (
            <option value="failed-data-rows">Failed Data Rows</option>
          )}
        </select>

        <div className="group-by-controls">
          <label className="group-by-label">Group by</label>
          <select value={groupBy} onChange={(e) => handleGroupByChange(e.target.value as GroupByLevel)}>
            <option value="feature">Feature</option>
            <option value="group">Scenario</option>
            <option value="test">Test Name (flat)</option>
            {isWorkflowRun && <option value="iteration">Iteration</option>}
            {isWorkflowRun && <option value="workflowStep">Workflow Step</option>}
          </select>
          {subGroupOptions.length > 0 && (
            <select value={subGroupBy} onChange={(e) => { setSubGroupBy(e.target.value as GroupByLevel); setExpanded(new Set()); }}>
              {subGroupOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>

        {resultTags.length > 0 && (
          <div className="results-tag-filter">
            <span className="results-tag-label">Tags:</span>
            <button className={`results-tag-chip ${!resultTagFilter ? 'active' : ''}`} onClick={() => { setResultTagFilter(null); setPage(0); }}>
              All
            </button>
            {resultTags.map(tag => (
              <button
                key={tag}
                className={`results-tag-chip ${resultTagFilter === tag ? 'active' : ''}`}
                onClick={() => { setResultTagFilter(resultTagFilter === tag ? null : tag); setPage(0); }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <span className="filter-count">
          {isFlat ? `${filteredResults.length} results` : `${groupCount} groups · ${filteredResults.length} results`}
        </span>
        <input
          className="results-search"
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
        />
      </div>

      {!isFlat ? (
        <div className="table-container">
          <table className="grouped-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>{groupBy === 'feature' ? 'Feature' : 'Scenario'}</th>
                <th>Total</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Val. Failed</th>
                <th>Avg (ms)</th>
                <th>Min (ms)</th>
                <th>Max (ms)</th>
              </tr>
            </thead>
            <tbody>{groupTree.map((g) => renderGroupRow(g, 0, ''))}</tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Scenario</th>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Time (ms)</th>
                <th>Validation</th>
                <th>Passed</th>
                <th>Failure Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.slice(page * pageSize, (page + 1) * pageSize).map((r) => (
                <tr key={r.id} className={`${r.passed ? '' : 'row-failed'} clickable-row`} onClick={() => onResultClick(r)}>
                  <td className="result-id-cell">{r.id.replace(/^\D+/, '')}</td>
                  <td>{r.scenarioName}{r.dataRowLabel && <span className="data-row-label">{r.dataRowLabel}</span>}</td>
                  <td><span className={`method-badge method-${r.method.toLowerCase()}`}>{r.method}</span></td>
                  <td className="url-cell">{r.url}</td>
                  <td>{r.httpStatus || 'ERR'}</td>
                  <td>{r.responseTimeMs}</td>
                  <td><span className={`tag ${r.validationMode === 'none' ? 'tag-dim' : 'tag-info'}`}>{r.validationMode ?? 'none'}</span></td>
                  <td>{r.passed ? '✓' : '✗'}</td>
                  <td className="failure-cell">
                    {renderErrorSnippet(r)}
                    {r.passed === false && !r.errorMessage && r.failureDetails.length > 0 && (
                      <span className="error-snippet validation-snippet" onClick={(e) => { e.stopPropagation(); onResultClick(r); }} title="Click to view details">
                        {r.failureDetails.length} validation failure{r.failureDetails.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredResults.length > pageSize && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(0)}>First</button>
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <span className="pagination-info">
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredResults.length)} of {filteredResults.length}
              </span>
              <button className="btn btn-sm" disabled={(page + 1) * pageSize >= filteredResults.length} onClick={() => setPage((p) => p + 1)}>Next</button>
              <button className="btn btn-sm" disabled={(page + 1) * pageSize >= filteredResults.length} onClick={() => setPage(Math.ceil(filteredResults.length / pageSize) - 1)}>Last</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
