/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerifyNavigation } from './useVerifyNavigation';
import type { VerifyResult } from './useValidationVerify';
import type { Assertion } from '../../../types';

function createVerifyResult(overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    status: 'idle',
    fieldResults: new Map(),
    assertionResults: [],
    passedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failedMappingIds: new Set(),
    timestamp: 0,
    ...overrides,
  };
}

describe('useVerifyNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (Element.prototype as unknown as { scrollIntoView?: typeof Element.prototype.scrollIntoView }).scrollIntoView;
  });

  describe('verifyFailuresList', () => {
    it('returns empty array when status is idle', () => {
      const verifyResult = createVerifyResult({ status: 'idle' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([]);
    });

    it('returns empty array when status is running', () => {
      const verifyResult = createVerifyResult({ status: 'running' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([]);
    });

    it('returns empty array when complete but all field and assertion checks passed', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        fieldResults: new Map([
          ['$.a', { path: '$.a', passed: true }],
          ['$.b', { path: '$.b', passed: true, actual: '1', expected: '2' }],
        ]),
        assertionResults: [
          {
            assertion: { type: 'regex', jsonPath: '$.x', pattern: '.*' } as Assertion,
            index: 0,
            passed: true,
          },
        ],
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([]);
    });

    it('collects failed field results with expected and actual', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        fieldResults: new Map([
          ['$.name', { path: '$.name', passed: false, expected: '"A"', actual: '"B"' }],
        ]),
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([
        { path: '$.name', expected: '"A"', actual: '"B"' },
      ]);
    });

    it('collects failed assertions using jsonPath when present', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        assertionResults: [
          {
            assertion: { type: 'numeric', jsonPath: '$.count', operator: '=', value: 1 } as Assertion,
            index: 0,
            passed: false,
            expected: '1',
            actual: '2',
          },
        ],
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([
        { path: '$.count', expected: '1', actual: '2' },
      ]);
    });

    it('collects failed assertions using assertion.type when jsonPath is absent', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        assertionResults: [
          {
            assertion: { type: 'status', expected: '200' } as Assertion,
            index: 0,
            passed: false,
            expected: '200',
            actual: '500',
          },
        ],
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([
        { path: 'status', expected: '200', actual: '500' },
      ]);
    });

    it('merges failed fields and failed assertions in fieldResults iteration order then assertions order', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        fieldResults: new Map([
          ['$.z', { path: '$.z', passed: false }],
          ['$.y', { path: '$.y', passed: true }],
        ]),
        assertionResults: [
          {
            assertion: { type: 'regex', jsonPath: '$.p', pattern: 'x' } as Assertion,
            index: 0,
            passed: false,
          },
        ],
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toEqual([
        { path: '$.z', expected: undefined, actual: undefined },
        { path: '$.p', expected: undefined, actual: undefined },
      ]);
    });

    it('updates verifyFailuresList when verifyResult reference changes', () => {
      let verifyResult = createVerifyResult({ status: 'running' });
      const { result, rerender } = renderHook(({ vr }: { vr: VerifyResult }) => useVerifyNavigation(vr), {
        initialProps: { vr: verifyResult },
      });
      expect(result.current.verifyFailuresList).toEqual([]);

      verifyResult = createVerifyResult({
        status: 'complete',
        fieldResults: new Map([['$.q', { path: '$.q', passed: false }]]),
      });
      rerender({ vr: verifyResult });
      expect(result.current.verifyFailuresList).toEqual([{ path: '$.q', expected: undefined, actual: undefined }]);
    });

    it('single failed field yields one-item list', () => {
      const verifyResult = createVerifyResult({
        status: 'complete',
        fieldResults: new Map([['$.only', { path: '$.only', passed: false }]]),
      });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.verifyFailuresList).toHaveLength(1);
    });
  });

  describe('handleNavigateToFailure', () => {
    it('does nothing when targetPanelRef has no container', () => {
      const verifyResult = createVerifyResult({ status: 'complete' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));

      expect(() =>
        act(() => {
          result.current.handleNavigateToFailure('$.foo');
        }),
      ).not.toThrow();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls and flashes element matched by full data-path', () => {
      const verifyResult = createVerifyResult({ status: 'complete' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));

      const container = document.createElement('div');
      const node = document.createElement('div');
      node.setAttribute('data-path', '$.full.match');
      container.appendChild(node);

      act(() => {
        result.current.targetPanelRef.current = container;
        result.current.handleNavigateToFailure('$.full.match');
      });

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      });
      expect(node.classList.contains('dm-tree-node--flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(node.classList.contains('dm-tree-node--flash')).toBe(false);
    });

    it('falls back to stripped $. prefix when full path selector misses', () => {
      const verifyResult = createVerifyResult({ status: 'complete' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));

      const container = document.createElement('div');
      const node = document.createElement('div');
      node.setAttribute('data-path', 'items[0].id');
      container.appendChild(node);

      act(() => {
        result.current.targetPanelRef.current = container;
        result.current.handleNavigateToFailure('$.items[0].id');
      });

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(node.classList.contains('dm-tree-node--flash')).toBe(true);
    });

    it('does not scroll when no element matches either selector', () => {
      const verifyResult = createVerifyResult({ status: 'complete' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));

      const container = document.createElement('div');
      container.innerHTML = '<div data-path="other"></div>';

      act(() => {
        result.current.targetPanelRef.current = container;
        result.current.handleNavigateToFailure('$.missing');
      });

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('handles path without $. prefix (stripped equals path)', () => {
      const verifyResult = createVerifyResult({ status: 'complete' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));

      const container = document.createElement('div');
      const node = document.createElement('div');
      node.setAttribute('data-path', 'plain.path');
      container.appendChild(node);

      act(() => {
        result.current.targetPanelRef.current = container;
        result.current.handleNavigateToFailure('plain.path');
      });

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('memoizes handler identity across renders', () => {
      const verifyResult = createVerifyResult({ status: 'idle' });
      const { result, rerender } = renderHook(() => useVerifyNavigation(verifyResult));
      const first = result.current.handleNavigateToFailure;
      rerender();
      expect(result.current.handleNavigateToFailure).toBe(first);
    });
  });

  describe('targetPanelRef', () => {
    it('starts as null current until assigned', () => {
      const verifyResult = createVerifyResult({ status: 'idle' });
      const { result } = renderHook(() => useVerifyNavigation(verifyResult));
      expect(result.current.targetPanelRef.current).toBeNull();
    });
  });
});
