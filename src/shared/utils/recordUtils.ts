/** Returns true when `value` is nullish or has no own enumerable keys. */
export function isEmptyRecord(value: Record<string, unknown> | null | undefined): boolean {
  return !value || Object.keys(value).length === 0;
}
