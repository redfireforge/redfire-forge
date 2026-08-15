/**
 * Monaco theme for API Mock body editors — uses Studio tokens so the
 * canvas is `--bg` (same as Status / Name / Content-Type), not vs-dark's
 * warm #1e1e1e.
 */
export const API_MOCK_MONACO_THEME = 'am-studio';

const LIGHT_THEMES = new Set(['light', 'mist', 'frost', 'sage', 'sand']);

export function readCssColor(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

export function isApiMockLightTheme(): boolean {
  const attr = typeof document !== 'undefined'
    ? (document.documentElement.getAttribute('data-theme') ?? '')
    : '';
  if (LIGHT_THEMES.has(attr)) return true;
  if (attr) return false;
  const bg = readCssColor('--bg', '#0f172a');
  const r = parseInt(bg.slice(1, 3), 16) || 0;
  const g = parseInt(bg.slice(3, 5), 16) || 0;
  const b = parseInt(bg.slice(5, 7), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function defineApiMockMonacoTheme(monaco: unknown): void {
  const host = monaco as { editor: { defineTheme: (id: string, theme: object) => void } };
  const light = isApiMockLightTheme();
  const bg = readCssColor('--bg', light ? '#eef2f7' : '#0f172a');
  const text = readCssColor('--text', light ? '#111827' : '#f1f5f9');
  const muted = readCssColor('--text-muted', light ? '#3f4f63' : '#a8b8cc');
  const surface = readCssColor('--surface', light ? '#ffffff' : '#1e293b');
  const border = readCssColor('--border', light ? '#bcc8d8' : '#3b4a60');
  const primary = readCssColor('--primary', light ? '#2563eb' : '#3b82f6');

  host.editor.defineTheme(API_MOCK_MONACO_THEME, {
    base: light ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': bg,
      'editor.foreground': text,
      'editorGutter.background': bg,
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': text,
      'editor.lineHighlightBackground': surface,
      'editor.selectionBackground': `${primary}40`,
      'editor.inactiveSelectionBackground': `${border}40`,
      'editorCursor.foreground': primary,
      'editorWidget.background': surface,
      'editorWidget.border': border,
    },
  });
}
