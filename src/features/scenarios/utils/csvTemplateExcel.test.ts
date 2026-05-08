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

  it('sample row uses customName in dataRows when mapping key is absent', () => {
    const test = makeTestScenario({ validation: { mode: 'none' } });
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [] }));
    const nameDef = defs.find(d => d.type === 'name')!;
    nameDef.customName = 'RowTitle';
    const wb = generateExcelTemplate({
      test,
      pathVariables: [],
      columnDefs: defs,
      dataRows: [{ values: { RowTitle: 'KeyedByCustom' } }],
    });
    const data = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as string[][];
    expect(data.some(r => r.includes('KeyedByCustom'))).toBe(true);
  });

  it('sample path cell is empty when path variable name does not match any pathVariables entry', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/vehicles/99',
      validation: { mode: 'none' },
    });
    const defs = buildColumnDefs(
      makeExportOpts({ test, pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }] }),
    );
    const pathDef = defs.find(d => d.type === 'path')!;
    pathDef.mapping = 'wrongName';
    const wb = generateExcelTemplate({
      test,
      pathVariables: [{ segmentIndex: 1, variableName: 'vehicleId' }],
      columnDefs: defs,
    });
    const data = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as string[][];
    const headerRow = data[1];
    const pathCol = headerRow.indexOf(pathDef.customName);
    const sample = data[2][pathCol];
    expect(sample).toBe('');
  });

  it('sample param cell is empty when query key is not in the URL', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/items?env=prod',
      validation: { mode: 'none' },
    });
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [] }));
    const paramDef = defs.find(d => d.type === 'param');
    expect(paramDef).toBeDefined();
    paramDef!.mapping = 'missingParam';
    const wb = generateExcelTemplate({ test, pathVariables: [], columnDefs: defs });
    const data = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as string[][];
    const headerRow = data[1];
    const col = headerRow.indexOf(paramDef!.customName);
    expect(data[2][col]).toBe('');
  });

  it('sample validate cell is empty when jsonPath is not in expectedFields', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/x',
      validation: { mode: 'selective', expectedFields: [] },
    });
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [] }));
    const vDef = defs.find(d => d.type === 'validate');
    expect(vDef).toBeUndefined();
    defs.push({
      type: 'validate',
      fullKey: 'validate:$.orphan',
      mapping: '$.orphan',
      autoName: 'orphan',
      customName: 'orphan',
    });
    const wb = generateExcelTemplate({ test, pathVariables: [], columnDefs: defs });
    const data = XLSX.utils.sheet_to_json<string[][]>(wb.Sheets.Data, { header: 1, defval: '' }) as string[][];
    const headerRow = data[1];
    const col = headerRow.indexOf('orphan');
    expect(data[2][col]).toBe('');
  });
});

describe('buildColumnDefs — shortName edge', () => {
  it('falls back to full jsonPath when the path collapses to an empty leaf', () => {
    const test = makeTestScenario({
      url: 'https://api.example.com/x',
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$', expectedValue: '1' }],
      },
    });
    const defs = buildColumnDefs(makeExportOpts({ test, pathVariables: [] }));
    const v = defs.find(d => d.type === 'validate');
    expect(v?.autoName).toBe('$');
  });
});

function writeWorkbookPair(dataAoa: string[][], metaAoa: (string | number | boolean)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataAoa), 'Data');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaAoa), 'Metadata');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseExcelToScenarios — sheet shape and metadata branches', () => {
  const tailConfig = (): (string | number | boolean)[][] => [
    [],
    ['CONFIG', ''],
    ['key', 'value'],
    ['version', 2],
    ['method', 'GET'],
    ['urlPattern', 'https://api.example.com/items'],
    ['body', ''],
    ['bodyType', 'json'],
    ['auth', JSON.stringify({ type: 'none' })],
    ['validationMode', 'selective'],
    ['selectiveMode', 'include'],
    ['unorderedArrays', 'false'],
    ['excludedPaths', ''],
    [],
    ['HEADERS', ''],
    ['header', 'value'],
  ];

  it('rejects metadata when COLUMN MAPPINGS defines no columns', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair([['Request'], ['name'], ['x']], meta);
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('no column mappings'))).toBe(true);
  });

  it('rejects metadata when no column has type "name"', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['onlyPath', 'path', 'id'],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair(
      [
        ['Request'],
        ['onlyPath'],
        ['v1'],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('no "name" type column'))).toBe(true);
  });

  it('rejects CONFIG method that is not a supported HTTP verb', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      [],
      ['CONFIG', ''],
      ['key', 'value'],
      ['version', 2],
      ['method', 'WHY'],
      ['urlPattern', 'https://api.example.com/items'],
      ['body', ''],
      ['bodyType', 'json'],
      ['auth', JSON.stringify({ type: 'none' })],
      ['validationMode', 'none'],
      ['selectiveMode', 'include'],
      ['unorderedArrays', 'false'],
      ['excludedPaths', ''],
      [],
      ['HEADERS', ''],
      ['header', 'value'],
    ];
    const buf = writeWorkbookPair(
      [
        ['Request'],
        ['name'],
        ['x'],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('Invalid HTTP method'))).toBe(true);
  });

  it('treats row 0 as headers when it is not a Request/Response category row', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      ['lane', 'validate', '$.lane'],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair(
      [
        ['name', 'lane'],
        ['One', ''],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors).toEqual([]);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].scenario!.validation.expectedFields).toBeUndefined();
  });

  it('errors when the header row contains only blank cells', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair(
      [
        ['Request'],
        ['', '  \t '],
        ['should-not-reach'],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('no column headers'))).toBe(true);
  });

  it('errors when there are headers but every data row is blank', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair(
      [
        ['Request'],
        ['name'],
        [''],
        ['   '],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors.some(e => e.includes('no data rows'))).toBe(true);
  });

  it('warns when the Data sheet has columns not listed in metadata', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      ...tailConfig(),
    ];
    const buf = writeWorkbookPair(
      [
        ['Request', '', ''],
        ['name', 'UserAdded', 'UserAdded2'],
        ['A', 'b', 'c'],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.warnings.some(w => w.includes('User-added columns'))).toBe(true);
    expect(result.validRows).toBe(1);
  });

  it('ignores invalid JSON for optional contract fields in metadata', () => {
    const meta: (string | number | boolean)[][] = [
      ['COLUMN MAPPINGS', '', ''],
      ['column', 'type', 'mapping'],
      ['name', 'name', ''],
      [],
      ['CONFIG', ''],
      ['key', 'value'],
      ['version', 2],
      ['method', 'GET'],
      ['urlPattern', 'https://api.example.com/items'],
      ['body', ''],
      ['bodyType', 'json'],
      ['bodyForm', '{broken'],
      ['validationContract', 'not-json'],
      ['arrayValidationMode', 'oops'],
      ['auth', '{'],
      ['validationMode', 'none'],
      ['selectiveMode', 'include'],
      ['unorderedArrays', 'false'],
      ['excludedPaths', ''],
      [],
      ['HEADERS', ''],
      ['header', 'value'],
    ];
    const buf = writeWorkbookPair(
      [
        ['Request'],
        ['name'],
        ['Ok'],
      ],
      meta,
    );
    const result = parseExcelToScenarios(buf);
    expect(result.fileErrors).toEqual([]);
    expect(result.rows[0].scenario!.auth).toEqual({ type: 'inherit' });
    expect(result.validationContract).toBeUndefined();
    expect(result.arrayValidationMode).toBeUndefined();
  });
});
