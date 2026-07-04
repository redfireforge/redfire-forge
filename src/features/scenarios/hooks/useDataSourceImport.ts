/**
 * useDataSourceImport — Handles CSV / JSON / Excel file import for the data source editor.
 * Extracted from DataSourceEditor to reduce file size.
 */
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, DataSource, DataSourceRow } from '../../../shared/types';
import {
  parseCsvLine, parseColumnHeader, parseJsonImport,
  buildColumnsAndRowsFromParseResult, parseExcelSimple,
} from '../utils/dataSourceImport';
import { parseExcelToScenarios } from '../utils/csvTemplateExcel';
import { createEmptyColumn } from '../utils/dataSourceUtils';
import { tryParseJson } from '../../../shared/utils/helpers';

interface UseDataSourceImportOptions {
  draft: Scenario;
  dataSource: DataSource | undefined;
  onDraftChange: (draft: Scenario) => void;
}

export function useDataSourceImport({ draft, dataSource: dt, onDraftChange }: UseDataSourceImportOptions) {
  const handleImport = useCallback(async () => {
    if (!dt) return;
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.json,.xlsx,.xls';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const fileOrigin = {
          type: 'file' as const,
          filePath: file.name,
          fileLastRead: Date.now(),
        };

        if (file.name.endsWith('.json')) {
          try {
            const text = await file.text();
            const json = tryParseJson(text);
            if (json === undefined) throw new Error('Invalid JSON import file');
            const { columns: newCols, rows: newRows } = parseJsonImport(json, dt.columns);
            onDraftChange({
              ...draft,
              dataSource: { ...dt, columns: newCols, rows: newRows, source: { ...fileOrigin, fileRowCount: newRows.length } },
            });
          } catch (err) {
            console.error('JSON import failed:', err);
          }
          return;
        }

        if (/\.xlsx?$/i.test(file.name)) {
          try {
            const buffer = await file.arrayBuffer();
            const result = parseExcelToScenarios(buffer);
            if (result.fileErrors.length > 0) {
              const { columns: cols, rows: rows } = await parseExcelSimple(buffer, dt.columns);
              onDraftChange({
                ...draft,
                dataSource: { ...dt, columns: cols, rows, source: { ...fileOrigin, fileRowCount: rows.length } },
              });
              return;
            }
            const { columns: cols, rows } = buildColumnsAndRowsFromParseResult(result, dt.columns);
            onDraftChange({
              ...draft,
              dataSource: { ...dt, columns: cols, rows, source: { ...fileOrigin, fileRowCount: rows.length } },
            });
          } catch (err) {
            console.error('Excel import failed:', err);
          }
          return;
        }

        // CSV import
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return;

        const headerLine = lines[0];
        const headers = parseCsvLine(headerLine);

        const columns = [...dt.columns];
        const headerToColId: string[] = [];
        for (const hdr of headers) {
          const { type, name } = parseColumnHeader(hdr);
          const existing = columns.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === type)
            || columns.find(c => c.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            headerToColId.push(existing.id);
          } else {
            const col = createEmptyColumn(columns);
            col.name = name;
            col.type = type;
            col.mapping = name;
            columns.push(col);
            headerToColId.push(col.id);
          }
        }

        const newRows: DataSourceRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCsvLine(lines[i]);
          const values: Record<string, string> = {};
          for (const col of columns) {
            values[col.id] = '';
          }
          for (let j = 0; j < headerToColId.length; j++) {
            values[headerToColId[j]] = cells[j] ?? '';
          }
          newRows.push({ id: uuidv4(), values, enabled: true });
        }

        if (newRows.length === 0) return;
        onDraftChange({
          ...draft,
          dataSource: { ...dt, columns, rows: newRows, source: { ...fileOrigin, fileRowCount: newRows.length } },
        });
      };
      input.click();
    } catch {
      // ignore file picker cancellation
    }
  }, [draft, dt, onDraftChange]);

  return { handleImport };
}
