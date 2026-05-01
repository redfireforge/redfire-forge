/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadScriptLibraries,
  saveScriptLibraries,
  createScriptLibrary,
  updateScriptLibrary,
  deleteScriptLibrary,
  getScriptLibraryById,
  buildLibraryPreamble,
} from './scriptLibraries';
import type { ScriptLibrary } from './scriptLibraries';

// Mock uuid
vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

describe('scriptLibraries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadScriptLibraries', () => {
    it('returns empty array when nothing stored', () => {
      expect(loadScriptLibraries()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      localStorage.setItem('workflow:scriptLibraries', 'not json');
      expect(loadScriptLibraries()).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      localStorage.setItem('workflow:scriptLibraries', '{"foo": "bar"}');
      expect(loadScriptLibraries()).toEqual([]);
    });

    it('loads valid libraries', () => {
      const libs: ScriptLibrary[] = [{
        id: '1', name: 'Test', description: 'desc', code: '// code',
        createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }];
      localStorage.setItem('workflow:scriptLibraries', JSON.stringify(libs));
      expect(loadScriptLibraries()).toEqual(libs);
    });
  });

  describe('saveScriptLibraries', () => {
    it('saves libraries to localStorage', () => {
      const libs: ScriptLibrary[] = [{
        id: '1', name: 'Test', description: '', code: '// code',
        createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }];
      saveScriptLibraries(libs);
      expect(JSON.parse(localStorage.getItem('workflow:scriptLibraries')!)).toEqual(libs);
    });
  });

  describe('createScriptLibrary', () => {
    it('creates a library with trimmed name and description', () => {
      const lib = createScriptLibrary('  My Lib  ', '  desc  ', '// code');
      expect(lib.id).toBe('test-uuid-123');
      expect(lib.name).toBe('My Lib');
      expect(lib.description).toBe('desc');
      expect(lib.code).toBe('// code');
      expect(lib.createdAt).toBeTruthy();
      expect(lib.updatedAt).toBeTruthy();
    });
  });

  describe('updateScriptLibrary', () => {
    const libs: ScriptLibrary[] = [{
      id: '1', name: 'Original', description: 'orig desc', code: '// orig',
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    }, {
      id: '2', name: 'Other', description: '', code: '// other',
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    }];

    it('updates name', () => {
      const updated = updateScriptLibrary(libs, '1', { name: '  New Name  ' });
      expect(updated[0].name).toBe('New Name');
      expect(updated[0].updatedAt).not.toBe('2024-01-01');
      expect(updated[1].name).toBe('Other'); // unchanged
    });

    it('updates description', () => {
      const updated = updateScriptLibrary(libs, '1', { description: 'new desc' });
      expect(updated[0].description).toBe('new desc');
    });

    it('updates code', () => {
      const updated = updateScriptLibrary(libs, '1', { code: '// new' });
      expect(updated[0].code).toBe('// new');
    });

    it('leaves non-matching IDs unchanged', () => {
      const updated = updateScriptLibrary(libs, 'nonexistent', { name: 'X' });
      expect(updated).toEqual(libs);
    });

    it('does not override fields not in updates', () => {
      const updated = updateScriptLibrary(libs, '1', { name: 'Changed' });
      expect(updated[0].code).toBe('// orig');
      expect(updated[0].description).toBe('orig desc');
    });
  });

  describe('deleteScriptLibrary', () => {
    it('removes library by ID', () => {
      const libs: ScriptLibrary[] = [
        { id: '1', name: 'A', description: '', code: '', createdAt: '', updatedAt: '' },
        { id: '2', name: 'B', description: '', code: '', createdAt: '', updatedAt: '' },
      ];
      const result = deleteScriptLibrary(libs, '1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('returns same array if ID not found', () => {
      const libs: ScriptLibrary[] = [
        { id: '1', name: 'A', description: '', code: '', createdAt: '', updatedAt: '' },
      ];
      expect(deleteScriptLibrary(libs, 'nonexistent')).toHaveLength(1);
    });
  });

  describe('getScriptLibraryById', () => {
    const libs: ScriptLibrary[] = [
      { id: '1', name: 'A', description: '', code: '', createdAt: '', updatedAt: '' },
      { id: '2', name: 'B', description: '', code: '', createdAt: '', updatedAt: '' },
    ];

    it('finds library by ID', () => {
      expect(getScriptLibraryById(libs, '2')?.name).toBe('B');
    });

    it('returns undefined for unknown ID', () => {
      expect(getScriptLibraryById(libs, 'x')).toBeUndefined();
    });
  });

  describe('buildLibraryPreamble', () => {
    const libs: ScriptLibrary[] = [
      { id: '1', name: 'Utils', description: '', code: 'function add(a,b){return a+b}', createdAt: '', updatedAt: '' },
      { id: '2', name: 'Helpers', description: '', code: 'function mul(a,b){return a*b}', createdAt: '', updatedAt: '' },
    ];

    it('returns empty string for empty libraryIds', () => {
      expect(buildLibraryPreamble(libs, [])).toBe('');
    });

    it('returns empty string for undefined-like input', () => {
      expect(buildLibraryPreamble(libs, [])).toBe('');
    });

    it('includes single library code with header comment', () => {
      const result = buildLibraryPreamble(libs, ['1']);
      expect(result).toContain('// --- Library: Utils ---');
      expect(result).toContain('function add(a,b){return a+b}');
      expect(result).not.toContain('mul');
    });

    it('includes multiple libraries in order', () => {
      const result = buildLibraryPreamble(libs, ['2', '1']);
      expect(result).toContain('// --- Library: Helpers ---');
      expect(result).toContain('// --- Library: Utils ---');
      // Helpers should come first since it's first in libraryIds
      const helpersIdx = result.indexOf('Helpers');
      const utilsIdx = result.indexOf('Utils');
      expect(helpersIdx).toBeLessThan(utilsIdx);
    });

    it('skips unknown library IDs', () => {
      const result = buildLibraryPreamble(libs, ['unknown']);
      expect(result).toBe('');
    });

    it('includes known and skips unknown', () => {
      const result = buildLibraryPreamble(libs, ['1', 'unknown']);
      expect(result).toContain('Utils');
      expect(result).not.toContain('unknown');
    });
  });
});
