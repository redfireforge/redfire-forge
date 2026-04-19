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

import { getItem, setItem, removeItem, listKeys, getUsageBytes } from './tauriStore';

describe('tauriStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  it('getItem reads a JSON file for the key', async () => {
    mockFs.readTextFile.mockResolvedValueOnce('{"data":"test"}');
    const result = await getItem('mykey');
    expect(result).toBe('{"data":"test"}');
    expect(mockFs.readTextFile).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
    );
  });

  it('getItem returns null when file does not exist', async () => {
    mockFs.readTextFile.mockRejectedValueOnce(new Error('Not found'));
    const result = await getItem('missing');
    expect(result).toBeNull();
  });

  it('setItem writes a JSON file', async () => {
    mockFs.writeTextFile.mockResolvedValueOnce(undefined);
    await setItem('mykey', '{"data":"test"}');
    expect(mockFs.writeTextFile).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
      '{"data":"test"}',
    );
  });

  it('removeItem deletes a JSON file', async () => {
    mockFs.remove.mockResolvedValueOnce(undefined);
    await removeItem('mykey');
    expect(mockFs.remove).toHaveBeenCalledWith(
      expect.stringContaining('mykey.json'),
    );
  });

  it('removeItem handles non-existent file', async () => {
    mockFs.remove.mockRejectedValueOnce(new Error('Not found'));
    await expect(removeItem('missing')).resolves.toBeUndefined();
  });

  it('listKeys returns key names from directory', async () => {
    mockFs.readDir.mockResolvedValueOnce([
      { name: 'key1.json' },
      { name: 'key2.json' },
      { name: 'not-json.txt' },
    ]);
    const keys = await listKeys();
    expect(keys).toEqual(['key1', 'key2']);
  });

  it('listKeys returns empty array on error', async () => {
    mockFs.readDir.mockRejectedValueOnce(new Error('Not found'));
    const keys = await listKeys();
    expect(keys).toEqual([]);
  });

  it('getUsageBytes calculates storage for perf-test keys', async () => {
    mockFs.readDir.mockResolvedValueOnce([
      { name: 'perf-test-runs.json' },
      { name: 'perf-test-config.json' },
      { name: 'other.json' },
    ]);
    mockFs.readTextFile
      .mockResolvedValueOnce('abcdef') // 6 chars -> 12 bytes
      .mockResolvedValueOnce('xyz');   // 3 chars -> 6 bytes

    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(18);
    expect(Object.keys(usage.entries)).toHaveLength(2);
  });

  it('getUsageBytes handles readDir error', async () => {
    mockFs.readDir.mockRejectedValueOnce(new Error('empty'));
    const usage = await getUsageBytes();
    expect(usage.usedBytes).toBe(0);
    expect(usage.entries).toEqual({});
  });
});
