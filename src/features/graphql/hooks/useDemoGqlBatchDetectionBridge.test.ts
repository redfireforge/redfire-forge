/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoGqlBatchDetectionBridge, resetGqlDemoBatchDetectionLive } from './useDemoGqlBatchDetectionBridge';

vi.mock('../utils/gqlDemoBatchDetectionCleanup', () => ({
  purgeGqlDemoBatchDetectionFlags: vi.fn(async () => 1),
}));

import { purgeGqlDemoBatchDetectionFlags } from '../utils/gqlDemoBatchDetectionCleanup';

describe('useDemoGqlBatchDetectionBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection;
  });

  it('resets live batch detection and purges storage', () => {
    const handleAdvSettingsChange = vi.fn();
    const setBatchUnsupportedToast = vi.fn();
    renderHook(() =>
      useDemoGqlBatchDetectionBridge({ handleAdvSettingsChange, setBatchUnsupportedToast }),
    );

    const reset = (window as unknown as Record<string, () => boolean>).__demoResetGqlBatchDetection;
    expect(reset()).toBe(true);
    expect(handleAdvSettingsChange).toHaveBeenCalledWith({ batchUnsupportedDetected: false });
    expect(setBatchUnsupportedToast).toHaveBeenCalledWith(false);
    expect(purgeGqlDemoBatchDetectionFlags).toHaveBeenCalled();
  });

  it('resetGqlDemoBatchDetectionLive delegates to bridge', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection = spy;
    expect(resetGqlDemoBatchDetectionLive()).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('resetGqlDemoBatchDetectionLive returns false when bridge is absent', () => {
    delete (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection;
    expect(resetGqlDemoBatchDetectionLive()).toBe(false);
  });

  it('cleans up reset bridge on unmount', () => {
    const { unmount } = renderHook(() =>
      useDemoGqlBatchDetectionBridge({
        handleAdvSettingsChange: vi.fn(),
        setBatchUnsupportedToast: vi.fn(),
      }),
    );
    expect((window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection).toBeTypeOf('function');
    unmount();
    expect((window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection).toBeUndefined();
  });
});
