interface Props {
  open: boolean;
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

export default function WorkflowNodeContextMenu({
  open,
  x,
  y,
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
        <button
          type="button"
          className="wf-node-ctx-item wf-node-ctx-item-danger"
          role="menuitem"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Delete Node
        </button>
      </div>
    </>
  );
}
