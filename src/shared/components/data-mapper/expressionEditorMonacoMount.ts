import type { MutableRefObject } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable, Position } from 'monaco-editor';
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import { buildFunctionSnippet } from './utils/expressionEditorHelpers';

export interface ExpressionEditorMonacoMountOptions {
  editorRef: MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  completionDisposableRef: MutableRefObject<IDisposable | null>;
  expressionRef: MutableRefObject<string>;
  sourcePathsRef: MutableRefObject<string[]>;
  allFunctionsRef: MutableRefObject<ExpressionFunction[]>;
  handleSaveRef: MutableRefObject<() => void>;
  onCancel: () => void;
}

/** Creates the Monaco onMount handler for ExpressionEditorModal. */
export function createExpressionEditorMonacoMount({
  editorRef,
  completionDisposableRef,
  expressionRef,
  sourcePathsRef,
  allFunctionsRef,
  handleSaveRef,
  onCancel,
}: ExpressionEditorMonacoMountOptions): OnMount {
  return (editor, monaco) => {
    editorRef.current = editor;

    const currentModel = editor.getModel();
    if (currentModel && expressionRef.current && currentModel.getValue() !== expressionRef.current) {
      currentModel.setValue(expressionRef.current);
    }

    completionDisposableRef.current?.dispose();
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('plaintext', {
      triggerCharacters: ['$', '.'],
      provideCompletionItems(model: MonacoEditor.ITextModel, position: Position) {
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

        if (/\$\.\s*$/.test(textUntilPosition) || /\$\.[a-zA-Z0-9_.[\]]*$/.test(textUntilPosition)) {
          return {
            suggestions: sourcePathsRef.current.map((p) => ({
              label: `$.${p}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: p,
              detail: 'Source field',
              documentation: `Reference to source path "${p}"`,
              range,
            })),
          };
        }

        if (/\$[a-zA-Z]*$/.test(textUntilPosition)) {
          return {
            suggestions: allFunctionsRef.current.map((fn) => {
              const fnCall = fn.name.startsWith('$') ? fn.name : `$${fn.name}`;
              const snippet = buildFunctionSnippet(fnCall, fn);
              return {
                label: fnCall,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `${fn.category} — ${fn.returnType}`,
                documentation: `${fn.description}\n\n${fn.signature}`,
                range,
              };
            }),
          };
        }

        return { suggestions: [] };
      },
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleSaveRef.current();
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      onCancel();
    });

    editor.focus();
  };
}
