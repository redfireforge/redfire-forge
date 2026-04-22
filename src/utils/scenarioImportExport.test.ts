/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { reIdScenarios, wrapExport, unwrapImport, pickJsonFile } from './scenarioImportExport';

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
    ] as any;
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
    const input = [{ id: 'x', name: 'S', url: '/api', method: 'GET', tests: [{ id: 'y', name: 'T', assertions: [] }] }] as any;
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
    const mockInput = { type: '', accept: '', onchange: null as any, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('.json');
    expect(click).toHaveBeenCalled();
    expect(typeof mockInput.onchange).toBe('function');
  });

  it('does not call onLoad when no file selected', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as any, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    mockInput.onchange({ target: { files: [] } });
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('calls onLoad with parsed JSON when file is read', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as any, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    let capturedOnload: ((ev: any) => void) | null = null;
    const mockReadAsText = vi.fn();
    vi.stubGlobal('FileReader', class {
      onload: any = null;
      readAsText = (...args: any[]) => {
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
    const mockInput = { type: '', accept: '', onchange: null as any, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    let capturedOnload: any = null;
    const mockReadAsText = vi.fn();
    vi.stubGlobal('FileReader', class {
      onload: any = null;
      readAsText = (...args: any[]) => {
        capturedOnload = this.onload;
        mockReadAsText(...args);
      };
    });
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    const mockFile = new File(['not json'], 'test.json');
    mockInput.onchange({ target: { files: [mockFile] } });

    capturedOnload({ target: { result: 'not json' } });
    expect(onLoad).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not call onLoad when files is undefined', () => {
    const click = vi.fn();
    const mockInput = { type: '', accept: '', onchange: null as any, click };
    vi.spyOn(document, 'createElement').mockReturnValue(mockInput as any);

    const onLoad = vi.fn();
    pickJsonFile(onLoad);

    mockInput.onchange({ target: { files: undefined } });
    expect(onLoad).not.toHaveBeenCalled();
  });
});
