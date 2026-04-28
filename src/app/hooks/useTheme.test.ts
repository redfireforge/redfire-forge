/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// Mock storage
vi.mock('../../shared/utils/storage', () => ({
  saveTheme: vi.fn(),
}));

// Mock ThemeCustomizer functions
vi.mock('../ThemeCustomizer', () => ({
  loadSavedThemes: vi.fn(() => []),
  isCustomThemeId: vi.fn((id: string) => id.startsWith('custom:')),
  findSavedTheme: vi.fn((id: string) => {
    if (id === 'custom:test') {
      return { id: 'test', name: 'Test Theme', colors: {} };
    }
    return null;
  }),
  applyCustomTheme: vi.fn(),
  clearCustomOverrides: vi.fn(),
}));

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  it('initializes with dark theme', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe('dark');
    expect(result.current.showCustomizer).toBe(false);
    expect(result.current.themePickerOpen).toBe(false);
  });

  it('sets theme and updates DOM', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('light');
    });
    
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('provides THEMES and THEME_ICONS constants', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.THEMES).toBeDefined();
    expect(Array.isArray(result.current.THEMES)).toBe(true);
    expect(result.current.THEMES.length).toBeGreaterThan(0);
    
    expect(result.current.THEME_ICONS).toBeDefined();
    expect(typeof result.current.THEME_ICONS).toBe('object');
  });

  it('opens and closes theme customizer', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setShowCustomizer(true);
    });
    
    expect(result.current.showCustomizer).toBe(true);
    
    act(() => {
      result.current.setShowCustomizer(false);
    });
    
    expect(result.current.showCustomizer).toBe(false);
  });

  it('opens and closes theme picker', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setThemePickerOpen(true);
    });
    
    expect(result.current.themePickerOpen).toBe(true);
    
    act(() => {
      result.current.setThemePickerOpen(false);
    });
    
    expect(result.current.themePickerOpen).toBe(false);
  });

  it('provides themePickerRef', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.themePickerRef).toBeDefined();
    expect(result.current.themePickerRef.current).toBeNull();
  });

  it('provides reapplyTheme function', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(typeof result.current.reapplyTheme).toBe('function');
    
    act(() => {
      result.current.reapplyTheme();
    });
    
    // Should not throw
  });

  it('handles custom theme IDs', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('custom:test');
    });
    
    expect(result.current.theme).toBe('custom:test');
  });

  it('sets multiple themes sequentially', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    
    act(() => {
      result.current.setTheme('steel');
    });
    expect(result.current.theme).toBe('steel');
    
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
  });
});
