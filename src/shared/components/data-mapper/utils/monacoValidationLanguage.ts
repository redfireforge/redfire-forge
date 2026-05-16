/**
 * Monaco Editor language registration, theming, and autocomplete for the
 * Validation DSL editor.
 *
 * Extracted from ValidationCodeEditor.tsx to keep the component under
 * the 900-line monolithic threshold.
 */

import { EXPRESSION_FUNCTIONS } from '../../../../features/workflow/utils/expressionFunctions';

export const LANGUAGE_ID = 'validation-dsl';

export const OPERATOR_KEYWORDS = [
  'NOT',
  'equals', 'not_equals', 'greater_than', 'greater_than_or_equal',
  'less_than', 'less_than_or_equal', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'regex', 'is_true', 'is_false',
  'is_null', 'is_not_null', 'is_empty', 'is_not_empty',
  'exists', 'not_exists', 'is_type', 'in', 'not_in',
  'between', 'close_to', 'length', 'each', 'contains_item',
  'contains_any', 'contains_all', 'contains_only', 'contains_none', 'subset',
];

const LINE_START_KEYWORDS = ['ASSERT', 'NOT'];

const TYPE_NAMES = ['string', 'number', 'boolean', 'array', 'object', 'null'];

// HMR-safe globals: stored on globalThis so previous module instances can be cleaned up.
const HMR_KEY_LANG = '__validationDsl_languageRegistered';
const HMR_KEY_DISPOSABLE = '__validationDsl_completionDisposable';

function isLanguageRegistered(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(globalThis as any)[HMR_KEY_LANG];
}
function markLanguageRegistered(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any)[HMR_KEY_LANG] = true;
}

function getStoredDisposable(): { dispose: () => void } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any)[HMR_KEY_DISPOSABLE] ?? null;
}
function setStoredDisposable(d: { dispose: () => void } | null): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any)[HMR_KEY_DISPOSABLE] = d;
}

export function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgb;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function getCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!val) return fallback;
  if (val.startsWith('rgb')) return rgbToHex(val);
  return val;
}

const LIGHT_THEMES = new Set(['light', 'mist', 'frost', 'sage', 'sand']);

export function isLightTheme(): boolean {
  const attr = document.documentElement.getAttribute('data-theme') ?? '';
  if (LIGHT_THEMES.has(attr)) return true;
  if (attr && !LIGHT_THEMES.has(attr)) return false;
  const bg = getCssVar('--bg', '#0f172a');
  const r = parseInt(bg.slice(1, 3), 16) || 0;
  const g = parseInt(bg.slice(3, 5), 16) || 0;
  const b = parseInt(bg.slice(5, 7), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export function registerLanguage(monaco: typeof import('monaco-editor')) {
  if (isLanguageRegistered()) return;
  markLanguageRegistered();

  monaco.languages.register({ id: LANGUAGE_ID });

  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    wordPattern: /\$\.[\w.[\]]*|\$\w*|\w+/,
  });

  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.validation-dsl',

    operators: OPERATOR_KEYWORDS,
    symbols: /[=><!]+/,

    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b(true|false)\b/, 'keyword.boolean'],
        [/\b(string|number|boolean|array|object|null)\b/, 'type'],
        [/\bNOT\b/, 'keyword.negate'],
        [/\bASSERT\b/, 'keyword.assert'],
        [/\b(length|each|contains_item|contains_any|contains_all|contains_only|contains_none|subset)\b/, 'keyword.collection'],
        [/\b(equals|not_equals|contains|not_contains|starts_with|ends_with|regex|is_true|is_false|is_null|is_not_null|is_empty|is_not_empty|exists|not_exists|is_type|in|not_in|between|close_to|greater_than|greater_than_or_equal|less_than|less_than_or_equal)\b/, 'keyword.operator'],
        [/[><=!]+/, 'operator'],
        [/-?\d+(\.\d+)?/, 'number'],
        [/[\w$]+/, 'identifier'],
        [/[.[\]]/, 'delimiter.path'],
        [/,/, 'delimiter'],
        [/\s+/, 'white'],
      ],
    },
  });

  applyDynamicTheme(monaco);
}

export function applyDynamicTheme(monaco: typeof import('monaco-editor'), themeName = 'validation-dsl-dark') {
  const light = isLightTheme();
  const bg = getCssVar('--bg', light ? '#eef2f7' : '#0f172a');
  const surface = getCssVar('--surface', light ? '#ffffff' : '#1e293b');
  const surfaceHover = getCssVar('--surface-hover', light ? '#f1f5f9' : '#2d3a4d');
  const border = getCssVar('--border', light ? '#bcc8d8' : '#3b4a60');
  const text = getCssVar('--text', light ? '#111827' : '#f1f5f9');
  const textMuted = getCssVar('--text-muted', light ? '#3f4f63' : '#a8b8cc');
  const primary = getCssVar('--primary', light ? '#2563eb' : '#3b82f6');
  const accent = getCssVar('--accent', light ? '#7c3aed' : '#8b5cf6');
  const danger = getCssVar('--danger', light ? '#dc2626' : '#ef4444');
  const success = getCssVar('--success', light ? '#16a34a' : '#22c55e');
  const warning = getCssVar('--warning', light ? '#d97706' : '#f59e0b');

  const strip = (c: string) => c.replace('#', '');

  monaco.editor.defineTheme(themeName, {
    base: light ? 'vs' : 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: strip(textMuted), fontStyle: 'italic' },
      { token: 'string', foreground: strip(success) },
      { token: 'number', foreground: strip(warning) },
      { token: 'keyword.boolean', foreground: strip(danger) },
      { token: 'keyword.operator', foreground: strip(accent) },
      { token: 'keyword.negate', foreground: strip(danger), fontStyle: 'bold' },
      { token: 'keyword.assert', foreground: strip(accent), fontStyle: 'bold' },
      { token: 'keyword.collection', foreground: strip(success) },
      { token: 'type', foreground: strip(success) },
      { token: 'operator', foreground: strip(warning) },
      { token: 'identifier', foreground: strip(primary) },
      { token: 'delimiter', foreground: strip(textMuted) },
      { token: 'delimiter.path', foreground: strip(primary) },
    ],
    colors: {
      'editor.background': surface,
      'editor.foreground': text,
      'editor.lineHighlightBackground': light ? bg : surfaceHover,
      'editor.selectionBackground': border + '80',
      'editorCursor.foreground': primary,
      'editorLineNumber.foreground': border,
      'editorLineNumber.activeForeground': primary,
      'editor.inactiveSelectionBackground': border + '40',
      'editorGutter.background': surface,
      'editorIndentGuide.background': border + '40',
    },
  });
}

// ─── Autocomplete Provider ────────────────────────────────

export function ensureCompletionProvider(
  monaco: typeof import('monaco-editor'),
) {
  const prev = getStoredDisposable();
  if (prev) { prev.dispose(); setStoredDisposable(null); }

  const disposable = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: ['.', '[', ' ', '$', '(', ',', ...('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split(''))],
    provideCompletionItems: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilCursor = lineContent.slice(0, position.column - 1);
      const words = textUntilCursor.trim().split(/\s+/);
      const cursorRange = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      const hasSpace = textUntilCursor.includes(' ');
      const isPathPosition = words.length <= 1 && !hasSpace;

      const firstWordUp = words[0]?.toUpperCase() ?? '';
      const secondWordUp = words[1]?.toUpperCase() ?? '';
      const isAfterAssert =
        (firstWordUp === 'ASSERT' && hasSpace) ||
        (firstWordUp === 'NOT' && secondWordUp === 'ASSERT' && words.length >= 2 && hasSpace);
      if (isAfterAssert) {
        const tokenMatch = textUntilCursor.match(/(\$[\w.]*)$/);
        const afterDelimiter = /[,(]\s*$/.test(textUntilCursor) || textUntilCursor.endsWith(' ');

        if (tokenMatch || afterDelimiter) {
          const partial = tokenMatch ? tokenMatch[1].toLowerCase() : '';
          const tokenStart = tokenMatch
            ? position.column - tokenMatch[1].length
            : position.column;
          const fnRange = {
            startLineNumber: position.lineNumber,
            startColumn: tokenStart,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          };
          const partialName = partial.replace(/^\$\.?/, '');
          const isPath = partial.startsWith('$.');
          const rawPaths = (window as unknown as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS as string[] | undefined;
          const paths = rawPaths ? [
            ...rawPaths.map(p => `body.${p}`),
            ...rawPaths,
          ] : undefined;

          const fnSuggestions = EXPRESSION_FUNCTIONS
            .filter(fn => {
              const fnName = fn.name.replace(/^\$/, '').toLowerCase();
              return !partialName || fnName.includes(partialName);
            })
            .map(fn => ({
              label: fn.name,
              filterText: fn.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${fn.name}(`,
              range: fnRange,
              detail: fn.description?.slice(0, 60) ?? fn.category,
              sortText: fn.name.replace(/^\$/, '').toLowerCase().startsWith(partialName) ? '0' + fn.name : '1' + fn.name,
            }));
          const pathSuggestions = (paths ?? [])
            .filter(p => !partialName || p.toLowerCase().includes(partialName))
            .map(p => ({
              label: `$.${p}`,
              filterText: `$.${p}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `$.${p}`,
              range: fnRange,
              detail: 'JSON path',
              sortText: isPath && p.toLowerCase().startsWith(partialName) ? '0' + p : '2' + p,
            }));
          return { suggestions: [...fnSuggestions, ...pathSuggestions] };
        }
        return { suggestions: [] };
      }

      const firstWordIsNot = firstWordUp === 'NOT';
      const isAfterNotPosition = firstWordIsNot && !isAfterAssert
        && ((words.length === 1 && hasSpace) || words.length === 2);

      if (isPathPosition || isAfterNotPosition) {
        const partial = isAfterNotPosition
          ? (words[1] ?? '').toLowerCase()
          : (words[0] ?? '').toLowerCase();
        const paths = (window as unknown as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS as string[] | undefined;

        const wordRangeStart = isAfterNotPosition && words[1]
          ? textUntilCursor.lastIndexOf(words[1]) + 1
          : position.column;
        const wordRange = {
          startLineNumber: position.lineNumber,
          startColumn: wordRangeStart,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };
        const lineStartRange = {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };

        const afterNotKeywords = isAfterNotPosition ? ['ASSERT'] : LINE_START_KEYWORDS;
        const keywordSuggestions = afterNotKeywords
          .filter(kw => !partial || kw.toLowerCase().includes(partial))
          .map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw + ' ',
            range: isAfterNotPosition ? wordRange : lineStartRange,
            detail: 'Keyword',
            sortText: '0' + kw,
          }));

        const pathSuggestions = (paths ?? [])
          .filter(p => !partial || p.toLowerCase().includes(partial))
          .slice(0, 30)
          .map(p => ({
            label: p,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: p + '  ',
            range: isAfterNotPosition ? wordRange : lineStartRange,
            detail: 'JSON path',
            sortText: p.toLowerCase().startsWith(partial) ? '1' + p : '2' + p,
          }));

        if (!keywordSuggestions.length && !pathSuggestions.length) return { suggestions: [] };
        return { suggestions: [...keywordSuggestions, ...pathSuggestions] };
      }

      const afterNot = words.length >= 2 && words[1].toUpperCase() === 'NOT';
      const effectiveOpWordIndex = afterNot ? 2 : 1;
      const effectiveWordCount = afterNot ? words.length - 1 : words.length;

      if (effectiveWordCount === 1 || (effectiveWordCount === 2 && !textUntilCursor.endsWith(' '))) {
        const partial = words[effectiveOpWordIndex]?.toLowerCase() ?? '';
        const opRange = words[effectiveOpWordIndex]
          ? {
            startLineNumber: position.lineNumber,
            startColumn: textUntilCursor.lastIndexOf(words[effectiveOpWordIndex]) + 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
          : cursorRange;
        return {
          suggestions: OPERATOR_KEYWORDS
            .filter(op => !afterNot || op !== 'NOT')
            .filter(op => !partial || op.toLowerCase().includes(partial))
            .map(op => ({
              label: op,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: op + ' ',
              range: opRange,
              detail: 'Operator',
            })),
        };
      }

      if (words.length >= 2) {
        const opIdx = afterNot ? 2 : 1;
        const op = (words[opIdx] ?? '').toLowerCase();
        if (op === 'is_type') {
          return {
            suggestions: TYPE_NAMES.map(t => ({
              label: t,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: t,
              range: cursorRange,
              detail: 'Type name',
            })),
          };
        }
        if (['is_true', 'is_false'].some(k => op?.includes(k))) {
          return { suggestions: [] };
        }
        return {
          suggestions: [
            { label: 'true', kind: monaco.languages.CompletionItemKind.Value, insertText: 'true', range: cursorRange, detail: 'Boolean' },
            { label: 'false', kind: monaco.languages.CompletionItemKind.Value, insertText: 'false', range: cursorRange, detail: 'Boolean' },
          ],
        };
      }

      return { suggestions: [] };
    },
  });
  setStoredDisposable(disposable);
}
