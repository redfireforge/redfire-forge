/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoSettingsEnvBridge } from './useDemoSettingsEnvBridge';

describe('useDemoSettingsEnvBridge', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoEnsureSettingsEnv;
    delete (window as unknown as Record<string, unknown>).__demoRemoveSettingsEnv;
  });

  it('exposes __demoEnsureSettingsEnv on window', () => {
    const setEnvironments = vi.fn();
    renderHook(() => useDemoSettingsEnvBridge({ setEnvironments }));
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoEnsureSettingsEnv).toBeTypeOf('function');
    expect(w.__demoRemoveSettingsEnv).toBeTypeOf('function');
  });

  it('returns existing env id when name matches (case-insensitive)', () => {
    const existing = [{ id: 'env-1', name: 'Production', baseUrls: {} }];
    const setEnvironments = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') (updater as (p: typeof existing) => void)(existing);
    });
    renderHook(() => useDemoSettingsEnvBridge({ setEnvironments }));

    const ensure = (window as unknown as { __demoEnsureSettingsEnv: (n: string) => string }).__demoEnsureSettingsEnv;
    const id = ensure('production');
    expect(id).toBe('env-1');
  });

  it('creates a new env when name not found', () => {
    const existing: { id: string; name: string; baseUrls: Record<string, string> }[] = [];
    let captured: typeof existing = [];
    const setEnvironments = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') {
        captured = (updater as (p: typeof existing) => typeof existing)(existing);
      }
    });
    renderHook(() => useDemoSettingsEnvBridge({ setEnvironments }));

    const ensure = (window as unknown as { __demoEnsureSettingsEnv: (n: string) => string }).__demoEnsureSettingsEnv;
    const id = ensure('staging');
    expect(id).toBeTruthy();
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('staging');
    expect(captured[0].id).toBe(id);
  });

  it('__demoRemoveSettingsEnv removes env by name', () => {
    const existing = [
      { id: 'e1', name: 'dev', baseUrls: {} },
      { id: 'e2', name: 'prod', baseUrls: {} },
    ];
    let captured: typeof existing = [];
    const setEnvironments = vi.fn((updater: unknown) => {
      if (typeof updater === 'function') {
        captured = (updater as (p: typeof existing) => typeof existing)(existing);
      }
    });
    renderHook(() => useDemoSettingsEnvBridge({ setEnvironments }));

    const remove = (window as unknown as { __demoRemoveSettingsEnv: (n: string) => void }).__demoRemoveSettingsEnv;
    remove('dev');
    expect(captured).toHaveLength(1);
    expect(captured[0].name).toBe('prod');
  });

  it('cleans up window functions on unmount', () => {
    const setEnvironments = vi.fn();
    const { unmount } = renderHook(() => useDemoSettingsEnvBridge({ setEnvironments }));
    unmount();
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoEnsureSettingsEnv).toBeUndefined();
    expect(w.__demoRemoveSettingsEnv).toBeUndefined();
  });
});
