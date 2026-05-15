import { useRef, useCallback, useEffect, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import ValidationCodeEditor from './ValidationCodeEditor';
import DslReferencePanel from './DslReferencePanel';
import { useValidationRulesModal, type VrModalMode } from './hooks/useValidationRulesModal';
import type { ParseError } from './utils/validationDsl';
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
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ruleCount = useMemo(
    () => value.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length,
    [value],
  );
  const errorCount = errors.length;

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
        <button
          type="button"
          className="vr-modal-close-btn"
          onClick={onClose}
          title="Close"
          aria-label="Close validation rules"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );

  const bodyEl = (
    <div className="vr-modal-body">
      <div className="vr-modal-editor-pane">
        <ValidationCodeEditor
          value={value}
          onChange={onChange}
          errors={errors}
          samplePaths={samplePaths}
          onJumpToNode={onJumpToNode}
          height="100%"
          onEditorMount={handleEditorMount}
          hideHeader
          hideFooter
        />
        <div className="vr-modal-footer">
          <span>Syntax: <code>path  operator  [value]</code></span>
          <span><kbd>Ctrl</kbd>+<kbd>Space</kbd> suggestions</span>
          {onJumpToNode && <span><kbd>Ctrl</kbd>+<kbd>G</kbd> jump to node</span>}
          <span><code>#</code> comments</span>
        </div>
      </div>
      {referenceVisible && <DslReferencePanel onInsert={handleInsert} />}
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
      </div>,
      portalTarget,
    );
  }

  if (mode === 'maximized') {
    return createPortal(
      <div className="vr-modal-panel vr-modal-panel--maximized" role="region" aria-label="Validation Rules">
        {headerEl}
        {bodyEl}
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
      <div className="vr-modal-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
      <div className="vr-modal-float-grip" onMouseDown={onFloatResizeStart} />
    </div>,
    portalTarget,
  );
}
