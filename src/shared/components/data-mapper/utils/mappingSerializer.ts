/**
 * Generic mapping serialization/deserialization via adapters.
 *
 * The mapper core stores mappings in a generic `Mapping[]` format.
 * Each adapter defines how to convert between this generic format
 * and its feature-specific output (e.g., Extraction[], ExpectedField[], etc.).
 */

import type { Mapping, MapperAdapter, ValidationIssue } from '../types';

/**
 * Serialize the current mapping state into a feature-specific output
 * using the provided adapter.
 */
export function serializeMappings<TOutput>(
  adapter: MapperAdapter<TOutput>,
  mappings: Mapping[],
): TOutput {
  return adapter.serialize(mappings);
}

/**
 * Deserialize feature-specific data back into generic Mapping objects
 * using the provided adapter.
 */
export function deserializeMappings<TOutput>(
  adapter: MapperAdapter<TOutput>,
  existing: TOutput,
): Mapping[] {
  return adapter.deserialize(existing);
}

/**
 * Validate mappings using the adapter's custom validation rules.
 * Returns an empty array if no custom validator is provided.
 */
export function validateMappings<TOutput>(
  adapter: MapperAdapter<TOutput>,
  mappings: Mapping[],
): ValidationIssue[] {
  return adapter.validate?.(mappings) ?? [];
}

/**
 * Round-trip test utility: serialize then deserialize and compare.
 * Useful for adapter development and testing.
 */
export function roundTripMappings<TOutput>(
  adapter: MapperAdapter<TOutput>,
  mappings: Mapping[],
): { output: TOutput; restored: Mapping[]; lossless: boolean } {
  const output = serializeMappings(adapter, mappings);
  const restored = deserializeMappings(adapter, output);
  const lossless =
    mappings.length === restored.length &&
    mappings.every((m) =>
      restored.some(
        (r) =>
          r.sourcePath === m.sourcePath &&
          r.sourceId === m.sourceId &&
          r.targetPath === m.targetPath &&
          r.expression === m.expression,
      ),
    );
  return { output, restored, lossless };
}
