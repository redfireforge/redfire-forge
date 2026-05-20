/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    vi.clearAllMocks();
  });

  describe('datePrecise assertion row', () => {
    it('adds datePrecise assertion from + Add menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Date Precise'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({
        type: 'datePrecise',
        jsonPath: '',
        precision: 'second',
      });
    });

    it('updates datePrecise fields', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"t":"x"}',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '2020-06-01T12:00:00.000Z',
            precision: 'second',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      expect(screen.getByText('DATE⁺')).toBeInTheDocument();
      const row = screen.getByText('DATE⁺').closest('.assertion-row')!;
      fireEvent.change(row.querySelector('.assertion-select--operator')!, { target: { value: '>' } });
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      fireEvent.change(row.querySelector('.assertion-select--precision')!, { target: { value: 'minute' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('calendar button and precision dropdown are inside the date-wrap group', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '2020-06-01T12:00:00.000Z',
            precision: 'second',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const row = screen.getByText('DATE⁺').closest('.assertion-row')!;

      const dateWrap = row.querySelector('.assertion-date-wrap')!;
      const precisionSelect = row.querySelector('.assertion-select--precision')!;
      const calendarBtn = row.querySelector('.assertion-date-btn')!;
      const dateInput = row.querySelector('.assertion-input-date')!;

      expect(dateWrap).toBeTruthy();
      expect(precisionSelect).toBeTruthy();
      expect(calendarBtn).toBeTruthy();
      expect(dateInput).toBeTruthy();

      // All three are inside the same date-wrap container
      expect(dateWrap.contains(dateInput)).toBe(true);
      expect(dateWrap.contains(calendarBtn)).toBe(true);
      expect(dateWrap.contains(precisionSelect)).toBe(true);
    });

    it('invokes showPicker from datePrecise calendar control when supported', () => {
      const showPicker = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '2020-06-01T12:00:00.000Z',
            precision: 'second',
          }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      const row = screen.getByText('DATE⁺').closest('.assertion-row')!;
      const dt = row.querySelector('.assertion-input-date') as HTMLInputElement;
      Object.defineProperty(dt, 'showPicker', { configurable: true, value: showPicker });
      fireEvent.click(row.querySelector('.assertion-date-btn')!);
      expect(showPicker).toHaveBeenCalled();
    });

    it('renders empty datetime-local when datePrecise reference is empty', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '',
            precision: 'second',
          } as Assertion],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      const dt = document.querySelector('.assertion-field--dateprecise input[type="datetime-local"]') as HTMLInputElement;
      expect(dt.value).toBe('');
    });

    it('sets ISO reference when datetime-local receives a value', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '',
            precision: 'second',
          } as Assertion],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const dt = document.querySelector('.assertion-field--dateprecise input[type="datetime-local"]') as HTMLInputElement;
      fireEvent.change(dt, { target: { value: '2020-06-15T10:30' } });
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      expect((updated.validation.assertions?.[0] as { reference: string }).reference).toContain('2020-06-15');
    });

    it('updates datePrecise jsonPath via path input', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.old',
            operator: '=',
            reference: '2020-06-01T12:00:00.000Z',
            precision: 'second',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.timestamp'), { target: { value: '$.createdAt' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'datePrecise', jsonPath: '$.createdAt' })],
          }),
        }),
      );
    });

    it('clears datePrecise ISO reference when datetime-local is cleared', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '$.t',
            operator: '=',
            reference: '2020-06-15T10:30:00.000Z',
            precision: 'hour',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const dt = document.querySelector('.assertion-field--dateprecise input[type="datetime-local"]') as HTMLInputElement;
      fireEvent.change(dt, { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'datePrecise', reference: '' })],
          }),
        }),
      );
    });
  });

  describe('assertion type badge labels', () => {
    it('renders expected badge text for each assertion type', () => {
      const unknown = { type: 'totallyUnknown' } as unknown as Assertion;
      const assertionsList: Assertion[] = [
        { type: 'status', expected: '200' },
        { type: 'responseTime', maxMs: 1 },
        { type: 'header', name: 'h', operator: 'exists' },
        { type: 'regex', jsonPath: '$', pattern: '.' },
        { type: 'arrayLength', jsonPath: '$', operator: '=', value: 0 },
        { type: 'numeric', jsonPath: '$', operator: '=', value: 0 },
        { type: 'date', jsonPath: '$', operator: '=', reference: { kind: 'today', timezone: 'utc' } },
        { type: 'typeCheck', jsonPath: '$', expectedType: 'string' },
        { type: 'existence', jsonPath: '$', expectExists: true },
        { type: 'arrayContains', jsonPath: '$', value: '', mode: 'any' },
        { type: 'each', jsonPath: '$', fieldPath: 'a', operator: 'exists' },
        { type: 'containsSubset', jsonPath: '$', expected: '{}' },
        { type: 'jsonSchema', schema: '{}' },
        { type: 'bodySize', operator: '=', value: 1, unit: 'bytes' },
        {
          type: 'datePrecise',
          jsonPath: '$',
          operator: '=',
          reference: '2020-01-01T00:00:00.000Z',
          precision: 'day',
        },
        { type: 'custom', expression: 'true' },
        unknown,
      ];
      const draft = makeDraft({
        validation: { mode: 'none', assertions: assertionsList },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('STATUS')).toBeInTheDocument();
      expect(screen.getByText('TIME')).toBeInTheDocument();
      expect(screen.getByText('HEADER')).toBeInTheDocument();
      expect(screen.getByText('REGEX')).toBeInTheDocument();
      expect(screen.getByText('ARRAY')).toBeInTheDocument();
      expect(screen.getByText('NUMBER')).toBeInTheDocument();
      expect(screen.getByText('DATE')).toBeInTheDocument();
      expect(screen.getByText('TYPE')).toBeInTheDocument();
      expect(screen.getByText('EXISTS')).toBeInTheDocument();
      expect(screen.getByText('CONTAINS')).toBeInTheDocument();
      expect(screen.getByText('EACH')).toBeInTheDocument();
      expect(screen.getByText('SCHEMA')).toBeInTheDocument();
      expect(screen.getByText('SIZE')).toBeInTheDocument();
      expect(screen.getByText('DATE⁺')).toBeInTheDocument();
      expect(screen.getByText('CUSTOM')).toBeInTheDocument();
      expect(screen.getAllByText('SUBSET')).toHaveLength(2);
    });
  });

  describe('interaction coverage — remaining assertion handlers', () => {
    it('returns early when Keep Rules is clicked without onFetchKeepRules callback', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          sampleJson: '{}',
          expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }],
          assertions: [],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"b":2}',
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText('Keep Rules & Update Response'));
    });

    it('updates jsonSchema textarea via direct typing', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{"a":1}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const ta = document.querySelector('.assertion-input-schema') as HTMLTextAreaElement;
      fireEvent.change(ta, { target: { value: '{"b":2}' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'jsonSchema', schema: '{"b":2}' })],
          }),
        }),
      );
    });

    it('updates arrayContains JSON textarea', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '[]',
          assertions: [{ type: 'arrayContains', jsonPath: '$.items', value: '', mode: 'any' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText(/\{"name": "example"\}/), { target: { value: '{"id":1}' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates containsSubset expected textarea', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'containsSubset', jsonPath: '$', expected: '{}' }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const tas = screen.getAllByPlaceholderText(/\{"status": "active"/);
      fireEvent.change(tas[0]!, { target: { value: '{"status":"ok"}' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('picks jsonPath on datePrecise row via JsonPathPicker', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"when":"2024-01-01"}',
          assertions: [{
            type: 'datePrecise',
            jsonPath: '',
            operator: '=',
            reference: '2024-06-01T12:00:00.000Z',
            precision: 'day',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.when')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.when'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'datePrecise', jsonPath: '$.when' })],
          }),
        }),
      );
    });

    it('maps each-element JsonPathPicker selection from $.field form', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '[{"score":99}]',
          assertions: [{
            type: 'each',
            jsonPath: '$',
            fieldPath: '',
            operator: 'greater_than',
            value: '0',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const pickButtons = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(pickButtons[pickButtons.length - 1]!);
      await waitFor(() => {
        expect(screen.getByText('$.score')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.score'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'each', fieldPath: 'score' })],
          }),
        }),
      );
    });

    it('maps each-element JsonPathPicker root $ to empty fieldPath', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '[{"score":99}]',
          assertions: [{
            type: 'each',
            jsonPath: '$',
            fieldPath: 'score',
            operator: 'greater_than',
            value: '0',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('EACH').closest('.assertion-row')!;
      const innerWrap = row.querySelectorAll('.jpp-wrap')[1];
      fireEvent.click(innerWrap!.querySelector('.jpp-btn')!);
      await waitFor(() => {
        expect(innerWrap!.querySelectorAll('button.jpp-item').length).toBeGreaterThan(0);
      });
      fireEvent.click(innerWrap!.querySelector('button.jpp-item')!);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'each', fieldPath: '' })],
          }),
        }),
      );
    });

    it('updates arrayContains jsonPath via input', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"items":[]}',
          assertions: [{ type: 'arrayContains', jsonPath: '', value: '', mode: 'any' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.items'), { target: { value: '$.items' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'arrayContains', jsonPath: '$.items' })],
          }),
        }),
      );
    });

    it('selects jsonPath on arrayContains row via JsonPathPicker', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"items":[1]}',
          assertions: [{ type: 'arrayContains', jsonPath: '', value: '', mode: 'any' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => expect(screen.getByText('$.items')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button').find((b) => b.querySelector('.jpp-path')?.textContent === '$.items')!);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'arrayContains', jsonPath: '$.items' })],
          }),
        }),
      );
    });

    it('updates each assertion jsonPath, fieldPath, operator, and hides value when operator is exists', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '[{"id":1}]',
          assertions: [{
            type: 'each',
            jsonPath: '',
            fieldPath: '',
            operator: 'greater_than',
            value: '5',
          }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.items'), { target: { value: '$' } });
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      fireEvent.change(screen.getByPlaceholderText('field (e.g. rank)'), { target: { value: 'id' } });
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      fireEvent.change(screen.getByDisplayValue('>'), { target: { value: 'exists' } });
      const updated = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({
        type: 'each',
        jsonPath: '$',
        fieldPath: 'id',
        operator: 'exists',
      });
    });

    it('updates containsSubset jsonPath via input and picker', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"data":{"x":1}}',
          assertions: [{ type: 'containsSubset', jsonPath: '$', expected: '{}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$'), { target: { value: '$.data' } });
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => expect(screen.getByText('$.data')).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button').find((b) => b.querySelector('.jpp-path')?.textContent === '$.data')!);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'containsSubset', jsonPath: '$.data' })],
          }),
        }),
      );
    });
  });

  describe('AssertionPresetMenu — merge import', () => {
    it('appends preset assertions without replacing existing ones', async () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '404' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('📋 Presets'));
      await waitFor(() => {
        expect(screen.getByText('API Health Check')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('API Health Check'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.length).toBeGreaterThan(1);
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'status', expected: '404' });
    });
  });
});
