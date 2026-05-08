/**
 * Format a timestamp as a short locale string (e.g. "Jan 5, 02:30 PM").
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export type FormatRelativeTimeOptions = {
  /** "long" uses "5 min ago" instead of "5m ago". */
  minuteFormat?: 'compact' | 'long';
  /** "title" uses "Just now" instead of "just now". */
  justNow?: 'lower' | 'title';
};

/**
 * Format a timestamp as a human-readable relative time string (e.g. "3m ago", "2h ago").
 * For timestamps older than 7 days, uses the optional fallback formatter or returns "${days}d ago".
 */
export function formatRelativeTime(
  ts: number,
  fallback?: (ts: number) => string,
  options?: FormatRelativeTimeOptions
): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const justNow = options?.justNow === 'title' ? 'Just now' : 'just now';
  if (mins < 1) return justNow;
  if (mins < 60) {
    return options?.minuteFormat === 'long' ? `${mins} min ago` : `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7 || !fallback) return `${days}d ago`;
  return fallback(ts);
}

/**
 * Wall-clock time with seconds (locale-aware).
 */
export function formatTimeWithSeconds(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Compact duration: milliseconds or seconds with one decimal. */
export function formatDurationCompactMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
