/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import TestEditorValidationTab from './TestEditorValidationTab';
import { makeDraft, makeProps } from './TestEditorValidationTab.test-utils';
import type { Assertion, Scenario } from '@shared/types';

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

  describe('validation rules table view', () => {
    const arrayDraft = makeDraft({
      validation: {
        mode: 'selective',
        assertions: [],
        expectedFields: [
          { jsonPath: '$.offers[0].associatedOfferingCode', expectedValue: '"AAA"' },
          { jsonPath: '$.offers[0].offerName', expectedValue: '"Alpha"' },
          { jsonPath: '$.offers[1].associatedOfferingCode', expectedValue: '"BBB"' },
          { jsonPath: '$.offers[1].offerName', expectedValue: '"Beta"' },
        ],
      },
    });

    it('shows List/Table toggle when rules contain array entries', () => {
      render(<TestEditorValidationTab {...makeProps({ draft: arrayDraft, draftRef: { current: arrayDraft } })} />);
      expect(screen.getByRole('tab', { name: 'List' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Table' })).toBeInTheDocument();
    });

    it('hides List/Table toggle when there are no array rules', () => {
      const flatDraft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft: flatDraft, draftRef: { current: flatDraft } })} />);
      expect(screen.queryByRole('tab', { name: 'Table' })).not.toBeInTheDocument();
    });

    it('renders flat list view by default', () => {
      render(<TestEditorValidationTab {...makeProps({ draft: arrayDraft, draftRef: { current: arrayDraft } })} />);
      expect(screen.getByText('$.offers[0].associatedOfferingCode')).toBeInTheDocument();
      expect(screen.getByText('$.offers[1].offerName')).toBeInTheDocument();
    });

    it('renders pivot table with field columns and indexed rows when Table is selected', () => {
      render(<TestEditorValidationTab {...makeProps({ draft: arrayDraft, draftRef: { current: arrayDraft } })} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));

      expect(screen.getByRole('columnheader', { name: 'associatedOfferingCode' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'offerName' })).toBeInTheDocument();
      expect(screen.getByText('#0')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('AAA')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('BBB')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('List tab remains selectable when rules pivot mode can be toggled', () => {
      render(<TestEditorValidationTab {...makeProps({ draft: arrayDraft, draftRef: { current: arrayDraft } })} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      fireEvent.click(screen.getByRole('tab', { name: 'List' }));
      expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('$.offers[0].associatedOfferingCode')).toBeInTheDocument();
    });

    it('removes a single rule from list view', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({
        draft: arrayDraft,
        draftRef: { current: arrayDraft },
        onDraftChange,
      })} />);
      const removeBtn = screen.getByRole('button', { name: 'Remove $.offers[1].offerName' });
      fireEvent.click(removeBtn);
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.expectedFields).toHaveLength(3);
      expect(updated.validation.expectedFields?.find((f) => f.jsonPath === '$.offers[1].offerName')).toBeUndefined();
    });

    it('removes all rules for the row when remove is clicked in pivot view', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({
        draft: arrayDraft,
        draftRef: { current: arrayDraft },
        onDraftChange,
      })} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
      const removeBtn = screen.getByRole('button', { name: 'Remove $.offers[1]' });
      fireEvent.click(removeBtn);
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.expectedFields).toHaveLength(2);
      expect(updated.validation.expectedFields?.every((f) => !f.jsonPath.startsWith('$.offers[1]'))).toBe(true);
    });
  });

  describe('typeCheck assertion row', () => {
    it('adds a typeCheck assertion from + Add menu', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft();
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Type Check'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'typeCheck', expectedType: 'string' });
    });

    it('renders TYPE badge and type selector', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'typeCheck', jsonPath: '$.price', expectedType: 'number' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('TYPE')).toBeInTheDocument();
      const row = screen.getByText('TYPE').closest('.assertion-row')!;
      expect(getCustomSelectValue(row.querySelector('.cs-wrapper')!)).toBe('number');
    });

    it('updates typeCheck jsonPath', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'typeCheck', jsonPath: '$.a', expectedType: 'string' }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.price'), { target: { value: '$.name' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates typeCheck expectedType', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'typeCheck', jsonPath: '$.a', expectedType: 'string' }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('TYPE').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'array');
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const assertion = updated.validation.assertions?.[0];
      expect(assertion).toMatchObject({ type: 'typeCheck', expectedType: 'array' });
    });

    it('picks jsonPath from JsonPathPicker for typeCheck', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'typeCheck', jsonPath: '', expectedType: 'string' }],
          sampleJson: '{"age":25}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.age')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.age'));
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('existence assertion row', () => {
    it('adds an existence assertion from + Add menu', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft();
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Field Exists'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'existence', expectExists: true });
    });

    it('renders EXISTS badge and exists/not_exists selector', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'existence', jsonPath: '$.id', expectExists: true }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('EXISTS')).toBeInTheDocument();
      const row = screen.getByText('EXISTS').closest('.assertion-row')!;
      expect(getCustomSelectValue(row.querySelector('.cs-wrapper')!)).toBe('exists');
    });

    it('updates existence jsonPath', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'existence', jsonPath: '$.old', expectExists: true }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.metadata.tags'), { target: { value: '$.new' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('toggles from exists to does not exist', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'existence', jsonPath: '$.id', expectExists: true }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('EXISTS').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'does not exist');
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const assertion = updated.validation.assertions?.[0];
      expect(assertion).toMatchObject({ type: 'existence', expectExists: false });
    });

    it('picks jsonPath from JsonPathPicker for existence', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'existence', jsonPath: '', expectExists: true }],
          sampleJson: '{"tags":["a"]}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.tags')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.tags'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('toggles existence back from does not exist to exists', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'existence', jsonPath: '$.id', expectExists: false }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('EXISTS').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'exists');
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'existence', expectExists: true });
    });

    it('updates typeCheck expectedType to boolean, object, and null', () => {
      const types = ['boolean', 'object', 'null'] as const;
      for (const expectedType of types) {
        const onDraftChange = vi.fn();
        const draft = makeDraft({
          validation: {
            mode: 'none',
            assertions: [{ type: 'typeCheck', jsonPath: '$.x', expectedType: 'string' }],
            sampleJson: '{}',
          },
        });
        const draftRef = { current: draft };
        const { unmount } = render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
        const row = screen.getByText('TYPE').closest('.assertion-row')!;
        selectOption(row.querySelector('.cs-wrapper')!, expectedType);
        expect(onDraftChange).toHaveBeenCalled();
        const next = onDraftChange.mock.calls[0][0] as Scenario;
        expect(next.validation.assertions?.[0]).toMatchObject({ type: 'typeCheck', expectedType });
        unmount();
      }
    });
  });

  describe('validation order mismatch hint', () => {
    it('shows ordering hint and enables unordered matching then re-verifies', () => {
      const onDraftChange = vi.fn();
      const onValidateResponse = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          unorderedArrays: false,
          assertions: [],
          expectedFields: [{ jsonPath: '$.items[0].id', expectedValue: '"1"' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [
            {
              path: '$.items[0].id',
              expected: '"1"',
              actual: '2 (matched by code=AAA at [1])',
            },
          ],
          httpStatus: 200,
        },
        onDraftChange,
        onValidateResponse,
      })} />);

      expect(screen.getByText(/array ordering mismatches/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Enable unordered matching/i }));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ unorderedArrays: true }),
        }),
      );
      expect(onValidateResponse).toHaveBeenCalled();
    });

    it('does not show ordering hint when unorderedArrays already enabled', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          unorderedArrays: true,
          assertions: [],
          expectedFields: [{ jsonPath: '$.items[0].id', expectedValue: '"1"' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [
            {
              path: '$.items[0].id',
              expected: '"1"',
              actual: 'x (matched by y=z at [2])',
            },
          ],
        },
      })} />);
      expect(screen.queryByText(/array ordering mismatches/i)).not.toBeInTheDocument();
    });

    it('does not show ordering hint when a failure lacks matched-by wording', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          unorderedArrays: false,
          assertions: [],
          expectedFields: [{ jsonPath: '$.items[0].id', expectedValue: '"1"' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [
            { path: '$.items[0].id', expected: '"1"', actual: 'plain mismatch' },
          ],
        },
      })} />);
      expect(screen.queryByText(/array ordering mismatches/i)).not.toBeInTheDocument();
    });
  });

  describe('header assertion regex operator', () => {
    it('renders value input for regex and updates pattern', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'etag', operator: 'regex', value: '^v[0-9]+$' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      expect(screen.getByPlaceholderText('Expected value')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Expected value'), { target: { value: '^abc$' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('switches header operator to regex from equals', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x', operator: 'equals', value: 'y' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('HEADER').closest('.assertion-row')!;
      selectOption(row.querySelector('.cs-wrapper')!, 'regex');
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

});
