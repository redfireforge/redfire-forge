import type { RefObject } from 'react';

interface Props {
  diffSearch: string;
  setDiffSearch: (v: string) => void;
  diffMatchIdx: number;
  setDiffMatchIdx: (v: number) => void;
  diffMatchCount: number;
  diffSearchRef: RefObject<HTMLInputElement | null>;
  diffGoNext: () => void;
  diffGoPrev: () => void;
  /** When true, pressing Escape clears search before closing the modal */
  escapeClearsSearch?: boolean;
}

export default function VersionDiffSearchBar({
  diffSearch, setDiffSearch,
  diffMatchIdx, setDiffMatchIdx,
  diffMatchCount,
  diffSearchRef,
  diffGoNext, diffGoPrev,
  escapeClearsSearch = false,
}: Props) {
  return (
    <div className="version-diff-search-bar">
      <input
        ref={diffSearchRef}
        className="version-diff-search-input"
        type="text"
        placeholder="Search… (Cmd+F)"
        value={diffSearch}
        onChange={(e) => { setDiffSearch(e.target.value); setDiffMatchIdx(0); }}
        onKeyDown={(e) => {
          if (escapeClearsSearch && e.key === 'Escape' && diffSearch.trim()) {
            e.stopPropagation();
            setDiffSearch('');
            setDiffMatchIdx(0);
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); diffGoNext(); }
          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); diffGoPrev(); }
        }}
      />
      {diffSearch && (
        <span className="version-diff-search-count">
          {diffMatchCount > 0 ? `${diffMatchIdx + 1}/${diffMatchCount}` : 'No match'}
        </span>
      )}
      <button type="button" className="version-diff-search-nav" onClick={diffGoPrev} title="Previous (Shift+Enter)" disabled={diffMatchCount === 0}>▲</button>
      <button type="button" className="version-diff-search-nav" onClick={diffGoNext} title="Next (Enter)" disabled={diffMatchCount === 0}>▼</button>
    </div>
  );
}
