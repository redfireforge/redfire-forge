/**
 * Shared template variable helpers used by both engine and feature layers.
 */

/** Returns true when the value is a single `{{varName}}` placeholder (with optional whitespace). */
export function isTemplateToken(value: string): boolean {
  return /^\s*\{\{[^{}]+\}\}\s*$/.test(value);
}

/** Decode URL-encoded curly braces (`%7B` / `%7D`) back to literal `{` and `}`. */
export function decodeTemplateBraces(value: string): string {
  return value
    .replace(/%7B/gi, '{')
    .replace(/%7D/gi, '}');
}
