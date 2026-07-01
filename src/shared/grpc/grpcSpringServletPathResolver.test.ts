/**
 * Phase 10D — Spring Servlet path resolver unit tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_TARGET } from './contractFixtures';
import {
  buildSpringServletMethodPath,
  buildSpringServletMethodUrl,
  buildSpringServletMethodUrls,
  normalizeSpringServletMethodSegment,
  normalizeSpringServletServiceSegment,
  resolveSpringServletPathCandidates,
  SpringServletPathResolutionError,
} from './grpcSpringServletPathResolver';

describe('grpcSpringServletPathResolver (Phase 10D)', () => {
  it('builds package-qualified path for official Spring servlet routing', () => {
    expect(buildSpringServletMethodPath('echo.EchoService', 'Echo'))
      .toBe('/echo.EchoService/Echo');
    expect(buildSpringServletMethodUrl(FIXTURE_TARGET, 'echo.EchoService', 'Echo'))
      .toBe('http://localhost:50051/echo.EchoService/Echo');
  });

  it('normalizes leading slash and dot on service names', () => {
    expect(buildSpringServletMethodPath('/echo.EchoService', 'Echo'))
      .toBe('/echo.EchoService/Echo');
    expect(buildSpringServletMethodPath('.echo.EchoService', 'Echo'))
      .toBe('/echo.EchoService/Echo');
  });

  it('supports unqualified short service names (net.devh / legacy configs)', () => {
    expect(buildSpringServletMethodPath('EchoService', 'Echo'))
      .toBe('/EchoService/Echo');
  });

  it('exposes short-name fallback candidate for package-qualified services', () => {
    expect(resolveSpringServletPathCandidates('echo.EchoService', 'Echo')).toEqual([
      '/echo.EchoService/Echo',
      '/EchoService/Echo',
    ]);
    expect(resolveSpringServletPathCandidates('EchoService', 'Echo')).toEqual([
      '/EchoService/Echo',
    ]);
  });

  it('rejects empty or path-traversal service/method segments', () => {
    expect(() => normalizeSpringServletServiceSegment('')).toThrow(SpringServletPathResolutionError);
    expect(() => normalizeSpringServletServiceSegment('../evil')).toThrow(SpringServletPathResolutionError);
    expect(() => normalizeSpringServletMethodSegment('')).toThrow(SpringServletPathResolutionError);
    expect(() => buildSpringServletMethodPath('echo.EchoService', '../Echo')).toThrow(SpringServletPathResolutionError);
  });

  it('builds Java-style package-qualified paths for Spring Boot servlet apps', () => {
    expect(buildSpringServletMethodPath(
      'org.springframework.samples.petclinic.customers.grpc.CustomersService',
      'findAll',
    )).toBe('/org.springframework.samples.petclinic.customers.grpc.CustomersService/findAll');
  });

  it('buildSpringServletMethodUrls mirrors resolveSpringServletPathCandidates order', () => {
    expect(buildSpringServletMethodUrls(FIXTURE_TARGET, 'echo.EchoService', 'Echo')).toEqual([
      'http://localhost:50051/echo.EchoService/Echo',
      'http://localhost:50051/EchoService/Echo',
    ]);
  });

  it('uses https scheme when tls is enabled', () => {
    expect(buildSpringServletMethodUrl(
      { address: 'localhost:9090', tlsMode: 'tls' },
      'echo.EchoService',
      'Echo',
    )).toBe('https://localhost:9090/echo.EchoService/Echo');
  });
});
