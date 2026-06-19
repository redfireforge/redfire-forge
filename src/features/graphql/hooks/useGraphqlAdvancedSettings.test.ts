/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlAdvancedSettings hook.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
}));

import { useGraphqlAdvancedSettings } from './useGraphqlAdvancedSettings';
import { readKey, writeKey } from '../../../shared/utils/storage';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('useGraphqlAdvancedSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readKey).mockResolvedValue(null);
    vi.mocked(writeKey).mockResolvedValue();
  });

  describe('initial state', () => {
    it('initializes with correct default values', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      const s = result.current.advSettings;
      expect(s.apqEnabled).toBe(false);
      expect(s.apqUseGet).toBe(false);
      expect(s.apqUnsupportedDetected).toBe(false);
      expect(s.batchEnabled).toBe(false);
      expect(s.batchTimeoutMs).toBe(30000);
      expect(s.batchUnsupportedDetected).toBe(false);
      expect(s.dedupEnabled).toBe(true);
      expect(s.complexityBlockEnabled).toBe(false);
      expect(s.complexityBlockThreshold).toBe(1000);
    });

    it('initializes advSettingsOpen to false', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      expect(result.current.advSettingsOpen).toBe(false);
    });

    it('initializes toasts to false', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      expect(result.current.apqUnsupportedToast).toBe(false);
      expect(result.current.batchUnsupportedToast).toBe(false);
    });
  });

  describe('settings persistence', () => {
    it('loads persisted settings on mount', async () => {
      const savedSettings = { apqEnabled: true, batchEnabled: true, batchTimeoutMs: 5000, apqUseGet: true, dedupEnabled: false, complexityBlockEnabled: true, complexityBlockThreshold: 500 };
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_adv_settings_v1') return JSON.stringify(savedSettings);
        return null;
      });
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqEnabled).toBe(true);
      expect(result.current.advSettings.batchEnabled).toBe(true);
      expect(result.current.advSettings.batchTimeoutMs).toBe(5000);
    });

    it('persists settings to storage when advSettings changes', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      act(() => {
        result.current.handleAdvSettingsChange({ apqEnabled: true });
      });
      await flushPromises();
      expect(writeKey).toHaveBeenCalledWith('gql_adv_settings_v1', expect.stringContaining('"apqEnabled":true'));
    });

    it('excludes detection flags when persisting global settings', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      act(() => {
        result.current.handleAdvSettingsChange({ apqUnsupportedDetected: true });
      });
      await flushPromises();
      const persistedCalls = vi.mocked(writeKey).mock.calls.filter((c) => c[0] === 'gql_adv_settings_v1');
      const lastCallArg = persistedCalls[persistedCalls.length - 1]?.[1] as string;
      if (lastCallArg) {
        const parsed = JSON.parse(lastCallArg) as Record<string, unknown>;
        expect('apqUnsupportedDetected' in parsed).toBe(false);
      }
    });
  });

  describe('handleAdvSettingsChange', () => {
    it('updates advSettings with patch', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true, batchEnabled: true }); });
      expect(result.current.advSettings.apqEnabled).toBe(true);
      expect(result.current.advSettings.batchEnabled).toBe(true);
    });

    it('preserves unpatched settings', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });
      expect(result.current.advSettings.dedupEnabled).toBe(true);
      expect(result.current.advSettings.batchEnabled).toBe(false);
    });
  });

  describe('APQ unsupported detection', () => {
    it('auto-disables APQ when apqInfo.unsupported is true and APQ is enabled', async () => {
      const { result, rerender } = renderHook(
        ({ apqInfo }) => useGraphqlAdvancedSettings(null, apqInfo),
        { initialProps: { apqInfo: null as { unsupported?: boolean } | null } },
      );
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });
      expect(result.current.advSettings.apqEnabled).toBe(true);

      rerender({ apqInfo: { unsupported: true } });
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqEnabled).toBe(false);
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(true);
      expect(result.current.apqUnsupportedToast).toBe(true);
    });

    it('does not auto-disable APQ when apqInfo.unsupported is true but APQ was already disabled', async () => {
      const { result } = renderHook(() =>
        useGraphqlAdvancedSettings(null, { unsupported: true }),
      );
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqEnabled).toBe(false);
      expect(result.current.apqUnsupportedToast).toBe(false);
    });
  });

  describe('per-connection detection flags', () => {
    it('resets detection flags when historyConnectionId changes', async () => {
      const { result, rerender } = renderHook(
        ({ connId }) => useGraphqlAdvancedSettings(connId, null),
        { initialProps: { connId: 'conn1' as string | null } },
      );
      await act(async () => { await flushPromises(); });
      act(() => { result.current.handleAdvSettingsChange({ apqUnsupportedDetected: true }); });
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(true);

      rerender({ connId: 'conn2' });
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(false);
      expect(result.current.advSettings.batchUnsupportedDetected).toBe(false);
    });

    it('loads per-connection detection flags when connectionId is set', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_conn_detection_conn1') return JSON.stringify({ apq: true, batch: false });
        return null;
      });
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn1', null));
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(true);
      expect(result.current.advSettings.batchUnsupportedDetected).toBe(false);
    });
  });

  describe('toast auto-dismiss', () => {
    it('auto-dismisses APQ unsupported toast after 6s', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      act(() => { result.current.setApqUnsupportedToast(true); });
      expect(result.current.apqUnsupportedToast).toBe(true);
      act(() => { vi.advanceTimersByTime(6001); });
      expect(result.current.apqUnsupportedToast).toBe(false);
      vi.useRealTimers();
    });

    it('auto-dismisses batch unsupported toast after 6s', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      act(() => { result.current.setBatchUnsupportedToast(true); });
      expect(result.current.batchUnsupportedToast).toBe(true);
      act(() => { vi.advanceTimersByTime(6001); });
      expect(result.current.batchUnsupportedToast).toBe(false);
      vi.useRealTimers();
    });

    it('does not auto-dismiss if toast was not set', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      act(() => { vi.advanceTimersByTime(10000); });
      expect(result.current.apqUnsupportedToast).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('setAdvSettingsOpen', () => {
    it('updates advSettingsOpen state', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      expect(result.current.advSettingsOpen).toBe(false);
      act(() => { result.current.setAdvSettingsOpen(true); });
      expect(result.current.advSettingsOpen).toBe(true);
    });
  });

  describe('handleAdvSettingsChange — per-connection persistence branches', () => {
    it('writes per-connection detection flags when connId set and apqUnsupportedDetected reset to false', async () => {
      vi.mocked(readKey).mockResolvedValue(JSON.stringify({ apq: true, batch: true }));
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn1', null));
      await act(async () => { await flushPromises(); });

      act(() => { result.current.handleAdvSettingsChange({ apqUnsupportedDetected: false }); });
      await act(async () => { await flushPromises(); });

      const calls = vi.mocked(writeKey).mock.calls.filter((c) => c[0] === 'gql_conn_detection_conn1');
      expect(calls.length).toBeGreaterThan(0);
      const lastArg = JSON.parse(calls[calls.length - 1][1] as string) as { apq?: boolean };
      expect(lastArg.apq).toBe(false);
    });

    it('writes per-connection detection flags when batchUnsupportedDetected reset to false', async () => {
      vi.mocked(readKey).mockResolvedValue(JSON.stringify({ apq: false, batch: true }));
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn2', null));
      await act(async () => { await flushPromises(); });

      act(() => { result.current.handleAdvSettingsChange({ batchUnsupportedDetected: false }); });
      await act(async () => { await flushPromises(); });

      const calls = vi.mocked(writeKey).mock.calls.filter((c) => c[0] === 'gql_conn_detection_conn2');
      expect(calls.length).toBeGreaterThan(0);
      const lastArg = JSON.parse(calls[calls.length - 1][1] as string) as { batch?: boolean };
      expect(lastArg.batch).toBe(false);
    });

    it('does not write per-connection flags when connId is null', async () => {
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();

      act(() => { result.current.handleAdvSettingsChange({ apqUnsupportedDetected: false }); });
      await act(async () => { await flushPromises(); });

      const calls = vi.mocked(writeKey).mock.calls.filter((c) => (c[0] as string).startsWith('gql_conn_detection_'));
      expect(calls.length).toBe(0);
    });
  });

  describe('per-connection flags — ?? false defaults (lines 122-123)', () => {
    it('uses false defaults when stored detection data has no apq/batch keys', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if ((key as string).includes('gql_conn_detection')) return JSON.stringify({});
        return null;
      });
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn-empty', null));
      await act(async () => { await flushPromises(); });
      // Both default to false via ?? false
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(false);
      expect(result.current.advSettings.batchUnsupportedDetected).toBe(false);
    });
  });

  describe('handleAdvSettingsChange — raw is null branch (line 135)', () => {
    it('uses empty existing object when readKey returns null for reset', async () => {
      vi.mocked(readKey).mockResolvedValue(null);
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn-null-raw', null));
      await act(async () => { await flushPromises(); });
      act(() => { result.current.handleAdvSettingsChange({ apqUnsupportedDetected: false }); });
      await act(async () => { await flushPromises(); });
      const calls = vi.mocked(writeKey).mock.calls.filter((c) => (c[0] as string).includes('conn-null-raw'));
      expect(calls.length).toBeGreaterThan(0);
      const written = JSON.parse(calls[0][1] as string) as { apq?: boolean };
      expect(written.apq).toBe(false);
    });
  });

  describe('APQ auto-disable — with connection ID', () => {
    it('writes per-connection detection when APQ auto-disabled and connId is set', async () => {
      const { result, rerender } = renderHook(
        ({ connId, apqInfo }) => useGraphqlAdvancedSettings(connId, apqInfo),
        { initialProps: { connId: 'conn3' as string | null, apqInfo: null as { unsupported?: boolean } | null } },
      );
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });

      rerender({ connId: 'conn3', apqInfo: { unsupported: true } });
      await act(async () => { await flushPromises(); });

      expect(result.current.advSettings.apqEnabled).toBe(false);
      const calls = vi.mocked(writeKey).mock.calls.filter((c) => c[0] === 'gql_conn_detection_conn3');
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('error handling and stale connection guard', () => {
    it('ignores invalid persisted global settings JSON', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_adv_settings_v1') return '{bad json';
        return null;
      });
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqEnabled).toBe(false);
    });

    it('ignores stale per-connection detection when connection changes during load', async () => {
      let resolveRead!: (v: string | null) => void;
      vi.mocked(readKey).mockImplementation((key) => {
        if (key === 'gql_conn_detection_conn-slow') {
          return new Promise((r) => { resolveRead = r; });
        }
        return Promise.resolve(null);
      });
      const { result, rerender } = renderHook(
        ({ connId }) => useGraphqlAdvancedSettings(connId, null),
        { initialProps: { connId: 'conn-slow' as string | null } },
      );
      await act(async () => { await flushPromises(); });
      rerender({ connId: 'conn-fast' });
      resolveRead(JSON.stringify({ apq: true, batch: true }));
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(false);
    });

    it('persists APQ unsupported flag using existing conn detection payload', async () => {
      vi.mocked(readKey).mockImplementation(async (key) => {
        if (key === 'gql_conn_detection_conn4') return JSON.stringify({ apq: false, batch: true });
        return null;
      });
      const { result, rerender } = renderHook(
        ({ connId, apqInfo }) => useGraphqlAdvancedSettings(connId, apqInfo),
        { initialProps: { connId: 'conn4' as string | null, apqInfo: null as { unsupported?: boolean } | null } },
      );
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });
      rerender({ connId: 'conn4', apqInfo: { unsupported: true } });
      await act(async () => { await flushPromises(); });
      const calls = vi.mocked(writeKey).mock.calls.filter((c) => c[0] === 'gql_conn_detection_conn4');
      expect(calls.length).toBeGreaterThan(0);
      const written = JSON.parse(calls[calls.length - 1][1] as string) as { apq?: boolean; batch?: boolean };
      expect(written.apq).toBe(true);
      expect(written.batch).toBe(true);
    });

    it('clears APQ toast timer on unmount', async () => {
      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      act(() => { result.current.setApqUnsupportedToast(true); });
      unmount();
      act(() => { vi.advanceTimersByTime(7000); });
      vi.useRealTimers();
    });

    it('clears batch toast timer on unmount', async () => {
      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      act(() => { result.current.setBatchUnsupportedToast(true); });
      unmount();
      act(() => { vi.advanceTimersByTime(7000); });
      vi.useRealTimers();
    });

    it('swallows writeKey failure when persisting global settings', async () => {
      vi.mocked(writeKey).mockRejectedValue(new Error('disk full'));
      const { result } = renderHook(() => useGraphqlAdvancedSettings(null, null));
      await flushPromises();
      expect(() => {
        act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });
      }).not.toThrow();
      await act(async () => { await flushPromises(); });
    });

    it('swallows writeKey failure when resetting per-connection detection', async () => {
      vi.mocked(readKey).mockResolvedValue(JSON.stringify({ apq: true }));
      vi.mocked(writeKey).mockRejectedValue(new Error('disk full'));
      const { result } = renderHook(() => useGraphqlAdvancedSettings('conn-err', null));
      await act(async () => { await flushPromises(); });
      act(() => { result.current.handleAdvSettingsChange({ apqUnsupportedDetected: false }); });
      await act(async () => { await flushPromises(); });
    });

    it('swallows writeKey failure when APQ auto-disable persists detection', async () => {
      vi.mocked(writeKey).mockRejectedValue(new Error('disk full'));
      const { result, rerender } = renderHook(
        ({ connId, apqInfo }) => useGraphqlAdvancedSettings(connId, apqInfo),
        { initialProps: { connId: 'conn5' as string | null, apqInfo: null as { unsupported?: boolean } | null } },
      );
      await flushPromises();
      act(() => { result.current.handleAdvSettingsChange({ apqEnabled: true }); });
      rerender({ connId: 'conn5', apqInfo: { unsupported: true } });
      await act(async () => { await flushPromises(); });
      expect(result.current.advSettings.apqUnsupportedDetected).toBe(true);
    });

    it('skips loading conn detection when connection id becomes null', async () => {
      const { rerender } = renderHook(
        ({ connId }) => useGraphqlAdvancedSettings(connId, null),
        { initialProps: { connId: 'conn-x' as string | null } },
      );
      await flushPromises();
      rerender({ connId: null });
      await flushPromises();
      expect(readKey).not.toHaveBeenCalledWith('gql_conn_detection_null');
    });
  });
});
