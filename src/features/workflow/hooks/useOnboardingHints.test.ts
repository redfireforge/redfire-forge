/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingHints, loadDismissedHints } from './useOnboardingHints';
import { ONBOARDING_HINTS, ONBOARDING_STORAGE_KEY } from '../data/onboardingHints';

describe('useOnboardingHints', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadDismissedHints', () => {
    it('returns empty set when nothing stored', () => {
      const result = loadDismissedHints();
      expect(result.size).toBe(0);
    });

    it('returns set from stored JSON array', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(['hint-1', 'hint-2']));
      const result = loadDismissedHints();
      expect(result.has('hint-1')).toBe(true);
      expect(result.has('hint-2')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('returns empty set for invalid JSON', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'not-json');
      const result = loadDismissedHints();
      expect(result.size).toBe(0);
    });
  });

  describe('hook behavior', () => {
    it('initializes with no active hint', () => {
      const { result } = renderHook(() => useOnboardingHints());
      expect(result.current.activeHint).toBeNull();
    });

    it('showHint sets activeHint for valid hint ID', () => {
      const { result } = renderHook(() => useOnboardingHints());
      const firstHint = ONBOARDING_HINTS[0];

      act(() => {
        result.current.showHint(firstHint.id);
      });

      expect(result.current.activeHint).toEqual(firstHint);
    });

    it('showHint returns false for already dismissed hint', () => {
      const { result } = renderHook(() => useOnboardingHints());
      const firstHint = ONBOARDING_HINTS[0];

      act(() => {
        result.current.dismiss(firstHint.id);
      });

      let shown = false;
      act(() => {
        shown = result.current.showHint(firstHint.id);
      });

      expect(shown).toBe(false);
      expect(result.current.activeHint).toBeNull();
    });

    it('dismiss adds hint ID to dismissedIds and persists', () => {
      const { result } = renderHook(() => useOnboardingHints());
      const firstHint = ONBOARDING_HINTS[0];

      act(() => {
        result.current.showHint(firstHint.id);
      });

      act(() => {
        result.current.dismiss(firstHint.id);
      });

      expect(result.current.activeHint).toBeNull();
      expect(result.current.dismissedIds.has(firstHint.id)).toBe(true);

      const stored = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? '[]');
      expect(stored).toContain(firstHint.id);
    });

    it('dismissAll marks all hints as dismissed', () => {
      const { result } = renderHook(() => useOnboardingHints());

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.isComplete).toBe(true);
      expect(result.current.dismissedIds.size).toBe(ONBOARDING_HINTS.length);
    });

    it('resetHints clears all dismissed state', () => {
      const { result } = renderHook(() => useOnboardingHints());

      act(() => {
        result.current.dismissAll();
      });
      expect(result.current.isComplete).toBe(true);

      act(() => {
        result.current.resetHints();
      });

      expect(result.current.dismissedIds.size).toBe(0);
      expect(result.current.isComplete).toBe(false);
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    });

    it('hideHint clears activeHint without dismissing', () => {
      const { result } = renderHook(() => useOnboardingHints());
      const firstHint = ONBOARDING_HINTS[0];

      act(() => {
        result.current.showHint(firstHint.id);
      });
      expect(result.current.activeHint).toBeTruthy();

      act(() => {
        result.current.hideHint();
      });

      expect(result.current.activeHint).toBeNull();
      expect(result.current.dismissedIds.has(firstHint.id)).toBe(false);
    });

    it('getNextHint returns lowest priority hint for trigger', () => {
      const { result } = renderHook(() => useOnboardingHints());

      const mountHints = ONBOARDING_HINTS.filter(h => h.triggerOn === 'mount');
      if (mountHints.length === 0) return;

      const expected = mountHints.sort((a, b) => a.priority - b.priority)[0];
      const next = result.current.getNextHint('mount');

      expect(next).toEqual(expected);
    });

    it('getNextHint returns null when all hints for trigger are dismissed', () => {
      const { result } = renderHook(() => useOnboardingHints());

      const mountHints = ONBOARDING_HINTS.filter(h => h.triggerOn === 'mount');
      act(() => {
        for (const h of mountHints) {
          result.current.dismiss(h.id);
        }
      });

      const next = result.current.getNextHint('mount');
      expect(next).toBeNull();
    });

    it('showNextHint shows and returns true when hint available', () => {
      const { result } = renderHook(() => useOnboardingHints());

      const mountHints = ONBOARDING_HINTS.filter(h => h.triggerOn === 'mount');
      if (mountHints.length === 0) return;

      let shown = false;
      act(() => {
        shown = result.current.showNextHint('mount');
      });

      expect(shown).toBe(true);
      expect(result.current.activeHint).toBeTruthy();
    });

    it('remainingCount reflects undismissed hints', () => {
      const { result } = renderHook(() => useOnboardingHints());

      expect(result.current.remainingCount).toBe(ONBOARDING_HINTS.length);

      act(() => {
        result.current.dismiss(ONBOARDING_HINTS[0].id);
      });

      expect(result.current.remainingCount).toBe(ONBOARDING_HINTS.length - 1);
    });

    it('showHint returns false for unknown hint ID', () => {
      const { result } = renderHook(() => useOnboardingHints());

      let shown = false;
      act(() => {
        shown = result.current.showHint('non-existent-hint');
      });

      expect(shown).toBe(false);
      expect(result.current.activeHint).toBeNull();
    });

    it('showNextHint returns false when no hints remain for trigger', () => {
      const { result } = renderHook(() => useOnboardingHints());

      act(() => {
        for (const h of ONBOARDING_HINTS.filter(h => h.triggerOn === 'mount')) {
          result.current.dismiss(h.id);
        }
      });

      let shown = false;
      act(() => {
        shown = result.current.showNextHint('mount');
      });

      expect(shown).toBe(false);
      expect(result.current.activeHint).toBeNull();
    });

    it('dismissAll clears active hint', () => {
      const { result } = renderHook(() => useOnboardingHints());

      act(() => {
        result.current.showHint(ONBOARDING_HINTS[0].id);
      });
      expect(result.current.activeHint).toBeTruthy();

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.activeHint).toBeNull();
    });

    it('initializes dismissedIds from localStorage', () => {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify([ONBOARDING_HINTS[0].id]));
      const { result } = renderHook(() => useOnboardingHints());
      expect(result.current.dismissedIds.has(ONBOARDING_HINTS[0].id)).toBe(true);
    });

    it('getNextHint returns null when no hints match trigger', () => {
      const { result } = renderHook(() => useOnboardingHints());
      const next = result.current.getNextHint('empty-canvas');
      const emptyCanvasHints = ONBOARDING_HINTS.filter(h => h.triggerOn === 'empty-canvas');
      if (emptyCanvasHints.length === 0) {
        expect(next).toBeNull();
      } else {
        expect(next).toEqual(emptyCanvasHints.sort((a, b) => a.priority - b.priority)[0]);
      }
    });

    it('continues when localStorage.setItem throws on save', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const { result } = renderHook(() => useOnboardingHints());

      act(() => {
        result.current.dismiss(ONBOARDING_HINTS[0].id);
      });

      expect(result.current.dismissedIds.has(ONBOARDING_HINTS[0].id)).toBe(true);
      setItemSpy.mockRestore();
    });
  });
});
