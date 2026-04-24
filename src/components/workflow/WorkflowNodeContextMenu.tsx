interface Props {
  open: boolean;
  x: number;
  y: number;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function WorkflowNodeContextMenu({
  open,
  x,
  y,
  onCopy,
  onDuplicate,
  onDelete,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <>
      <div className="wf-node-ctx-backdrop" onClick={onClose} role="presentation" />
      <div
        className="wf-node-ctx-menu"
        style={{ left: x, top: y }}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        {onCopy && (
          <button
            type="button"
            className="wf-node-ctx-item"
            role="menuitem"
            onClick={() => { onCopy(); onClose(); }}
          >
            <span>Copy</span>
            <span className="wf-node-ctx-shortcut">⌘C</span>
          </button>
        )}
        {onDuplicate && (
          <button
            type="button"
            className="wf-node-ctx-item"
            role="menuitem"
            onClick={() => { onDuplicate(); onClose(); }}
          >
            <span>Duplicate</span>
            <span className="wf-node-ctx-shortcut">⌘D</span>
          </button>
        )}
        {(onCopy || onDuplicate) && <div className="wf-node-ctx-sep" />}
        <button
          type="button"
          className="wf-node-ctx-item wf-node-ctx-item-danger"
          role="menuitem"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <span>Delete Node</span>
          <span className="wf-node-ctx-shortcut">⌫</span>
        </button>
      </div>
    </>
  );
}
