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
      includeInstructions: false,
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
      includeInstructions: false,
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
