/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Environment, Microservice } from '@shared/types';
import { useHarnessEnvironmentCascade } from './useHarnessEnvironmentCascade';

function svc(overrides: Partial<Microservice> = {}): Microservice {
  return {
    id: 's1', name: 'Svc', baseUrls: {}, customEnvs: [], ...overrides,
  } as Microservice;
}

const envs: Environment[] = [{ id: 'dev', name: 'Dev' }, { id: 'qa', name: 'QA' }];

describe('useHarnessEnvironmentCascade', () => {
  it('returns base environments as options', () => {
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, [], ''));
    expect(result.current.envOptions).toEqual([
      { id: 'dev', name: 'Dev' },
      { id: 'qa', name: 'QA' },
    ]);
  });

  it('appends custom envs from microservices, labelled with the service name', () => {
    const services = [svc({ id: 's1', name: 'Orders', customEnvs: [{ id: 'staging', name: 'Staging' }] })];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, ''));
    expect(result.current.envOptions).toContainEqual({ id: 'staging', name: 'Staging (Orders)' });
  });

  it('does not duplicate a custom env that already exists as a base env', () => {
    const services = [svc({ customEnvs: [{ id: 'dev', name: 'Dev' }] })];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, ''));
    expect(result.current.envOptions.filter((o) => o.id === 'dev')).toHaveLength(1);
  });

  it('returns all microservices when no env is selected', () => {
    const services = [svc({ id: 'a' }), svc({ id: 'b' })];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, ''));
    expect(result.current.filteredMicroservices).toHaveLength(2);
  });

  it('filters microservices by base url env', () => {
    const services = [
      svc({ id: 'a', baseUrls: { dev: 'http://dev' } }),
      svc({ id: 'b', baseUrls: { qa: 'http://qa' } }),
    ];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, 'dev'));
    expect(result.current.filteredMicroservices.map((s) => s.id)).toEqual(['a']);
  });

  it('filters microservices by custom env id', () => {
    const services = [
      svc({ id: 'a', customEnvs: [{ id: 'staging', name: 'Staging' }] }),
      svc({ id: 'b' }),
    ];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, 'staging'));
    expect(result.current.filteredMicroservices.map((s) => s.id)).toEqual(['a']);
  });

  it('handles microservice with undefined customEnvs (??[] fallback in envOptions build)', () => {
    const services = [{ id: 's-no-envs', name: 'NoEnvs', baseUrls: {} } as unknown as Microservice];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, ''));
    // Should not throw; envOptions is just the base envs
    expect(result.current.envOptions).toEqual([
      { id: 'dev', name: 'Dev' },
      { id: 'qa', name: 'QA' },
    ]);
  });

  it('handles microservice with undefined customEnvs in filter (??[] fallback)', () => {
    const services = [
      { id: 's-no-envs', name: 'NoEnvs', baseUrls: { dev: 'http://dev' } } as unknown as Microservice,
    ];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, 'dev'));
    expect(result.current.filteredMicroservices).toHaveLength(1);
  });

  it('excludes microservice when selected env matches neither baseUrls nor customEnvs', () => {
    const services = [
      svc({ id: 'a', baseUrls: { qa: 'http://qa' }, customEnvs: [{ id: 'staging', name: 'Staging' }] }),
    ];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, 'prod'));
    expect(result.current.filteredMicroservices).toHaveLength(0);
  });

  it('uses (customEnvs ?? []) fallback in filter when customEnvs is undefined and baseUrls miss', () => {
    const services = [
      { id: 's-no-envs', name: 'NoEnvs', baseUrls: { qa: 'http://qa' } } as unknown as Microservice,
    ];
    const { result } = renderHook(() => useHarnessEnvironmentCascade(envs, services, 'prod'));
    expect(result.current.filteredMicroservices).toHaveLength(0);
  });
});
