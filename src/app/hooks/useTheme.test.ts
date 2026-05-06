/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// Mock storage
vi.mock('../../shared/utils/storage', () => ({
  saveTheme: vi.fn(),
}));

// Mock ThemeCustomizer
vi.mock('../ThemeCustomizer', () => ({
  loadSavedThemes: vi.fn().mockReturnValue([]),
  isCustomThemeId: vi.fn((id: string) => id.startsWith('custom:')),
  findSavedTheme: vi.fn().mockReturnValue(null),
  applyCustomTheme: vi.fn(),
  clearCustomOverrides: vi.fn(),
}));

import { saveTheme } from '../../shared/utils/storage';
import { loadSavedThemes, isCustomThemeId, findSavedTheme, applyCustomTheme, clearCustomOverrides } from '../ThemeCustomizer';

const mockSaveTheme = vi.mocked(saveTheme);
const mockLoadSavedThemes = vi.mocked(loadSavedThemes);
const mockIsCustomThemeId = vi.mocked(isCustomThemeId);
const mockFindSavedTheme = vi.mocked(findSavedTheme);
const mockApplyCustomTheme = vi.mocked(applyCustomTheme);
const mockClearCustomOverrides = vi.mocked(clearCustomOverrides);

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCustomThemeId.mockImplementation((id: string) => id.startsWith('custom:'));
    mockLoadSavedThemes.mockReturnValue([]);
    mockFindSavedTheme.mockReturnValue(null);
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
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

      vi.clearAllMocks();

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

      vi.clearAllMocks();

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
});
