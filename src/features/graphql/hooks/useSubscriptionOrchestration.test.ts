/**
 * @vitest-environment jsdom
 * Tests for useSubscriptionOrchestration hook.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSubscriptionOrchestration } from './useSubscriptionOrchestration';
import type { UseGraphqlSubscriptionResult } from './useGraphqlSubscription';
import type { GraphqlSubscriptionMessage, SubscriptionStats } from '../../../shared/types/graphql';
import type { GqlStudioTab } from '../utils/tabPersistence';

// ─── Minimal stubs ────────────────────────────────────────────────────────────

const EMPTY_STATS: SubscriptionStats = {
  totalMessages: 0, errorCount: 0, avgLatencyMs: 0, msgsPerSec: 0, connectedDurationMs: 0,
};

function makeTab(overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id: 't1',
    label: 'Tab 1',
    query: 'subscription { events { id } }',
    variables: '{}',
    operationType: 'subscription',
    headers: [],
    lastUsedAt: 0,
    ...overrides,
  };
}

function makeSub(overrides: Partial<UseGraphqlSubscriptionResult> = {}): UseGraphqlSubscriptionResult {
  return {
    state: 'idle',
    messages: [] as GraphqlSubscriptionMessage[],
    stats: EMPTY_STATS,
    connectedSince: 0,
    isPaused: false,
    pausedBufferCount: 0,
    errorMessage: null,
    reconnectAttempt: 0,
    sessionId: null,
    transport: null,
    subscribe: vi.fn(),
    disconnect: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clear: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderOrchestration(overrides: {
  activeTab?: GqlStudioTab | undefined | null;
  endpoint?: string;
  endpointLinkPending?: boolean;
  sub?: Partial<UseGraphqlSubscriptionResult>;
} = {}) {
  const subscription = makeSub(overrides.sub);
  const { result } = renderHook(() =>
    useSubscriptionOrchestration({
      activeTab: overrides.activeTab === null ? undefined : (overrides.activeTab ?? makeTab()),
      endpoint: overrides.endpoint ?? 'http://localhost:4000/graphql',
      auth: null,
      activeEnvironment: null,
      activeTabHeaders: {},
      selectedOperation: 'TestSub',
      skipTlsVerify: false,
      subscription,
      endpointLinkPending: overrides.endpointLinkPending,
    }),
  );
  return { result, subscription };
}

// ─── handleSubscribe ──────────────────────────────────────────────────────────

describe('handleSubscribe', () => {
  it('calls subscription.subscribe with resolved params', () => {
    const { result, subscription } = renderOrchestration();
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).toHaveBeenCalledOnce();
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.query).toContain('subscription');
    expect(call.endpoint).toBe('http://localhost:4000/graphql');
    expect(call.operationName).toBe('TestSub');
  });

  it('Phase 6F: does not subscribe when endpointLinkPending', () => {
    const { result, subscription } = renderOrchestration({ endpointLinkPending: true });
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).not.toHaveBeenCalled();
  });

  it('passes subscriptionTransport from active tab to subscribe params', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab({ subscriptionTransport: 'sse' }),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.subscriptionTransport).toBe('sse');
  });

  it('passes undefined subscriptionTransport when tab has no transport set', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab(),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.subscriptionTransport).toBeUndefined();
  });

  it('does nothing when activeTab is undefined', () => {
    const { result, subscription } = renderOrchestration({ activeTab: null });
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing when endpoint is blank', () => {
    const { result, subscription } = renderOrchestration({ endpoint: '   ' });
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing when query is blank', () => {
    const { result, subscription } = renderOrchestration({ activeTab: makeTab({ query: '  ' }) });
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).not.toHaveBeenCalled();
  });

  it('parses variables JSON before calling subscribe', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab({ variables: '{"id": 42}' }),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.variables).toEqual({ id: 42 });
  });

  it('uses empty object for invalid variables JSON', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab({ variables: 'not-json' }),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.variables).toEqual({});
  });

  it('uses empty object when variables resolve to "{}" (branch: t !== "{}")', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab({ variables: '{}' }),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.variables).toEqual({});
  });

  it('uses empty object when variables resolve to an array (not a plain object)', () => {
    const { result, subscription } = renderOrchestration({
      activeTab: makeTab({ variables: '[1, 2, 3]' }),
    });
    act(() => result.current.handleSubscribe());
    const call = (subscription.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(call.variables).toEqual({});
  });

  it('resolves custom headers by iterating activeTabHeaders (covers loop body L56)', () => {
    const subMock = makeSub();
    const { result: r } = renderHook(() =>
      useSubscriptionOrchestration({
        activeTab: makeTab(),
        endpoint: 'http://localhost:4000/graphql',
        auth: null,
        activeEnvironment: null,
        activeTabHeaders: { 'X-Custom': 'val' },
        selectedOperation: undefined,
        skipTlsVerify: false,
        subscription: subMock,
      }),
    );
    act(() => r.current.handleSubscribe());
    const call = (subMock.subscribe as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect((call.headers as Record<string, string>)['X-Custom']).toBe('val');
  });

  it('does nothing when endpoint contains unresolved env vars', () => {
    const { result, subscription } = renderOrchestration({
      endpoint: 'http://{{HOST}}/graphql',
    });
    act(() => result.current.handleSubscribe());
    expect(subscription.subscribe).not.toHaveBeenCalled();
  });
});

// ─── handleStopSubscription ───────────────────────────────────────────────────

describe('handleStopSubscription', () => {
  it('calls subscription.disconnect', () => {
    const { result, subscription } = renderOrchestration();
    act(() => result.current.handleStopSubscription());
    expect(subscription.disconnect).toHaveBeenCalledOnce();
  });
});

// ─── handleExportSubscription ─────────────────────────────────────────────────

describe('handleExportSubscription', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:test-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectURL });
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
  });

  it('creates a JSON blob and triggers anchor click on export', () => {
    const messages: GraphqlSubscriptionMessage[] = [{
      id: 'm1', sessionId: 's1', index: 1, direction: 'in',
      timestampMs: 1000, offsetMs: 100, data: { value: 1 },
      transport: 'graphql-transport-ws',
    }];
    const { result } = renderOrchestration({
      sub: { messages, stats: { ...EMPTY_STATS, totalMessages: 1 }, sessionId: 's1', transport: 'graphql-transport-ws' },
    });
    const clickSpy = vi.fn();
    const mockAnchor = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
  });

  it('sanitizes the operation name in the download filename', () => {
    const { result } = renderOrchestration({
      activeTab: makeTab({ query: 'subscription Get$Orders { events { id } }' }),
    });
    let capturedFilename = '';
    const mockAnchor = {
      href: '',
      click: vi.fn(),
      get download() { return capturedFilename; },
      set download(v: string) { capturedFilename = v; },
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    // Should not contain $ or other special chars
    expect(capturedFilename).toMatch(/^graphql-subscription-[a-z0-9_-]+-\d+\.json$/);
  });

  it('uses "Subscription" when operationType is not subscription (branch L88)', () => {
    const { result } = renderOrchestration({
      activeTab: makeTab({ operationType: 'query' }),
      sub: { transport: null },
    });
    let capturedFilename = '';
    const mockAnchor = {
      href: '',
      click: vi.fn(),
      get download() { return capturedFilename; },
      set download(v: string) { capturedFilename = v; },
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    expect(capturedFilename).toContain('subscription');
  });

  it('uses "Subscription" when selectedOperation is undefined (branch L89 ?? fallback)', () => {
    const { result } = renderHook(() =>
      useSubscriptionOrchestration({
        activeTab: makeTab(),
        endpoint: 'http://localhost:4000/graphql',
        auth: null,
        activeEnvironment: null,
        activeTabHeaders: {},
        selectedOperation: undefined,
        skipTlsVerify: false,
        subscription: makeSub({ transport: null }),
      }),
    );
    let capturedFilename = '';
    const mockAnchor = {
      href: '',
      click: vi.fn(),
      get download() { return capturedFilename; },
      set download(v: string) { capturedFilename = v; },
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    // operationName falls back to 'Subscription' when selectedOperation is undefined
    expect(capturedFilename).toContain('graphql-subscription-subscription');
  });

  it('uses safeName fallback "export" when name sanitizes to empty (branch L116)', () => {
    const { result } = renderHook(() =>
      useSubscriptionOrchestration({
        activeTab: makeTab(),
        endpoint: 'http://localhost:4000/graphql',
        auth: null,
        activeEnvironment: null,
        activeTabHeaders: {},
        selectedOperation: '!!!',
        skipTlsVerify: false,
        subscription: makeSub({ transport: null }),
      }),
    );
    let capturedFilename = '';
    const mockAnchor = {
      href: '',
      click: vi.fn(),
      get download() { return capturedFilename; },
      set download(v: string) { capturedFilename = v; },
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    expect(capturedFilename).toContain('graphql-subscription-export-');
  });

  it('revokes the object URL after a delay', () => {
    vi.useFakeTimers();
    const { result } = renderOrchestration();
    const mockAnchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor as unknown as HTMLElement);
    act(() => result.current.handleExportSubscription());
    // URL not yet revoked synchronously
    expect(revokeObjectURL).not.toHaveBeenCalled();
    // Advance past the 150ms delay
    act(() => { vi.advanceTimersByTime(200); });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    vi.useRealTimers();
  });
});
