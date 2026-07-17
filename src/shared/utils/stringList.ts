/** Parse a comma-separated string into trimmed, non-empty entries. */
export function parseCommaSeparatedList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}
