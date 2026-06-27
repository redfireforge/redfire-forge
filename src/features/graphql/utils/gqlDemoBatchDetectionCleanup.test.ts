import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  demoBatchDetectionConnectionIds,
  purgeGqlDemoBatchDetectionFlags,
} from './gqlDemoBatchDetectionCleanup';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

import { readKey, writeKey } from '../../../shared/utils/storage';

describe('gqlDemoBatchDetectionCleanup', () => {
  beforeEach(() => {
    vi.mocked(readKey).mockReset();
    vi.mocked(writeKey).mockReset();
  });

  it('demoBatchDetectionConnectionIds includes localhost and 127.0.0.1 variants', () => {
    const ids = demoBatchDetectionConnectionIds();
    expect(ids.some((id) => id.includes('4010'))).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(1);
  });

  it('purgeGqlDemoBatchDetectionFlags clears batch:true on demo keys', async () => {
    vi.mocked(readKey).mockImplementation(async (key) => {
      if (String(key).includes('4010')) return JSON.stringify({ apq: false, batch: true });
      return null;
    });
    const cleared = await purgeGqlDemoBatchDetectionFlags();
    expect(cleared).toBeGreaterThanOrEqual(1);
    expect(writeKey).toHaveBeenCalled();
    const payload = vi.mocked(writeKey).mock.calls.find((c) => String(c[0]).includes('4010'))?.[1];
    expect(JSON.parse(String(payload)).batch).toBe(false);
  });

  it('purgeGqlDemoBatchDetectionFlags skips keys without batch:true', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({ batch: false }));
    const cleared = await purgeGqlDemoBatchDetectionFlags();
    expect(cleared).toBe(0);
    expect(writeKey).not.toHaveBeenCalled();
  });
});
