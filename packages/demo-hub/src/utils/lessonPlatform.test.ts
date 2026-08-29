import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DemoLesson } from '../types';
import { isLessonDesktopOnlyBlocked, isDockerLessonBlockedOnWeb } from './lessonPlatform';

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '@shared/utils/platform';

const desktopLesson: DemoLesson = {
  id: 'gql-mock-server',
  domainId: 'protocols',
  name: 'Mock Server',
  description: 'Desktop mock proxy demo',
  estimatedMinutes: 6,
  desktopOnly: true,
  concept: { title: 'Mock', body: 'Body' },
  steps: [{ id: 's1', title: 'Step', description: 'Desc' }],
};

const dockerLesson: DemoLesson = {
  id: 'gql-docker',
  domainId: 'protocols',
  name: 'GraphQL Docker',
  description: 'Needs docker',
  estimatedMinutes: 5,
  dockerEndpoint: 'http://localhost:4010/graphql',
  dockerCommand: 'docker compose up',
  concept: { title: 'GQL', body: 'Body' },
  steps: [{ id: 's1', title: 'Step', description: 'Desc' }],
};

describe('isLessonDesktopOnlyBlocked', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('returns false for lessons without desktopOnly', () => {
    expect(isLessonDesktopOnlyBlocked({ ...desktopLesson, desktopOnly: undefined })).toBe(false);
  });

  it('returns false on desktop when lesson is desktop-only', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    expect(isLessonDesktopOnlyBlocked(desktopLesson)).toBe(false);
  });

  it('returns true on web when lesson is desktop-only', () => {
    expect(isLessonDesktopOnlyBlocked(desktopLesson)).toBe(true);
  });

  it('returns false on web when GQL-13 E2E desktop shim is active', () => {
    vi.stubGlobal('window', { __RF_E2E_MOCK_DESKTOP__: true } as Window & typeof globalThis);
    expect(isLessonDesktopOnlyBlocked(desktopLesson)).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('isDockerLessonBlockedOnWeb', () => {
  const noDockerLesson: DemoLesson = {
    ...dockerLesson,
    dockerEndpoint: undefined,
    dockerEndpoints: undefined,
  };

  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for a lesson with no docker endpoint', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.redfireforge.com' } });
    expect(isDockerLessonBlockedOnWeb(noDockerLesson)).toBe(false);
  });

  it('returns false when running in Tauri (desktop)', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.stubGlobal('window', { location: { hostname: 'demo.redfireforge.com' } });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(false);
  });

  it('returns false on localhost (local dev)', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(false);
  });

  it('returns false on 127.0.0.1 (local dev)', () => {
    vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(false);
  });

  it('returns false on ::1 (IPv6 loopback)', () => {
    vi.stubGlobal('window', { location: { hostname: '::1' } });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(false);
  });

  it('returns true on a hosted domain when lesson has dockerEndpoint', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.redfireforge.com' } });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(true);
  });

  it('returns true when lesson uses dockerEndpoints array on a hosted domain', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.redfireforge.com' } });
    const multi: DemoLesson = { ...noDockerLesson, dockerEndpoints: ['http://localhost:4010/health'] };
    expect(isDockerLessonBlockedOnWeb(multi)).toBe(true);
  });

  it('returns false on hosted domain when E2E desktop shim is active', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'demo.redfireforge.com' },
      __RF_E2E_MOCK_DESKTOP__: true,
    });
    expect(isDockerLessonBlockedOnWeb(dockerLesson)).toBe(false);
  });
});
