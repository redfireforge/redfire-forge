/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { FeatureGroup, Scenario } from '@shared/types';
import { useSharedDataSourceHandlers } from './useSharedDataSourceHandlers';

function makeFg(): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'FG',
    scenarios: [{ id: 'sc-1', name: 'SC', tests: [] }],
  } as unknown as FeatureGroup;
}

describe('useSharedDataSourceHandlers coverage gaps', () => {
  it('returns undefined currentEditingDraft when editingTest is set but draft is null', () => {
    const { result } = renderHook(() =>
      useSharedDataSourceHandlers({
        featureGroups: [makeFg()],
        setFeatureGroups: vi.fn(),
        setSharedDataSources: vi.fn(),
        editingTest: { featureId: 'fg-1', scenarioId: 'sc-1', testId: 't-1' },
        draft: null,
        setDraft: vi.fn(),
        setEditingTest: vi.fn(),
        setInputMode: vi.fn(),
        setActiveTab: vi.fn(),
      }),
    );
    expect(result.current.currentEditingDraft).toBeUndefined();
  });

  it('returns undefined currentEditingDraft when editingTest is null even with draft', () => {
    const draft = {
      id: 't-1',
      name: 'Draft',
      url: '',
      method: 'GET',
      headers: [],
      body: '',
      auth: { type: 'none' },
      validation: { mode: 'none' },
    } as Scenario;

    const { result } = renderHook(() =>
      useSharedDataSourceHandlers({
        featureGroups: [makeFg()],
        setFeatureGroups: vi.fn(),
        setSharedDataSources: vi.fn(),
        editingTest: null,
        draft,
        setDraft: vi.fn(),
        setEditingTest: vi.fn(),
        setInputMode: vi.fn(),
        setActiveTab: vi.fn(),
      }),
    );
    expect(result.current.currentEditingDraft).toBeUndefined();
  });
});
