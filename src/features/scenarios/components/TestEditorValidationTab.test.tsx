/** @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRef, useState } from 'react';
import TestEditorValidationTab from './TestEditorValidationTab';
import { makeProps, makeDraft } from './TestEditorValidationTab.test-utils';

const mocks = vi.hoisted(() => ({
  createValidationAdapter: vi.fn(() => ({ kind: 'adapter' })),
}));

vi.mock('../../../shared/components/data-mapper', () => ({
  createValidationAdapter: mocks.createValidationAdapter,
  DataMapperModal: ({ onSave, onCancel }: any) => (
    <div data-testid="data-mapper-modal">
      <button
        type="button"
        onClick={() => onSave({
          selectiveMode: 'exclude',
          expectedFields: [{ jsonPath: '$.items.0.name', expectedType: 'string' }],
          excludedPaths: ['$.meta'],
          assertions: [{ type: 'existence', jsonPath: '$.items', expectExists: true }],
        }, { unorderedArrays: true })}
      >
        Save mapper
      </button>
      <button type="button" onClick={onCancel}>Cancel mapper</button>
    </div>
  ),
  RegexAssertionBuilderModal: ({ onSave, onCancel, initialJsonPath, initialPattern }: any) => (
    <div data-testid="regex-builder-modal">
      <div>{initialJsonPath}</div>
      <div>{initialPattern}</div>
      <button type="button" onClick={() => onSave({ jsonPath: '$.name', pattern: '^A' })}>Save regex</button>
      <button type="button" onClick={onCancel}>Cancel regex</button>
    </div>
  ),
}));

vi.mock('../../requests/components/ResponseVersionPanel', () => ({
  default: () => <div data-testid="response-version-panel" />,
}));

vi.mock('../../requests/components/RulesVersionPanel', () => ({
  default: () => <div data-testid="rules-version-panel" />,
}));

vi.mock('./AssertionPresetMenu', () => ({
  default: ({ onImport }: any) => (
    <button type="button" onClick={() => onImport([{ type: 'custom', expression: 'true', description: 'preset' }])}>
      Import preset
    </button>
  ),
}));

vi.mock('./AssertionRowEditor', () => ({
  default: ({ index, assertion, onUpdate, onRemove, onOpenRegexBuilder }: any) => (
    <div data-testid={`assertion-row-${index}`}>
      <span>{assertion.type}</span>
      <button type="button" onClick={() => onUpdate(index, { description: 'updated' })}>Update assertion</button>
      <button type="button" onClick={() => onRemove(index)}>Remove assertion</button>
      <button type="button" onClick={() => onOpenRegexBuilder(index)}>Open regex editor</button>
    </div>
  ),
}));

vi.mock('./ValidationRulesSummary', () => ({
  default: ({ expectedFields, onRemoveField, onRemoveRowPrefix, rulesViewMode, onViewModeChange, canPivot }: any) => (
    <div data-testid="validation-rules-summary">
      <div>{rulesViewMode}</div>
      <div>{String(canPivot)}</div>
      <div>{expectedFields.length}</div>
      <button type="button" onClick={() => onViewModeChange('pivot')}>Pivot view</button>
      <button type="button" onClick={() => onRemoveField(0)}>Remove field</button>
      <button type="button" onClick={() => onRemoveRowPrefix('$.items.0')}>Remove row prefix</button>
    </div>
  ),
}));

vi.mock('./ValidationVerifyPanel', () => ({
  default: ({ expectedFieldCount, assertionCount, verifyScope, onVerifyScopeChange, onValidate, onDismissResult, onEnableUnorderedAndReVerify }: any) => (
    <div data-testid={`verify-panel-${expectedFieldCount}-${assertionCount}`}>
      <div>{verifyScope}</div>
      <button type="button" onClick={() => onVerifyScopeChange('rules')}>Scope rules</button>
      <button type="button" onClick={() => onValidate()}>Run validate</button>
      <button type="button" onClick={() => onDismissResult()}>Dismiss result</button>
      <button type="button" onClick={() => onEnableUnorderedAndReVerify()}>Enable unordered</button>
    </div>
  ),
}));

vi.mock('./ValidationResponsePreview', () => ({
  default: ({ responsePreviewJson, isPending }: any) => (
    <div data-testid="validation-response-preview">{isPending ? `pending:${responsePreviewJson}` : responsePreviewJson}</div>
  ),
}));

vi.mock('../../../shared/components/data-mapper/FetchErrorBanner', () => ({
  default: ({ error }: any) => <div data-testid="fetch-error-banner">{error.message}</div>,
}));

describe('TestEditorValidationTab', () => {
  beforeEach(() => {
    mocks.createValidationAdapter.mockClear();
  });

  it('builds the validation adapter from sample response and selective mode', () => {
    const draft = makeDraft({
      validation: {
        mode: 'selective',
        selectiveMode: 'exclude',
        sampleJson: '{"name":"Ada"}',
        assertions: [],
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({ draft })} />);

    expect(mocks.createValidationAdapter).toHaveBeenCalledWith(expect.objectContaining({
      sampleResponseBody: '{"name":"Ada"}',
      selectiveMode: 'exclude',
      fetchSampleData: undefined,
    }));
  });

  it('imports preset assertions and appends them to the draft', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import preset' }));

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        assertions: [expect.objectContaining({ type: 'custom', description: 'preset' })],
      }),
    }));
  });

  it('adds a menu assertion and closes the add menu', () => {
    const onDraftChange = vi.fn();
    render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Status Code/ }));

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        assertions: [expect.objectContaining({ type: 'status' })],
      }),
    }));
    expect(document.querySelector('.assertions-add-menu')).toBeNull();
  });

  it('opens the regex builder from the add menu and saves the updated assertion', () => {
    const observedDrafts = vi.fn();

    function Wrapper() {
      const [draft, setDraft] = useState(makeDraft());
      const draftRef = useRef(draft);
      draftRef.current = draft;

      return (
        <TestEditorValidationTab
          {...makeProps({
            draft,
            draftRef,
            onDraftChange: (next) => {
              draftRef.current = next;
              setDraft(next);
              observedDrafts(next);
            },
          })}
        />
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Regex Builder/ }));

    expect(screen.getByTestId('regex-builder-modal')).toBeInTheDocument();
    expect(observedDrafts).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        assertions: [expect.objectContaining({ type: 'regex', jsonPath: '', pattern: '' })],
      }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Save regex' }));

    expect(observedDrafts).toHaveBeenLastCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        assertions: [expect.objectContaining({ type: 'regex', jsonPath: '$.name', pattern: '^A' })],
      }),
    }));
  });

  it('updates and removes assertions through the row editor callbacks', () => {
    const onDraftChange = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'none',
        assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '^A' }],
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({ draft, onDraftChange })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Update assertion' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        assertions: [expect.objectContaining({ description: 'updated' })],
      }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove assertion' }));
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      validation: expect.objectContaining({ assertions: [] }),
    }));
  });

  it('formats expected JSON and can switch back to no body validation from the empty warning', () => {
    const onDraftChange = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'full',
        assertions: [],
        expectedJson: '{"b":2,"a":1}',
      } as any,
    });

    const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft, onDraftChange })} />);

    fireEvent.click(screen.getByTitle('Pretty Format JSON'));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        expectedJson: '{\n  "b": 2,\n  "a": 1\n}',
      }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Minify' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({ expectedJson: '{"b":2,"a":1}' }),
    }));

    const emptyDraft = makeDraft({
      validation: {
        mode: 'full',
        assertions: [],
        expectedJson: '   ',
      } as any,
    });
    onDraftChange.mockClear();
    rerender(<TestEditorValidationTab {...makeProps({ draft: emptyDraft, onDraftChange })} />);
    fireEvent.click(screen.getByRole('button', { name: 'No Body Validation' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({ mode: 'none' }),
    }));
  });

  it('renders the assertions-only verify panel and forwards validate and dismiss actions', () => {
    const onValidateResponse = vi.fn();
    const setValidationResult = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'none',
        assertions: [{ type: 'status', expected: '200' }],
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({ draft, onValidateResponse, setValidationResult })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run validate' }));
    expect(onValidateResponse).toHaveBeenCalledWith('assertions');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss result' }));
    expect(setValidationResult).toHaveBeenCalledWith(null);
  });

  it('renders selective mode controls and opens the mapper directly when eligible', () => {
    const onFetchSampleResponse = vi.fn();
    const setFetchHostOverride = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'selective',
        assertions: [],
        expectedFields: [{ jsonPath: '$.items.0.name', expectedType: 'string' }],
        sampleJson: '{"items":[{"name":"Ada"}]}',
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({
      draft,
      onFetchSampleResponse,
      fetchHostEnabled: true,
      fetchHostOverride: '',
      setFetchHostOverride,
      resolvedBaseUrl: 'https://svc.example.com',
      fetchError: { message: 'Request failed' } as any,
    })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fetch Response' }));
    expect(onFetchSampleResponse).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use Settings' }));
    expect(setFetchHostOverride).toHaveBeenCalledWith('https://svc.example.com');

    fireEvent.click(screen.getByRole('button', { name: '⚡ Data Mapper' }));
    expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
    expect(screen.getByTestId('fetch-error-banner')).toHaveTextContent('Request failed');
    expect(screen.getByTestId('validation-response-preview')).toHaveTextContent('{"items":[{"name":"Ada"}]}');
  });

  it('saves mapper output, removes rules, changes scope, and re-validates with unordered arrays enabled', () => {
    const onDraftChange = vi.fn();
    const onValidateResponse = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'selective',
        assertions: [{ type: 'status', expected: '200' }],
        expectedFields: [
          { jsonPath: '$.items.0.name', expectedType: 'string' },
          { jsonPath: '$.items.0.id', expectedType: 'number' },
        ],
        sampleJson: '{"items":[{"name":"Ada","id":1}]}',
        unorderedArrays: false,
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({ draft, onDraftChange, onValidateResponse })} />);

    fireEvent.click(screen.getByRole('button', { name: '⚡ Data Mapper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save mapper' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        selectiveMode: 'exclude',
        excludedPaths: ['$.meta'],
        unorderedArrays: true,
      }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove field' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({
        expectedFields: [{ jsonPath: '$.items.0.id', expectedType: 'number' }],
      }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove row prefix' }));
    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      validation: expect.objectContaining({ expectedFields: [] }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Scope rules' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable unordered' }));
    expect(onValidateResponse).toHaveBeenCalledWith('rules');
  });

  it('handles pending fetched responses and opens the mapper after keeping rules', () => {
    const onFetchKeepRules = vi.fn();
    const onFetchReplaceAll = vi.fn();
    const onFetchCancel = vi.fn();
    const draft = makeDraft({
      validation: {
        mode: 'selective',
        assertions: [],
        expectedFields: [{ jsonPath: '$.name', expectedType: 'string' }],
        sampleJson: '{"name":"old"}',
      } as any,
    });

    const props = makeProps({
      draft,
      pendingFetchResponse: '{"name":"new"}',
      onFetchKeepRules,
      onFetchReplaceAll,
      onFetchCancel,
    });
    const { rerender } = render(<TestEditorValidationTab {...props} />);

    expect(screen.getByTestId('validation-response-preview')).toHaveTextContent('pending:{"name":"new"}');
    fireEvent.click(screen.getByRole('button', { name: 'Keep Rules & Update Response' }));
    expect(onFetchKeepRules).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Replace All' }));
    expect(onFetchReplaceAll).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onFetchCancel).toHaveBeenCalled();

    rerender(<TestEditorValidationTab {...{ ...props, pendingFetchResponse: null }} />);
    expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
  });

  it('renders selective-mode version panels', () => {
    const draft = makeDraft({
      validation: {
        mode: 'selective',
        assertions: [],
        expectedFields: [],
        sampleJson: '{"ok":true}',
      } as any,
    });

    render(<TestEditorValidationTab {...makeProps({ draft })} />);

    expect(screen.getByTestId('response-version-panel')).toBeInTheDocument();
    expect(screen.getByTestId('rules-version-panel')).toBeInTheDocument();
  });
});
