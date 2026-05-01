import { describe, it, expect } from 'vitest';
import { checkEnvReadiness, checkAllEnvReadiness } from './workflowEnvReadiness';
import type { WorkflowService } from '../types/workflow';

function makeService(id: string, name: string, endpoints: WorkflowService['endpoints'] = []): WorkflowService {
  return { id, name, endpoints };
}

describe('checkEnvReadiness', () => {
  it('returns ready when no services have endpoints', () => {
    const result = checkEnvReadiness('t01', [makeService('s1', 'Svc')]);
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.envId).toBe('t01');
  });

  it('returns ready when all services have enabled endpoints for the env', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: 't01', url: 'https://test.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports issue when service endpoint is missing for the env', () => {
    const svc = makeService('s1', 'Svc A', [
      { envId: 'p01', url: 'https://prod.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].serviceName).toBe('Svc A');
    expect(result.issues[0].serviceId).toBe('s1');
    expect(result.issues[0].missingUrl).toBe(true);
  });

  it('reports issue when endpoint exists but is disabled', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: 't01', url: 'https://test.com', enabled: false, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(1);
  });

  it('reports issue when endpoint URL is empty', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: 't01', url: '  ', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(false);
  });

  it('handles multiple services with mixed readiness', () => {
    const ready = makeService('s1', 'Ready', [
      { envId: 't01', url: 'https://ok.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const missing = makeService('s2', 'Missing', [
      { envId: 'p01', url: 'https://prod.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [ready, missing]);
    expect(result.ready).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].serviceName).toBe('Missing');
  });

  it('returns ready for empty services list', () => {
    const result = checkEnvReadiness('t01', []);
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns ready when service uses __all__ pseudo-env (same URL for all)', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: '__all__', url: 'https://api.example.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('prefers exact env match over __all__ fallback', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: '__all__', url: 'https://fallback.com', enabled: true, authMode: 'inherit', source: 'manual' },
      { envId: 't01', url: '', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    // Exact match found but URL is empty → should report missing (not fall back to __all__)
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(false);
  });

  it('falls back to __all__ when no exact env endpoint exists', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: '__all__', url: 'https://api.com', enabled: true, authMode: 'inherit', source: 'manual' },
      { envId: 'p01', url: 'https://prod.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    // t01 not in endpoints, but __all__ is → should be ready
    const result = checkEnvReadiness('t01', [svc]);
    expect(result.ready).toBe(true);
  });
});

describe('checkAllEnvReadiness', () => {
  it('returns a map of readiness for all envs', () => {
    const svc = makeService('s1', 'Svc', [
      { envId: 't01', url: 'https://test.com', enabled: true, authMode: 'inherit', source: 'manual' },
    ]);
    const result = checkAllEnvReadiness(['t01', 'p01'], [svc]);
    expect(result.size).toBe(2);
    expect(result.get('t01')!.ready).toBe(true);
    expect(result.get('p01')!.ready).toBe(false);
  });

  it('returns empty map for no envs', () => {
    const result = checkAllEnvReadiness([], [makeService('s1', 'Svc')]);
    expect(result.size).toBe(0);
  });
});
