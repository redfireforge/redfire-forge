import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashSchemaPaths,
  buildPatternKey,
  savePattern,
  loadPattern,
  patternToSuggestions,
  deletePattern,
} from './mappingPatterns';
import type { Mapping } from '../types';

const mockStorage = new Map<string, string>();

beforeEach(() => {
  mockStorage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    get length() { return mockStorage.size; },
    key: (i: number) => [...mockStorage.keys()][i] ?? null,
    clear: () => mockStorage.clear(),
  });
});

describe('hashSchemaPaths', () => {
  it('returns a string', () => {
    const hash = hashSchemaPaths(['a', 'b', 'c']);
    expect(typeof hash).toBe('string');
  });

  it('returns the same hash for same paths regardless of order', () => {
    const h1 = hashSchemaPaths(['name', 'email', 'age']);
    const h2 = hashSchemaPaths(['age', 'name', 'email']);
    expect(h1).toBe(h2);
  });

  it('returns different hashes for different paths', () => {
    const h1 = hashSchemaPaths(['name', 'email']);
    const h2 = hashSchemaPaths(['firstName', 'lastName']);
    expect(h1).not.toBe(h2);
  });

  it('handles empty array', () => {
    const hash = hashSchemaPaths([]);
    expect(typeof hash).toBe('string');
  });
});

describe('buildPatternKey', () => {
  it('includes context and hashes', () => {
    const key = buildPatternKey('ctx1', ['a'], ['b']);
    expect(key).toContain('dm-patterns:');
    expect(key).toContain('ctx1');
  });

  it('different contexts produce different keys', () => {
    const k1 = buildPatternKey('ctx1', ['a'], ['b']);
    const k2 = buildPatternKey('ctx2', ['a'], ['b']);
    expect(k1).not.toBe(k2);
  });
});

describe('savePattern / loadPattern', () => {
  const mappings: Mapping[] = [
    { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    { id: '2', sourcePath: 'email', sourceId: 's1', targetPath: 'userEmail', expression: '$lower($.email)' },
  ];
  const srcPaths = ['name', 'email', 'age'];
  const tgtPaths = ['userName', 'userEmail', 'userAge'];

  it('saves and loads a pattern', () => {
    savePattern('test', srcPaths, tgtPaths, mappings);
    const loaded = loadPattern('test', srcPaths, tgtPaths);
    expect(loaded).not.toBeNull();
    expect(loaded!.entries).toHaveLength(2);
    expect(loaded!.entries[0].sourcePath).toBe('name');
    expect(loaded!.entries[0].targetPath).toBe('userName');
    expect(loaded!.entries[1].expression).toBe('$lower($.email)');
    expect(loaded!.savedAt).toBeGreaterThan(0);
  });

  it('returns null when no pattern saved', () => {
    expect(loadPattern('nonexistent', srcPaths, tgtPaths)).toBeNull();
  });

  it('does not save empty mappings', () => {
    savePattern('test', srcPaths, tgtPaths, []);
    expect(loadPattern('test', srcPaths, tgtPaths)).toBeNull();
  });

  it('overwrites existing pattern', () => {
    savePattern('test', srcPaths, tgtPaths, mappings);
    const newMappings: Mapping[] = [
      { id: '3', sourcePath: 'age', sourceId: 's1', targetPath: 'userAge' },
    ];
    savePattern('test', srcPaths, tgtPaths, newMappings);
    const loaded = loadPattern('test', srcPaths, tgtPaths);
    expect(loaded!.entries).toHaveLength(1);
    expect(loaded!.entries[0].sourcePath).toBe('age');
  });
});

describe('deletePattern', () => {
  it('removes a saved pattern', () => {
    const mappings: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    savePattern('test', ['name'], ['userName'], mappings);
    expect(loadPattern('test', ['name'], ['userName'])).not.toBeNull();
    deletePattern('test', ['name'], ['userName']);
    expect(loadPattern('test', ['name'], ['userName'])).toBeNull();
  });
});

describe('patternToSuggestions', () => {
  it('returns entries where both paths exist and target is unmapped', () => {
    const pattern = {
      entries: [
        { sourcePath: 'name', targetPath: 'userName' },
        { sourcePath: 'email', targetPath: 'userEmail' },
        { sourcePath: 'phone', targetPath: 'userPhone' },
      ],
      savedAt: Date.now(),
    };
    const srcPaths = new Set(['name', 'email', 'age']);
    const tgtPaths = new Set(['userName', 'userEmail', 'userAge']);
    const existing: Mapping[] = [
      { id: '1', sourcePath: 'name', sourceId: 's1', targetPath: 'userName' },
    ];
    const suggestions = patternToSuggestions(pattern, srcPaths, tgtPaths, existing);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sourcePath).toBe('email');
    expect(suggestions[0].targetPath).toBe('userEmail');
  });

  it('filters out entries where source path no longer exists', () => {
    const pattern = {
      entries: [{ sourcePath: 'removed', targetPath: 'userName' }],
      savedAt: Date.now(),
    };
    const srcPaths = new Set(['name']);
    const tgtPaths = new Set(['userName']);
    expect(patternToSuggestions(pattern, srcPaths, tgtPaths, [])).toHaveLength(0);
  });

  it('filters out entries where target path no longer exists', () => {
    const pattern = {
      entries: [{ sourcePath: 'name', targetPath: 'removedTarget' }],
      savedAt: Date.now(),
    };
    const srcPaths = new Set(['name']);
    const tgtPaths = new Set(['userName']);
    expect(patternToSuggestions(pattern, srcPaths, tgtPaths, [])).toHaveLength(0);
  });

  it('returns empty array for empty pattern', () => {
    const pattern = { entries: [], savedAt: Date.now() };
    expect(patternToSuggestions(pattern, new Set(['a']), new Set(['b']), [])).toHaveLength(0);
  });

  it('preserves expression in suggestions', () => {
    const pattern = {
      entries: [{ sourcePath: 'name', targetPath: 'userName', expression: '$upper($.name)' }],
      savedAt: Date.now(),
    };
    const suggestions = patternToSuggestions(pattern, new Set(['name']), new Set(['userName']), []);
    expect(suggestions[0].expression).toBe('$upper($.name)');
  });
});

describe('loadPattern error handling', () => {
  it('returns null for corrupt JSON in localStorage', () => {
    localStorage.setItem('dm-patterns:test:abc:def', 'NOT VALID JSON');
    expect(loadPattern('test', ['a'], ['b'])).toBeNull();
    localStorage.removeItem('dm-patterns:test:abc:def');
  });
});

describe('savePattern with pruning', () => {
  it('prunes oldest entries when exceeding max count', () => {
    for (let i = 0; i < 105; i++) {
      const key = `dm-patterns:ctx${i}:h${i}:h${i}`;
      localStorage.setItem(key, JSON.stringify({ entries: [], savedAt: i }));
    }
    savePattern('newCtx', ['a'], ['b'], [
      { id: '1', sourcePath: 'a', sourceId: 's', targetPath: 'b' },
    ]);
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dm-patterns:')) count++;
    }
    expect(count).toBeLessThanOrEqual(101);
    for (let i = 0; i < 105; i++) {
      localStorage.removeItem(`dm-patterns:ctx${i}:h${i}:h${i}`);
    }
  });
});
