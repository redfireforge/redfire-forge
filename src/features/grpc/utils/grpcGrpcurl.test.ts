import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { buildGrpcurlInvokeCommand, formatGrpcMethodSignature } from './grpcGrpcurl';

describe('grpcGrpcurl', () => {
  it('formats unary method signature', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
    expect(formatGrpcMethodSignature('echo.EchoService', method)).toBe(
      'rpc Echo(echo.EchoRequest) returns (echo.EchoResponse);',
    );
  });

  it('formats server streaming signature', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'ServerStream')!;
    expect(formatGrpcMethodSignature('echo.EchoService', method)).toBe(
      'rpc ServerStream(echo.StreamRequest) returns (stream echo.EchoResponse);',
    );
  });

  it('formats client streaming signature', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'ClientStream')!;
    expect(formatGrpcMethodSignature('echo.EchoService', method)).toBe(
      'rpc ClientStream(stream echo.EchoRequest) returns (echo.EchoResponse);',
    );
  });

  it('formats bidi streaming signature', () => {
    const method = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'BidiStream')!;
    expect(formatGrpcMethodSignature('echo.EchoService', method)).toBe(
      'rpc BidiStream(stream echo.EchoRequest) returns (stream echo.EchoResponse);',
    );
  });

  it('builds grpcurl invoke command for plaintext target', () => {
    expect(buildGrpcurlInvokeCommand({
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'disabled',
    })).toBe('grpcurl -plaintext localhost:50051 echo.EchoService/Echo');
  });

  it('omits -plaintext when TLS is enabled', () => {
    expect(buildGrpcurlInvokeCommand({
      targetAddress: 'localhost:50051',
      serviceFullName: 'echo.EchoService',
      methodName: 'Echo',
      tlsMode: 'tls',
    })).toBe('grpcurl localhost:50051 echo.EchoService/Echo');
  });
});
