import { useState, useEffect, useRef } from 'react';
import { loadSavedThemes, isCustomThemeId, findSavedTheme, applyCustomTheme, clearCustomOverrides } from '../ThemeCustomizer';
import { saveTheme } from '../../shared/utils/storage';

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

export function useTheme() {
  const [theme, setTheme] = useState<string>('dark');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);

  // Apply theme to DOM + persist
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
    saveTheme(theme);
  }, [theme]);

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
