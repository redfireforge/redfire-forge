/** Demo Player — Spotlight overlay that highlights a target element */
import { useEffect, useState, useRef } from 'react';
import {
  findFirstVisibleElement,
  isSpotlightSuppressedForModal,
} from './demoSpotlightUtils';

interface SpotlightProps {
  selector?: string;
  active: boolean;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function DemoSpotlight({ selector, active }: SpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Clear stale position immediately so the old highlight doesn't flash
    setRect(null);
    if (!active || !selector) { return; }

    const track = () => {
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
      rafRef.current = requestAnimationFrame(track);
    };

    // Initial delay for DOM updates
    const timeout = setTimeout(() => { rafRef.current = requestAnimationFrame(track); }, 200);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [selector, active]);

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
