/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi} from 'vitest';
import * as grpcApiClient from '../../../../shared/grpc/grpcApiClient';
import { GrpcApiClientError } from '../../../../shared/grpc/grpcApiClient';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';
import { createDefaultProtoIngestState, createEmptyTabDescriptorState } from '../../grpcStudioTypes';
import * as descriptorFallback from '../../utils/descriptorSourceFallback';
import * as resolveGrpcTabConnection from '../../utils/resolveGrpcTabConnection';
import * as secretVault from '../../utils/grpcTabSecretVault';
import * as grpcStudioSessionHelpers from '../grpcStudioSessionHelpers';
import {
  createDescribeFromIngestHandler,
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

describe('grpcStudioDescriptorLoad coverage gaps — export and edge cases', () => {
  it('reflectTab reports generic unavailable sources message for valid targets', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      sourceSelection: {
        mode: 'manual',
        activeSource: 'protoset',
        autoPrecedence: ['reflection', 'proto_files', 'protoset', 'url_proto', 'bsr'],
      },
      protoIngest: createDefaultProtoIngestState(),
    };

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'No descriptor sources are available for this tab',
    }));
  });

  it('load network path throws when tab disappears mid-load', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ reflect }) => {
      ctx.sessionRef.current = {
        ...ctx.sessionRef.current,
        tabs: ctx.sessionRef.current.tabs.filter((entry) => entry.id !== tabId),
      };
      await reflect();
      return { descriptor: FIXTURE_DESCRIPTOR, source: 'reflection' };
    });

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
    }));
  });

  it('load network path rejects reflect when target is unavailable', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.spyOn(resolveGrpcTabConnection, 'resolutionToGrpcTarget').mockReturnValue(undefined);
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ reflect }) => {
      await reflect();
      return { descriptor: FIXTURE_DESCRIPTOR, source: 'reflection' };
    });

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'Target address is invalid',
    }));
  });

  it('load network path surfaces describe request build failures', async () => {
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
    vi.spyOn(descriptorFallback, 'buildDescribeRequestForSource').mockReturnValue({ error: 'broken request' });
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ describe }) => ({
      descriptor: await describe('protoset'),
      source: 'protoset',
    }));

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'broken request',
    }));
  });

  it('describeFromIngest ignores stale failures after generation bump', async () => {
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
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(new Error('load failed'));

    const pending = createDescribeFromIngestHandler(ctx)(tabId);
    ctx.descriptorLoadGenerationRef.current[tabId] = 99;
    const ok = await pending;

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'load failed',
    }));
  });

  it('patchTabProtoIngest invalidates in-flight loading state', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loading',
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { url: 'https://example.com/a.proto' });

    expect(ctx.descriptorLoadGenerationRef.current[tabId]).toBe(1);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'idle',
    }));
  });

  it('patchTabProtoIngest merges ingest for tabs without descriptor state', () => {
    const ctx = makeRuntime();
    createPatchTabProtoIngestHandler(ctx)('new-tab-id', { url: 'https://example.com/a.proto' });
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith('new-tab-id', expect.objectContaining({
      protoIngest: expect.objectContaining({ url: 'https://example.com/a.proto' }),
    }));
  });

  it('reflectTab ignores stale empty-source failures', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.spyOn(descriptorFallback, 'orderedDescriptorSourcesForLoad').mockImplementation(() => {
      ctx.descriptorLoadGenerationRef.current[tabId] = 99;
      return [];
    });

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
    }));
  });

  it('reflectTab ignores stale caught loader failures', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(new Error('load failed'));

    const pending = createReflectTabHandler(ctx)(tabId);
    ctx.descriptorLoadGenerationRef.current[tabId] = 99;
    await pending;

    expect(ctx.patchTabDescriptor).not.toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: 'load failed',
    }));
  });

  it('describeFromIngest succeeds for bsr modules without a token', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'bsr',
        bsrModule: 'bufbuild/eliza',
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockResolvedValue({
      descriptor: FIXTURE_DESCRIPTOR,
      source: 'bsr',
    });

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(true);
    expect(secretVault.scheduleTabSecretsVaultSync).not.toHaveBeenCalled();
  });

  it('uses fallback request ids when crypto randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
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

    expect(grpcApiClient.postGrpcReflect).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.stringMatching(/^req-reflect-/) }),
    );
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  it('reflectTab maps proxy/network failures to backend guidance', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new GrpcApiClientError('reflect', 'Failed to fetch', { code: 'GRPC_NETWORK_ERROR' }),
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: expect.stringMatching(/Express gRPC proxy/i),
    }));
  });

  it('reflectTab maps generic fetch failures to backend guidance', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new Error('Failed to fetch'),
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: expect.stringMatching(/Express gRPC proxy/i),
    }));
  });

  it('reflectTab maps TLS handshake mismatch to actionable tls guidance', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new Error('Error: 14 UNAVAILABLE: No connection established. Last error: Error: 8D0DDEB100000000:error:0A00010B:SSL routines:tls_validate_record_header:wrong version number'),
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: expect.stringMatching(/TLS handshake failed/i),
    }));
  });

  it('describeFromIngest returns false when tab descriptor state is missing', async () => {
    const ctx = makeRuntime();
    const ok = await createDescribeFromIngestHandler(ctx)('missing-tab');
    expect(ok).toBe(false);
  });

  it('reflectTab maps proxy guidance when the backend hint mentions the app HTTP proxy', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new Error('Could not reach the app HTTP proxy'),
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: expect.stringMatching(/Express gRPC proxy/i),
    }));
  });

  it('describeFromIngest accepts valid proto file drafts', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'proto_files',
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'demo.proto', content: 'syntax = "proto3"; package demo;' }] }],
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockResolvedValue({
      descriptor: FIXTURE_DESCRIPTOR,
      source: 'proto_files',
    });

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(true);
  });

  it('describeFromIngest rejects url_proto drafts without a url', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'url_proto',
        url: '   ',
      },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: 'Enter an HTTPS URL to a .proto file before loading',
    }));
  });

  it('describeFromIngest rejects blank bsr module references', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'bsr',
        bsrModule: '   ',
      },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: 'Enter a BSR module reference (owner/repo) before loading',
    }));
  });

  it('describeFromIngest rejects proto files with empty path or content', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'proto_files',
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'demo.proto', content: '   ' }] }],
      },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: 'Each proto file requires a non-empty path and content',
    }));
  });

  it('describeFromIngest propagates describe request build failures', async () => {
    vi.spyOn(descriptorFallback, 'buildDescribeRequestForSource').mockReturnValue({ error: 'broken describe draft' });
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ describe }) => {
      await describe('protoset');
      return { descriptor: FIXTURE_DESCRIPTOR, source: 'protoset' };
    });
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

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: 'broken describe draft',
    }));
  });

  it('reflectTab surfaces invalid-target errors from the reflect callback', async () => {
    vi.spyOn(grpcStudioSessionHelpers, 'resolveTabConnectionWithEnv').mockReturnValue({
      targetValidation: { valid: false, reason: 'Invalid target' },
      tlsMode: 'disabled',
    } as never);
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async ({ reflect }) => {
      await reflect();
      return { descriptor: FIXTURE_DESCRIPTOR, source: 'reflection' };
    });
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'error',
      errorMessage: expect.stringMatching(/invalid/i),
    }));
  });

  it('describeFromIngest fails when the tab disappears before network lookup', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    const session = ctx.sessionRef.current;
    const tabsCopy = [...session.tabs];
    let tabReads = 0;
    Object.defineProperty(session, 'tabs', {
      configurable: true,
      get() {
        tabReads += 1;
        return tabReads <= 2 ? tabsCopy : [];
      },
    });
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'protoset',
        protosetBase64: 'abc',
      },
    };

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: expect.stringMatching(/Tab not found/i),
    }));
  });

  it('describeFromIngest fails when the tab disappears during network load', async () => {
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
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockImplementation(async () => {
      ctx.sessionRef.current = {
        ...ctx.sessionRef.current,
        tabs: ctx.sessionRef.current.tabs.filter((tab) => tab.id !== tabId),
      };
      throw new Error('Tab not found: ' + tabId);
    });

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(false);
  });

  it('describeFromIngest loads descriptors from valid url_proto drafts', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      protoIngest: {
        ...createDefaultProtoIngestState(),
        source: 'url_proto',
        url: 'https://example.com/demo.proto',
      },
    };
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockResolvedValue({
      descriptor: FIXTURE_DESCRIPTOR,
      source: 'url_proto',
    });

    const ok = await createDescribeFromIngestHandler(ctx)(tabId);

    expect(ok).toBe(true);
  });

  it('patchTabProtoIngest clears in-flight loads when ingest changes during loading', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loading',
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { url: 'https://example.com/demo.proto' });

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'idle',
      errorMessage: undefined,
    }));
  });

  it('reflectTab maps backend-server guidance when error text mentions backend server running', async () => {
    vi.mocked(descriptorFallback.loadDescriptorWithAutoFallback).mockRejectedValue(
      new Error('Ensure backend server running on port 3001'),
    );
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      errorMessage: expect.stringMatching(/Express gRPC proxy/i),
    }));
  });

  it('patchTabProtoIngest clears error state when ingest draft changes', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      loadState: 'error',
      errorMessage: 'previous failure',
      protoIngest: createDefaultProtoIngestState(),
    };

    createPatchTabProtoIngestHandler(ctx)(tabId, { url: 'https://example.com/demo.proto' });

    expect(ctx.patchTabDescriptor).toHaveBeenCalledWith(tabId, expect.objectContaining({
      loadState: 'idle',
      errorMessage: undefined,
    }));
  });

  it('reflectTab aborts active streams before loading', async () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabs[0] = {
      ...ctx.sessionRef.current.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };

    await createReflectTabHandler(ctx)(tabId);

    expect(ctx.updateTab).toHaveBeenCalledWith(tabId, expect.objectContaining({
      streamLifecycle: 'idle',
      activeStreamId: undefined,
    }));
  });
});
