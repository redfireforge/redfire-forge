/** Generate a short random base36 identifier. */
export function randomBase36Id(length = 8): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

/** Generate an identifier with a fixed prefix and short random suffix. */
export function prefixedRandomId(prefix: string, length = 8): string {
  return `${prefix}${randomBase36Id(length)}`;
}
