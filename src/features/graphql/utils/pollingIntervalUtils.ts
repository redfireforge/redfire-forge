/** Schema polling interval bounds (seconds) — shared by tab persistence and connection bar. */
export const MIN_POLL_SECONDS = 10;
export const MAX_POLL_SECONDS = 3600;

export function clampPollingIntervalSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_POLL_SECONDS;
  return Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, Math.round(seconds)));
}
