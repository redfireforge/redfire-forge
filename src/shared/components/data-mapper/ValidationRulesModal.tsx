import { useRef, useState, useCallback, useEffect, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import ValidationCodeEditor, { type LineVerifyResult } from './ValidationCodeEditor';
import DslReferencePanel from './DslReferencePanel';
import { useValidationRulesModal, type VrModalMode } from './hooks/useValidationRulesModal';
import type { ParseError } from './utils/validationDsl';
import { parseDsl, countDslRuleLines } from './utils/validationDsl';
import '../../../styles/validation-rules-modal.css';

interface ValidationRulesModalProps {
  value: string;
  onChange: (text: string) => void;
  errors: ParseError[];
  samplePaths: string[];
  onClose: () => void;
  onJumpToNode?: (path: string) => void;
  portalContainerRef?: RefObject<HTMLDivElement | null>;
  verifyStatus?: 'idle' | 'running' | 'complete';
  verifyPassedCount?: number;
  verifyFailedCount?: number;
  lineResults?: LineVerifyResult[];
}

export default function ValidationRulesModal({
  value,
  onChange,
  errors,
  samplePaths,
  onClose,
  onJumpToNode,
  portalContainerRef,
  verifyStatus,
  verifyPassedCount = 0,
  verifyFailedCount = 0,
  lineResults = [],
}: ValidationRulesModalProps) {
  const {
    mode,
    setMode,
    referenceVisible,
    toggleReference,
    dockedHeight,
    onDockedResizeStart,
    floatPos,
    floatSize,
    onFloatDragStart,
    onFloatResizeStart,
    onRightEdgeResizeStart,
  } = useValidationRulesModal();

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const revertValueRef = useRef(value);
  const [localText, setLocalText] = useState(value);
  const [localErrors, setLocalErrors] = useState<ParseError[]>(errors);
  const userEditedRef = useRef(false);
  const lastSyncedValueRef = useRef(value);
  const lastSyncedErrorsRef = useRef(errors);

  // Sync from external prop when user hasn't made local edits
  if (value !== lastSyncedValueRef.current && !userEditedRef.current) {
    lastSyncedValueRef.current = value;
    setLocalText(value);
    setLocalErrors(errors);
    lastSyncedErrorsRef.current = errors;
    revertValueRef.current = value;
  }
  // Also sync errors when value is unchanged but errors arrive later (e.g. on reopen)
  if (errors !== lastSyncedErrorsRef.current && !userEditedRef.current) {
    lastSyncedErrorsRef.current = errors;
    setLocalErrors(errors);
  }

  const handleLocalChange = useCallback((text: string) => {
    if (!userEditedRef.current) {
      revertValueRef.current = localText;
    }
    userEditedRef.current = true;
    setLocalText(text);
    const { errors: parsed } = parseDsl(text);
    setLocalErrors(parsed);
  }, [localText]);

  const handleSave = useCallback(() => {
    onChange(localText);
    onClose();
  }, [localText, onChange, onClose]);

  const handleCancel = useCallback(() => {
    if (userEditedRef.current) {
      onChange(revertValueRef.current);
    }
    onClose();
  }, [onChange, onClose]);

  const handleInsert = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const pos = editor.getPosition();
    if (!pos) return;
    editor.executeEdits('dsl-ref-insert', [{
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: text + '\n',
      forceMoveMarkers: true,
    }]);
    editor.focus();
  }, []);

  const handleEditorMount = useCallback((editor: import('monaco-editor').editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const editor = editorRef.current;
      if (editor) {
        const suggestWidget = editor.getDomNode()?.querySelector('.editor-widget.suggest-widget.visible');
        if (suggestWidget) return;
      }
      handleCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel]);

  const ruleCount = useMemo(() => countDslRuleLines(localText), [localText]);
  const errorCount = localErrors.length;

  const handleModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as VrModalMode);
  }, [setMode]);

  // ── Shared sub-components ──

  const headerEl = (
    <div
      className="vr-modal-header"
      onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
      style={mode === 'floating' ? { cursor: 'grab' } : undefined}
    >
      <span className="vr-modal-header-title">
        <span className="vr-modal-header-icon">{mode === 'floating' ? '\u2847' : '\u26A1'}</span>
        {' '}Validation Rules
      </span>
      <div className="vr-modal-header-stats">
        <span className="vr-modal-stat">
          <span className={`vr-modal-dot${errorCount > 0 ? ' vr-modal-dot--err' : ' vr-modal-dot--ok'}`} />
          {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
        </span>
        {errorCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--error">
            <span className="vr-modal-dot vr-modal-dot--err" />
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {verifyStatus === 'complete' && verifyPassedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--pass">
            <span className="vr-modal-dot vr-modal-dot--pass" />
            {verifyPassedCount} passed
          </span>
        )}
        {verifyStatus === 'complete' && verifyFailedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--fail">
            <span className="vr-modal-dot vr-modal-dot--err" />
            {verifyFailedCount} failed
          </span>
        )}
      </div>
      <div className="vr-modal-header-actions">
        <button
          type="button"
          className={`vr-modal-action-btn${referenceVisible ? ' vr-modal-action-btn--active' : ''}`}
          onClick={toggleReference}
          title="Toggle DSL reference"
          aria-label="Toggle reference panel"
        >
          Reference {referenceVisible ? '\u25C2' : '\u25B8'}
        </button>
        <span className="vr-modal-action-sep" />
        <select
          className="vr-modal-mode-select"
          value={mode}
          onChange={handleModeChange}
          title="Display mode (saved as default)"
          aria-label="Modal display mode"
        >
          <option value="docked">{'\u2B13'} Bottom</option>
          <option value="floating">{'\u29C9'} Floating</option>
          <option value="maximized">{'\u2B1C'} Full Screen</option>
        </select>
      </div>
    </div>
  );

  const bodyEl = (
    <div className="vr-modal-body">
      <div className="vr-modal-editor-pane">
        <ValidationCodeEditor
          value={localText}
          onChange={handleLocalChange}
          errors={localErrors}
          samplePaths={samplePaths}
          onJumpToNode={onJumpToNode}
          height="100%"
          onEditorMount={handleEditorMount}
          hideHeader
          hideFooter
          lineResults={lineResults}
        />
      </div>
      <button
        type="button"
        className={`vr-ref-edge-toggle${referenceVisible ? '' : ' vr-ref-edge-toggle--collapsed'}`}
        onClick={toggleReference}
        title={referenceVisible ? 'Hide reference' : 'Show reference'}
        aria-label={referenceVisible ? 'Hide reference panel' : 'Show reference panel'}
      >
        {referenceVisible
          ? '\u25B8'
          : <><span className="vr-ref-edge-label">REF</span>{'\u25C2'}</>}
      </button>
      {referenceVisible && <DslReferencePanel onInsert={handleInsert} onClose={toggleReference} />}
    </div>
  );

  const footerActionsEl = (
    <div className="vr-modal-actions">
      <div className="vr-modal-actions-hints">
        <span>Syntax: <code>path  operator  [value]</code></span>
        <span>Auto-suggest while typing</span>
        {onJumpToNode && <span><kbd>Ctrl</kbd>+<kbd>G</kbd> jump to node</span>}
        <span><code>#</code> comments</span>
      </div>
      <div className="vr-modal-actions-buttons">
        <button type="button" className="vr-modal-btn vr-modal-btn--secondary" onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" className="vr-modal-btn vr-modal-btn--primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );

  // Portal into the closest modal overlay ancestor so the panel participates
  // in the same stacking context (e.g. insomnia-modal-overlay z-index: 10080).
  // Falls back to document.body when used outside a modal shell.
  const portalTarget = portalContainerRef?.current?.closest('.dm-modal-overlay')
    ?? portalContainerRef?.current?.closest('.modal-overlay')
    ?? document.body;

  if (mode === 'docked') {
    return createPortal(
      <div className="vr-modal-panel vr-modal-panel--docked" style={{ height: dockedHeight }} role="region" aria-label="Validation Rules">
        <div className="vr-modal-resize-handle" onMouseDown={onDockedResizeStart} />
        {headerEl}
        {bodyEl}
        {footerActionsEl}
      </div>,
      portalTarget,
    );
  }

  if (mode === 'maximized') {
    return createPortal(
      <div className="vr-modal-panel vr-modal-panel--maximized" role="region" aria-label="Validation Rules">
        {headerEl}
        {bodyEl}
        {footerActionsEl}
      </div>,
      portalTarget,
    );
  }

  return createPortal(
    <div
      className="vr-modal-panel vr-modal-panel--floating"
      style={{ left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h }}
      role="region"
      aria-label="Validation Rules"
    >
      {headerEl}
      {bodyEl}
      {footerActionsEl}
      <div className="vr-modal-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
      <div className="vr-modal-float-grip" onMouseDown={onFloatResizeStart} />
    </div>,
    portalTarget,
  );
}
