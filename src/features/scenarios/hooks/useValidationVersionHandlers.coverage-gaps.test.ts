/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useValidationVersionHandlers } from './useValidationVersionHandlers';
import type { Scenario } from '../../../shared/types';
import { makeScenario as _makeScenario } from '../../../test-utils/factories';

describe('useValidationVersionHandlers coverage gaps', () => {
  let draftRef: { current: Scenario };
  let onDraftChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const draft = _makeScenario({
      validation: {
        mode: 'selective',
        selectiveMode: 'include',
        sampleJson: '{"id":1}',
        expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        unorderedArrays: true,
        responseVersions: [
          { id: 'rv-0', timestamp: 0, json: '{}', validationMode: 'none', expectedFields: [] },
        ],
        rulesVersions: [
          { id: 'rule-0', timestamp: 0, validationMode: 'selective', expectedFields: [], label: 'Original' },
        ],
      },
    }) as Scenario;
    draftRef = { current: draft };
    onDraftChange = vi.fn((next: Scenario) => {
      draftRef.current = next;
    });
  });

  function renderHandlers() {
    return renderHook(() =>
      useValidationVersionHandlers({ draftRef, onDraftChange }),
    );
  }

  it('appends to existing response version history', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleSaveResponseVersion());
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.responseVersions).toHaveLength(2);
  });

  it('uses previous mode when restored response omits validationMode', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreResponseVersion({ json: '{"x":1}' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.mode).toBe('selective');
    expect(next.validation.selectiveMode).toBe('include');
  });

  it('honors explicit unorderedArrays=false on rules restore', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreRulesVersion({ unorderedArrays: false }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.unorderedArrays).toBe(false);
  });

  it('keeps rules label when renaming unknown id', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRenameRulesVersion('missing', 'Ignored'));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.rulesVersions![0].label).toBe('Original');
  });

  it('restore response uses empty excludedPaths when snapshot and draft omit them', () => {
    draftRef.current = _makeScenario({
      validation: { mode: 'none', sampleJson: '{}' },
    }) as Scenario;
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreResponseVersion({ json: '{"y":2}' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.excludedPaths).toEqual([]);
  });

  it('restore response keeps prior unorderedArrays when snapshot omits flag', () => {
    draftRef.current = _makeScenario({
      validation: { mode: 'none', sampleJson: '{}', unorderedArrays: true },
    }) as Scenario;
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreResponseVersion({ json: '{"z":3}' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.unorderedArrays).toBe(true);
  });

  it('appends to existing rules version history', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleSaveRulesVersion());
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.rulesVersions).toHaveLength(2);
  });

  it('restore rules keeps selectiveMode when snapshot omits it', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreRulesVersion({ validationMode: 'full' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.selectiveMode).toBe('include');
  });

  it('falls back when restored selectiveMode is empty string', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreRulesVersion({ selectiveMode: '' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.selectiveMode).toBe('include');
  });

  it('falls back when restored response validationMode is empty string', () => {
    const { result } = renderHandlers();
    act(() => result.current.handleRestoreResponseVersion({ json: '{}', validationMode: '' }));
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.mode).toBe('selective');
  });

  it('creates first response version when history is undefined', () => {
    draftRef.current = _makeScenario({
      validation: { mode: 'none', sampleJson: '{"a":1}' },
    }) as Scenario;
    const { result } = renderHandlers();
    act(() => result.current.handleSaveResponseVersion());
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.responseVersions).toHaveLength(1);
  });

  it('creates first rules version when history is undefined', () => {
    draftRef.current = _makeScenario({
      validation: {
        mode: 'selective',
        expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
      },
    }) as Scenario;
    const { result } = renderHandlers();
    act(() => result.current.handleSaveRulesVersion());
    const next = onDraftChange.mock.calls[0][0] as Scenario;
    expect(next.validation.rulesVersions).toHaveLength(1);
  });
});
