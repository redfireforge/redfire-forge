/**
 * HAR variable chain detection (Track A — L-10, Phase 4).
 *
 * Analyses a sequence of ParsedHarEntry objects and detects when a JSON field
 * in one entry's response body appears as a URL path segment in a later entry.
 * When a match is found, the downstream URL is parameterized with {{varName}}
 * and an Extraction is recorded so harToWorkflow can add it to the source node.
 *
 * Design constraints:
 * - Only top-level string/number JSON fields are matched (no deep traversal).
 * - Values shorter than 3 characters are skipped (too likely to produce false positives).
 * - A downstream entry is only searched up to 2 positions ahead to limit noise.
 * - Each field name produces at most one chain link (first match wins).
 * - URLs use {{varName}} (double braces) to match the RedfireForge template syntax.
 * - The function never throws — non-JSON responses are silently skipped.
 */

import type { Extraction } from '@shared/types';
import type { ParsedHarEntry } from './harParser';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChainLink {
  /** Index (within the original entries array) of the entry whose response contains the value */
  sourceIndex: number;
  /** Index of the entry whose URL was parameterized */
  targetIndex: number;
  /** JSONPath expression referencing the extracted field e.g. "$.userId" */
  jsonPath: string;
  /** camelCase variable name e.g. "userId" */
  variableName: string;
  /** Literal value that was matched e.g. "u-99" */
  matchedValue: string;
  /** The path segment that was replaced e.g. "u-99" */
  originalSegment: string;
  /**
   * Ready-to-use Extraction object for the source HTTP node's scenario.extractions[].
   * Source is always 'body'; expression is the JSONPath.
   */
  extraction: Extraction;
}

export interface ChainDetectionResult {
  /**
   * Entry array with downstream paths/URLs replaced by {{varName}} references.
   * Length is always equal to the input entries length.
   */
  entries: ParsedHarEntry[];
  /** All detected chain links in source order */
  chains: ChainLink[];
  /**
   * Human-readable summary lines for display in the HAR import preview modal.
   * Always has at least one entry.
   */
  summary: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum value length to consider for matching (avoid false positives on short IDs) */
const MIN_VALUE_LENGTH = 3;

/** How many steps ahead to search for a matching URL segment */
const MAX_LOOK_AHEAD = 2;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Detect variable chains across HAR entries.
 *
 * Returns a ChainDetectionResult whose `entries` array has parameterized URLs
 * and whose `chains` array provides Extraction objects ready to be attached to
 * the corresponding source HTTP nodes in harToWorkflow.
 */
export function detectChains(entries: ParsedHarEntry[]): ChainDetectionResult {
  if (entries.length < 2) {
    return {
      entries: [...entries],
      chains: [],
      summary: ['No variable chains detected (fewer than 2 entries).'],
    };
  }

  const chains: ChainLink[] = [];
  // Work on mutable copies so we can update paths in-place as chains are detected
  const modifiedEntries: ParsedHarEntry[] = entries.map((e) => ({ ...e }));

  for (let i = 0; i < entries.length - 1; i++) {
    const source = entries[i]; // always read from original (never mutated)
    if (!source.responseBody) continue;

    let responseJson: Record<string, unknown>;
    try {
      responseJson = JSON.parse(source.responseBody) as Record<string, unknown>;
    } catch {
      continue;
    }

    // Only match flat objects (not arrays at root level)
    if (Array.isArray(responseJson) || typeof responseJson !== 'object') continue;

    for (const [fieldName, fieldValue] of Object.entries(responseJson)) {
      // Only match string and number scalar values
      if (typeof fieldValue !== 'string' && typeof fieldValue !== 'number') continue;

      const valueStr = String(fieldValue).trim();
      if (valueStr.length < MIN_VALUE_LENGTH) continue;

      // Search up to MAX_LOOK_AHEAD entries ahead
      const limit = Math.min(i + 1 + MAX_LOOK_AHEAD, entries.length);
      for (let j = i + 1; j < limit; j++) {
        const target = modifiedEntries[j];
        const segments = target.path.split('/').filter(Boolean);
        const matchedSegment = segments.find((seg) => seg === valueStr);

        if (!matchedSegment) continue;

        const varName = toVariableName(fieldName);

        // Replace only the first occurrence of /value in the path
        const newPath = replaceFirstSegment(target.path, matchedSegment, varName);
        const newUrl = target.url.replace(target.path, newPath);

        modifiedEntries[j] = {
          ...target,
          path: newPath,
          url: newUrl,
        };

        const extraction: Extraction = {
          name: varName,
          source: 'body',
          expression: `$.${fieldName}`,
        };

        chains.push({
          sourceIndex: i,
          targetIndex: j,
          jsonPath: `$.${fieldName}`,
          variableName: varName,
          matchedValue: valueStr,
          originalSegment: matchedSegment,
          extraction,
        });

        // One chain link per field name — move to next field
        break;
      }
    }
  }

  const summary =
    chains.length > 0
      ? chains.map(
          (c) =>
            `Step ${c.sourceIndex + 1} → Step ${c.targetIndex + 1}: ${c.jsonPath} → ${`{{${c.variableName}}}`}`,
        )
      : ['No variable chains detected.'];

  return {
    entries: modifiedEntries,
    chains,
    summary,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Convert a JSON field name to a safe camelCase variable name.
 * Strips non-alphanumeric characters and lowercases the first letter.
 * If the result is empty or starts with a digit, falls back to "value".
 *
 * Examples:
 *   "userId"   → "userId"
 *   "user_id"  → "userid"  (underscore stripped, not converted to camelCase)
 *   "user-id"  → "userid"  (hyphen stripped)
 *   "42abc"    → "abc"     (leading digits stripped)
 *   "42"       → "value"   (all digits → empty after strip → fallback)
 *   ""         → "value"
 */
export function toVariableName(fieldName: string): string {
  const cleaned = fieldName
    .replace(/[^a-zA-Z0-9]/g, '') // strip non-alphanumeric
    .replace(/^[0-9]+/, '');      // strip leading digits

  if (!cleaned) return 'value';

  // Lowercase the first character (camelCase start)
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

/**
 * Replace the first occurrence of `/segment` in a path with `/{{varName}}`.
 * Only replaces exact segment boundaries (between slashes), not substrings.
 *
 * Example:
 *   replaceFirstSegment('/orders/ord-42/items', 'ord-42', 'orderId')
 *   → '/orders/{{orderId}}/items'
 */
export function replaceFirstSegment(path: string, segment: string, varName: string): string {
  // Match /segment at any position, ensuring segment boundaries
  const escaped = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return path.replace(new RegExp(`(^|/)${escaped}($|/)`, ''), `$1{{${varName}}}$2`);
}
