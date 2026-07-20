import { useState, useEffect, useCallback, useRef } from 'react';
import { useModalDrag } from '../shared/hooks/useModalDrag';
import {
  EDITABLE_VARS,
  isCustomThemeId,
  extractCustomId,
  findSavedTheme,
  applyCustomTheme,
  clearCustomOverrides,
  loadSavedThemes,
  persistSavedThemes,
  readComputedVar,
  type CustomThemeOverrides,
  type CustomThemeData,
  type SavedCustomTheme,
} from './themeCustomizerUtils';

interface Props {
  currentTheme: string;
  onClose: () => void;
  onApply: (themeId: string) => void;
}

export default function ThemeCustomizer({ currentTheme, onClose, onApply }: Props) {
  const { onDragStart, overlayStyle, modalStyle } = useModalDrag(true);
  const activeSaved = isCustomThemeId(currentTheme) ? findSavedTheme(currentTheme) : null;
  const initBase = activeSaved ? activeSaved.base : (isCustomThemeId(currentTheme) || currentTheme === 'custom' ? 'dark' : currentTheme);
  const [overrides, setOverrides] = useState<CustomThemeOverrides>(() => activeSaved?.overrides ?? {});
  const [contrast, setContrast] = useState(() => activeSaved?.contrast ?? 0);
  const [baseTheme, setBaseTheme] = useState(initBase);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [savedThemes, setSavedThemes] = useState<SavedCustomTheme[]>(() => loadSavedThemes());
  const [editingId, setEditingId] = useState<string | null>(() =>
    isCustomThemeId(currentTheme) ? extractCustomId(currentTheme) : null
  );
  const [themeName, setThemeName] = useState(() => activeSaved?.name ?? 'My Theme');

  const BASES = ['dark','dim','steel','sapphire','dusk','linear','slack','light','mist','frost','sage','sand'];

  const liveApply = useCallback(() => {
    const data: CustomThemeData = { base: baseTheme, overrides, contrast };
    applyCustomTheme(data);
  }, [baseTheme, overrides, contrast]);

  useEffect(() => { liveApply(); }, [liveApply]);

  const resolvedColors = useCallback(() => {
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
    for (const [k, v] of Object.entries(saved)) {
      if (v) root.style.setProperty(k, v);
    }
    return result;
  }, [baseTheme]);

  const [baseColors, setBaseColors] = useState<Record<string, string>>({});
  useEffect(() => {
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

  const handlePickerInput = (key: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleColorChange(key, value), 30);
    document.documentElement.style.setProperty(key, value);
  };

  return (
    <div className="tc-overlay" onClick={handleCancel} style={overlayStyle}>
      <div className="tc-panel" role="dialog" onClick={e => e.stopPropagation()} style={modalStyle}>
        <div className="tc-header" onMouseDown={onDragStart} style={{ cursor: 'move' }}>
          <h3>🎨 Theme Customizer</h3>
        </div>

        <div className="tc-body">
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

          <div className="tc-section">
            <label className="tc-section-label">Base Theme</label>
            <select className="tc-base-select" value={baseTheme}
              onChange={e => { setBaseTheme(e.target.value); handleResetAll(); }}>
              {BASES.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
            </select>
          </div>

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
