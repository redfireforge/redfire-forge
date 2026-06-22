/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { rejectPemTlsInQueryParams } from './routeTlsQueryGuards';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('rejectPemTlsInQueryParams', () => {
  it('returns false when no PEM fields are present', () => {
    const res = mockRes();
    expect(rejectPemTlsInQueryParams({ skipTlsVerify: 'true' }, res)).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when caCert is in the query string', () => {
    const res = mockRes();
    expect(
      rejectPemTlsInQueryParams({ caCert: '-----BEGIN CERTIFICATE-----' }, res),
    ).toBe(true);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'GQL_INVALID_REQUEST' }) }),
    );
  });
});
