/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { collectMessageSchemas, findGrpcMethod, findGrpcService } from './descriptorUtils.js';

describe('descriptorUtils', () => {
  it('finds a service by full name', () => {
    const service = findGrpcService(FIXTURE_DESCRIPTOR, 'echo.EchoService');
    expect(service?.fullName).toBe('echo.EchoService');
  });

  it('returns undefined when a service is missing', () => {
    expect(findGrpcService(FIXTURE_DESCRIPTOR, 'missing.Service')).toBeUndefined();
  });

  it('finds a method by service and method name', () => {
    const method = findGrpcMethod(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'Echo');
    expect(method?.name).toBe('Echo');
    expect(method?.requestTypeName).toBe('echo.EchoRequest');
  });

  it('returns undefined when method or service is missing', () => {
    expect(findGrpcMethod(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'Missing')).toBeUndefined();
    expect(findGrpcMethod(FIXTURE_DESCRIPTOR, 'missing.Service', 'Echo')).toBeUndefined();
  });

  it('collects request and response schemas keyed by message type name', () => {
    const schemas = collectMessageSchemas(FIXTURE_DESCRIPTOR);
    expect(schemas.get('echo.EchoRequest')).toEqual(
      FIXTURE_DESCRIPTOR.services[0]?.methods[0]?.requestSchema,
    );
    expect(schemas.get('echo.EchoResponse')).toEqual(
      FIXTURE_DESCRIPTOR.services[0]?.methods[0]?.responseSchema,
    );
  });
});
