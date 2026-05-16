import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { ParseError } from './utils/validationDsl';
import { installTextareaHardening } from './utils/monacoTextareaHardening';
import {
  LANGUAGE_ID,
  registerLanguage,
  ensureCompletionProvider,
  applyDynamicTheme,
} from './utils/monacoValidationLanguage';

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

  // Verify-result line decorations (pass/fail gutter + background + inline annotations)
  const verifyDecorationsRef = useRef<string[]>([]);
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !monacoReady) return;
    if (lineResults.length === 0) {
      if (verifyDecorationsRef.current.length > 0) {
        verifyDecorationsRef.current = editor.deltaDecorations(verifyDecorationsRef.current, []);
      }
      return;
    }
    const newDecorations: import('monaco-editor').editor.IModelDeltaDecoration[] = [];
    for (const lr of lineResults) {
      const lineLength = model.getLineLength(lr.lineNumber);
      // Gutter + line background
      newDecorations.push({
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
      });
      // Inline end-of-line annotation for failed/passed rules
      if (!lr.passed && lr.actual) {
        newDecorations.push({
          range: {
            startLineNumber: lr.lineNumber,
            startColumn: lineLength + 1,
            endLineNumber: lr.lineNumber,
            endColumn: lineLength + 1,
          },
          options: {
            after: {
              content: `  ← Got: ${lr.actual.length > 40 ? lr.actual.slice(0, 37) + '…' : lr.actual}`,
              inlineClassName: 'dm-verify-inline--fail',
            },
          },
        });
      } else if (lr.passed) {
        newDecorations.push({
          range: {
            startLineNumber: lr.lineNumber,
            startColumn: lineLength + 1,
            endLineNumber: lr.lineNumber,
            endColumn: lineLength + 1,
          },
          options: {
            after: {
              content: '  ✓',
              inlineClassName: 'dm-verify-inline--pass',
            },
          },
        });
      }
    }
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
