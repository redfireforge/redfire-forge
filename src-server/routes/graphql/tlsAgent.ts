import https from 'node:https';
import type { GqlTlsSettings } from '../../../src/shared/types/gqlTls.js';

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/**
 * Build an https.Agent for GraphQL upstream requests (query, batch, SSE, introspection proxy).
 * Returns undefined when no custom TLS options are requested.
 */
export function buildGraphqlTlsAgent(
  tls: GqlTlsSettings | undefined,
  url: string,
): https.Agent | undefined {
  const isHttps = url.toLowerCase().startsWith('https://') || url.toLowerCase().startsWith('wss://');
  if (!isHttps || !tls) return undefined;

  const hasCustom =
    tls.skipTlsVerify ||
    !!tls.caCert?.trim() ||
    !!tls.clientCert?.trim() ||
    !!tls.clientKey?.trim();
  if (!hasCustom) return undefined;

  const agentOptions: https.AgentOptions = {};

  let isLocal = false;
  try {
    isLocal = isLoopbackHost(new URL(url).hostname);
  } catch {
    /* validated elsewhere */
  }

  if (tls.skipTlsVerify) {
    agentOptions.rejectUnauthorized = false;
  } else if (isLocal && !tls.caCert?.trim()) {
    agentOptions.rejectUnauthorized = false;
  }

  if (tls.caCert?.trim()) {
    agentOptions.ca = tls.caCert;
  }
  if (tls.clientCert?.trim()) {
    agentOptions.cert = tls.clientCert;
  }
  if (tls.clientKey?.trim()) {
    agentOptions.key = tls.clientKey;
  }

  if (isLocal) {
    (agentOptions as Record<string, unknown>).proxy = false;
  }

  return new https.Agent(agentOptions);
}

/** Resolve TLS agent for https/wss upstream URLs; undefined for plain http. */
export function tlsAgentForEndpoint(
  tls: GqlTlsSettings | undefined,
  endpoint: string,
): https.Agent | undefined {
  const lower = endpoint.toLowerCase();
  if (!lower.startsWith('https://') && !lower.startsWith('wss://')) {
    return undefined;
  }
  return buildGraphqlTlsAgent(tls, endpoint);
}
