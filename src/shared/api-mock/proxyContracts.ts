/**
 * Phase 9 — proxy settings contract (capability-gated runtime; default-deny).
 */

export interface ApiMockProxySettingsV1 {
  /** When false, no outbound proxy occurs regardless of fallback.mode. */
  enabled: boolean;
  /** Host+scheme origins only (e.g. https://api.example.com). No wildcards. */
  allowlist: string[];
  blockPrivateNetworks: boolean;
  maxRedirects: number;
  stripHopByHop: boolean;
  /** When true, credential headers listed in forwardCredentialHeaders may be forwarded. */
  forwardAuth: boolean;
  forwardCredentialHeaders: string[];
  timeoutMs: number;
  maxResponseBytes: number;
  /** When true, successful proxied exchanges are suitable for inactive draft capture. */
  recordAsDrafts: boolean;
}

export const DEFAULT_PROXY_SETTINGS: ApiMockProxySettingsV1 = {
  enabled: false,
  allowlist: [],
  blockPrivateNetworks: true,
  maxRedirects: 5,
  stripHopByHop: true,
  forwardAuth: false,
  forwardCredentialHeaders: [],
  timeoutMs: 10_000,
  maxResponseBytes: 1_048_576,
  recordAsDrafts: true,
};

export const PROXY_HARD_CEILINGS = {
  maxRedirects: 10,
  timeoutMs: 60_000,
  maxResponseBytes: 10_485_760,
  maxConcurrentOutbound: 50,
} as const;

export const HAR_IMPORT_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxEntries: 5_000,
} as const;
