/**
 * multipartParser.ts — Sprint 7 (2D-1)
 *
 * Parses `multipart/mixed` HTTP responses produced by GraphQL servers that
 * support `@defer` and `@stream` incremental delivery.
 *
 * Uses the `meros` library to split the ReadableStream body into
 * boundary-separated JSON parts, then applies each incremental patch
 * to the accumulated merged result.
 *
 * Protocol (RFC 1341 multipart + GraphQL incremental delivery spec):
 *   Part 1 — {"data": {...}, "hasNext": true}               ← initial chunk
 *   Part 2 — {"incremental": [{"path": [...], "data": {...}}], "hasNext": true}
 *   Part N — {"incremental": [...], "hasNext": false}        ← final chunk
 */

import { meros } from 'meros/browser';
import type { IncrementalDeliveryResult, GraphqlError } from '../../../shared/types/graphql';

// ─── Patch merge ──────────────────────────────────────────────────────────────

/**
 * Apply a single incremental patch to an accumulated result at the given path.
 *
 * The path is an array of string or number keys, e.g. ["user", "orders", 0].
 * Returns a new deeply-cloned value with the patch applied.
 * Returns `base` unchanged if the path cannot be navigated (type mismatch).
 */
export function applyPatch(
  base: unknown,
  path: Array<string | number>,
  data: unknown,
): unknown {
  if (path.length === 0) return data;

  const [key, ...rest] = path;

  if (typeof key === 'number') {
    if (!Array.isArray(base)) return base;
    const arr = [...base];
    arr[key] = applyPatch(arr[key], rest, data);
    return arr;
  }

  if (typeof key === 'string') {
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return base;
    const obj = base as Record<string, unknown>;
    return { ...obj, [key]: applyPatch(obj[key], rest, data) };
  }

  return base;
}

// ─── Multipart stream parser ─────────────────────────────────────────────────

/**
 * Parses a `multipart/mixed` fetch Response using `meros`.
 *
 * Calls `onChunk` for every part received, including the initial chunk.
 * The `merged` field in each callback argument contains the fully-merged
 * accumulated result up to and including that chunk.
 *
 * Resolves when the stream ends (`hasNext: false`) or is aborted.
 * Rejects with an Error if parsing fails.
 *
 * @param response  A fetch Response with Content-Type: multipart/mixed.
 * @param onChunk   Called once per received chunk with the merged result.
 */
export async function parseMultipartMixed(
  response: Response,
  onChunk: (result: IncrementalDeliveryResult) => void,
): Promise<void> {
  type RawPart = {
    hasNext?: boolean;
    data?: unknown;
    errors?: GraphqlError[];
    extensions?: Record<string, unknown>;
    incremental?: Array<{
      path?: Array<string | number>;
      data?: unknown;
      errors?: GraphqlError[];
    }>;
  };

  let merged: unknown = undefined;
  let patchIndex = 0;

  const parts = await meros<RawPart>(response);

  // meros returns the Response itself when content-type is not multipart/mixed.
  // The caller should check Content-Type before calling this function, but guard anyway.
  if (!(Symbol.asyncIterator in Object(parts))) return;

  for await (const part of parts as AsyncGenerator<import('meros').Part<RawPart, string>>) {
    if (!part.json) continue; // skip non-JSON parts (boundary-only, etc.)
    const body = part.body as RawPart;
    if (typeof body !== 'object' || body === null) continue;

    const hasNext = body.hasNext ?? false;

    if (patchIndex === 0) {
      // Initial chunk: body.data holds the initial partial result
      merged = body.data ?? null;
      onChunk({
        type: 'initial',
        patchIndex: 0,
        merged,
        hasNext,
        errors: Array.isArray(body.errors) ? body.errors : undefined,
        extensions: body.extensions,
      });
    } else {
      // Incremental patch chunk: body.incremental is an array of patches
      if (Array.isArray(body.incremental)) {
        for (const patch of body.incremental) {
          const patchPath = Array.isArray(patch.path) ? patch.path : [];
          merged = applyPatch(merged, patchPath, patch.data);
        }
      }
      onChunk({
        type: 'patch',
        patchIndex,
        merged,
        hasNext,
        errors: Array.isArray(body.errors) ? body.errors : undefined,
        extensions: body.extensions,
      });
    }

    patchIndex++;

    if (!hasNext) break;
  }
}
