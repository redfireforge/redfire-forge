/**
 * multipartBuilder — builds a `multipart/form-data` FormData payload
 * conforming to the graphql-multipart-request-spec v2.
 *
 * Spec: https://github.com/jaydenseric/graphql-multipart-request-spec
 *
 * Structure:
 *   FormData {
 *     "operations": JSON string of { query, variables }  ← variables have null at file slots
 *     "map":        JSON string of { "0": ["variables.avatar"], "1": ["variables.files.0"] }
 *     "0":          <File blob>
 *     "1":          <File blob>
 *     ...
 *   }
 *
 * Phase 2.0 Sprint 4 — 2E-2
 */

import { setByPath } from '@shared/utils/jsonPath';

export interface FileEntry {
  /** Unique identifier within the current Files tab session (for React keys). */
  id: string;
  /** The actual File object chosen by the user. */
  file: File;
  /**
   * Dot-notation path within the variables object where this file should be placed.
   * Examples: "avatar", "files.0", "input.profilePicture"
   * Leading "variables." prefix is optional — it will be added automatically.
   */
  varPath: string;
  /** Validation error message, if any. Null = valid. */
  error: string | null;
}

/**
 * Normalise the user-supplied variable path.
 *
 *   "avatar"                → "variables.avatar"
 *   "files.0"               → "variables.files.0"
 *   "variables.files.0"     → "variables.files.0"   (passthrough)
 *
 * The spec requires the path to start with "variables."
 */
function normaliseVarPath(raw: string): string {
  const p = raw.trim();
  if (p.startsWith('variables.')) return p;
  return `variables.${p}`;
}

/**
 * Returns true if there are any valid (non-errored) FileEntry objects.
 */
export function hasValidFiles(entries: FileEntry[]): boolean {
  return entries.some((e) => e.error === null && e.varPath.trim() !== '');
}

/**
 * Build a `multipart/form-data` FormData object for file upload per
 * the graphql-multipart-request-spec.
 *
 * Only entries without errors and with a non-empty varPath are included.
 *
 * @param query         - GraphQL query string
 * @param variables     - Variables object (must have null at each file slot
 *                        — this function fills those slots automatically)
 * @param fileEntries   - File entries from the Files tab
 * @returns FormData ready to be POSTed (Content-Type is set automatically by the browser)
 */
export function buildMultipartFormData(
  query: string,
  variables: Record<string, unknown>,
  fileEntries: FileEntry[],
): FormData {
  // Only include entries that are valid (no error, non-empty varPath)
  const valid = fileEntries.filter((e) => e.error === null && e.varPath.trim() !== '');

  // Deep-clone variables and set null at each file slot
  let clone: Record<string, unknown>;
  try {
    clone = JSON.parse(JSON.stringify(variables)) as Record<string, unknown>;
  } catch {
    clone = {};
  }

  // Build the map: { "0": ["variables.avatar"], "1": ["variables.files.0"] }
  const map: Record<string, string[]> = {};

  valid.forEach((entry, idx) => {
    const normPath = normaliseVarPath(entry.varPath);
    map[String(idx)] = [normPath];
    // Set null at the variable path (strip leading "variables.")
    const varSubPath = normPath.replace(/^variables\./, '');
    setByPath(clone, varSubPath, null);
  });

  const operations = JSON.stringify({
    query,
    variables: clone,
  });

  const form = new FormData();
  form.append('operations', operations);
  form.append('map', JSON.stringify(map));

  valid.forEach((entry, idx) => {
    form.append(String(idx), entry.file, entry.file.name);
  });

  return form;
}
