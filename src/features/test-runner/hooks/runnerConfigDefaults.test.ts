import { describe, it, expect } from 'vitest';
import { resolveLoadedConfig, defaultLoadProfile, defaultThinkTime, defaultConfig } from './runnerConfigDefaults';

describe('runnerConfigDefaults', () => {
  describe('resolveLoadedConfig', () => {
    it('returns null when raw is null', () => {
      expect(resolveLoadedConfig(null)).toBeNull();
    });

    it('returns null when raw is undefined', () => {
      expect(resolveLoadedConfig(undefined)).toBeNull();
    });

    it('returns null when raw is empty string', () => {
      expect(resolveLoadedConfig('')).toBeNull();
    });

    it('fills all defaults for empty object', () => {
      const resolved = resolveLoadedConfig({});
      expect(resolved).not.toBeNull();
      expect(resolved!.concurrency).toBe(defaultConfig.concurrency);
      expect(resolved!.iterations).toBe(defaultConfig.iterations);
      expect(resolved!.selectedScenarios).toEqual([]);
      expect(resolved!.weights).toEqual({});
      expect(resolved!.skipValidation).toBe(false);
      expect(resolved!.validationOverride).toBe('default');
      expect(resolved!.forceUnordered).toBe('default');
      expect(resolved!.hostMode).toBe('settings');
      expect(resolved!.customBaseUrl).toBe('');
      expect(resolved!.executionMode).toBe('batch');
      expect(resolved!.loadProfile.durationSec).toBe(defaultLoadProfile.durationSec);
      expect(resolved!.thinkTime.mode).toBe(defaultThinkTime.mode);
      expect(resolved!.timeoutSec).toBe(10);
      expect(resolved!.retryCount).toBe(0);
      expect(resolved!.retryDelayMs).toBe(1000);
      expect(resolved!.errorPolicy).toBe('continue');
      expect(resolved!.maxErrors).toBe(10);
      expect(resolved!.maxErrorRate).toBe(50);
      expect(resolved!.autoReport).toBe(false);
      expect(resolved!.autoReportFormat).toBe('html');
    });

    it('fills defaults for all-undefined fields', () => {
      const resolved = resolveLoadedConfig({
        concurrency: undefined,
        iterations: undefined,
        selectedScenarios: undefined,
        weights: undefined,
        skipValidation: undefined,
        validationOverride: undefined,
        forceUnordered: undefined,
        hostMode: undefined,
        customBaseUrl: undefined,
        executionMode: undefined,
        loadProfile: undefined,
        thinkTime: undefined,
        timeoutSec: undefined,
        retryCount: undefined,
        retryDelayMs: undefined,
        errorPolicy: undefined,
        maxErrors: undefined,
        maxErrorRate: undefined,
        autoReport: undefined,
        autoReportFormat: undefined,
      });
      expect(resolved).not.toBeNull();
      expect(resolved!.concurrency).toBe(1);
      expect(resolved!.iterations).toBe(1);
      expect(resolved!.hostMode).toBe('settings');
      expect(resolved!.executionMode).toBe('batch');
      expect(resolved!.loadProfile.type).toBe('sustained');
      expect(resolved!.thinkTime.mode).toBe('none');
    });

    it('preserves explicit values when provided', () => {
      const resolved = resolveLoadedConfig({
        concurrency: 10,
        iterations: 50,
        selectedScenarios: ['a', 'b'],
        weights: { a: 2, b: 3 },
        skipValidation: true,
        validationOverride: 'full',
        forceUnordered: 'force-on',
        hostMode: 'custom',
        customBaseUrl: 'https://example.com',
        executionMode: 'load-profile',
        loadProfile: { type: 'spike', durationSec: 120, maxConcurrency: 20 },
        thinkTime: { mode: 'constant', constantMs: 500 },
        timeoutSec: 30,
        retryCount: 3,
        retryDelayMs: 2000,
        errorPolicy: 'stop',
        maxErrors: 5,
        maxErrorRate: 25,
        autoReport: true,
        autoReportFormat: 'markdown',
      });
      expect(resolved).not.toBeNull();
      expect(resolved!.concurrency).toBe(10);
      expect(resolved!.iterations).toBe(50);
      expect(resolved!.selectedScenarios).toEqual(['a', 'b']);
      expect(resolved!.weights).toEqual({ a: 2, b: 3 });
      expect(resolved!.skipValidation).toBe(true);
      expect(resolved!.validationOverride).toBe('full');
      expect(resolved!.forceUnordered).toBe('force-on');
      expect(resolved!.hostMode).toBe('custom');
      expect(resolved!.customBaseUrl).toBe('https://example.com');
      expect(resolved!.executionMode).toBe('load-profile');
      expect(resolved!.loadProfile.type).toBe('spike');
      expect(resolved!.thinkTime.mode).toBe('constant');
      expect(resolved!.timeoutSec).toBe(30);
      expect(resolved!.retryCount).toBe(3);
      expect(resolved!.retryDelayMs).toBe(2000);
      expect(resolved!.errorPolicy).toBe('stop');
      expect(resolved!.maxErrors).toBe(5);
      expect(resolved!.maxErrorRate).toBe(25);
      expect(resolved!.autoReport).toBe(true);
      expect(resolved!.autoReportFormat).toBe('markdown');
    });

    it('handles partial config — only some fields set', () => {
      const resolved = resolveLoadedConfig({
        concurrency: 5,
        hostMode: 'hardcoded',
      });
      expect(resolved).not.toBeNull();
      expect(resolved!.concurrency).toBe(5);
      expect(resolved!.hostMode).toBe('hardcoded');
      expect(resolved!.iterations).toBe(1);
      expect(resolved!.autoReportFormat).toBe('html');
    });
  });

  describe('defaultConfig', () => {
    it('has expected shape', () => {
      expect(defaultConfig.concurrency).toBe(1);
      expect(defaultConfig.iterations).toBe(1);
      expect(defaultConfig.hostMode).toBe('settings');
      expect(defaultConfig.executionMode).toBe('batch');
    });
  });

  describe('defaultLoadProfile', () => {
    it('has expected shape', () => {
      expect(defaultLoadProfile.type).toBe('sustained');
      expect(defaultLoadProfile.durationSec).toBe(60);
      expect(defaultLoadProfile.maxConcurrency).toBe(5);
    });
  });

  describe('defaultThinkTime', () => {
    it('mode is none', () => {
      expect(defaultThinkTime.mode).toBe('none');
    });
  });
});
