import { useMemo, useState, useCallback } from 'react';
import type { WorkflowIterationTrace } from '@shared/types';
import { truncate } from '@shared/utils/helpers';
import { formatDurationMs } from '@shared/utils/formatDuration';
import { isSampledIteration } from '../utils/sampledIterations';

type SortField = 'iteration' | 'status' | 'total' | string;
type SortDirection = 'asc' | 'desc';
type FilterMode = 'all' | 'failed' | 'slowest';

interface Props {
  iterations: WorkflowIterationTrace[];
  nodes: Array<{ id: string; type: string; data?: { label?: string } }>;
  selectedIteration?: number;
  selectedNodeId?: string;
  onIterationSelect: (index: number) => void;
  onCellSelect: (iterationIndex: number, nodeId: string) => void;
}

interface IterationRow {
  originalIndex: number;
  passed: boolean;
  totalDurationMs: number;
  httpDurationMs: number;
  overheadMs: number;
  error?: string;
  nodeDurations: Map<string, { durationMs?: number; state: 'pass' | 'fail' | 'skipped' }>;
  sampled: boolean;
}

export default function IterationMatrixTable({
  iterations,
  nodes,
  selectedIteration,
  selectedNodeId,
  onIterationSelect,
  onCellSelect,
}: Props) {
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Get HTTP nodes only (the ones that have timing data)
  const httpNodes = useMemo(() => {
    return nodes.filter(n => n.type === 'http');
  }, [nodes]);

  // Build row data with node durations
  const rows = useMemo<IterationRow[]>(() => {
    return iterations.map((iter) => {
      const nodeDurations = new Map<string, { durationMs?: number; state: 'pass' | 'fail' | 'skipped' }>();
      
      for (const node of httpNodes) {
        const nodeEvents = iter.events.filter(e => e.nodeId === node.id);
        if (nodeEvents.length === 0) {
          nodeDurations.set(node.id, { durationMs: undefined, state: 'skipped' });
        } else {
          const totalDuration = nodeEvents.reduce((sum, e) => sum + (e.durationMs || 0), 0);
          const hasFailure = nodeEvents.some(e => e.state === 'fail');
          const hasPass = nodeEvents.some(e => e.state === 'pass');
          nodeDurations.set(node.id, {
            durationMs: totalDuration || undefined,
            state: hasFailure ? 'fail' : hasPass ? 'pass' : 'skipped',
          });
        }
      }

      let error: string | undefined;
      if (!iter.passed) {
        const failedEvent = iter.events.find(e => e.state === 'fail' && e.details?.error);
        error = failedEvent?.details?.error;
      }

      let httpSum = 0;
      for (const entry of nodeDurations.values()) {
        if (entry.durationMs) httpSum += entry.durationMs;
      }
      const overhead = Math.max(0, iter.durationMs - httpSum);

      return {
        originalIndex: iter.index,
        passed: iter.passed,
        totalDurationMs: iter.durationMs,
        httpDurationMs: httpSum,
        overheadMs: overhead,
        error,
        nodeDurations,
        sampled: isSampledIteration(iter),
      };
    });
  }, [iterations, httpNodes]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let result = rows;

    // Apply filter mode
    if (filterMode === 'failed') {
      result = result.filter(r => !r.passed);
    } else if (filterMode === 'slowest') {
      const sorted = [...result].sort((a, b) => b.totalDurationMs - a.totalDurationMs);
      const top10Percent = Math.max(1, Math.ceil(sorted.length * 0.1));
      const threshold = sorted[top10Percent - 1]?.totalDurationMs ?? 0;
      result = result.filter(r => r.totalDurationMs >= threshold);
    }

    // Apply search (search in error messages)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => r.error?.toLowerCase().includes(term));
    }

    return result;
  }, [rows, filterMode, searchTerm]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];

    sorted.sort((a, b) => {
      let cmp = 0;

      if (sortField === 'iteration') {
        cmp = a.originalIndex - b.originalIndex;
      } else if (sortField === 'status') {
        // Failed first when desc
        cmp = (a.passed ? 1 : 0) - (b.passed ? 1 : 0);
      } else if (sortField === 'total') {
        cmp = (a.totalDurationMs || 0) - (b.totalDurationMs || 0);
      } else {
        // Node column
        const aDur = a.nodeDurations.get(sortField)?.durationMs ?? Infinity;
        const bDur = b.nodeDurations.get(sortField)?.durationMs ?? Infinity;
        cmp = aDur - bDur;
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [filteredRows, sortField, sortDirection]);

  // Calculate stats for footer
  const stats = useMemo(() => {
    const nodeStats = new Map<string, { sum: number; count: number; min: number; max: number }>();
    
    for (const node of httpNodes) {
      nodeStats.set(node.id, { sum: 0, count: 0, min: Infinity, max: -Infinity });
    }

    let totalSum = 0;
    let totalCount = 0;
    let totalMin = Infinity;
    let totalMax = -Infinity;

    for (const row of rows) {
      if (row.totalDurationMs) {
        totalSum += row.totalDurationMs;
        totalCount++;
        totalMin = Math.min(totalMin, row.totalDurationMs);
        totalMax = Math.max(totalMax, row.totalDurationMs);
      }

      for (const [nodeId, data] of row.nodeDurations) {
        if (data.durationMs !== undefined) {
          const stat = nodeStats.get(nodeId)!;
          stat.sum += data.durationMs;
          stat.count++;
          stat.min = Math.min(stat.min, data.durationMs);
          stat.max = Math.max(stat.max, data.durationMs);
        }
      }
    }

    return {
      nodeStats,
      totalAvg: totalCount > 0 ? totalSum / totalCount : undefined,
      totalMin: totalMin === Infinity ? undefined : totalMin,
      totalMax: totalMax === -Infinity ? undefined : totalMax,
    };
  }, [rows, httpNodes]);

  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'status' ? 'desc' : 'asc');
    }
  }, [sortField]);

  const failedCount = rows.filter(r => !r.passed).length;

  return (
    <div className="iteration-matrix">
      {/* Toolbar */}
      <div className="matrix-toolbar">
        <div className="matrix-filters">
          <button
            className={`matrix-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All ({rows.length})
          </button>
          <button
            className={`matrix-filter-btn failed ${filterMode === 'failed' ? 'active' : ''}`}
            onClick={() => setFilterMode('failed')}
            disabled={failedCount === 0}
          >
            Failed ({failedCount})
          </button>
          <button
            className={`matrix-filter-btn ${filterMode === 'slowest' ? 'active' : ''}`}
            onClick={() => setFilterMode('slowest')}
          >
            Slowest 10%
          </button>
        </div>
        {failedCount > 0 && (
          <div className="matrix-search">
            <input
              type="text"
              placeholder="Search errors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <span className="search-count">{filteredRows.length} found</span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="matrix-table-container">
        <table className="matrix-table">
          <thead>
            <tr>
              <th 
                className={`sortable ${sortField === 'iteration' ? 'sorted' : ''}`}
                onClick={() => handleSort('iteration')}
              >
                Iter {sortField === 'iteration' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              {httpNodes.map(node => (
                <th
                  key={node.id}
                  className={`sortable ${sortField === node.id ? 'sorted' : ''} ${selectedNodeId === node.id ? 'selected' : ''}`}
                  onClick={() => handleSort(node.id)}
                  title={node.data?.label || node.id}
                >
                  {truncate(node.data?.label || node.id, 15, '…')}
                  {sortField === node.id && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
              <th 
                className={`sortable ${sortField === 'total' ? 'sorted' : ''}`}
                onClick={() => handleSort('total')}
              >
                Total {sortField === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className={`sortable ${sortField === 'status' ? 'sorted' : ''}`}
                onClick={() => handleSort('status')}
              >
                Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              {failedCount > 0 && <th>Error</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr 
                key={row.originalIndex}
                className={`
                  ${row.passed ? '' : 'failed-row'}
                  ${selectedIteration === row.originalIndex ? 'selected-row' : ''}
                  ${!row.sampled ? 'not-sampled-row' : ''}
                `}
                onClick={() => onIterationSelect(row.originalIndex)}
                title={!row.sampled ? 'Trace not captured (sampled run)' : undefined}
              >
                <td className="iter-num">#{row.originalIndex + 1}{!row.sampled ? ' ○' : ''}</td>
                {httpNodes.map(node => {
                  const data = row.nodeDurations.get(node.id);
                  return (
                    <td
                      key={node.id}
                      className={`
                        cell-${data?.state || 'skipped'}
                        ${selectedNodeId === node.id && selectedIteration === row.originalIndex ? 'selected-cell' : ''}
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCellSelect(row.originalIndex, node.id);
                      }}
                    >
                      {data?.state === 'pass' && '✓ '}
                      {data?.state === 'fail' && '✗ '}
                      {formatDurationMs(data?.durationMs)}
                    </td>
                  );
                })}
                <td
                  className="total-col"
                  title={row.overheadMs > 50
                    ? `HTTP: ${formatDurationMs(row.httpDurationMs)} + Other nodes (delay, condition, etc.): ${formatDurationMs(row.overheadMs)}`
                    : undefined}
                >
                  {formatDurationMs(row.totalDurationMs)}
                  {row.overheadMs > 50 && (
                    <span className="overhead-hint" title={`Non-HTTP overhead: ${formatDurationMs(row.overheadMs)}`}>
                      {' '}+{formatDurationMs(row.overheadMs)}
                    </span>
                  )}
                </td>
                <td className={`status-col ${row.passed ? 'pass' : 'fail'}`}>
                  {row.passed ? '✓' : '✗'}
                </td>
                {failedCount > 0 && (
                  <td className="error-col" title={row.error}>
                    {row.error ? truncate(row.error, 30, '…') : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="stats-row">
              <td>AVG</td>
              {httpNodes.map(node => {
                const stat = stats.nodeStats.get(node.id);
                const avg = stat && stat.count > 0 ? stat.sum / stat.count : undefined;
                return <td key={node.id}>{formatDurationMs(avg)}</td>;
              })}
              <td>{formatDurationMs(stats.totalAvg)}</td>
              <td></td>
              {failedCount > 0 && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

