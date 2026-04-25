interface Props {
  expanded: boolean;
  onToggle: () => void;
  position?: 'header' | 'footer';
}

export default function ModalExpandButton({ expanded, onToggle, position = 'header' }: Props) {
  return (
    <button
      type="button"
      className={`modal-expand-btn ${position === 'footer' ? 'modal-expand-btn-bottom' : ''}`}
      onClick={onToggle}
      aria-label={expanded ? 'Shrink modal' : 'Expand modal'}
      title={expanded ? 'Shrink modal' : 'Expand modal'}
    >
      {expanded ? '⊖' : '⊕'}
    </button>
  );
}
