/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/platform', () => ({ isTauri: vi.fn(() => false) }));
import { isTauri } from '../utils/platform';
import { apiMockControlBase } from './controlBase';

const COMPANION = 'http://127.0.0.1:3001';

describe('apiMockControlBase', () => {
  beforeEach(() => vi.mocked(isTauri).mockReturnValue(false));

  it('stays same-origin in a browser so the dev/production proxy handles /api', () => {
    expect(apiMockControlBase()).toBe('');
  });

  it('uses an absolute companion URL under Tauri', () => {
    // tauri://localhost answers a relative /api path from the asset protocol,
    // returning index.html with HTTP 200 instead of reaching the companion.
    vi.mocked(isTauri).mockReturnValue(true);
    expect(apiMockControlBase()).toBe(COMPANION);
  });
});
