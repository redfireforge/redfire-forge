import { CustomSelect } from '../../../../shared/components/CustomSelect';

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
        <CustomSelect
          value={compareLeft || ''}
          onChange={setCompareLeft}
          options={[
            { value: '', label: 'Select...' },
            ...options.map((o) => ({ value: o.id, label: o.label })),
          ]}
        />
      </label>
      <span className="version-diff-vs">vs</span>
      <label>
        <span className="version-diff-selector-label">Right</span>
        <CustomSelect
          value={compareRight || ''}
          onChange={setCompareRight}
          options={[
            { value: '', label: 'Select...' },
            ...options.map((o) => ({ value: o.id, label: o.label })),
          ]}
        />
      </label>
    </div>
  );
}
