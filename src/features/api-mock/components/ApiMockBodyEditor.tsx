import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable, Position } from 'monaco-editor';
import { mockTemplateCompletionsForPrefix } from './apiMockTemplateCompletions';

interface Props {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  readOnly?: boolean;
}

/**
 * Monaco body editor with `{{` helper completion for mock response templates.
 */
export function ApiMockBodyEditor({
  value,
  onChange,
  language = 'json',
  height = '220px',
  readOnly = false,
}: Props) {
  const completionRef = useRef<IDisposable | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    completionRef.current?.dispose();
    const languages = ['json', 'xml', 'html', 'plaintext'];
    const disposables = languages.map(lang => monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['{'],
      provideCompletionItems: (model: MonacoEditor.ITextModel, position: Position) => {
        // Language-wide providers would otherwise leak {{ mock helpers into every Monaco JSON/XML editor.
        if (model !== editor.getModel()) return { suggestions: [] };
        const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
        const open = line.lastIndexOf('{{');
        if (open < 0) return { suggestions: [] };
        const typed = line.slice(open + 2);
        if (typed.includes('}}')) return { suggestions: [] };
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: open + 3,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        };
        return {
          suggestions: mockTemplateCompletionsForPrefix(typed).map((item, i) => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: item.insert,
            detail: item.detail,
            range,
            sortText: String(i).padStart(3, '0'),
          })),
        };
      },
    }));
    completionRef.current = { dispose: () => { for (const d of disposables) d.dispose(); } };
  }, []);

  useEffect(() => () => { completionRef.current?.dispose(); }, []);

  return (
    <div className="am-monaco-body" data-testid="api-mock-variant-body">
      <Editor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={next => onChange(next ?? '')}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
