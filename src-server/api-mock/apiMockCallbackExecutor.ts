/**
 * Phase 9D — outbound callbacks with allowlist, retries, and failure isolation.
 */
import {
  addAntiRecursionHeader,
  checkProxyUrl,
  type ProxyPolicyConfig,
} from '../../src/shared/api-mock/proxyPolicy.js';
import type { ApiMockCallbackV1, ApiMockCallbackSettingsV1 } from '../../src/shared/api-mock/callbackContracts.js';
import { CALLBACK_HARD_CEILINGS } from '../../src/shared/api-mock/callbackContracts.js';
import type { ApiMockTemplateContextV1 } from '../../src/shared/api-mock/contracts.js';
import { renderTemplate } from '../../src/shared/api-mock/templateEngine.js';
import { validateServerOutboundUrlWithDns } from '../grpc/serverOutboundUrlPolicy.js';

export interface CallbackFireResult {
  callbackId: string;
  ok: boolean;
  attempts: number;
  status?: number;
  error?: string;
}

const BACKOFF_MS = [1_000, 4_000, 16_000, 32_000, 60_000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildCtxBody(ctx: ApiMockTemplateContextV1 | undefined, template: string): string {
  if (!ctx || !template.includes('{{')) return template;
  try {
    return renderTemplate(template, ctx).output;
  } catch {
    return template;
  }
}

/**
 * Fire a single callback with retries. Never throws — always returns a result.
 * Caller must not await this before completing the mock HTTP response.
 */
export async function executeCallback(input: {
  callback: ApiMockCallbackV1;
  settings: ApiMockCallbackSettingsV1;
  activeMockPorts: number[];
  ctx?: ApiMockTemplateContextV1;
  blockPrivateNetworks?: boolean;
}): Promise<CallbackFireResult> {
  const { callback, settings, activeMockPorts, ctx } = input;
  if (!callback.enabled) {
    return { callbackId: callback.id, ok: false, attempts: 0, error: 'disabled' };
  }

  const url = callback.url.trim();
  if (!url) {
    return { callbackId: callback.id, ok: false, attempts: 0, error: 'empty url' };
  }
  if (!settings.allowlist.includes(url)) {
    return { callbackId: callback.id, ok: false, attempts: 0, error: 'URL not in callback allowlist' };
  }

  const timeoutMs = Math.min(Math.max(1, callback.timeoutMs), CALLBACK_HARD_CEILINGS.timeoutMs);
  const maxRetries = Math.min(Math.max(0, callback.maxRetries), CALLBACK_HARD_CEILINGS.maxRetries);
  const body = buildCtxBody(ctx, callback.bodyTemplate);
  if (Buffer.byteLength(body, 'utf8') > CALLBACK_HARD_CEILINGS.maxBodyBytes) {
    return { callbackId: callback.id, ok: false, attempts: 0, error: 'Callback body exceeds ceiling' };
  }

  const policyConfig: ProxyPolicyConfig = {
    allowedUpstreams: settings.allowlist,
    forwardCredentialHeaders: [],
    maxRedirects: 0,
    timeoutMs,
    maxResponseBytes: CALLBACK_HARD_CEILINGS.maxBodyBytes,
  };

  let attempts = 0;
  let lastError = 'unknown';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    const policy = checkProxyUrl(url, policyConfig, activeMockPorts);
    if (!policy.allowed) {
      return { callbackId: callback.id, ok: false, attempts, error: policy.reason };
    }

    if (input.blockPrivateNetworks !== false) {
      try {
        await validateServerOutboundUrlWithDns(url);
      } catch (e) {
        return {
          callbackId: callback.id,
          ok: false,
          attempts,
          error: e instanceof Error ? e.message : 'DNS/policy rejected callback URL',
        };
      }
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const h of callback.headers) {
      if (!h.enabled || !h.key) continue;
      headers[h.key] = ctx && h.value.includes('{{')
        ? (() => { try { return renderTemplate(h.value, ctx).output; } catch { return h.value; } })()
        : h.value;
    }
    const withAnti = addAntiRecursionHeader(headers);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: callback.method,
        headers: withAnti as Record<string, string>,
        body,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (res.status >= 200 && res.status < 300) {
        return { callbackId: callback.id, ok: true, attempts, status: res.status };
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'callback fetch failed';
    } finally {
      clearTimeout(timer);
    }

    if (attempt < maxRetries) {
      await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    }
  }

  return { callbackId: callback.id, ok: false, attempts, error: lastError };
}

/** Fire all enabled callbacks concurrently (bounded). Failures never throw. */
export async function executeCallbacks(input: {
  callbacks: ApiMockCallbackV1[] | undefined;
  settings: ApiMockCallbackSettingsV1;
  activeMockPorts: number[];
  ctx?: ApiMockTemplateContextV1;
  blockPrivateNetworks?: boolean;
}): Promise<CallbackFireResult[]> {
  const list = (input.callbacks ?? []).filter(c => c.enabled);
  if (list.length === 0) return [];
  const results = await Promise.all(list.map(callback => executeCallback({
    callback,
    settings: input.settings,
    activeMockPorts: input.activeMockPorts,
    ctx: input.ctx,
    blockPrivateNetworks: input.blockPrivateNetworks,
  })));
  return results;
}
