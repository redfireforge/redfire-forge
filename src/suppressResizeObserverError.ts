/**
 * Chromium may report ResizeObserver nested layout as an Error event; it is not an app bug.
 * Vite’s dev client forwards it and clutters the overlay otherwise.
 * Message shape varies (event.message vs event.error.message; sometimes not at line start).
 */
function isResizeObserverNoise(event: Event): boolean {
  if (event.type === 'unhandledrejection') {
    const r = (event as PromiseRejectionEvent).reason;
    const msg = r instanceof Error ? r.message : String(r ?? '');
    return msg.includes('ResizeObserver');
  }
  const e = event as ErrorEvent;
  const m = e.message
    || (e.error instanceof Error ? e.error.message : e.error != null ? String(e.error) : '');
  return typeof m === 'string' && m.includes('ResizeObserver');
}

function swallowResizeObserverNoise(event: Event) {
  if (!isResizeObserverNoise(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

window.addEventListener('error', swallowResizeObserverNoise, true);
window.addEventListener('unhandledrejection', swallowResizeObserverNoise, true);
