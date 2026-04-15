import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildExportFilename } from './fileSaver';

describe('buildExportFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds results filename with slugified level and fixed date', () => {
    expect(buildExportFilename({ level: 'results', date: '2024-01-01' })).toBe('results-2024-01-01.json');
  });

  it('prefixes env and svc as slugified segments', () => {
    expect(
      buildExportFilename({
        env: 'T01',
        svc: 'User Service',
        level: 'results',
        date: '2024-01-01',
      }),
    ).toBe('t01-user-service-results-2024-01-01.json');
  });

  it('uses custom ext', () => {
    expect(buildExportFilename({ level: 'failures', ext: 'csv', date: '2024-01-01' })).toBe(
      'failures-2024-01-01.csv',
    );
  });

  it('slugifies spaces and special characters to hyphens', () => {
    expect(
      buildExportFilename({
        level: 'My Level!',
        date: '2024-01-01',
      }),
    ).toBe('my-level-2024-01-01.json');
  });

  it('includes slugified name segment', () => {
    expect(
      buildExportFilename({
        level: 'test',
        name: 'Login Flow',
        date: '2024-01-01',
      }),
    ).toBe('test-login-flow-2024-01-01.json');
  });

  it('defaults date and ext when omitted', () => {
    expect(buildExportFilename({ level: 'export' })).toBe('export-2026-04-15T12-00-00.json');
  });
});
