interface VersionOption {
  id: string;
  label: string;
}

interface Props {
  compareLeft: string | null;
  setCompareLeft: (v: string) => void;
  compareRight: string | null;
  setCompareRight: (v: string) => void;
  options: VersionOption[];
}

export default function VersionDiffSelectors({
  compareLeft, setCompareLeft,
  compareRight, setCompareRight,
  options,
}: Props) {
  return (
    <div className="version-diff-modal-selectors">
      <label>
        <span className="version-diff-selector-label">Left</span>
        <select value={compareLeft || ''} onChange={(e) => setCompareLeft(e.target.value)}>
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      <span className="version-diff-vs">vs</span>
      <label>
        <span className="version-diff-selector-label">Right</span>
        <select value={compareRight || ''} onChange={(e) => setCompareRight(e.target.value)}>
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
