/**
 * Returns true when the app is running inside a Tauri desktop shell.
 * Works both at startup and after dynamic import of @tauri-apps/api.
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}
