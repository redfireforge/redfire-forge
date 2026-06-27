/** Demo Player — Spotlight overlay that highlights a target element */
import { useEffect, useState, useRef } from 'react';
import {
  findFirstVisibleElement,
  isSpotlightSuppressedForModal,
} from './demoSpotlightUtils';

interface SpotlightProps {
  selector?: string;
  active: boolean;
  /** Bumps when the live step changes — forces a fresh track loop (Tauri WebView). */
  trackKey?: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_TRACK_INTERVAL_MS = 250;

export default function DemoSpotlight({ selector, active, trackKey }: SpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRect(null);
    if (!active || !selector) { return; }

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
        setRect((prev) => (
          prev
          && prev.top === next.top
          && prev.left === next.left
          && prev.width === next.width
          && prev.height === next.height
            ? prev
            : next
        ));
      } else {
        setRect((prev) => (prev === null ? prev : null));
      }
    };

    const scheduleRaf = () => {
      if (cancelled || typeof requestAnimationFrame !== 'function') return;
      rafRef.current = requestAnimationFrame(() => {
        track();
        scheduleRaf();
      });
    };

    track();
    scheduleRaf();
    intervalRef.current = setInterval(track, SPOTLIGHT_TRACK_INTERVAL_MS);

    const onLayoutChange = () => { track(); };
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('scroll', onLayoutChange, true);

    return () => {
      cancelled = true;
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('scroll', onLayoutChange, true);
    };
  }, [selector, active, trackKey]);

  if (!active || !rect) return null;

  return (
    <>
      {/* Highlight ring around the target — its 9999px box-shadow spread acts as the scrim */}
      <div
        className="demo-spotlight-ring"
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
