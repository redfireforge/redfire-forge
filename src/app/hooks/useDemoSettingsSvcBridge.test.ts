/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoSettingsSvcBridge } from './useDemoSettingsSvcBridge';

type Svc = { id: string; name: string; baseUrls: Record<string, string> };

describe('useDemoSettingsSvcBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoEnsureSettingsSvc;
    delete (window as unknown as Record<string, unknown>).__demoRemoveSettingsSvc;
    delete (window as unknown as Record<string, unknown>).__demoResetSettingsSvcProtocols;
  });

  it('exposes __demoEnsureSettingsSvc and __demoRemoveSettingsSvc on window', () => {
    const setMicroservices = vi.fn();
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoEnsureSettingsSvc).toBeTypeOf('function');
    expect(w.__demoRemoveSettingsSvc).toBeTypeOf('function');
    expect(w.__demoResetSettingsSvcProtocols).toBeTypeOf('function');
  });

  it('returns existing svc id when name matches (case-insensitive)', () => {
    const existing: Svc[] = [{ id: 'svc-1', name: 'Product-Api', baseUrls: { e1: 'http://a' } }];
    const setMicroservices = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') (updater as (p: Svc[]) => Svc[])(existing);
    });
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));

    const ensure = (window as unknown as { __demoEnsureSettingsSvc: (n: string, b?: Record<string, string>) => string }).__demoEnsureSettingsSvc;
    const id = ensure('product-api');
    expect(id).toBe('svc-1');
  });

  it('merges baseUrls into existing svc when provided', () => {
    const existing: Svc[] = [{ id: 'svc-1', name: 'Svc', baseUrls: { e1: 'http://a' } }];
    let captured: Svc[] = [];
    const setMicroservices = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') captured = (updater as (p: Svc[]) => Svc[])(existing);
    });
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));

    const ensure = (window as unknown as { __demoEnsureSettingsSvc: (n: string, b?: Record<string, string>) => string }).__demoEnsureSettingsSvc;
    ensure('Svc', { e2: 'http://b' });
    expect(captured[0].baseUrls).toEqual({ e1: 'http://a', e2: 'http://b' });
  });

  it('creates a new svc when name not found', () => {
    const existing: Svc[] = [];
    let captured: Svc[] = [];
    const setMicroservices = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') captured = (updater as (p: Svc[]) => Svc[])(existing);
    });
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));

    const ensure = (window as unknown as { __demoEnsureSettingsSvc: (n: string, b?: Record<string, string>) => string }).__demoEnsureSettingsSvc;
    const id = ensure('new-svc', { e1: 'http://x' });
    expect(id).toBeTruthy();
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('new-svc');
    expect(captured[0].baseUrls).toEqual({ e1: 'http://x' });
  });

  it('__demoRemoveSettingsSvc removes svc by name', () => {
    const existing: Svc[] = [
      { id: 's1', name: 'alpha', baseUrls: {} },
      { id: 's2', name: 'beta', baseUrls: {} },
    ];
    let captured: Svc[] = [];
    const setMicroservices = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') captured = (updater as (p: Svc[]) => Svc[])(existing);
    });
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));

    const remove = (window as unknown as { __demoRemoveSettingsSvc: (n: string) => void }).__demoRemoveSettingsSvc;
    remove('Alpha');
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('beta');
  });

  it('cleans up window functions on unmount', () => {
    const setMicroservices = vi.fn();
    const { unmount } = renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));
    unmount();
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoEnsureSettingsSvc).toBeUndefined();
    expect(w.__demoRemoveSettingsSvc).toBeUndefined();
    expect(w.__demoResetSettingsSvcProtocols).toBeUndefined();
  });

  it('__demoResetSettingsSvcProtocols clears protocols and global vars', () => {
    type Row = {
      id: string;
      name: string;
      baseUrls: Record<string, string>;
      enabledProtocols?: string[];
      protocolEndpoints?: Record<string, Record<string, { baseUrl: string }>>;
      globalVars?: Record<string, string>;
    };
    const existing: Row[] = [{
      id: 's1',
      name: 'grpc-demo',
      baseUrls: {},
      enabledProtocols: ['grpc'],
      protocolEndpoints: { grpc: { e1: { baseUrl: 'localhost:50051' } } },
      globalVars: { requestId: 'req-demo-001', userId: 'user-42' },
    }];
    let captured: Row[] = [];
    const setMicroservices = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') {
        captured = (updater as (p: Row[]) => Row[])(existing);
      }
    });
    renderHook(() => useDemoSettingsSvcBridge({ setMicroservices }));

    const reset = (window as unknown as {
      __demoResetSettingsSvcProtocols: (n: string) => boolean;
    }).__demoResetSettingsSvcProtocols;
    expect(reset('grpc-demo')).toBe(true);
    expect(captured[0]?.enabledProtocols).toEqual([]);
    expect(captured[0]?.protocolEndpoints).toEqual({});
    expect(captured[0]?.globalVars).toEqual({});
  });
});
