import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

import type { WsFrame } from '@shared/websocket/types';

export interface UseWebSocketMessageDiffParams {
  /** The full (unfiltered) message list, used to resolve compare/diff targets. */
  allMessages: WsFrame[];
  /** A ref mirroring `allMessages`, read by the stable row-click handler. */
  allMessagesRef: MutableRefObject<WsFrame[]>;
}

export interface UseWebSocketMessageDiffReturn {
  /** Whether two-message compare mode is active. */
  compareMode: boolean;
  /** The currently selected [A, B] message ids in compare mode. */
  compareIds: [string | null, string | null];
  /** The resolved [left, right] frame pair to diff, or null. */
  diffPair: [WsFrame, WsFrame] | null;
  /** Toggle compare mode on/off, resetting any selection. */
  toggleCompare: () => void;
  /** Close the diff view and exit compare mode. */
  closeDiff: () => void;
  /** Swap the left/right sides of the open diff. */
  swapDiff: () => void;
  /** Open a diff against the previous/next same-direction text frame. */
  quickDiff: (frame: WsFrame, direction: 'prev' | 'next') => void;
  /**
   * Handle a row click while in compare mode. Returns `true` when the click was
   * consumed (compare mode active), so the caller can skip normal selection.
   */
  selectCompareRow: (id: string) => boolean;
  /** Exit compare mode without touching an open diff (used by Escape). */
  exitCompareMode: () => void;
}

/**
 * Owns the message compare/diff state machine extracted from
 * `WebSocketMessageLog`: compare-mode selection of two frames, derivation of
 * the ordered diff pair, quick-diff navigation, and cleanup when frames are
 * evicted. Behaviour is identical to the previous inline implementation.
 */
export function useWebSocketMessageDiff({
  allMessages,
  allMessagesRef,
}: UseWebSocketMessageDiffParams): UseWebSocketMessageDiffReturn {
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null]);
  const [diffPair, setDiffPair] = useState<[WsFrame, WsFrame] | null>(null);

  const compareModeRef = useRef(compareMode);
  compareModeRef.current = compareMode;

  // Derive the ordered diff pair from the two selected ids (oldest = left).
  useEffect(() => {
    if (!compareMode) return;
    if (!compareIds[0] || !compareIds[1]) {
      setDiffPair(null);
      return;
    }
    const a = allMessages.find((m) => m.id === compareIds[0]);
    const b = allMessages.find((m) => m.id === compareIds[1]);
    if (a && b) {
      const [left, right] = new Date(a.timestamp) <= new Date(b.timestamp) ? [a, b] : [b, a];
      setDiffPair([left, right]);
    } else {
      setDiffPair(null);
    }
  }, [compareMode, compareIds, allMessages]);

  // Clear a quick-diff pair if either frame is evicted from the list.
  useEffect(() => {
    if (compareMode || !diffPair) return;
    const leftExists = allMessages.some((m) => m.id === diffPair[0].id);
    const rightExists = allMessages.some((m) => m.id === diffPair[1].id);
    if (!leftExists || !rightExists) setDiffPair(null);
  }, [compareMode, diffPair, allMessages]);

  const toggleCompare = useCallback(() => {
    setCompareMode((prev) => !prev);
    setCompareIds([null, null]);
    setDiffPair(null);
  }, []);

  const closeDiff = useCallback(() => {
    setDiffPair(null);
    setCompareMode(false);
    setCompareIds([null, null]);
  }, []);

  const swapDiff = useCallback(() => {
    setDiffPair((prev) => (prev ? [prev[1], prev[0]] : null));
  }, []);

  const quickDiff = useCallback(
    (frame: WsFrame, direction: 'prev' | 'next') => {
      const idx = allMessages.findIndex((m) => m.id === frame.id);
      if (idx < 0) return;
      const step = direction === 'prev' ? -1 : 1;
      for (let i = idx + step; i >= 0 && i < allMessages.length; i += step) {
        if (allMessages[i].direction === frame.direction && allMessages[i].type === 'text') {
          const [left, right] =
            direction === 'prev' ? [allMessages[i], frame] : [frame, allMessages[i]];
          setDiffPair([left, right]);
          return;
        }
      }
    },
    [allMessages],
  );

  const selectCompareRow = useCallback(
    (id: string): boolean => {
      if (!compareModeRef.current) return false;
      const frame = allMessagesRef.current.find((m) => m.id === id);
      // In compare mode only text frames are diffable; swallow other clicks.
      if (frame && frame.type !== 'text') return true;
      setCompareIds((prev) => {
        if (prev[0] === id) return [null, prev[1]];
        if (prev[1] === id) return [prev[0], null];
        if (prev[0] === null) return [id, prev[1]];
        if (prev[1] === null) return [prev[0], id];
        return [id, null];
      });
      return true;
    },
    [allMessagesRef],
  );

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setCompareIds([null, null]);
  }, []);

  return {
    compareMode,
    compareIds,
    diffPair,
    toggleCompare,
    closeDiff,
    swapDiff,
    quickDiff,
    selectCompareRow,
    exitCompareMode,
  };
}
