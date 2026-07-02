/**
 * @vitest-environment node
 */
/**
 * Phase 4D — server-side OAuth2 client-credentials acquisition with in-memory cache.
 */
import {
  buildGrpcOAuth2CacheKey,
  formatGrpcOAuth2TokenErrorMessage,
  GRPC_OAUTH2_DEFAULT_TOKEN_TTL_SEC,
  GRPC_OAUTH2_TOKEN_EXPIRY_BUFFER_SEC,
  GRPC_OAUTH2_TOKEN_REQUEST_TIMEOUT_MS,
  mapGrpcOAuth2HttpFailure,
  normalizeGrpcOAuth2Credentials,
  parseGrpcOAuth2TokenExpiry,
  sanitizeGrpcOAuth2ErrorText,
  type GrpcOAuth2Credentials,
  type GrpcOAuth2TokenErrorCategory,
} from '../../src/shared/grpc/grpcOAuth2Policy.js';
import { OAuthTokenFetchPolicyError, validateOAuthTokenUrlWithDns } from './oauthTokenFetchPolicy.js';
import { isGrpcOutboundDnsStrictEnabled } from './grpcOutboundDnsPolicy.js';

export interface GrpcOAuth2FetchPort {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export class GrpcOAuth2TokenError extends Error {
  readonly category: GrpcOAuth2TokenErrorCategory;

  constructor(category: GrpcOAuth2TokenErrorCategory, message: string) {
    super(message);
    this.name = 'GrpcOAuth2TokenError';
    this.category = category;
  }
}

interface CachedGrpcOAuth2Token {
  accessToken: string;
  expiresSec: number;
}

const defaultFetchPort: GrpcOAuth2FetchPort = {
  fetch: (url, init) => globalThis.fetch(url, init),
};

export class GrpcOAuth2TokenService {
  private readonly cache = new Map<string, CachedGrpcOAuth2Token>();
  private readonly pending = new Map<string, Promise<string>>();

  private readonly resolveHostname?: (hostname: string) => Promise<string[]>;

  private readonly skipDnsResolution?: boolean;

  constructor(
    private readonly fetchPort: GrpcOAuth2FetchPort = defaultFetchPort,
    options: {
      resolveHostname?: (hostname: string) => Promise<string[]>;
      skipDnsResolution?: boolean;
    } = {},
  ) {
    this.resolveHostname = options.resolveHostname;
    this.skipDnsResolution = options.skipDnsResolution;
  }

  clearCache(): void {
    this.cache.clear();
    this.pending.clear();
  }

  async acquireToken(oauth2: GrpcOAuth2Credentials): Promise<string> {
    const normalized = normalizeGrpcOAuth2Credentials(oauth2);
    if (!normalized?.tokenUrl || !normalized.clientId || !normalized.clientSecret.trim()) {
      throw new GrpcOAuth2TokenError(
        'invalid_client',
        formatGrpcOAuth2TokenErrorMessage('invalid_client'),
      );
    }

    let validatedTokenUrl: URL;
    try {
      validatedTokenUrl = await validateOAuthTokenUrlWithDns(normalized.tokenUrl, {
        resolveHostname: this.resolveHostname,
        skipDnsResolution: this.skipDnsResolution ?? !isGrpcOutboundDnsStrictEnabled(),
      });
    } catch (error) {
      const detail = error instanceof OAuthTokenFetchPolicyError
        ? sanitizeGrpcOAuth2ErrorText(error.message)
        : undefined;
      throw new GrpcOAuth2TokenError(
        'endpoint_unreachable',
        formatGrpcOAuth2TokenErrorMessage('endpoint_unreachable', detail),
      );
    }

    const cacheKey = buildGrpcOAuth2CacheKey(normalized);
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.accessToken;
    }

    const inflight = this.pending.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const refreshPromise = this.refreshToken(normalized, cacheKey, validatedTokenUrl.toString());
    this.pending.set(cacheKey, refreshPromise);
    try {
      return await refreshPromise;
    } catch (error) {
      const stale = this.cache.get(cacheKey);
      if (stale && this.isExpired(stale)) {
        this.cache.delete(cacheKey);
      }
      throw error;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  private isExpired(entry: CachedGrpcOAuth2Token): boolean {
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= entry.expiresSec - GRPC_OAUTH2_TOKEN_EXPIRY_BUFFER_SEC;
  }

  private async refreshToken(
    oauth2: GrpcOAuth2Credentials,
    cacheKey: string,
    tokenUrl: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: oauth2.clientId,
      client_secret: oauth2.clientSecret,
    });
    if (oauth2.scope) {
      body.set('scope', oauth2.scope);
    }

    let response: Response;
    try {
      response = await this.fetchPort.fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(GRPC_OAUTH2_TOKEN_REQUEST_TIMEOUT_MS),
        redirect: 'manual',
      });
    } catch (error) {
      if (
        error instanceof Error
        && (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new GrpcOAuth2TokenError(
          'timeout',
          formatGrpcOAuth2TokenErrorMessage('timeout'),
        );
      }
      const detail = error instanceof Error
        ? sanitizeGrpcOAuth2ErrorText(error.message)
        : undefined;
      throw new GrpcOAuth2TokenError(
        'endpoint_unreachable',
        formatGrpcOAuth2TokenErrorMessage('endpoint_unreachable', detail),
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new GrpcOAuth2TokenError(
        'endpoint_unreachable',
        formatGrpcOAuth2TokenErrorMessage('endpoint_unreachable', 'redirects are not allowed'),
      );
    }

    const bodyText = await response.text();
    if (!response.ok) {
      const mapped = mapGrpcOAuth2HttpFailure(response.status, bodyText);
      throw new GrpcOAuth2TokenError(mapped.category, mapped.message);
    }

    let accessToken: string | undefined;
    let expiresInSec: number | undefined;
    try {
      const parsed = JSON.parse(bodyText) as {
        access_token?: unknown;
        expires_in?: unknown;
      };
      if (typeof parsed.access_token === 'string' && parsed.access_token.trim()) {
        accessToken = parsed.access_token.trim();
      }
      expiresInSec = parseGrpcOAuth2ExpiresIn(parsed.expires_in);
    } catch {
      throw new GrpcOAuth2TokenError(
        'invalid_response',
        formatGrpcOAuth2TokenErrorMessage('invalid_response'),
      );
    }

    if (!accessToken) {
      throw new GrpcOAuth2TokenError(
        'invalid_response',
        formatGrpcOAuth2TokenErrorMessage('invalid_response'),
      );
    }

    const jwtExp = parseGrpcOAuth2TokenExpiry(accessToken);
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresSec = (jwtExp && jwtExp > nowSec + GRPC_OAUTH2_TOKEN_EXPIRY_BUFFER_SEC)
      ? jwtExp
      : (expiresInSec ? nowSec + expiresInSec : nowSec + GRPC_OAUTH2_DEFAULT_TOKEN_TTL_SEC);

    this.cache.set(cacheKey, { accessToken, expiresSec });
    return accessToken;
  }
}

export const grpcOAuth2TokenService = new GrpcOAuth2TokenService();

function parseGrpcOAuth2ExpiresIn(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}
