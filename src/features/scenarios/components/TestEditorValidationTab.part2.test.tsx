/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent} from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
import TestEditorValidationTab from './TestEditorValidationTab';
import { makeDraft, makeProps } from './TestEditorValidationTab.test-utils';
import type { Assertion, Scenario } from '../../../shared/types';

vi.mock('../../requests/components/ResponseVersionPanel', () => ({
  default: ({ onSaveVersion, onRestore, onDeleteVersion, onRenameVersion, versions }: {
    onSaveVersion: () => void;
    onRestore: (v: unknown) => void;
    onDeleteVersion: (id: string) => void;
    onRenameVersion: (id: string, label: string) => void;
    versions: unknown[];
  }) => (
    <div data-testid="response-version-panel">
      <button data-testid="resp-save" onClick={onSaveVersion}>Save Version</button>
      <button data-testid="resp-restore" onClick={() => onRestore({ json: '{}', validationMode: 'selective', selectiveMode: 'include', expectedFields: [], excludedPaths: [] })}>Restore</button>
      <button type="button" data-testid="resp-restore-partial" onClick={() => onRestore({ json: '{"partial":true}' })}>Restore Partial</button>
      {versions.length > 0 && <button data-testid="resp-delete" onClick={() => onDeleteVersion('v1')}>Delete</button>}
      <button data-testid="resp-rename" onClick={() => onRenameVersion('v1', 'renamed')}>Rename</button>
    </div>
  ),
}));
vi.mock('../../requests/components/RulesVersionPanel', () => ({
  default: ({ onSaveVersion, onRestore, onDeleteVersion, onRenameVersion }: {
    onSaveVersion: () => void;
    onRestore: (v: unknown) => void;
    onDeleteVersion: (id: string) => void;
    onRenameVersion: (id: string, label: string) => void;
  }) => (
    <div data-testid="rules-version-panel">
      <button data-testid="rules-save" onClick={onSaveVersion}>Save Rules Version</button>
      <button data-testid="rules-restore" onClick={() => onRestore({ validationMode: 'full', selectiveMode: 'include', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }], excludedPaths: [] })}>Restore Rules</button>
      <button type="button" data-testid="rules-restore-partial" onClick={() => onRestore({ validationMode: 'selective' })}>Restore Rules Partial</button>
      <button data-testid="rules-delete" onClick={() => onDeleteVersion('rv1')}>Delete Rules</button>
      <button data-testid="rules-rename" onClick={() => onRenameVersion('rv1', 'renamed-rule')}>Rename Rules</button>
    </div>
  ),
}));
vi.mock('../../../shared/components/data-mapper', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../shared/components/data-mapper');
  return {
    ...actual,
    DataMapperModal: ({ onCancel, onSave, unorderedArrays }: {
      onCancel: () => void;
      onSave: (output: {
        selectiveMode: string;
        expectedFields: { jsonPath: string; expectedValue: string }[];
        excludedPaths: string[];
        assertions?: Assertion[];
      }, options?: { unorderedArrays?: boolean }) => void;
      unorderedArrays?: boolean;
    }) => (
      <div data-testid="data-mapper-modal">
        <button onClick={onCancel}>Close Mapper Modal</button>
        <button data-testid="mapper-save" onClick={() => onSave(
          { selectiveMode: 'include', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }], excludedPaths: [] },
          { unorderedArrays: true }
        )}>Save Mapper</button>
        <button data-testid="mapper-save-ordered" onClick={() => onSave(
          { selectiveMode: 'include', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }], excludedPaths: [] },
          { unorderedArrays: false }
        )}>Save Mapper Ordered</button>
        <button data-testid="mapper-save-no-options" onClick={() => onSave(
          { selectiveMode: 'include', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }], excludedPaths: [] },
        )}>Save Mapper Default Options</button>
        <button data-testid="mapper-save-with-assertions" onClick={() => onSave(
          {
            selectiveMode: 'include',
            expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
            excludedPaths: [],
            assertions: [{ type: 'status', expected: '201' }],
          },
          { unorderedArrays: false },
        )}>Save Mapper With Assertions</button>
        <span data-testid="mapper-unordered-prop">{unorderedArrays ? 'true' : 'false'}</span>
      </div>
    ),
    RegexAssertionBuilderModal: ({ onCancel, onSave }: { onCancel: () => void; onSave: (result: { jsonPath: string; pattern: string }) => void }) => (
      <div data-testid="regex-assertion-modal">
        <button onClick={onCancel}>Close Regex Modal</button>
        <button data-testid="apply-regex" onClick={() => onSave({ jsonPath: '$.name', pattern: '^[A-Z]+$' })}>Apply Regex</button>
      </div>
    ),
  };
});

describe('TestEditorValidationTab', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('unordered arrays checkbox', () => {
    it('toggles unordered array mode', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      const checkbox = screen.getByRole('checkbox', { name: /Unordered array matching/i });
      fireEvent.click(checkbox);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ unorderedArrays: true }),
        })
      );
    });

    it('persists unorderedArrays when saved via DataMapper modal', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', sampleJson: '{"a":1}', assertions: [] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);

      fireEvent.click(screen.getByText('⚡ Data Mapper'));
      expect(screen.getByTestId('data-mapper-modal')).toBeTruthy();

      fireEvent.click(screen.getByTestId('mapper-save'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ unorderedArrays: true }),
        })
      );
    });

    it('passes saved unorderedArrays back to DataMapper modal on reopen', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', sampleJson: '{"a":1}', unorderedArrays: true, assertions: [] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);

      fireEvent.click(screen.getByText('⚡ Data Mapper'));
      expect(screen.getByTestId('mapper-unordered-prop').textContent).toBe('true');
    });

    it('preserves draft unorderedArrays when mapper save is called without options argument', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', sampleJson: '{"a":1}', unorderedArrays: false, assertions: [] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('⚡ Data Mapper'));
      fireEvent.click(screen.getByTestId('mapper-save-no-options'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ unorderedArrays: false }),
        }),
      );
    });

    it('replaces assertions when mapper save output includes assertions', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          sampleJson: '{"a":1}',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('⚡ Data Mapper'));
      fireEvent.click(screen.getByTestId('mapper-save-with-assertions'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'status', expected: '201' });
    });

    it('closes Data Mapper via modal cancel without saving', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', sampleJson: '{"a":1}', assertions: [] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      fireEvent.click(screen.getByText('⚡ Data Mapper'));
      expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Mapper Modal'));
      expect(screen.queryByTestId('data-mapper-modal')).not.toBeInTheDocument();
    });

    it('shows checkbox checked when unorderedArrays is true in draft', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', unorderedArrays: true, assertions: [] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);

      const checkbox = screen.getByRole('checkbox', { name: /Unordered array matching/i }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('date assertion interactions', () => {
    it('changes date reference kind to fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'fixed date');
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes timezone for today reference', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      const tzWrapper = row.querySelectorAll('.cs-wrapper')[1]!;
      selectOption(tzWrapper, 'Local');
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes fixed date value', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const dateInput = screen.getByDisplayValue('2026-01-01');
      fireEvent.change(dateInput, { target: { value: '2026-06-15' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes date comparison operator', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const opSelect = screen.getByDisplayValue('after (>)');
      fireEvent.change(opSelect, { target: { value: '<' } });
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('validation result display', () => {
    it('shows PASSED badge', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: true, failures: [], httpStatus: 200 },
      })} />);
      expect(screen.getByText('PASSED')).toBeInTheDocument();
      expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    });

    it('shows FAILED badge with failure table', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [{ path: '$.a', expected: '1', actual: '2' }],
          httpStatus: 200,
        },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getAllByText('$.a').length).toBeGreaterThanOrEqual(1);
    });

    it('dismisses validation result on × click', () => {
      const setValidationResult = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      const { container } = render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
        setValidationResult,
      })} />);
      const closeBtn = container.querySelector('.validate-result-header .btn.btn-xs') as HTMLElement;
      fireEvent.click(closeBtn);
      expect(setValidationResult).toHaveBeenCalledWith(null);
    });
  });

  describe('pending fetch response bar', () => {
    it('shows confirmation bar when pendingFetchResponse is set', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"new":"data"}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/existing rule/)).toBeInTheDocument();
    });

    it('calls onFetchKeepRules', () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"x":1}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText(/Keep Rules/));
      expect(onFetchKeepRules).toHaveBeenCalled();
    });

    it('calls onFetchReplaceAll', () => {
      const onFetchReplaceAll = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"x":1}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll,
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText(/Replace All/));
      expect(onFetchReplaceAll).toHaveBeenCalled();
    });
  });

  describe('version panel callbacks', () => {
    it('saves response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], sampleJson: '{"data":true}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-save'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.responseVersions?.length).toBeGreaterThan(0);
    });

    it('restores a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-restore'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ sampleJson: '{}' }),
      }));
    });

    it('deletes a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], responseVersions: [{ id: 'v1', json: '{}', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ responseVersions: [] }),
      }));
    });

    it('renames a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], responseVersions: [{ id: 'v1', json: '{}', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-rename'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('saves rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('restores rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-restore'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ mode: 'full', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] }),
      }));
    });

    it('deletes rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], rulesVersions: [{ id: 'rv1', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-delete'));
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('regex modal apply', () => {
    it('applies regex from modal', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '', pattern: '' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      // Open regex builder
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      // Apply regex
      fireEvent.click(screen.getByTestId('apply-regex'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('renders modal with empty path when index targets a non-regex assertion after rerender', () => {
      const draftRegex = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.a', pattern: 'x' }],
        },
      });
      const draftRef = { current: draftRegex };
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft: draftRegex, draftRef })} />);
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      const draftStatus = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      draftRef.current = draftStatus;
      rerender(<TestEditorValidationTab {...makeProps({ draft: draftStatus, draftRef })} />);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('apply-regex'));
    });
  });

  describe('add assertion menu edge cases', () => {
    it('closes the add menu when clicking outside', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      expect(screen.getByText('Regex Builder…')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText('Regex Builder…')).not.toBeInTheDocument();
    });

    it('adds quick Regex Match assertion from menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Match'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' })],
          }),
        })
      );
    });
  });

  describe('header assertion row', () => {
    it('updates header name and expected value when operator is contains', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x-h', operator: 'contains', value: 'v' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('Header name'), { target: { value: 'content-type' } });
      fireEvent.change(screen.getByPlaceholderText('Expected value'), { target: { value: 'json' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('does not render value input when operator is exists', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x-h', operator: 'exists' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });

    it('hides value field after changing operator to exists (parent sync)', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'h', operator: 'contains', value: 'v' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('HEADER').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'exists');
      const next = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      draftRef.current = next;
      rerender(<TestEditorValidationTab {...makeProps({ draft: next, draftRef, onDraftChange })} />);
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });
  });

});
