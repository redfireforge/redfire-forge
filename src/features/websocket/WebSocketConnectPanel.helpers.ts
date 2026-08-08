import { useEffect, useState } from 'react';

export const MAX_REASON_BYTES = 123;

export const STATE_LABELS: Record<string, { label: string; className: string }> = {
  disconnected: { label: 'Disconnected', className: 'state-disconnected' },
  connecting: { label: 'Connecting\u2026', className: 'state-connecting' },
  connected: { label: 'Connected', className: 'state-connected' },
  closing: { label: 'Closing\u2026', className: 'state-closing' },
  error: { label: 'Error', className: 'state-error' },
};

export function useReconnectCountdown(nextRetryAt: number | null | undefined): number | null {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (nextRetryAt == null) {
      setRemainingSec(null);
      return;
    }

    const tick = () => {
      const sec = Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1000));
      setRemainingSec(sec);
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [nextRetryAt]);

  return remainingSec;
}
