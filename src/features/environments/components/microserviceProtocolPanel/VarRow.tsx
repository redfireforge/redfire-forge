export function VarRow({
  varKey,
  value,
  onChange,
  onDelete,
  readOnly = false,
  overridden = false,
  testIdPrefix,
}: {
  varKey: string;
  value: string;
  onChange?: (v: string) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  overridden?: boolean;
  testIdPrefix: string;
}) {
  return (
    <div
      className={`em-vars-modal-row ${readOnly ? 'em-vars-modal-row--readonly' : ''}`}
      data-testid={`${testIdPrefix}-row-${varKey}`}
    >
      <code className="em-vars-modal-key">{`{{${varKey}}}`}</code>
      {overridden && <span className="em-vars-modal-overridden-tag" title="Overridden by an environment variable">overridden</span>}
      <input
        className="em-vars-modal-value"
        value={value}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        aria-label={`Value for ${varKey}`}
        onChange={(e) => onChange?.(e.target.value)}
        data-testid={`${testIdPrefix}-value-${varKey}`}
      />
      {!readOnly && onDelete && (
        <button
          type="button"
          className="btn btn-xs btn-danger em-vars-modal-delete"
          onClick={onDelete}
          aria-label={`Delete ${varKey}`}
          data-testid={`${testIdPrefix}-delete-${varKey}`}
        >×</button>
      )}
    </div>
  );
}
