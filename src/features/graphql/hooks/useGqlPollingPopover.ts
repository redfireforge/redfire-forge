import { useEffect, useRef, useState } from 'react';

const MIN_POLL_SECONDS = 10;
const MAX_POLL_SECONDS = 3600;

export interface UseGqlPollingPopoverOptions {
  pollingEnabled:        boolean;
  pollingIntervalSeconds: number;
  onPollingChange?:      (enabled: boolean, intervalSeconds: number) => void;
}

export interface UseGqlPollingPopoverResult {
  pollingOpen:                 boolean;
  setPollingOpen:              (open: boolean) => void;
  localIntervalSeconds:        number;
  setLocalIntervalSeconds:     (s: number) => void;
  pollingPopoverPos:           { top: number; right: number } | null;
  pollingBtnRef:               React.RefObject<HTMLButtonElement>;
  pollingPopoverRef:           React.RefObject<HTMLDivElement>;
  pollingSwitchRef:            React.RefObject<HTMLButtonElement>;
  commitPollingInterval:       () => number;
  closePollingPopoverViaRef:   React.MutableRefObject<() => void>;
}

/**
 * Encapsulates all state and side-effects for the polling config popover
 * so GraphqlConnectionBar can remain lean.
 */
export function useGqlPollingPopover({
  pollingEnabled,
  pollingIntervalSeconds,
  onPollingChange,
}: UseGqlPollingPopoverOptions): UseGqlPollingPopoverResult {
  const [pollingOpen, setPollingOpen]               = useState(false);
  const [localIntervalSeconds, setLocalIntervalSeconds] = useState(pollingIntervalSeconds);
  const [pollingPopoverPos, setPollingPopoverPos]   = useState<{ top: number; right: number } | null>(null);

  const pollingBtnRef      = useRef<HTMLButtonElement>(null!);
  const pollingPopoverRef  = useRef<HTMLDivElement>(null!);
  const pollingSwitchRef   = useRef<HTMLButtonElement>(null!);

  // Always-fresh refs to avoid stale closures
  const localIntervalSecondsRef = useRef(localIntervalSeconds);
  localIntervalSecondsRef.current = localIntervalSeconds;
  const pollingEnabledRef = useRef(pollingEnabled);
  pollingEnabledRef.current = pollingEnabled;
  const onPollingChangeRef = useRef(onPollingChange);
  onPollingChangeRef.current = onPollingChange;

  const commitPollingInterval = () => {
    const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSecondsRef.current));
    setLocalIntervalSeconds(clamped);
    onPollingChangeRef.current?.(pollingEnabledRef.current, clamped);
    return clamped;
  };

  // Keep ref so effect closures always call the freshest close logic
  const closePollingPopoverViaRef = useRef<() => void>(() => setPollingOpen(false));
  closePollingPopoverViaRef.current = () => {
    if (pollingEnabledRef.current) {
      const clamped = Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, localIntervalSecondsRef.current));
      setLocalIntervalSeconds(clamped);
      onPollingChangeRef.current?.(pollingEnabledRef.current, clamped);
    }
    setPollingOpen(false);
    requestAnimationFrame(() => pollingBtnRef.current?.focus());
  };

  // Sync local interval when prop changes from outside
  useEffect(() => { setLocalIntervalSeconds(pollingIntervalSeconds); }, [pollingIntervalSeconds]);

  // Recalculate fixed position so the popover escapes overflow:auto containers
  useEffect(() => {
    if (!pollingOpen) return;
    function recalc() {
      if (!pollingBtnRef.current) return;
      const r = pollingBtnRef.current.getBoundingClientRect();
      setPollingPopoverPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [pollingOpen]);

  // Move focus to toggle switch when popover opens (a11y)
  useEffect(() => {
    if (pollingOpen) {
      requestAnimationFrame(() => pollingSwitchRef.current?.focus());
    }
  }, [pollingOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!pollingOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        pollingPopoverRef.current &&
        !pollingPopoverRef.current.contains(e.target as Node) &&
        !pollingBtnRef.current?.contains(e.target as Node)
      ) {
        closePollingPopoverViaRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closePollingPopoverViaRef.current(); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [pollingOpen]);

  return {
    pollingOpen,
    setPollingOpen,
    localIntervalSeconds,
    setLocalIntervalSeconds,
    pollingPopoverPos,
    pollingBtnRef,
    pollingPopoverRef,
    pollingSwitchRef,
    commitPollingInterval,
    closePollingPopoverViaRef,
  };
}
