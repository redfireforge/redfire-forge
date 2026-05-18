import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function ConfigSectionGroup({ title, count, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="wf-config-group">
      <button
        type="button"
        className={`wf-config-group-header${open ? '' : ' collapsed'}`}
        onClick={() => setOpen(v => !v)}
      >
        <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
        <span className="wf-config-group-title">{title}</span>
        {count != null && <span className="wf-config-group-count">{count}</span>}
      </button>
      <div className="wf-config-group-body">{children}</div>
    </div>
  );
}
