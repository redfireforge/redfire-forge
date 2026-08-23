/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

import { useWebSocketMessageDiff } from './useWebSocketMessageDiff';
import type { WsFrame } from '@shared/websocket/types';

function frame(id: string, overrides: Partial<WsFrame> = {}): WsFrame {
  return {
    id,
    direction: 'received',
    type: 'text',
    data: `data-${id}`,
    size: 4,
    timestamp: overrides.timestamp ?? `2024-01-01T00:00:0${id}.000Z`,
    ...overrides,
  } as WsFrame;
}

function useHarness(messages: WsFrame[]) {
  const ref = useRef(messages);
  ref.current = messages;
  return useWebSocketMessageDiff({ allMessages: messages, allMessagesRef: ref });
}

describe('useWebSocketMessageDiff', () => {
  it('starts in a clean, non-comparing state', () => {
    const { result } = renderHook(() => useHarness([frame('1'), frame('2')]));
    expect(result.current.compareMode).toBe(false);
    expect(result.current.compareIds).toEqual([null, null]);
    expect(result.current.diffPair).toBeNull();
  });

  it('toggleCompare flips compare mode and resets selection', () => {
    const { result } = renderHook(() => useHarness([frame('1'), frame('2')]));
    act(() => result.current.toggleCompare());
    expect(result.current.compareMode).toBe(true);
    act(() => result.current.toggleCompare());
    expect(result.current.compareMode).toBe(false);
    expect(result.current.compareIds).toEqual([null, null]);
  });

  it('selectCompareRow returns false when not comparing', () => {
    const { result } = renderHook(() => useHarness([frame('1')]));
    let handled = true;
    act(() => {
      handled = result.current.selectCompareRow('1');
    });
    expect(handled).toBe(false);
    expect(result.current.compareIds).toEqual([null, null]);
  });

  it('selects two frames and derives an ordered diff pair (oldest left)', () => {
    const msgs = [
      frame('1', { timestamp: '2024-01-01T00:00:02.000Z' }),
      frame('2', { timestamp: '2024-01-01T00:00:01.000Z' }),
    ];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    expect(result.current.compareIds).toEqual(['1', '2']);
    // '2' is older, so it should be on the left.
    expect(result.current.diffPair?.[0].id).toBe('2');
    expect(result.current.diffPair?.[1].id).toBe('1');
  });

  it('resets to a single slot when a third frame is selected with both slots full', () => {
    const msgs = [frame('1'), frame('2'), frame('3')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    act(() => {
      result.current.selectCompareRow('3');
    });
    expect(result.current.compareIds).toEqual(['3', null]);
  });

  it('selects into slot B when slot A is filled', () => {
    const msgs = [frame('1'), frame('2')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    expect(result.current.compareIds).toEqual(['1', '2']);
    // Re-selecting B clears slot B only.
    act(() => {
      result.current.selectCompareRow('2');
    });
    expect(result.current.compareIds).toEqual(['1', null]);
  });

  it('toggles a selected id off and swallows non-text clicks in compare mode', () => {
    const msgs = [frame('1'), frame('2', { type: 'binary' })];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    expect(result.current.compareIds).toEqual(['1', null]);
    // Re-selecting clears slot A.
    act(() => {
      result.current.selectCompareRow('1');
    });
    expect(result.current.compareIds).toEqual([null, null]);
    // Non-text frame is swallowed (handled) without selecting.
    let handled = false;
    act(() => {
      handled = result.current.selectCompareRow('2');
    });
    expect(handled).toBe(true);
    expect(result.current.compareIds).toEqual([null, null]);
  });

  it('swapDiff flips the left/right sides', () => {
    const msgs = [frame('1'), frame('2')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    const before = result.current.diffPair;
    act(() => result.current.swapDiff());
    expect(result.current.diffPair?.[0].id).toBe(before?.[1].id);
    expect(result.current.diffPair?.[1].id).toBe(before?.[0].id);
  });

  it('closeDiff clears the diff and exits compare mode', () => {
    const msgs = [frame('1'), frame('2')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    act(() => result.current.closeDiff());
    expect(result.current.diffPair).toBeNull();
    expect(result.current.compareMode).toBe(false);
    expect(result.current.compareIds).toEqual([null, null]);
  });

  it('exitCompareMode leaves an open quick-diff untouched', () => {
    const msgs = [frame('1'), frame('2')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.quickDiff(frame('2'), 'prev'));
    expect(result.current.diffPair).not.toBeNull();
    act(() => result.current.exitCompareMode());
    expect(result.current.compareMode).toBe(false);
    expect(result.current.diffPair).not.toBeNull();
  });

  it('quickDiff opens a diff against the previous same-direction text frame', () => {
    const msgs = [
      frame('1', { direction: 'sent' }),
      frame('2', { direction: 'received' }),
      frame('3', { direction: 'received' }),
    ];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.quickDiff(msgs[2], 'prev'));
    expect(result.current.diffPair?.[0].id).toBe('2');
    expect(result.current.diffPair?.[1].id).toBe('3');
  });

  it('quickDiff is a no-op when the frame is missing or has no match', () => {
    const msgs = [frame('2', { direction: 'received' })];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.quickDiff(frame('missing'), 'next'));
    expect(result.current.diffPair).toBeNull();
    act(() => result.current.quickDiff(msgs[0], 'next'));
    expect(result.current.diffPair).toBeNull();
  });

  it('clears a quick-diff pair when a referenced frame is evicted', () => {
    const initial = [frame('1', { direction: 'received' }), frame('2', { direction: 'received' })];
    const { result, rerender } = renderHook(({ msgs }) => useHarness(msgs), {
      initialProps: { msgs: initial },
    });
    act(() => result.current.quickDiff(initial[1], 'prev'));
    expect(result.current.diffPair).not.toBeNull();
    // Evict frame '1' (the left side of the diff).
    rerender({ msgs: [frame('2', { direction: 'received' })] });
    expect(result.current.diffPair).toBeNull();
  });

  it('clears the diff pair when only one slot is selected', () => {
    const msgs = [frame('1'), frame('2')];
    const { result } = renderHook(() => useHarness(msgs));
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    expect(result.current.diffPair).toBeNull();
  });

  it('clears the diff pair when a selected id no longer resolves to a frame', () => {
    const initial = [frame('1'), frame('2')];
    const { result, rerender } = renderHook(({ msgs }) => useHarness(msgs), {
      initialProps: { msgs: initial },
    });
    act(() => result.current.toggleCompare());
    act(() => {
      result.current.selectCompareRow('1');
    });
    act(() => {
      result.current.selectCompareRow('2');
    });
    expect(result.current.diffPair).not.toBeNull();
    // Remove frame '2' while still in compare mode → pair can't resolve.
    rerender({ msgs: [frame('1')] });
    expect(result.current.diffPair).toBeNull();
  });
});
