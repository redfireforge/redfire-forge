import { describe, it, expect } from 'vitest';
import { buildColumnDefs, generateExcelTemplate, parseExcelToScenarios } from './csvTemplateExcel';
import * as XLSX from 'xlsx-js-style';
import type { ExportOptions, ExcelExportOptions, ColumnDef } from './csvTemplateTypes';
import type { Scenario } from '../../../shared/types';

// ── Helpers ──

function makeTestScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test-1',
    name: 'Test Scenario',
    method: 'GET',
    url: 'https://api.example.com/vehicles/12345?env=prod',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    auth: { type: 'inherit' },
    validation: {
      mode: 'selective',
      expectedFields: [
        { jsonPath: '$.data.vin', expectedValue: 'ABC123' },
        { jsonPath: '$.status', expectedValue: '200' },
      ],
    },
    ...overrides,
  } as Scenario;
}

function makeExportOpts(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    test: makeTestScenario(),
    pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
    ...overrides,
  };
}

// ── buildColumnDefs ──

describe('buildColumnDefs', () => {
  it('includes name column first', () => {
    const defs = buildColumnDefs(makeExportOpts());
    expect(defs[0].type).toBe('name');
    expect(defs[0].fullKey).toBe('name');
  });

  it('includes path variable columns', () => {
    const defs = buildColumnDefs(makeExportOpts());
    const pathDefs = defs.filter(d => d.type === 'path');
    expect(pathDefs).toHaveLength(1);
    expect(pathDefs[0].mapping).toBe('vehicleId');
    expect(pathDefs[0].fullKey).toBe('path:vehicleId');
  });

  it('includes query param columns', () => {
    const defs = buildColumnDefs(makeExportOpts());
    const paramDefs = defs.filter(d => d.type === 'param');
    expect(paramDefs).toHaveLength(1);
    expect(paramDefs[0].mapping).toBe('env');
  });

  it('includes validation columns', () => {
    const defs = buildColumnDefs(makeExportOpts());
    const validateDefs = defs.filter(d => d.type === 'validate');
    expect(validateDefs).toHaveLength(2);
    expect(validateDefs[0].mapping).toBe('$.data.vin');
    expect(validateDefs[1].mapping).toBe('$.status');
  });

  it('deduplicates column names', () => {
    const opts = makeExportOpts({
      pathVariables: [
        { segmentIndex: 1, variableName: 'name' }, // would collide with the 'name' column
      ],
    });
    const defs = buildColumnDefs(opts);
    const names = defs.map(d => d.customName);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length); // no duplicates
  });

  it('handles scenario with no query params or validation', () => {
    const opts = makeExportOpts({
      test: makeTestScenario({
        url: 'https://api.example.com/health',
        validation: { mode: 'none' },
      }),
      pathVariables: [],
    });
    const defs = buildColumnDefs(opts);
    expect(defs).toHaveLength(1); // only 'name'
    expect(defs[0].type).toBe('name');
  });

  it('includes dynamic columns from dataSource', () => {
    const opts = makeExportOpts({
      test: makeTestScenario({
        validation: { mode: 'selective', expectedFields: [] },
        dataSource: {
          columns: [
            { name: 'v:$.extra', type: 'validate', mapping: '$.extra' },
          ],
          rows: [],
        } as any,
      }),
    });
    const defs = buildColumnDefs(opts);
    const validateDefs = defs.filter(d => d.type === 'validate');
    expect(validateDefs.some(d => d.mapping === '$.extra')).toBe(true);
  });
});

// ── generateExcelTemplate + parseExcelToScenarios round-trip ──

describe('Excel round-trip', () => {
  it('generates and parses back a single scenario', () => {
    const test = makeTestScenario();
    const columnDefs: ColumnDef[] = buildColumnDefs(makeExportOpts());
    const excelOpts: ExcelExportOptions = {
      test,
      pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
      columnDefs,
    };
    const wb = generateExcelTemplate(excelOpts);
    expect(wb.SheetNames).toContain('Data');

    // Write to buffer and parse back
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseExcelToScenarios(buffer);

    expect(result.fileErrors).toHaveLength(0);
    expect(result.validRows).toBeGreaterThanOrEqual(1);
    const first = result.rows.find(r => r.scenario !== null);
    expect(first).toBeDefined();
    expect(first!.scenario!.name).toBe('Test Scenario');
    expect(first!.scenario!.method).toBe('GET');
  });

  it('preserves validation fields through round-trip', () => {
    const test = makeTestScenario();
    const columnDefs = buildColumnDefs(makeExportOpts());
    const wb = generateExcelTemplate({
      test,
      pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
      columnDefs,
    });
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseExcelToScenarios(buffer);

    expect(result.validRows).toBeGreaterThanOrEqual(1);
    const first = result.rows.find(r => r.scenario !== null);
    expect(first).toBeDefined();
    const scenario = first!.scenario!;
    expect(scenario.validation.expectedFields).toBeDefined();
    if (scenario.validation.expectedFields) {
      expect(scenario.validation.expectedFields.length).toBeGreaterThan(0);
    }
  });

  it('returns fileErrors for workbook without required sheets', () => {
    // Create a minimal workbook with just headers but no Metadata sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['name', 'path:vin']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = parseExcelToScenarios(buffer);
    expect(result.fileErrors.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });
});

describe('buildColumnDefs — json path shortening', () => {
  it('abbreviates plural array segments plus known leaf labels', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/items',
      validation: {
        mode: 'selective',
        selectiveMode: 'include',
        expectedFields: [{ jsonPath: '$.offers[0].associatedOfferingCode', expectedValue: 'x' }],
      },
    });
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [] }));
    expect(defs.some(d => d.type === 'validate' && d.autoName === 'offer0_code')).toBe(true);
  });
});

describe('generateExcelTemplate — extra metadata', () => {
  it('writes validationContract snippets when datasource metadata exists', () => {
    const test = makeTestScenario({
      validation: { mode: 'none' },
      dataSource: {
        validationContract: ['offers[*].code'],
        arrayValidationMode: { offers: 'unordered' },
        columns: [],
        rows: [],
      } as any,
    });
    const opts = makeExportOpts({ test, pathVariables: [] });
    const wb = generateExcelTemplate({
      test,
      pathVariables: [],
      columnDefs: buildColumnDefs(opts),
    });
    const metaText = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets.Metadata));
    expect(metaText).toContain('validationContract');
    expect(metaText).toContain('unordered');
  });

  it('uses provided dataRows values instead of sample scenario row', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/items',
      validation: { mode: 'none' },
    });
    const opts = makeExportOpts({ test, pathVariables: [] });
    const defs = buildColumnDefs(opts);
    const wb = generateExcelTemplate({
      test,
      pathVariables: [],
      columnDefs: defs,
      dataRows: [{ values: { name: 'FromRows' } }],
    });
    const dataAoa = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as unknown as string[][];
    expect(dataAoa.flat().includes('FromRows')).toBe(true);
  });
});

describe('parseExcelToScenarios — extra validation', () => {
  it('flags empty workbooks sheets', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['n']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Unknown');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(parseExcelToScenarios(buffer).rows).toHaveLength(0);
  });

  it('records row-level errors when name cell is blank', () => {
    const test = makeTestScenario({
      validation: { mode: 'none' },
    });
    const opts = makeExportOpts({
      test,
      pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
    });
    const defs = buildColumnDefs(opts);
    const wb = generateExcelTemplate({
      test,
      pathVariables: opts.pathVariables,
      columnDefs: defs,
      dataRows: [{ values: { name: '', vehicleId: '12345', env: 'prod' } }],
    });
    const result = parseExcelToScenarios(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    expect(result.errorRows).toBeGreaterThanOrEqual(1);
    expect(result.rows.some(r => r.errors.some(e => /name/i.test(e)))).toBe(true);
  });
});

describe('generateExcelTemplate — decode + config branches', () => {
  it('falls back to raw path segment when decodeURIComponent fails', () => {
    const test = makeTestScenario({
      validation: { mode: 'none' },
      url: 'https://api.example.com/v1/%ZZ/more',
    });
    const pv = [{ segmentIndex: 1, variableName: 'badSeg' }] as const;
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [...pv] }));
    const wb = generateExcelTemplate({ test, pathVariables: [...pv], columnDefs: defs });
    const data = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as string[][];
    expect(data.flat().some(c => typeof c === 'string' && c.includes('%ZZ'))).toBe(true);
  });

  it('writes bodyForm and expectedJson rows when present on the scenario', () => {
    const test = makeTestScenario({
      validation: {
        mode: 'full',
        expectedJson: '{"ok":true}',
      },
      bodyForm: [{ key: 'field', value: 'x' }],
    });
    const wb = generateExcelTemplate({
      test,
      pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
      columnDefs: buildColumnDefs(makeExportOpts()),
    });
    const metaJoined = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets.Metadata));
    expect(metaJoined).toContain('bodyForm');
    expect(metaJoined).toContain('expectedJson');
  });

  it('exports dynamic validate mappings that duplicate expected fields without duplicate defs', () => {
    const test = makeTestScenario({
      validation: {
        mode: 'selective',
        selectiveMode: 'include',
        expectedFields: [{ jsonPath: '$.status', expectedValue: '200' }],
      },
      dataSource: {
        columns: [
          { id: 'dup', type: 'validate', mapping: '$.status', name: 'dup' },
          { id: 'extra', type: 'validate', mapping: '$.data.vin', name: '' },
        ],
        rows: [],
      } as any,
    });
    const defs = buildColumnDefs(makeExportOpts({ test }));
    expect(defs.filter(d => d.type === 'validate' && d.mapping === '$.status')).toHaveLength(1);
    expect(defs.some(d => d.type === 'validate' && d.mapping === '$.data.vin')).toBe(true);
  });
});
