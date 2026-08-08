/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrpcStudioPageDemoBridges } from './useGrpcStudioPageDemoBridges';

function makeStudioStub() {
  const updateTab = vi.fn();
  const patchTabDescriptor = vi.fn();
  const cancelUnaryCall = vi.fn().mockResolvedValue(undefined);
  const cancelStreamCall = vi.fn().mockResolvedValue(undefined);
  const reflectTab = vi.fn().mockResolvedValue(undefined);
  return {
    studio: {
      activeTab: { id: 'tab-1', descriptorKey: 'desc-1' },
      activeTabDescriptor: { descriptor: { key: 'desc-live' } },
      updateTab,
      patchTabDescriptor,
      cancelUnaryCall,
      cancelStreamCall,
      reflectTab,
    },
    advancedFeatures: {
      applySchemaDiffComparison: vi.fn(),
      patchMockRulesJson: vi.fn(),
      stopMockServer: vi.fn().mockResolvedValue(undefined),
    },
    updateTab,
    patchTabDescriptor,
    cancelUnaryCall,
    cancelStreamCall,
    reflectTab,
  };
}

describe('useGrpcStudioPageDemoBridges', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { ...window });
  });

  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoPatchGrpcActiveTab;
    delete w.__demoResetGrpcActiveTab;
    delete w.__demoResetGrpcManageSchemasDrafts;
    delete w.__demoGetGrpcActiveDescriptorKey;
    delete w.__demoReflectGrpcActiveTab;
    delete w.__demoPatchGrpcSchemaDiffReport;
    delete w.__demoPatchGrpcMockRulesJson;
    delete w.__demoStopGrpcMockRuntime;
    vi.unstubAllGlobals();
  });

  it('registers demo patch and reset bridges on window', async () => {
    const { studio, advancedFeatures, updateTab, reflectTab } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));

    const w = window as unknown as Record<string, unknown>;
    expect(typeof w.__demoPatchGrpcActiveTab).toBe('function');
    expect(typeof w.__demoResetGrpcActiveTab).toBe('function');
    expect(typeof w.__demoResetGrpcManageSchemasDrafts).toBe('function');
    expect(typeof w.__demoGetGrpcActiveDescriptorKey).toBe('function');
    expect(typeof w.__demoReflectGrpcActiveTab).toBe('function');
    expect(typeof w.__demoPatchGrpcSchemaDiffReport).toBe('function');
    expect(typeof w.__demoPatchGrpcMockRulesJson).toBe('function');
    expect(typeof w.__demoStopGrpcMockRuntime).toBe('function');

    const patched = (w.__demoPatchGrpcActiveTab as (p: { grpcurlExportContext?: unknown }) => boolean)({
      grpcurlExportContext: { target: 'localhost:50051' },
    });
    expect(patched).toBe(true);
    expect(updateTab).toHaveBeenCalledWith('tab-1', { grpcurlExportContext: { target: 'localhost:50051' } });

    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBe('desc-live');
    await expect((w.__demoReflectGrpcActiveTab as () => Promise<boolean>)()).resolves.toBe(true);
    expect(reflectTab).toHaveBeenCalledWith('tab-1');
    await expect((w.__demoStopGrpcMockRuntime as () => Promise<boolean>)()).resolves.toBe(true);
    expect(advancedFeatures.stopMockServer).toHaveBeenCalled();
  });

  it('cleans up window bridges on unmount', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    const { unmount } = renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    unmount();
    const w = window as unknown as Record<string, unknown>;
    expect(w.__demoPatchGrpcActiveTab).toBeUndefined();
    expect(w.__demoResetGrpcActiveTab).toBeUndefined();
    expect(w.__demoResetGrpcManageSchemasDrafts).toBeUndefined();
    expect(w.__demoGetGrpcActiveDescriptorKey).toBeUndefined();
    expect(w.__demoReflectGrpcActiveTab).toBeUndefined();
    expect(w.__demoPatchGrpcSchemaDiffReport).toBeUndefined();
    expect(w.__demoPatchGrpcMockRulesJson).toBeUndefined();
    expect(w.__demoStopGrpcMockRuntime).toBeUndefined();
  });

  it('quiet reflect bridge returns false without an active tab', async () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTab = undefined as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    await expect((w.__demoReflectGrpcActiveTab as () => Promise<boolean>)()).resolves.toBe(false);
  });

  it('quiet reflect bridge returns false when reflectTab throws', async () => {
    const { studio, advancedFeatures, reflectTab } = makeStudioStub();
    reflectTab.mockRejectedValueOnce(new Error('reflect failed'));
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    await expect((w.__demoReflectGrpcActiveTab as () => Promise<boolean>)()).resolves.toBe(false);
  });

  it('patches mock rules JSON without requiring a descriptor', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    const ok = (w.__demoPatchGrpcMockRulesJson as (json: string) => boolean)('{"version":1,"rules":[]}');
    expect(ok).toBe(true);
    expect(advancedFeatures.patchMockRulesJson).toHaveBeenCalledWith('{"version":1,"rules":[]}');
  });

  it('returns false for mock rules patch when input is not a string', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    const ok = (w.__demoPatchGrpcMockRulesJson as (json: unknown) => boolean)({ rules: [] });
    expect(ok).toBe(false);
    expect(advancedFeatures.patchMockRulesJson).not.toHaveBeenCalled();
  });

  it('returns false when no active tab for patch helpers', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTab = undefined as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoPatchGrpcActiveTab as (p: object) => boolean)({})).toBe(false);
    expect((w.__demoResetGrpcActiveTab as () => boolean)()).toBe(false);
    expect((w.__demoResetGrpcManageSchemasDrafts as () => boolean)()).toBe(false);
    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBe('desc-live');
  });

  it('reset bridge clears tab connection state', () => {
    const {
      studio, advancedFeatures, updateTab, cancelUnaryCall, cancelStreamCall,
    } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoResetGrpcActiveTab as () => boolean)()).toBe(true);
    expect(cancelUnaryCall).toHaveBeenCalledWith('tab-1');
    expect(cancelStreamCall).toHaveBeenCalledWith('tab-1');
    expect(updateTab).toHaveBeenCalledWith('tab-1', {
      connectionId: undefined,
      target: 'localhost:50051',
      tlsMode: 'disabled',
      tlsConfig: undefined,
      auth: { type: 'none' },
      metadata: {},
      transportMode: 'express',
      grpcurlExportContext: undefined,
    });
  });

  it('manage-schemas drafts bridge resets protoIngest without UI', () => {
    const { studio, advancedFeatures, patchTabDescriptor } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoResetGrpcManageSchemasDrafts as () => boolean)()).toBe(true);
    expect(patchTabDescriptor).toHaveBeenCalledWith('tab-1', {
      protoIngest: expect.objectContaining({
        source: 'proto_files',
        protoRoots: [expect.objectContaining({ mountPath: 'root', files: [] })],
      }),
    });
  });

  it('schema diff bridge applies comparison when descriptor is loaded', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    const applySchemaDiffComparison = advancedFeatures.applySchemaDiffComparison as ReturnType<typeof vi.fn>;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    const report = { summary: { totalChanges: 0 }, changes: [] };
    const ok = (w.__demoPatchGrpcSchemaDiffReport as (input: {
      report: typeof report;
      baselineCapturedAt?: string;
    }) => boolean)({ report, baselineCapturedAt: '2026-01-01T00:00:00.000Z' });
    expect(ok).toBe(true);
    expect(applySchemaDiffComparison).toHaveBeenCalledWith({
      baselineDescriptor: studio.activeTabDescriptor.descriptor,
      report,
      baselineCapturedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('schema diff bridge returns false without descriptor', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTabDescriptor = { descriptor: undefined } as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoPatchGrpcSchemaDiffReport as (input: { report: object }) => boolean)({ report: {} })).toBe(false);
  });

  it('descriptor key falls back to active tab descriptorKey', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTabDescriptor = { descriptor: undefined } as never;
    studio.activeTab = { id: 'tab-1', descriptorKey: ' tab-key ' } as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBe('tab-key');
  });

  it('descriptor key returns null when no descriptor key is available', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTabDescriptor = { descriptor: undefined } as never;
    studio.activeTab = { id: 'tab-1', descriptorKey: '   ' } as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBeNull();
  });

  it('schema diff bridge omits baselineCapturedAt when not provided', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    const applySchemaDiffComparison = advancedFeatures.applySchemaDiffComparison as ReturnType<typeof vi.fn>;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    const report = { summary: { totalChanges: 1 }, changes: [] };
    expect((w.__demoPatchGrpcSchemaDiffReport as (input: { report: typeof report }) => boolean)({ report })).toBe(true);
    expect(applySchemaDiffComparison).toHaveBeenCalledWith({
      baselineDescriptor: studio.activeTabDescriptor.descriptor,
      report,
      baselineCapturedAt: undefined,
    });
  });
});
