export interface CustomThemeOverrides {
  [variable: string]: string;
}

export interface CustomThemeData {
  base: string;
  overrides: CustomThemeOverrides;
  contrast: number;
}

const CUSTOM_THEME_KEY = 'perf-test-custom-theme';

export const EDITABLE_VARS = [
  { key: '--bg',           label: 'Background' },
  { key: '--surface',      label: 'Surface' },
  { key: '--surface-hover', label: 'Surface Hover' },
  { key: '--border',       label: 'Border' },
  { key: '--text',         label: 'Text' },
  { key: '--text-muted',   label: 'Text Muted' },
  { key: '--primary',      label: 'Primary' },
  { key: '--primary-hover', label: 'Primary Hover' },
  { key: '--accent',       label: 'Accent' },
  { key: '--danger',       label: 'Danger' },
  { key: '--success',      label: 'Success' },
  { key: '--warning',      label: 'Warning' },
] as const;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function shiftContrast(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount / 100;
  if (t >= 0) {
    return rgbToHex(
      rgb[0] + (255 - rgb[0]) * t,
      rgb[1] + (255 - rgb[1]) * t,
      rgb[2] + (255 - rgb[2]) * t,
    );
  }
  return rgbToHex(rgb[0] * (1 + t), rgb[1] * (1 + t), rgb[2] * (1 + t));
}

export function readComputedVar(v: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const rgbMatch = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(raw);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  if (raw.startsWith('#')) return raw;
  return raw;
}

export function loadCustomTheme(): CustomThemeData | null {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveCustomTheme(data: CustomThemeData): void {
  localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(data));
}

export function deleteCustomTheme(): void {
  localStorage.removeItem(CUSTOM_THEME_KEY);
}

export interface SavedCustomTheme extends CustomThemeData {
  id: string;
  name: string;
}

const CUSTOM_THEMES_KEY = 'perf-test-custom-themes';

export function isCustomThemeId(themeId: string): boolean {
  return themeId.startsWith('custom:');
}

export function extractCustomId(themeId: string): string {
  return themeId.slice(7);
}

export function loadSavedThemes(): SavedCustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (raw) return JSON.parse(raw);
    const old = loadCustomTheme();
    if (old) {
      const migrated: SavedCustomTheme = { ...old, id: crypto.randomUUID(), name: 'My Theme' };
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify([migrated]));
      localStorage.removeItem(CUSTOM_THEME_KEY);
      return [migrated];
    }
    return [];
  } catch { return []; }
}

export function persistSavedThemes(themes: SavedCustomTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

export function findSavedTheme(themeId: string): SavedCustomTheme | null {
  if (!isCustomThemeId(themeId)) return null;
  const id = extractCustomId(themeId);
  return loadSavedThemes().find(t => t.id === id) ?? null;
}

export function applyCustomTheme(data: CustomThemeData): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', data.base);

  for (const [key, value] of Object.entries(data.overrides)) {
    if (value) root.style.setProperty(key, value);
  }

  if (data.contrast !== 0) {
    const textVars = ['--text', '--text-muted'];
    const bgVars = ['--bg', '--surface', '--surface-hover'];
    for (const v of textVars) {
      const current = data.overrides[v] || readComputedVar(v);
      if (current.startsWith('#')) root.style.setProperty(v, shiftContrast(current, data.contrast));
    }
    for (const v of bgVars) {
      const current = data.overrides[v] || readComputedVar(v);
      if (current.startsWith('#')) root.style.setProperty(v, shiftContrast(current, -data.contrast));
    }
  }
}

export function clearCustomOverrides(): void {
  const root = document.documentElement;
  for (const { key } of EDITABLE_VARS) root.style.removeProperty(key);
}
