/**
 * Explicit native (Tauri Rust) vs Node companion capability differences (Phase 10E).
 * Mirrors `src-tauri/src/api_mock/capabilities.rs` so the Studio can warn before Start/Apply.
 */
import type { ApiMockPredicateGroupV1, ApiMockServerDefinitionV1 } from './contracts';

export const NATIVE_UNAVAILABLE_OPERATORS = [
  'xpath_exists',
  'xpath_equals',
  'xmlSchema',
  'multipart_field',
  'multipart_file',
] as const;

export interface NativeCapabilityWarning {
  code: string;
  message: string;
}

export function analyzeNativeUnsupported(def: ApiMockServerDefinitionV1): NativeCapabilityWarning[] {
  const out: NativeCapabilityWarning[] = [];
  if (def.settings.tls?.enabled) {
    out.push({
      code: 'NATIVE_NO_HTTP2',
      message: 'Native HTTPS serves HTTP/1.1 only (no h2 ALPN). Use the Node companion for HTTP/2.',
    });
    if (def.settings.tls.passphrase) {
      out.push({
        code: 'NATIVE_NO_KEY_PASSPHRASE',
        message: 'Passphrase-protected TLS keys are not supported on the native listener.',
      });
    }
  }
  if (def.settings.proxy?.enabled || def.settings.fallback.mode === 'proxy') {
    out.push({
      code: 'NATIVE_NO_PROXY',
      message: 'Unmatched proxy and recording are not available on the native listener.',
    });
  }
  if (
    (def.settings.callbacks?.allowlist?.length ?? 0) > 0
    || def.routes.some(r => r.responses.some(v => (v.callbacks?.length ?? 0) > 0))
  ) {
    out.push({
      code: 'NATIVE_NO_CALLBACKS',
      message: 'Outbound callbacks are not delivered by the native listener.',
    });
  }
  if (def.routes.some(r => r.responses.some(v => (v.transforms?.length ?? 0) > 0))) {
    out.push({
      code: 'NATIVE_NO_TRANSFORMS',
      message: 'Response transforms are skipped on the native listener.',
    });
  }
  if (def.settings.journal.persistToDisk) {
    out.push({
      code: 'NATIVE_NO_JOURNAL_DISK',
      message: 'Journal persistToDisk is ignored on the native listener.',
    });
  }
  if (def.routes.some(r => r.responses.some(v =>
    v.body.content.includes('{{faker') || v.headers.some(h => h.value.includes('{{faker')),
  ))) {
    out.push({
      code: 'NATIVE_NO_FAKER',
      message: 'Faker template helpers are empty on the native listener.',
    });
  }
  if (def.routes.some(r => r.responses.some(v => {
    const fault = v.behavior.fault;
    return fault === 'malformed' || fault === 'reset' || fault === 'dribble'
      || (v.behavior.chunkSchedule?.length ?? 0) > 0;
  }))) {
    out.push({
      code: 'NATIVE_LIMITED_FAULTS',
      message: 'Native faults support delay, timeout, and close only (no malformed/reset/dribble).',
    });
  }
  const seen = new Set<string>();
  for (const route of def.routes) {
    collectOps(route.predicates, seen);
    for (const variant of route.responses) {
      if (variant.conditions) collectOps(variant.conditions, seen);
    }
  }
  for (const op of seen) {
    if ((NATIVE_UNAVAILABLE_OPERATORS as readonly string[]).includes(op)) {
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
