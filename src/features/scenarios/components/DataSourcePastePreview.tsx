import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DataSourceColumn, DataSourceRow } from '../../../shared/types';
import { CustomSelect } from '../../../shared/components/CustomSelect';

interface PastePreviewProps {
  pasteData: { headers: string[]; rows: string[][] };
  existingColumns: DataSourceColumn[];
  onConfirm: (rows: DataSourceRow[], newColumns?: DataSourceColumn[]) => void;
  onCancel: () => void;
}

/** Maps each pasted header to an existing column or creates a new one */
export default function DataSourcePastePreview({ pasteData, existingColumns, onConfirm, onCancel }: PastePreviewProps) {
  // Auto-map headers to existing columns by name match
  const [mapping, setMapping] = useState<(string | '__new__')[]>(() =>
    pasteData.headers.map(h => {
      const match = existingColumns.find(
        c => c.name.toLowerCase() === h.toLowerCase() || c.mapping?.toLowerCase() === h.toLowerCase(),
      );
      return match ? match.id : '__new__';
    }),
  );

  const previewRows = useMemo(() => pasteData.rows.slice(0, 5), [pasteData]);

  const handleConfirm = () => {
    // Build new columns for unmapped headers
    const newColumns: DataSourceColumn[] = [];
    const columnMap: { headerIdx: number; colId: string }[] = [];

    for (let i = 0; i < pasteData.headers.length; i++) {
      if (mapping[i] === '__new__') {
        const col: DataSourceColumn = {
          id: uuidv4(),
          name: pasteData.headers[i],
          type: 'param',
          mapping: pasteData.headers[i],
        };
        newColumns.push(col);
        columnMap.push({ headerIdx: i, colId: col.id });
      } else {
        columnMap.push({ headerIdx: i, colId: mapping[i] });
      }
    }

    // Build rows
    const rows: DataSourceRow[] = pasteData.rows.map(rowValues => {
      const values: Record<string, string> = {};
      for (const { headerIdx, colId } of columnMap) {
        values[colId] = rowValues[headerIdx] ?? '';
      }
      return { id: uuidv4(), values, enabled: true };
    });

    onConfirm(rows, newColumns.length > 0 ? newColumns : undefined);
  };

  return (
    <div className="data-source-paste-preview">
      <div className="data-source-paste-preview-header">
        <span className="data-source-paste-preview-title">
          Paste Preview — {pasteData.rows.length} row{pasteData.rows.length !== 1 ? 's' : ''} detected
        </span>
        <div className="data-source-paste-preview-actions">
          <button type="button" className="data-source-action-btn" onClick={handleConfirm}>
            Append Rows
          </button>
          <button type="button" className="data-source-action-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>

      <div className="data-source-paste-preview-mapping">
        <table className="data-source-grid">
          <thead>
            <tr className="data-source-header-row">
              {pasteData.headers.map((h, i) => (
                <th key={i} className="data-source-th">
                  <div className="data-source-paste-col-map">
                    <span className="data-source-paste-header">{h}</span>
                    <CustomSelect
                      className="data-source-col-type-select"
                      value={mapping[i]}
                      onChange={(v) => {
                        const next = [...mapping];
                        next[i] = v;
                        setMapping(next);
                      }}
                      options={[
                        { value: '__new__', label: '+ New Column' },
                        ...existingColumns.map((col) => ({ value: col.id, label: col.name })),
                      ]}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ri) => (
              <tr key={ri} className="data-source-row">
                {row.map((cell, ci) => (
                  <td key={ci} className="data-source-td">
                    <span className="data-source-paste-cell">{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {pasteData.rows.length > 5 && (
          <div className="data-source-paste-preview-more">
            …and {pasteData.rows.length - 5} more rows
          </div>
        )}
      </div>
    </div>
  );
}
