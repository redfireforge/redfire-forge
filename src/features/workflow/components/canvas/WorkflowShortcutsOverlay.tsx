import { useEffect } from 'react';

interface ShortcutDef {
  key: string;
  category: string;
  label: string;
  display: string;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl';

// eslint-disable-next-line react-refresh/only-export-components
export const SHORTCUTS: ShortcutDef[] = [
  // Canvas
  { key: 'mod+0', category: 'Canvas', label: 'Zoom to fit', display: `${MOD_LABEL}+0` },
  { key: 'mod+=', category: 'Canvas', label: 'Zoom in', display: `${MOD_LABEL}++` },
  { key: 'mod+-', category: 'Canvas', label: 'Zoom out', display: `${MOD_LABEL}+−` },
  { key: 'mod+l', category: 'Canvas', label: 'Auto-layout', display: `${MOD_LABEL}+L` },
  { key: 'mod+m', category: 'Canvas', label: 'Toggle minimap', display: `${MOD_LABEL}+M` },
  // Editing
  { key: 'mod+z', category: 'Editing', label: 'Undo', display: `${MOD_LABEL}+Z` },
  { key: 'mod+shift+z', category: 'Editing', label: 'Redo', display: `${MOD_LABEL}+⇧+Z` },
  { key: 'mod+c', category: 'Editing', label: 'Copy node', display: `${MOD_LABEL}+C` },
  { key: 'mod+v', category: 'Editing', label: 'Paste node', display: `${MOD_LABEL}+V` },
  { key: 'mod+d', category: 'Editing', label: 'Duplicate node', display: `${MOD_LABEL}+D` },
  { key: 'delete', category: 'Editing', label: 'Delete selected', display: '⌫' },
  // Workflow
  { key: 'mod+s', category: 'Workflow', label: 'Save', display: `${MOD_LABEL}+S` },
  { key: 'mod+enter', category: 'Workflow', label: 'Quick Test', display: `${MOD_LABEL}+↵` },
  { key: 'mod+shift+enter', category: 'Workflow', label: 'Debug Test', display: `${MOD_LABEL}+⇧+↵` },
  { key: 'mod+k', category: 'Workflow', label: 'Command palette', display: `${MOD_LABEL}+K` },
  { key: 'mod+j', category: 'Workflow', label: 'Toggle console', display: `${MOD_LABEL}+J` },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WorkflowShortcutsOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const categories = [...new Set(SHORTCUTS.map((s) => s.category))];

  return (
    <>
      <div className="wf-shortcuts-backdrop" onClick={onClose} role="presentation" />
      <div className="wf-shortcuts-overlay" role="dialog" aria-label="Keyboard shortcuts">
        <div className="wf-shortcuts-header">
          <span className="wf-shortcuts-title">Keyboard Shortcuts</span>
          <button className="wf-shortcuts-close" onClick={onClose}>ESC</button>
        </div>
        {categories.map((cat) => (
          <div key={cat} className="wf-shortcuts-section">
            <div className="wf-shortcuts-section-title">{cat}</div>
            {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
              <div key={s.key} className="wf-shortcuts-row">
                <span className="wf-shortcuts-label">{s.label}</span>
                <div className="wf-shortcuts-keys">
                  {s.display.split('+').map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="wf-shortcuts-plus">+</span>}
                      <kbd className="wf-kbd-key">{part}</kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
