/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../test-utils/customSelectHelper';
import TestEditorValidationTab from './TestEditorValidationTab';
import { makeDraft, makeProps } from './TestEditorValidationTab.test-utils';
import type { Assertion, Scenario } from '../../../shared/types';
import { installEmptyClipboard } from '../../../test-utils/clipboardMock';

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

  describe('Phase 3 — collection assertion types in +Add menu', () => {
    it('shows Array Contains, Each Element, Contains Subset in the add menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      expect(screen.getByText('Array Contains')).toBeInTheDocument();
      expect(screen.getByText('Each Element')).toBeInTheDocument();
      expect(screen.getByText('Contains Subset')).toBeInTheDocument();
    });

    it('adds arrayContains assertion via +Add', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Array Contains'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [{ type: 'arrayContains', jsonPath: '', value: '', mode: 'any' }],
          }),
        }),
      );
    });

    it('adds each assertion via +Add', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Each Element'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [{ type: 'each', jsonPath: '', fieldPath: '', operator: 'greater_than_or_equal', value: '0' }],
          }),
        }),
      );
    });

    it('adds containsSubset assertion via +Add', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Contains Subset'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [{ type: 'containsSubset', jsonPath: '$', expected: '{}' }],
          }),
        }),
      );
    });

    it('renders CONTAINS badge for arrayContains assertion', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayContains', jsonPath: '$.items', value: '1', mode: 'any' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('CONTAINS')).toBeInTheDocument();
    });

    it('renders EACH badge for each assertion', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'each', jsonPath: '$.items', fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('EACH')).toBeInTheDocument();
    });

    it('hides value input on each-element row for operators without a value', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'each', jsonPath: '$.items', fieldPath: 'flag', operator: 'is_true', value: '' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const row = screen.getByText('EACH').closest('.assertion-row')!;
      expect(row.querySelector('input[placeholder="value"]')).toBeNull();
    });

    it('renders SUBSET badge for containsSubset assertion', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'containsSubset', jsonPath: '$', expected: '{}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('SUBSET')).toBeInTheDocument();
    });

    it('renders mode dropdown for arrayContains', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayContains', jsonPath: '$.items', value: '1', mode: 'any' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('CONTAINS').closest('.assertion-row')!;
      expect(getCustomSelectValue(row.querySelector('.cs-wrapper')!)).toBe('any (at least one)');
      selectOption(row.querySelector('.cs-wrapper')!, 'all (every item)');
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('renders operator dropdown for each assertion', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'each', jsonPath: '$.items', fieldPath: 'rank', operator: 'greater_than_or_equal', value: '0' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const row = screen.getByText('EACH').closest('.assertion-row')!;
      expect(getCustomSelectValue(row.querySelector('.cs-wrapper')!)).toBe('>=');
    });

    it('renders JSON textarea for containsSubset', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'containsSubset', jsonPath: '$', expected: '{"status": "ok"}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByDisplayValue('{"status": "ok"}')).toBeInTheDocument();
    });
  });

  describe('custom predicate assertion', () => {
    it('shows Custom Predicate in the +Add menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      expect(screen.getByText('Custom Predicate')).toBeInTheDocument();
      expect(screen.getByTitle('Write an expression that evaluates to truthy/falsy')).toBeInTheDocument();
    });

    it('adds a custom assertion via +Add menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Custom Predicate'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [{ type: 'custom', expression: '', description: '' }],
          }),
        }),
      );
    });

    it('renders custom assertion row with CUSTOM badge', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'custom', expression: '$eq($.status, 200)', description: 'Status OK' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('CUSTOM')).toBeInTheDocument();
    });

    it('renders expression textarea and description input', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'custom', expression: '$gt($.body.age, 18)', description: 'Must be adult' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByDisplayValue('$gt($.body.age, 18)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Must be adult')).toBeInTheDocument();
    });

    it('renders info tooltip with variable reference info', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'custom', expression: '' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const tip = screen.getByTitle(/\$\.body/);
      expect(tip).toBeInTheDocument();
      expect(tip.getAttribute('title')).toContain('$.status');
    });

    it('updates expression when textarea changes', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'custom', expression: '', description: '' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ onDraftChange, draft, draftRef })} />);
      const textarea = screen.getByLabelText('Custom predicate expression');
      fireEvent.change(textarea, { target: { value: '$eq($.status, 200)' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('sets description to undefined when description input is cleared', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'custom', expression: 'true', description: 'note' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByLabelText('Custom predicate description'), { target: { value: '' } });
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'custom', description: undefined });
    });
  });

  describe('body validation radios — selective to none', () => {
    it('switches from selective mode to none', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByLabelText('No Body Validation'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'none' }),
        }),
      );
    });
  });

  describe('assertion negate toggle', () => {
    it('sets negate on status assertion when NOT is clicked', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Negate assertion' }));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'status', negate: true })],
          }),
        }),
      );
    });

    it('clears negate when NOT is clicked again', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200', negate: true }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove negation' }));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'status', negate: undefined })],
          }),
        }),
      );
    });
  });

  describe('jsonSchema assertion row', () => {
    it('adds jsonSchema assertion from + Add menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('JSON Schema'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [{ type: 'jsonSchema', schema: '{}' }],
          }),
        }),
      );
    });

    it('formats schema JSON via Pretty toolbar button', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{"a":1}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Pretty Format JSON'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'jsonSchema' });
      expect((updated.validation.assertions?.[0] as { schema: string }).schema).toContain('\n');
    });

    it('minifies schema JSON via Minify toolbar button', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{\n  "a": 1\n}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Minify JSON (remove whitespace)'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const schema = (updated.validation.assertions?.[0] as { schema: string }).schema;
      expect(schema).not.toContain('\n');
      expect(() => JSON.parse(schema)).not.toThrow();
    });

    it('generates schema from sample response when toolbar button is used', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{"id":1,"name":"x"}',
          assertions: [{ type: 'jsonSchema', schema: '{}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Generate schema from sample response'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      const schema = (updated.validation.assertions?.[0] as { schema: string }).schema;
      expect(() => JSON.parse(schema)).not.toThrow();
      expect(schema).toContain('type');
    });

    it('generates schema from empty object sample using non-strict mode', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{}',
          assertions: [{ type: 'jsonSchema', schema: '{}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Generate schema from sample response'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('shows schema parse error styling and message for invalid JSON', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{not json' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(document.querySelector('.assertion-input-schema--invalid')).toBeInTheDocument();
      expect(document.querySelector('.assertion-schema-error')).toBeInTheDocument();
    });

    it('shows generic invalid label when schema parse throws non-Error', () => {
      const orig = JSON.parse.bind(JSON);
      const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation((text: string, rev?: (k: string, v: unknown) => unknown) => {
        if (text === '{"__throw_string__":1}') throw 'not an error object';
        return orig(text, rev as (key: string, value: unknown) => unknown | undefined);
      });
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{"__throw_string__":1}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(document.querySelector('.assertion-schema-error')).toHaveTextContent('Invalid JSON');
      parseSpy.mockRestore();
    });

    it('pastes schema from clipboard when Paste Schema is clicked', async () => {
      const readText = vi.fn().mockResolvedValue('{"type":"array"}');
      Object.assign(navigator, { clipboard: { readText } });
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{}' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Paste schema from clipboard'));
      await waitFor(() => {
        expect(onDraftChange).toHaveBeenCalled();
      });
      const updated = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      expect((updated.validation.assertions?.[0] as { schema: string }).schema).toBe('{"type":"array"}');
    });

    it('does not call onDraftChange when Paste Schema clicked without clipboard.readText', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'jsonSchema', schema: '{}' }],
        },
      });
      const draftRef = { current: draft };
      const restoreClipboard = installEmptyClipboard();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Paste schema from clipboard'));
      expect(onDraftChange).not.toHaveBeenCalled();
      restoreClipboard();
    });
  });

  describe('bodySize assertion row', () => {
    it('adds bodySize assertion from + Add menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Body Size'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'bodySize', unit: 'kb' })],
          }),
        }),
      );
    });

    it('updates body size operator, value, and unit', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'bodySize', operator: '<=', value: 1024, unit: 'kb' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      expect(screen.getByText('SIZE')).toBeInTheDocument();
      const row = screen.getByText('SIZE').closest('.assertion-row')!;
      selectOption(row.querySelector('.assertion-select--operator')!, 'more than');
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      fireEvent.change(row.querySelector('input[type="number"]')!, { target: { value: '10' } });
      draftRef.current = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      selectOption(row.querySelector('.assertion-select--unit')!, 'MB');
      expect(onDraftChange).toHaveBeenCalled();
      const last = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      expect(last.validation.assertions?.[0]).toMatchObject({ type: 'bodySize', operator: '>', value: 10, unit: 'mb' });
    });

    it('stores zero when body size number input is cleared', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'bodySize', operator: '<=', value: 10, unit: 'kb' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('SIZE').closest('.assertion-row')!;
      fireEvent.change(row.querySelector('input[type="number"]')!, { target: { value: '' } });
      const updated = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      expect(updated.validation.assertions?.[0]).toMatchObject({ type: 'bodySize', value: 0 });
    });
  });

  describe('full mode Pretty Format and Minify', () => {
    it('pretty formats expected JSON', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '{"a":1,"b":2}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Pretty Format JSON'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.expectedJson).toContain('\n');
      expect(JSON.parse(updated.validation.expectedJson!)).toEqual({ a: 1, b: 2 });
    });

    it('minifies expected JSON', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '{\n  "a": 1,\n  "b": 2\n}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Minify JSON (remove whitespace)'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.expectedJson).not.toContain('\n');
      expect(JSON.parse(updated.validation.expectedJson!)).toEqual({ a: 1, b: 2 });
    });

    it('pretty format is no-op for empty expected JSON', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const btn = screen.getByTitle('Pretty Format JSON');
      expect(btn).toBeDisabled();
    });

    it('minify is no-op for empty expected JSON', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const btn = screen.getByTitle('Minify JSON (remove whitespace)');
      expect(btn).toBeDisabled();
    });

    it('pretty format handles invalid JSON gracefully', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '{invalid json}',
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByTitle('Pretty Format JSON'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });
  });

  describe('non-selective mode verify panel', () => {
    it('shows verify panel for full mode with assertions and calls onValidateResponse', () => {
      const onValidateResponse = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'full',
          expectedJson: '{"a":1}',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        onValidateResponse,
      })} />);
      fireEvent.click(screen.getByText('Verify'));
      expect(onValidateResponse).toHaveBeenCalledWith('assertions');
    });

    it('wires fetch host controls in full mode verify panel', () => {
      const setFetchHostEnabled = vi.fn();
      const setFetchHostOverride = vi.fn();
      const setValidationResult = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        setFetchHostEnabled,
        setFetchHostOverride,
        resolvedBaseUrl: 'https://settings.example',
        validationResult: { passed: true, failures: [] },
        setValidationResult,
      })} />);
      fireEvent.click(screen.getByLabelText('Host Override'));
      expect(setFetchHostEnabled).toHaveBeenCalled();
      const hostInput = document.querySelector('.validate-host-input') as HTMLInputElement;
      fireEvent.change(hostInput, { target: { value: 'https://override.test' } });
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://override.test');
      fireEvent.click(screen.getByTitle('Use Settings base URL'));
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://settings.example');
      const dismissBtn = document.querySelector('.validate-result .btn.btn-xs') as HTMLButtonElement;
      fireEvent.click(dismissBtn);
      expect(setValidationResult).toHaveBeenCalledWith(null);
    });
  });

  describe('add menu positioning', () => {
    it('positions add menu below button when there is room', async () => {
      const draft = makeDraft({ validation: { mode: 'none', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      const addBtn = screen.getByText('+ Add');
      vi.spyOn(addBtn, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 130,
        left: 200,
        right: 260,
        width: 60,
        height: 30,
        x: 200,
        y: 100,
        toJSON: () => ({}),
      });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      fireEvent.click(addBtn);
      await waitFor(() => {
        expect(document.querySelector('.assertions-add-menu')).toBeTruthy();
      });
    });

    it('positions add menu above button when near bottom of viewport', async () => {
      const draft = makeDraft({ validation: { mode: 'none', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      const addBtn = screen.getByText('+ Add');
      vi.spyOn(addBtn, 'getBoundingClientRect').mockReturnValue({
        top: 700,
        bottom: 730,
        left: 200,
        right: 260,
        width: 60,
        height: 30,
        x: 200,
        y: 700,
        toJSON: () => ({}),
      });
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      fireEvent.click(addBtn);
      await waitFor(() => {
        const menu = document.querySelector('.assertions-add-menu') as HTMLElement | null;
        expect(menu).toBeTruthy();
        expect(menu?.style.bottom).not.toBe('');
      });
    });
  });

});
