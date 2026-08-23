/**
 * Import/export helpers extracted from TestEditorModal to keep the modal under
 * the monolithic-file threshold.
 */
import type { MutableRefObject } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import type { Scenario, DataSource } from '@shared/types';
import { isWsActionType } from '@shared/types';
import { validateWsActionConfig } from '@shared/utils/wsScenarioDefaults';
import { validateGrpcHarnessActionConfig } from '@shared/utils/grpcHarnessScenarioContracts';
import { pickJsonFile, unwrapImport } from '../utils/testEditorUtils';
import { saveFile } from '@shared/utils/fileSaver';
import type { ImportChoice, ExportChoice } from '../components/ImportExportChoiceModal';

export interface TestEditorImportDeps {
  draftRef: MutableRefObject<Scenario>;
  onDraftChange: (draft: Scenario) => void;
  syncParamsFromUrl: (url: string) => void;
  inputMode: string;
  onInputModeChange: (mode: 'builder' | 'curlImport' | 'curlExport') => void;
  onActiveTabChange: (tab: import('../components/TestEditorModal').TestEditorTab) => void;
  toast: { show: (type: 'error' | 'warning', title: string, message: string) => void };
}

export interface TestEditorExportDeps {
  draftRef: MutableRefObject<Scenario>;
  onExportTest: (scenario: Scenario) => void;
  setCsvExportOpen: (open: boolean) => void;
}

/** Parse CSV/JSON file text into data-source rows. Returns null when parse yields nothing. */
export function parseImportedDataRows(
  text: string,
  fileName: string,
  currentDt: DataSource,
): Array<{ id: string; values: Record<string, string>; enabled: boolean }> | null {
  if (fileName.endsWith('.json')) {
    try {
      const json = JSON.parse(text) as { rows?: Array<{ values?: Record<string, string>; enabled?: boolean }> };
      if (json.rows && Array.isArray(json.rows)) {
        return json.rows.map((r) => {
          const values: Record<string, string> = {};
          for (const col of currentDt.columns) {
            values[col.id] = r.values?.[col.name] ?? '';
          }
          return { id: uuidv4(), values, enabled: r.enabled !== false };
        });
      }
    } catch (err) {
      console.error('JSON import failed:', err);
      return null;
    }
    return null;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return null;
  const rawHeaders = Papa.parse(lines[0]).data[0] as string[];
  const colIdMap = rawHeaders.map((h) => {
    const trimmed = h.trim();
    const stripped = trimmed.replace(/^(?:path|param|expect|header|body|validate):/, '');
    const col = currentDt.columns.find(
      (c) => c.name.toLowerCase() === stripped.toLowerCase() || c.mapping.toLowerCase() === stripped.toLowerCase(),
    ) ?? currentDt.columns.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.mapping.toLowerCase() === trimmed.toLowerCase(),
    );
    return col?.id ?? null;
  });
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const dataRows = parsed.data.slice(1);
  const newRows = [];
  for (const cells of dataRows) {
    const values: Record<string, string> = {};
    for (const col of currentDt.columns) values[col.id] = '';
    for (let j = 0; j < colIdMap.length; j++) {
      if (colIdMap[j]) values[colIdMap[j]!] = cells[j] ?? '';
    }
    newRows.push({ id: uuidv4(), values, enabled: true });
  }
  return newRows.length > 0 ? newRows : null;
}

export function createTestEditorImportHandler(deps: TestEditorImportDeps) {
  const {
    draftRef, onDraftChange, syncParamsFromUrl, inputMode, onInputModeChange, onActiveTabChange, toast,
  } = deps;

  return (choice: ImportChoice) => {
    if (choice === 'test-definition') {
      pickJsonFile((raw) => {
        const data = unwrapImport(raw);
        const t = data as Scenario;
        if (!t.name || !t.method) {
          toast.show('error', 'Invalid file', 'Expected a test with name and method.');
          return;
        }
        const requiresUrl = !t.actionType || t.actionType === 'http';
        if (requiresUrl && !t.url?.trim()) {
          toast.show('error', 'Invalid file', 'HTTP tests require a url.');
          return;
        }
        const transportWarnings = [
          ...validateWsActionConfig(t),
          ...validateGrpcHarnessActionConfig(t),
        ];
        if (transportWarnings.length > 0) {
          toast.show('warning', 'Transport Config Issues', transportWarnings.join('; '));
        }
        const cur = draftRef.current;
        onDraftChange({ ...t, id: cur.id });
        syncParamsFromUrl(t.url || '');
        if (inputMode !== 'builder') onInputModeChange('builder');
        if (isWsActionType(t.actionType)) onActiveTabChange('validation');
      });
      return;
    }

    const dt = draftRef.current.dataSource;
    if (!dt) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const cur = draftRef.current;
      const currentDt = cur.dataSource;
      if (!currentDt) return;
      const newRows = parseImportedDataRows(text, file.name, currentDt);
      if (newRows) {
        onDraftChange({ ...cur, dataSource: { ...currentDt, rows: newRows } });
      }
    };
    input.click();
  };
}

export function createTestEditorExportHandler(deps: TestEditorExportDeps) {
  const { draftRef, onExportTest, setCsvExportOpen } = deps;

  return (choice: ExportChoice) => {
    if (choice === 'test-definition') {
      onExportTest(draftRef.current);
    } else if (choice === 'excel-template') {
      setCsvExportOpen(true);
    } else if (choice === 'data-csv') {
      const dt = draftRef.current.dataSource;
      if (!dt) return;
      const headers = dt.columns.map((col) => {
        const prefix = col.type === 'path' ? 'path:'
          : col.type === 'param' ? 'param:'
            : col.type === 'validate' ? 'expect:'
              : col.type === 'header' ? 'header:'
                : col.type === 'body' ? 'body:' : '';
        return prefix + col.name;
      });
      const data = dt.rows.map((row) => dt.columns.map((col) => row.values[col.id] ?? ''));
      const csv = Papa.unparse({ fields: headers, data });
      const blob = new Blob([csv], { type: 'text/csv' });
      void saveFile(blob, {
        filename: `${draftRef.current.name || 'data-source'}.csv`,
        mimeType: 'text/csv',
        description: 'CSV file',
      });
    } else if (choice === 'data-json') {
      const cur = draftRef.current;
      const dt = cur.dataSource;
      if (!dt) return;
      const json = {
        version: '1.0',
        metadata: {
          name: cur.name,
          method: cur.method,
          urlTemplate: dt.urlTemplate || cur.url,
          createdAt: new Date().toISOString(),
          exportedFrom: 'RedfireForge',
        },
        columns: dt.columns.map((col) => ({ id: col.id, name: col.name, type: col.type, mapping: col.mapping })),
        rows: dt.rows.map((row) => ({
          id: row.id,
          enabled: row.enabled,
          tags: row.tags,
          note: row.note,
          values: Object.fromEntries(dt.columns.map((col) => [col.name, row.values[col.id] ?? ''])),
        })),
      };
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      void saveFile(blob, {
        filename: `${cur.name || 'data-source'}.json`,
        mimeType: 'application/json',
        description: 'JSON file',
      });
    }
  };
}
