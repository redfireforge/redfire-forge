import { useCallback, useEffect, useRef } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import {
  GRAPHQL_LANGUAGE_ID,
  GRAPHQL_THEME_ID,
  registerGraphqlLanguage,
  getGraphqlEditorOptions,
  getOrInitGraphqlMode,
} from '../utils/monacoGraphqlSetup';

// Stable beforeMount handler — defined outside the component because it captures
// nothing from the component scope. Both calls are idempotent.
const handleBeforeMount: BeforeMount = (monaco) => {
  registerGraphqlLanguage(monaco);
  // Eagerly initialise the monaco-graphql language service so the worker is
  // ready before the first editor instance is created. This ensures schema-aware
  // autocomplete becomes active as soon as setGraphqlSchema() is called.
  try {
    getOrInitGraphqlMode();
  } catch {
    // Non-fatal — worker may not be available in all environments (e.g. tests)
  }
};

interface GraphqlEditorProps {
  /** Monaco model path — each tab has a unique path so models persist across tab switches */
  modelPath: string;
  /** Initial value (used only when the model for this path doesn't exist yet) */
  defaultValue?: string;
  /** Called with the new document text on every change */
  onChange?: (value: string) => void;
  /** Editor height — defaults to filling its container */
  height?: string | number;
  readOnly?: boolean;
  'data-testid'?: string;
}

export function GraphqlEditor({
  modelPath,
  defaultValue = '',
  onChange,
  height = '100%',
  readOnly = false,
  'data-testid': testId,
}: GraphqlEditorProps) {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    if (!readOnly) editor.focus();
  }, [readOnly]);

  // Auto-focus the editor whenever the active model changes (i.e. the user switches tabs).
  // @monaco-editor/react swaps the model on `path` change but does NOT re-fire onMount,
  // so the editor loses focus. We defer one animation frame to ensure the model swap
  // is fully settled before calling focus().
  useEffect(() => {
    if (readOnly) return;
    const frame = requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [modelPath, readOnly]);

  const baseOptions = getGraphqlEditorOptions();

  return (
    <div
      className="gql-editor-wrapper"
      style={{ height }}
      data-testid={testId ?? 'gql-editor'}
    >
      <Editor
        language={GRAPHQL_LANGUAGE_ID}
        theme={GRAPHQL_THEME_ID}
        path={modelPath}
        defaultValue={defaultValue}
        height={height}
        options={{ ...baseOptions, readOnly }}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={(val) => onChange?.(val ?? '')}
      />
    </div>
  );
}
