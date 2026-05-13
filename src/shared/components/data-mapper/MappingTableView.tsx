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
  expectedValue: string;
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
      let value = '';
      if (parsed != null) {
        const raw = getByPath(parsed, m.expression ?? m.sourcePath);
        if (raw !== undefined) {
          value = typeof raw === 'string' ? raw : JSON.stringify(raw);
        }
      }
      return { id: m.id, jsonPath: path, expectedValue: value };
    });
  }, [mappings, sources, activeSourceId]);

  const pivotData = useMemo(() => {
    const colSet = new Set<string>();
    const rowMap = new Map<string, Map<string, { value: string; id: string }>>();

    for (const r of rows) {
      const lastDot = r.jsonPath.lastIndexOf('.');
      const rowKey = lastDot === -1 ? '(root)' : r.jsonPath.slice(0, lastDot);
      const field = lastDot === -1 ? r.jsonPath : r.jsonPath.slice(lastDot + 1);
      colSet.add(field);
      let row = rowMap.get(rowKey);
      if (!row) { row = new Map(); rowMap.set(rowKey, row); }
      row.set(field, { value: r.expectedValue, id: r.id });
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
        <div className="dm-table-empty">No mappings yet. Drag fields or use "Map filtered" to add.</div>
      </div>
    );
  }

  return (
    <div className="dm-table-view">
      {canPivot && (
        <div className="dm-table-toolbar-row">
          <span className="dm-table-toolbar-label">
            {layout === 'list'
              ? `${rows.length} row${rows.length !== 1 ? 's' : ''}`
              : `${pivotData.rows.length} × ${pivotData.columns.length}`}
          </span>
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
        </div>
      )}
      <div className="dm-table-header-row">
        <span className="dm-table-cell dm-table-cell--path">JSON Path</span>
        <span className="dm-table-cell dm-table-cell--value">Expected Value</span>
        <span className="dm-table-cell dm-table-cell--action" />
      </div>

      {(!canPivot || layout === 'list') ? (
        <div className="dm-table-body">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`dm-table-row ${selectedMappingId === row.id ? 'dm-table-row--selected' : ''}`}
              onClick={() => onSelectMapping?.(row.id)}
            >
              <span className="dm-table-cell dm-table-cell--path" title={row.jsonPath}>
                {row.jsonPath}
              </span>
              <span className="dm-table-cell dm-table-cell--value" title={row.expectedValue}>
                {row.expectedValue ? `"${row.expectedValue}"` : '—'}
              </span>
              <span className="dm-table-cell dm-table-cell--action">
                {onRemoveMapping && (
                  <button
                    className="dm-table-delete-btn"
                    onClick={(e) => { e.stopPropagation(); onRemoveMapping(row.id); }}
                    aria-label={`Remove mapping ${row.jsonPath}`}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="dm-table-body">
          <table className="validation-fields-pivot-table">
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
                            <code className="validation-fields-pivot-val">{cell.value ? `"${cell.value}"` : '—'}</code>
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
