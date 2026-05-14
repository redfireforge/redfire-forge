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

function registerLanguage(monaco: typeof import('monaco-editor')) {
  if (isLanguageRegistered()) return;
  markLanguageRegistered();

  monaco.languages.register({ id: LANGUAGE_ID });

  // Word pattern: only plain identifiers are "words" — dots, brackets, etc. are separators.
  // This prevents Monaco from treating "offers[0].rank" as a single word and trying to
  // extend partial text like "offers" into a longer path via its suggest widget.
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

  monaco.editor.defineTheme('validation-dsl-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
      { token: 'string', foreground: 'a6e3a1' },
      { token: 'number', foreground: 'fab387' },
      { token: 'keyword.boolean', foreground: 'f38ba8' },
      { token: 'keyword.operator', foreground: 'cba6f7' },
      { token: 'keyword.negate', foreground: 'f87171', fontStyle: 'bold' },
      { token: 'keyword.collection', foreground: '94e2d5' },
      { token: 'type', foreground: '94e2d5' },
      { token: 'operator', foreground: 'f9e2af' },
      { token: 'identifier', foreground: '89dceb' },
      { token: 'delimiter', foreground: '6c7086' },
      { token: 'delimiter.path', foreground: '89dceb' },
    ],
    colors: {
      'editor.background': '#181825',
      'editor.foreground': '#cdd6f4',
      'editor.lineHighlightBackground': '#1e1e2e',
      'editor.selectionBackground': '#45475a80',
      'editorCursor.foreground': '#89b4fa',
      'editorLineNumber.foreground': '#45475a',
      'editorLineNumber.activeForeground': '#89b4fa',
      'editor.inactiveSelectionBackground': '#31324440',
      'editorGutter.background': '#11111b',
      'editorIndentGuide.background': '#31324440',
    },
  });
}

// ─── Autocomplete Provider ────────────────────────────────

function ensureCompletionProvider(
  monaco: typeof import('monaco-editor'),
) {
  if (getStoredDisposable()) return;

  const disposable = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    // No automatic triggerCharacters — quickSuggestions handles auto-trigger,
    // and our provider decides what (if anything) to return per context.
    // Paths are surfaced via the passive React hint strip, never through this widget.
    provideCompletionItems: (model, position, context) => {
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
        // Paths are NEVER returned via Monaco's suggest widget — Monaco can't
        // distinguish quickSuggestions auto-trigger from manual Ctrl+Space
        // (both use triggerKind: Invoke), so any path return would auto-popup
        // while the user types and hijack keystrokes. Path discovery is handled
        // by the passive `dm-validation-editor-pathstrip` chips below the
        // editor — which cannot intercept typing because it's not a Monaco widget.
        void context; // kept for future use; intentionally unused here
        return { suggestions: [] };
      }

      // After path — suggest operators
      if (words.length === 1 || (words.length === 2 && !textUntilCursor.endsWith(' '))) {
        const partial = words.length === 2 ? words[1].toLowerCase() : '';
        const opRange = words.length === 2
          ? {
            startLineNumber: position.lineNumber,
            startColumn: textUntilCursor.lastIndexOf(words[1]) + 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
          : cursorRange;
        return {
          suggestions: OPERATOR_KEYWORDS
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
        const op = words[words.length - 1]?.toLowerCase() ?? words[words.length - 2]?.toLowerCase();
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

interface ValidationCodeEditorProps {
  value: string;
  onChange: (text: string) => void;
  errors: ParseError[];
  samplePaths?: string[];
  onJumpToNode?: (path: string) => void;
  height?: number | string;
  readOnly?: boolean;
  onPopOut?: () => void;
  onPopIn?: () => void;
  isFloating?: boolean;
}

export default function ValidationCodeEditor({
  value,
  onChange,
  errors,
  samplePaths = [],
  onJumpToNode,
  height = 200,
  readOnly = false,
  onPopOut,
  onPopIn,
  isFloating = false,
}: ValidationCodeEditorProps) {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const samplePathsRef = useRef(samplePaths);
  const [ruleCount, setRuleCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [currentPrefix, setCurrentPrefix] = useState('');

  samplePathsRef.current = samplePaths;

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
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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
    const cursorDisposable = editor.onDidChangeCursorPosition(updatePrefix);

    const disposeDisposable = editor.onDidDispose(() => {
      contentDisposable.dispose();
      cursorDisposable.dispose();
      hardening.cancel();
      disposeDisposable.dispose();
    });
  }, [onJumpToNode]);

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

  const editorOptions = useMemo(() => ({
    minimap: { enabled: false },
    lineNumbers: 'on' as const,
    glyphMargin: true,
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
    // quickSuggestions ON so the operator/value helper auto-appears (e.g. "length"
    // after `offers `). Path suggestions are gated INSIDE the completion provider
    // so they only appear on explicit Invoke (Ctrl+Space) — never while typing
    // the path itself.
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
  }), [readOnly]);

  return (
    <div className="dm-validation-editor" role="region" aria-label="Validation rules editor">
      <div className={`dm-validation-editor-header${isFloating ? ' dm-validation-editor-header--floating' : ''}`}>
        <span className="dm-validation-editor-title">Validation Rules</span>
        <div className="dm-validation-editor-stats">
          <span className="dm-validation-editor-stat">
            {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
          </span>
          {errorCount > 0 && (
            <span className="dm-validation-editor-stat dm-validation-editor-stat--error">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {onPopOut && !isFloating && (
            <button
              className="dm-validation-editor-popout-btn"
              onClick={onPopOut}
              title="Open in floating window"
              aria-label="Pop out editor"
            >
              ↗
            </button>
          )}
          {onPopIn && isFloating && (
            <button
              className="dm-validation-editor-popout-btn"
              onClick={onPopIn}
              title="Dock back to panel"
              aria-label="Pop in editor"
            >
              ↙
            </button>
          )}
        </div>
      </div>
      <div className="dm-validation-editor-body" style={{ height }}>
        <Editor
          language={LANGUAGE_ID}
          theme="validation-dsl-dark"
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
      <div className="dm-validation-editor-footer">
        <span className="dm-validation-editor-hint">
          Syntax: <code>path  operator  [value]</code> · <kbd>Ctrl</kbd>+<kbd>Space</kbd> for full suggestions · Lines starting with <code>#</code> are comments
        </span>
        {onJumpToNode && (
          <span className="dm-validation-editor-hint">
            <kbd>Ctrl</kbd>+<kbd>G</kbd> Jump to node
          </span>
        )}
      </div>
    </div>
  );
}
