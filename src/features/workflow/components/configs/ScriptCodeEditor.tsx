import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable } from 'monaco-editor';

export interface ScriptCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  inputVariables: string[];
  outputVariables: string[];
  height?: string;
  readOnly?: boolean;
}

/**
 * Monaco-powered code editor for Script nodes.
 * Provides JavaScript syntax highlighting, bracket matching,
 * and autocomplete for `input.*` and `output.*` properties.
 */
export default function ScriptCodeEditor({
  value,
  onChange,
  inputVariables,
  outputVariables,
  height = '250px',
  readOnly = false,
}: ScriptCodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);
  const inputVarsRef = useRef(inputVariables);
  const outputVarsRef = useRef(outputVariables);

  // Keep refs in sync with latest props
  inputVarsRef.current = inputVariables;
  outputVarsRef.current = outputVariables;

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register completion provider for `input.` and `output.` properties
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems(model, position) {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Check if user just typed `input.`
        if (/\binput\.\s*$/.test(textUntilPosition)) {
          return {
            suggestions: inputVarsRef.current
              .filter(v => v.length > 0)
              .map(varName => ({
                label: varName,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: varName,
                detail: 'Input variable',
                documentation: `Workflow variable "${varName}" passed as input to this script.`,
                range,
              })),
          };
        }

        // Check if user just typed `output.`
        if (/\boutput\.\s*$/.test(textUntilPosition)) {
          return {
            suggestions: outputVarsRef.current
              .filter(v => v.length > 0)
              .map(varName => ({
                label: varName,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: varName,
                detail: 'Output variable',
                documentation: `Output variable "${varName}" exported back to the workflow.`,
                range,
              })),
          };
        }

        // Top-level suggestions for `input` and `output` objects
        if (/^\s*\w*$/.test(textUntilPosition.trim()) || /[\s;=({,+\-*/!&|^~?:]$/.test(textUntilPosition)) {
          return {
            suggestions: [
              {
                label: 'input',
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: 'input',
                detail: 'Input variables object',
                documentation: 'Read-only object containing workflow variables passed into this script.',
                range,
              },
              {
                label: 'output',
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: 'output',
                detail: 'Output variables object',
                documentation: 'Set properties on this object to export variables back to the workflow.',
                range,
              },
              {
                label: 'console',
                kind: monaco.languages.CompletionItemKind.Module,
                insertText: 'console',
                detail: 'Console object',
                documentation: 'Use console.log(), console.warn(), console.error() to log to the workflow console.',
                range,
              },
            ],
          };
        }

        return { suggestions: [] };
      },
    });
  }, []);

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose();
    };
  }, []);

  return (
    <div className="wf-script-code-editor">
      <Editor
        height={height}
        defaultLanguage="javascript"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          readOnly,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoIndent: 'full',
          formatOnPaste: true,
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
        theme="vs-dark"
      />
    </div>
  );
}
