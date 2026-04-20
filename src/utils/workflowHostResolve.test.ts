import { describe, expect, it } from 'vitest';
import { resolveHttpNodeBaseUrl } from './workflowHostResolve';
import type { HttpNodeData } from '../types/workflow';

const minimalScenario = (): HttpNodeData['scenario'] => ({
  id: 's',
  name: 's',
  url: '/',
  method: 'GET',
  headers: [],
  body: '',
  auth: { type: 'none' },
  validation: { mode: 'none' },
});

describe('resolveHttpNodeBaseUrl', () => {
  const microservices = [
    { id: 'svc-a', name: 'A', baseUrls: { t01: 'https://a.example.com/', p01: 'https://a-prod.example.com' } },
  ];

  it('returns undefined when host fields missing', () => {
    const d: HttpNodeData = { label: 'x', scenario: minimalScenario() };
    expect(resolveHttpNodeBaseUrl(d, microservices)).toBeUndefined();
  });

  it('resolves when both ids set', () => {
    const d: HttpNodeData = {
      label: 'x',
      hostEnvironmentId: 't01',
      hostMicroserviceId: 'svc-a',
      scenario: minimalScenario(),
    };
    expect(resolveHttpNodeBaseUrl(d, microservices)).toBe('https://a.example.com');
  });

  it('prefers explicit hostBaseUrl over env + microservice', () => {
    const d: HttpNodeData = {
      label: 'x',
      hostBaseUrl: 'https://ons.example.com/',
      hostEnvironmentId: 't01',
      hostMicroserviceId: 'svc-a',
      scenario: minimalScenario(),
    };
    expect(resolveHttpNodeBaseUrl(d, microservices)).toBe('https://ons.example.com');
  });
});
