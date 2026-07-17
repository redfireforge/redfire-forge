/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDualModeArrayStorage } from './storageDualMode';

const { isTauriMock, readKeyMock, writeKeyMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  readKeyMock: vi.fn(async () => null as string | null),
  writeKeyMock: vi.fn(async () => undefined),
}));

vi.mock('./platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('./storage', () => ({
  readKey: (key: string) => readKeyMock(key),
  writeKey: (key: string, value: string) => writeKeyMock(key, value),
}));

interface TestItem {
  id: string;
  name: string;
}

const STORAGE_KEY = 'test-dual-mode-key';

describe('createDualModeArrayStorage', () => {
  const idbLoad = vi.fn(async (): Promise<TestItem[] | null> => null);
  const idbSave = vi.fn(async (_data: TestItem[]) => undefined);
  const idbMigrate = vi.fn(async (_lsKey: string) => true);

  beforeEach(() => {
    resetAllMocks();
    isTauriMock.mockReturnValue(false);
    readKeyMock.mockResolvedValue(null);
    writeKeyMock.mockResolvedValue(undefined);
    idbLoad.mockResolvedValue(null);
    idbSave.mockResolvedValue(undefined);
    idbMigrate.mockResolvedValue(true);
    localStorage.clear();
  });

  function createStorage(swallowWriteErrors = false) {
    return createDualModeArrayStorage<TestItem>({
      key: STORAGE_KEY,
      idbLoad,
      idbSave,
      idbMigrate,
      swallowWriteErrors,
    });
  }

  describe('load', () => {
    it('Tauri mode: reads from readKey, parses JSON, returns array', async () => {
      isTauriMock.mockReturnValue(true);
      const items: TestItem[] = [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }];
      readKeyMock.mockResolvedValue(JSON.stringify(items));

      const result = await createStorage().load();

      expect(readKeyMock).toHaveBeenCalledWith(STORAGE_KEY);
      expect(result).toEqual(items);
      expect(idbLoad).not.toHaveBeenCalled();
    });

    it('Tauri mode: readKey returns null → returns empty array', async () => {
      isTauriMock.mockReturnValue(true);
      readKeyMock.mockResolvedValue(null);

      const result = await createStorage().load();

      expect(result).toEqual([]);
    });

    it('Tauri mode: readKey throws → returns empty array', async () => {
      isTauriMock.mockReturnValue(true);
      readKeyMock.mockRejectedValue(new Error('read failed'));

      const result = await createStorage().load();

      expect(result).toEqual([]);
    });

    it('Browser mode: idbLoad succeeds → returns IDB data', async () => {
      const items: TestItem[] = [{ id: 'idb-1', name: 'From IDB' }];
      idbLoad.mockResolvedValue(items);

      const result = await createStorage().load();

      expect(idbLoad).toHaveBeenCalled();
      expect(result).toEqual(items);
      expect(readKeyMock).not.toHaveBeenCalled();
    });

    it('Browser mode: idbLoad returns null, readKey returns data → returns parsed data and calls idbMigrate', async () => {
      const items: TestItem[] = [{ id: 'ls-1', name: 'From LS' }];
      idbLoad.mockResolvedValue(null);
      readKeyMock.mockResolvedValue(JSON.stringify(items));

      const result = await createStorage().load();

      expect(result).toEqual(items);
      expect(idbMigrate).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('Browser mode: readKey returns empty array → clears legacy key without migrating', async () => {
      idbLoad.mockResolvedValue(null);
      readKeyMock.mockResolvedValue(JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY, '[]');

      const result = await createStorage().load();

      expect(result).toEqual([]);
      expect(idbMigrate).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('Browser mode: readKey returns non-array JSON → returns empty array', async () => {
      idbLoad.mockResolvedValue(null);
      readKeyMock.mockResolvedValue(JSON.stringify({ not: 'array' }));

      const result = await createStorage().load();

      expect(result).toEqual([]);
      expect(idbMigrate).not.toHaveBeenCalled();
    });

    it('Browser mode: idbLoad null, readKey null → returns empty array', async () => {
      idbLoad.mockResolvedValue(null);
      readKeyMock.mockResolvedValue(null);

      const result = await createStorage().load();

      expect(result).toEqual([]);
      expect(idbMigrate).not.toHaveBeenCalled();
    });

    it('Browser mode: both fail → returns empty array', async () => {
      idbLoad.mockRejectedValue(new Error('idb load failed'));
      readKeyMock.mockRejectedValue(new Error('read failed'));

      const result = await createStorage().load();

      expect(result).toEqual([]);
    });
  });

  describe('save', () => {
    const items: TestItem[] = [{ id: '1', name: 'Save me' }];

    it('Tauri mode: calls writeKey with JSON', async () => {
      isTauriMock.mockReturnValue(true);

      await createStorage().save(items);

      expect(writeKeyMock).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(items));
      expect(idbSave).not.toHaveBeenCalled();
    });

    it('Tauri mode with swallowWriteErrors: writeKey throws → no error propagated', async () => {
      isTauriMock.mockReturnValue(true);
      writeKeyMock.mockRejectedValue(new Error('quota exceeded'));

      await expect(createStorage(true).save(items)).resolves.toBeUndefined();
    });

    it('Browser mode: calls idbSave, removes localStorage key if present', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

      await createStorage().save(items);

      expect(idbSave).toHaveBeenCalledWith(items);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(writeKeyMock).not.toHaveBeenCalled();
    });

    it('Browser mode: idbSave succeeds without localStorage key → skips removeItem', async () => {
      await createStorage().save(items);

      expect(idbSave).toHaveBeenCalledWith(items);
      expect(writeKeyMock).not.toHaveBeenCalled();
    });

    it('Browser mode: idbLoad succeeds → removes stale localStorage copy', async () => {
      const items: TestItem[] = [{ id: 'idb-1', name: 'From IDB' }];
      idbLoad.mockResolvedValue(items);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'old', name: 'Legacy' }]));

      const result = await createStorage().load();

      expect(result).toEqual(items);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('Browser mode: idbSave fails → does not fall back to localStorage', async () => {
      idbSave.mockRejectedValue(new Error('idb save failed'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(createStorage().save(items)).resolves.toBeUndefined();

      expect(writeKeyMock).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });
});
