/**
 * Returns true when the app is running inside a Tauri desktop shell.
 * Works both at startup and after dynamic import of @tauri-apps/api.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Returns true when running in a Node.js environment (CLI mode).
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

/**
 * Returns true when the current environment supports Web Workers.
 */
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}
