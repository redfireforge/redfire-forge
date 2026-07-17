import { isTauri } from '../../../shared/utils/platform';
import { preferLocalhostHostname, resolveLoopbackUrl } from '../../../shared/utils/loopbackUrl';

/** True when the URL targets the desktop GraphQL mock proxy route. */
export function isGraphqlMockEndpoint(url: string | undefined | null): boolean {
  const normalized = (url ?? '').trim().toLowerCase();
  return normalized.includes('/api/graphql/mock');
}

/**
 * Mock config is keyed to the live upstream endpoint — never the mock proxy URL.
 * Switching the connection bar to the mock route must not change mock storage or
 * disable the in-process mock server.
 */
export function resolveMockServerConnectionId(
  pageDefaultEndpointResolved: string,
  historyConnectionId: string | null | undefined,
  tabSchemaConnectionId: string | null | undefined,
  preferTabOverride = false,
): string {
  if (
    preferTabOverride
    && tabSchemaConnectionId
    && !isGraphqlMockEndpoint(tabSchemaConnectionId)
  ) {
    return tabSchemaConnectionId;
  }
  for (const id of [pageDefaultEndpointResolved, historyConnectionId, tabSchemaConnectionId]) {
    if (id && !isGraphqlMockEndpoint(id)) return id;
  }
  return '';
}

/** Normalize endpoint text: trim whitespace and strip invisible Unicode characters. */
export function normalizeGraphqlEndpoint(url: string | undefined | null): string {
  const cleaned = (url ?? '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!cleaned) return cleaned;
  try {
    const parsed = new URL(cleaned);
    // HTTPS loopback: keep `localhost` (Docker TLS/mTLS proxies, SNI). Plain HTTP on web
    // still resolves to 127.0.0.1 for Node proxy / corporate NO_PROXY quirks.
    if (parsed.protocol === 'https:' || isTauri()) {
      return preferLocalhostHostname(cleaned);
    }
  } catch {
    /* fall through */
  }
  return resolveLoopbackUrl(cleaned);
}

/** Truncate a GraphQL endpoint URL to a short hostname badge for tab labels (Phase 6 PT-5). */
export function deriveEndpointHostnameBadge(url: string, maxLen = 20): string | null {
  // Display-only: preserve localhost for readable tab labels (do not resolve to 127.0.0.1).
  const trimmed = (url ?? '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!trimmed || trimmed.length < 4) return null;

  const hasExplicitProtocol = /^https?:\/\//i.test(trimmed);
  let hostLabel: string | null = null;

  if (hasExplicitProtocol) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname;
      if (!host || host.length < 2) return null;
      hostLabel = parsed.port ? `${host}:${parsed.port}` : host;
    } catch {
      const match = trimmed.match(/^(?:https?):\/\/([^/\s?#]+)/i);
      if (match?.[1] && match[1].length >= 2) {
        hostLabel = match[1];
      }
    }
  } else {
    const bareHost = trimmed.split(/[/\s?#]/, 1)[0];
    if (
      bareHost &&
      bareHost.length >= 2 &&
      (bareHost.includes('.') || /^localhost(:\d+)?$/i.test(bareHost))
    ) {
      hostLabel = bareHost;
    }
  }

  if (!hostLabel) return null;
  return hostLabel.length > maxLen ? `${hostLabel.slice(0, maxLen - 1)}…` : hostLabel;
}
