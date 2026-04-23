export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Escape special regex characters so the string can be used in `new RegExp(...)`. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract a human-readable message from an unknown caught value. */
export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Deep-clone a plain JSON-safe value. */
export function snapshot<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
