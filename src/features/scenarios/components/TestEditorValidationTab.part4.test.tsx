/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { selectOption } from '../../../test-utils/customSelectHelper';
import TestEditorValidationTab from './TestEditorValidationTab';
import { makeDraft, makeProps } from './TestEditorValidationTab.test-utils';
import { Assertion, Scenario } from '@shared/types';

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

  describe('branch coverage — optional fallbacks and edge handlers', () => {
    it('does not close add menu on mousedown inside the menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      const inside = screen.getByText('Status Code');
      fireEvent.mouseDown(inside);
      expect(screen.getByText('Regex Builder…')).toBeInTheDocument();
    });

    it('uses [] when validation.assertions is undefined for list and regex modal index', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'none', assertions: undefined },
      });
      const draftRef = { current: draft };
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Status Code'));
      const afterAdd = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      draftRef.current = afterAdd;
      rerender(<TestEditorValidationTab {...makeProps({ draft: afterAdd, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Builder…'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      const noAssert = makeDraft({ validation: { mode: 'none', assertions: undefined } });
      draftRef.current = noAssert;
      rerender(<TestEditorValidationTab {...makeProps({ draft: noAssert, draftRef, onDraftChange })} />);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });

    it('coerces empty responseTime input to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'none', assertions: [{ type: 'responseTime', maxMs: 500 }] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ maxMs: 0 })],
          }),
        })
      );
    });

    it('uses empty string for header value when property is missing', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x', operator: 'contains' } as import('../../../shared/types').Assertion],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const val = screen.getByPlaceholderText('Expected value');
      fireEvent.change(val, { target: { value: 'y' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('uses sampleJson fallback and coerces empty arrayLength compare to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '$.a', operator: '>=', value: 2 }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ value: 0 })],
          }),
        })
      );
    });

    it('uses sampleJson fallback for numeric row and coerces empty numeric value to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '$.p', operator: '=', value: 1 }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ value: 0 })],
          }),
        })
      );
    });

    it('preserves timezone when kind select stays on today', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      selectOption(row.querySelectorAll('.cs-wrapper')[1]!, 'today');
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ reference: { kind: 'today', timezone: 'utc' } })],
          }),
        })
      );
    });

    it('preserves fixed iso when kind select stays on fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'fixed', iso: '2026-03-15' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const row = screen.getByText('DATE').closest('.assertion-row')!;
      selectOption(row.querySelectorAll('.cs-wrapper')[1]!, 'fixed date');
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ reference: { kind: 'fixed', iso: '2026-03-15' } })],
          }),
        })
      );
    });

    it('uses Enter base URL placeholder when resolvedBaseUrl is empty (fetch and verify rows)', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        resolvedBaseUrl: '',
        fetchHostEnabled: true,
      })} />);
      const placeholders = screen.getAllByPlaceholderText('Enter base URL');
      expect(placeholders.length).toBeGreaterThanOrEqual(2);
    });

    it('shows existing rule count 0 when expectedFields is undefined in pending fetch bar', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/existing rule\(s\)/)).toHaveTextContent('0');
    });

    it('restores response version with omitted optional fields', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-restore-partial'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            sampleJson: '{"partial":true}',
            expectedFields: [],
          }),
        })
      );
    });

    it('deletes response version when responseVersions is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          responseVersions: [{ id: 'v1', json: '{}', timestamp: 1 }],
        },
      });
      const draftRef = { current: draft as Scenario };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      draftRef.current = {
        ...draft,
        validation: { ...draft.validation, responseVersions: undefined },
      };
      fireEvent.click(screen.getByTestId('resp-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ responseVersions: [] }),
        })
      );
    });

    it('renames one response version without altering others', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          responseVersions: [
            { id: 'v1', json: '{}', timestamp: 1 },
            { id: 'v2', json: '{"a":1}', timestamp: 2 },
          ],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.responseVersions).toEqual([
        { id: 'v1', json: '{}', timestamp: 1, label: 'renamed' },
        { id: 'v2', json: '{"a":1}', timestamp: 2 },
      ]);
    });

    it('does not save rules version when expectedFields is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('restores rules with only validationMode set', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.keep', expectedValue: '1' }],
          excludedPaths: ['$.x'],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-restore-partial'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            mode: 'selective',
            expectedFields: [],
            excludedPaths: ['$.x'],
          }),
        })
      );
    });

    it('deletes rules version when rulesVersions is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], rulesVersions: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ rulesVersions: [] }),
        })
      );
    });

    it('renames one rules version without altering others', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          rulesVersions: [
            { id: 'rv1', timestamp: 1, validationMode: 'selective', expectedFields: [], excludedPaths: [] },
            { id: 'rv2', timestamp: 2, validationMode: 'selective', expectedFields: [], excludedPaths: [] },
          ],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.rulesVersions?.[0].label).toBe('renamed-rule');
      expect(updated.validation.rulesVersions?.[1].label).toBeUndefined();
    });
  });

});
