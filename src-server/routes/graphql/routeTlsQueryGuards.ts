import type { Response } from 'express';

const PEM_QUERY_KEYS = ['caCert', 'clientCert', 'clientKey'] as const;

/**
 * Reject PEM TLS fields on GET query strings — clients must use POST with a JSON body.
 * Returns true when the response was sent (caller should return).
 */
export function rejectPemTlsInQueryParams(
  query: Record<string, unknown>,
  res: Response,
): boolean {
  const hasPem = PEM_QUERY_KEYS.some((key) => typeof query[key] === 'string');
  if (!hasPem) return false;

  res.status(400).json({
    ok: false,
    error: {
      code: 'GQL_INVALID_REQUEST',
      message: 'PEM TLS fields are not accepted on GET query strings — use POST with a JSON body',
    },
  });
  return true;
}
