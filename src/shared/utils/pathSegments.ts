/** Split a slash-delimited path into non-empty segments. */
export function splitPathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}
