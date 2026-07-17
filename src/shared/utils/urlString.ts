/** Return URL/path content without a query string portion. */
export function stripQueryString(value: string): string {
  return value.split('?')[0];
}
