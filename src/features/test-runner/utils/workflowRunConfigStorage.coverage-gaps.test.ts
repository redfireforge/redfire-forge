/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deleteWorkflowRunConfig,
  formatConfigLabel,
  formatRelativeTime,
  getWorkflowRunConfigs,
  loadWorkflowRunConfigs,
  saveWorkflowRunConfig,
  saveWorkflowRunConfigManually,
  updateWorkflowRunConfigLabel,
  type WorkflowRunConfig,
} from './workflowRunConfigStorage';

describe('workflowRunConfigStorage — coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('persists after quota errors by trimming aggressively', () => {
    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'workflow-run-configs') {
        attempts += 1;
        if (attempts < 4) {
          throw new DOMException('quota', 'QuotaExceededError');
        }
      }
      return originalSetItem.call(this, key, value);
    };

    const saved = saveWorkflowRunConfig({
      workflowId: 'wf-1',
      variables: { env: 'prod' },
      label: 'Prod',
    });

    Storage.prototype.setItem = originalSetItem;
    expect(saved.workflowId).toBe('wf-1');
    expect(loadWorkflowRunConfigs().length).toBeGreaterThan(0);
  });

  it('persist swallows repeated quota errors without throwing', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string) {
      if (key === 'workflow-run-configs') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, '');
    };
    expect(() => saveWorkflowRunConfig({
      workflowId: 'wf-q',
      variables: { a: '1' },
    })).not.toThrow();
    Storage.prototype.setItem = originalSetItem;
  });

  it('loadWorkflowRunConfigs returns [] on corrupt JSON', () => {
    localStorage.setItem('workflow-run-configs', '{bad');
    expect(loadWorkflowRunConfigs()).toEqual([]);
  });

  it('saveWorkflowRunConfig deduplicates by variable values', () => {
    const first = saveWorkflowRunConfig({ workflowId: 'wf-d', variables: { env: 'dev' }, label: 'Dev' });
    const second = saveWorkflowRunConfig({ workflowId: 'wf-d', variables: { env: 'dev' } });
    expect(second.id).toBe(first.id);
    expect(loadWorkflowRunConfigs()).toHaveLength(1);
  });

  it('updateWorkflowRunConfigLabel and deleteWorkflowRunConfig mutate storage', () => {
    const saved = saveWorkflowRunConfig({ workflowId: 'wf-u', variables: { x: '1' } });
    updateWorkflowRunConfigLabel(saved.id, 'Renamed');
    expect(getWorkflowRunConfigs('wf-u')[0].label).toBe('Renamed');
    expect(formatConfigLabel({ ...saved, label: 'Renamed' })).toBe('Renamed');
    expect(formatConfigLabel({ ...saved, label: undefined, variables: { longValue: 'x'.repeat(20) } })).toContain('...');
    expect(formatConfigLabel({ ...saved, label: undefined, variables: { a: '1', b: '2', c: '3' } })).toBe('3 variables');
    expect(formatConfigLabel({ ...saved, label: undefined, variables: {} })).toBe('No variables');
    saveWorkflowRunConfigManually('wf-u', { y: '2' }, '  ');
    deleteWorkflowRunConfig(saved.id);
    expect(getWorkflowRunConfigs('wf-u').every((c: WorkflowRunConfig) => c.id !== saved.id)).toBe(true);
    expect(formatRelativeTime(Date.now() - 60_000)).toBeTruthy();
  });

  it('rethrows non-quota errors from persist', () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string) {
      if (key === 'workflow-run-configs') throw new Error('blocked');
      return originalSetItem.call(this, key, '[]');
    };
    expect(() => saveWorkflowRunConfig({ workflowId: 'wf-err', variables: { a: '1' } })).toThrow('blocked');
    Storage.prototype.setItem = originalSetItem;
  });

  it('getWorkflowRunConfigs filters and sorts by usedAt descending', () => {
    saveWorkflowRunConfig({ workflowId: 'wf-sort', variables: { a: '1' } });
    const older = saveWorkflowRunConfig({ workflowId: 'wf-sort', variables: { b: '2' } });
    const configs = getWorkflowRunConfigs('wf-sort');
    expect(configs).toHaveLength(2);
    expect(configs[0].id).toBe(older.id);
    expect(configs[0].usedAt).toBeGreaterThanOrEqual(configs[1].usedAt);
  });

  it('persist warns and returns false when all quota retries fail', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string) {
      if (key === 'workflow-run-configs') throw new DOMException('quota', 'QuotaExceededError');
      return originalSetItem.call(this, key, '[]');
    };
    saveWorkflowRunConfigManually('wf-warn', { x: '1' }, 'Label');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not persist'));
    Storage.prototype.setItem = originalSetItem;
    warnSpy.mockRestore();
  });
});
