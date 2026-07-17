/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

import { readJsonArray, readJsonObject, writeJson } from './jsonKeyStorage';
import { readKey, writeKey } from './storage';

describe('readJsonArray', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('returns empty array when readKey returns null', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    expect(await readJsonArray('key')).toEqual([]);
  });

  it('returns parsed array when readKey returns valid JSON array', async () => {
    vi.mocked(readKey).mockResolvedValue('[{"id":"a"},{"id":"b"}]');
    expect(await readJsonArray<{ id: string }>('key')).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('returns empty array when parsed value is not an array', async () => {
    vi.mocked(readKey).mockResolvedValue('{"not":"array"}');
    expect(await readJsonArray('key')).toEqual([]);
  });

  it('returns empty array on JSON parse error', async () => {
    vi.mocked(readKey).mockResolvedValue('{invalid');
    expect(await readJsonArray('key')).toEqual([]);
  });
});

describe('readJsonObject', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('returns null when readKey returns null', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    expect(await readJsonObject('key')).toBeNull();
  });

  it('returns parsed object when readKey returns valid JSON', async () => {
    vi.mocked(readKey).mockResolvedValue('{"enabled":true,"mode":"strict"}');
    expect(await readJsonObject<{ enabled: boolean; mode: string }>('key')).toEqual({
      enabled: true,
      mode: 'strict',
    });
  });

  it('returns null on JSON parse error', async () => {
    vi.mocked(readKey).mockResolvedValue('not-json');
    expect(await readJsonObject('key')).toBeNull();
  });
});

describe('writeJson', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('writes stringified value via writeKey', async () => {
    vi.mocked(writeKey).mockResolvedValue();
    await writeJson('key', { foo: 'bar' });
    expect(writeKey).toHaveBeenCalledWith('key', '{"foo":"bar"}');
  });

  it('silently catches writeKey errors', async () => {
    vi.mocked(writeKey).mockRejectedValue(new Error('quota exceeded'));
    await expect(writeJson('key', [])).resolves.toBeUndefined();
  });
});
