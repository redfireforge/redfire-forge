/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import {
  clearGrpcStudioPersistence,
  useGrpcStudioPersistence,
  type GrpcStudioPersistedSession,
} from './useGrpcStudioPersistence';

const STORAGE_KEY = 'grpc-studio-session-v1';
const DESCRIPTORS_STORAGE_KEY = 'grpc-studio-descriptors-v1';

describe('useGrpcStudioPersistence coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('restores a valid persisted session on mount', () => {
    const persisted: GrpcStudioPersistedSession = {
      version: 1,
      activeTabId: 'tab-1',
      tabs: [{
        id: 'tab-1',
        title: 'Restored',
        target: 'localhost:50051',
        tlsMode: 'disabled',
        metadata: {},
        timeoutMs: 30_000,
        requestMode: 'form',
        body: {},
        servicesCollapsed: false,
      }],
      tabDescriptors: {
        'tab-1': { sourceSelection: { source: 'reflection' }, expandedServiceIds: [] },
      },
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    const onRestore = vi.fn();
    renderHook(() => useGrpcStudioPersistence({
      tabs: [createGrpcStudioTab({ id: 'live-tab' })],
      activeTabId: 'live-tab',
      tabDescriptors: { 'live-tab': createEmptyTabDescriptorState() },
    }, onRestore));

    expect(onRestore).toHaveBeenCalledWith(persisted);
  });

  it('ignores invalid, stale, or malformed persisted sessions', () => {
    const onRestore = vi.fn();
    const mount = () => renderHook(() => useGrpcStudioPersistence({
      tabs: [createGrpcStudioTab()],
      activeTabId: 'tab',
      tabDescriptors: {},
    }, onRestore));

    localStorage.setItem(STORAGE_KEY, '{not-json');
    mount();
    expect(onRestore).not.toHaveBeenCalled();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, tabs: [] }));
    mount();
    expect(onRestore).not.toHaveBeenCalled();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      tabs: 'not-an-array',
      activeTabId: 'tab',
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
    mount();
    expect(onRestore).not.toHaveBeenCalled();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      tabs: [],
      activeTabId: 'tab',
      tabDescriptors: {},
      timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
    }));
    mount();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('debounces persistence and tolerates malformed session shapes', () => {
    const tab = createGrpcStudioTab({ id: 'persist-tab', title: 'Persist me' });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { rerender } = renderHook(
      ({ session }) => useGrpcStudioPersistence(session, vi.fn()),
      {
        initialProps: {
          session: {
            tabs: [tab],
            activeTabId: tab.id,
            tabDescriptors: {
              [tab.id]: {
                ...createEmptyTabDescriptorState(),
                expandedServiceIds: ['echo.EchoService'],
                protoIngest: {
                  source: 'bsr',
                  protoRoots: [],
                  importPaths: [],
                  bsrModule: 'buf.build/connectrpc/eliza',
                  bsrVersion: 'main',
                },
              },
            },
          },
        },
      },
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(setItemSpy).toHaveBeenCalled();

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as GrpcStudioPersistedSession;
    expect(saved.version).toBe(1);
    expect(saved.tabs[0]?.title).toBe('Persist me');
    expect(saved.tabDescriptors[tab.id]?.expandedServiceIds).toEqual(['echo.EchoService']);
    expect(saved.tabDescriptors[tab.id]?.protoIngest?.source).toBe('bsr');
    expect(saved.tabDescriptors[tab.id]?.protoIngest?.bsrModule).toBe('buf.build/connectrpc/eliza');

    rerender({
      session: {
        tabs: null as unknown as typeof tab[],
        activeTabId: 42 as unknown as string,
        tabDescriptors: undefined as unknown as Record<string, never>,
      },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(setItemSpy.mock.calls.length).toBeGreaterThan(1);

    const fallback = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as GrpcStudioPersistedSession;
    expect(fallback.activeTabId).toBe('');
    expect(fallback.tabs).toEqual([]);

    setItemSpy.mockRestore();
  });

  it('swallows localStorage failures during save and clear', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const tab = createGrpcStudioTab();
    renderHook(() => useGrpcStudioPersistence({
      tabs: [tab],
      activeTabId: tab.id,
      tabDescriptors: { [tab.id]: createEmptyTabDescriptorState() },
    }, vi.fn()));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(() => clearGrpcStudioPersistence()).not.toThrow();

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('flushes session immediately on beforeunload/pagehide', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const tab = createGrpcStudioTab({ id: 'flush-tab', title: 'Flush now' });

    renderHook(() => useGrpcStudioPersistence({
      tabs: [tab],
      activeTabId: tab.id,
      tabDescriptors: { [tab.id]: createEmptyTabDescriptorState() },
    }, vi.fn()));

    // Immediate flush path should not require debounce timer.
    window.dispatchEvent(new Event('beforeunload'));
    window.dispatchEvent(new Event('pagehide'));

    expect(setItemSpy).toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as GrpcStudioPersistedSession;
    expect(saved.tabs[0]?.id).toBe('flush-tab');

    setItemSpy.mockRestore();
  });

  it('persists and restores descriptor snapshots for tabs with loaded schema', () => {
    const tab = createGrpcStudioTab({ id: 'tab-1', title: 'Descriptor tab' });
    const descriptor = {
      source: 'reflection',
      key: 'reflection:localhost:50051:abc123',
      sourceRef: 'localhost:50051',
      contentSha256: 'abc123',
      services: [],
    } as const;

    renderHook(() => useGrpcStudioPersistence({
      tabs: [tab],
      activeTabId: tab.id,
      tabDescriptors: {
        [tab.id]: {
          ...createEmptyTabDescriptorState(),
          loadState: 'loaded',
          descriptor,
          lastKnownGoodDescriptor: descriptor,
          sourceFingerprint: {
            source: 'reflection',
            sourceRef: 'localhost:50051',
            contentSha256: 'abc123',
          },
        },
      },
    }, vi.fn()));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const rawDescriptorEnvelope = localStorage.getItem(DESCRIPTORS_STORAGE_KEY);
    expect(rawDescriptorEnvelope).toBeTruthy();
    const descriptorEnvelope = JSON.parse(rawDescriptorEnvelope ?? '{}') as {
      tabSnapshots?: Record<string, { descriptor?: { key?: string } }>;
    };
    expect(descriptorEnvelope.tabSnapshots?.['tab-1']?.descriptor?.key).toBe(descriptor.key);

    const onRestore = vi.fn();
    renderHook(() => useGrpcStudioPersistence({
      tabs: [createGrpcStudioTab({ id: 'live-tab' })],
      activeTabId: 'live-tab',
      tabDescriptors: { 'live-tab': createEmptyTabDescriptorState() },
    }, onRestore));

    const restored = onRestore.mock.calls[0]?.[0] as GrpcStudioPersistedSession | undefined;
    expect(restored?.descriptorSnapshots?.['tab-1']?.descriptor?.key).toBe(descriptor.key);
  });
});
