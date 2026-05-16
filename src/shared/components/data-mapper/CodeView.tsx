import { useEffect, useMemo, useRef, useState } from 'react';
import { getByPath } from '../../utils/jsonPath';
import type { Assertion } from '../../types';
import type { ExpressionFunction, MapperSource, Mapping } from './types';
import { evaluateMapperExpression, resolveMapperPath } from './utils/mapperExpressionEvaluator';
import { coerceSampleData } from './utils/mapperParsing';
import { normalizeMapperPath } from './utils/pathNormalization';
import { debugExpression } from './utils/expressionStepDebugger';
import {
  formatAssertionLine,
  formatAssertionSummary,
  getAssertionJsonPath,
  ARRAY_ASSERTION_LABELS,
} from './utils/targetTreeHelpers';
import type { MappingTrace } from './utils/mappingTrace';

interface CodeViewProps {
  mappings: Mapping[];
  assertions?: Assertion[];
  sources?: MapperSource[];
  activeSourceId?: string;
  targetSampleData?: unknown;
  customFunctions?: ExpressionFunction[];
  debugMode?: boolean;
  traceByMappingId?: Map<string, MappingTrace> | null;
  verifyStatus?: string;
  failedMappingIds?: Set<string>;
}

function formatMapping(m: Mapping): string {
  const target = m.targetPath || '(unmapped)';
  const source = m.sourcePath || '(unknown)';
  if (m.expression) {
    return `${target} ← ${m.expression}`;
  }
  return `${target} ← ${source}`;
}

function formatPreviewValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isSamePreviewValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return String(left) === String(right);
  }
}

interface MappingTableRow {
  id: string;
  lineNo: number;
  sourceId: string;
  sourcePath: string;
  targetPath: string;
  sourceText: string;
  expression?: string;
  sourceRaw: unknown;
  beforeRaw: unknown;
  afterRaw: unknown;
  errorText?: string;
  beforeValue: string;
  afterValue: string;
  status: 'changed' | 'unchanged' | 'error' | 'passed' | 'failed';
}

interface MappingTraceSnapshot {
  sourceValue: unknown;
  evaluatedValue: unknown;
  targetValue: unknown;
  durationMs: number;
  error?: string;
  origin: 'runtime' | 'preview';
}

interface TraceStepRow {
  id: string;
  label: string;
  expression: string;
  displayValue: string;
  error?: string;
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 'n/a';
  return `${durationMs.toFixed(3)} ms`;
}

export default function CodeView({
  mappings,
  assertions = [],
  sources = [],
  activeSourceId,
  targetSampleData,
  customFunctions,
  debugMode = false,
  traceByMappingId = null,
  verifyStatus: _verifyStatus,
  failedMappingIds: _failedMappingIds,
}: CodeViewProps) {
  const [viewMode, setViewMode] = useState<'code' | 'table'>('code');
  const [tableLayout, setTableLayout] = useState<'list' | 'pivot'>('list');
  const [tableSearch, setTableSearch] = useState('');
  const [focusMatches, setFocusMatches] = useState(false);
  const [selectedTraceRowId, setSelectedTraceRowId] = useState<string | null>(null);
  const tracePanelRef = useRef<HTMLDivElement>(null);

  const assertionLines = useMemo(() => {
    if (assertions.length === 0) return [];
    return assertions.map(formatAssertionLine);
  }, [assertions]);

  const lines = useMemo(() => {
    if (mappings.length === 0 && assertions.length === 0) return ['// No mappings or assertions defined'];
    const sorted = [...mappings].sort((a, b) => a.targetPath.localeCompare(b.targetPath));
    return sorted.map(formatMapping);
  }, [mappings, assertions]);

  const tableRows = useMemo<MappingTableRow[]>(() => {
    const sorted = [...mappings].sort((a, b) => a.targetPath.localeCompare(b.targetPath));
    const parsedTargetData = coerceSampleData(targetSampleData);
    const resolvedActiveSourceId = activeSourceId ?? sources[0]?.id ?? '';

    return sorted.map((mapping, index) => {
      const mappingSourceId = mapping.sourceId || resolvedActiveSourceId;
      const normalizedTargetPath = normalizeMapperPath(mapping.targetPath);
      const beforeRaw = parsedTargetData == null ? undefined : getByPath(parsedTargetData, normalizedTargetPath);
      const beforeValue = formatPreviewValue(beforeRaw);

      let sourceRaw: unknown;
      try {
        sourceRaw = resolveMapperPath(mapping.sourcePath, sources, mappingSourceId);
      } catch {
        sourceRaw = undefined;
      }

      let status: MappingTableRow['status'];
      let errorText: string | undefined;
      let afterRaw: unknown;
      let afterValue: string;
      try {
        if (mapping.expression) {
          const result = evaluateMapperExpression(
            mapping.expression,
            sources,
            mappingSourceId,
            customFunctions,
          );
          if (result.error) {
            status = 'error';
            errorText = result.error;
            afterRaw = undefined;
            afterValue = `Error: ${errorText}`;
          } else {
            afterRaw = result.value;
            afterValue = formatPreviewValue(afterRaw);
            status = isSamePreviewValue(beforeRaw, afterRaw) ? 'unchanged' : 'changed';
          }
        } else {
          afterRaw = sourceRaw;
          afterValue = formatPreviewValue(afterRaw);
          status = isSamePreviewValue(beforeRaw, afterRaw) ? 'unchanged' : 'changed';
        }
      } catch (error) {
        status = 'error';
        errorText = error instanceof Error ? error.message : 'Evaluation failed';
        afterRaw = undefined;
        afterValue = `Error: ${errorText}`;
      }

      return {
        id: mapping.id,
        lineNo: index + 1,
        sourceId: mappingSourceId,
        sourcePath: mapping.sourcePath,
        targetPath: mapping.targetPath || '(unmapped)',
        sourceText: mapping.expression ? mapping.expression : (mapping.sourcePath || '(unknown)'),
        expression: mapping.expression,
        sourceRaw,
        beforeRaw,
        afterRaw,
        errorText,
        beforeValue,
        afterValue,
        status,
      };
    });
  }, [mappings, sources, activeSourceId, targetSampleData, customFunctions]);

  const normalizedSearch = tableSearch.trim().toLowerCase();
  const matchingIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();
    const matches = new Set<string>();
    for (const row of tableRows) {
      const haystack = `${row.targetPath} ${row.sourceText} ${row.beforeValue} ${row.afterValue}`.toLowerCase();
      if (haystack.includes(normalizedSearch)) {
        matches.add(row.id);
      }
    }
    return matches;
  }, [tableRows, normalizedSearch]);

  const visibleRows = useMemo(() => {
    if (!normalizedSearch || !focusMatches) return tableRows;
    return tableRows.filter((row) => matchingIds.has(row.id));
  }, [tableRows, normalizedSearch, focusMatches, matchingIds]);

  const pivotData = useMemo(() => {
    const rows = visibleRows;
    const colSet = new Set<string>();
    const rowMap = new Map<string, Map<string, { afterValue: string; beforeValue: string }>>();

    for (const r of rows) {
      const lastDot = r.targetPath.lastIndexOf('.');
      const rowKey = lastDot === -1 ? '(root)' : r.targetPath.slice(0, lastDot);
      const field = lastDot === -1 ? r.targetPath : r.targetPath.slice(lastDot + 1);
      colSet.add(field);
      let row = rowMap.get(rowKey);
      if (!row) { row = new Map(); rowMap.set(rowKey, row); }
      row.set(field, { afterValue: r.afterValue, beforeValue: r.beforeValue });
    }

    const columns = Array.from(colSet);
    const pivotRows = Array.from(rowMap.entries()).map(([key, cells]) => ({ key, cells }));

    const firstKey = pivotRows[0]?.key || '';
    const bracketIdx = firstKey.lastIndexOf('[');
    const arrayPrefix = bracketIdx > 0 && pivotRows.every((r) => /\[\d+\]$/.test(r.key))
      ? firstKey.slice(0, bracketIdx) : '';

    if (arrayPrefix) {
      pivotRows.sort((a, b) => {
        const ai = parseInt(a.key.match(/\[(\d+)\]$/)?.[1] || '0', 10);
        const bi = parseInt(b.key.match(/\[(\d+)\]$/)?.[1] || '0', 10);
        return ai - bi;
      });
    }

    return { columns, rows: pivotRows, arrayPrefix };
  }, [visibleRows]);

  const canPivot = !!pivotData.arrayPrefix && pivotData.rows.length > 0;

  useEffect(() => {
    if (viewMode !== 'table' && selectedTraceRowId) {
      setSelectedTraceRowId(null);
    }
  }, [viewMode, selectedTraceRowId]);

  useEffect(() => {
    if (!selectedTraceRowId) return;
    if (!tableRows.some((row) => row.id === selectedTraceRowId)) {
      setSelectedTraceRowId(null);
    }
  }, [selectedTraceRowId, tableRows]);

  useEffect(() => {
    if (selectedTraceRowId && tracePanelRef.current?.scrollIntoView) {
      tracePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedTraceRowId]);

  const selectedTraceRow = useMemo(
    () => selectedTraceRowId ? tableRows.find((row) => row.id === selectedTraceRowId) ?? null : null,
    [selectedTraceRowId, tableRows],
  );

  const selectedTrace = useMemo<MappingTraceSnapshot | null>(() => {
    if (!selectedTraceRow) return null;
    const runtimeTrace = debugMode ? traceByMappingId?.get(selectedTraceRow.id) : undefined;
    if (runtimeTrace) {
      return {
        sourceValue: runtimeTrace.sourceValue,
        evaluatedValue: runtimeTrace.evaluatedValue,
        targetValue: runtimeTrace.targetValue,
        durationMs: runtimeTrace.durationMs,
        error: runtimeTrace.error,
        origin: 'runtime',
      };
    }
    return {
      sourceValue: selectedTraceRow.sourceRaw,
      evaluatedValue: selectedTraceRow.afterRaw,
      targetValue: selectedTraceRow.afterRaw,
      durationMs: 0,
      error: selectedTraceRow.errorText,
      origin: 'preview',
    };
  }, [selectedTraceRow, debugMode, traceByMappingId]);

  const traceSteps = useMemo<TraceStepRow[]>(() => {
    if (!selectedTraceRow || !selectedTrace) return [];
    const sourceRef = selectedTraceRow.sourcePath
      ? `$.${normalizeMapperPath(selectedTraceRow.sourcePath)}`
      : '(unknown source)';
    const steps: TraceStepRow[] = [
      {
        id: 'source-input',
        label: 'Source Input',
        expression: sourceRef,
        displayValue: formatPreviewValue(selectedTrace.sourceValue),
      },
    ];
    if (selectedTraceRow.expression) {
      const debugResult = debugExpression(
        selectedTraceRow.expression,
        sources,
        selectedTraceRow.sourceId,
        customFunctions,
      );
      debugResult.steps.forEach((step, index) => {
        steps.push({
          id: `expr-${index}`,
          label: step.label,
          expression: step.expression,
          displayValue: step.displayValue,
          error: step.error,
        });
      });
    } else {
      steps.push({
        id: 'path-resolution',
        label: 'Path Resolution',
        expression: sourceRef,
        displayValue: formatPreviewValue(selectedTrace.evaluatedValue),
        error: selectedTrace.error,
      });
    }
    steps.push({
      id: 'target-output',
      label: 'Target Output',
      expression: selectedTraceRow.targetPath,
      displayValue: selectedTrace.error
        ? `Error: ${selectedTrace.error}`
        : formatPreviewValue(selectedTrace.targetValue),
      error: selectedTrace.error,
    });
    return steps;
  }, [selectedTraceRow, selectedTrace, sources, customFunctions]);

  return (
    <div className="dm-code-view" role="region" aria-label="Mapping code view">
      <div className="dm-code-view-header">
        <span className="dm-code-view-title">Mapping View</span>
        <span className="dm-code-view-count">
          {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
          {assertions.length > 0 && ` · ${assertions.length} assertion${assertions.length !== 1 ? 's' : ''}`}
        </span>
        <div className="dm-code-view-mode-toggle" role="tablist" aria-label="Mapping view mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'code'}
            className={`dm-code-view-mode-btn ${viewMode === 'code' ? 'dm-code-view-mode-btn--active' : ''}`}
            onClick={() => setViewMode('code')}
          >
            Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            className={`dm-code-view-mode-btn ${viewMode === 'table' ? 'dm-code-view-mode-btn--active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>
      </div>
      {viewMode === 'code' ? (
        <pre className="dm-code-view-content">
          {lines.map((line, i) => (
            <div key={`m-${i}`} className="dm-code-view-line">
              <span className="dm-code-view-line-no">{i + 1}</span>
              <span className="dm-code-view-line-text">{line}</span>
            </div>
          ))}
          {assertionLines.length > 0 && (
            <>
              <div className="dm-code-view-line dm-code-view-separator">
                <span className="dm-code-view-line-no" />
                <span className="dm-code-view-line-text dm-code-view-section-label">— Assertions —</span>
              </div>
              {assertionLines.map((line, i) => (
                <div key={`a-${i}`} className="dm-code-view-line dm-code-view-line--assertion">
                  <span className="dm-code-view-line-no">{lines.length + i + 1}</span>
                  <span className="dm-code-view-line-text">{line}</span>
                </div>
              ))}
            </>
          )}
        </pre>
      ) : (
        <div className="dm-code-table-wrap">
          <div className="dm-code-table-toolbar">
            <input
              type="text"
              className="dm-code-table-search"
              aria-label="Search mapping rows"
              placeholder="Search target/source/value..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
            <label className="dm-code-table-focus-toggle">
              <input
                type="checkbox"
                checked={focusMatches}
                onChange={(e) => setFocusMatches(e.target.checked)}
              />
              Focus matches
            </label>
            <span className="dm-code-table-meta">
              {normalizedSearch
                ? `${matchingIds.size} match${matchingIds.size !== 1 ? 'es' : ''}`
                : `${tableRows.length} row${tableRows.length !== 1 ? 's' : ''}`}
              {assertions.length > 0 && ` · ${assertions.length} assertion${assertions.length !== 1 ? 's' : ''}`}
              {debugMode && traceByMappingId
                ? ` · ${traceByMappingId.size} runtime trace${traceByMappingId.size !== 1 ? 's' : ''}`
                : ''}
            </span>
            {canPivot && (
              <div className="validation-fields-view-toggle" role="tablist" aria-label="Table layout mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableLayout === 'list'}
                  className={`validation-fields-view-btn ${tableLayout === 'list' ? 'is-active' : ''}`}
                  onClick={() => setTableLayout('list')}
                >
                  List
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableLayout === 'pivot'}
                  className={`validation-fields-view-btn ${tableLayout === 'pivot' ? 'is-active' : ''}`}
                  onClick={() => setTableLayout('pivot')}
                >
                  Table
                </button>
              </div>
            )}
          </div>
          {(!canPivot || tableLayout === 'list') ? (
            <table className="dm-code-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Target</th>
                  <th>Source / Expression</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Trace</th>
                  <th title="Click Verify All for pass/fail">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="dm-code-table-empty">No rows match the current search.</td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const isMatch = !normalizedSearch || matchingIds.has(row.id);
                    const isSelectedTrace = selectedTraceRowId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={`dm-code-table-row dm-code-table-row--${row.status} ${isMatch ? 'dm-code-table-row--match' : ''}`}
                      >
                        <td>{row.lineNo}</td>
                        <td title={row.targetPath}>
                          <span className="dm-code-table-cell-path">{row.targetPath}</span>
                        </td>
                        <td title={row.sourceText}>
                          <span className="dm-code-table-cell-source">
                            {row.expression ? (
                              <span className="dm-code-table-expression">fx {row.sourceText}</span>
                            ) : (
                              row.sourceText
                            )}
                          </span>
                        </td>
                        <td title={row.beforeValue}>
                          <span className="dm-code-table-cell-value">{row.beforeValue}</span>
                        </td>
                        <td title={row.afterValue}>
                          <span className="dm-code-table-cell-value">{row.afterValue}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`dm-code-trace-btn ${isSelectedTrace ? 'dm-code-trace-btn--active' : ''}`}
                            aria-label={`Inspect trace for ${row.targetPath}`}
                            onClick={() => setSelectedTraceRowId((prev) => (prev === row.id ? null : row.id))}
                          >
                            {isSelectedTrace ? 'Hide' : 'Inspect'}
                          </button>
                        </td>
                        <td>
                          <span className={`dm-code-table-status dm-code-table-status--${row.status}`}>
                            {row.status === 'passed' ? '✓ pass'
                              : row.status === 'failed' ? '✗ fail'
                              : row.status === 'error' ? '⚠ error'
                              : row.status === 'unchanged' ? '— same'
                              : '△ changed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
                {assertions.length > 0 && (
                  <>
                    <tr className="dm-code-table-row dm-code-table-row--section">
                      <td colSpan={7} className="dm-code-table-section-label">Assertions ({assertions.length})</td>
                    </tr>
                    {assertions.map((a, i) => {
                      const meta = ARRAY_ASSERTION_LABELS[a.type];
                      const label = meta?.label ?? a.type.toUpperCase();
                      const jsonPath = getAssertionJsonPath(a);
                      const summary = formatAssertionSummary(a);
                      return (
                        <tr key={`assertion-${i}`} className="dm-code-table-row dm-code-table-row--assertion">
                          <td>{visibleRows.length + i + 1}</td>
                          <td title={jsonPath}><span className="dm-code-table-cell-path">{jsonPath}</span></td>
                          <td><span className="dm-code-table-cell-assertion-type">{label}</span></td>
                          <td colSpan={2}><span className="dm-code-table-cell-value">{summary}</span></td>
                          <td />
                          <td>assertion</td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="validation-fields-pivot-table">
                <thead>
                  <tr>
                    <th className="validation-fields-pivot-row-header">{pivotData.arrayPrefix || 'Path'}</th>
                    {pivotData.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivotData.rows.map((row) => {
                    const indexMatch = row.key.match(/\[(\d+)\]$/);
                    const label = pivotData.arrayPrefix && indexMatch ? `#${indexMatch[1]}` : row.key;
                    return (
                      <tr key={row.key}>
                        <td className="validation-fields-pivot-row-header"><code>{label}</code></td>
                        {pivotData.columns.map((col) => {
                          const cell = row.cells.get(col);
                          return (
                            <td key={col}>
                              {cell ? (
                                <code className="validation-fields-pivot-val">{cell.afterValue}</code>
                              ) : (
                                <span className="validation-fields-pivot-empty">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {assertions.length > 0 && (
                <table className="dm-code-assertion-summary">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Type</th>
                      <th>Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assertions.map((a, i) => {
                      const meta = ARRAY_ASSERTION_LABELS[a.type];
                      const label = meta?.label ?? a.type.toUpperCase();
                      return (
                        <tr key={`pa-${i}`} className="dm-code-table-row--assertion">
                          <td>{getAssertionJsonPath(a)}</td>
                          <td><span className="dm-code-table-cell-assertion-type">{label}</span></td>
                          <td>{formatAssertionSummary(a)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {selectedTraceRow && selectedTrace && (
            <div ref={tracePanelRef} className="dm-code-trace-panel" role="region" aria-label="Row trace inspector">
              <div className="dm-code-trace-panel-head">
                <span className="dm-code-trace-panel-title">Trace · {selectedTraceRow.targetPath}</span>
                <span className={`dm-code-trace-panel-origin dm-code-trace-panel-origin--${selectedTrace.origin}`}>
                  {selectedTrace.origin === 'runtime' ? 'Runtime trace' : 'Preview trace'}
                </span>
                <button
                  type="button"
                  className="dm-code-trace-btn dm-code-trace-btn--close"
                  onClick={() => setSelectedTraceRowId(null)}
                >
                  Close
                </button>
              </div>
              <div className="dm-code-trace-panel-meta">
                <span>Source: {selectedTraceRow.sourcePath || '(unknown)'}</span>
                <span>Duration: {formatDuration(selectedTrace.durationMs)}</span>
                {selectedTrace.error && (
                  <span className="dm-code-trace-panel-error">Error: {selectedTrace.error}</span>
                )}
              </div>
              <div className="dm-code-trace-steps">
                {traceSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`dm-code-trace-step ${step.error ? 'dm-code-trace-step--error' : ''}`}
                  >
                    <span className="dm-code-trace-step-label">{step.label}</span>
                    <code className="dm-code-trace-step-expression">{step.expression}</code>
                    <span className="dm-code-trace-step-arrow">→</span>
                    <code className="dm-code-trace-step-value">{step.displayValue}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
