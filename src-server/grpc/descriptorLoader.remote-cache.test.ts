/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { clearDescriptorCacheManager } from './descriptorCacheManager.js';
import { clearGrpcDescriptorStore } from './descriptorStore.js';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';

const fetchBsrDescriptorSetMock = vi.hoisted(() => vi.fn());
const fetchProtoFromUrlMock = vi.hoisted(() => vi.fn());

vi.mock('./bsrFetchGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bsrFetchGateway.js')>();
  return {
    ...actual,
    fetchBsrDescriptorSet: fetchBsrDescriptorSetMock,
  };
});

vi.mock('./protoFetchGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./protoFetchGateway.js')>();
  return {
    ...actual,
    fetchProtoFromUrl: fetchProtoFromUrlMock,
  };
});

import { DescriptorLoader } from './descriptorLoader.js';

describe('descriptorLoader remote source cache', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    fetchBsrDescriptorSetMock.mockReset();
    fetchProtoFromUrlMock.mockReset();
  });

  it('reuses BSR cache across module alias after first load', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    fetchBsrDescriptorSetMock.mockResolvedValue({
      protosetBase64,
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'main',
      digest: 'digest-1',
    });

    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'buf.build/acme/echo',
      bsrVersion: 'main',
    });
    const second = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });

    expect(fetchBsrDescriptorSetMock).toHaveBeenCalledTimes(2);
    expect(second.key).toBe(first.key);
    expect(second.sourceRef).toBe('buf.build/acme/echo@main');
  });

  it('does not reuse BSR cache across different versions', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    fetchBsrDescriptorSetMock.mockResolvedValue({
      protosetBase64,
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'main',
      digest: 'digest-1',
    });

    const loader = new DescriptorLoader();
    await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });
    fetchBsrDescriptorSetMock.mockResolvedValueOnce({
      protosetBase64,
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'v1.0.0',
      digest: 'digest-2',
    });
    await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'v1.0.0',
    });

    expect(fetchBsrDescriptorSetMock).toHaveBeenCalledTimes(2);
  });

  it('revalidates URL proto with If-None-Match and reuses descriptor on 304', async () => {
    fetchProtoFromUrlMock
      .mockResolvedValueOnce({
        content: FIXTURE_ECHO_PROTO,
        resolvedUrl: 'https://example.com/schemas/echo.proto',
        protoPath: 'echo.proto',
        etag: 'etag-1',
      })
      .mockResolvedValueOnce({
        content: '',
        resolvedUrl: 'https://example.com/schemas/echo.proto',
        protoPath: 'echo.proto',
        etag: 'etag-1',
        notModified: true,
      });

    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/schemas/echo.proto',
    });
    const second = await loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/schemas/echo.proto',
    });

    expect(fetchProtoFromUrlMock).toHaveBeenCalledTimes(2);
    expect(fetchProtoFromUrlMock.mock.calls[1]?.[1]).toEqual({ ifNoneMatch: 'etag-1' });
    expect(second.key).toBe(first.key);
    expect(second.sourceRef).toBe('https://example.com/schemas/echo.proto');
  });

  it('refetches BSR when digest changes', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    fetchBsrDescriptorSetMock
      .mockResolvedValueOnce({
        protosetBase64,
        module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
        version: 'main',
        digest: 'digest-1',
      })
      .mockResolvedValueOnce({
        protosetBase64,
        module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
        version: 'main',
        digest: 'digest-2',
      });

    const loader = new DescriptorLoader();
    await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });
    const second = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });

    expect(fetchBsrDescriptorSetMock).toHaveBeenCalledTimes(2);
    expect(second.sourceFingerprint?.bsrDigest).toBe('digest-2');
  });

  it('reuses BSR descriptor when digest is unchanged after re-fetch', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    fetchBsrDescriptorSetMock.mockResolvedValue({
      protosetBase64,
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'main',
      digest: 'digest-stable',
    });

    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });
    const second = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });

    expect(fetchBsrDescriptorSetMock).toHaveBeenCalledTimes(2);
    expect(second.key).toBe(first.key);
  });
});
