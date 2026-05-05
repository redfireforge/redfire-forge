/**
 * Format a timestamp as a short locale string (e.g. "Jan 5, 02:30 PM").
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Format a timestamp as a human-readable relative time string (e.g. "3m ago", "2h ago").
 * For timestamps older than 7 days, uses the optional fallback formatter or returns "${days}d ago".
 */
export function formatRelativeTime(ts: number, fallback?: (ts: number) => string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7 || !fallback) return `${days}d ago`;
  return fallback(ts);
}
