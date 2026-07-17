/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import { buildBsrDescriptorUrl, fetchBsrDescriptorSet, parseBsrModuleReference } from './bsrFetchGateway.js';

describe('bsrFetchGateway', () => {
  it('parses buf.build module references', () => {
    expect(parseBsrModuleReference('buf.build/acme/echo')).toEqual({
      owner: 'acme',
      repo: 'echo',
      fullName: 'buf.build/acme/echo',
    });
  });

  it('builds descriptor URL with encoded ref', () => {
    const url = buildBsrDescriptorUrl({ owner: 'acme', repo: 'echo', fullName: 'buf.build/acme/echo' }, 'main');
    expect(url).toContain('/acme/echo/descriptor/main');
  });

  it('fetches binary protoset responses', async () => {
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);
    const bytes = Buffer.from(protosetBase64, 'base64');

    const fetchPort = {
      fetch: vi.fn(async () => new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream', etag: '"digest-1"' },
      })),
    };

    const result = await fetchBsrDescriptorSet({
      module: 'acme/echo',
      version: 'main',
    }, { fetchPort });

    expect(result.module.fullName).toBe('buf.build/acme/echo');
    expect(result.protosetBase64).toBe(protosetBase64);
    expect(result.digest).toBe('digest-1');
  });
});
