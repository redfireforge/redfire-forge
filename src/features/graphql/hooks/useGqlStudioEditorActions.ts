import { useCallback, useEffect, useRef, useState } from 'react';
import { parse as gqlParse, print as gqlPrint } from 'graphql';

export interface UseGqlStudioEditorActionsOptions {
  activeQuery: string;
  onQueryChange: (value: string) => void;
}

export interface UseGqlStudioEditorActionsResult {
  editorMountRef:   React.MutableRefObject<import('monaco-editor').editor.IStandaloneCodeEditor | null>;
  prettifyError:    boolean;
  insertToast:      string | null;
  handlePrettify:   () => void;
  handleInsertField: (fieldName: string, _fieldType: string, hasArgs: boolean) => void;
}

/**
 * Extracts prettify and insert-field editor actions from GraphqlStudioPage.
 */
export function useGqlStudioEditorActions({
  activeQuery,
  onQueryChange,
}: UseGqlStudioEditorActionsOptions): UseGqlStudioEditorActionsResult {
  const editorMountRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  // ── Prettify ───────────────────────────────────────────────────────────────
  const [prettifyError, setPrettifyError]   = useState(false);
  const prettifyErrorTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePrettify = useCallback(() => {
    if (!activeQuery.trim()) return;
    try {
      const formatted = gqlPrint(gqlParse(activeQuery));
      if (formatted === activeQuery) return;
      if (editorMountRef.current) {
        editorMountRef.current.setValue(formatted);
      }
      onQueryChange(formatted);
    } catch {
      setPrettifyError(true);
      if (prettifyErrorTimerRef.current) clearTimeout(prettifyErrorTimerRef.current);
      prettifyErrorTimerRef.current = setTimeout(() => setPrettifyError(false), 1000);
    }
  }, [activeQuery, onQueryChange]);

  useEffect(() => () => {
    if (prettifyErrorTimerRef.current) clearTimeout(prettifyErrorTimerRef.current);
  }, []);

  // ── Insert field from schema explorer ─────────────────────────────────────
  const [insertToast, setInsertToast]     = useState<string | null>(null);
  const insertToastTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInsertField = useCallback(
    (fieldName: string, _fieldType: string, hasArgs: boolean) => {
      const editor = editorMountRef.current;
      if (!editor) {
        setInsertToast('Editor not ready');
        if (insertToastTimerRef.current) clearTimeout(insertToastTimerRef.current);
        insertToastTimerRef.current = setTimeout(() => setInsertToast(null), 1800);
        return;
      }
      const model    = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const argSuffix = hasArgs ? '()' : '';
      const text = `${fieldName}${argSuffix}`;

      model.applyEdits([{
        range: {
          startLineNumber: position.lineNumber,
          startColumn:     position.column,
          endLineNumber:   position.lineNumber,
          endColumn:       position.column,
        },
        text,
      }]);

      const newCol = position.column + text.length;
      editor.setPosition({ lineNumber: position.lineNumber, column: newCol });
      editor.focus();

      setInsertToast(`Inserted: ${fieldName}`);
      if (insertToastTimerRef.current) clearTimeout(insertToastTimerRef.current);
      insertToastTimerRef.current = setTimeout(() => setInsertToast(null), 1800);
    },
    [],
  );

  useEffect(() => () => {
    if (insertToastTimerRef.current) clearTimeout(insertToastTimerRef.current);
  }, []);

  return {
    editorMountRef,
    prettifyError,
    insertToast,
    handlePrettify,
    handleInsertField,
  };
}
