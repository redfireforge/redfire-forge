/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi} from 'vitest';
import { GRPC_ERROR_CODES } from '../../../../shared/grpc/contracts';
import * as grpcApiClient from '../../../../shared/grpc/grpcApiClient';
import { GrpcApiClientError } from '../../../../shared/grpc/grpcApiClient';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createDefaultProtoIngestState, createEmptyTabDescriptorState } from '../../grpcStudioTypes';
import * as descriptorFallback from '../../utils/descriptorSourceFallback';
import * as downloadProtoset from '../../utils/downloadProtoset';
import * as secretVault from '../../utils/grpcTabSecretVault';
import {
  createDescribeFromIngestHandler,
  createExportProtosetHandler,
  createPatchTabProtoIngestHandler,
  createReflectTabHandler,
} from '../grpcStudioDescriptorLoad';
import { makeRuntime, setupGrpcStudioDescriptorLoadCoverageGapsTest } from './grpcStudioDescriptorLoadCoverageGaps.testHelpers';

vi.mock('../../utils/descriptorSourceFallback', async () => {
  const actual = await vi.importActual<typeof descriptorFallback>('../../utils/descriptorSourceFallback');
  return {
    ...actual,
    loadDescriptorWithAutoFallback: vi.fn(),
  };
});

vi.mock('../../utils/downloadProtoset', () => ({
  downloadProtosetFile: vi.fn(),
}));

vi.mock('../../utils/grpcTabSecretVault', () => ({
  scheduleTabSecretsVaultSync: vi.fn(),
}));

setupGrpcStudioDescriptorLoadCoverageGapsTest();

describe('grpcStudioDescriptorLoad coverage gaps — reflect and ingest', () => {
  it('reflectTab loads descriptor on success', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(descriptorFallback.loadDescriptorWithAutoFallback).toHaveBeenCalled();
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'loaded',
    }));
  });

  it('reflectTab surfaces API client errors', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new GrpcApiClientError('reflect', 'reflection denied', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'reflection denied',
    }));
  });

  it('reflectTab no-ops for missing tabs', async () => {
    const ctx = makeRuntime();
    await createReflectTabHandler(ctx)('missing-tab');
    expect(descriptorFallback.loadDescriptorWithAutoFallback).not.toHaveBeenCalled();
  });

  it('reflectTab reports unavailable sources for invalid targets', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabs[0] = {
      ...ctx.sessionRef.current.tabs[0]!,
      target: 'not-a-target',
    };

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
    }));
  });

  it('describeFromIngest validates ingest drafts before loading', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: { ...createDefaultProtoIngestState(), source: 'url_proto', url: '' },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);
    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
    }));
  });

  it('describeFromIngest validates proto_files, protoset, and bsr drafts', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    const cases = [
      { ...createDefaultProtoIngestState(), source: 'proto_files' as const, protoRoots: [{ id: 'root-default', mountPath: 'root', files: [] }] },
      { ...createDefaultProtoIngestState(), source: 'proto_files' as const, protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: '', content: 'syntax = "proto3";' }] }] },
      { ...createDefaultProtoIngestState(), source: 'protoset' as const, protosetBase64: '   ' },
      { ...createDefaultProtoIngestState(), source: 'bsr' as const, bsrModule: '  ' },
    ];

    for (const protoIngest of cases) {
      ctx.sessionRef.current.tabDescriptors[tabId] = {
        ...createEmptyTabDescriptorState(),
        protoIngest,
      };
      const ok = await createDescribeFromIngestHandler(ctx)(tabId);
      expect(ok).toBe(false);
    }
  });

  it('describeFromIngest loads descriptor and clears bsr token after success', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'bsr',
        bsrModule: 'bufbuild/eliza',
        bsrToken: 'secret-token',
      },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(true);
    expect(secretVault.scheduleTabSecretsVaultSync).toHaveBeenCalledWith(expect.objectContaining({
      bsrToken: '',
    }));
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      protoIngest: expect.objectContaining({ bsrToken: undefined }),
    }));
  });

  it('describeFromIngest surfaces generic load failures', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue('network down');

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'Failed to load descriptor from proto',
    }));
  });

  it('describeFromIngest no-ops for missing tabs', async () => {
    const ctx = makeRuntime();
    const ok = await createDescribeFromIngestHandler(ctx)('missing-tab');
    expect(ok).toBe(false);
  });

  it('patchTabProtoIngest syncs bsr token changes to secret vault', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { bsrToken: 'rotated-token' });

    expect(secretVault.scheduleTabSecretsVaultSync).toHaveBeenCalledWith(expect.objectContaining({
      bsrToken: 'rotated-token',
    }));
  });

  it('patchTabProtoIngest clears error state without bumping generation when idle', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      loadState: 'error',
      errorMessage: 'old',
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { url: 'https://example.com/a.proto' });

    expect(ctx.descriptorLoadGenerationRef.current[tabId]).toBeUndefined();
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'idle',
      errorMessage: undefined,
    }));
  });

  it('patchTabProtoIngest clears loading/error state and bumps generation', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loading',
      errorMessage: 'old',
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { url: 'https://example.com/a.proto' });
    expect(ctx.descriptorLoadGenerationRef.current[tabId]).toBe(1);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'idle',
      errorMessage: undefined,
    }));
  });

  it('exportProtoset throws when descriptor missing and augments invalid descriptor errors', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await expect(createExportProtosetHandler(ctx)(tabId)).rejects.toThrow(/Load a schema/i);

    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };

    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockRejectedValue(
      new GrpcApiClientError('export', 'stale cache', {
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      }),
    );

    await expect(createExportProtosetHandler(ctx)(tabId)).rejects.toThrow(/Reload the schema/i);
  });

  it('exportProtoset downloads protoset on success', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'YWJj', fileName: 'schema.pb' },
      meta: { requestId: 'req-export', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExportProtosetHandler(ctx)(tabId);

    expect(downloadProtoset.downloadProtosetFile).toHaveBeenCalledWith('YWJj', 'schema.pb');
  });

  it('exportProtoset uses timestamp fallback ids when crypto.randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    const exportSpy = vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockResolvedValue({
      ok: true,
      op: 'export_protoset',
      data: { protosetBase64: 'YWJj', fileName: 'schema.pb' },
      meta: { requestId: 'req-export', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExportProtosetHandler(ctx)(tabId);

    expect(exportSpy).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.stringMatching(/^req-export-/),
    }));
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  it('exportProtoset rethrows non-invalid descriptor errors', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    vi.spyOn(grpcApiClient, 'postGrpcExportProtoset').mockRejectedValue(
      new GrpcApiClientError('export', 'server unavailable', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await expect(createExportProtosetHandler(ctx)(tabId)).rejects.toThrow(/server unavailable/i);
  });

  it('reflectTab aborts pending unary calls before loading', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.inFlightCallRef.current[tabId] = 'req-unary';
    ctx.sessionRef.current.tabs[0] = {
      ...ctx.sessionRef.current.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: 'req-unary',
    };

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.fireCancelInFlight).toHaveBeenCalled();
    expect(ctx.updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({ lifecycle: 'idle' }));
  });

  it('reflectTab aborts active streams before loading', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabs[0] = {
      ...ctx.sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-active',
    };

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({ streamLifecycle: 'idle' }));
  });

  it('reflectTab ignores stale load results', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    let resolveLoad: (value: { descriptor: typeof FIXTURE_DESCRIPTOR; source: 'reflection' }) => void = () => undefined;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(
      () => new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const pending = createReflectTabHandler(ctx)(tabId);
    ctx.descriptorLoadGenerationRef.current[tabId] = 99;
    resolveLoad({ descriptor: FIXTURE_DESCRIPTOR, source: 'reflection' });
    await pending;

    expect(ctx.patchTabDescriptor).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'loaded',
    }));
  });

  it('reflectTab surfaces generic non-Error failures', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue('network down');

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'Reflection failed',
    }));
  });

  it('describeFromIngest uses network describe path with postGrpcDescribe', async () => {
    const actual = await vi.importActual<typeof descriptorFallback>('../../utils/descriptorSourceFallback');
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(
      actual.loadDescriptorWithAutoFallback,
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
      sourceSelection: {
        mode: 'manual',
        activeSource: 'protoset',
        autoPrecedence: ['reflection', 'proto_files', 'protoset', 'url_proto', 'bsr'],
      },
    };
    vi.spyOn(grpcApiClient, 'postGrpcDescribe').mockResolvedValue({
      ok: true,
      op: 'describe',
      data: FIXTURE_DESCRIPTOR,
      meta: { requestId: 'req-describe', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(true);
    expect(grpcApiClient.postGrpcDescribe).toHaveBeenCalled();
  });

  it('describeFromIngest surfaces API client errors', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new GrpcApiClientError('describe', 'describe denied', { code: GRPC_ERROR_CODES.DESCRIBE_FAILED }),
    );

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'describe denied',
    }));
  });

  it('reflectTab invokes postGrpcReflect through network loader', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ reflect }) => ({
      descriptor: await reflect(),
      source: 'reflection',
    }));
    vi.spyOn(grpcApiClient, 'postGrpcReflect').mockResolvedValue({
      ok: true,
      op: 'reflect',
      data: FIXTURE_DESCRIPTOR,
      meta: { requestId: 'req-reflect', timestamp: '2026-01-01T00:00:00.000Z' },
    });
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(grpcApiClient.postGrpcReflect).toHaveBeenCalled();
  });

  it('describeFromIngest ignores stale results after generation bump', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
    };
    let resolveLoad: (value: { descriptor: typeof FIXTURE_DESCRIPTOR; source: 'protoset' }) => void = () => undefined;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(
      () => new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const pending = createDescribeFromIngestHandler(ctx)(tabId);
    ctx.descriptorLoadGenerationRef.current[tabId] = 99;
    resolveLoad({ descriptor: FIXTURE_DESCRIPTOR, source: 'protoset' });
    const ok = await pending;

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'loaded',
    }));
  });

  it('reflectTab surfaces plain Error messages from loader', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(new Error('TLS required'));

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'TLS required',
    }));
  });

  it('reflectTab uses manual source selection when configured', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      sourceSelection: {
        mode: 'manual',
        activeSource: 'protoset',
        autoPrecedence: ['reflection', 'proto_files', 'protoset', 'url_proto', 'bsr'],
      },
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockResolvedValue({
      descriptor: FIXTURE_DESCRIPTOR,
      source: 'protoset',
    });

    await createReflectTabHandler(ctx)(tabId);

    expect(descriptorFallback.loadDescriptorWithAutoFallback).toHaveBeenCalledWith(
      expect.objectContaining({ initialSource: 'protoset' }),
    );
  });

});
