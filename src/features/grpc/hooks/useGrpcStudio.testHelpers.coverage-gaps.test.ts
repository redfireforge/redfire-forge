import { describe, expect, it, vi } from 'vitest';
import { setupUseGrpcStudioHookTest } from './useGrpcStudio.testHelpers';

describe('useGrpcStudio.testHelpers coverage gaps', () => {
  it('does not restore mocks when stream mode is enabled without restoreMocks', () => {
    const restoreSpy = vi.spyOn(vi, 'restoreAllMocks');

    setupUseGrpcStudioHookTest({ stream: true });

    expect(restoreSpy).not.toHaveBeenCalled();
    restoreSpy.mockRestore();
  });
});