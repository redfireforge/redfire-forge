import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import type { TestScenario } from '@shared/types';

interface Props {
  x: number;
  y: number;
  scenario: TestScenario;
  tagSuggestions: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  onClose: () => void;
}

function clampToViewport(pos: number, size: number, viewport: number): number {
  return pos + size > viewport ? Math.max(0, viewport - size - 8) : pos;
}

export default function ScenarioContextMenu({
  x, y, scenario, tagSuggestions, onAddTag, onRemoveTag, onClearTags, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const currentTags = scenario.tags ?? [];
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useLayoutEffect(() => {
    const rect = ref.current!.getBoundingClientRect();
    setAdjustedPos({
      x: clampToViewport(x, rect.width, window.innerWidth),
      y: clampToViewport(y, rect.height, window.innerHeight),
    });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = ref.current;
      if (!el || el.contains(e.target as Node)) return;
      onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="scenario-context-menu" style={{ left: adjustedPos.x, top: adjustedPos.y }}>
      <div className="context-menu-section">
        <div className="context-menu-label">Tags</div>
        {tagSuggestions.map(tag => (
          <label key={tag} className="context-menu-checkbox">
            <input
              type="checkbox"
              checked={currentTags.includes(tag)}
              onChange={(e) => e.target.checked ? onAddTag(tag) : onRemoveTag(tag)}
            />
            {tag}
          </label>
        ))}
      </div>
      {currentTags.length > 0 && (
        <>
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={onClearTags}>
            Remove All Tags
          </button>
        </>
      )}
    </div>
  );
}
