/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
} from './expressionSnippets';

vi.mock('../../../utils/storage', () => ({
  readKey: vi.fn((key: string) => Promise.resolve(localStorage.getItem(key))),
  writeKey: vi.fn((key: string, value: string) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }),
}));

const STORAGE_KEY = 'dm-expression-snippets-v1';

describe('expressionSnippets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads empty list when key is absent', async () => {
    await expect(loadExpressionSnippets()).resolves.toEqual([]);
  });

  it('returns empty list on corrupt payload', async () => {
    localStorage.setItem(STORAGE_KEY, '{bad json');
    await expect(loadExpressionSnippets()).resolves.toEqual([]);
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
    const loaded = await loadExpressionSnippets();
    expect(loaded).toEqual([]);
  });
});
