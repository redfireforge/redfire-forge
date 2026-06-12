/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Environment, Microservice, FeatureGroup, GlobalAuthProfile } from '../../shared/types';
import { usePreferencesImport } from './usePreferencesImport';

function setup() {
  const setEnvironments = vi.fn();
  const setMicroservices = vi.fn();
  const setFeatureGroups = vi.fn();
  const setAppGlobalAuthProfiles = vi.fn();
  const setActiveTab = vi.fn();
  const hook = renderHook(() =>
    usePreferencesImport({
      setEnvironments,
      setMicroservices,
      setFeatureGroups,
      setAppGlobalAuthProfiles,
      setActiveTab,
    }),
  );
  return { hook, setEnvironments, setMicroservices, setFeatureGroups, setAppGlobalAuthProfiles, setActiveTab };
}

describe('usePreferencesImport', () => {
  it('merges environments, microservices and auth profiles by id', async () => {
    const { hook, setEnvironments, setMicroservices, setAppGlobalAuthProfiles, setActiveTab } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({
        environments: [{ id: 'e1' } as Environment],
        microservices: [{ id: 'm1' } as Microservice],
        globalAuthProfiles: [{ id: 'g1' } as GlobalAuthProfile],
      });
    });
    expect(setEnvironments).toHaveBeenCalledWith(expect.any(Function));
    expect(setMicroservices).toHaveBeenCalledWith(expect.any(Function));
    expect(setAppGlobalAuthProfiles).toHaveBeenCalledWith(expect.any(Function));
    expect(setActiveTab).toHaveBeenCalledWith('environments');
  });

  it('appends feature groups', async () => {
    const { hook, setFeatureGroups } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({ featureGroups: [{ id: 'fg1', scenarios: [] } as unknown as FeatureGroup] });
    });
    expect(setFeatureGroups).toHaveBeenCalledWith(expect.any(Function));
  });

  it('skips setters for empty/absent collections but still switches tab', async () => {
    const { hook, setEnvironments, setMicroservices, setFeatureGroups, setAppGlobalAuthProfiles, setActiveTab } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({});
    });
    expect(setEnvironments).not.toHaveBeenCalled();
    expect(setMicroservices).not.toHaveBeenCalled();
    expect(setFeatureGroups).not.toHaveBeenCalled();
    expect(setAppGlobalAuthProfiles).not.toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('environments');
  });

  it('exposes a merge updater that combines existing and incoming by id', async () => {
    const { hook, setEnvironments } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({ environments: [{ id: 'e2', name: 'B' } as Environment] });
    });
    const updater = setEnvironments.mock.calls[0][0] as (prev: Environment[]) => Environment[];
    const merged = updater([{ id: 'e1', name: 'A' } as Environment]);
    expect(merged.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('microservices updater merges existing and incoming by id', async () => {
    const { hook, setMicroservices } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({ microservices: [{ id: 'm2', name: 'B' } as Microservice] });
    });
    const updater = setMicroservices.mock.calls[0][0] as (prev: Microservice[]) => Microservice[];
    const merged = updater([{ id: 'm1', name: 'A' } as Microservice]);
    expect(merged.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('feature-groups updater appends normalized incoming groups to existing', async () => {
    const { hook, setFeatureGroups } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({
        featureGroups: [{ id: 'fg2', scenarios: [] } as unknown as FeatureGroup],
      });
    });
    const updater = setFeatureGroups.mock.calls[0][0] as (prev: FeatureGroup[]) => FeatureGroup[];
    const next = updater([{ id: 'fg1', scenarios: [] } as unknown as FeatureGroup]);
    expect(next.map((g) => g.id)).toEqual(['fg1', 'fg2']);
  });

  it('auth-profiles updater merges existing and incoming by id', async () => {
    const { hook, setAppGlobalAuthProfiles } = setup();
    await act(async () => {
      await hook.result.current.handleImportData({
        globalAuthProfiles: [{ id: 'g2', name: 'B' } as GlobalAuthProfile],
      });
    });
    const updater = setAppGlobalAuthProfiles.mock.calls[0][0] as (
      prev: GlobalAuthProfile[],
    ) => GlobalAuthProfile[];
    const merged = updater([{ id: 'g1', name: 'A' } as GlobalAuthProfile]);
    expect(merged.map((g) => g.id).sort()).toEqual(['g1', 'g2']);
  });
});
