/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrpcStudioPageDemoBridges } from './useGrpcStudioPageDemoBridges';

function makeStudioStub() {
  const updateTab = vi.fn();
  const patchTabDescriptor = vi.fn();
  const cancelUnaryCall = vi.fn().mockResolvedValue(undefined);
  const cancelStreamCall = vi.fn().mockResolvedValue(undefined);
  return {
    studio: {
      activeTab: { id: 'tab-1', descriptorKey: 'desc-1' },
      activeTabDescriptor: { descriptor: { key: 'desc-live' } },
      updateTab,
      patchTabDescriptor,
      cancelUnaryCall,
      cancelStreamCall,
    },
    advancedFeatures: {
      applySchemaDiffComparison: vi.fn(),
    },
    updateTab,
    patchTabDescriptor,
    cancelUnaryCall,
    cancelStreamCall,
  };
}

describe('useGrpcStudioPageDemoBridges', () => {
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
  });

  it('registers demo patch and reset bridges on window', async () => {
    const { studio, advancedFeatures, updateTab } = makeStudioStub();
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));

    const w = window as unknown as Record<string, unknown>;
    expect(typeof w.__demoPatchGrpcActiveTab).toBe('function');
    expect(typeof w.__demoResetGrpcActiveTab).toBe('function');
    expect(typeof w.__demoResetGrpcManageSchemasDrafts).toBe('function');
    expect(typeof w.__demoGetGrpcActiveDescriptorKey).toBe('function');
    expect(typeof w.__demoPatchGrpcSchemaDiffReport).toBe('function');

    const patched = (w.__demoPatchGrpcActiveTab as (p: { grpcurlExportContext?: unknown }) => boolean)({
      grpcurlExportContext: { target: 'localhost:50051' },
    });
    expect(patched).toBe(true);
    expect(updateTab).toHaveBeenCalledWith('tab-1', { grpcurlExportContext: { target: 'localhost:50051' } });

    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBe('desc-live');
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
    expect(w.__demoPatchGrpcSchemaDiffReport).toBeUndefined();
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

  it('descriptor key prefers the active tab descriptor when present', () => {
    const { studio, advancedFeatures } = makeStudioStub();
    studio.activeTabDescriptor = { descriptor: { key: ' direct-key ' } } as never;
    studio.activeTab = { id: 'tab-1', descriptorKey: 'fallback-key' } as never;
    renderHook(() => useGrpcStudioPageDemoBridges(studio as never, advancedFeatures as never));
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoGetGrpcActiveDescriptorKey as () => string | null)()).toBe('direct-key');
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
