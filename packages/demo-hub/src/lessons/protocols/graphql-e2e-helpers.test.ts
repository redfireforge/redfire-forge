/**
 * Unit tests for e2e/graphql-lesson/* helpers (split from graphql-lesson-smoke-helpers).
 */
import type { Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../e2e/demo-player-helpers', () => ({
  waitForReadingPhase: vi.fn().mockResolvedValue(undefined),
  launchGqlLesson: vi.fn().mockResolvedValue(undefined),
  runNextStep: vi.fn().mockResolvedValue(undefined),
  completeCurrentStepAction: vi.fn().mockResolvedValue(undefined),
  finishDemoStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../../e2e/graphql-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../e2e/graphql-helpers')>();
  return {
    ...actual,
    setupLiveProxy: vi.fn().mockResolvedValue(undefined),
    seedGqlDemoEnvironmentForE2e: vi.fn().mockResolvedValue(undefined),
  };
});
import { GQL_HTTP } from '../../../../../e2e/graphql-helpers';
import {
  GQL1_LESSON,
  GQL13_LESSON,
  GQL_TLS_HTTPS,
  GQL_TLS_MTLS_HEALTH,
  GQL_TLS_MTLS_HTTPS,
  MUTATION_TIMEOUT,
  DEMO_ACTION_TIMEOUT,
} from '../../../../../e2e/graphql-lesson/constants';
import { waitForGqlAuthPanel } from '../../../../../e2e/graphql-lesson/auth-panel';
import { seedGql12BaselineSnapshotForE2e } from '../../../../../e2e/graphql-lesson/gql12-baseline';
import {
  activateGql13E2eWebMock,
  installGql13E2eDesktopShim,
  isGql13LiveGraphqlUrl,
  isGql13MockProxyUrl,
  isGqlMockProxyHealthy,
  setupGql13LiveAndMockProxy,
} from '../../../../../e2e/graphql-lesson/gql13-mock';
import {
  isGqlMtlsServerHealthy,
  isGqlTlsServerHealthy,
  resolveGql5ProxyTarget,
} from '../../../../../e2e/graphql-lesson/gql5-proxy';
import { prepareGql1DockerLesson } from '../../../../../e2e/graphql-lesson/prepare-lessons';
import {
  getGqlSmokeLesson,
  GQL_SMOKE_LESSON_IDS,
} from '../../../../../e2e/graphql-lesson/smoke-registry';
import {
  advanceOneDemoStep,
  completeDemoStep,
  currentStepNumber,
  makeDemoLessonWalk,
  skipDemoReading,
  waitForDemoStepDone,
  waitForDemoStepReady,
} from '../../../../../e2e/graphql-lesson/step-driver';
import {
  gql12StepTimeout,
  gql13StepTimeout,
  walkFullGql1Lesson,
  walkFullGql14Lesson,
  walkFullGql2Lesson,
} from '../../../../../e2e/graphql-lesson/walk-lessons';
import { setupLiveProxy } from '../../../../../e2e/graphql-helpers';
import { finishDemoStep, launchGqlLesson, runNextStep, waitForReadingPhase } from '../../../../../e2e/demo-player-helpers';

function makeLocatorChain(state: {
  text?: string;
  phase?: string;
  badgeVisible?: boolean;
}) {
  return {
    textContent: vi.fn().mockResolvedValue(state.text ?? '1 / 13'),
    waitFor: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(state.badgeVisible ?? true),
    getAttribute: vi.fn().mockResolvedValue(state.phase ?? 'reading'),
  };
}

function makePage(state: {
  stepCounter?: string;
  phase?: string;
  badgeVisible?: boolean;
} = {}): Page {
  const panel = makeLocatorChain({
    text: state.stepCounter,
    phase: state.phase,
    badgeVisible: state.badgeVisible,
  });
  const title = makeLocatorChain({ text: 'Intro' });
  const next = makeLocatorChain({});
  const badge = makeLocatorChain({ badgeVisible: state.badgeVisible });

  return {
    locator: vi.fn((sel: string) => {
      if (sel.includes('demo-live-step-counter')) return panel;
      if (sel.includes('demo-live-step-title')) return title;
      if (sel.includes('Next step')) return next;
      if (sel.includes('phase-badge')) return badge;
      if (sel.includes('demo-live-panel')) return panel;
      return makeLocatorChain({});
    }),
    waitForFunction: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

describe('graphql-lesson step-driver', () => {
  it('currentStepNumber parses the step counter', async () => {
    const page = makePage({ stepCounter: '4 / 18' });
    await expect(currentStepNumber(page)).resolves.toBe(4);
  });

  it('currentStepNumber returns 0 when counter is missing', async () => {
    const page = makePage({ stepCounter: 'n/a' });
    await expect(currentStepNumber(page)).resolves.toBe(0);
  });

  it('waitForDemoStepReady and waitForDemoStepDone delegate to waitForFunction', async () => {
    const page = makePage();
    await waitForDemoStepReady(page, 1_000);
    await waitForDemoStepDone(page, 2_000);
    expect(page.waitForFunction).toHaveBeenCalledTimes(2);
  });

  it('completeDemoStep throws when step never reaches done', async () => {
    const page = makePage({ phase: 'reading' });
    let calls = 0;
    vi.mocked(page.waitForFunction).mockImplementation(async () => {
      calls += 1;
      if (calls >= 2) throw new Error('timeout');
    });
    await expect(completeDemoStep(page, 'GQL-9', 11, 50)).rejects.toThrow(/stuck in phase/);
  });

  it('skipDemoReading no-ops when badge is hidden', async () => {
    const page = makePage({ badgeVisible: false });
    await skipDemoReading(page);
    expect(page.locator('.demo-live-phase-badge.skippable').click).not.toHaveBeenCalled();
  });

  it('advanceOneDemoStep waits for reading phase between non-final steps', async () => {
    const page = makePage({ stepCounter: '2 / 13', phase: 'reading' });
    await advanceOneDemoStep(page, 'GQL-1', 13);
    expect(waitForReadingPhase).toHaveBeenCalled();
  });

  it('completeDemoStep returns early when phase is already done', async () => {
    const page = makePage({ phase: 'done' });
    await completeDemoStep(page, 'GQL-1', 13);
    expect(page.waitForFunction).toHaveBeenCalled();
    expect(page.locator).not.toHaveBeenCalledWith('[aria-label="Next step"]');
  });

  it('skipDemoReading clicks skippable badge when visible', async () => {
    const page = makePage({ badgeVisible: true });
    await skipDemoReading(page);
    expect(page.evaluate).toHaveBeenCalled();
  });

  it('makeDemoLessonWalk advances steps-1 times then completes final step', async () => {
    let step = 1;
    const page = makePage({ stepCounter: '1 / 3', phase: 'reading' });
    vi.mocked(page.locator('.demo-live-step-counter').textContent).mockImplementation(async () => {
      return `${step} / 3`;
    });
    vi.mocked(page.locator('[data-testid="demo-live-panel"]').getAttribute).mockImplementation(
      async () => (step === 3 ? 'done' : 'reading'),
    );
    const next = page.locator('[aria-label="Next step"]');
    vi.mocked(next.click).mockImplementation(async () => {
      step += 1;
    });

    const walk = makeDemoLessonWalk({ lessonLabel: 'GQL-X', steps: 3 });
    await walk(page);
    expect(next.click).toHaveBeenCalledTimes(2);
  });

  it('advanceOneDemoStep does not click Next when already on final step', async () => {
    const page = makePage({ stepCounter: '13 / 13', phase: 'done' });
    await advanceOneDemoStep(page, 'GQL-1', 13);
    expect(page.locator('[aria-label="Next step"]').click).not.toHaveBeenCalled();
  });
});

describe('graphql-lesson walk-lessons timeouts', () => {
  it('gql12StepTimeout uses mutation timeout for early introspect steps', () => {
    expect(gql12StepTimeout(0)).toBe(MUTATION_TIMEOUT);
    expect(gql12StepTimeout(2)).toBe(MUTATION_TIMEOUT);
    expect(gql12StepTimeout(3)).toBe(DEMO_ACTION_TIMEOUT);
  });

  it('gql13StepTimeout extends timeouts on heavy mock-server steps', () => {
    expect(gql13StepTimeout(4)).toBe(MUTATION_TIMEOUT);
    expect(gql13StepTimeout(8)).toBe(MUTATION_TIMEOUT);
    expect(gql13StepTimeout(11)).toBe(MUTATION_TIMEOUT);
    expect(gql13StepTimeout(13)).toBe(MUTATION_TIMEOUT);
    expect(gql13StepTimeout(0)).toBe(DEMO_ACTION_TIMEOUT);
    expect(gql13StepTimeout(GQL13_LESSON.steps - 1)).toBe(DEMO_ACTION_TIMEOUT);
  });

  it('walkFullGql1Lesson is a demo walk factory', () => {
    expect(typeof walkFullGql1Lesson).toBe('function');
  });

  it('walkFullGql14Lesson is a demo walk factory', () => {
    expect(typeof walkFullGql14Lesson).toBe('function');
  });

  it('walkFullGql2Lesson delegates to demo-player runNextStep helpers', async () => {
    const page = makePage();
    await walkFullGql2Lesson(page);
    expect(runNextStep).toHaveBeenCalled();
    expect(finishDemoStep).toHaveBeenCalled();
  });
});

describe('graphql-lesson constants', () => {
  it('GQL1 lesson metadata matches smoke registry', () => {
    expect(GQL1_LESSON.steps).toBe(getGqlSmokeLesson('gql1').steps);
  });
});

describe('graphql-lesson gql5-proxy', () => {
  it('resolveGql5ProxyTarget maps TLS, mTLS, and Docker endpoints', () => {
    expect(resolveGql5ProxyTarget('https://localhost:4443/graphql', '')).toEqual({
      forward: true,
      url: 'https://localhost:4443/graphql',
    });
    expect(resolveGql5ProxyTarget('', '{"url":"x"}')).toEqual({
      forward: false,
      url: '',
    });
    expect(resolveGql5ProxyTarget('', '4443')).toEqual({
      forward: true,
      url: GQL_TLS_HTTPS,
    });
    expect(resolveGql5ProxyTarget('', '4445')).toEqual({
      forward: true,
      url: GQL_TLS_MTLS_HTTPS,
    });
    expect(resolveGql5ProxyTarget('', '4010')).toEqual({
      forward: true,
      url: GQL_HTTP,
    });
  });

  it('isGqlTlsServerHealthy checks docker/graphql/tls health body', async () => {
    const ok = {
      get: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({ status: 'ok' }) }),
    };
    const bad = {
      get: vi.fn().mockResolvedValue({ ok: () => true, json: async () => ({ status: 'down' }) }),
    };
    await expect(isGqlTlsServerHealthy(ok as never)).resolves.toBe(true);
    await expect(isGqlTlsServerHealthy(bad as never)).resolves.toBe(false);
    await expect(isGqlTlsServerHealthy({ get: vi.fn().mockRejectedValue(new Error('x')) } as never)).resolves.toBe(false);
  });

  it('isGqlMtlsServerHealthy checks mTLS health endpoint', async () => {
    const request = {
      get: vi.fn().mockImplementation(async (url: string) => ({
        ok: () => url === GQL_TLS_MTLS_HEALTH,
        json: async () => ({ status: 'ok' }),
      })),
    };
    await expect(isGqlMtlsServerHealthy(request as never)).resolves.toBe(true);
  });
});

describe('graphql-lesson gql13-mock', () => {
  it('classifies live GraphQL and mock proxy URLs', () => {
    expect(isGql13LiveGraphqlUrl('http://localhost:4010/graphql')).toBe(true);
    expect(isGql13LiveGraphqlUrl('http://example.com')).toBe(false);
    expect(isGql13MockProxyUrl('http://localhost:3001/api/graphql/mock')).toBe(true);
    expect(isGql13MockProxyUrl('http://localhost:4010/graphql')).toBe(false);
  });

  it('isGqlMockProxyHealthy returns false when health probe fails', async () => {
    await expect(
      isGqlMockProxyHealthy({ get: vi.fn().mockRejectedValue(new Error('down')) } as never),
    ).resolves.toBe(false);
  });

  it('setupGql13LiveAndMockProxy registers a __proxy route handler', async () => {
    const route = vi.fn();
    const page = { route } as unknown as Page;
    await setupGql13LiveAndMockProxy(page, { post: vi.fn(), get: vi.fn() } as never);
    expect(route).toHaveBeenCalledWith('**/__proxy', expect.any(Function));
  });

  it('installGql13E2eDesktopShim and activateGql13E2eWebMock set mock flags', async () => {
    const page = {
      addInitScript: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    await installGql13E2eDesktopShim(page);
    await activateGql13E2eWebMock(page);
    expect(page.addInitScript).toHaveBeenCalled();
    expect(page.evaluate).toHaveBeenCalled();
  });
});

describe('graphql-lesson gql12-baseline', () => {
  it('seedGql12BaselineSnapshotForE2e writes to indexedDB', async () => {
    const page = { evaluate: vi.fn().mockResolvedValue(undefined) } as unknown as Page;
    await seedGql12BaselineSnapshotForE2e(page);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      dbName: 'redfireforge',
      snap: expect.objectContaining({ label: 'Prior release (demo)' }),
    }));
  });
});

describe('graphql-lesson auth-panel', () => {
  it('waitForGqlAuthPanel waits for auth panel visibility', async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);
    const page = { locator: vi.fn().mockReturnValue({ waitFor }) } as unknown as Page;
    await waitForGqlAuthPanel(page, 5_000);
    expect(waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 5_000 });
  });
});

describe('graphql-lesson prepare-lessons', () => {
  it('prepareGql1DockerLesson wires live proxy and launches studio', async () => {
    const page = {
      waitForSelector: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
    await prepareGql1DockerLesson(page, {} as never);
    expect(setupLiveProxy).toHaveBeenCalled();
    expect(launchGqlLesson).toHaveBeenCalledWith(page, GQL1_LESSON.name);
  });
});

describe('graphql-lesson smoke-registry', () => {
  it('exposes gql1..gql3 smoke lessons with prepare and walk handlers', () => {
    expect(GQL_SMOKE_LESSON_IDS).toEqual(['gql1', 'gql2', 'gql3']);
    for (const id of GQL_SMOKE_LESSON_IDS) {
      const lesson = getGqlSmokeLesson(id);
      expect(lesson.steps).toBeGreaterThan(0);
      expect(typeof lesson.prepare).toBe('function');
      expect(typeof lesson.walk).toBe('function');
    }
  });
});
