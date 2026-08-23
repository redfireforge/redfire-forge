/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScenarioTags } from './useScenarioTags';
import type { FeatureGroup, TestScenario } from '@shared/types';
import { makeTestScenario as _makeTestScenario } from '@test-utils/factories';

const makeScenario = (overrides: Partial<TestScenario> = {}): TestScenario =>
  _makeTestScenario({ id: 'sc-1', name: 'Test Scenario', tests: [], ...overrides });

function makeFeatureGroup(scenarios: TestScenario[], overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  return {
    id: 'fg-1',
    name: 'Feature Group',
    scenarios,
    ...overrides,
  };
}

describe('useScenarioTags', () => {
  describe('addTag', () => {
    it('adds tag to scenario with no tags', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', 'smoke');
      });
      
      expect(setFgs).toHaveBeenCalled();
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });

    it('adds tag to existing tags array', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['regression'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['regression', 'smoke']);
    });

    it('normalizes tag to lowercase', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', 'SMOKE');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });

    it('deduplicates (no-op if tag already present)', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });

    it('ignores empty tags', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', '   ');
      });
      
      expect(setFgs).not.toHaveBeenCalled();
    });

    it('ignores invalid tags (special chars only)', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'sc-1', '###');
      });
      
      expect(setFgs).not.toHaveBeenCalled();
    });

    it('no-op for non-existent feature group', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('non-existent-fg', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
    });

    it('no-op for non-existent scenario', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.addTag('fg-1', 'non-existent-sc', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
    });
  });

  describe('removeTag', () => {
    it('removes existing tag', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke', 'regression'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.removeTag('fg-1', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['regression']);
    });

    it('no-op for missing tag', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['regression'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.removeTag('fg-1', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['regression']);
    });

    it('sets tags to undefined when last tag removed', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.removeTag('fg-1', 'sc-1', 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
    });

    it('no-op for non-existent feature group', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.removeTag('missing-fg', 'sc-1', 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });

    it('no-op for non-existent scenario', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.removeTag('fg-1', 'missing-sc', 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });
  });

  describe('bulkAddTag', () => {
    it('adds tag to multiple scenarios', () => {
      const sc1 = makeScenario({ id: 'sc-1' });
      const sc2 = makeScenario({ id: 'sc-2' });
      const fg = makeFeatureGroup([sc1, sc2]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.bulkAddTag([
          { fgId: 'fg-1', scId: 'sc-1' },
          { fgId: 'fg-1', scId: 'sc-2' },
        ], 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
      expect(updated[0].scenarios[1].tags).toEqual(['smoke']);
    });

    it('adds tag across multiple feature groups', () => {
      const sc1 = makeScenario({ id: 'sc-1' });
      const sc2 = makeScenario({ id: 'sc-2' });
      const fg1 = makeFeatureGroup([sc1], { id: 'fg-1' });
      const fg2 = makeFeatureGroup([sc2], { id: 'fg-2' });
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg1, fg2], setFgs));
      
      act(() => {
        result.current.bulkAddTag([
          { fgId: 'fg-1', scId: 'sc-1' },
          { fgId: 'fg-2', scId: 'sc-2' },
        ], 'critical');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg1, fg2]);
      expect(updated[0].scenarios[0].tags).toEqual(['critical']);
      expect(updated[1].scenarios[0].tags).toEqual(['critical']);
    });

    it('ignores empty tag in bulk add', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.bulkAddTag([{ fgId: 'fg-1', scId: 'sc-1' }], '  ');
      });
      
      expect(setFgs).not.toHaveBeenCalled();
    });

    it('only adds to targeted scenarios, leaves others unchanged', () => {
      const sc1 = makeScenario({ id: 'sc-1' });
      const sc2 = makeScenario({ id: 'sc-2' });
      const sc3 = makeScenario({ id: 'sc-3', tags: ['existing'] });
      const fg = makeFeatureGroup([sc1, sc2, sc3]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.bulkAddTag([{ fgId: 'fg-1', scId: 'sc-1' }], 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
      expect(updated[0].scenarios[1].tags).toBeUndefined();
      expect(updated[0].scenarios[2].tags).toEqual(['existing']);
    });

    it('deduplicates tags in bulk add (no-op if already present)', () => {
      const sc1 = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const sc2 = makeScenario({ id: 'sc-2' });
      const fg = makeFeatureGroup([sc1, sc2]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.bulkAddTag([
          { fgId: 'fg-1', scId: 'sc-1' },
          { fgId: 'fg-1', scId: 'sc-2' },
        ], 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
      expect(updated[0].scenarios[1].tags).toEqual(['smoke']);
    });
  });

  describe('bulkRemoveTag', () => {
    it('removes tag from multiple scenarios', () => {
      const sc1 = makeScenario({ id: 'sc-1', tags: ['smoke', 'critical'] });
      const sc2 = makeScenario({ id: 'sc-2', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc1, sc2]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.bulkRemoveTag([
          { fgId: 'fg-1', scId: 'sc-1' },
          { fgId: 'fg-1', scId: 'sc-2' },
        ], 'smoke');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['critical']);
      expect(updated[0].scenarios[1].tags).toBeUndefined();
    });

    it('leaves non-targeted scenarios unchanged', () => {
      const sc1 = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const sc2 = makeScenario({ id: 'sc-2', tags: ['smoke', 'keep'] });
      const fg = makeFeatureGroup([sc1, sc2]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.bulkRemoveTag([{ fgId: 'fg-1', scId: 'sc-1' }], 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
      expect(updated[0].scenarios[1].tags).toEqual(['smoke', 'keep']);
    });

    it('keeps remaining tags when removing one of several', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke', 'regression'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.bulkRemoveTag([{ fgId: 'fg-1', scId: 'sc-1' }], 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['regression']);
    });

    it('sets tags undefined when bulk removing last tag from targeted scenario', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.bulkRemoveTag([{ fgId: 'fg-1', scId: 'sc-1' }], 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
    });

    it('leaves targeted scenario unchanged when tag is absent', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['regression'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.bulkRemoveTag([{ fgId: 'fg-1', scId: 'sc-1' }], 'smoke');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['regression']);
    });
  });

  describe('clearTags', () => {
    it('removes all tags from scenario', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke', 'regression', 'critical'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      act(() => {
        result.current.clearTags('fg-1', 'sc-1');
      });
      
      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toBeUndefined();
    });

    it('no-op for non-existent feature group', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.clearTags('missing-fg', 'sc-1');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });

    it('no-op for non-existent scenario', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();

      const { result } = renderHook(() => useScenarioTags([fg], setFgs));

      act(() => {
        result.current.clearTags('fg-1', 'missing-sc');
      });

      const updater = setFgs.mock.calls[0][0];
      const updated = updater([fg]);
      expect(updated[0].scenarios[0].tags).toEqual(['smoke']);
    });
  });

  describe('allTags', () => {
    it('computes all unique tags from feature groups', () => {
      const sc1 = makeScenario({ id: 'sc-1', tags: ['smoke', 'critical'] });
      const sc2 = makeScenario({ id: 'sc-2', tags: ['regression', 'smoke'] });
      const fg = makeFeatureGroup([sc1, sc2]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      expect(result.current.allTags).toEqual(['critical', 'regression', 'smoke']);
    });

    it('returns empty array when no tags', () => {
      const sc = makeScenario({ id: 'sc-1' });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      expect(result.current.allTags).toEqual([]);
    });
  });

  describe('tagCounts', () => {
    it('counts scenarios per tag', () => {
      const sc1 = makeScenario({ id: 'sc-1', tags: ['smoke', 'critical'] });
      const sc2 = makeScenario({ id: 'sc-2', tags: ['smoke', 'regression'] });
      const sc3 = makeScenario({ id: 'sc-3', tags: ['smoke'] });
      const fg = makeFeatureGroup([sc1, sc2, sc3]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      expect(result.current.tagCounts).toEqual({
        smoke: 3,
        critical: 1,
        regression: 1,
      });
    });
  });

  describe('tagSuggestions', () => {
    it('merges built-in tags with existing tags, sorted', () => {
      const sc = makeScenario({ id: 'sc-1', tags: ['my-custom-tag', 'smoke'] });
      const fg = makeFeatureGroup([sc]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      expect(result.current.tagSuggestions).toContain('smoke');
      expect(result.current.tagSuggestions).toContain('regression');
      expect(result.current.tagSuggestions).toContain('critical');
      expect(result.current.tagSuggestions).toContain('my-custom-tag');
      expect(result.current.tagSuggestions).toEqual([...result.current.tagSuggestions].sort());
    });

    it('includes all built-in tags even when no scenarios', () => {
      const fg = makeFeatureGroup([]);
      const setFgs = vi.fn();
      
      const { result } = renderHook(() => useScenarioTags([fg], setFgs));
      
      expect(result.current.tagSuggestions).toContain('smoke');
      expect(result.current.tagSuggestions).toContain('regression');
      expect(result.current.tagSuggestions).toContain('critical');
      expect(result.current.tagSuggestions).toContain('e2e');
    });
  });
});
