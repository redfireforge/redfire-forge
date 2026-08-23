/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationVersionHandlers } from './useValidationVersionHandlers';
import type { Scenario } from '@shared/types';
import { makeScenario as _makeScenario } from '@test-utils/factories';

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    validation: {
      mode: 'selective',
      selectiveMode: 'include',
      sampleJson: '{"id":1}',
      expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
      assertions: [{ type: 'status', expected: '200' }],
      responseVersions: [],
      rulesVersions: [],
    },
    ...overrides,
  }) as Scenario;
}

describe('useValidationVersionHandlers', () => {
  let draft: Scenario;
  let draftRef: { current: Scenario };
  let onDraftChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    draft = makeDraft();
    draftRef = { current: draft };
    onDraftChange = vi.fn((next: Scenario) => {
      draft = next;
      draftRef.current = next;
    });
  });

  function renderHandlers() {
    return renderHook(() =>
      useValidationVersionHandlers({ draftRef, onDraftChange }),
    );
  }

  describe('response versions', () => {
    it('saves a response version when sample JSON is present', () => {
      const { result } = renderHandlers();
      act(() => result.current.handleSaveResponseVersion());
      expect(onDraftChange).toHaveBeenCalledTimes(1);
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.responseVersions).toHaveLength(1);
      expect(next.validation.responseVersions![0].json).toBe('{"id":1}');
    });

    it('skips save when sample JSON is blank', () => {
      draftRef.current = makeDraft({ validation: { mode: 'none', sampleJson: '   ' } });
      const { result } = renderHandlers();
      act(() => result.current.handleSaveResponseVersion());
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('restores a response version snapshot', () => {
      const { result } = renderHandlers();
      act(() =>
        result.current.handleRestoreResponseVersion({
          json: '{"restored":true}',
          validationMode: 'full',
          selectiveMode: 'exclude',
          expectedFields: [{ jsonPath: '$.x', expectedValue: 'y' }],
          excludedPaths: ['$.skip'],
          unorderedArrays: true,
        }),
      );
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.sampleJson).toBe('{"restored":true}');
      expect(next.validation.mode).toBe('full');
      expect(next.validation.selectiveMode).toBe('exclude');
      expect(next.validation.expectedFields).toEqual([{ jsonPath: '$.x', expectedValue: 'y' }]);
      expect(next.validation.excludedPaths).toEqual(['$.skip']);
      expect(next.validation.unorderedArrays).toBe(true);
    });

    it('falls back to previous validation fields when restore omits optional values', () => {
      draftRef.current = makeDraft({
        validation: {
          mode: 'selective',
          selectiveMode: 'include',
          sampleJson: '{}',
          excludedPaths: ['$.keep'],
          unorderedArrays: false,
        },
      });
      const { result } = renderHandlers();
      act(() => result.current.handleRestoreResponseVersion({ json: '{"a":1}' }));
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.mode).toBe('selective');
      expect(next.validation.selectiveMode).toBe('include');
      expect(next.validation.expectedFields).toEqual([]);
      expect(next.validation.excludedPaths).toEqual(['$.keep']);
      expect(next.validation.unorderedArrays).toBe(false);
    });

    it('deletes and renames response versions', () => {
      draftRef.current = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{}',
          responseVersions: [
            { id: 'rv-1', timestamp: 1, json: '{}', validationMode: 'none', expectedFields: [] },
            { id: 'rv-2', timestamp: 2, json: '{}', validationMode: 'none', expectedFields: [] },
          ],
        },
      });
      const { result } = renderHandlers();
      act(() => result.current.handleDeleteResponseVersion('rv-1'));
      let next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.responseVersions).toHaveLength(1);
      expect(next.validation.responseVersions![0].id).toBe('rv-2');

      act(() => result.current.handleRenameResponseVersion('rv-2', 'Renamed'));
      next = onDraftChange.mock.calls[1][0] as Scenario;
      expect(next.validation.responseVersions![0].label).toBe('Renamed');
    });

    it('deletes response versions when none exist yet', () => {
      draftRef.current = makeDraft({ validation: { mode: 'none', sampleJson: '{}' } });
      const { result } = renderHandlers();
      act(() => result.current.handleDeleteResponseVersion('missing'));
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.responseVersions).toEqual([]);
    });

    it('leaves other response versions unchanged when renaming unknown id', () => {
      draftRef.current = makeDraft({
        validation: {
          mode: 'none',
          sampleJson: '{}',
          responseVersions: [
            { id: 'rv-1', timestamp: 1, json: '{}', validationMode: 'none', expectedFields: [], label: 'Keep' },
          ],
        },
      });
      const { result } = renderHandlers();
      act(() => result.current.handleRenameResponseVersion('missing', 'Nope'));
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.responseVersions![0].label).toBe('Keep');
    });
  });

  describe('rules versions', () => {
    it('saves a rules version when validation config exists', () => {
      const { result } = renderHandlers();
      act(() => result.current.handleSaveRulesVersion());
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.rulesVersions).toHaveLength(1);
      expect(next.validation.rulesVersions![0].validationMode).toBe('selective');
    });

    it('skips rules save when validation config is empty', () => {
      draftRef.current = makeDraft({ validation: { mode: 'none' } });
      const { result } = renderHandlers();
      act(() => result.current.handleSaveRulesVersion());
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('restores a rules version snapshot', () => {
      const { result } = renderHandlers();
      act(() =>
        result.current.handleRestoreRulesVersion({
          validationMode: 'full',
          selectiveMode: 'exclude',
          expectedFields: [{ jsonPath: '$.name', expectedValue: 'x' }],
          excludedPaths: ['$.tmp'],
          unorderedArrays: true,
          assertions: [{ type: 'status', expected: '201' }],
        }),
      );
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.mode).toBe('full');
      expect(next.validation.assertions).toEqual([{ type: 'status', expected: '201' }]);
    });

    it('preserves existing assertions when restore omits them', () => {
      const { result } = renderHandlers();
      act(() =>
        result.current.handleRestoreRulesVersion({
          validationMode: 'selective',
          expectedFields: [],
        }),
      );
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.assertions).toEqual([{ type: 'status', expected: '200' }]);
    });

    it('deletes and renames rules versions', () => {
      draftRef.current = makeDraft({
        validation: {
          mode: 'selective',
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
          rulesVersions: [
            { id: 'rule-1', timestamp: 1, validationMode: 'selective', expectedFields: [] },
            { id: 'rule-2', timestamp: 2, validationMode: 'selective', expectedFields: [] },
          ],
        },
      });
      const { result } = renderHandlers();
      act(() => result.current.handleDeleteRulesVersion('rule-1'));
      let next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.rulesVersions).toHaveLength(1);

      act(() => result.current.handleRenameRulesVersion('rule-2', 'Rules v2'));
      next = onDraftChange.mock.calls[1][0] as Scenario;
      expect(next.validation.rulesVersions![0].label).toBe('Rules v2');
    });

    it('deletes rules versions when none exist yet', () => {
      draftRef.current = makeDraft({ validation: { mode: 'selective', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      const { result } = renderHandlers();
      act(() => result.current.handleDeleteRulesVersion('missing'));
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.rulesVersions).toEqual([]);
    });

    it('restore rules keeps excludedPaths from snapshot when provided', () => {
      const { result } = renderHandlers();
      act(() =>
        result.current.handleRestoreRulesVersion({
          excludedPaths: ['$.only'],
        }),
      );
      const next = onDraftChange.mock.calls[0][0] as Scenario;
      expect(next.validation.excludedPaths).toEqual(['$.only']);
    });
  });
});
