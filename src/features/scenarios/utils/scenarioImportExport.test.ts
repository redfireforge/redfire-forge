/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { reIdScenarios, wrapExport, unwrapImport, pickJsonFile, stripVersions, countVersions, hasVersionData } from './scenarioImportExport';

vi.mock('uuid', () => ({
  v4: (() => {
    let counter = 0;
    return () => `uuid-${++counter}`;
  })(),
}));

describe('reIdScenarios', () => {
  it('assigns new ids to scenarios and their tests', () => {
    const input = [
      { id: 'old-1', name: 'Sc1', tests: [{ id: 'old-t1', name: 'T1' }, { id: 'old-t2', name: 'T2' }] },
      { id: 'old-2', name: 'Sc2', tests: [] },
    ] as unknown as Parameters<typeof reIdScenarios>[0];
    const result = reIdScenarios(input);
    expect(result[0].id).not.toBe('old-1');
    expect(result[0].tests[0].id).not.toBe('old-t1');
    expect(result[0].tests[1].id).not.toBe('old-t2');
    expect(result[1].id).not.toBe('old-2');
    expect(result[0].name).toBe('Sc1');
    expect(result[1].tests).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(reIdScenarios([])).toEqual([]);
  });

  it('preserves all fields except id', () => {
    const input = [{ id: 'x', name: 'S', url: '/api', method: 'GET', tests: [{ id: 'y', name: 'T', assertions: [] }] }] as unknown as Parameters<typeof reIdScenarios>[0];
    const result = reIdScenarios(input);
    expect(result[0].name).toBe('S');
    expect(result[0].url).toBe('/api');
    expect(result[0].tests[0].name).toBe('T');
  });
});

describe('wrapExport', () => {
  it('wraps data with export metadata', () => {
    const data = { scenarios: [] };
    const result = wrapExport(data, 'scenarios', { microservice: 'svc', environment: 'dev' });
    expect(result._exportMeta.level).toBe('scenarios');
    expect(result._exportMeta.microservice).toBe('svc');
    expect(result._exportMeta.environment).toBe('dev');
    expect(result._exportMeta.exportedAt).toBeDefined();
    expect(result.data).toBe(data);
  });

  it('handles undefined optional fields', () => {
    const result = wrapExport([], 'tests', {});
    expect(result._exportMeta.microservice).toBeUndefined();
    expect(result._exportMeta.environment).toBeUndefined();
  });
});

describe('unwrapImport', () => {
  it('unwraps wrapped data', () => {
    const inner = { scenarios: [1, 2] };
    const wrapped = { _exportMeta: { level: 'scenarios', exportedAt: '' }, data: inner };
    expect(unwrapImport(wrapped)).toBe(inner);
  });

  it('returns raw data when not wrapped', () => {
    const raw = { scenarios: [1, 2] };
    expect(unwrapImport(raw)).toBe(raw);
  });

  it('returns primitive values as-is', () => {
    expect(unwrapImport(null)).toBeNull();
    expect(unwrapImport(42)).toBe(42);
    expect(unwrapImport('string')).toBe('string');
  });

  it('returns arrays as-is', () => {
    const arr = [1, 2, 3];
    expect(unwrapImport(arr)).toBe(arr);
  });
});

describe('pickJsonFile', () => {
  it('creates a file input, attaches a handler, and clicks it', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as ((ev: unknown) => void) | null, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as unknown as HTMLInputElement);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('.json');
    expect(click).toHaveBeenCalled();
    expect(typeof mockInput.onchange).toBe('function');
  });

  it('does not call onLoad when no file selected', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as ((ev: unknown) => void) | null, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as unknown as HTMLInputElement);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    mockInput.onchange({ target: { files: [] } });
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('calls onLoad with parsed JSON when file is read', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as ((ev: unknown) => void) | null, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as unknown as HTMLInputElement);

    let capturedOnload: ((ev: { target: { result: string } }) => void) | null = null;
    const mockReadAsText = vi.fn();
    vi.stubGlobal('FileReader', class {
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsText = (...args: unknown[]) => {
        capturedOnload = this.onload;
        mockReadAsText(...args);
      };
    });

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    const mockFile = new File(['{"hello":"world"}'], 'test.json', { type: 'application/json' });
    mockInput.onchange({ target: { files: [mockFile] } });

    expect(mockReadAsText).toHaveBeenCalledWith(mockFile);
    capturedOnload!({ target: { result: '{"hello":"world"}' } });
    expect(onLoad).toHaveBeenCalledWith({ hello: 'world' });
    vi.unstubAllGlobals();
  });

  it('alerts on invalid JSON in file', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as ((ev: unknown) => void) | null, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as unknown as HTMLInputElement);

    let capturedOnload: ((ev: { target: { result: string } }) => void) | null = null;
    const mockReadAsText = vi.fn();
    vi.stubGlobal('FileReader', class {
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsText = (...args: unknown[]) => {
        capturedOnload = this.onload;
        mockReadAsText(...args);
      };
    });
    const onLoad = vi.fn();
    const onError = vi.fn();
    pickJsonFile(onLoad, onError);

    const mockFile = new File(['not json'], 'test.json');
    mockInput.onchange({ target: { files: [mockFile] } });

    capturedOnload({ target: { result: 'not json' } });
    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Failed to parse JSON file.');
    vi.unstubAllGlobals();
  });

  it('does not call onLoad when files is undefined', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as ((ev: unknown) => void) | null, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as unknown as HTMLInputElement);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    mockInput.onchange({ target: { files: undefined } });
    expect(onLoad).not.toHaveBeenCalled();
  });
});

// ── stripVersions ──
describe('stripVersions', () => {
  const makeTest = (rv?: unknown[], ruv?: unknown[]) => ({
    name: 'T1', url: '/a', method: 'GET',
    validation: { responseVersions: rv, rulesVersions: ruv, statusCode: 200 },
  });

  it('strips response versions when includeResponseVersions is false', () => {
    const t = makeTest([{ id: '1' }], [{ id: '2' }]);
    const result = stripVersions(t, { includeResponseVersions: false, includeRulesVersions: true }) as typeof t;
    expect(result.validation.responseVersions).toBeUndefined();
    expect(result.validation.rulesVersions).toEqual([{ id: '2' }]);
  });

  it('strips rules versions when includeRulesVersions is false', () => {
    const t = makeTest([{ id: '1' }], [{ id: '2' }]);
    const result = stripVersions(t, { includeResponseVersions: true, includeRulesVersions: false }) as typeof t;
    expect(result.validation.responseVersions).toEqual([{ id: '1' }]);
    expect(result.validation.rulesVersions).toBeUndefined();
  });

  it('strips both when both are false', () => {
    const t = makeTest([{ id: '1' }], [{ id: '2' }]);
    const result = stripVersions(t, { includeResponseVersions: false, includeRulesVersions: false }) as typeof t;
    expect(result.validation.responseVersions).toBeUndefined();
    expect(result.validation.rulesVersions).toBeUndefined();
  });

  it('keeps both when both are true', () => {
    const t = makeTest([{ id: '1' }], [{ id: '2' }]);
    const result = stripVersions(t, { includeResponseVersions: true, includeRulesVersions: true }) as typeof t;
    expect(result.validation.responseVersions).toEqual([{ id: '1' }]);
    expect(result.validation.rulesVersions).toEqual([{ id: '2' }]);
  });

  it('handles arrays (feature group scenarios)', () => {
    const fg = {
      name: 'FG1',
      scenarios: [{ name: 'S1', tests: [makeTest([{ id: '1' }], [{ id: '2' }])] }],
    };
    const result = stripVersions(fg, { includeResponseVersions: false, includeRulesVersions: false }) as typeof fg;
    expect(result.scenarios[0].tests[0].validation.responseVersions).toBeUndefined();
    expect(result.scenarios[0].tests[0].validation.rulesVersions).toBeUndefined();
  });

  it('handles array input', () => {
    const arr = [makeTest([{ id: '1' }], undefined)];
    const result = stripVersions(arr, { includeResponseVersions: false, includeRulesVersions: true }) as typeof arr;
    expect(result[0].validation.responseVersions).toBeUndefined();
  });

  it('returns data unchanged when no validationConfig', () => {
    const t = { name: 'T1', url: '/a', method: 'GET' };
    const result = stripVersions(t, { includeResponseVersions: false, includeRulesVersions: false });
    expect(result).toEqual(t);
  });
});

// ── countVersions ──
describe('countVersions', () => {
  it('counts response and rules versions across nested structure', () => {
    const fg = {
      scenarios: [{
        tests: [
          { url: '/a', method: 'GET', validation: { responseVersions: [{ id: '1' }, { id: '2' }], rulesVersions: [{ id: '3' }] } },
          { url: '/b', method: 'GET', validation: { responseVersions: [{ id: '4' }] } },
        ],
      }],
    };
    const result = countVersions(fg);
    expect(result.responseVersionCount).toBe(3);
    expect(result.rulesVersionCount).toBe(1);
  });

  it('returns zeros for data without versions', () => {
    expect(countVersions({ name: 'test' })).toEqual({ responseVersionCount: 0, rulesVersionCount: 0 });
  });

  it('counts versions in a single test', () => {
    const t = { url: '/a', method: 'GET', validation: { responseVersions: [{ id: '1' }], rulesVersions: [{ id: '2' }, { id: '3' }] } };
    expect(countVersions(t)).toEqual({ responseVersionCount: 1, rulesVersionCount: 2 });
  });

  it('handles arrays', () => {
    const arr = [
      { url: '/a', method: 'GET', validation: { responseVersions: [{ id: '1' }] } },
      { url: '/b', method: 'GET', validation: { rulesVersions: [{ id: '2' }] } },
    ];
    expect(countVersions(arr)).toEqual({ responseVersionCount: 1, rulesVersionCount: 1 });
  });
});

// ── wrapExport with version options ──
describe('wrapExport with version options', () => {
  it('strips versions from export when options say so', () => {
    const test = {
      name: 'T', url: '/x', method: 'GET',
      validation: { responseVersions: [{ id: '1' }], rulesVersions: [{ id: '2' }] },
    };
    const result = wrapExport(test, 'test', {}, { includeResponseVersions: false, includeRulesVersions: false });
    const data = result.data as typeof test;
    expect(data.validation.responseVersions).toBeUndefined();
    expect(data.validation.rulesVersions).toBeUndefined();
    expect(result._exportMeta?.includesResponseVersions).toBe(false);
    expect(result._exportMeta?.includesRulesVersions).toBe(false);
  });

  it('includes versions in export metadata when included', () => {
    const test = {
      name: 'T', url: '/x', method: 'GET',
      validation: { responseVersions: [{ id: '1' }] },
    };
    const result = wrapExport(test, 'test', {}, { includeResponseVersions: true, includeRulesVersions: true });
    expect(result._exportMeta?.includesResponseVersions).toBe(true);
    expect(result._exportMeta?.includesRulesVersions).toBe(true);
  });
});

describe('hasVersionData', () => {
  it('returns true when responseVersions exist on a test', () => {
    expect(hasVersionData({ url: '/a', method: 'GET', validation: { responseVersions: [{ id: '1' }] } })).toBe(true);
  });

  it('returns true when rulesVersions exist on a test', () => {
    expect(hasVersionData({ url: '/a', method: 'GET', validation: { rulesVersions: [{ id: '1' }] } })).toBe(true);
  });

  it('returns false when no versions exist', () => {
    expect(hasVersionData({ url: '/a', method: 'GET', validation: {} })).toBe(false);
  });

  it('returns false for non-object input', () => {
    expect(hasVersionData('string')).toBe(false);
    expect(hasVersionData(null)).toBe(false);
  });

  it('returns true for array with versions in nested items', () => {
    const arr = [{ url: '/a', method: 'GET', validation: { responseVersions: [{ id: '1' }] } }];
    expect(hasVersionData(arr)).toBe(true);
  });

  it('returns true for feature group with scenarios containing versions', () => {
    const fg = {
      scenarios: [{ tests: [{ url: '/a', method: 'GET', validation: { rulesVersions: [{ id: '1' }] } }] }],
    };
    expect(hasVersionData(fg)).toBe(true);
  });
});
