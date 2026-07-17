import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../adapters', () => ({
  purgeGrpcDemoCallHistory: vi.fn(async () => 4),
}));

import { purgeGrpcDemoCallHistory } from '../adapters';
import { purgeGrpcDemoEphemeralStorage } from './grpc-demo-storage-cleanup';

describe('purgeGrpcDemoEphemeralStorage', () => {
  beforeEach(() => {
    vi.mocked(purgeGrpcDemoCallHistory).mockClear();
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, String(value)); },
        removeItem: (key: string) => { store.delete(key); },
        clear: () => { store.clear(); },
      },
    });
    localStorage.clear();
  });

  it('purges demo call history and grpc studio session drafts', async () => {
    localStorage.setItem('grpc-studio-session-v1', JSON.stringify({ activeTabId: 'tab-1' }));
    localStorage.setItem('grpc-studio-descriptors-v1', JSON.stringify({}));

    const result = await purgeGrpcDemoEphemeralStorage();
    expect(purgeGrpcDemoCallHistory).toHaveBeenCalled();
    expect(result.historyEntriesRemoved).toBe(4);
    expect(result.sessionKeysRemoved).toBe(2);
    expect(localStorage.getItem('grpc-studio-session-v1')).toBeNull();
    expect(localStorage.getItem('grpc-studio-descriptors-v1')).toBeNull();
  });

  it('returns zero session removals when no grpc studio draft keys exist', async () => {
    const result = await purgeGrpcDemoEphemeralStorage();
    expect(result.sessionKeysRemoved).toBe(0);
  });
});
