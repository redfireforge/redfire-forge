/** Demo Player — Spotlight overlay that highlights a target element */
import { useEffect, useState, useRef } from 'react';

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
    if (!active || !selector) { setRect(null); return; }

    const track = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top - 6,
          left: r.left - 6,
          width: r.width + 12,
          height: r.height + 12,
        });
      } else {
        setRect(null);
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
