import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import type { TestScenario } from '../../../shared/types';

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

export default function ScenarioContextMenu({
  x, y, scenario, tagSuggestions, onAddTag, onRemoveTag, onClearTags, onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const currentTags = scenario.tags ?? [];
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  // Adjust position if menu would overflow viewport
  useLayoutEffect(() => {
    if (!ref.current) {
      setAdjustedPos({ x, y });
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    
    let newX = x;
    let newY = y;
    
    if (x + rect.width > viewportW) {
      newX = Math.max(0, viewportW - rect.width - 8);
    }
    if (y + rect.height > viewportH) {
      newY = Math.max(0, viewportH - rect.height - 8);
    }
    
    setAdjustedPos({ x: newX, y: newY });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
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
