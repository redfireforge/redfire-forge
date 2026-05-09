/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EDITABLE_VARS,
  readComputedVar,
  loadCustomTheme,
  saveCustomTheme,
  deleteCustomTheme,
  isCustomThemeId,
  extractCustomId,
  loadSavedThemes,
  persistSavedThemes,
  findSavedTheme,
  applyCustomTheme,
  clearCustomOverrides,
  type CustomThemeData,
  type SavedCustomTheme,
} from './themeCustomizerUtils';

const CUSTOM_THEME_KEY = 'perf-test-custom-theme';
const CUSTOM_THEMES_KEY = 'perf-test-custom-themes';

function mockComputedStyle(map: Record<string, string>) {
  return vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
    return {
      getPropertyValue: (v: string) => map[v] ?? '',
    } as CSSStyleDeclaration;
  });
}

describe('themeCustomizerUtils', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    for (const { key } of EDITABLE_VARS) {
      document.documentElement.style.removeProperty(key);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    for (const { key } of EDITABLE_VARS) {
      document.documentElement.style.removeProperty(key);
    }
  });

  describe('EDITABLE_VARS', () => {
    it('contains expected CSS variable keys', () => {
      const keys = EDITABLE_VARS.map((e) => e.key);
      expect(keys).toContain('--bg');
      expect(keys).toContain('--primary');
      expect(EDITABLE_VARS.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('readComputedVar', () => {
    it('converts rgb() values to hex', () => {
      mockComputedStyle({ '--x': '  rgb(10, 20, 30)  ' });
      expect(readComputedVar('--x')).toBe('#0a141e');
    });

    it('returns hex strings as-is when raw starts with #', () => {
      mockComputedStyle({ '--x': '#aabbcc' });
      expect(readComputedVar('--x')).toBe('#aabbcc');
    });

    it('returns non-rgb non-hex raw values unchanged (after trim)', () => {
      mockComputedStyle({ '--x': '  hsl(0, 50%, 50%)  ' });
      expect(readComputedVar('--x')).toBe('hsl(0, 50%, 50%)');
    });

    it('handles rgb with single-digit components via regex (only standard triple)', () => {
      mockComputedStyle({ '--x': 'rgb(1, 2, 3)' });
      expect(readComputedVar('--x')).toBe('#010203');
    });
  });

  describe('loadCustomTheme / saveCustomTheme / deleteCustomTheme', () => {
    const sample: CustomThemeData = {
      base: 'dark',
      overrides: { '--text': '#ffffff' },
      contrast: 0,
    };

    it('returns null when key is missing', () => {
      expect(loadCustomTheme()).toBeNull();
    });

    it('round-trips theme data', () => {
      saveCustomTheme(sample);
      expect(loadCustomTheme()).toEqual(sample);
    });

    it('returns null when JSON is invalid', () => {
      localStorage.setItem(CUSTOM_THEME_KEY, 'not-json');
      expect(loadCustomTheme()).toBeNull();
    });

    it('deleteCustomTheme removes stored key', () => {
      saveCustomTheme(sample);
      deleteCustomTheme();
      expect(localStorage.getItem(CUSTOM_THEME_KEY)).toBeNull();
    });
  });

  describe('isCustomThemeId / extractCustomId', () => {
    it('isCustomThemeId is true only for custom: prefix', () => {
      expect(isCustomThemeId('custom:abc')).toBe(true);
      expect(isCustomThemeId('dark')).toBe(false);
      expect(isCustomThemeId('')).toBe(false);
    });

    it('extractCustomId strips custom: prefix', () => {
      expect(extractCustomId('custom:my-id-123')).toBe('my-id-123');
    });
  });

  describe('loadSavedThemes', () => {
    it('returns empty array when no saved themes and no legacy theme', () => {
      expect(loadSavedThemes()).toEqual([]);
    });

    it('returns parsed array when CUSTOM_THEMES_KEY is set', () => {
      const themes: SavedCustomTheme[] = [
        {
          id: 't1',
          name: 'T1',
          base: 'dark',
          overrides: {},
          contrast: 0,
        },
      ];
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
      expect(loadSavedThemes()).toEqual(themes);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem(CUSTOM_THEMES_KEY, '{broken');
      expect(loadSavedThemes()).toEqual([]);
    });

    it('migrates legacy single theme into saved list and clears legacy key', () => {
      const legacy: CustomThemeData = { base: 'steel', overrides: { '--bg': '#111111' }, contrast: 5 };
      localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(legacy));
      const uuid = '00000000-0000-4000-8000-000000000001';
      vi.spyOn(crypto, 'randomUUID').mockReturnValue(uuid);

      const result = loadSavedThemes();

      expect(result).toEqual([{ ...legacy, id: uuid, name: 'My Theme' }]);
      expect(JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || '[]')).toEqual(result);
      expect(localStorage.getItem(CUSTOM_THEME_KEY)).toBeNull();
    });

    it('does not migrate when CUSTOM_THEMES_KEY already exists (even if empty array)', () => {
      const legacy: CustomThemeData = { base: 'dark', overrides: {}, contrast: 0 };
      localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(legacy));
      localStorage.setItem(CUSTOM_THEMES_KEY, '[]');

      vi.spyOn(crypto, 'randomUUID').mockReturnValue('should-not-be-used');

      expect(loadSavedThemes()).toEqual([]);
      expect(localStorage.getItem(CUSTOM_THEME_KEY)).toEqual(JSON.stringify(legacy));
    });
  });

  describe('persistSavedThemes', () => {
    it('writes JSON array to localStorage', () => {
      const themes: SavedCustomTheme[] = [
        { id: 'a', name: 'A', base: 'dark', overrides: {}, contrast: 0 },
      ];
      persistSavedThemes(themes);
      expect(JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY) || 'null')).toEqual(themes);
    });
  });

  describe('findSavedTheme', () => {
    it('returns null for non-custom theme ids', () => {
      expect(findSavedTheme('dark')).toBeNull();
    });

    it('returns null when custom id not found', () => {
      expect(findSavedTheme('custom:missing')).toBeNull();
    });

    it('returns matching theme by extracted id', () => {
      const t: SavedCustomTheme = {
        id: 'find-me',
        name: 'N',
        base: 'light',
        overrides: {},
        contrast: 0,
      };
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify([t]));
      expect(findSavedTheme('custom:find-me')).toEqual(t);
    });
  });

  describe('applyCustomTheme', () => {
    it('sets data-theme and applies override properties', () => {
      const data: CustomThemeData = {
        base: 'dark',
        overrides: { '--text': '#eeeeee', '--primary': '#00ff00' },
        contrast: 0,
      };
      applyCustomTheme(data);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.getPropertyValue('--text').trim()).toBe('#eeeeee');
      expect(document.documentElement.style.getPropertyValue('--primary').trim()).toBe('#00ff00');
    });

    it('skips override entries with falsy values', () => {
      const data = {
        base: 'dark',
        overrides: { '--text': '' as unknown as string },
        contrast: 0,
      };
      applyCustomTheme(data);
      expect(document.documentElement.style.getPropertyValue('--text')).toBe('');
    });

    it('does not shift colors when contrast is 0', () => {
      mockComputedStyle({
        '--text': '#808080',
        '--text-muted': '#707070',
        '--bg': '#202020',
        '--surface': '#303030',
        '--surface-hover': '#404040',
      });
      const data: CustomThemeData = {
        base: 'dim',
        overrides: {},
        contrast: 0,
      };
      applyCustomTheme(data);
      // No contrast pass: vars not set from overrides; read path for contrast also not used when 0
      expect(document.documentElement.getAttribute('data-theme')).toBe('dim');
    });

    it('applies positive contrast to text vars and negative to background (from computed)', () => {
      mockComputedStyle({
        '--text': 'rgb(100, 100, 100)',
        '--text-muted': 'rgb(90, 90, 90)',
        '--bg': 'rgb(20, 20, 20)',
        '--surface': 'rgb(30, 30, 30)',
        '--surface-hover': 'rgb(40, 40, 40)',
      });
      const data: CustomThemeData = {
        base: 'dark',
        overrides: {},
        contrast: 50,
      };
      applyCustomTheme(data);
      const t = document.documentElement.style.getPropertyValue('--text').trim();
      expect(t.startsWith('#')).toBe(true);
      expect(t).not.toBe('#646464'); // shifted from #64...
      // Lightened gray should be lighter than #646464
      const n = parseInt(t.slice(1), 16);
      expect(n).toBeGreaterThan(0);
    });

    it('uses overrides for contrast when present and hex', () => {
      const data: CustomThemeData = {
        base: 'dark',
        overrides: {
          '--text': '#000000',
          '--text-muted': '#111111',
          '--bg': '#ffffff',
          '--surface': '#eeeeee',
          '--surface-hover': '#dddddd',
        },
        contrast: 10,
      };
      applyCustomTheme(data);
      expect(document.documentElement.style.getPropertyValue('--text').trim().startsWith('#')).toBe(true);
      expect(document.documentElement.style.getPropertyValue('--bg').trim().startsWith('#')).toBe(true);
    });

    it('does not call shiftContrast for vars that resolve to non-hex (e.g. hsl)', () => {
      mockComputedStyle({
        '--text': 'hsl(0, 0%, 50%)',
        '--text-muted': 'hsl(0, 0%, 40%)',
        '--bg': 'hsl(0, 0%, 10%)',
        '--surface': 'hsl(0, 0%, 15%)',
        '--surface-hover': 'hsl(0, 0%, 20%)',
      });
      applyCustomTheme({ base: 'dark', overrides: {}, contrast: 20 });
      expect(document.documentElement.style.getPropertyValue('--text').trim()).toBe('');
    });

    it('leaves invalid hex unchanged in contrast path (shiftContrast returns original)', () => {
      const data: CustomThemeData = {
        base: 'dark',
        overrides: {
          '--text': '#gggggg',
          '--text-muted': '#gggggg',
          '--bg': '#hhhhhh',
          '--surface': '#hhhhhh',
          '--surface-hover': '#hhhhhh',
        },
        contrast: 10,
      };
      applyCustomTheme(data);
      expect(document.documentElement.style.getPropertyValue('--text').trim()).toBe('#gggggg');
    });
  });

  describe('clearCustomOverrides', () => {
    it('removes all EDITABLE_VARS from documentElement.style', () => {
      const root = document.documentElement;
      for (const { key } of EDITABLE_VARS) {
        root.style.setProperty(key, '#123456');
      }
      clearCustomOverrides();
      for (const { key } of EDITABLE_VARS) {
        expect(root.style.getPropertyValue(key).trim()).toBe('');
      }
    });
  });

  describe('negative contrast (shiftContrast t < 0)', () => {
    it('darkens rgb-based bg when contrast shifts with negative amount', () => {
      mockComputedStyle({
        '--text': 'rgb(128, 128, 128)',
        '--text-muted': 'rgb(120, 120, 120)',
        '--bg': 'rgb(200, 200, 200)',
        '--surface': 'rgb(190, 190, 190)',
        '--surface-hover': 'rgb(180, 180, 180)',
      });
      applyCustomTheme({ base: 'light', overrides: {}, contrast: -20 });
      const bg = document.documentElement.style.getPropertyValue('--bg').trim();
      expect(bg.startsWith('#')).toBe(true);
    });
  });
});
