import { useMemo, useState } from 'react';
import type { Mapping, MapperSource } from './types';
import { getByPath } from '../../utils/jsonPath';
import { coerceSampleData } from './utils/mapperParsing';
import { normalizeMapperPath } from './utils/pathNormalization';

interface MappingTableViewProps {
  mappings: Mapping[];
  sources: MapperSource[];
  activeSourceId: string;
  onRemoveMapping?: (id: string) => void;
  onSelectMapping?: (id: string) => void;
  selectedMappingId?: string | null;
}

interface TableRow {
  id: string;
  jsonPath: string;
  sourceLabel: string;
  isExpression: boolean;
  expectedValue: string;
  resolved: boolean;
}

function formatExpectedValue(raw: unknown): string {
  if (raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

export default function MappingTableView({
  mappings,
  sources,
  activeSourceId,
  onRemoveMapping,
  onSelectMapping,
  selectedMappingId,
}: MappingTableViewProps) {
  const [layout, setLayout] = useState<'list' | 'pivot'>('list');

  const rows = useMemo<TableRow[]>(() => {
    const source = sources.find((s) => s.id === activeSourceId) ?? sources[0];
    const parsed = source?.sampleData != null ? coerceSampleData(source.sampleData) : null;

    return mappings.map((m) => {
      const path = normalizeMapperPath(m.targetPath);
      const isExpression = !!m.expression?.trim();
      const sourceLabel = isExpression
        ? m.expression!.trim()
        : normalizeMapperPath(m.sourcePath);
      let value = '';
      let resolved = false;
      if (parsed != null) {
        const raw = getByPath(parsed, m.expression ?? m.sourcePath);
        if (raw !== undefined) {
          value = formatExpectedValue(raw);
          resolved = true;
        }
      }
      return {
        id: m.id,
        jsonPath: path,
        sourceLabel,
        isExpression,
        expectedValue: value,
        resolved,
      };
    });
  }, [mappings, sources, activeSourceId]);

  const stats = useMemo(() => {
    let mapped = 0;
    let unresolved = 0;
    for (const row of rows) {
      if (row.resolved) mapped += 1;
      else unresolved += 1;
    }
    return { mapped, unresolved, total: rows.length };
  }, [rows]);

  const pivotData = useMemo(() => {
    const colSet = new Set<string>();
    const rowMap = new Map<string, Map<string, { value: string; id: string; resolved: boolean }>>();

    for (const r of rows) {
      const lastDot = r.jsonPath.lastIndexOf('.');
      const rowKey = lastDot === -1 ? '(root)' : r.jsonPath.slice(0, lastDot);
      const field = lastDot === -1 ? r.jsonPath : r.jsonPath.slice(lastDot + 1);
      colSet.add(field);
      let row = rowMap.get(rowKey);
      if (!row) { row = new Map(); rowMap.set(rowKey, row); }
      row.set(field, { value: r.expectedValue, id: r.id, resolved: r.resolved });
    }

    const columns = Array.from(colSet);
    const pivotRows = Array.from(rowMap.entries()).map(([key, cells]) => ({ key, cells }));

    const firstKey = pivotRows[0]?.key || '';
    const bracketIdx = firstKey.lastIndexOf('[');
    const arrayPrefix = bracketIdx > 0 && pivotRows.every((pr) => /\[\d+\]$/.test(pr.key))
      ? firstKey.slice(0, bracketIdx) : '';

    if (arrayPrefix) {
      pivotRows.sort((a, b) => {
        const ai = parseInt(a.key.match(/\[(\d+)\]$/)?.[1] || '0', 10);
        const bi = parseInt(b.key.match(/\[(\d+)\]$/)?.[1] || '0', 10);
        return ai - bi;
      });
    }

    return { columns, rows: pivotRows, arrayPrefix };
  }, [rows]);

  const canPivot = !!pivotData.arrayPrefix && pivotData.rows.length > 0;

  if (rows.length === 0) {
    return (
      <div className="dm-table-view">
        <div className="dm-table-empty" role="status">
          <div className="dm-table-empty-title">No mappings yet</div>
          <div className="dm-table-empty-hint">
            Drag a source field onto a target, or use Auto-map to populate this table.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-table-view">
      <div className="dm-table-toolbar-row">
        <div className="dm-table-stats" aria-live="polite">
          {canPivot && layout === 'pivot' ? (
            <span className="dm-table-stat">
              <span className="dm-table-stat-value">
                {pivotData.rows.length} × {pivotData.columns.length}
              </span>
            </span>
          ) : (
            <span className="dm-table-stat">
              <span className="dm-table-stat-value">
                {stats.total === 1 ? '1 row' : `${stats.total} rows`}
              </span>
            </span>
          )}
          <span className="dm-table-stat dm-table-stat--mapped">
            <span className="dm-table-stat-value">{stats.mapped}</span> mapped
          </span>
          {stats.unresolved > 0 && (
            <span className="dm-table-stat dm-table-stat--unresolved">
              <span className="dm-table-stat-value">{stats.unresolved}</span> unresolved
            </span>
          )}
        </div>
        {canPivot && (
          <div className="validation-fields-view-toggle" role="tablist" aria-label="Table layout mode">
            <button
              type="button"
              role="tab"
              aria-selected={layout === 'list'}
              className={`validation-fields-view-btn ${layout === 'list' ? 'is-active' : ''}`}
              onClick={() => setLayout('list')}
            >
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={layout === 'pivot'}
              className={`validation-fields-view-btn ${layout === 'pivot' ? 'is-active' : ''}`}
              onClick={() => setLayout('pivot')}
            >
              Table
            </button>
          </div>
        )}
      </div>

      {(!canPivot || layout === 'list') ? (
        <div className="dm-table-scroll">
          <table className="dm-mapping-table">
            <thead>
              <tr>
                <th scope="col" className="dm-mapping-table-th dm-mapping-table-th--status">Status</th>
                <th scope="col" className="dm-mapping-table-th dm-mapping-table-th--path">Target path</th>
                <th scope="col" className="dm-mapping-table-th dm-mapping-table-th--source">Source</th>
                <th scope="col" className="dm-mapping-table-th dm-mapping-table-th--value">Expected value</th>
                <th scope="col" className="dm-mapping-table-th dm-mapping-table-th--action">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`dm-table-row ${selectedMappingId === row.id ? 'dm-table-row--selected' : ''} ${row.resolved ? 'dm-table-row--mapped' : 'dm-table-row--unresolved'}`}
                  onClick={() => onSelectMapping?.(row.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMapping?.(row.id);
                    }
                  }}
                  aria-selected={selectedMappingId === row.id}
                >
                  <td className="dm-mapping-table-td dm-mapping-table-td--status">
                    <span
                      className={`dm-table-status-pill ${row.resolved ? 'dm-table-status-pill--mapped' : 'dm-table-status-pill--unresolved'}`}
                    >
                      {row.resolved ? 'Mapped' : 'Unresolved'}
                    </span>
                  </td>
                  <td className="dm-mapping-table-td dm-mapping-table-td--path" title={row.jsonPath}>
                    <code className="dm-table-path">{row.jsonPath}</code>
                  </td>
                  <td className="dm-mapping-table-td dm-mapping-table-td--source" title={row.sourceLabel}>
                    {row.isExpression ? (
                      <span className="dm-table-source-fx">
                        <span className="dm-table-fx-badge" aria-hidden="true">fx</span>
                        <code className="dm-table-path">{row.sourceLabel}</code>
                      </span>
                    ) : (
                      <code className="dm-table-path dm-table-path--muted">{row.sourceLabel}</code>
                    )}
                  </td>
                  <td className="dm-mapping-table-td dm-mapping-table-td--value" title={row.expectedValue || undefined}>
                    {row.expectedValue ? (
                      <code className="dm-table-value">{`"${row.expectedValue}"`}</code>
                    ) : (
                      <span className="dm-table-value-empty" aria-label="No value">—</span>
                    )}
                  </td>
                  <td className="dm-mapping-table-td dm-mapping-table-td--action">
                    {onRemoveMapping && (
                      <button
                        type="button"
                        className="dm-table-delete-btn"
                        onClick={(e) => { e.stopPropagation(); onRemoveMapping(row.id); }}
                        aria-label={`Remove mapping ${row.jsonPath}`}
                        title="Remove mapping"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dm-table-scroll">
          <table className="validation-fields-pivot-table dm-mapping-pivot-table">
            <thead>
              <tr>
                <th className="validation-fields-pivot-row-header">{pivotData.arrayPrefix}</th>
                {pivotData.columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivotData.rows.map((row) => {
                const indexMatch = row.key.match(/\[(\d+)\]$/);
                const label = indexMatch ? `#${indexMatch[1]}` : row.key;
                return (
                  <tr key={row.key}>
                    <td className="validation-fields-pivot-row-header"><code>{label}</code></td>
                    {pivotData.columns.map((col) => {
                      const cell = row.cells.get(col);
                      return (
                        <td key={col}>
                          {cell ? (
                            <code className="validation-fields-pivot-val">
                              {cell.value ? `"${cell.value}"` : '—'}
                            </code>
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
        </div>
      )}
    </div>
  );
}
