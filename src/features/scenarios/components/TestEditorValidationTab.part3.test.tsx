/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  describe('regex / array / numeric assertion rows', () => {
    it('updates regex jsonPath and pattern', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.a', pattern: 'old' }],
          sampleJson: '{"id":1}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.path'), { target: { value: '$.b' } });
      fireEvent.change(screen.getByPlaceholderText('pattern'), { target: { value: 'newpat' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for regex assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '', pattern: '' }],
          sampleJson: '{"foo":true}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const pickBtns = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(pickBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('$.foo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.foo'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates arrayLength path, operator, and compare value', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '$.a', operator: '>=', value: 1 }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.items'), { target: { value: '$.items[*]' } });
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const opSel = selects.find((s) => s.className.includes('assertion-select-operator'))!;
      fireEvent.change(opSel, { target: { value: '=' } });
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '3' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates numeric path, operator, and value', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '$.p', operator: '=', value: 0 }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.price'), { target: { value: '$.qty' } });
      const opSel = screen.getByDisplayValue('equals (=)');
      fireEvent.change(opSel, { target: { value: '>' } });
      fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '42.5' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for arrayLength assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 }],
          sampleJson: '{"items":[1,2]}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.items')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.items'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for numeric assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '', operator: '=', value: 0 }],
          sampleJson: '{"price":9}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.price')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.price'));
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('date assertion JsonPathPicker', () => {
    it('updates date jsonPath when picking from sample', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
          sampleJson: '{"expires":"2026-01-01"}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const pickBtns = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(pickBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('$.expires')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.expires'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates date jsonPath via text input', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.a', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.expiresAt'), { target: { value: '$.b' } });
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('date reference kind switch from fixed to today', () => {
    it('sets today reference with default utc when switching from fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'today');
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [
              expect.objectContaining({
                reference: { kind: 'today', timezone: 'utc' },
              }),
            ],
          }),
        })
      );
    });
  });

  describe('full body validation mode', () => {
    it('updates expected JSON textarea', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '{}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      const ta = screen.getByPlaceholderText(/Paste the complete expected JSON/);
      fireEvent.change(ta, { target: { value: '{"x":1}' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ expectedJson: '{"x":1}' }),
        })
      );
    });

    it('switches to none via warning link when expected JSON empty', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'No Body Validation' }));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'none' }),
        })
      );
    });

    it('does not show empty-json warning when expectedJson has content', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '{}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.queryByText(/No expected JSON provided/)).not.toBeInTheDocument();
    });
  });

  describe('selective mode verify and fetch', () => {
    it('calls onFetchSampleResponse when Fetch Response clicked', () => {
      const onFetchSampleResponse = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onFetchSampleResponse })} />);
      fireEvent.click(screen.getByText('Fetch Response'));
      expect(onFetchSampleResponse).toHaveBeenCalled();
    });

    it('calls onValidateResponse when Verify clicked', () => {
      const onValidateResponse = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onValidateResponse })} />);
      fireEvent.click(screen.getByText('Verify'));
      expect(onValidateResponse).toHaveBeenCalled();
    });

    it('shows Validating… while validating', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, validating: true })} />);
      expect(screen.getByText('Validating...')).toBeInTheDocument();
    });

    it('updates host override from verify row and uses Use Settings', () => {
      const setFetchHostOverride = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        setFetchHostOverride,
        resolvedBaseUrl: 'https://settings.example',
      })} />);
      const verifyRowInputs = document.querySelectorAll('.validate-host-input');
      expect(verifyRowInputs.length).toBe(1);
      fireEvent.change(verifyRowInputs[0], { target: { value: 'https://override.test' } });
      expect(setFetchHostOverride).toHaveBeenCalled();
      const useSettingsInValidate = screen.getAllByTitle('Use Settings base URL').pop()!;
      fireEvent.click(useSettingsInValidate);
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://settings.example');
    });
  });

  describe('validation result copy and edge cases', () => {
    it('uses singular discrepancy when one failure', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: false, failures: [{ path: '$.a', expected: '1', actual: '2' }] },
      })} />);
      expect(screen.getByText('1 discrepancy found')).toBeInTheDocument();
    });

    it('uses plural discrepancies when multiple failures', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [
            { path: '$.a', expected: '1', actual: '2' },
            { path: '$.b', expected: 'x', actual: 'y' },
          ],
        },
      })} />);
      expect(screen.getByText('2 discrepancies found')).toBeInTheDocument();
    });

    it('does not render failure table when failed with zero failures', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: false, failures: [] },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Path' })).not.toBeInTheDocument();
    });
  });

  describe('pending fetch cancel', () => {
    it('calls onFetchCancel', () => {
      const onFetchCancel = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel,
      })} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onFetchCancel).toHaveBeenCalled();
    });
  });

  describe('version panel early returns', () => {
    it('does not append response version when sample JSON is empty', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], sampleJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('does not append rules version when there are no expected fields', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });
  });

  describe('AssertionPresetMenu import', () => {
    it('imports assertions when a preset card is chosen', async () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('📋 Presets'));
      await waitFor(() => {
        expect(screen.getByText('API Health Check')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('API Health Check'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: expect.arrayContaining([expect.objectContaining({ type: 'status' })]),
          }),
        })
      );
    });
  });

  describe('rules rename callback', () => {
    it('maps rules version label on rename', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          rulesVersions: [{
            id: 'rv1',
            timestamp: 1,
            validationMode: 'selective',
            expectedFields: [],
            excludedPaths: [],
          }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.rulesVersions?.[0].label).toBe('renamed-rule');
    });
  });

  describe('selective mode radio', () => {
    it('switches to selective body validation', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByLabelText('Selective Fields'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'selective' }),
        })
      );
    });
  });

});
