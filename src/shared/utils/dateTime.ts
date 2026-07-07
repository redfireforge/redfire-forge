/** Return today's date in UTC as YYYY-MM-DD. */
export function utcDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Convert an ISO timestamp into a filename-safe string. */
export function toFilenameTimestamp(
  iso: string = new Date().toISOString(),
  options: { includeMilliseconds?: boolean } = {},
): string {
  const safe = iso.replace(/[:.]/g, '-');
  if (options.includeMilliseconds === false) {
    return safe.slice(0, 19);
  }
  return safe;
}

/** Build a filename-safe timestamp for the current time. */
export function nowFilenameTimestamp(options: { includeMilliseconds?: boolean } = {}): string {
  return toFilenameTimestamp(new Date().toISOString(), options);
}
