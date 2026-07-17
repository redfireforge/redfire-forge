import { useState, useEffect, Suspense } from 'react';
import type { ComponentType } from 'react';

/**
 * Dev-only overlay for the Rust executor integration test panel.
 * Extracted from App.tsx to reduce component size.
 */
export default function RustTestPanelOverlay({ Panel }: { Panel: ComponentType }) {
  const [show, setShow] = useState(() => new URLSearchParams(window.location.search).has('rust-test'));
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setShow(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, overflow: 'auto', background: 'var(--background, #0d1117)' }}>
      <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 1 }}>
        <button onClick={() => setShow(false)} style={{ background: 'none', border: '1px solid var(--border, #30363d)', color: 'var(--text-muted, #8b949e)', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>
          Close (Cmd+Shift+T)
        </button>
      </div>
      <Suspense fallback={<div style={{ padding: 20, color: '#8b949e' }}>Loading test panel...</div>}>
        <Panel />
      </Suspense>
    </div>
  );
}
