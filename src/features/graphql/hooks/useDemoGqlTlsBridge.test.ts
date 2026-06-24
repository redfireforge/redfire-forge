/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoGqlTlsBridge } from './useDemoGqlTlsBridge';

describe('useDemoGqlTlsBridge', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
  });

  it('registers and unregisters __demoApplyGqlTlsSettings on window', () => {
    const applyTlsSettings = vi.fn();
    const { unmount } = renderHook(() => useDemoGqlTlsBridge({ applyTlsSettings }));

    const bridge = (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings as
      | ((patch: { skipTlsVerify?: boolean }) => void)
      | undefined;
    expect(bridge).toBeTypeOf('function');
    bridge?.({ skipTlsVerify: false });
    expect(applyTlsSettings).toHaveBeenCalledWith({ skipTlsVerify: false });

    unmount();
    expect((window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings).toBeUndefined();
  });
});
