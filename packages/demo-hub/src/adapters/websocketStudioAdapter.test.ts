/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyWsTlsConfig, prepareWsTlsLessonQuiet } from './websocketStudioAdapter';

describe('websocketStudioAdapter', () => {
  beforeEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoApplyWsTlsConfig;
    delete w.__demoPrepareWsTlsLesson;
  });

  it('applyWsTlsConfig returns false when bridge is missing', () => {
    expect(applyWsTlsConfig({ rejectUnauthorized: false })).toBe(false);
  });

  it('applyWsTlsConfig applies patch via bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoApplyWsTlsConfig = spy;
    expect(applyWsTlsConfig({
      rejectUnauthorized: false,
      caCert: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----',
      clientCert: 'cert',
      clientKey: 'key',
    })).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      rejectUnauthorized: false,
      caCert: '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----',
      clientCert: 'cert',
      clientKey: 'key',
    });
  });

  it('prepareWsTlsLessonQuiet returns false when bridge is missing', () => {
    expect(prepareWsTlsLessonQuiet()).toBe(false);
  });
});
