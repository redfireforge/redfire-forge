/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExportFilename, saveFile, saveJsonFile, saveCsvFile, openJsonFile } from './fileSaver';

vi.mock('./platform', () => ({
  isTauri: vi.fn(() => false),
}));

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
});

describe('openJsonFile', () => {
  it('returns null when not in Tauri', async () => {
    const result = await openJsonFile();
    expect(result).toBeNull();
  });
});
