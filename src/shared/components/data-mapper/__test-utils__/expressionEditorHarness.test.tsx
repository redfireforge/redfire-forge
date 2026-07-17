// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  buildMonacoMock,
  createFakeEditor,
  createFakeMonaco,
  flushMonacoMount,
  makeSnippetMockImplementations,
  monacoTestState,
  resetMonacoTestState,
} from './expressionEditorHarness';

describe('expressionEditorHarness helpers', () => {
  it('resetMonacoTestState clears module-scoped monaco state', () => {
    monacoTestState.suppressOnMount = true;
    resetMonacoTestState();
    expect(monacoTestState.suppressOnMount).toBe(false);
  });

  it('createFakeEditor and createFakeMonaco support command wiring', () => {
    const handler = vi.fn();
    const { editor } = createFakeEditor({
      modelInitial: '{"a":1}',
      getSelectionImpl: () => ({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 3,
      }),
    });
    const { monaco } = createFakeMonaco();
    editor.addCommand(2048, handler);
    editor.__runCommand(2048);
    expect(handler).toHaveBeenCalled();
    expect(monaco.languages.registerCompletionItemProvider).toBeTypeOf('function');
    expect(editor.getModel()?.getValue()).toBe('{"a":1}');
  });

  it('buildMonacoMock mounts fake editor and invokes onMount', async () => {
    resetMonacoTestState();
    const mod = await buildMonacoMock();
    const Editor = mod.default;
    const onMount = vi.fn();
    render(<Editor value="$upper($.name)" onChange={vi.fn()} onMount={onMount} />);
    await flushMonacoMount();
    await waitFor(() => expect(onMount).toHaveBeenCalled());
    expect(monacoTestState.lastEditor).toBeTruthy();
    expect(monacoTestState.lastMonaco).toBeTruthy();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('makeSnippetMockImplementations supports load/save/update/delete flows', async () => {
    const mocks = {
      loadExpressionSnippets: vi.fn(),
      saveExpressionSnippet: vi.fn(),
      deleteExpressionSnippet: vi.fn(),
    };
    const { snippetStore, reset } = makeSnippetMockImplementations(mocks);
    reset();

    const loaded = await mocks.loadExpressionSnippets();
    expect(loaded).toEqual([]);

    const afterSave = await mocks.saveExpressionSnippet('Greet', '$upper($.name)');
    expect(afterSave).toHaveLength(1);
    expect(snippetStore[0]?.name).toBe('Greet');

    const afterUpdate = await mocks.saveExpressionSnippet('greet', '$lower($.name)');
    expect(afterUpdate).toHaveLength(1);
    expect(snippetStore[0]?.expression).toBe('$lower($.name)');

    const snippetId = snippetStore[0]!.id;
    const afterDelete = await mocks.deleteExpressionSnippet(snippetId);
    expect(afterDelete).toEqual([]);
    expect(snippetStore).toHaveLength(0);

    const thenable = mocks.loadExpressionSnippets() as Promise<unknown> & {
      catch: (fn: () => unknown) => unknown;
      finally: (fn: () => unknown) => unknown;
    };
    expect(thenable.catch(() => undefined)).toBe(thenable);
    expect(thenable.finally(() => undefined)).toBe(thenable);
  });
});
