/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoGqlEnvBridge } from './useDemoGqlEnvBridge';
import {
  resetGqlDemoBatchDetectionLive,
  useDemoGqlBatchDetectionBridge,
} from './useDemoGqlBatchDetectionBridge';
import {
  resetGqlModalLockHostForTests,
  useDemoGqlModalLockBridge,
} from './useDemoGqlModalLockBridge';
import { publishGqlModalLock } from '../utils/gqlModalLockHost';
import { useDemoGqlQueryBridge } from './useDemoGqlQueryBridge';
import { useDemoGqlRightViewBridge } from './useDemoGqlRightViewBridge';
import { useDemoGqlTlsBridge } from './useDemoGqlTlsBridge';

vi.mock('../utils/gqlDemoBatchDetectionCleanup', () => ({
  purgeGqlDemoBatchDetectionFlags: vi.fn(async () => 1),
}));

import { purgeGqlDemoBatchDetectionFlags } from '../utils/gqlDemoBatchDetectionCleanup';

describe('demo gql bridges coverage', () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoUpsertGqlEnv;
    delete w.__demoDeleteGqlEnvByName;
    delete w.__demoResetGqlBatchDetection;
    delete w.__demoOpenGqlProfileModal;
    delete w.__demoSetGqlQuery;
    delete w.__demoSetGqlRightView;
    delete w.__demoApplyGqlTlsSettings;
    resetGqlModalLockHostForTests();
  });

  it('covers env bridge setup and calls', () => {
    const upsertEnvironment = vi.fn();
    const deleteEnvironmentByName = vi.fn();

    renderHook(() => useDemoGqlEnvBridge({ upsertEnvironment, deleteEnvironmentByName }));
    const w = window as unknown as {
      __demoUpsertGqlEnv: (name: string, vars: Array<{ key: string; value: string }>) => void;
      __demoDeleteGqlEnvByName: (name: string) => void;
    };

    w.__demoUpsertGqlEnv('Demo', [{ key: 'token', value: 'abc' }]);
    w.__demoDeleteGqlEnvByName('Demo');

    expect(upsertEnvironment).toHaveBeenCalledWith('Demo', [{ key: 'token', value: 'abc' }]);
    expect(deleteEnvironmentByName).toHaveBeenCalledWith('Demo');
  });

  it('covers batch detection reset bridge and wrapper fallback', async () => {
    const handleAdvSettingsChange = vi.fn();
    const setBatchUnsupportedToast = vi.fn();

    const { unmount } = renderHook(() =>
      useDemoGqlBatchDetectionBridge({ handleAdvSettingsChange, setBatchUnsupportedToast }),
    );

    expect(resetGqlDemoBatchDetectionLive()).toBe(true);
    expect(handleAdvSettingsChange).toHaveBeenCalledWith({ batchUnsupportedDetected: false });
    expect(setBatchUnsupportedToast).toHaveBeenCalledWith(false);
    expect(purgeGqlDemoBatchDetectionFlags).toHaveBeenCalled();

    unmount();
    expect(resetGqlDemoBatchDetectionLive()).toBe(false);
    await Promise.resolve();
  });

  it('covers modal lock bridge profile opener and lock transitions', () => {
    const setEnvModalOpen = vi.fn();
    const setProfileModalOpen = vi.fn();

    const { result } = renderHook(() =>
      useDemoGqlModalLockBridge({
        envModalOpen: true,
        profileModalOpen: true,
        setEnvModalOpen,
        setProfileModalOpen,
      }),
    );

    const w = window as unknown as {
      __demoOpenGqlProfileModal: () => boolean;
    };
    expect(w.__demoOpenGqlProfileModal()).toBe(true);
    expect(setProfileModalOpen).toHaveBeenCalledWith(true);

    publishGqlModalLock({ envAllowed: false, profileAllowed: false });
    expect(result.current).toEqual({ envAllowed: true, profileAllowed: true });
    expect(setEnvModalOpen).not.toHaveBeenCalledWith(false);
  });

  it('covers query, right-view, and TLS bridge forwarding', () => {
    const setGqlQuery = vi.fn();
    const setRightView = vi.fn();
    const applyTlsSettings = vi.fn();

    renderHook(() => useDemoGqlQueryBridge({ setGqlQuery }));
    renderHook(() => useDemoGqlRightViewBridge({ setRightView }));
    renderHook(() => useDemoGqlTlsBridge({ applyTlsSettings }));

    const w = window as unknown as {
      __demoSetGqlQuery: (value: string) => void;
      __demoSetGqlRightView: (view: string) => void;
      __demoApplyGqlTlsSettings: (settings: Record<string, unknown>) => void;
    };
    w.__demoSetGqlQuery('query { health }');
    w.__demoSetGqlRightView('schema');
    w.__demoApplyGqlTlsSettings({ skipTlsVerify: true });

    expect(setGqlQuery).toHaveBeenCalledWith('query { health }');
    expect(setRightView).toHaveBeenCalledWith('schema');
    expect(applyTlsSettings).toHaveBeenCalledWith({ skipTlsVerify: true });
  });
});
