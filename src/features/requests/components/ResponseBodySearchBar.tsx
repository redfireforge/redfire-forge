import { SearchMatchBar } from '@shared/components/SearchMatchBar';

interface Props {
  value: string;
  onChange: (v: string) => void;
  currentMatch: number;
  totalMatches: number;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

/**
 * Response body search + expand/collapse toolbar used in RequestEditor
 * and ResponseDetailModal JSON preview sections.
 */
export default function ResponseBodySearchBar({
  value, onChange,
  currentMatch, totalMatches,
  onPrev, onNext, onClear,
  onExpandAll, onCollapseAll,
}: Props) {
  return (
    <div className="req-resp-search" data-testid="req-resp-search">
      <SearchMatchBar
        value={value}
        onChange={onChange}
        currentMatch={currentMatch}
        totalMatches={totalMatches}
        onPrev={onPrev}
        onNext={onNext}
        onClear={onClear}
        placeholder="Search response..."
        inputClassName="req-resp-search-input"
        countClassName="req-resp-search-count"
        navClassName="req-resp-search-nav"
        clearClassName="req-resp-search-clear"
      />
      <button className="jt-expand-collapse-btn" onClick={onExpandAll} data-testid="req-resp-expand-all">Expand All</button>
      <button className="jt-expand-collapse-btn" onClick={onCollapseAll} data-testid="req-resp-collapse-all">Collapse All</button>
    </div>
  );
}
