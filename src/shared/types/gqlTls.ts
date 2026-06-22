/** GraphQL Studio TLS options — per-tab or proxy payload. */
export interface GqlTlsSettings {
  skipTlsVerify?: boolean;
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}

export function gqlTlsSettingsFromPartial(
  partial: GqlTlsSettings | undefined,
): GqlTlsSettings {
  if (!partial) return {};
  return {
    skipTlsVerify: partial.skipTlsVerify === true ? true : undefined,
    caCert: partial.caCert?.trim() || undefined,
    clientCert: partial.clientCert?.trim() || undefined,
    clientKey: partial.clientKey?.trim() || undefined,
  };
}

/** True when the browser must route HTTPS through the Node proxy (cannot set certs in fetch). */
export function gqlRequiresTlsProxy(tls: GqlTlsSettings | undefined): boolean {
  if (!tls) return false;
  if (tls.skipTlsVerify) return true;
  if (tls.caCert?.trim()) return true;
  if (tls.clientCert?.trim() || tls.clientKey?.trim()) return true;
  return false;
}

export function parseGqlTlsFromBody(body: Record<string, unknown> | undefined): GqlTlsSettings {
  if (!body) return {};
  return gqlTlsSettingsFromPartial({
    skipTlsVerify: body.skipTlsVerify === true,
    caCert: typeof body.caCert === 'string' ? body.caCert : undefined,
    clientCert: typeof body.clientCert === 'string' ? body.clientCert : undefined,
    clientKey: typeof body.clientKey === 'string' ? body.clientKey : undefined,
  });
}

/** Normalize legacy boolean skipTlsVerify or a full settings object for gqlFetch. */
export function normalizeGqlFetchTls(input?: boolean | GqlTlsSettings): GqlTlsSettings {
  if (input === true) return { skipTlsVerify: true };
  if (input === false || input === undefined) return {};
  return gqlTlsSettingsFromPartial(input);
}

export function buildTabTlsSettings(resolution: {
  skipTlsVerify: boolean;
  tlsCaCert?: string;
  tlsClientCert?: string;
  tlsClientKey?: string;
}): GqlTlsSettings {
  return gqlTlsSettingsFromPartial({
    skipTlsVerify: resolution.skipTlsVerify ? true : undefined,
    caCert: resolution.tlsCaCert,
    clientCert: resolution.tlsClientCert,
    clientKey: resolution.tlsClientKey,
  });
}

/** PEM fields cannot ride on APQ GET query strings — use POST /api/graphql/query instead. */
export function tlsApqGetNeedsPostProxy(tls: GqlTlsSettings | undefined): boolean {
  if (!tls) return false;
  return !!(tls.caCert?.trim() || tls.clientCert?.trim() || tls.clientKey?.trim());
}

/** Body fields for Node GraphQL proxy routes (/api/graphql/query, batch, subscribe). */
export function serializeGqlTlsForProxy(tls: GqlTlsSettings | undefined): Record<string, unknown> {
  if (!tls) return {};
  const out: Record<string, unknown> = {};
  if (tls.skipTlsVerify) out.skipTlsVerify = true;
  if (tls.caCert?.trim()) out.caCert = tls.caCert;
  if (tls.clientCert?.trim()) out.clientCert = tls.clientCert;
  if (tls.clientKey?.trim()) out.clientKey = tls.clientKey;
  return out;
}
