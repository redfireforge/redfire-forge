/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deleteDemoFeatureGroupsByName,
  seedDemoFeatureGroup,
  seedDemoHarnessTarget,
  selectDemoEnvSvc,
} from './harnessAdapter';

const WIN = () => window as unknown as Record<string, unknown>;

describe('harnessAdapter', () => {
  beforeEach(() => {
    delete WIN().__demoSeedHarnessTarget;
    delete WIN().__demoSelectEnvSvc;
    delete WIN().__demoSeedFeatureGroup;
    delete WIN().__demoDeleteFeatureGroupsByName;
  });

  it('seeds a harness target when the bridge is present', () => {
    const fn = vi.fn().mockReturnValue({ envId: 'e1', svcId: 's1' });
    WIN().__demoSeedHarnessTarget = fn;
    expect(seedDemoHarnessTarget()).toEqual({ envId: 'e1', svcId: 's1' });
    expect(fn).toHaveBeenCalled();
  });

  it('returns null when the harness target bridge is absent', () => {
    expect(seedDemoHarnessTarget()).toBeNull();
  });

  it('selects env/svc when the bridge is present', () => {
    const fn = vi.fn();
    WIN().__demoSelectEnvSvc = fn;
    selectDemoEnvSvc('e1', 's1');
    expect(fn).toHaveBeenCalledWith('e1', 's1');
  });

  it('is a no-op when select env/svc is absent', () => {
    expect(() => selectDemoEnvSvc('e1', 's1')).not.toThrow();
  });

  it('seeds a feature group when the bridge is present', () => {
    const fn = vi.fn();
    WIN().__demoSeedFeatureGroup = fn;
    const fg = { id: 'fg-1', name: 'Store smoke' };
    expect(seedDemoFeatureGroup(fg)).toBe(true);
    expect(fn).toHaveBeenCalledWith(fg);
  });

  it('returns false when the feature-group bridge is absent', () => {
    expect(seedDemoFeatureGroup({ id: 'fg-1' })).toBe(false);
  });

  it('deletes feature groups by name when the bridge is present', () => {
    const fn = vi.fn();
    WIN().__demoDeleteFeatureGroupsByName = fn;
    deleteDemoFeatureGroupsByName('Store smoke');
    expect(fn).toHaveBeenCalledWith('Store smoke');
  });

  it('is a no-op when delete-by-name is absent', () => {
    expect(() => deleteDemoFeatureGroupsByName('Store smoke')).not.toThrow();
  });
});
