/**
 * Phase 9D — typed transforms + outbound callback contracts (default-deny).
 */

export type ApiMockTransformOp =
  | 'setHeader'
  | 'removeHeader'
  | 'appendHeader'
  | 'setStatus'
  | 'replaceBody';

export interface ApiMockTransformRuleV1 {
  id: string;
  enabled: boolean;
  /** Transforms apply to the selected mock response before delivery. */
  target: 'response';
  op: ApiMockTransformOp;
  /** Header name (set/remove/append) — unused for setStatus/replaceBody. */
  key?: string;
  /** Header value, status code string, or body template — may contain {{helpers}}. */
  value?: string;
}

export interface ApiMockCallbackV1 {
  id: string;
  enabled: boolean;
  /** Absolute URL — must appear in server settings.callbacks.allowlist. */
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Array<{ id: string; key: string; value: string; enabled: boolean }>;
  bodyTemplate: string;
  timeoutMs: number;
  /** 0–5; default 3. Exponential backoff 1s / 4s / 16s … */
  maxRetries: number;
}

export interface ApiMockCallbackSettingsV1 {
  /** Strict absolute URL allowlist (no wildcards). Empty = all callbacks blocked. */
  allowlist: string[];
}

export const DEFAULT_CALLBACK_SETTINGS: ApiMockCallbackSettingsV1 = {
  allowlist: [],
};

export const CALLBACK_HARD_CEILINGS = {
  maxRetries: 5,
  timeoutMs: 60_000,
  maxBodyBytes: 256 * 1024,
  defaultBodyBytes: 64 * 1024,
  maxConcurrentOutbound: 50,
  defaultConcurrentOutbound: 10,
} as const;

export const DEFAULT_CALLBACK: Omit<ApiMockCallbackV1, 'id'> = {
  enabled: false,
  url: '',
  method: 'POST',
  headers: [],
  bodyTemplate: '{"event":"mock.matched","path":"{{request.path}}"}',
  timeoutMs: 10_000,
  maxRetries: 3,
};
