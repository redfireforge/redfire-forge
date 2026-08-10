/** Demo Player — Spotlight overlay that highlights a target element */
import { useEffect, useState, useRef } from 'react';
import {
  findFirstVisibleElement,
  isSpotlightSuppressedForModal,
} from './demoSpotlightUtils';
import { getManualSpotlightEventName, isManualSpotlightActive } from './demoRipple';

interface SpotlightProps {
  selector?: string;
  active: boolean;
  /** Bumps when the live step changes — forces a fresh track loop (Tauri WebView). */
  trackKey?: string;
  /** When true, captures the rect once then stops tracking. Use during action phase
   * to prevent the ring from jumping when the highlighted element resizes (e.g.
   * when the interpolation preview strip mounts inside TARGET_PANEL_STACK). */
  frozen?: boolean;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_TRACK_INTERVAL_MS = 250;

export default function DemoSpotlight({ selector, active, trackKey, frozen }: SpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [manualSpotlightActive, setManualSpotlightActive] = useState<boolean>(() => isManualSpotlightActive());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so the RAF callback always reads the latest frozen value without re-running the effect.
  const frozenRef = useRef(frozen);
  frozenRef.current = frozen;

  useEffect(() => {
    setRect(null);
    if (!active || !selector || manualSpotlightActive) { return; }

    let cancelled = false;

    const track = () => {
      if (cancelled) return;

      const el = findFirstVisibleElement(selector);
      if (el && !isSpotlightSuppressedForModal(el)) {
        const r = el.getBoundingClientRect();
        const next = {
          top: r.top - 6,
          left: r.left - 6,
          width: r.width + 12,
          height: r.height + 12,
        };
        setRect((prev) => {
          // When frozen, keep the rect we already have — the element may be
          // resizing (e.g. preview strip mounting) but the ring should not move.
          if (frozenRef.current && prev !== null) return prev;
          // Only update if the rect has moved/resized by more than 2px to avoid
          // trembling when the tracked element has minor layout fluctuations.
          if (
            prev &&
            Math.abs(prev.top - next.top) <= 2 &&
            Math.abs(prev.left - next.left) <= 2 &&
            Math.abs(prev.width - next.width) <= 2 &&
            Math.abs(prev.height - next.height) <= 2
          ) return prev;
          return next;
        });
      } else {
        setRect((prev) => (prev === null ? prev : null));
      }
    };

    track();
    intervalRef.current = setInterval(track, SPOTLIGHT_TRACK_INTERVAL_MS);

    const onLayoutChange = () => { track(); };
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('scroll', onLayoutChange, true);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('scroll', onLayoutChange, true);
    };
  }, [selector, active, trackKey, manualSpotlightActive]);

  useEffect(() => {
    const eventName = getManualSpotlightEventName();
    const onManualSpotlightChange = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      const detail = typeof customEvent.detail === 'number' ? customEvent.detail : Number.NaN;
      if (Number.isFinite(detail)) {
        setManualSpotlightActive(detail > 0);
        return;
      }
      setManualSpotlightActive(isManualSpotlightActive());
    };

    window.addEventListener(eventName, onManualSpotlightChange as EventListener);
    return () => window.removeEventListener(eventName, onManualSpotlightChange as EventListener);
  }, []);

  if (!active || !rect || manualSpotlightActive) return null;

  return (
    <>
      {/* Highlight ring around the target — its 9999px box-shadow spread acts as the scrim */}
      <div
        className="demo-spotlight-ring demo-spotlight-ring--steady"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </>
  );
}
