interface Props {
  show: boolean;
  duplicateOfLabel: string;
  onSaveAnyway: () => void;
  onCancel: () => void;
}

/** Inline confirm banner shown when a version being saved is identical to an existing one. */
export default function VersionDuplicateConfirm({ show, duplicateOfLabel, onSaveAnyway, onCancel }: Props) {
  if (!show) return null;
  return (
    <div className="version-duplicate-confirm">
      <span>This is identical to <strong>{duplicateOfLabel}</strong>. Save anyway?</span>
      <button type="button" className="btn btn-xs btn-accent" onClick={onSaveAnyway}>Save Anyway</button>
      <button type="button" className="btn btn-xs" onClick={onCancel}>Cancel</button>
    </div>
  );
}
