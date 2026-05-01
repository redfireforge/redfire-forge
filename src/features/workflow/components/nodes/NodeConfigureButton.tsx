/**
 * Shared configure/edit button used in workflow node cards.
 * Extracts the duplicated pencil-icon SVG that was repeated across 13+ node components.
 */

const EDIT_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const OPEN_EXTERNAL_SVG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

interface NodeConfigureButtonProps {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  variant?: 'edit' | 'open';
}

export function NodeConfigureButton({ title, onClick, className, variant = 'edit' }: NodeConfigureButtonProps) {
  return (
    <button
      type="button"
      className={`wf-node-configure-badge${className ? ` ${className}` : ''}`}
      title={title}
      onClick={onClick}
    >
      {variant === 'open' ? OPEN_EXTERNAL_SVG : EDIT_SVG}
    </button>
  );
}
