import { useCallback, useState } from 'react';
import type { WsFrame } from '../../shared/websocket/types';

export interface UseWebSocketBookmarksReturn {
  bookmarkedIds: ReadonlySet<string>;
  bookmarkedMessages: WsFrame[];
  toggleBookmark: (id: string) => void;
}

export function useWebSocketBookmarks(
  messagesRef: React.RefObject<WsFrame[]>,
): UseWebSocketBookmarksReturn {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set());
  const [bookmarkedMessages, setBookmarkedMessages] = useState<WsFrame[]>([]);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setBookmarkedMessages((bm) => bm.filter((f) => f.id !== id));
      } else {
        next.add(id);
        const frame = messagesRef.current?.find((f) => f.id === id);
        if (frame) {
          setBookmarkedMessages((bm) => [...bm, frame]);
        }
      }
      return next;
    });
  }, [messagesRef]);

  return { bookmarkedIds, bookmarkedMessages, toggleBookmark };
}
