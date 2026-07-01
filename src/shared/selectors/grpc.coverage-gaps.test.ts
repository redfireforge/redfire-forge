/**
 * Coverage gaps — grpc.ts selector factories
 */
import { describe, expect, it } from 'vitest';
import { GRPC } from './grpc';

const SAMPLE_ARGS: Record<string, unknown[]> = {
  TAB: ['tab-1'],
  TAB_CLOSE: ['tab-1'],
  TAB_DUPLICATE: ['tab-1'],
  TAB_PANE: ['tab-1'],
  SETTINGS_NAV_ITEM: ['general'],
  SETTINGS_PANEL: ['general'],
  TRANSPORT_MODE: ['grpc'],
  PROTO_ONEOF: ['payload'],
  PROTO_ONEOF_RADIO: ['payload', 'text'],
  TLS_MODE: ['plaintext'],
  SPRING_HINT: ['hint-1'],
  SPRING_HINT_DISMISS: ['hint-1'],
  SECRET_FIELD_STORED_HINT: ['grpc-secret'],
  SECRET_FIELD_CLEAR: ['grpc-secret'],
  AUTH_TYPE_PILL: ['bearer'],
  SCHEMA_DRIFT_REBIND: ['demo.Echo', 'SayHello'],
  PROTO_FIELD_INPUT: ['message'],
  RESPONSE_TIMING_ROW: ['dns'],
  STREAM_PENDING_ITEM: [0],
  STREAM_PENDING_REMOVE: [1],
  CALL_TYPE_TAB: ['unary'],
  TAB_CALL_TYPE_PILL: ['tab-1'],
  SERVICE: ['demo.EchoService'],
  METHOD: ['demo.EchoService', 'SayHello'],
  COLLECTION_GROUP: ['col-1'],
  COLLECTION_SAVED_REQUEST: ['saved-1'],
  HISTORY_ENTRY: ['entry-1'],
  ADVANCED_TAB: ['load-test'],
};

describe('grpc selectors coverage gaps', () => {
  it('invokes every dynamic selector factory', () => {
    for (const [key, value] of Object.entries(GRPC)) {
      if (typeof value !== 'function') continue;
      const args = SAMPLE_ARGS[key] ?? ['sample'];
      const selector = (value as (...a: unknown[]) => string)(...args);
      expect(selector).toMatch(/\[data-testid=/);
    }
  });

  it('normalizes service and method names in selectors', () => {
    expect(GRPC.SERVICE('demo.Echo.Service')).toBe('[data-testid="grpc-service-demo-echo-service"]');
    expect(GRPC.METHOD('demo.Echo.Service', 'Say.Hello')).toBe('[data-testid="grpc-method-demo-echo-service-say-hello"]');
    expect(GRPC.SCHEMA_DRIFT_REBIND('demo.Echo', 'SayHello')).toBe('[data-testid="grpc-schema-drift-rebind-demo-Echo-SayHello"]');
  });
});
