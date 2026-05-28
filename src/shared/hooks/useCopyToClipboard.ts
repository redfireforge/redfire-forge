import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Provides clipboard write with a temporary "copied" feedback state.
 *
 * @param resetDelay - ms before `copied` resets to false (default 1500)
 * @returns [copied, copy] — `copy(text)` writes to the clipboard and flips
 *   `copied` to `true` for `resetDelay` ms, then back to `false`.
 */
export function useCopyToClipboard(resetDelay = 1500): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), resetDelay);
    } catch {
      // Clipboard API not available or permission denied — silently ignore
    }
  }, [resetDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  return [copied, copy];
}
