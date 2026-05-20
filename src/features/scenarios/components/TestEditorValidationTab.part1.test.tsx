/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TestEditorValidationTab from './TestEditorValidationTab';
import { createRef } from 'react';
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
    vi.clearAllMocks();
  });

  describe('assertions section', () => {
    it('renders assertions title and preset menu button', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByText('Assertions')).toBeInTheDocument();
      expect(screen.getByText('📋 Presets')).toBeInTheDocument();
    });

    it('shows the + Add button', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByText('+ Add')).toBeInTheDocument();
    });

    it('toggles assertions section collapsed state', () => {
      const draft = makeDraft({
        validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      fireEvent.click(screen.getByTitle('Collapse assertions'));
      expect(screen.getByTitle('Expand assertions')).toBeInTheDocument();
    });

    it('closes add menu when Escape pressed in filter input', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.keyDown(screen.getByPlaceholderText('Filter assertions…'), { key: 'Escape' });
      expect(screen.queryByText('Status Code')).not.toBeInTheDocument();
    });

    it('shows no matching assertions when filter matches nothing', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.change(screen.getByPlaceholderText('Filter assertions…'), { target: { value: 'zzznomatchzzz' } });
      expect(screen.getByText('No matching assertions')).toBeInTheDocument();
    });

    it('opens Regex Builder modal when Regex Builder menu item is clicked', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Builder…'));
      expect(onDraftChange).toHaveBeenCalled();
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });

    it('renders verify panel when expected fields exist but assertions key is absent', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      delete (draft.validation as { assertions?: Assertion[] }).assertions;
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    });

    it('opens and closes the add-type menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      const addBtn = screen.getByText('+ Add');
      fireEvent.click(addBtn);
      expect(screen.getByText('Status Code')).toBeInTheDocument();
      expect(screen.getByText('Response Time SLA')).toBeInTheDocument();
      expect(screen.getByText('Response Header')).toBeInTheDocument();
      expect(screen.getByText('Regex Match')).toBeInTheDocument();
      expect(screen.getByText('Array Length')).toBeInTheDocument();
      expect(screen.getByText('Numeric Compare')).toBeInTheDocument();
      expect(screen.getByText('Date Compare')).toBeInTheDocument();
    });

    it('calls onDraftChange when adding a status assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Status Code'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'status', expected: '200' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a responseTime assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Response Time SLA'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'responseTime', maxMs: 500 })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a header assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Response Header'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'header' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding an arrayLength assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Array Length'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'arrayLength', operator: '>=' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a numeric assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Numeric Compare'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'numeric' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a date assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Date Compare'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'date' })],
          }),
        })
      );
    });

    it('renders existing assertions', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [
            { type: 'status', expected: '201' },
            { type: 'responseTime', maxMs: 300 },
          ],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('STATUS')).toBeInTheDocument();
      expect(screen.getByText('TIME')).toBeInTheDocument();
    });

    it('removes assertion when × button clicked', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const removeBtn = screen.getAllByTitle('Remove assertion')[0];
      fireEvent.click(removeBtn);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ assertions: [] }),
        })
      );
    });

    it('updates status assertion value on change', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const input = screen.getByDisplayValue('200');
      fireEvent.change(input, { target: { value: '201' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates responseTime assertion value on change', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'responseTime', maxMs: 500 }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('opens regex builder modal when Builder button clicked', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const builderBtn = screen.getByText('Builder');
      fireEvent.click(builderBtn);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });

    it('closes regex modal on close', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Regex Modal'));
      expect(screen.queryByTestId('regex-assertion-modal')).not.toBeInTheDocument();
    });

    it('adds regex assertion and opens builder via menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Builder…'));
      expect(onDraftChange).toHaveBeenCalled();
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });
  });

  describe('body validation mode', () => {
    it('renders all three validation mode radio buttons', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByLabelText('No Body Validation')).toBeInTheDocument();
      expect(screen.getByLabelText('Full JSON Match')).toBeInTheDocument();
      expect(screen.getByLabelText('Selective Fields')).toBeInTheDocument();
    });

    it('defaults to none mode — no JSON textarea shown', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.queryByPlaceholderText(/Paste the complete expected JSON/)).not.toBeInTheDocument();
    });

    it('shows textarea when full mode selected', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByPlaceholderText(/Paste the complete expected JSON/)).toBeInTheDocument();
    });

    it('shows warning when full mode has no expected JSON', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText(/No expected JSON provided/)).toBeInTheDocument();
    });

    it('calls onDraftChange when mode radio changes', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      const fullRadio = screen.getByLabelText('Full JSON Match');
      fireEvent.click(fullRadio);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'full' }),
        })
      );
    });

    it('shows selective-mode UI elements when in selective mode', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText('Fetch Response')).toBeInTheDocument();
      expect(screen.getByText('⚡ Data Mapper')).toBeInTheDocument();
    });

    it('shows fetching state on Fetch Response button', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, fetchingResponse: true })} />);
      expect(screen.getByText('Fetching...')).toBeInTheDocument();
    });

    it('shows fetch error when present', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, fetchError: { message: 'Network error' } })} />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows current sample response preview when sampleJson exists', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          sampleJson: '{"id":1}',
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText('Current sample response')).toBeInTheDocument();
      expect(screen.getByLabelText('Current sample response')).toHaveValue('{"id":1}');
    });

    describe('response search box', () => {
      const sampleJson = JSON.stringify({
        offers: [
          { code: 'AAA', name: 'Alpha' },
          { code: 'BBB', name: 'Beta' },
          { code: 'AAA', name: 'Echo' },
        ],
      }, null, 2);

      function renderWithSample() {
        const draft = makeDraft({
          validation: { mode: 'selective', assertions: [], sampleJson },
        });
        return render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      }

      it('shows the search box when a sample response is present', () => {
        renderWithSample();
        expect(screen.getByPlaceholderText('Search response…')).toBeInTheDocument();
      });

      it('shows match count when search term has matches (no auto-jump)', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'AAA' } });
        expect(screen.getByText('2 matches')).toBeInTheDocument();
      });

      it('shows singular match label when exactly one match exists', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'Echo' } });
        expect(screen.getByText('1 match')).toBeInTheDocument();
      });

      it('shows "No matches" when search term has no matches', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'NOTFOUND' } });
        expect(screen.getByText('No matches')).toBeInTheDocument();
      });

      it('navigates with Previous after Next advances active match index', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'AAA' } });
        fireEvent.click(screen.getByLabelText('Next match'));
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Next match'));
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Previous match'));
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });

      it('wraps around when navigating past last match', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'AAA' } });
        fireEvent.click(screen.getByLabelText('Next match'));
        fireEvent.click(screen.getByLabelText('Next match'));
        fireEvent.click(screen.getByLabelText('Next match'));
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });

      it('clears search with the clear button', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'AAA' } });
        expect(input.value).toBe('AAA');
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(input.value).toBe('');
        expect(screen.queryByText(/\/ \d+/)).not.toBeInTheDocument();
      });

      it('navigates to first match on Enter key', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'AAA' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });

      it('does not steal focus while typing', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…') as HTMLInputElement;
        input.focus();
        expect(document.activeElement).toBe(input);
        fireEvent.change(input, { target: { value: 'A' } });
        expect(document.activeElement).toBe(input);
        fireEvent.change(input, { target: { value: 'AA' } });
        expect(document.activeElement).toBe(input);
        fireEvent.change(input, { target: { value: 'AAA' } });
        expect(document.activeElement).toBe(input);
      });

      it('clears search on Escape key', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'AAA' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(input.value).toBe('');
      });

      it('disables nav buttons when there are no matches', () => {
        renderWithSample();
        const input = screen.getByPlaceholderText('Search response…');
        fireEvent.change(input, { target: { value: 'NOTFOUND' } });
        expect(screen.getByLabelText('Next match')).toBeDisabled();
        expect(screen.getByLabelText('Previous match')).toBeDisabled();
      });

      it('does not show the search box when there is no sample response', () => {
        const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
        render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
        expect(screen.queryByPlaceholderText('Search response…')).not.toBeInTheDocument();
      });
    });

    it('shows pending fetch confirmation when pendingFetchResponse is set', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/New response fetched/)).toBeInTheDocument();
      expect(screen.getByText('Keep Rules & Update Response')).toBeInTheDocument();
      expect(screen.getByText('Replace All')).toBeInTheDocument();
      expect(screen.getByText('Fetched response (pending apply)')).toBeInTheDocument();
      expect(screen.getByLabelText('Fetched response preview')).toHaveValue('{"id":2}');
    });

    it('calls onFetchKeepRules when "Keep Rules" clicked', () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective', assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText('Keep Rules & Update Response'));
      expect(onFetchKeepRules).toHaveBeenCalled();
    });

    it('opens Data Mapper after keep-rules response is applied', async () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          sampleJson: '{"id":1}',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      const draftRef = createRef<Scenario>() as React.MutableRefObject<Scenario>;
      draftRef.current = draft;
      const { rerender } = render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef,
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);

      fireEvent.click(screen.getByText('Keep Rules & Update Response'));
      expect(onFetchKeepRules).toHaveBeenCalledTimes(1);

      const updatedDraft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          sampleJson: '{"id":2}',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '2' }],
        },
      });
      draftRef.current = updatedDraft;
      rerender(<TestEditorValidationTab {...makeProps({
        draft: updatedDraft,
        draftRef,
        pendingFetchResponse: null,
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);

      await waitFor(() => {
        expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
      });
    });

    it('does not open Data Mapper after keep-rules when sample JSON is empty', async () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          sampleJson: '{"id":1}',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      const draftRef = createRef<Scenario>() as React.MutableRefObject<Scenario>;
      draftRef.current = draft;
      const { rerender } = render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef,
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);

      fireEvent.click(screen.getByText('Keep Rules & Update Response'));

      const updatedDraft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          sampleJson: '',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '2' }],
        },
      });
      draftRef.current = updatedDraft;
      rerender(<TestEditorValidationTab {...makeProps({
        draft: updatedDraft,
        draftRef,
        pendingFetchResponse: null,
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);

      await waitFor(() => {
        expect(screen.queryByTestId('data-mapper-modal')).not.toBeInTheDocument();
      });
    });

    it('calls onFetchReplaceAll when "Replace All" clicked', () => {
      const onFetchReplaceAll = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective', assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll,
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText('Replace All'));
      expect(onFetchReplaceAll).toHaveBeenCalled();
    });
  });

  describe('validation result display', () => {
    it('shows passed validation result', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
      })} />);
      expect(screen.getByText('PASSED')).toBeInTheDocument();
    });

    it('shows failed validation result with failure table', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [{ path: '$.id', expected: '1', actual: '2' }],
        },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getAllByText('$.id').length).toBeGreaterThanOrEqual(1);
    });

    it('closes validation result on × click', () => {
      const setValidationResult = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      const { container } = render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
        setValidationResult,
      })} />);
      const closeBtn = container.querySelector('.validate-result-header .btn.btn-xs') as HTMLElement;
      fireEvent.click(closeBtn);
      expect(setValidationResult).toHaveBeenCalledWith(null);
    });
  });

  describe('host override controls', () => {
    it('updates fetch-row host override input and uses first-row Use Settings', () => {
      const setFetchHostOverride = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      const inputs = () => screen.getAllByPlaceholderText('https://api.example.com');
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        setFetchHostOverride,
        resolvedBaseUrl: 'https://api.example.com',
      })} />);
      expect(inputs()).toHaveLength(1);
      fireEvent.change(inputs()[0], { target: { value: 'https://row-one.test' } });
      expect(setFetchHostOverride).toHaveBeenCalled();
      const useFirst = screen.getAllByTitle('Use Settings base URL')[0]!;
      fireEvent.click(useFirst);
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://api.example.com');
    });

    it('toggles Host Override from validate row when rules exist', () => {
      const setFetchHostEnabled = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        setFetchHostEnabled,
      })} />);
      const hostToggles = screen.getAllByRole('checkbox', { name: /Host Override/i });
      expect(hostToggles.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(hostToggles[hostToggles.length - 1]!);
      expect(setFetchHostEnabled).toHaveBeenCalled();
    });

    it('shows host override input in selective mode', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText('Host Override')).toBeInTheDocument();
    });

    it('shows "Use Settings" button when host override enabled and resolvedBaseUrl present', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        resolvedBaseUrl: 'https://api.example.com',
      })} />);
      const useSettingsBtn = screen.getAllByTitle('Use Settings base URL');
      expect(useSettingsBtn.length).toBeGreaterThan(0);
    });

    it('calls setFetchHostEnabled on checkbox change', () => {
      const setFetchHostEnabled = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        setFetchHostEnabled,
      })} />);
      // The "Host Override" label is a checkbox-label element; find it by label text
      const checkboxes = screen.getAllByRole('checkbox');
      // First is unordered-arrays, second is the Host Override toggle
      fireEvent.click(checkboxes[1]);
      expect(setFetchHostEnabled).toHaveBeenCalled();
    });
  });

  describe('date assertion controls', () => {
    it('renders date assertion with today/fixed selector', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('DATE')).toBeInTheDocument();
      expect(screen.getByDisplayValue('today')).toBeInTheDocument();
    });

    it('renders fixed date picker when reference kind is fixed', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    });

    it('invokes showPicker from date assertion calendar control when supported', () => {
      const showPicker = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      const dateInput = row.querySelector('input[type="date"]') as HTMLInputElement;
      Object.defineProperty(dateInput, 'showPicker', { configurable: true, value: showPicker });
      fireEvent.click(screen.getByTitle('Pick date'));
      expect(showPicker).toHaveBeenCalled();
    });
  });

});
