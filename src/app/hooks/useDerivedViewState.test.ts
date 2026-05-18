/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { renderHook } from '@testing-library/react';
import type {
  AuthConfig,
  Environment,
  Microservice,
  FeatureGroup,
  GlobalAuthProfile,
} from '../../shared/types';
import { useDerivedViewState } from './useDerivedViewState';

/** Minimal Scenario list type not needed beyond empty array */
const emptyScenarios = [] as FeatureGroup['scenarios'];

function fg(partial: Partial<FeatureGroup> & { id: string; name?: string }): FeatureGroup {
  return {
    name: partial.name ?? partial.id,
    scenarios: partial.scenarios ?? emptyScenarios,
    ...partial,
  };
}

describe('useDerivedViewState', () => {
  const environments: Environment[] = [
    { id: 'env-a', name: 'Dev' },
    { id: 'env-b', name: 'Stage' },
  ];

  const authFromEnvB: AuthConfig = { type: 'bearer', token: 't-b', prefix: 'Bearer' };

  const microservices: Microservice[] = [
    {
      id: 'svc-1',
      name: 'API',
      baseUrls: {
        'env-a': 'https://dev.example',
        'env-b': 'https://stage.example',
      },
      authProfileIds: {
        'env-b': 'global-auth-1',
      },
    },
  ];

  const globalAuthProfiles: GlobalAuthProfile[] = [
    {
      id: 'global-auth-1',
      name: 'Stage token',
      auth: authFromEnvB,
    },
  ];

  const featureGroups: FeatureGroup[] = [
    fg({ id: 'fg-match', microserviceId: 'svc-1', environmentId: 'env-a' }),
    fg({ id: 'fg-svc-only', microserviceId: 'svc-1' }),
    fg({ id: 'fg-wrong-env', microserviceId: 'svc-1', environmentId: 'env-x' }),
    fg({ id: 'fg-other-svc', microserviceId: 'svc-999', environmentId: 'env-a' }),
    fg({ id: 'fg-unassoc', microserviceId: undefined, environmentId: undefined }),
    fg({ id: 'fg-orphan-svc', microserviceId: 'deleted-svc', environmentId: 'env-a' }),
    fg({ id: 'fg-orphan-env', microserviceId: 'svc-1', environmentId: 'deleted-env' }),
  ];

  it('computes resolvedBaseUrl from env + svc baseUrls map', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups: [],
        globalAuthProfiles: [],
        selectedEnvId: 'env-a',
        selectedSvcId: 'svc-1',
      }),
    );
    expect(result.current.resolvedBaseUrl).toBe('https://dev.example');
  });

  it('resolvedBaseUrl is empty when env or svc missing from selection', () => {
    const { result: unknownEnv } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups: [],
        globalAuthProfiles: [],
        selectedEnvId: 'no-such-env',
        selectedSvcId: 'svc-1',
      }),
    );
    expect(unknownEnv.current.resolvedBaseUrl).toBe('');

    const { result: unknownSvc } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups: [],
        globalAuthProfiles: [],
        selectedEnvId: 'env-a',
        selectedSvcId: 'no-svc',
      }),
    );
    expect(unknownSvc.current.resolvedBaseUrl).toBe('');
  });

  it('filters feature groups by microserviceId and environmentId when both selected', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: 'env-a',
        selectedSvcId: 'svc-1',
      }),
    );

    expect(result.current.filteredFeatureGroups.map((x) => x.id)).toEqual(['fg-match']);
  });

  it('filters feature groups by microserviceId only when environment id empty string is falsy in filter branch', () => {
    /** When env id is empty string, first branch (!(selectedSvcId && selectedEnvId)) skips env filter */
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: '',
        selectedSvcId: 'svc-1',
      }),
    );

    const ids = result.current.filteredFeatureGroups.map((x) => x.id).sort();
    expect(ids).toContain('fg-match');
    expect(ids).toContain('fg-svc-only');
    expect(ids).toContain('fg-wrong-env');
    expect(ids).not.toContain('fg-other-svc');
  });

  it('filteredFeatureGroups is empty array when svc not selected', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: 'env-a',
        selectedSvcId: '',
      }),
    );
    expect(result.current.filteredFeatureGroups).toEqual([]);
  });

  it('derivates envFallbackAuth from svc authProfileIds × global profiles', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles,
        selectedEnvId: 'env-b',
        selectedSvcId: 'svc-1',
      }),
    );
    expect(result.current.envFallbackAuth).toEqual(authFromEnvB);

    const { result: envA } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles,
        selectedEnvId: 'env-a',
        selectedSvcId: 'svc-1',
      }),
    );
    expect(envA.current.envFallbackAuth).toBeUndefined();

    const { result: badProfileId } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: 'env-b',
        selectedSvcId: 'svc-1',
      }),
    );

    /** Mapping points at global-auth-1 but list is empty */
    expect(badProfileId.current.envFallbackAuth).toBeUndefined();
  });

  /** Re-declare hook with overridden globals for orphan profile case */
  it('returns undefined envFallbackAuth when profile id resolves to missing global', () => {
    const ms: Microservice[] = [
      { id: 's', name: 'S', baseUrls: {}, authProfileIds: { e1: 'missing' } },
    ];
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments: [{ id: 'e1', name: 'E' }],
        microservices: ms,
        featureGroups: [],
        globalAuthProfiles: [{ id: 'other', name: 'O', auth: { type: 'none' } }],
        selectedEnvId: 'e1',
        selectedSvcId: 's',
      }),
    );
    expect(result.current.envFallbackAuth).toBeUndefined();
  });

  it('unassociatedFeatureGroups includes needs-env-assignment for selected svc without environmentId', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: 'env-a',
        selectedSvcId: 'svc-1',
      }),
    );

    expect(result.current.unassociatedFeatureGroups.map((x) => x.id)).toContain('fg-svc-only');
    expect(result.current.unassociatedFeatureGroups.map((x) => x.id)).toContain('fg-unassoc');

    /** Orphans not already in lists */
    expect(result.current.unassociatedFeatureGroups.map((x) => x.id)).toContain('fg-orphan-svc');
    expect(result.current.unassociatedFeatureGroups.map((x) => x.id)).toContain('fg-orphan-env');
    /** Deduped: fg-match should not appear as orphan duplicate */
    expect(result.current.unassociatedFeatureGroups.some((x) => x.id === 'fg-match')).toBe(false);
  });

  it('needsEnvAssignment slice is empty when no svc selected', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles: [],
        selectedEnvId: '',
        selectedSvcId: '',
      }),
    );

    const ids = result.current.unassociatedFeatureGroups.map((x) => x.id);
    expect(ids).toContain('fg-unassoc');
    expect(ids).not.toContain('fg-svc-only');
    expect(ids).toContain('fg-orphan-svc');
  });

  it('exposes selectedEnv and selectedSvc references', () => {
    const { result } = renderHook(() =>
      useDerivedViewState({
        environments,
        microservices,
        featureGroups,
        globalAuthProfiles,
        selectedEnvId: 'env-a',
        selectedSvcId: 'svc-1',
      }),
    );
    expect(result.current.selectedEnv?.id).toBe('env-a');
    expect(result.current.selectedSvc?.id).toBe('svc-1');
  });

  it('detects microservice-scoped custom environments as add-on tenants', () => {
    const ms: Microservice[] = [{
      id: 'edge-svc',
      name: 'Edge API',
      baseUrls: { 'cust-edge': 'https://edge.example/api' },
      customEnvs: [{ id: 'cust-edge', name: 'Custom Edge' }],
    }];
    const envs: Environment[] = [{ id: 'tenant-a', name: 'Dev', baseUrls: {}, customEnvs: [] }];

    const { result } = renderHook(() =>
      useDerivedViewState({
        environments: envs,
        microservices: ms,
        featureGroups: [],
        globalAuthProfiles: [],
        selectedEnvId: 'cust-edge',
        selectedSvcId: 'edge-svc',
      }),
    );

    expect(result.current.isAdditionalEnv).toBe(true);
    expect(result.current.selectedEnv?.name).toBe('Custom Edge');
    expect(result.current.resolvedBaseUrl).toBe('https://edge.example/api');

    const core = renderHook(() =>
      useDerivedViewState({
        environments: envs,
        microservices: ms,
        featureGroups: [],
        globalAuthProfiles: [],
        selectedEnvId: 'tenant-a',
        selectedSvcId: 'edge-svc',
      }),
    );
    expect(core.result.current.isAdditionalEnv).toBe(false);
  });
});
