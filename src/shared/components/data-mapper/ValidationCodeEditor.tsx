import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { ParseError } from './utils/validationDsl';

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

let languageRegistered = false;
let completionProviderRegistered = false;

function registerLanguage(monaco: typeof import('monaco-editor')) {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: LANGUAGE_ID });

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
        [/[\w$][\w$.[\]*]*/, 'identifier'],
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

function registerCompletionProvider(
  monaco: typeof import('monaco-editor'),
  getSamplePaths: () => string[],
) {
  if (completionProviderRegistered) return;
  completionProviderRegistered = true;
  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: [' ', '.', '['],
    provideCompletionItems: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilCursor = lineContent.slice(0, position.column - 1);
      const words = textUntilCursor.trim().split(/\s+/);
      const range = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      // Position 1: start of line — suggest paths
      if (words.length <= 1 && !textUntilCursor.includes(' ')) {
        const prefix = textUntilCursor.toLowerCase();
        const paths = getSamplePaths();
        const pathRange = {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };
        return {
          suggestions: paths
            .filter(p => p.toLowerCase().includes(prefix))
            .map(p => ({
              label: p,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: p,
              range: pathRange,
              detail: 'JSON path',
            })),
        };
      }

      // Position 2: after path — suggest operators
      if (words.length === 1 || (words.length === 2 && !textUntilCursor.endsWith(' '))) {
        const partial = words.length === 2 ? words[1].toLowerCase() : '';
        const opRange = words.length === 2
          ? {
            startLineNumber: position.lineNumber,
            startColumn: textUntilCursor.lastIndexOf(words[1]) + 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          }
          : range;
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

      // Position 3: after operator — suggest values
      if (words.length >= 2) {
        const op = words[words.length - 1]?.toLowerCase() ?? words[words.length - 2]?.toLowerCase();
        if (op === 'is_type') {
          return {
            suggestions: TYPE_NAMES.map(t => ({
              label: t,
              kind: monaco.languages.CompletionItemKind.Value,
              insertText: t,
              range,
              detail: 'Type name',
            })),
          };
        }
        if (['is_true', 'is_false'].some(k => op?.includes(k))) {
          return { suggestions: [] };
        }
        return {
          suggestions: [
            { label: 'true', kind: monaco.languages.CompletionItemKind.Value, insertText: 'true', range, detail: 'Boolean' },
            { label: 'false', kind: monaco.languages.CompletionItemKind.Value, insertText: 'false', range, detail: 'Boolean' },
          ],
        };
      }

      return { suggestions: [] };
    },
  });
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
}

export default function ValidationCodeEditor({
  value,
  onChange,
  errors,
  samplePaths = [],
  onJumpToNode,
  height = 200,
  readOnly = false,
}: ValidationCodeEditorProps) {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const samplePathsRef = useRef(samplePaths);
  const [ruleCount, setRuleCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  samplePathsRef.current = samplePaths;

  useEffect(() => {
    setRuleCount(value.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length);
    setErrorCount(errors.length);
  }, [value, errors]);

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerLanguage(monaco);
    registerCompletionProvider(monaco, () => samplePathsRef.current);
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
    quickSuggestions: { other: true, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    contextmenu: true,
    fixedOverflowWidgets: true,
  }), [readOnly]);

  return (
    <div className="dm-validation-editor" role="region" aria-label="Validation rules editor">
      <div className="dm-validation-editor-header">
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
      <div className="dm-validation-editor-footer">
        <span className="dm-validation-editor-hint">
          Syntax: <code>path  operator  [value]</code> · Lines starting with <code>#</code> are comments
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
