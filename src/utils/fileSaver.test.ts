/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tauriMocks = vi.hoisted(() => ({
  save: vi.fn(),
  open: vi.fn(),
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
  documentDir: vi.fn(() => Promise.resolve('/Users/docs')),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => tauriMocks.save(...args),
  open: (...args: unknown[]) => tauriMocks.open(...args),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: unknown[]) => tauriMocks.writeTextFile(...args),
  readTextFile: (...args: unknown[]) => tauriMocks.readTextFile(...args),
  mkdir: (...args: unknown[]) => tauriMocks.mkdir(...args),
  exists: (...args: unknown[]) => tauriMocks.exists(...args),
}));

vi.mock('@tauri-apps/api/path', () => ({
  documentDir: (...args: unknown[]) => tauriMocks.documentDir(...args),
}));

vi.mock('./platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from './platform';
import { buildExportFilename, saveFile, saveJsonFile, saveCsvFile, openJsonFile } from './fileSaver';

describe('buildExportFilename', () => {
  it('builds filename with all segments', () => {
    const result = buildExportFilename({
      env: 'Dev', svc: 'My Service', level: 'results',
      name: 'Test Case', date: '2026-01-01T00-00-00',
    });
    expect(result).toBe('dev-my-service-results-test-case-2026-01-01T00-00-00.json');
  });

  it('omits undefined segments', () => {
    const result = buildExportFilename({ level: 'results', date: '2026-01-01' });
    expect(result).toBe('results-2026-01-01.json');
  });

  it('uses custom extension', () => {
    const result = buildExportFilename({ level: 'data', ext: 'csv', date: '2026-01-01' });
    expect(result).toBe('data-2026-01-01.csv');
  });

  it('defaults to json extension', () => {
    const result = buildExportFilename({ level: 'results', date: '2026-01-01' });
    expect(result.endsWith('.json')).toBe(true);
  });

  it('generates date when not provided', () => {
    const result = buildExportFilename({ level: 'results' });
    expect(result).toMatch(/^results-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('slugifies special characters', () => {
    const result = buildExportFilename({ env: 'My Env!', svc: 'Hello@World', level: 'results', date: 'x' });
    expect(result).toBe('my-env-hello-world-results-x.json');
  });

  it('strips leading and trailing hyphens from slugified segments', () => {
    const result = buildExportFilename({ level: '---Mixed___Case---', date: 'd' });
    expect(result).toBe('mixed-case-d.json');
  });

  it('slugifies multi-dot extension segment in name via level only edge', () => {
    const result = buildExportFilename({ level: 'export.v2', date: '2026' });
    expect(result).toBe('export-v2-2026.json');
  });
});

describe('saveFile (browser fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  it('creates download link and clicks it', async () => {
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const click = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChild);
    vi.spyOn(document, 'createElement').mockReturnValue({
      click,
      set href(v: string) { /* noop */ },
      set download(v: string) { /* noop */ },
    } as any);

    const blob = new Blob(['test'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'test.json', mimeType: 'application/json' });

    expect(appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

describe('saveJsonFile', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      href: '',
      download: '',
    } as any);
  });

  it('creates a JSON blob and saves it', async () => {
    await saveJsonFile({ key: 'value' }, 'output.json');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('saveCsvFile', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      href: '',
      download: '',
    } as any);
  });

  it('creates a CSV blob and saves it', async () => {
    await saveCsvFile('a,b,c\n1,2,3', 'output.csv');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('saveFile with showSaveFilePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  it('uses showSaveFilePicker when available', async () => {
    const mockWritable = { write: vi.fn(), close: vi.fn() };
    const mockHandle = { createWritable: vi.fn().mockResolvedValue(mockWritable) };
    (window as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

    const blob = new Blob(['test'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'test.json', mimeType: 'application/json' });

    expect((window as any).showSaveFilePicker).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalledWith(blob);
    expect(mockWritable.close).toHaveBeenCalled();
    delete (window as any).showSaveFilePicker;
  });

  it('uses .json accept extension when filename has no extension', async () => {
    const mockWritable = { write: vi.fn(), close: vi.fn() };
    const mockHandle = { createWritable: vi.fn().mockResolvedValue(mockWritable) };
    const showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);
    (window as any).showSaveFilePicker = showSaveFilePicker;

    const blob = new Blob(['x'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'noext', mimeType: 'application/json', description: 'My export' });

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'noext',
        types: [
          expect.objectContaining({
            description: 'My export',
            accept: { 'application/json': ['.json'] },
          }),
        ],
      }),
    );
    delete (window as any).showSaveFilePicker;
  });

  it('falls back to download link on AbortError', async () => {
    const abortErr = new DOMException('User cancelled', 'AbortError');
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(abortErr);

    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());

    const blob = new Blob(['test'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'test.json', mimeType: 'application/json' });

    delete (window as any).showSaveFilePicker;
  });

  it('falls back to download link on other errors', async () => {
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(new Error('Not supported'));

    const click = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    vi.spyOn(document, 'createElement').mockReturnValue({
      click,
      href: '',
      download: '',
    } as any);

    const blob = new Blob(['test'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'test.json', mimeType: 'application/json' });

    expect(click).toHaveBeenCalled();
    delete (window as any).showSaveFilePicker;
  });

  it('falls back to download link on non-abort DOMException', async () => {
    const err = new DOMException('Security', 'SecurityError');
    (window as any).showSaveFilePicker = vi.fn().mockRejectedValue(err);

    const click = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    vi.spyOn(document, 'createElement').mockReturnValue({
      click,
      href: '',
      download: '',
    } as any);

    const blob = new Blob(['test'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'test.json', mimeType: 'application/json' });

    expect(click).toHaveBeenCalled();
    delete (window as any).showSaveFilePicker;
  });
});

describe('saveFile (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    tauriMocks.documentDir.mockResolvedValue('/Users/docs');
    tauriMocks.exists.mockResolvedValue(true);
    tauriMocks.mkdir.mockResolvedValue(undefined);
    tauriMocks.save.mockResolvedValue('/chosen/path/out.json');
    tauriMocks.writeTextFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('writes blob text via writeTextFile when user picks a path', async () => {
    const blob = new Blob(['hello-tauri'], { type: 'application/json' });
    await saveFile(blob, { filename: 'export.json', mimeType: 'application/json', description: 'JSON export' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: expect.stringMatching(/RedfireForge\/export\.json$/),
        filters: [{ name: 'JSON export', extensions: ['json'] }],
      }),
    );
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith('/chosen/path/out.json', 'hello-tauri');
  });

  it('returns early when dialog is cancelled', async () => {
    tauriMocks.save.mockResolvedValueOnce(null as unknown as string);

    const blob = new Blob(['x'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'nope.txt', mimeType: 'text/plain' });

    expect(tauriMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it('uses filename-only defaultPath when export dir cannot be resolved', async () => {
    tauriMocks.documentDir.mockRejectedValueOnce(new Error('no doc dir'));

    const blob = new Blob(['z'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'solo.csv', mimeType: 'text/csv' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'solo.csv',
        filters: [{ name: 'File', extensions: ['csv'] }],
      }),
    );
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith('/chosen/path/out.json', 'z');
  });

  it('uses filename-only defaultPath when isTauri flips off inside getDefaultExportDir', async () => {
    let isTauriCalls = 0;
    vi.mocked(isTauri).mockImplementation(() => {
      isTauriCalls += 1;
      return isTauriCalls === 1;
    });

    const blob = new Blob(['q'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'edge.txt', mimeType: 'text/plain' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'edge.txt' }),
    );
    vi.mocked(isTauri).mockReturnValue(true);
  });

  it('defaults filter extension to json when filename has no dot', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' });
    await saveFile(blob, { filename: 'data', mimeType: 'application/json' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'File', extensions: ['json'] }],
      }),
    );
  });

  it('creates export directory when missing', async () => {
    tauriMocks.exists.mockResolvedValueOnce(false);

    const blob = new Blob(['1'], { type: 'text/plain' });
    await saveFile(blob, { filename: 'f.txt', mimeType: 'text/plain' });

    expect(tauriMocks.mkdir).toHaveBeenCalledWith(
      '/Users/docs/RedfireForge',
      { recursive: true },
    );
  });

  it('does not add extra separator when document dir ends with slash', async () => {
    tauriMocks.documentDir.mockResolvedValueOnce('/var/mobile/Documents/');

    const blob = new Blob([''], { type: 'text/plain' });
    await saveFile(blob, { filename: 'a.bin', mimeType: 'application/octet-stream' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/var/mobile/Documents/RedfireForge/a.bin',
      }),
    );
  });

  it('does not add extra separator when document dir ends with backslash', async () => {
    tauriMocks.documentDir.mockResolvedValueOnce('C:\\Users\\me\\Documents\\');

    const blob = new Blob([''], { type: 'text/plain' });
    await saveFile(blob, { filename: 'a.bin', mimeType: 'application/octet-stream' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'C:\\Users\\me\\Documents\\RedfireForge/a.bin',
      }),
    );
  });

  it('joins export dir without trailing slash using forward slash', async () => {
    tauriMocks.documentDir.mockResolvedValueOnce('/home/user/Documents');

    const blob = new Blob([''], { type: 'text/plain' });
    await saveFile(blob, { filename: 'x.dat', mimeType: 'application/octet-stream' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/home/user/Documents/RedfireForge/x.dat',
      }),
    );
  });

  it('uses forward slash between document dir and export folder name', async () => {
    tauriMocks.documentDir.mockResolvedValueOnce('/var/data');

    const blob = new Blob([''], { type: 'text/plain' });
    await saveFile(blob, { filename: 'nested.txt', mimeType: 'text/plain' });

    expect(tauriMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/var/data/RedfireForge/nested.txt',
      }),
    );
  });
});

describe('saveJsonFile and saveCsvFile (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    tauriMocks.exists.mockResolvedValue(true);
    tauriMocks.save.mockResolvedValue('/out/file');
    tauriMocks.writeTextFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('delegates to saveFile with JSON options', async () => {
    await saveJsonFile({ a: 1 }, 'pretty.json');
    expect(tauriMocks.save).toHaveBeenCalled();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith(
      '/out/file',
      expect.stringContaining('"a": 1'),
    );
  });

  it('delegates to saveFile with CSV options', async () => {
    await saveCsvFile('h1,h2\n1,2', 'sheet.csv');
    expect(tauriMocks.save).toHaveBeenCalled();
    expect(tauriMocks.writeTextFile).toHaveBeenCalledWith('/out/file', 'h1,h2\n1,2');
  });
});

describe('openJsonFile', () => {
  it('returns null when not in Tauri', async () => {
    const result = await openJsonFile();
    expect(result).toBeNull();
  });
});

describe('openJsonFile (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    tauriMocks.exists.mockResolvedValue(true);
    tauriMocks.readTextFile.mockResolvedValue('{"ok":true}');
    tauriMocks.open.mockResolvedValue('/data/project/config.json');
  });

  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('returns name and content when user selects a file', async () => {
    const result = await openJsonFile();
    expect(result).toEqual({ name: 'config.json', content: '{"ok":true}' });
    expect(tauriMocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'JSON file', extensions: ['json'] }],
        multiple: false,
        directory: false,
      }),
    );
    expect(tauriMocks.readTextFile).toHaveBeenCalledWith('/data/project/config.json');
  });

  it('returns null when open dialog is cancelled', async () => {
    tauriMocks.open.mockResolvedValueOnce(null);

    const result = await openJsonFile();
    expect(result).toBeNull();
    expect(tauriMocks.readTextFile).not.toHaveBeenCalled();
  });

  it('derives basename when path mixes drive letter with forward slashes', async () => {
    tauriMocks.open.mockResolvedValueOnce('D:/share/backup/data.json');

    const result = await openJsonFile();
    expect(result).toEqual({ name: 'data.json', content: '{"ok":true}' });
  });

  it('passes export directory as defaultPath when available', async () => {
    tauriMocks.documentDir.mockResolvedValueOnce('/Users/me/Documents');

    await openJsonFile();

    expect(tauriMocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: '/Users/me/Documents/RedfireForge',
      }),
    );
  });

  it('omits defaultPath when export directory cannot be resolved', async () => {
    tauriMocks.documentDir.mockRejectedValueOnce(new Error('fs'));

    await openJsonFile();

    expect(tauriMocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: undefined,
      }),
    );
  });
});
