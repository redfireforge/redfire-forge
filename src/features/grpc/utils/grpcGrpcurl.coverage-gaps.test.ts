import { describe, expect, it } from 'vitest';
import {
  buildGrpcurlInvokeCommand,
  filterMetadataForGrpcurlExport,
  formatGrpcMethodSignature,
  formatGrpcStreamKeyword,
  grpcGrpcurlImportToTabPatch,
  parseGrpcurlCommand,
  tokenizeGrpcurlCommand,
} from './grpcGrpcurl';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';

describe('grpcGrpcurl coverage gaps', () => {
  it('formatGrpcStreamKeyword covers server, client, and bidi streaming', () => {
    expect(formatGrpcStreamKeyword('server_streaming', 'response')).toBe('stream ');
    expect(formatGrpcStreamKeyword('client_streaming', 'request')).toBe('stream ');
    expect(formatGrpcStreamKeyword('bidi_streaming', 'request')).toBe('stream ');
    expect(formatGrpcStreamKeyword('unary', 'request')).toBe('');
  });

  it('formatGrpcMethodSignature renders stream keywords in rpc signature', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;;
    expect(formatGrpcMethodSignature('echo.EchoService', method)).toMatch(/^rpc Echo\(/);
  });

  it('filterMetadataForGrpcurlExport strips secret keys and bearer values', () => {
    expect(filterMetadataForGrpcurlExport({
      authorization: 'Bearer abcdefghijklmnop',
      'x-trace': '1',
    })).toEqual({ 'x-trace': '1' });
  });

  it('filterMetadataForGrpcurlExport can include real secret metadata but never redacted placeholders', () => {
    expect(filterMetadataForGrpcurlExport({
      'x-api-key': 'live-secret',
      'x-trace': '1',
    }, {
      includeSecretMetadata: true,
    })).toEqual({
      'x-api-key': 'live-secret',
      'x-trace': '1',
    });

    expect(filterMetadataForGrpcurlExport({
      'x-api-key': '[REDACTED]',
      'x-trace': '1',
    }, {
      includeSecretMetadata: true,
    })).toEqual({ 'x-trace': '1' });

    expect(filterMetadataForGrpcurlExport({
      'x-api-key': '[REDACTED]',
      'x-env-token': '[REDACTED]',
      'x-trace': '1',
    }, {
      includeRedactedSecretMetadataHints: true,
    })).toEqual({
      'x-api-key': '<SET_X_API_KEY>',
      'x-env-token': '<SET_X_ENV_TOKEN>',
      'x-trace': '1',
    });
  });

  it('buildGrpcurlInvokeCommand includes plaintext, authority, headers, and body', () => {
    const command = buildGrpcurlInvokeCommand({
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'disabled',
      serverNameOverride: 'grpc.local',
      metadata: { 'x-trace': '1' },
      body: { message: 'hi' },
    });
    expect(command).toContain('-plaintext');
    expect(command).toContain('-authority grpc.local');
    expect(command).toContain('-H');
    expect(command).toContain('-d');
    expect(command).toContain('echo.EchoService/Echo');
  });

  it('tokenizeGrpcurlCommand respects single-quoted segments', () => {
    expect(tokenizeGrpcurlCommand(`grpcurl -d '{"message":"hi"}' localhost:50051 svc/Method`))
      .toEqual(['grpcurl', '-d', '{"message":"hi"}', 'localhost:50051', 'svc/Method']);
  });

  it('parseGrpcurlCommand imports plaintext invoke commands', () => {
    const parsed = parseGrpcurlCommand(
      'grpcurl -plaintext -H "x-trace: 1" -d \'{"message":"hi"}\' localhost:50051 echo.EchoService/Echo',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.tlsMode).toBe('disabled');
      expect(parsed.metadata['x-trace']).toBe('1');
      expect(parsed.body).toEqual({ message: 'hi' });
      expect(grpcGrpcurlImportToTabPatch(parsed)).toEqual(expect.objectContaining({
        target: 'localhost:50051',
        service: 'echo.EchoService',
        method: 'Echo',
      }));
    }
  });

  it('parseGrpcurlCommand reports missing service/method and target tokens', () => {
    expect(parseGrpcurlCommand('grpcurl -plaintext').ok).toBe(false);
    expect(parseGrpcurlCommand('grpcurl echo.EchoService/Echo').ok).toBe(false);
  });

  it('parseGrpcurlCommand imports descriptor flags with guidance warnings', () => {
    const parsed = parseGrpcurlCommand(
      'grpcurl -proto echo.proto localhost:50051 echo.EchoService/Echo',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.descriptorFlags?.protoPaths).toEqual(['echo.proto']);
      expect(parsed.warnings.join(' ')).toMatch(/Descriptor flags/i);
    }
  });
});
