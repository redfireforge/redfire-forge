/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadWsProfiles, saveWsProfiles, loadWsTemplates, saveWsTemplates, WS_PROFILES_KEY, WS_TEMPLATES_KEY } from './websocketStorage';
import * as storage from '../utils/storage';

vi.mock('../utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
}));

const mockRead = vi.mocked(storage.readKey);
const mockWrite = vi.mocked(storage.writeKey);

beforeEach(() => {
  vi.clearAllMocks();
  mockWrite.mockResolvedValue(undefined);
});

describe('websocketStorage — profiles', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsProfiles()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_PROFILES_KEY);
  });

  it('parses valid profiles', async () => {
    const profile = {
      id: 'p1', name: 'Test', url: 'wss://test.com',
      headers: [], queryParams: [], subprotocols: '',
      autoReconnect: false, maxReconnectAttempts: 5,
      reconnectIntervalMs: 3000, maxMessages: 1000,
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([profile]));
    const result = await loadWsProfiles();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].url).toBe('wss://test.com');
  });

  it('filters out invalid entries', async () => {
    const valid = { id: 'p1', name: 'Good', url: 'wss://ok' };
    const invalid = { id: 123, name: 'Bad' };
    mockRead.mockResolvedValue(JSON.stringify([valid, invalid, null, 'string']));
    const result = await loadWsProfiles();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good');
  });

  it('returns empty for malformed JSON', async () => {
    mockRead.mockResolvedValue('not json');
    expect(await loadWsProfiles()).toEqual([]);
  });

  it('returns empty for non-array JSON', async () => {
    mockRead.mockResolvedValue(JSON.stringify({ id: 'obj' }));
    expect(await loadWsProfiles()).toEqual([]);
  });

  it('saves profiles', async () => {
    const profiles = [{ id: 'p1', name: 'T', url: 'wss://t' }];
    await saveWsProfiles(profiles as never[]);
    expect(mockWrite).toHaveBeenCalledWith(WS_PROFILES_KEY, JSON.stringify(profiles));
  });
});

describe('websocketStorage — templates', () => {
  it('returns empty array when no data stored', async () => {
    mockRead.mockResolvedValue(null);
    expect(await loadWsTemplates()).toEqual([]);
    expect(mockRead).toHaveBeenCalledWith(WS_TEMPLATES_KEY);
  });

  it('parses valid templates', async () => {
    const template = {
      id: 't1', name: 'Hello', body: '{"msg":"hi"}', format: 'json',
      createdAt: '2025-01-01', updatedAt: '2025-01-01',
    };
    mockRead.mockResolvedValue(JSON.stringify([template]));
    const result = await loadWsTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Hello');
  });

  it('filters out invalid template entries', async () => {
    const valid = { id: 't1', name: 'ok', body: 'test' };
    const missing = { id: 't2', name: 'missing body' };
    mockRead.mockResolvedValue(JSON.stringify([valid, missing]));
    const result = await loadWsTemplates();
    expect(result).toHaveLength(1);
  });

  it('saves templates', async () => {
    const templates = [{ id: 't1', name: 'T', body: 'hi' }];
    await saveWsTemplates(templates as never[]);
    expect(mockWrite).toHaveBeenCalledWith(WS_TEMPLATES_KEY, JSON.stringify(templates));
  });
});
