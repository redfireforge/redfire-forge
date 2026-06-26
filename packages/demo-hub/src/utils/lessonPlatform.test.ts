import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DemoLesson } from '../types';
import { isLessonDesktopOnlyBlocked } from './lessonPlatform';

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
