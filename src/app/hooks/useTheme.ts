import { useState, useEffect, useRef, useCallback } from 'react';
import { loadSavedThemes, isCustomThemeId, findSavedTheme, applyCustomTheme, clearCustomOverrides } from '../themeCustomizerUtils';
import { saveTheme, readKey } from '@shared/utils/storage';
import { THEME_KEY } from '@shared/utils/storageKeys';
import { isTauri } from '@shared/utils/platform';

const THEMES = [
  { group: 'Dark', items: [
    { id: 'dark',     icon: '🌙', label: 'Default',  bg: '#0f172a' },
    { id: 'dim',      icon: '🌗', label: 'Dim',      bg: '#1c2128' },
    { id: 'steel',    icon: '⚙️', label: 'Steel',    bg: '#1e1e1e' },
    { id: 'sapphire', icon: '💎', label: 'Sapphire', bg: '#0f1923' },
  ]},
  { group: 'Mid-Dark', items: [
    { id: 'dusk',   icon: '🌆', label: 'Dusk',   bg: '#282c34' },
    { id: 'linear', icon: '✦',  label: 'Linear', bg: '#19181c' },
    { id: 'slack',  icon: '💬', label: 'Slack',  bg: '#1a1d21' },
  ]},
  { group: 'Light', items: [
    { id: 'light', icon: '☀️', label: 'Classic', bg: '#eef2f7' },
    { id: 'mist',  icon: '🌫️', label: 'Mist',    bg: '#e8ecf1' },
    { id: 'frost', icon: '❄️', label: 'Frost',   bg: '#f0f4f8' },
    { id: 'sage',  icon: '🌿', label: 'Sage',    bg: '#e8ebe4' },
    { id: 'sand',  icon: '🏖️', label: 'Sand',    bg: '#f4f0e8' },
  ]},
] as const;

const THEME_ICONS: Record<string, string> = {
  ...Object.fromEntries(THEMES.flatMap(g => g.items.map(t => [t.id, t.icon]))),
  custom: '🎨',
};

/**
 * Synchronously read a previously saved theme in browser mode (localStorage is
 * synchronous). Tauri's store is async — restored separately in an effect on
 * mount, since it cannot be read before first render.
 */
function getSavedThemeSync(): string | null {
  if (isTauri()) return null;
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** True when the OS/browser reports a light color-scheme preference. */
function prefersLightScheme(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

/** Saved preference always wins; otherwise fall back to system preference. */
function getInitialTheme(): string {
  const saved = getSavedThemeSync();
  if (saved) return saved;
  return prefersLightScheme() ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, rawSetTheme] = useState<string>(getInitialTheme);
  // True once the theme reflects an explicit user choice (or a restored saved
  // value) rather than the system-preference auto-default. Gates persistence
  // and stops the live system-preference listener from overriding a real pick.
  const explicitPreferenceRef = useRef<boolean>(getSavedThemeSync() !== null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  /** Public setter — any explicit call marks the theme as a real user choice. */
  const setTheme = useCallback((next: string) => {
    explicitPreferenceRef.current = true;
    rawSetTheme(next);
  }, []);

  // Tauri's store is async — getInitialTheme() cannot read it synchronously,
  // so restore any previously saved theme once here after mount.
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    readKey(THEME_KEY).then((saved) => {
      if (!cancelled && saved) setTheme(saved);
    }).catch(() => { /* keep the system-preferred default */ });
    return () => { cancelled = true; };
  }, [setTheme]);

  // Live system theme changes only take effect until the user makes an
  // explicit choice (or a saved preference is restored) — then this no-ops.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (explicitPreferenceRef.current) return;
      rawSetTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Apply theme to DOM + persist (only once an explicit preference exists —
  // an auto-derived default is never written to storage, so the live listener
  // above keeps tracking system changes across the whole session).
  useEffect(() => {
    if (theme === 'custom') {
      // Legacy migration: single-custom → named custom theme
      const themes = loadSavedThemes();
      if (themes.length > 0) { setTheme(`custom:${themes[0].id}`); return; }
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (isCustomThemeId(theme)) {
      const data = findSavedTheme(theme);
      if (data) applyCustomTheme(data);
      else { clearCustomOverrides(); document.documentElement.setAttribute('data-theme', 'dark'); }
    } else {
      clearCustomOverrides();
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (explicitPreferenceRef.current) saveTheme(theme);
  }, [theme, setTheme]);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) setThemePickerOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Re-apply current theme (e.g. after cancelling customizer). */
  const reapplyTheme = () => {
    if (isCustomThemeId(theme)) {
      const data = findSavedTheme(theme);
      if (data) applyCustomTheme(data);
    } else {
      clearCustomOverrides();
      document.documentElement.setAttribute('data-theme', theme);
    }
  };

  return {
    theme,
    setTheme,
    showCustomizer,
    setShowCustomizer,
    themePickerOpen,
    setThemePickerOpen,
    themePickerRef,
    reapplyTheme,
    THEMES,
    THEME_ICONS,
  } as const;
}
