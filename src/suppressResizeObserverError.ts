/**
 * Swallow known benign browser / editor console noise that is not an app bug:
 * - Chromium ResizeObserver nested-layout Error events (Vite overlays otherwise)
 * - Monaco / @monaco-editor/react cancelation rejections when editors remount
 *   (React StrictMode, tab switches) — `{ type: 'cancelation', msg: '...' }`
 */

function isResizeObserverNoise(reasonOrMessage: unknown): boolean {
  const msg = reasonOrMessage instanceof Error
    ? reasonOrMessage.message
    : String(reasonOrMessage ?? '');
  return msg.includes('ResizeObserver');
}

/** Monaco rejects cancelled work with a plain object (not Error) — Chrome shows "Object". */
function isMonacoCancelation(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const r = reason as { type?: unknown; name?: unknown; msg?: unknown; message?: unknown };
  if (r.type === 'cancelation' || r.type === 'cancellation') return true;
  if (r.name === 'Canceled' || r.name === 'Cancelled') return true;
  const msg = String(r.msg ?? r.message ?? '');
  return (
    msg.includes('operation is manually canceled')
    || msg.includes('operation is manually cancelled')
  );
}

function isBenignConsoleNoise(event: Event): boolean {
  if (event.type === 'unhandledrejection') {
    const reason = (event as PromiseRejectionEvent).reason;
    return isResizeObserverNoise(reason) || isMonacoCancelation(reason);
  }
  const e = event as ErrorEvent;
  const m = e.message
    || (e.error instanceof Error ? e.error.message : e.error != null ? String(e.error) : '');
  return isResizeObserverNoise(m) || isMonacoCancelation(e.error);
}

function swallowBenignConsoleNoise(event: Event) {
  if (!isBenignConsoleNoise(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

window.addEventListener('error', swallowBenignConsoleNoise, true);
window.addEventListener('unhandledrejection', swallowBenignConsoleNoise, true);
