/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIBE_REQUEST,
  FIXTURE_DESCRIPTOR,
  FIXTURE_ECHO_PROTO,
  FIXTURE_REFLECT_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import * as bsrFetchGateway from './bsrFetchGateway.js';
import * as protoFetchGateway from './protoFetchGateway.js';
import { clearDescriptorCacheManager } from './descriptorCacheManager.js';
import { clearGrpcDescriptorStore, getGrpcDescriptor } from './descriptorStore.js';
import {
  DescriptorLoader,
  DescriptorLoaderError,
} from './descriptorLoader.js';
import * as protoDescriptorParser from './protoDescriptorParser.js';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';
import * as descriptorCacheManager from './descriptorCacheManager.js';
import { ProtoImportResolutionError } from './protoImportResolver.js';
import { ReflectionFetchError } from './reflectionClient.js';
import { grpcMockServerPool } from './grpcMockServerPool.js';

describe('descriptorLoader coverage gaps', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    vi.restoreAllMocks();
  });

  it('rethrows DescriptorLoaderError from reflection without wrapping', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new DescriptorLoaderError('already wrapped', 'invalid_target');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'invalid_target' });
  });

  it('maps TLS failures to unreachable with transport details', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('self signed certificate in certificate chain');
      }),
    });
    await expect(loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      // Use TLS fixture port — :50051 is coerced to plaintext by prepareGrpcTarget.
      target: { address: 'localhost:50443', tlsMode: 'tls' },
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(DescriptorLoaderError);
      const err = error as DescriptorLoaderError;
      expect(err.code).toBe('unreachable');
      expect(err.transportDetails?.tlsFailure).toBe('unknown_ca');
      return true;
    });
  });

  it('maps ReflectionFetchError to reflection_failed', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new ReflectionFetchError('both versions failed', {
          fallbackAttempted: true,
          v1Error: 'v1',
          v1alphaError: 'v1alpha',
        });
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'reflection_failed' });
  });

  it('maps no matching services errors to reflection_failed', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('No matching services found via reflection (requested: missing.Service)');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'reflection_failed' });
  });

  it('maps generic reflection unavailable errors', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('UNIMPLEMENTED: reflection not enabled');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'reflection_failed' });
  });

  it('maps unreachable ECONNREFUSED errors with optional transport details', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:50051');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'unreachable' });
  });

  it('returns cached url_proto descriptor on HTTP 304 not modified', async () => {
    vi.spyOn(protoFetchGateway, 'fetchProtoFromUrl')
      .mockResolvedValueOnce({
        content: FIXTURE_ECHO_PROTO,
        resolvedUrl: 'https://example.com/echo.proto',
        protoPath: 'echo.proto',
        etag: 'etag-304',
      })
      .mockResolvedValueOnce({
        content: '',
        resolvedUrl: 'https://example.com/echo.proto',
        protoPath: 'echo.proto',
        notModified: true,
        etag: 'etag-304',
      });

    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    });
    const second = await loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    });
    expect(second.key).toBe(first.key);
  });

  it('reuses bsr cache when digest matches fetched descriptor', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    vi.spyOn(bsrFetchGateway, 'fetchBsrDescriptorSet').mockResolvedValue({
      protosetBase64: encodeRootAsProtosetBase64(root),
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
    expect(second.key).toBe(first.key);
  });

  it('maps ProtoFetchGatewayError to describe_failed', async () => {
    vi.spyOn(protoFetchGateway, 'fetchProtoFromUrl').mockRejectedValue(
      new protoFetchGateway.ProtoFetchGatewayError('fetch failed'),
    );
    const loader = new DescriptorLoader();
    await expect(loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    })).rejects.toMatchObject({ code: 'describe_failed' });
  });

  it('returns cached proto_files describe without reloading source', async () => {
    const loader = new DescriptorLoader();
    const first = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    clearGrpcDescriptorStore();
    const second = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    expect(second.key).toBe(first.key);
    expect(getGrpcDescriptor(first.key)).toEqual(second);
  });

  it('maps non-Error describe failures to describe_failed', async () => {
    vi.spyOn(protoFetchGateway, 'fetchProtoFromUrl').mockRejectedValue('plain failure');
    const loader = new DescriptorLoader();
    await expect(loader.loadFromDescribe({
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    })).rejects.toMatchObject({ code: 'describe_failed' });
  });

  it('rethrows DescriptorLoaderError from describe pipeline', async () => {
    vi.spyOn(protoDescriptorParser, 'parseDescribeRequestSource')
      .mockImplementation(() => {
        throw new DescriptorLoaderError('already wrapped', 'invalid_descriptor');
      });
    const loader = new DescriptorLoader();
    await expect(loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST))
      .rejects.toMatchObject({ code: 'invalid_descriptor' });
  });

  it('maps ProtoImportResolutionError to import_resolution_failed', async () => {
    vi.spyOn(protoDescriptorParser, 'parseDescribeRequestSource')
      .mockImplementation(() => {
        throw new ProtoImportResolutionError('missing import', {
          unresolvedImport: 'missing.proto',
          fromFile: 'main.proto',
          searchedPaths: [],
        });
      });
    const loader = new DescriptorLoader();
    await expect(loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST))
      .rejects.toMatchObject({ code: 'import_resolution_failed' });
  });

  it('continues loading when describe cache lookup is unavailable', async () => {
    vi.spyOn(descriptorCacheManager, 'buildDescribeCacheLookup').mockReturnValue(null);
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    expect(descriptor.services.length).toBeGreaterThan(0);
  });

  it('rejects in-process reflection targets as unreachable', async () => {
    const loader = new DescriptorLoader();
    await expect(loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      target: { address: 'in-process:my-server', tlsMode: 'disabled' },
    })).rejects.toMatchObject({ code: 'unreachable' });
  });

  it('returns mock pool descriptor without calling reflection when listen target matches', async () => {
    const fetchReflectionRoot = vi.fn();
    vi.spyOn(grpcMockServerPool, 'resolveDescriptorForListenTarget').mockReturnValue(FIXTURE_DESCRIPTOR);

    const loader = new DescriptorLoader({ fetchReflectionRoot });
    const descriptor = await loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(descriptor.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(fetchReflectionRoot).not.toHaveBeenCalled();
    expect(getGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toEqual(FIXTURE_DESCRIPTOR);
  });

  it('builds reflection descriptor keys for reflection finalize path', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => ({
        root,
        reflectionVersion: 'v1alpha',
        serviceNames: ['echo.EchoService'],
      })),
    });
    const descriptor = await loader.loadFromReflection(FIXTURE_REFLECT_REQUEST);
    expect(descriptor.key).toMatch(/^reflection:/);
    expect(descriptor.reflectionVersion).toBe('v1alpha');
  });

  it('maps unreachable errors without transport detail objects', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(DescriptorLoaderError);
        expect((error as DescriptorLoaderError).transportDetails).toBeUndefined();
        return true;
      });
  });

  it('wraps non-Error reflection failures with generic reflection_failed code', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw 'plain reflection failure';
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toMatchObject({ code: 'reflection_failed' });
  });

  it('uses generic reflection failure message when reflection is available but fetch fails', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('unexpected parser failure');
      }),
    });
    await expect(loader.loadFromReflection(FIXTURE_REFLECT_REQUEST))
      .rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(DescriptorLoaderError);
        expect((error as DescriptorLoaderError).message).toMatch(/Server reflection failed/i);
        return true;
      });
  });

  it('loads url_proto describe with empty url string', async () => {
    vi.spyOn(protoFetchGateway, 'fetchProtoFromUrl').mockResolvedValue({
      content: FIXTURE_ECHO_PROTO,
      resolvedUrl: 'https://example.com/echo.proto',
      protoPath: 'echo.proto',
    });
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      source: 'url_proto',
      url: '   ',
    });
    expect(descriptor.source).toBe('url_proto');
  });

  it('loads bsr describe when cache lookup is unavailable', async () => {
    vi.spyOn(descriptorCacheManager, 'buildDescribeCacheLookup').mockReturnValue(null);
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    vi.spyOn(bsrFetchGateway, 'fetchBsrDescriptorSet').mockResolvedValue({
      protosetBase64: encodeRootAsProtosetBase64(root),
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'main',
      digest: 'digest-no-cache',
    });

    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      source: 'bsr',
      bsrModule: '  acme/echo  ',
    });
    expect(descriptor.source).toBe('bsr');
    expect(descriptor.sourceRef).toContain('buf.build/acme/echo');
  });

  it('uses protoset short hash sourceRef for protoset describe requests', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      source: 'protoset',
      protosetBase64,
    });
    expect(descriptor.source).toBe('protoset');
    expect(descriptor.sourceFingerprint?.sourceRef).toBeTruthy();
  });

  it('maps unreachable errors with populated transport details', async () => {
    const loader = new DescriptorLoader({
      fetchReflectionRoot: vi.fn(async () => {
        throw new Error('certificate has expired');
      }),
    });
    await expect(loader.loadFromReflection({
      ...FIXTURE_REFLECT_REQUEST,
      target: { address: 'localhost:50443', tlsMode: 'tls' },
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(DescriptorLoaderError);
      const err = error as DescriptorLoaderError;
      expect(err.code).toBe('unreachable');
      expect(err.transportDetails).toBeDefined();
      return true;
    });
  });

  it('loads url_proto describe when url is omitted', async () => {
    vi.spyOn(protoFetchGateway, 'fetchProtoFromUrl').mockResolvedValue({
      content: FIXTURE_ECHO_PROTO,
      resolvedUrl: 'https://example.com/echo.proto',
      protoPath: 'echo.proto',
    });
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({ source: 'url_proto' });
    expect(descriptor.source).toBe('url_proto');
  });

  it('loads bsr describe when bsrModule is omitted', async () => {
    vi.spyOn(descriptorCacheManager, 'buildDescribeCacheLookup').mockReturnValue(null);
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    vi.spyOn(bsrFetchGateway, 'fetchBsrDescriptorSet').mockResolvedValue({
      protosetBase64: encodeRootAsProtosetBase64(root),
      module: { owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' },
      version: 'main',
      digest: 'digest-no-module',
    });
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      source: 'bsr',
      bsrVersion: 'main',
    });
    expect(descriptor.source).toBe('bsr');
  });

  it('builds proto_files sourceRef for proto_files describe requests', async () => {
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe({
      ...FIXTURE_DESCRIBE_REQUEST,
      source: 'proto_files',
    });
    expect(descriptor.source).toBe('proto_files');
    expect(descriptor.sourceFingerprint?.sourceRef).toBeTruthy();
  });
});
