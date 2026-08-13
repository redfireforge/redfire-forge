/**
 * Explicit native (Tauri Rust) vs Node companion capability differences (Phase 10E).
 * Mirrors `src-tauri/src/api_mock/capabilities.rs` so the Studio can warn before Start/Apply.
 */
import type { ApiMockPredicateGroupV1, ApiMockServerDefinitionV1 } from './contracts';

/** Operators the native listener still fail-closes. Empty after xpath/xml/multipart parity. */
export const NATIVE_UNAVAILABLE_OPERATORS: readonly string[] = [];

export interface NativeCapabilityWarning {
  code: string;
  message: string;
}

export function analyzeNativeUnsupported(def: ApiMockServerDefinitionV1): NativeCapabilityWarning[] {
  const out: NativeCapabilityWarning[] = [];
  const seen = new Set<string>();
  for (const route of def.routes) {
    collectOps(route.predicates, seen);
    for (const variant of route.responses) {
      if (variant.conditions) collectOps(variant.conditions, seen);
    }
  }
  for (const op of seen) {
    if (NATIVE_UNAVAILABLE_OPERATORS.includes(op)) {
      out.push({
        code: 'NATIVE_UNAVAILABLE_OPERATOR',
        message: `Predicate operator "${op}" is not evaluated on the native listener (fail-closed).`,
      });
    }
  }
  return out;
}

function collectOps(group: ApiMockPredicateGroupV1, out: Set<string>): void {
  for (const child of group.children) {
    if ('combinator' in child) collectOps(child, out);
    else out.add(child.operator);
  }
}
