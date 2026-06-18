import Editor, { type BeforeMount } from '@monaco-editor/react';
import { GRAPHQL_THEME_ID, getVariablesEditorOptions, registerGraphqlLanguage } from '../utils/monacoGraphqlSetup';

// BUG-GQL-R11-16 fix: hoisted to module scope (same pattern as GraphqlEditor.tsx)
// so @monaco-editor/react doesn't receive a new function reference on every render.
const handleBeforeMount: BeforeMount = (monaco) => {
  registerGraphqlLanguage(monaco);
};

interface GraphqlVariablesPanelProps {
  /** Monaco model path — unique per tab so each tab keeps its own JSON variables model */
  modelPath: string;
  /** Initial JSON string (used only when the model for this path doesn't exist yet) */
  defaultValue?: string;
  /** Called with updated JSON string on every change */
  onChange?: (json: string) => void;
  height?: string | number;
  /** Marks the panel with a red border when the JSON is invalid */
  hasError?: boolean;
}

export function GraphqlVariablesPanel({
  modelPath,
  defaultValue = '{\n  \n}',
  onChange,
  height = '100%',
  hasError = false,
}: GraphqlVariablesPanelProps) {

  const options = getVariablesEditorOptions();

  return (
    <div
      className={`gql-vars-panel${hasError ? ' gql-vars-panel--error' : ''}`}
      data-testid="gql-variables-panel"
    >
      <Editor
        language="json"
        theme={GRAPHQL_THEME_ID}
        path={modelPath}
        defaultValue={defaultValue}
        height={height}
        options={options}
        beforeMount={handleBeforeMount}
        onChange={(val) => onChange?.(val ?? '')}
      />
    </div>
  );
}
