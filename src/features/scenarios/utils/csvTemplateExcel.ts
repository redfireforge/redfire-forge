import * as XLSX from 'xlsx-js-style';
import { v4 as uuidv4 } from 'uuid';
import type { Scenario, BodyType, KeyValue, ExpectedField, ValidationMode, SelectiveMode, AuthConfig } from '../../../shared/types';
import { saveFile } from '../../../shared/utils/fileSaver';
import {
  type ColumnDef,
  type CsvParseResult,
  type ExcelExportOptions,
  type ExcelMeta,
  type ExportOptions,
  type ParsedRow,
  type TemplateMetadata,
  PATH_PREFIX,
  PARAM_PREFIX,
  VALIDATE_PREFIX,
} from './csvTemplateTypes';
import { parseUrl, buildUrlFromTemplate } from './csvTemplateUrl';

const KNOWN_ABBREVIATIONS: Record<string, string> = {
  associatedOfferingCode: 'code',
  offerName: 'name',
  offerDescription: 'desc',
  offerType: 'type',
  offerStatus: 'status',
  enrollmentType: 'enrollment',
  vehicleUsageCode: 'usage',
};

function abbreviateLeaf(leaf: string): string {
  return KNOWN_ABBREVIATIONS[leaf] ?? leaf;
}

/**
 * Generate a short header from a JSONPath validation expression.
 * Examples:
 *   $.offers[0].associatedOfferingCode  →  offer0_code
 *   $.offers[0].offerName               →  offer0_name
 *   $.data.vehicleInfo.vin              →  vin
 *   $.status                            →  status
 */
function shortNameFromJsonPath(jsonPath: string): string {
  const stripped = jsonPath.replace(/^\$\.?/, '');
  const parts = stripped.split('.');

  const segments: string[] = [];
  for (const part of parts) {
    const arrMatch = part.match(/^(.+)\[(\d+)]$/);
    if (arrMatch) {
      const arrName = arrMatch[1].replace(/s$/, '');
      segments.push(`${arrName}${arrMatch[2]}`);
    } else {
      segments.push(part);
    }
  }

  if (segments.length <= 1) {
    return abbreviateLeaf(segments[0] || jsonPath);
  }

  const leaf = abbreviateLeaf(segments[segments.length - 1]);
  const parent = segments[segments.length - 2];
  return `${parent}_${leaf}`;
}

/** Extract the first array index from a mapping like "offers[2].code" → 2. Returns 0 if no index.
function extractArrayIndex(mapping: string): number {
  const match = mapping.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : 0;
}
*/

/**
 * Build ColumnDef array from export options. Each entry has an auto-generated
 * short name that the user can override before export.
 */
export function buildColumnDefs(opts: ExportOptions): ColumnDef[] {
  const { test, pathVariables } = opts;
  const { params } = parseUrl(test.url);
  const expectedFields = test.validation.expectedFields ?? [];
  const defs: ColumnDef[] = [];
  const usedNames = new Set<string>();

  function dedupe(name: string): string {
    let candidate = name;
    let n = 2;
    while (usedNames.has(candidate)) {
      candidate = `${name}_${n++}`;
    }
    usedNames.add(candidate);
    return candidate;
  }

  defs.push({ type: 'name', fullKey: 'name', mapping: '', autoName: 'name', customName: 'name' });
  usedNames.add('name');

  for (const pv of pathVariables) {
    const auto = dedupe(pv.variableName);
    defs.push({ type: 'path', fullKey: `${PATH_PREFIX}${pv.variableName}`, mapping: pv.variableName, autoName: auto, customName: auto });
  }

  for (const p of params) {
    const auto = dedupe(p.key);
    defs.push({ type: 'param', fullKey: `${PARAM_PREFIX}${p.key}`, mapping: p.key, autoName: auto, customName: auto });
  }

  // Static validate columns from expectedFields
  const seenMappings = new Set<string>();
  for (const f of expectedFields) {
    seenMappings.add(f.jsonPath);
    const raw = shortNameFromJsonPath(f.jsonPath);
    const auto = dedupe(raw);
    defs.push({ type: 'validate', fullKey: `${VALIDATE_PREFIX}${f.jsonPath}`, mapping: f.jsonPath, autoName: auto, customName: auto });
  }

  // Dynamic validate columns from dataSource.columns (created by validationContract expansion)
  const dt = test.dataSource;
  if (dt) {
    for (const col of dt.columns) {
      if (col.type === 'validate' && !seenMappings.has(col.mapping)) {
        seenMappings.add(col.mapping);
        const raw = shortNameFromJsonPath(col.mapping);
        const auto = dedupe(raw);
        defs.push({ type: 'validate', fullKey: `${VALIDATE_PREFIX}${col.mapping}`, mapping: col.mapping, autoName: auto, customName: auto });
      }
    }
  }

  return defs;
}

// Cell style constants
const S_SECTION_HEADING: XLSX.CellStyle = {
  font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2C3E50' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const S_TABLE_HEADER: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: '2C3E50' } },
  fill: { fgColor: { rgb: 'D5DBDB' } },
  border: {
    bottom: { style: 'thin', color: { rgb: '95A5A6' } },
  },
  alignment: { horizontal: 'left' },
};
const S_TABLE_CELL: XLSX.CellStyle = {
  border: {
    bottom: { style: 'thin', color: { rgb: 'D5DBDB' } },
  },
  font: { sz: 10 },
};
const S_TABLE_CELL_CODE: XLSX.CellStyle = {
  ...S_TABLE_CELL,
  font: { sz: 10, color: { rgb: '7F8C8D' } },
};
const S_CATEGORY_REQUEST: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '2980B9' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_CATEGORY_RESPONSE: XLSX.CellStyle = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '27AE60' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_DATA_HEADER: XLSX.CellStyle = {
  font: { bold: true, sz: 10 },
  fill: { fgColor: { rgb: 'EBF5FB' } },
  border: { bottom: { style: 'thin', color: { rgb: '95A5A6' } } },
  alignment: { horizontal: 'left' },
};
const S_DATA_HEADER_VALIDATE: XLSX.CellStyle = {
  font: { bold: true, sz: 10 },
  fill: { fgColor: { rgb: 'E8F8F5' } },
  border: { bottom: { style: 'thin', color: { rgb: '95A5A6' } } },
  alignment: { horizontal: 'left' },
};

function cellRef(r: number, c: number): string {
  return XLSX.utils.encode_cell({ r, c });
}

function applyStyle(sheet: XLSX.WorkSheet, r: number, c: number, style: XLSX.CellStyle) {
  const ref = cellRef(r, c);
  if (!sheet[ref]) sheet[ref] = { t: 's', v: '' };
  sheet[ref].s = style;
}

export function generateExcelTemplate(opts: ExcelExportOptions): XLSX.WorkBook {
  const { test, pathVariables, columnDefs, dataRows } = opts;
  const { origin, pathname, params } = parseUrl(test.url);
  const pathParts = pathname.split('/').filter(Boolean);

  const varIndexMap = new Map(pathVariables.map(pv => [pv.segmentIndex, pv.variableName]));
  const patternParts = pathParts.map((seg, i) => {
    const varName = varIndexMap.get(i);
    return varName ? `{{${varName}}}` : seg;
  });
  const urlPattern = `${origin}/${patternParts.join('/')}`;

  // --- Data sheet ---
  // Row 0: Category row (Request / Response)
  // Row 1: Column headers
  // Row 2+: Data rows

  const requestCols = columnDefs.filter(d => d.type !== 'validate');
  const responseCols = columnDefs.filter(d => d.type === 'validate');

  // Respect the user's column order — no re-sorting.
  // The columnDefs arrive in the order the user configured.
  const orderedDefs = [...requestCols, ...responseCols];
  const firstValidateIdx = requestCols.length;

  const categoryRow: string[] = orderedDefs.map((_d, i) => {
    if (i === 0) return 'Request';
    if (i === firstValidateIdx) return 'Response (Validation)';
    return '';
  });

  const headers = orderedDefs.map(d => d.customName);

  // Build data rows
  let rowsData: string[][];
  if (dataRows && dataRows.length > 0) {
    // Export actual data source rows
    rowsData = dataRows.map(row => {
      return orderedDefs.map(d => {
        // Find matching value by column mapping/type
        // dataRows values are keyed by column id, so we need the columnDef's mapping
        // The caller should pass values keyed by columnDef mapping
        return row.values[d.mapping] ?? row.values[d.customName] ?? '';
      });
    });
  } else {
    // Single sample row derived from the test scenario
    const sampleRow: string[] = orderedDefs.map(d => {
      if (d.type === 'name') return test.name;
      if (d.type === 'path') {
        const segIdx = pathVariables.find(pv => pv.variableName === d.mapping)?.segmentIndex ?? -1;
        const raw = pathParts[segIdx] || '';
        try { return decodeURIComponent(raw); } catch { return raw; }
      }
      if (d.type === 'param') return params.find(p => p.key === d.mapping)?.value ?? '';
      if (d.type === 'validate') {
        const ef = (test.validation.expectedFields ?? []).find(f => f.jsonPath === d.mapping);
        return ef?.expectedValue ?? '';
      }
      return '';
    });
    rowsData = [sampleRow];
  }

  const dataAoa = [categoryRow, headers, ...rowsData];
  const dataSheet = XLSX.utils.aoa_to_sheet(dataAoa);

  // Merge category cells
  const merges: XLSX.Range[] = [];
  if (firstValidateIdx > 1) {
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: firstValidateIdx - 1 } });
  }
  if (responseCols.length > 1) {
    merges.push({ s: { r: 0, c: firstValidateIdx }, e: { r: 0, c: orderedDefs.length - 1 } });
  }
  dataSheet['!merges'] = merges;

  // Apply styles to category row
  for (let c = 0; c < orderedDefs.length; c++) {
    applyStyle(dataSheet, 0, c, c < firstValidateIdx ? S_CATEGORY_REQUEST : S_CATEGORY_RESPONSE);
  }

  // Apply styles to header row
  for (let c = 0; c < orderedDefs.length; c++) {
    applyStyle(dataSheet, 1, c, orderedDefs[c].type === 'validate' ? S_DATA_HEADER_VALIDATE : S_DATA_HEADER);
  }

  const colWidths = headers.map((h, i) => {
    const maxDataLen = Math.max(...rowsData.map(r => (r[i] || '').length), 0);
    const maxLen = Math.max(h.length, maxDataLen, 8);
    return { wch: Math.min(maxLen + 2, 40) };
  });
  dataSheet['!cols'] = colWidths;
  dataSheet['!rows'] = [{ hpt: 22 }, { hpt: 20 }];

  // --- Metadata sheet ---
  const metaRows: (string | number | boolean)[][] = [];

  // Section: COLUMN MAPPINGS
  metaRows.push(['COLUMN MAPPINGS', '', '']);              // row 0
  metaRows.push(['column', 'type', 'mapping']);            // row 1
  for (const d of orderedDefs) {
    metaRows.push([d.customName, d.type, d.mapping]);
  }

  metaRows.push([]);                                       // blank separator

  // Section: CONFIG
  const configStartRow = metaRows.length;
  metaRows.push(['CONFIG', '']);
  metaRows.push(['key', 'value']);
  metaRows.push(['version', 2]);
  metaRows.push(['method', test.method]);
  metaRows.push(['urlPattern', urlPattern]);
  metaRows.push(['body', test.body || '']);
  metaRows.push(['bodyType', test.bodyType ?? 'json']);
  if (test.bodyForm && test.bodyForm.length > 0) {
    metaRows.push(['bodyForm', JSON.stringify(test.bodyForm)]);
  }
  metaRows.push(['auth', JSON.stringify(test.auth)]);
  metaRows.push(['validationMode', test.validation.mode]);
  metaRows.push(['selectiveMode', test.validation.selectiveMode ?? '']);
  metaRows.push(['unorderedArrays', test.validation.unorderedArrays ? 'true' : 'false']);
  metaRows.push(['excludedPaths', (test.validation.excludedPaths ?? []).join(',')]);
  if (test.validation.mode === 'full' && test.validation.expectedJson) {
    metaRows.push(['expectedJson', test.validation.expectedJson]);
  };
  // Dynamic validation contract
  const dt = test.dataSource;
  if (dt?.validationContract && dt.validationContract.length > 0) {
    metaRows.push(['validationContract', JSON.stringify(dt.validationContract)]);
  }
  if (dt?.arrayValidationMode && Object.keys(dt.arrayValidationMode).length > 0) {
    metaRows.push(['arrayValidationMode', JSON.stringify(dt.arrayValidationMode)]);
  }

  metaRows.push([]);                                       // blank separator

  // Section: HEADERS
  const headersStartRow = metaRows.length;
  metaRows.push(['HEADERS', '']);
  metaRows.push(['header', 'value']);
  for (const h of test.headers.filter(h => h.key.trim())) {
    metaRows.push([h.key, h.value]);
  }

  const metaSheet = XLSX.utils.aoa_to_sheet(metaRows);
  metaSheet['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 55 }];

  // Apply styles to metadata sheet
  // Section headings: row 0 (COLUMN MAPPINGS), configStartRow (CONFIG), headersStartRow (HEADERS)
  const sectionRows = [0, configStartRow, headersStartRow];
  for (const sr of sectionRows) {
    for (let c = 0; c < 3; c++) applyStyle(metaSheet, sr, c, S_SECTION_HEADING);
    // Merge section heading across 3 cols (or 2 for CONFIG/HEADERS)
  }
  // Merge section headings
  metaSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: configStartRow, c: 0 }, e: { r: configStartRow, c: 1 } },
    { s: { r: headersStartRow, c: 0 }, e: { r: headersStartRow, c: 1 } },
  ];

  // Table header rows
  const tableHeaderRows = [1, configStartRow + 1, headersStartRow + 1];
  for (const thr of tableHeaderRows) {
    for (let c = 0; c < 3; c++) applyStyle(metaSheet, thr, c, S_TABLE_HEADER);
  }

  // Column mapping data rows
  for (let i = 2; i < 2 + columnDefs.length; i++) {
    applyStyle(metaSheet, i, 0, S_TABLE_CELL);
    applyStyle(metaSheet, i, 1, S_TABLE_CELL);
    applyStyle(metaSheet, i, 2, S_TABLE_CELL_CODE);
  }

  // Config data rows
  for (let i = configStartRow + 2; i < configStartRow + 11; i++) {
    applyStyle(metaSheet, i, 0, S_TABLE_CELL);
    applyStyle(metaSheet, i, 1, S_TABLE_CELL_CODE);
  }

  // Header data rows
  const headerDataCount = test.headers.filter(h => h.key.trim()).length;
  for (let i = headersStartRow + 2; i < headersStartRow + 2 + headerDataCount; i++) {
    applyStyle(metaSheet, i, 0, S_TABLE_CELL);
    applyStyle(metaSheet, i, 1, S_TABLE_CELL);
  }

  // Row heights for section headings
  const rowProps: Record<number, { hpt: number }> = {};
  for (const sr of sectionRows) rowProps[sr] = { hpt: 24 };
  metaSheet['!rows'] = Array.from({ length: metaRows.length }, (_, i) => rowProps[i] || {});

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Data');
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Metadata');

  return wb;
}

export async function downloadExcel(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await saveFile(blob, { filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Excel file' });
}

function parseMetadataSheet(sheet: XLSX.WorkSheet): ExcelMeta | null {
  const aoa: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!aoa.length) return null;

  const columnMap = new Map<string, { type: string; mapping: string }>();
  const config: Record<string, string> = {};
  const headers: KeyValue[] = [];

  type Section = 'none' | 'columns' | 'config' | 'headers';
  let section: Section = 'none';

  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i];
    const first = String(row[0] ?? '').trim();

    if (first === 'COLUMN MAPPINGS') { section = 'columns'; continue; }
    if (first === 'CONFIG') { section = 'config'; continue; }
    if (first === 'HEADERS') { section = 'headers'; continue; }
    if (first === 'column' || first === 'key' || first === 'header') continue;
    if (!first) continue;

    if (section === 'columns') {
      const col = first;
      const type = String(row[1] ?? '').trim();
      const mapping = String(row[2] ?? '').trim();
      columnMap.set(col, { type, mapping });
    } else if (section === 'config') {
      config[first] = String(row[1] ?? '').trim();
    } else if (section === 'headers') {
      headers.push({ key: first, value: String(row[1] ?? '').trim() });
    }
  }

  let auth: AuthConfig;
  try { auth = JSON.parse(config['auth'] || '{}'); } catch { auth = { type: 'inherit' }; }

  let bodyForm: KeyValue[] | undefined;
  try { bodyForm = config['bodyForm'] ? JSON.parse(config['bodyForm']) : undefined; } catch { /* ignore */ }

  let validationContract: string[] | undefined;
  try { validationContract = config['validationContract'] ? JSON.parse(config['validationContract']) : undefined; } catch { /* ignore */ }

  let arrayValidationMode: Record<string, 'ordered' | 'unordered'> | undefined;
  try { arrayValidationMode = config['arrayValidationMode'] ? JSON.parse(config['arrayValidationMode']) : undefined; } catch { /* ignore */ }

  return {
    version: parseInt(config['version'] || '2'),
    method: config['method'] || 'GET',
    urlPattern: config['urlPattern'] || '',
    body: config['body'] || '',
    bodyType: (config['bodyType'] as BodyType) || undefined,
    bodyForm,
    auth,
    validationMode: (config['validationMode'] || 'none') as ValidationMode,
    selectiveMode: (config['selectiveMode'] || 'include') as SelectiveMode,
    unorderedArrays: config['unorderedArrays'] === 'true',
    excludedPaths: config['excludedPaths'] ? config['excludedPaths'].split(',').filter(Boolean) : [],
    expectedJson: config['expectedJson'] || '',
    headers,
    columnMap,
    validationContract,
    arrayValidationMode,
  };
}

export function parseExcelToScenarios(buffer: ArrayBuffer): CsvParseResult {
  const empty: CsvParseResult = { rows: [], columns: [], totalRows: 0, validRows: 0, errorRows: 0, meta: null, fileErrors: [], warnings: [] };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (e) {
    return { ...empty, fileErrors: [`Failed to read Excel file: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const sheetNames = wb.SheetNames;
  const fileErrors: string[] = [];
  const warnings: string[] = [];

  const dataSheet = wb.Sheets['Data'];
  const metaSheet = wb.Sheets['Metadata'];

  if (!dataSheet && !metaSheet) {
    fileErrors.push(`Excel file has sheets [${sheetNames.join(', ')}] but expected "Data" and "Metadata" sheets. This file may not be a RedfireForge template.`);
    return { ...empty, fileErrors };
  }
  if (!metaSheet) {
    fileErrors.push(`Missing "Metadata" sheet (found: ${sheetNames.join(', ')}). Cannot determine column mappings or test configuration.`);
    return { ...empty, fileErrors };
  }
  if (!dataSheet) {
    fileErrors.push(`Missing "Data" sheet (found: ${sheetNames.join(', ')}). No test data to import.`);
    return { ...empty, fileErrors };
  }

  const excelMeta = parseMetadataSheet(metaSheet);
  if (!excelMeta) {
    fileErrors.push('Metadata sheet is empty or has no recognizable sections (expected COLUMN MAPPINGS, CONFIG, HEADERS).');
    return { ...empty, fileErrors };
  }

  if (excelMeta.columnMap.size === 0) {
    fileErrors.push('Metadata sheet has no column mappings. The COLUMN MAPPINGS section is empty or missing.');
    return { ...empty, fileErrors };
  }

  if (!excelMeta.urlPattern) {
    fileErrors.push('Metadata CONFIG section is missing "urlPattern". Cannot construct test URLs.');
    return { ...empty, fileErrors };
  }

  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!validMethods.includes(excelMeta.method.toUpperCase())) {
    fileErrors.push(`Invalid HTTP method "${excelMeta.method}" in CONFIG. Expected one of: ${validMethods.join(', ')}.`);
    return { ...empty, fileErrors };
  }

  const hasNameCol = Array.from(excelMeta.columnMap.values()).some(v => v.type === 'name');
  if (!hasNameCol) {
    fileErrors.push('Column mappings have no "name" type column. Each test row needs a name.');
    return { ...empty, fileErrors };
  }

  // Data sheet row 0 is the category row (Request/Response) — read from row 1
  const allDataAoa: string[][] = XLSX.utils.sheet_to_json(dataSheet, { header: 1, defval: '' });

  // Detect whether row 0 is a category row (merged "Request" / "Response") or already headers
  const hasCategoryRow = allDataAoa.length >= 2
    && typeof allDataAoa[0]?.[0] === 'string'
    && ['request', 'response'].some(k => String(allDataAoa[0][0]).toLowerCase().includes(k));

  const headerRowIdx = hasCategoryRow ? 1 : 0;
  const dataStartIdx = headerRowIdx + 1;
  const dataHeaders: string[] = (allDataAoa[headerRowIdx] || []).map(h => String(h).trim()).filter(Boolean);

  if (dataHeaders.length === 0) {
    fileErrors.push('Data sheet has no column headers.');
    return { ...empty, fileErrors };
  }

  const dataRowsAoa = allDataAoa.slice(dataStartIdx).filter(row => row.some(c => String(c).trim()));
  if (dataRowsAoa.length === 0) {
    fileErrors.push('Data sheet has column headers but no data rows.');
    return { ...empty, fileErrors };
  }

  // Convert AOA rows to keyed records
  const dataRows: Record<string, string>[] = dataRowsAoa.map(row => {
    const rec: Record<string, string> = {};
    for (let c = 0; c < dataHeaders.length; c++) {
      rec[dataHeaders[c]] = String(row[c] ?? '').trim();
    }
    return rec;
  });

  // Detect user-added columns not in metadata — treat as dynamic validate fields
  const unmappedCols = dataHeaders.filter(h => !excelMeta.columnMap.has(h));
  if (unmappedCols.length > 0) {
    for (const col of unmappedCols) {
      excelMeta.columnMap.set(col, { type: 'validate', mapping: col });
    }
    warnings.push(`User-added columns detected and treated as validation fields: ${unmappedCols.join(', ')}`);
  }

  const missingInData = Array.from(excelMeta.columnMap.keys()).filter(k => !dataHeaders.includes(k));
  if (missingInData.length > 0) {
    warnings.push(`Metadata defines columns not present in Data sheet: ${missingInData.join(', ')}`);
  }

  const pathVarMappings = Array.from(excelMeta.columnMap.entries()).filter(([, v]) => v.type === 'path');
  const placeholders = (excelMeta.urlPattern.match(/\{\{(\w+)}}/g) || []).map(p => p.slice(2, -2));
  for (const ph of placeholders) {
    if (!pathVarMappings.some(([, v]) => v.mapping === ph)) {
      warnings.push(`URL pattern has placeholder "{{${ph}}}" but no path column maps to it.`);
    }
  }

  const templateMeta: TemplateMetadata = {
    version: 1,
    method: excelMeta.method,
    urlPattern: excelMeta.urlPattern,
    headers: excelMeta.headers,
    body: excelMeta.body,
    bodyType: excelMeta.bodyType,
    bodyForm: excelMeta.bodyForm,
    auth: excelMeta.auth,
    validationMode: excelMeta.validationMode,
    selectiveMode: excelMeta.selectiveMode,
    unorderedArrays: excelMeta.unorderedArrays,
    excludedPaths: excelMeta.excludedPaths,
    expectedJson: excelMeta.expectedJson || undefined,
    pathVariables: pathVarMappings.map(([, v]) => v.mapping),
  };

  const rows: ParsedRow[] = [];
  let validRowCount = 0;
  let errorRowCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i];
    const errors: string[] = [];

    let name = '';
    const pathValues: Record<string, string> = {};
    const paramValues: KeyValue[] = [];
    const expectedFields: ExpectedField[] = [];

    for (const header of dataHeaders) {
      const val = String(raw[header] ?? '').trim();
      const colDef = excelMeta.columnMap.get(header);
      if (!colDef) continue;

      if (colDef.type === 'name') {
        name = val;
      } else if (colDef.type === 'path') {
        if (!val) errors.push(`Empty path variable "${header}" (maps to {{${colDef.mapping}}})`);
        else pathValues[colDef.mapping] = val;
      } else if (colDef.type === 'param') {
        paramValues.push({ key: colDef.mapping, value: val });
      } else if (colDef.type === 'validate') {
        if (val) {
          expectedFields.push({ jsonPath: colDef.mapping, expectedValue: val });
        }
      }
    }

    if (!name) errors.push('Empty or missing "name" column');

    if (errors.length > 0) {
      errorRowCount++;
      const rawMap: Record<string, string> = {};
      for (const h of dataHeaders) rawMap[h] = String(raw[h] ?? '');
      rows.push({ rowIndex: i + 1, scenario: null, errors, raw: rawMap });
      continue;
    }

    const fullUrl = buildUrlFromTemplate(excelMeta.urlPattern, pathValues, paramValues);

    const hasSelectiveFields = expectedFields.length > 0;
    const vMode = excelMeta.validationMode;

    const scenario: Scenario = {
      id: uuidv4(),
      name,
      method: excelMeta.method.toUpperCase() as Scenario['method'],
      url: fullUrl,
      headers: excelMeta.headers.map(h => ({ ...h })),
      body: excelMeta.body,
      bodyType: excelMeta.bodyType,
      bodyForm: excelMeta.bodyForm,
      auth: { ...excelMeta.auth },
      validation: {
        mode: vMode,
        expectedJson: vMode === 'full' && excelMeta.expectedJson ? excelMeta.expectedJson : undefined,
        expectedFields: hasSelectiveFields ? expectedFields : undefined,
        selectiveMode: (vMode === 'selective' || hasSelectiveFields) ? excelMeta.selectiveMode : undefined,
        unorderedArrays: excelMeta.unorderedArrays || undefined,
        excludedPaths: excelMeta.excludedPaths.length > 0 ? excelMeta.excludedPaths : undefined,
      },
    };

    validRowCount++;
    const rawMap: Record<string, string> = {};
    for (const h of dataHeaders) rawMap[h] = String(raw[h] ?? '');
    rows.push({ rowIndex: i + 1, scenario, errors: [], raw: rawMap });
  }

  return {
    rows,
    columns: dataHeaders,
    totalRows: dataRows.length,
    validRows: validRowCount,
    errorRows: errorRowCount,
    meta: templateMeta,
    fileErrors,
    warnings,
    columnTypes: excelMeta.columnMap,
    validationContract: excelMeta.validationContract,
    arrayValidationMode: excelMeta.arrayValidationMode,
  };
}
