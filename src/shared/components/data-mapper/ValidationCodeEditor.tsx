import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { ParseError } from './utils/validationDsl';
import { installTextareaHardening } from './utils/monacoTextareaHardening';

// ─── Monaco Language Registration ─────────────────────────

const LANGUAGE_ID = 'validation-dsl';

const OPERATOR_KEYWORDS = [
  'NOT',
  'equals', 'not_equals', 'greater_than', 'greater_than_or_equal',
  'less_than', 'less_than_or_equal', 'contains', 'not_contains',
  'starts_with', 'ends_with', 'regex', 'is_true', 'is_false',
  'is_null', 'is_not_null', 'is_empty', 'is_not_empty',
  'exists', 'not_exists', 'is_type', 'in', 'not_in',
  'between', 'close_to', 'length', 'each', 'contains_item',
  'contains_any', 'contains_all', 'contains_only', 'contains_none', 'subset',
];

const TYPE_NAMES = ['string', 'number', 'boolean', 'array', 'object', 'null'];

// HMR-safe globals: stored on globalThis so previous module instances can be cleaned up.
// Paths are NOT surfaced through Monaco's suggest widget (they live on the passive hint
// strip beneath the editor), so we only need to remember language registration and the
// single completion-provider disposable across hot-reload cycles.
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

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgb;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function getCssVar(name: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!val) return fallback;
  if (val.startsWith('rgb')) return rgbToHex(val);
  return val;
}

const LIGHT_THEMES = new Set(['light', 'mist', 'frost', 'sage', 'sand']);

function isLightTheme(): boolean {
  const attr = document.documentElement.getAttribute('data-theme') ?? '';
  if (LIGHT_THEMES.has(attr)) return true;
  if (attr && !LIGHT_THEMES.has(attr)) return false;
  const bg = getCssVar('--bg', '#0f172a');
  const r = parseInt(bg.slice(1, 3), 16) || 0;
  const g = parseInt(bg.slice(3, 5), 16) || 0;
  const b = parseInt(bg.slice(5, 7), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function registerLanguage(monaco: typeof import('monaco-editor')) {
  if (isLanguageRegistered()) return;
  markLanguageRegistered();

  monaco.languages.register({ id: LANGUAGE_ID });

  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    wordPattern: /[a-zA-Z_$]\w*/,
  });

  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    defaultToken: '',
    tokenPostfix: '.validation-dsl',

    operators: OPERATOR_KEYWORDS,
    symbols: /[=><!]+/,

    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
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

function applyDynamicTheme(monaco: typeof import('monaco-editor'), themeName = 'validation-dsl-dark') {
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

function ensureCompletionProvider(
  monaco: typeof import('monaco-editor'),
) {
  const prev = getStoredDisposable();
  if (prev) { prev.dispose(); setStoredDisposable(null); }

  const disposable = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: ['.', '['],
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
      if (isPathPosition) {
        const partial = (words[0] ?? '').toLowerCase();
        const paths = (window as unknown as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS as string[] | undefined;
        if (!paths?.length) return { suggestions: [] };

        const pathRange = {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };
        return {
          suggestions: paths
            .filter(p => !partial || p.toLowerCase().includes(partial))
            .slice(0, 30)
            .map(p => ({
              label: p,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: p + '  ',
              range: pathRange,
              detail: 'JSON path',
              sortText: p.toLowerCase().startsWith(partial) ? '0' + p : '1' + p,
            })),
        };
      }

      // After path — suggest operators (also after NOT prefix)
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

      // After operator — suggest values
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

// ─── Component ────────────────────────────────────────────

export interface LineVerifyResult {
  lineNumber: number;
  passed: boolean;
  actual?: string;
  expected?: string;
}

interface ValidationCodeEditorProps {
  value: string;
  onChange: (text: string) => void;
  errors: ParseError[];
  samplePaths?: string[];
  onJumpToNode?: (path: string) => void;
  height?: number | string;
  readOnly?: boolean;
  onEditorMount?: (editor: import('monaco-editor').editor.IStandaloneCodeEditor) => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
  lineResults?: LineVerifyResult[];
}

export default function ValidationCodeEditor({
  value,
  onChange,
  errors,
  samplePaths = [],
  onJumpToNode,
  height = 200,
  readOnly = false,
  onEditorMount,
  hideHeader = false,
  hideFooter = false,
  lineResults = [],
}: ValidationCodeEditorProps) {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const [themeKey, setThemeKey] = useState('validation-dsl-0');
  const samplePathsRef = useRef(samplePaths);
  const jumpToNodeRef = useRef(onJumpToNode);
  const [ruleCount, setRuleCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const lastJumpedLineRef = useRef<number | null>(null);

  const matchingPathsRef = useRef<string[]>([]);
  samplePathsRef.current = samplePaths;
  jumpToNodeRef.current = onJumpToNode;

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS = samplePaths;
    return () => { (window as unknown as Record<string, unknown>).__REDFIRE_VALIDATION_PATHS = undefined; };
  }, [samplePaths]);

  useEffect(() => {
    setRuleCount(value.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length);
    setErrorCount(errors.length);
  }, [value, errors]);

  // Compute matching paths to show in the non-intrusive hints strip.
  // This NEVER intercepts keystrokes — it's a passive visual hint only.
  const matchingPaths = useMemo(() => {
    const prefix = currentPrefix.trim();
    if (!prefix) return [];
    if (samplePaths.some(p => p === prefix)) return [];
    const lower = prefix.toLowerCase();
    return samplePaths
      .filter(p => p.toLowerCase().includes(lower) && p !== prefix)
      .slice(0, 8);
  }, [currentPrefix, samplePaths]);

  matchingPathsRef.current = matchingPaths;

  const insertPathAtCursor = useCallback((path: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = editor.getPosition();
    if (!pos) return;
    const model = editor.getModel();
    if (!model) return;
    const lineContent = model.getLineContent(pos.lineNumber);
    const textUntilCursor = lineContent.slice(0, pos.column - 1);
    const trimmedStart = textUntilCursor.replace(/^\s+/, '');
    const prefixLen = trimmedStart.length;
    const startCol = pos.column - prefixLen;
    editor.executeEdits('dsl-insert-path', [{
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: startCol,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: path,
      forceMoveMarkers: true,
    }]);
    editor.focus();
  }, []);

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerLanguage(monaco);
    ensureCompletionProvider(monaco);
    applyDynamicTheme(monaco, 'validation-dsl-0');
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoReady(true);
    onEditorMount?.(editor);

    editor.addAction({
      id: 'jump-to-node',
      label: 'Jump to Node in Tree',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      run: (ed) => {
        const line = ed.getPosition()?.lineNumber;
        if (!line) return;
        const content = ed.getModel()?.getLineContent(line);
        if (!content) return;
        const path = content.trim().split(/\s+/)[0];
        if (path && !path.startsWith('#') && onJumpToNode) {
          onJumpToNode(path);
        }
      },
    });

    editor.addAction({
      id: 'trigger-suggest-alt',
      label: 'Trigger Suggestions',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI,
        monaco.KeyMod.WinCtrl | monaco.KeyCode.Space,
        monaco.KeyMod.Alt | monaco.KeyCode.Space,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space,
      ],
      run: (ed) => {
        ed.trigger('keyboard', 'editor.action.triggerSuggest', {});
      },
    });

    editor.addAction({
      id: 'accept-path-hint',
      label: 'Accept Path Hint',
      keybindings: [monaco.KeyCode.Tab],
      precondition: '!suggestWidgetVisible',
      run: (ed) => {
        const paths = matchingPathsRef.current;
        if (!paths.length) return;
        const pos = ed.getPosition();
        const model = ed.getModel();
        if (!pos || !model) return;
        const lineText = model.getLineContent(pos.lineNumber).slice(0, pos.column - 1);
        const trimmed = lineText.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.includes(' ')) return;
        const leadingSpaces = lineText.length - lineText.trimStart().length;
        ed.executeEdits('accept-path-hint', [{
          range: {
            startLineNumber: pos.lineNumber,
            startColumn: 1 + leadingSpaces,
            endLineNumber: pos.lineNumber,
            endColumn: pos.column,
          },
          text: paths[0],
          forceMoveMarkers: true,
        }]);
      },
    });

    // Disable browser/extension autocorrect on Monaco's hidden input textarea.
    // We intentionally do NOT install a `beforeinput` listener — across HMR
    // cycles, stale listeners can accumulate and silently swallow legitimate
    // keystrokes (most notably Space), forcing the user to press the key
    // multiple times. Substitution defense is handled entirely by the
    // model-layer guard below, which is idempotent and self-contained.
    const hardening = installTextareaHardening({ getDomNode: () => editor.getDomNode() });

    // NOTE: We do NOT override Space. `acceptSuggestionOnCommitCharacter: false`
    // already ensures Space inserts a literal space and does NOT accept the
    // current suggestion. Overriding Space here was the cause of "Space being
    // eaten" reports on macOS — Monaco's command pipeline interacted poorly
    // with composition events. Tab and Enter still accept suggestions normally.

    // NOTE: We intentionally do NOT trigger Monaco's suggest widget. After
    // many attempts, programmatic triggering proved unreliable. Instead, we
    // update a passive React-rendered hints strip below the editor — it
    // cannot intercept keystrokes because it is not a Monaco widget.
    // Suggestions inside the editor appear ONLY when the user presses Ctrl+Space.
    const updatePrefix = () => {
      const pos = editor.getPosition();
      const model = editor.getModel();
      if (!pos || !model) {
        setCurrentPrefix('');
        return;
      }
      const lineText = model.getLineContent(pos.lineNumber).slice(0, pos.column - 1);
      const trimmed = lineText.trim();
      // Only the first token (path) — once a space is typed, no hints.
      if (trimmed.length === 0 || trimmed.startsWith('#') || lineText.endsWith(' ')) {
        setCurrentPrefix('');
        return;
      }
      const words = trimmed.split(/\s+/);
      if (words.length > 1) {
        setCurrentPrefix('');
        return;
      }
      setCurrentPrefix(words[0]);
    };
    // FINAL DEFENSE: detect macOS smart-period substitution at the model layer.
    // macOS replaces a trailing space + Space keystroke with ". " — which lands
    // in Monaco's model as a single-change insertion of exactly ". ". No normal
    // keystroke produces this 2-char insert (typing a period then space is
    // two separate single-char changes), so this is an unambiguous signature.
    // When detected, replace the inserted `. ` with a single space.
    let macosUndoGuard = false;
    const macosSubstitutionGuard = (event: import('monaco-editor').editor.IModelContentChangedEvent) => {
      if (macosUndoGuard) return;
      const model = editor.getModel();
      if (!model) return;
      for (const change of event.changes) {
        // Smoking gun: insertion of exactly ". " (or " . " edge cases)
        const isSmartPeriod =
          change.text === '. ' ||
          change.text === ' .' ||
          (change.text.length === 2 && change.text[0] === '.' && change.text[1] === ' ');
        if (!isSmartPeriod) continue;

        // The newly inserted text occupies [rangeOffset, rangeOffset + 2).
        // Replace it with a single space.
        const startPos = model.getPositionAt(change.rangeOffset);
        const endPos = model.getPositionAt(change.rangeOffset + change.text.length);
        macosUndoGuard = true;
        try {
          editor.executeEdits('block-mac-smart-period', [
            {
              range: {
                startLineNumber: startPos.lineNumber,
                startColumn: startPos.column,
                endLineNumber: endPos.lineNumber,
                endColumn: endPos.column,
              },
              text: ' ',
              forceMoveMarkers: true,
            },
          ]);
          // Place the cursor right after the single space we inserted.
          const finalPos = model.getPositionAt(change.rangeOffset + 1);
          editor.setPosition(finalPos);
        } finally {
          macosUndoGuard = false;
        }
        break;
      }
    };
    const contentDisposable = editor.onDidChangeModelContent((event) => {
      macosSubstitutionGuard(event);
      updatePrefix();
    });
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      // Skip all side-effects when user is selecting text (mouse drag or
      // Shift+Arrow). React state updates during selection cause re-renders
      // that steal focus and break multi-line selection.
      const sel = editor.getSelection();
      const isSelecting = sel && !sel.isEmpty();
      if (isSelecting) return;

      updatePrefix();
      const lineNum = e.position.lineNumber;
      if (lineNum === lastJumpedLineRef.current) return;
      lastJumpedLineRef.current = lineNum;
      const model = editor.getModel();
      if (!model) return;
      const lineContent = model.getLineContent(lineNum).trim();
      if (!lineContent || lineContent.startsWith('#')) return;
      const path = lineContent.split(/\s+/)[0];
      if (path && jumpToNodeRef.current) {
        jumpToNodeRef.current(path);
      }
    });

    const disposeDisposable = editor.onDidDispose(() => {
      contentDisposable.dispose();
      cursorDisposable.dispose();
      hardening.cancel();
      disposeDisposable.dispose();
    });
  }, [onJumpToNode, onEditorMount]);

  // Update error markers whenever errors change
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const markers: import('monaco-editor').editor.IMarkerData[] = errors.map(err => ({
      severity: monaco.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: err.lineNumber,
      startColumn: err.column ?? 1,
      endLineNumber: err.lineNumber,
      endColumn: (err.column ?? 1) + 1000,
    }));

    monaco.editor.setModelMarkers(model, LANGUAGE_ID, markers);
  }, [errors]);

  // Parse-error line decorations (red background + gutter for error lines)
  const errorDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoReady) return;
    if (errors.length === 0) {
      if (errorDecorationsRef.current.length > 0) {
        errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, []);
      }
      return;
    }
    const newDecorations: import('monaco-editor').editor.IModelDeltaDecoration[] = errors.map(err => ({
      range: {
        startLineNumber: err.lineNumber,
        startColumn: 1,
        endLineNumber: err.lineNumber,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: 'dm-verify-line--fail',
        linesDecorationsClassName: 'dm-verify-glyph--fail',
        linesDecorationsTooltip: err.message,
      },
    }));
    errorDecorationsRef.current = editor.deltaDecorations(errorDecorationsRef.current, newDecorations);
  }, [errors, monacoReady]);

  // Verify-result line decorations (pass/fail gutter + background)
  const verifyDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monacoReady) return;
    if (lineResults.length === 0) {
      if (verifyDecorationsRef.current.length > 0) {
        verifyDecorationsRef.current = editor.deltaDecorations(verifyDecorationsRef.current, []);
      }
      return;
    }
    const newDecorations: import('monaco-editor').editor.IModelDeltaDecoration[] = lineResults.map(lr => ({
      range: {
        startLineNumber: lr.lineNumber,
        startColumn: 1,
        endLineNumber: lr.lineNumber,
        endColumn: 1,
      },
      options: lr.passed
        ? {
          isWholeLine: true,
          className: 'dm-verify-line--pass',
          linesDecorationsClassName: 'dm-verify-glyph--pass',
          linesDecorationsTooltip: 'Passed',
        }
        : {
          isWholeLine: true,
          className: 'dm-verify-line--fail',
          linesDecorationsClassName: 'dm-verify-glyph--fail',
          linesDecorationsTooltip: `Failed${lr.expected ? ` — Expected: ${lr.expected}` : ''}${lr.actual ? `, Got: ${lr.actual}` : ''}`,
        },
    }));
    verifyDecorationsRef.current = editor.deltaDecorations(verifyDecorationsRef.current, newDecorations);
  }, [lineResults, monacoReady]);

  const themeCounter = useRef(0);
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !monacoReady) return;
    const apply = () => {
      themeCounter.current += 1;
      const name = `validation-dsl-${themeCounter.current}`;
      applyDynamicTheme(monaco, name);
      monaco.editor.setTheme(name);
      setThemeKey(name);
    };
    apply();
    const observer = new MutationObserver(() => apply());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return () => observer.disconnect();
  }, [monacoReady]);

  const editorOptions = useMemo(() => ({
    minimap: { enabled: false },
    lineNumbers: 'on' as const,
    glyphMargin: false,
    folding: false,
    wordWrap: 'off' as const,
    scrollBeyondLastLine: false,
    fontSize: 12.5,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
    fontLigatures: true,
    lineHeight: 20,
    padding: { top: 8, bottom: 8 },
    renderLineHighlight: 'line' as const,
    scrollbar: { vertical: 'auto' as const, horizontal: 'auto' as const, verticalScrollbarSize: 8 },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    readOnly,
    tabSize: 2,
    automaticLayout: true,
    // CRITICAL: Force Monaco off the experimental EditContext API and onto the
    // legacy <textarea> input path. On macOS Chromium the EditContext path
    // intermittently swallows Space keystrokes — `keydown` fires but no
    // `textupdate` follows, so the user has to press Space multiple times to
    // commit one space (the reported bug). Setting this to false also makes
    // our `autocorrect="off"` attribute on the textarea actually take effect,
    // disabling macOS smart-substitution at its source.
    editContext: false,
    // quickSuggestions ON so suggestions auto-appear while typing: paths at the
    // first-word position, operators after a path, values after an operator.
    quickSuggestions: { other: true, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'off' as const,
    // Space NEVER accepts a suggestion. Tab/Enter accept. This keeps Space literal.
    acceptSuggestionOnEnter: 'on' as const,
    acceptSuggestionOnCommitCharacter: false,
    suggest: {
      filterGraceful: true,
      snippetsPreventQuickSuggestions: false,
      showWords: false,
    },
    contextmenu: true,
    fixedOverflowWidgets: true,
    selectOnLineNumbers: true,
    selectionHighlight: true,
    columnSelection: false,
    multiCursorModifier: 'ctrlCmd' as const,
  }), [readOnly]);

  return (
    <div className="dm-validation-editor" role="region" aria-label="Validation rules editor">
      {!hideHeader && (() => {
        const passCount = lineResults.filter(r => r.passed).length;
        const failCount = lineResults.filter(r => !r.passed).length;
        const hasResults = lineResults.length > 0;
        return (
          <div className="dm-validation-editor-header">
            <span className="dm-validation-editor-title">Validation Rules</span>
            <div className="dm-validation-editor-stats">
              <span className="dm-validation-editor-stat">
                {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
              </span>
              {hasResults && passCount > 0 && (
                <span className="dm-validation-editor-stat dm-validation-editor-stat--pass">
                  {passCount} passed
                </span>
              )}
              {hasResults && failCount > 0 && (
                <span className="dm-validation-editor-stat dm-validation-editor-stat--fail">
                  {failCount} failed
                </span>
              )}
              {errorCount > 0 && (
                <span className="dm-validation-editor-stat dm-validation-editor-stat--error">
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        );
      })()}
      <div className="dm-validation-editor-body" style={{ height }}>
        <Editor
          language={LANGUAGE_ID}
          theme={themeKey}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={editorOptions}
          loading={<div className="dm-validation-editor-loading">Loading editor…</div>}
        />
      </div>
      {matchingPaths.length > 0 && (
        <div className="dm-validation-editor-pathstrip" role="region" aria-label="Matching paths">
          <span className="dm-validation-editor-pathstrip-label">Matches:</span>
          {matchingPaths.map((p) => (
            <button
              key={p}
              type="button"
              className="dm-validation-editor-pathstrip-chip"
              onClick={() => insertPathAtCursor(p)}
              onMouseDown={(e) => e.preventDefault()}
              title={`Insert ${p}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {!hideFooter && (
        <div className="dm-validation-editor-footer">
          <span className="dm-validation-editor-hint">
            Syntax: <code>path  operator  [value]</code> · <kbd>⌘</kbd><kbd>I</kbd> suggestions · <kbd>Tab</kbd> accept path hint · <code>#</code> comments
          </span>
          {onJumpToNode && (
            <span className="dm-validation-editor-hint">
              <kbd>Ctrl</kbd>+<kbd>G</kbd> Jump to node
            </span>
          )}
        </div>
      )}
    </div>
  );
}
