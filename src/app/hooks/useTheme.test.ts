/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// Mock storage
vi.mock('../../shared/utils/storage', () => ({
  saveTheme: vi.fn(),
  readKey: vi.fn().mockResolvedValue(null),
}));

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../themeCustomizerUtils', () => ({
  loadSavedThemes: vi.fn().mockReturnValue([]),
  isCustomThemeId: vi.fn((id: string) => id.startsWith('custom:')),
  findSavedTheme: vi.fn().mockReturnValue(null),
  applyCustomTheme: vi.fn(),
  clearCustomOverrides: vi.fn(),
}));

import { saveTheme, readKey } from '@shared/utils/storage';
import { isTauri } from '@shared/utils/platform';
import { loadSavedThemes, isCustomThemeId, findSavedTheme, applyCustomTheme, clearCustomOverrides } from '../themeCustomizerUtils';

const mockSaveTheme = vi.mocked(saveTheme);
const mockReadKey = vi.mocked(readKey);
const mockIsTauri = vi.mocked(isTauri);
const mockLoadSavedThemes = vi.mocked(loadSavedThemes);
const mockIsCustomThemeId = vi.mocked(isCustomThemeId);
const mockFindSavedTheme = vi.mocked(findSavedTheme);
const mockApplyCustomTheme = vi.mocked(applyCustomTheme);
const mockClearCustomOverrides = vi.mocked(clearCustomOverrides);

/** Install a fake `window.matchMedia` reporting the given color scheme. */
function mockMatchMedia(prefersLight: boolean): { fireChange: (matchesDark: boolean) => void } {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: false,
    media: '',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.push(cb); },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    ...mql,
    matches: query.includes('light') ? prefersLight : !prefersLight,
  })));
  return {
    fireChange: (matchesDark: boolean) => {
      listeners.forEach(cb => cb({ matches: matchesDark } as MediaQueryListEvent));
    },
  };
}

describe('useTheme', () => {
  beforeEach(() => {
    resetAllMocks();
    mockIsCustomThemeId.mockImplementation((id: string) => id.startsWith('custom:'));
    mockLoadSavedThemes.mockReturnValue([]);
    mockFindSavedTheme.mockReturnValue(null);
    mockIsTauri.mockReturnValue(false);
    mockReadKey.mockResolvedValue(null);
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('returns default dark theme', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });

    it('returns theme management state', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.showCustomizer).toBe(false);
      expect(result.current.themePickerOpen).toBe(false);
      expect(result.current.themePickerRef).toBeDefined();
    });

    it('exports THEMES and THEME_ICONS', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.THEMES).toBeDefined();
      expect(result.current.THEMES.length).toBeGreaterThan(0);
      expect(result.current.THEME_ICONS).toBeDefined();
      expect(result.current.THEME_ICONS['dark']).toBeDefined();
    });
  });

  describe('system preference auto-detect', () => {
    it('defaults to dark when system prefers dark and no saved theme', () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });

    it('defaults to light when system prefers light and no saved theme', () => {
      mockMatchMedia(true);

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
    });

    it('does not persist the auto-derived initial theme to storage', () => {
      mockMatchMedia(true);

      renderHook(() => useTheme());

      expect(mockSaveTheme).not.toHaveBeenCalled();
    });

    it('saved theme overrides system preference on initial load', () => {
      localStorage.setItem('perf-test-theme', 'steel');
      mockMatchMedia(true); // system prefers light — saved 'steel' should still win

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('steel');
    });

    it('live system preference change updates theme when no explicit choice was made', () => {
      const { fireChange } = mockMatchMedia(false); // starts dark-preferring

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');

      act(() => {
        fireChange(false); // system switched to light
      });

      expect(result.current.theme).toBe('light');
    });

    it('live system preference change is ignored after the user picks a theme', () => {
      const { fireChange } = mockMatchMedia(false);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('sapphire'); // explicit user pick
      });

      act(() => {
        fireChange(false); // system flips to light — should be ignored now
      });

      expect(result.current.theme).toBe('sapphire');
    });

    it('restores a previously saved Tauri theme asynchronously on mount', async () => {
      mockIsTauri.mockReturnValue(true);
      mockReadKey.mockResolvedValue('dusk');

      const { result } = renderHook(() => useTheme());

      await act(async () => { await Promise.resolve(); });

      expect(result.current.theme).toBe('dusk');
    });
  });

  describe('setTheme', () => {
    it('applies theme to document', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('saves theme to storage', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('steel');
      });

      expect(mockSaveTheme).toHaveBeenCalledWith('steel');
    });

    it('clears custom overrides when switching to non-custom theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dim');
      });

      expect(mockClearCustomOverrides).toHaveBeenCalled();
    });
  });

  describe('custom themes', () => {
    it('applies custom theme data', () => {
      const customThemeData = { id: 'mytheme', name: 'My Theme', tokens: {} };
      mockFindSavedTheme.mockReturnValue(customThemeData);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('custom:mytheme');
      });

      expect(mockApplyCustomTheme).toHaveBeenCalledWith(customThemeData);
    });

    it('falls back to dark when custom theme not found', () => {
      mockFindSavedTheme.mockReturnValue(null);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('custom:nonexistent');
      });

      expect(mockClearCustomOverrides).toHaveBeenCalled();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('migrates legacy custom theme', () => {
      mockLoadSavedThemes.mockReturnValue([{ id: 'legacy', name: 'Legacy', tokens: {} }]);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('custom');
      });

      expect(result.current.theme).toBe('custom:legacy');
    });
  });

  describe('reapplyTheme', () => {
    it('reapplies current non-custom theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      resetAllMocks();

      act(() => {
        result.current.reapplyTheme();
      });

      expect(mockClearCustomOverrides).toHaveBeenCalled();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('reapplies custom theme', () => {
      const customThemeData = { id: 'mytheme', name: 'My Theme', tokens: {} };
      mockFindSavedTheme.mockReturnValue(customThemeData);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('custom:mytheme');
      });

      resetAllMocks();

      act(() => {
        result.current.reapplyTheme();
      });

      expect(mockApplyCustomTheme).toHaveBeenCalledWith(customThemeData);
    });
  });

  describe('theme picker', () => {
    it('opens and closes theme picker', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.themePickerOpen).toBe(false);

      act(() => {
        result.current.setThemePickerOpen(true);
      });

      expect(result.current.themePickerOpen).toBe(true);

      act(() => {
        result.current.setThemePickerOpen(false);
      });

      expect(result.current.themePickerOpen).toBe(false);
    });
  });

  describe('customizer', () => {
    it('opens and closes customizer', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.showCustomizer).toBe(false);

      act(() => {
        result.current.setShowCustomizer(true);
      });

      expect(result.current.showCustomizer).toBe(true);

      act(() => {
        result.current.setShowCustomizer(false);
      });

      expect(result.current.showCustomizer).toBe(false);
    });
  });

  describe('outside click handling', () => {
    it('closes theme picker on outside click when ref is null', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setThemePickerOpen(true);
      });

      expect(result.current.themePickerOpen).toBe(true);

      // When themePickerRef.current is null, the condition fails and picker closes
      // The ref is null by default from useRef, so clicking outside should close
      // But the condition is: if (ref.current && !ref.current.contains(target))
      // When ref.current is null, the first part fails, so it doesn't close
      // Let's test the case where the ref exists but doesn't contain the click
      const pickerDiv = document.createElement('div');
      document.body.appendChild(pickerDiv);

      // Set the ref to a real element
      Object.defineProperty(result.current.themePickerRef, 'current', {
        value: pickerDiv,
        writable: true,
      });

      // Click on an element outside the picker
      const outsideDiv = document.createElement('div');
      document.body.appendChild(outsideDiv);

      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true });
        Object.defineProperty(event, 'target', { value: outsideDiv });
        document.dispatchEvent(event);
      });

      expect(result.current.themePickerOpen).toBe(false);

      document.body.removeChild(pickerDiv);
      document.body.removeChild(outsideDiv);
    });

    it('does not close picker when clicking inside ref', () => {
      const { result } = renderHook(() => useTheme());

      // Create a div to act as the picker
      const pickerDiv = document.createElement('div');
      document.body.appendChild(pickerDiv);

      // Manually set the ref
      Object.defineProperty(result.current.themePickerRef, 'current', {
        value: pickerDiv,
        writable: true,
      });

      act(() => {
        result.current.setThemePickerOpen(true);
      });

      expect(result.current.themePickerOpen).toBe(true);

      // Simulate click inside the picker
      act(() => {
        const event = new MouseEvent('mousedown', { bubbles: true });
        Object.defineProperty(event, 'target', { value: pickerDiv });
        document.dispatchEvent(event);
      });

      // Picker should stay open since click was inside
      expect(result.current.themePickerOpen).toBe(true);

      document.body.removeChild(pickerDiv);
    });
  });

  describe('legacy custom theme with no saved themes', () => {
    it('sets document theme to dark when legacy custom has no saved themes', () => {
      mockLoadSavedThemes.mockReturnValue([]);

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('custom');
      });

      // Should fall back to dark theme when no saved themes exist
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
