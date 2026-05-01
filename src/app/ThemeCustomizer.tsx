import { useState, useEffect, useCallback, useRef } from 'react';
import { useModalDrag } from '../shared/hooks/useModalDrag';

/* ────────────────────────────────────────────────────
   Custom theme = overrides on top of a base preset.
   We store { base, overrides } in localStorage.
   ──────────────────────────────────────────────────── */

export interface CustomThemeOverrides {
  [variable: string]: string;
}

export interface CustomThemeData {
  base: string;
  overrides: CustomThemeOverrides;
  contrast: number; // -100 … +100   (0 = no shift)
}

const CUSTOM_THEME_KEY = 'perf-test-custom-theme';

const EDITABLE_VARS = [
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

/* ── helpers ── */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** Shift a hex color toward white (+) or black (-) by `amount` (-100…100). */
function shiftContrast(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount / 100; // -1…1
  if (t >= 0) {
    return rgbToHex(
      rgb[0] + (255 - rgb[0]) * t,
      rgb[1] + (255 - rgb[1]) * t,
      rgb[2] + (255 - rgb[2]) * t,
    );
  }
  return rgbToHex(rgb[0] * (1 + t), rgb[1] * (1 + t), rgb[2] * (1 + t));
}

function readComputedVar(v: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  // may be rgb(...) or hex
  const rgbMatch = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(raw);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  if (raw.startsWith('#')) return raw;
  return raw;
}

/* ── persistence ── */

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

/* ── Multi-theme library ── */

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
    // Migrate from old single-theme format
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

function persistSavedThemes(themes: SavedCustomTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

export function findSavedTheme(themeId: string): SavedCustomTheme | null {
  if (!isCustomThemeId(themeId)) return null;
  const id = extractCustomId(themeId);
  return loadSavedThemes().find(t => t.id === id) ?? null;
}

/** Apply custom overrides + contrast shift onto the current <html> element. */
export function applyCustomTheme(data: CustomThemeData): void {
  const root = document.documentElement;
  // First set the base theme so computed vars resolve correctly
  root.setAttribute('data-theme', data.base);

  // Then apply each override
  for (const [key, value] of Object.entries(data.overrides)) {
    if (value) root.style.setProperty(key, value);
  }

  // Apply contrast shift to text/bg vars
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

/** Remove all inline style overrides from <html>. */
export function clearCustomOverrides(): void {
  const root = document.documentElement;
  for (const { key } of EDITABLE_VARS) root.style.removeProperty(key);
}

/* ── component ── */

interface Props {
  currentTheme: string;
  onClose: () => void;
  onApply: (themeId: string) => void; // tells App to set theme='custom'
}

export default function ThemeCustomizer({ currentTheme, onClose, onApply }: Props) {
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true);
  const activeSaved = isCustomThemeId(currentTheme) ? findSavedTheme(currentTheme) : null;
  const initBase = activeSaved ? activeSaved.base : (isCustomThemeId(currentTheme) || currentTheme === 'custom' ? 'dark' : currentTheme);
  const [overrides, setOverrides] = useState<CustomThemeOverrides>(() => activeSaved?.overrides ?? {});
  const [contrast, setContrast] = useState(() => activeSaved?.contrast ?? 0);
  const [baseTheme, setBaseTheme] = useState(initBase);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Saved themes library
  const [savedThemes, setSavedThemes] = useState<SavedCustomTheme[]>(() => loadSavedThemes());
  const [editingId, setEditingId] = useState<string | null>(() =>
    isCustomThemeId(currentTheme) ? extractCustomId(currentTheme) : null
  );
  const [themeName, setThemeName] = useState(() => activeSaved?.name ?? 'My Theme');

  const BASES = ['dark','dim','steel','sapphire','dusk','linear','slack','light','mist','frost','sage','sand'];

  // Live preview
  const liveApply = useCallback(() => {
    const data: CustomThemeData = { base: baseTheme, overrides, contrast };
    applyCustomTheme(data);
  }, [baseTheme, overrides, contrast]);

  useEffect(() => { liveApply(); }, [liveApply]);

  // Read resolved colors for display (from base, before our overrides)
  const resolvedColors = useCallback(() => {
    // Temporarily remove inline overrides to read base values
    const root = document.documentElement;
    const saved: Record<string, string> = {};
    for (const { key } of EDITABLE_VARS) {
      saved[key] = root.style.getPropertyValue(key);
      root.style.removeProperty(key);
    }
    root.setAttribute('data-theme', baseTheme);
    const result: Record<string, string> = {};
    for (const { key } of EDITABLE_VARS) {
      result[key] = readComputedVar(key);
    }
    // Restore
    for (const [k, v] of Object.entries(saved)) {
      if (v) root.style.setProperty(k, v);
    }
    return result;
  }, [baseTheme]);

  const [baseColors, setBaseColors] = useState<Record<string, string>>({});
  useEffect(() => {
    // Small delay for theme CSS to take effect
    requestAnimationFrame(() => setBaseColors(resolvedColors()));
  }, [baseTheme, resolvedColors]);

  const handleColorChange = (key: string, value: string) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
  };

  const handleContrastChange = (value: number) => {
    setContrast(value);
  };

  const handleResetVar = (key: string) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      document.documentElement.style.removeProperty(key);
      return next;
    });
  };

  const handleResetAll = () => {
    clearCustomOverrides();
    setOverrides({});
    setContrast(0);
  };

  const handleSave = () => {
    const data: CustomThemeData = { base: baseTheme, overrides, contrast };
    applyCustomTheme(data);
    let id = editingId;
    const name = themeName.trim() || 'My Theme';
    const updated = [...savedThemes];
    if (id) {
      const idx = updated.findIndex(t => t.id === id);
      if (idx >= 0) updated[idx] = { ...data, id, name };
      else { id = crypto.randomUUID(); updated.push({ ...data, id, name }); }
    } else {
      id = crypto.randomUUID();
      updated.push({ ...data, id, name });
    }
    persistSavedThemes(updated);
    setSavedThemes(updated);
    setEditingId(id);
    onApply(`custom:${id}`);
    onClose();
  };

  const handleCancel = () => {
    clearCustomOverrides();
    onClose();
  };

  const handleLoadSaved = (t: SavedCustomTheme) => {
    setEditingId(t.id);
    setThemeName(t.name);
    setBaseTheme(t.base);
    setOverrides(t.overrides);
    setContrast(t.contrast);
  };

  const handleDeleteSaved = (id: string) => {
    const updated = savedThemes.filter(t => t.id !== id);
    persistSavedThemes(updated);
    setSavedThemes(updated);
    if (editingId === id) { setEditingId(null); setThemeName('My Theme'); }
  };

  // Debounced color picker
  const handlePickerInput = (key: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleColorChange(key, value), 30);
    // Immediate visual feedback
    document.documentElement.style.setProperty(key, value);
  };

  return (
    <div className="tc-overlay" onClick={handleCancel} style={overlayStyle}>
      <div className="tc-panel" role="dialog" onClick={e => e.stopPropagation()} style={modalStyle}>
        <div className="tc-header" onMouseDown={onDragStart} style={{ cursor: 'move' }}>
          <h3>🎨 Theme Customizer</h3>
          <button className="tc-close" onClick={handleCancel}>✕</button>
        </div>

        <div className="tc-body">
          {/* Saved themes library */}
          {savedThemes.length > 0 && (
            <div className="tc-section">
              <label className="tc-section-label">My Themes</label>
              <div className="tc-saved-list">
                {savedThemes.map(t => (
                  <div key={t.id} className={`tc-saved-item${editingId === t.id ? ' active' : ''}`}
                    onClick={() => handleLoadSaved(t)}>
                    <span className="tc-saved-swatch" style={{ background: t.overrides['--bg'] || '#1e293b' }} />
                    <span className="tc-saved-name">{t.name}</span>
                    <span className="tc-saved-base">{t.base}</span>
                    <button className="tc-saved-delete" onClick={e => { e.stopPropagation(); handleDeleteSaved(t.id); }}
                      title="Delete theme">🗑</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Base theme selector */}
          <div className="tc-section">
            <label className="tc-section-label">Base Theme</label>
            <select className="tc-base-select" value={baseTheme}
              onChange={e => { setBaseTheme(e.target.value); handleResetAll(); }}>
              {BASES.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
            </select>
          </div>

          {/* Contrast slider */}
          <div className="tc-section">
            <label className="tc-section-label">
              Contrast <span className="tc-contrast-val">{contrast > 0 ? '+' : ''}{contrast}%</span>
            </label>
            <input type="range" className="tc-slider" min={-50} max={50} value={contrast}
              onChange={e => handleContrastChange(Number(e.target.value))} />
            <div className="tc-slider-labels">
              <span>Less</span><span>Default</span><span>More</span>
            </div>
          </div>

          {/* Color pickers */}
          <div className="tc-section">
            <label className="tc-section-label">Colors</label>
            <div className="tc-colors">
              {EDITABLE_VARS.map(({ key, label }) => {
                const currentVal = overrides[key] || baseColors[key] || '#000000';
                const isOverridden = key in overrides;
                return (
                  <div key={key} className={`tc-color-row${isOverridden ? ' modified' : ''}`}>
                    <input type="color" className="tc-color-input"
                      value={currentVal}
                      onInput={e => handlePickerInput(key, (e.target as HTMLInputElement).value)}
                      onChange={e => handleColorChange(key, e.target.value)} />
                    <div className="tc-color-info">
                      <span className="tc-color-label">{label}</span>
                      <span className="tc-color-hex">{currentVal}</span>
                    </div>
                    {isOverridden && (
                      <button className="tc-color-reset" onClick={() => handleResetVar(key)} title="Reset to base">↺</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="tc-footer">
          <button className="tc-btn tc-btn-secondary" onClick={handleResetAll}>Reset All</button>
          <div className="tc-footer-right">
            <input className="tc-name-input" type="text" value={themeName}
              onChange={e => setThemeName(e.target.value)} placeholder="Theme name…" maxLength={30} />
            <button className="tc-btn tc-btn-secondary" onClick={handleCancel}>Cancel</button>
            {editingId && (
              <button className="tc-btn tc-btn-secondary tc-btn-new"
                onClick={() => { setEditingId(null); setThemeName(themeName + ' Copy'); }}
                title="Save as new theme">+ New</button>
            )}
            <button className="tc-btn tc-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
