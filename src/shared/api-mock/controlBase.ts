/**
 * Base URL for the companion's `/api/mock/*` control routes.
 *
 * Tauri serves the app from `tauri://localhost`, where a relative `/api/...`
 * path is answered by the asset protocol's SPA fallback — it returns
 * `index.html` with HTTP 200 rather than failing, so callers see a confusing
 * "Request failed (200)". The webview can reach the companion directly, so an
 * absolute URL is used there.
 *
 * Everywhere else an empty string keeps requests same-origin, which the Vite
 * dev proxy and the production server already route to port 3001.
 */
import { isTauri } from '../utils/platform';

const COMPANION_ORIGIN = 'http://127.0.0.1:3001';

export function apiMockControlBase(): string {
  if (isTauri()) return COMPANION_ORIGIN;
  // Node (CLI, workflow engine) has no origin to be relative to.
  if (typeof window === 'undefined' || !window.location?.origin) return COMPANION_ORIGIN;
  return '';
}
