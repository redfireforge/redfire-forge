/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWorkflowRunConfigs,
  saveWorkflowRunConfig,
  getWorkflowRunConfigs,
  updateWorkflowRunConfigLabel,
  deleteWorkflowRunConfig,
  formatConfigLabel,
  formatRelativeTime,
} from './workflowRunConfigStorage';

describe('workflowRunConfigStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loadWorkflowRunConfigs', () => {
    it('returns empty array when no configs stored', () => {
      expect(loadWorkflowRunConfigs()).toEqual([]);
    });

    it('returns stored configs', () => {
      const configs = [
        { id: '1', workflowId: 'wf1', variables: { foo: 'bar' }, usedAt: 1000 },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(configs));
      expect(loadWorkflowRunConfigs()).toEqual(configs);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem('workflow-run-configs', 'invalid');
      expect(loadWorkflowRunConfigs()).toEqual([]);
    });
  });

  describe('saveWorkflowRunConfig', () => {
    it('saves a new config', () => {
      vi.setSystemTime(new Date(1000));
      const result = saveWorkflowRunConfig({
        workflowId: 'wf1',
        variables: { baseUrl: 'https://api.example.com' },
      });

      expect(result.workflowId).toBe('wf1');
      expect(result.variables).toEqual({ baseUrl: 'https://api.example.com' });
      expect(result.usedAt).toBe(1000);
      expect(result.id).toBeDefined();

      const stored = loadWorkflowRunConfigs();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(result);
    });

    it('updates timestamp when same variables are used again', () => {
      vi.setSystemTime(new Date(1000));
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: { key: 'value' } });

      vi.setSystemTime(new Date(2000));
      const result = saveWorkflowRunConfig({ workflowId: 'wf1', variables: { key: 'value' } });

      expect(result.usedAt).toBe(2000);
      const stored = loadWorkflowRunConfigs();
      expect(stored).toHaveLength(1);
    });

    it('preserves label when updating existing config', () => {
      vi.setSystemTime(new Date(1000));
      const first = saveWorkflowRunConfig({ workflowId: 'wf1', variables: { key: 'value' } });
      updateWorkflowRunConfigLabel(first.id, 'My Label');

      vi.setSystemTime(new Date(2000));
      const second = saveWorkflowRunConfig({ workflowId: 'wf1', variables: { key: 'value' } });

      expect(second.label).toBe('My Label');
    });

    it('keeps configs for different workflows separate', () => {
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: { a: '1' } });
      saveWorkflowRunConfig({ workflowId: 'wf2', variables: { b: '2' } });

      expect(loadWorkflowRunConfigs()).toHaveLength(2);
    });

    it('limits configs per workflow to MAX_CONFIGS_PER_WORKFLOW', () => {
      for (let i = 0; i < 20; i++) {
        vi.setSystemTime(new Date(i * 1000));
        saveWorkflowRunConfig({ workflowId: 'wf1', variables: { iter: String(i) } });
      }

      const configs = getWorkflowRunConfigs('wf1');
      expect(configs.length).toBeLessThanOrEqual(15);
      expect(configs[0].variables.iter).toBe('19');
    });
  });

  describe('getWorkflowRunConfigs', () => {
    it('returns configs for specific workflow sorted by most recent', () => {
      vi.setSystemTime(new Date(1000));
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: { first: '1' } });
      vi.setSystemTime(new Date(3000));
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: { third: '3' } });
      vi.setSystemTime(new Date(2000));
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: { second: '2' } });

      const configs = getWorkflowRunConfigs('wf1');
      expect(configs[0].variables).toHaveProperty('third');
      expect(configs[1].variables).toHaveProperty('second');
      expect(configs[2].variables).toHaveProperty('first');
    });

    it('returns empty array for unknown workflow', () => {
      saveWorkflowRunConfig({ workflowId: 'wf1', variables: {} });
      expect(getWorkflowRunConfigs('unknown')).toEqual([]);
    });
  });

  describe('updateWorkflowRunConfigLabel', () => {
    it('updates label for existing config', () => {
      const config = saveWorkflowRunConfig({ workflowId: 'wf1', variables: {} });
      updateWorkflowRunConfigLabel(config.id, 'Production');

      const stored = loadWorkflowRunConfigs();
      expect(stored[0].label).toBe('Production');
    });

    it('removes label when empty string', () => {
      const config = saveWorkflowRunConfig({ workflowId: 'wf1', variables: {}, label: 'Test' });
      updateWorkflowRunConfigLabel(config.id, '');

      const stored = loadWorkflowRunConfigs();
      expect(stored[0].label).toBeUndefined();
    });
  });

  describe('deleteWorkflowRunConfig', () => {
    it('removes config by id', () => {
      const config = saveWorkflowRunConfig({ workflowId: 'wf1', variables: {} });
      expect(loadWorkflowRunConfigs()).toHaveLength(1);

      deleteWorkflowRunConfig(config.id);
      expect(loadWorkflowRunConfigs()).toHaveLength(0);
    });
  });

  describe('formatConfigLabel', () => {
    it('returns label if present', () => {
      const config = { id: '1', workflowId: 'wf1', variables: { foo: 'bar' }, label: 'My Config', usedAt: 0 };
      expect(formatConfigLabel(config)).toBe('My Config');
    });

    it('returns "No variables" for empty config', () => {
      const config = { id: '1', workflowId: 'wf1', variables: {}, usedAt: 0 };
      expect(formatConfigLabel(config)).toBe('No variables');
    });

    it('returns variable summary for 1-2 variables', () => {
      const config = { id: '1', workflowId: 'wf1', variables: { baseUrl: 'https://api.com', apiKey: 'sk-123' }, usedAt: 0 };
      expect(formatConfigLabel(config)).toContain('baseUrl=');
      expect(formatConfigLabel(config)).toContain('apiKey=');
    });

    it('truncates long values', () => {
      const config = { id: '1', workflowId: 'wf1', variables: { longKey: 'this-is-a-very-long-value-that-should-be-truncated' }, usedAt: 0 };
      const label = formatConfigLabel(config);
      expect(label).toContain('...');
      expect(label.length).toBeLessThan(50);
    });

    it('returns count for 3+ variables', () => {
      const config = { id: '1', workflowId: 'wf1', variables: { a: '1', b: '2', c: '3' }, usedAt: 0 };
      expect(formatConfigLabel(config)).toBe('3 variables');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "just now" for recent timestamps', () => {
      vi.setSystemTime(new Date(60000));
      expect(formatRelativeTime(60000)).toBe('just now');
      expect(formatRelativeTime(30000)).toBe('just now');
    });

    it('returns minutes ago', () => {
      vi.setSystemTime(new Date(300000));
      expect(formatRelativeTime(0)).toBe('5m ago');
    });

    it('returns hours ago', () => {
      vi.setSystemTime(new Date(7200000));
      expect(formatRelativeTime(0)).toBe('2h ago');
    });

    it('returns days ago', () => {
      vi.setSystemTime(new Date(172800000));
      expect(formatRelativeTime(0)).toBe('2d ago');
    });

    it('returns formatted date for old timestamps', () => {
      vi.setSystemTime(new Date('2026-05-10'));
      const result = formatRelativeTime(new Date('2026-04-01').getTime());
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });
});
