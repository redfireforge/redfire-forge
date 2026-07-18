import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import { readKey, writeKey } from '../../../shared/utils/storage';
import {
  loadConvertPref,
  saveConvertPref,
  loadPrettyPref,
  savePrettyPref,
  DEFAULT_CONVERT_PREF,
  CATALOG_CONVERT_PREF_KEY,
  CATALOG_CONVERT_PRETTY_KEY,
} from './convertPrefs';

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadConvertPref', () => {
  it('returns the default when nothing is stored', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    expect(await loadConvertPref()).toEqual(DEFAULT_CONVERT_PREF);
  });

  it('returns a valid stored pref', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({ engine: 'scalar', target: '3.1' }));
    expect(await loadConvertPref()).toEqual({ engine: 'scalar', target: '3.1' });
  });

  it('falls back to default for an unknown engine', async () => {
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({ engine: 'nope', target: '3.0' }));
    expect(await loadConvertPref()).toEqual(DEFAULT_CONVERT_PREF);
  });

  it('falls back to default when target is not valid for the engine', async () => {
    // swagger2openapi cannot target 3.1
    vi.mocked(readKey).mockResolvedValue(JSON.stringify({ engine: 'swagger2openapi', target: '3.1' }));
    expect(await loadConvertPref()).toEqual(DEFAULT_CONVERT_PREF);
  });

  it('falls back to default on malformed JSON', async () => {
    vi.mocked(readKey).mockResolvedValue('{not json');
    expect(await loadConvertPref()).toEqual(DEFAULT_CONVERT_PREF);
  });

  it('falls back to default when readKey throws', async () => {
    vi.mocked(readKey).mockRejectedValue(new Error('io'));
    expect(await loadConvertPref()).toEqual(DEFAULT_CONVERT_PREF);
  });
});

describe('saveConvertPref', () => {
  it('persists a valid pref under the shared key', async () => {
    await saveConvertPref({ engine: 'scalar', target: '3.1' });
    expect(writeKey).toHaveBeenCalledWith(
      CATALOG_CONVERT_PREF_KEY,
      JSON.stringify({ engine: 'scalar', target: '3.1' }),
      { notifyOnQuotaExhausted: false },
    );
  });

  it('does not persist an invalid pref', async () => {
    await saveConvertPref({ engine: 'swagger2openapi', target: '3.1' });
    expect(writeKey).not.toHaveBeenCalled();
  });

  it('swallows write errors', async () => {
    vi.mocked(writeKey).mockRejectedValueOnce(new Error('quota'));
    await expect(saveConvertPref({ engine: 'swagger2openapi', target: '3.0' })).resolves.toBeUndefined();
  });
});

describe('loadPrettyPref', () => {
  it('defaults to true when nothing is stored', async () => {
    vi.mocked(readKey).mockResolvedValue(null);
    expect(await loadPrettyPref()).toBe(true);
  });

  it('returns the stored boolean', async () => {
    vi.mocked(readKey).mockResolvedValue('false');
    expect(await loadPrettyPref()).toBe(false);
    vi.mocked(readKey).mockResolvedValue('true');
    expect(await loadPrettyPref()).toBe(true);
  });

  it('defaults to true on a malformed value', async () => {
    vi.mocked(readKey).mockResolvedValue('maybe');
    expect(await loadPrettyPref()).toBe(true);
  });

  it('defaults to true when readKey throws', async () => {
    vi.mocked(readKey).mockRejectedValue(new Error('io'));
    expect(await loadPrettyPref()).toBe(true);
  });
});

describe('savePrettyPref', () => {
  it('persists the toggle under the pretty key', async () => {
    await savePrettyPref(false);
    expect(writeKey).toHaveBeenCalledWith(
      CATALOG_CONVERT_PRETTY_KEY,
      'false',
      { notifyOnQuotaExhausted: false },
    );
  });

  it('swallows write errors', async () => {
    vi.mocked(writeKey).mockRejectedValueOnce(new Error('quota'));
    await expect(savePrettyPref(true)).resolves.toBeUndefined();
  });
});
