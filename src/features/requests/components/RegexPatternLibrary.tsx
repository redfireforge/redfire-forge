import { useState, useMemo } from 'react';
import { PATTERN_LIBRARY, type PatternEntry } from './regexAssertionUtils';

const CATEGORIES = [...new Set(PATTERN_LIBRARY.map(p => p.category))];

interface Props {
  onSelect: (entry: PatternEntry) => void;
  /** Adds data-testid attributes for tests (default: false) */
  testIds?: boolean;
}

/**
 * Reusable Pattern Library panel shared by RegexAssertionModal and
 * RegexAssertionBuilderModal. Renders category filter buttons and the
 * list of built-in regex patterns. Manages activeCategory state internally.
 */
export default function RegexPatternLibrary({ onSelect, testIds = false }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredPatterns = useMemo(
    () => activeCategory ? PATTERN_LIBRARY.filter(p => p.category === activeCategory) : PATTERN_LIBRARY,
    [activeCategory],
  );

  return (
    <div className="ram-library" {...(testIds ? { 'data-testid': 'pattern-library' } : {})}>
      <div className="ram-library-cats">
        <button
          className={`btn btn-xs ${!activeCategory ? 'btn-active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >All</button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`btn btn-xs ${activeCategory === cat ? 'btn-active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >{cat}</button>
        ))}
      </div>
      <div className="ram-library-list">
        {filteredPatterns.map((entry, i) => (
          <div
            key={i}
            className="ram-library-item"
            onClick={() => onSelect(entry)}
            {...(testIds ? { 'data-testid': `pattern-entry-${i}` } : {})}
          >
            <div className="ram-library-item-name">{entry.name}</div>
            <div className="ram-library-item-desc">{entry.description}</div>
            {entry.pattern && (
              <code className="ram-library-item-pattern">/{entry.pattern}/</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
