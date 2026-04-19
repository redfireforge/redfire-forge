import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFs = {
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  readDir: vi.fn(),
  mkdir: vi.fn(),
};

const mockAppDataDir = vi.fn(() => Promise.resolve('/Users/test/.appdata/redfireforge/'));

vi.mock('@tauri-apps/plugin-fs', () => mockFs);
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: () => mockAppDataDir(),
}));

async function loadTauriStore() {
  vi.resetModules();
  return import('./tauriStore');
}

describe('tauriStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockAppDataDir.mockResolvedValue('/Users/test/.appdata/redfireforge/');
  });

  it('getItem reads a JSON file for the key', async () => {
    const { getItem } = await loadTauriStore();
    mockFs.readTextFile.mockResolvedValueOnce('{"data":"test"}');
    const result = await getItem('mykey');
    expect(result).toBe('{"data":"test"}');
    expect(mockFs.readTextFile).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
    );
  });

  it('getItem returns null when file does not exist', async () => {
    const { getItem } = await loadTauriStore();
    mockFs.readTextFile.mockRejectedValueOnce(new Error('Not found'));
    const result = await getItem('missing');
    expect(result).toBeNull();
  });

  it('setItem writes a JSON file', async () => {
    const { setItem } = await loadTauriStore();
    mockFs.writeTextFile.mockResolvedValueOnce(undefined);
    await setItem('mykey', '{"data":"test"}');
    expect(mockFs.writeTextFile).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
      '{"data":"test"}',
    );
  });

  it('removeItem deletes a JSON file', async () => {
    const { removeItem } = await loadTauriStore();
    mockFs.remove.mockResolvedValueOnce(undefined);
    await removeItem('mykey');
    expect(mockFs.remove).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
    );
  });

  it('removeItem handles non-existent file', async () => {
    const { removeItem } = await loadTauriStore();
    mockFs.remove.mockRejectedValueOnce(new Error('Not found'));
    await expect(removeItem('missing')).resolves.toBeUndefined();
  });

  it('listKeys returns key names from directory', async () => {
    const { listKeys } = await loadTauriStore();
    mockFs.readDir.mockResolvedValueOnce([
      { name: 'key1.json' },
      { name: 'key2.json' },
      { name: 'not-json.txt' },
    ]);
    const keys = await listKeys();
    expect(keys).toEqual(['key1', 'key2']);
  });

  it('listKeys skips entries without a name', async () => {
    const { listKeys } = await loadTauriStore();
    mockFs.readDir.mockResolvedValueOnce([
      { name: 'a.json' },
      {},
      { name: undefined },
    ]);
    const keys = await listKeys();
    expect(keys).toEqual(['a']);
  });

  it('listKeys returns empty array on error', async () => {
    const { listKeys } = await loadTauriStore();
    mockFs.readDir.mockRejectedValueOnce(new Error('Not found'));
    const keys = await listKeys();
    expect(keys).toEqual([]);
  });

  it('getUsageBytes calculates storage for perf-test keys', async () => {
    const { getUsageBytes } = await loadTauriStore();
    mockFs.readDir.mockResolvedValueOnce([
      { name: 'perf-test-runs.json' },
      { name: 'perf-test-config.json' },
      { name: 'other.json' },
    ]);
    mockFs.readTextFile
      .mockResolvedValueOnce('abcdef')
      .mockResolvedValueOnce('xyz');

    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(18);
    expect(Object.keys(usage.entries)).toHaveLength(2);
  });

  it('getUsageBytes skips non-perf-test json files', async () => {
    const { getUsageBytes } = await loadTauriStore();
    mockFs.readDir.mockResolvedValueOnce([{ name: 'settings.json' }]);
    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(0);
    expect(usage.entries).toEqual({});
    expect(mockFs.readTextFile).not.toHaveBeenCalled();
  });

  it('getUsageBytes skips perf-test file when read fails', async () => {
    const { getUsageBytes } = await loadTauriStore();
    mockFs.readDir.mockResolvedValueOnce([{ name: 'perf-test-broken.json' }]);
    mockFs.readTextFile.mockRejectedValueOnce(new Error('io'));
    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(0);
    expect(usage.entries).toEqual({});
  });

  it('getUsageBytes handles readDir error', async () => {
    const { getUsageBytes } = await loadTauriStore();
    mockFs.readDir.mockRejectedValueOnce(new Error('empty'));
    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(0);
    expect(usage.entries).toEqual({});
  });

  it('ensureReady ignores mkdir failure when directory already exists', async () => {
    mockAppDataDir.mockResolvedValueOnce('/app/dir');
    mockFs.mkdir.mockRejectedValueOnce(new Error('EEXIST'));
    mockFs.readTextFile.mockResolvedValueOnce('{}');
    const { getItem } = await loadTauriStore();
    await expect(getItem('x')).resolves.toBe('{}');
    expect(mockFs.mkdir).toHaveBeenCalled();
  });

  it('keyToFile does not double the path separator when app dir ends with slash', async () => {
    mockAppDataDir.mockResolvedValueOnce('/app/with/trailing/');
    mockFs.readTextFile.mockResolvedValueOnce('ok');
    const { getItem } = await loadTauriStore();
    await getItem('mykey');
    expect(mockFs.readTextFile).toHaveBeenCalledWith('/app/with/trailing/mykey.json');
  });
});
