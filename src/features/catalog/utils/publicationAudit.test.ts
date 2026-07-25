import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logPublicationAudit, type PublicationAuditEvent } from './publicationAudit';

describe('logPublicationAudit', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    debugSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  const baseEvent: PublicationAuditEvent = {
    action: 'publish',
    entryId: 'e1',
    endpointId: 'ep1',
    method: 'POST',
    path: '/posts',
    timestamp: 1700000000000,
  };

  it('logs to console.debug in dev mode', () => {
    logPublicationAudit(baseEvent, { devOverride: true });
    expect(debugSpy).toHaveBeenCalledWith(
      '[PublicationAudit]',
      'publish',
      'POST /posts',
      baseEvent,
    );
  });

  it('includes optional fields when provided', () => {
    const event: PublicationAuditEvent = {
      ...baseEvent,
      action: 'unpublish',
      versionId: 'v2',
      note: 'Removing stale endpoint',
      affectedWorkflows: 3,
    };
    logPublicationAudit(event, { devOverride: true });
    expect(debugSpy).toHaveBeenCalledWith(
      '[PublicationAudit]',
      'unpublish',
      'POST /posts',
      event,
    );
  });

  it('handles republish action', () => {
    const event: PublicationAuditEvent = {
      ...baseEvent,
      action: 'republish',
      versionId: 'v3',
    };
    logPublicationAudit(event, { devOverride: true });
    expect(debugSpy).toHaveBeenCalledWith(
      '[PublicationAudit]',
      'republish',
      'POST /posts',
      event,
    );
  });

  it('does not throw when called with minimal fields', () => {
    expect(() => logPublicationAudit(baseEvent, { devOverride: true })).not.toThrow();
  });

  it('is a no-op outside dev mode', () => {
    logPublicationAudit(baseEvent, { devOverride: false });
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('uses import.meta.env.DEV when override is omitted', () => {
    vi.stubEnv('DEV', 'true');
    logPublicationAudit(baseEvent);
    expect(debugSpy).toHaveBeenCalledWith(
      '[PublicationAudit]',
      'publish',
      'POST /posts',
      baseEvent,
    );
  });
});
