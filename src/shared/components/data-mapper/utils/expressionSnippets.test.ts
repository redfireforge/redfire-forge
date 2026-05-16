/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
} from './expressionSnippets';

const STORAGE_KEY = 'dm-expression-snippets-v1';

const storageMocks = vi.hoisted(() => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

vi.mock('../../../utils/storage', () => ({
  readKey: storageMocks.readKey,
  writeKey: storageMocks.writeKey,
}));

describe('expressionSnippets', () => {
  let snippetStore: Record<string, string | undefined>;
  let rejectNextWrite: boolean;

  beforeEach(() => {
    snippetStore = {};
    rejectNextWrite = false;
    storageMocks.readKey.mockReset();
    storageMocks.writeKey.mockReset();
    storageMocks.readKey.mockImplementation((key: string) =>
      Promise.resolve(snippetStore[key] ?? null));
    storageMocks.writeKey.mockImplementation((key: string, value: string) => {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        return Promise.reject(new Error('disk full'));
      }
      snippetStore[key] = value;
      return Promise.resolve();
    });
  });

  it('loads empty list when key is absent', async () => {
    await expect(loadExpressionSnippets()).resolves.toEqual([]);
    expect(storageMocks.readKey).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('returns empty list on corrupt payload', async () => {
    snippetStore[STORAGE_KEY] = '{bad json';
    await expect(loadExpressionSnippets()).resolves.toEqual([]);
  });

  it('returns empty list when parsed JSON is not an array', async () => {
    snippetStore[STORAGE_KEY] = JSON.stringify({ foo: 1 });
    await expect(loadExpressionSnippets()).resolves.toEqual([]);
  });

  it('drops entries that are not objects', async () => {
    snippetStore[STORAGE_KEY] = JSON.stringify([
      null,
      'x',
      { id: 'a', name: 'n', expression: 'e', updatedAt: 1 },
    ]);
    const loaded = await loadExpressionSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('n');
  });

  it('drops entries with missing required fields', async () => {
    snippetStore[STORAGE_KEY] = JSON.stringify([
      { id: '1', name: 'only-name' },
      { id: '2', expression: 'expr' },
      { id: '3', name: 'Full', expression: 'ok', updatedAt: 5 },
    ]);
    const loaded = await loadExpressionSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].expression).toBe('ok');
  });

  it('uses Date.now when updatedAt is not a number', async () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(424242);
    snippetStore[STORAGE_KEY] = JSON.stringify([
      { id: '1', name: 'a', expression: 'x', updatedAt: 'not-a-number' },
    ]);
    const loaded = await loadExpressionSnippets();
    expect(loaded[0].updatedAt).toBe(424242);
    spy.mockRestore();
  });

  it('saves and reloads snippets', async () => {
    const saved = await saveExpressionSnippet('Upper Name', '$upper($.name)');
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Upper Name');

    const loaded = await loadExpressionSnippets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].expression).toBe('$upper($.name)');
  });

  it('updates snippet when name already exists (case-insensitive)', async () => {
    await saveExpressionSnippet('Name Rule', '$upper($.name)');
    const next = await saveExpressionSnippet('name rule', '$lower($.name)');
    expect(next).toHaveLength(1);
    expect(next[0].expression).toBe('$lower($.name)');
  });

  it('deletes snippet by id', async () => {
    const saved = await saveExpressionSnippet('temp', '$toString($.age)');
    const remaining = await deleteExpressionSnippet(saved[0].id);
    expect(remaining).toEqual([]);
  });

  it('ignores empty snippet save inputs', async () => {
    await saveExpressionSnippet('', 'x');
    await saveExpressionSnippet('name', '');
    expect(snippetStore[STORAGE_KEY]).toBeUndefined();
    expect(storageMocks.writeKey).not.toHaveBeenCalled();
  });

  it('swallows persist errors from writeKey', async () => {
    rejectNextWrite = true;
    const saved = await saveExpressionSnippet('n', '$x');
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('n');
  });
});
