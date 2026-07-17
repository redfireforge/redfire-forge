/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GqlTabExecutionLayer } from './GqlTabExecutionLayer';
import { stampAuthHeaders } from '../utils/authUtils';

const mockExecute = vi.fn();
const mockCancel = vi.fn();
const mockResolveDedupChoice = vi.fn();

vi.mock('../utils/authUtils', () => ({
  stampAuthHeaders: vi.fn((headers: Record<string, string> | undefined, auth: { type: string; token?: string } | null) => ({
    ...(headers ?? {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  })),
}));

const mockApplyResult = vi.fn();

vi.mock('../hooks/useGraphqlExecution', () => ({
  useGraphqlExecution: () => ({
    status: 'loading' as const,
    response: { data: { ok: true }, latencyMs: 1, timestamp: 1, httpStatus: 200 },
    apqInfo: { hash: 'abc', cacheHit: false, unsupported: false },
    isDuplicate: false,
    duplicateSourceTabId: null,
    execute: mockExecute,
    cancel: mockCancel,
    resolveDedupChoice: mockResolveDedupChoice,
    applyResult: mockApplyResult,
  }),
}));

describe('GqlTabExecutionLayer', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('registers handle with tab attribution on mount (layout effect)', () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();
    const onExecutionCompleted = vi.fn();

    render(
      <GqlTabExecutionLayer
        tabId="tab-42"
        onExecutionCompleted={onExecutionCompleted}
        onRegister={onRegister}
        onUnregister={onUnregister}
      />,
    );

    expect(onRegister).toHaveBeenCalledWith(
      'tab-42',
      expect.objectContaining({
        execute: expect.any(Function),
        cancel: mockCancel,
        resolveDedupChoice: mockResolveDedupChoice,
        applyResult: mockApplyResult,
        getState: expect.any(Function),
      }),
    );

    const handle = onRegister.mock.calls[0]![1];
    handle.execute({ endpoint: 'https://api.example.com/graphql', query: '{ hello }' });
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sourceTabId: 'tab-42',
      onExecutionCompleted,
    }));
  });

  it('Phase 6F: preserves already-resolved auth headers on execute', () => {
    const onRegister = vi.fn();

    render(
      <GqlTabExecutionLayer
        tabId="tab-42"
        resolvedAuth={{ type: 'bearer', token: 'profile-token' }}
        onRegister={onRegister}
        onUnregister={vi.fn()}
      />,
    );

    const handle = onRegister.mock.calls[0]![1];
    handle.execute({
      endpoint: 'https://api.example.com/graphql',
      query: '{ hello }',
      headers: { Authorization: 'Bearer resolved-from-env' },
    });

    expect(stampAuthHeaders).toHaveBeenCalledWith(
      {},
      { type: 'bearer', token: 'profile-token' },
      [],
    );
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer resolved-from-env' }),
      authSentStamp: expect.objectContaining({
        source: 'page',
        storedAuth: { type: 'bearer', token: 'profile-token' },
      }),
    }));
  });

  it('Phase 6H: forwards authSentSource to execute params', () => {
    const onRegister = vi.fn();

    render(
      <GqlTabExecutionLayer
        tabId="tab-42"
        resolvedAuth={{ type: 'bearer', token: 'tab-token' }}
        authSentSource="tab"
        onRegister={onRegister}
        onUnregister={vi.fn()}
      />,
    );

    const handle = onRegister.mock.calls[0]![1];
    handle.execute({
      endpoint: 'https://api.example.com/graphql',
      query: '{ hello }',
      headers: {},
    });

    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer tab-token' }),
      authSentStamp: expect.objectContaining({
        source: 'tab',
        storedAuth: { type: 'bearer', token: 'tab-token' },
      }),
    }));
  });

  it('unregisters on unmount', () => {
    const onRegister = vi.fn();
    const onUnregister = vi.fn();

    const { unmount } = render(
      <GqlTabExecutionLayer
        tabId="tab-1"
        onRegister={onRegister}
        onUnregister={onUnregister}
      />,
    );

    unmount();
    expect(onUnregister).toHaveBeenCalledWith('tab-1');
  });

  it('getState reads live hook state via ref', () => {
    const onRegister = vi.fn();

    render(
      <GqlTabExecutionLayer
        tabId="tab-1"
        onRegister={onRegister}
        onUnregister={vi.fn()}
      />,
    );

    const handle = onRegister.mock.calls[0]![1];
    expect(handle.getState().status).toBe('loading');
    expect(handle.getState().apqInfo?.hash).toBe('abc');
  });

  it('notifies state change on mount and when execution state updates', () => {
    const onStateChange = vi.fn();

    render(
      <GqlTabExecutionLayer
        tabId="tab-1"
        onRegister={vi.fn()}
        onUnregister={vi.fn()}
        onStateChange={onStateChange}
      />,
    );

    expect(onStateChange).toHaveBeenCalledWith('tab-1');
  });
});
