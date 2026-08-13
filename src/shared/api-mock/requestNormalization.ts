/**
 * API Mock Studio — request normalization (Phase 1B).
 * Pure function: no platform imports, no side effects.
 */
import type { ApiMockCapturedRequestV1 } from './contracts';
import { HARD_CEILINGS } from './defaults';

export interface RawRequestInput {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string | null;
  remoteAddress?: string;
  receivedAt?: string;
  clientCertSubject?: string;
  clientCertFingerprint?: string;
}

export interface NormalizedRequestSummary {
  method: string;
  path: string;
  decodedPath: string;
  pathSegments: string[];
  query: Record<string, string[]>;
  headerKeys: string[];
  cookieKeys: string[];
  bodyContentType?: string;
  bodySizeBytes: number;
}

export interface NormalizationResult {
  captured: ApiMockCapturedRequestV1;
  summary: NormalizedRequestSummary;
}

export function normalizeRequest(raw: RawRequestInput): NormalizationResult {
  const method = raw.method.toUpperCase();
  const headers = normalizeHeaders(raw.headers);
  const cookies = parseCookies(headers.cookie?.join('; '));
  const { rawPath, path, query } = parseUrl(raw.url);
  const contentType = headers['content-type']?.[0];
  const contentLengthHeader = headers['content-length']?.[0];
  const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;

  const bodyBytes = raw.body != null ? new TextEncoder().encode(raw.body).length : 0;
  const truncated = bodyBytes > HARD_CEILINGS.maxInboundBodyBytes;
  const body = raw.body ?? null;

  const decodedPath = safeDecodeURIComponent(path);
  const pathSegments = decodedPath.split('/').filter(Boolean);

  const captured: ApiMockCapturedRequestV1 = {
    method,
    path,
    rawPath,
    query,
    headers,
    cookies,
    body: truncated ? body?.slice(0, HARD_CEILINGS.maxInboundBodyBytes) ?? null : body,
    bodyTruncated: truncated,
    contentType,
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
    remoteAddress: raw.remoteAddress,
    receivedAt: raw.receivedAt ?? new Date().toISOString(),
    ...(raw.clientCertSubject ? { clientCertSubject: raw.clientCertSubject } : {}),
    ...(raw.clientCertFingerprint ? { clientCertFingerprint: raw.clientCertFingerprint } : {}),
  };

  const summary: NormalizedRequestSummary = {
    method,
    path,
    decodedPath,
    pathSegments,
    query,
    headerKeys: Object.keys(headers).sort(),
    cookieKeys: Object.keys(cookies).sort(),
    bodyContentType: contentType,
    bodySizeBytes: bodyBytes,
  };

  return { captured, summary };
}

function normalizeHeaders(raw: Record<string, string | string[] | undefined>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const lowerKey = key.toLowerCase();
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    // HTTP/2 pseudo-headers (:method, :path, …) are not HTTP header names.
    // Map :authority onto Host so Host matchers still see the client target.
    if (lowerKey.startsWith(':')) {
      if (lowerKey === ':authority' && !out.host) out.host = values;
      continue;
    }
    if (out[lowerKey]) {
      out[lowerKey].push(...values);
    } else {
      out[lowerKey] = [...values];
    }
  }
  return out;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex < 0) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

function parseUrl(url: string): { rawPath: string; path: string; query: Record<string, string[]> } {
  const noFragment = url.split('#')[0];
  const qIndex = noFragment.indexOf('?');
  const path = qIndex >= 0 ? noFragment.slice(0, qIndex) : noFragment;
  const query: Record<string, string[]> = {};

  if (qIndex >= 0) {
    const qs = noFragment.slice(qIndex + 1);
    for (const part of qs.split('&')) {
      if (!part) continue;
      const eqIndex = part.indexOf('=');
      const key = safeDecodeURIComponent(eqIndex >= 0 ? part.slice(0, eqIndex) : part);
      const value = eqIndex >= 0 ? safeDecodeURIComponent(part.slice(eqIndex + 1)) : '';
      if (query[key]) {
        query[key].push(value);
      } else {
        query[key] = [value];
      }
    }
  }

  return { rawPath: noFragment, path, query };
}

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
