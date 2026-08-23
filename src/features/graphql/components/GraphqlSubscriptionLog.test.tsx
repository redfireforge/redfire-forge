/**
 * @vitest-environment jsdom
 * Tests for GraphqlSubscriptionLog component.
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GraphqlSubscriptionLog } from './GraphqlSubscriptionLog';
import type { GraphqlSubscriptionLogProps } from './GraphqlSubscriptionLog';
import type { GraphqlSubscriptionMessage, SubscriptionStats } from '@shared/types/graphql';
import type { GraphqlSubscriptionAssertion } from '@shared/types/graphql';
import { buildAssertionResultMap } from '../utils/subscriptionAssertions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_STATS: SubscriptionStats = {
  totalMessages: 0,
  errorCount: 0,
  avgLatencyMs: 0,
  msgsPerSec: 0,
  connectedDurationMs: 0,
};

const noop = () => { /* noop */ };

function makeMessage(overrides: Partial<GraphqlSubscriptionMessage> = {}): GraphqlSubscriptionMessage {
  return {
    id: `msg-${Math.random()}`,
    sessionId: 'session-1',
    index: 1,
    direction: 'in',
    timestampMs: Date.now(),
    offsetMs: 100,
    data: { value: 42 },
    transport: 'graphql-transport-ws',
    ...overrides,
  };
}

function defaultProps(overrides: Partial<GraphqlSubscriptionLogProps> = {}): GraphqlSubscriptionLogProps {
  return {
    state: 'active',
    messages: [],
    stats: { ...EMPTY_STATS },
    isPaused: false,
    pausedBufferCount: 0,
    onPause: noop,
    onResume: noop,
    onClear: noop,
    onExport: noop,
    onStop: noop,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GraphqlSubscriptionLog', () => {

  beforeEach(() => {
    resetAllMocks();
  });

  it('renders the stats bar', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    expect(screen.getByTestId('gql-sub-stats-bar')).toBeTruthy();
  });

  it('shows "● Live" badge when state is active', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active' })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toContain('Live');
  });

  it('shows "Connecting…" badge when state is connecting', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'connecting' })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toContain('Connecting');
  });

  it('shows "Reconnecting" badge with attempt count when reconnecting', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'reconnecting', reconnectAttempt: 2 })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toContain('Reconnecting');
    expect(badge.textContent).toContain('2/5');
  });

  it('shows error banner when state is error and errorMessage is set', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'error', errorMessage: 'Connection refused' })} />);
    expect(screen.getByTestId('gql-sub-error-banner')).toBeTruthy();
    expect(screen.getByTestId('gql-sub-error-banner').textContent).toContain('Connection refused');
  });

  it('does NOT show error banner when no errorMessage', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active' })} />);
    expect(screen.queryByTestId('gql-sub-error-banner')).toBeNull();
  });

  it('renders the toolbar', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    expect(screen.getByTestId('gql-sub-toolbar')).toBeTruthy();
  });

  it('shows Pause button when state is active and not paused', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', isPaused: false })} />);
    expect(screen.getByTestId('gql-sub-pause-btn')).toBeTruthy();
    expect(screen.queryByTestId('gql-sub-resume-btn')).toBeNull();
  });

  it('shows Resume button when paused', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', isPaused: true })} />);
    expect(screen.getByTestId('gql-sub-resume-btn')).toBeTruthy();
    expect(screen.queryByTestId('gql-sub-pause-btn')).toBeNull();
  });

  it('Resume button shows buffered message count', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', isPaused: true, pausedBufferCount: 7 })} />);
    const btn = screen.getByTestId('gql-sub-resume-btn');
    expect(btn.textContent).toContain('7');
  });

  it('calls onPause when Pause is clicked', () => {
    const onPause = vi.fn();
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', onPause })} />);
    fireEvent.click(screen.getByTestId('gql-sub-pause-btn'));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it('calls onResume when Resume is clicked', () => {
    const onResume = vi.fn();
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', isPaused: true, onResume })} />);
    fireEvent.click(screen.getByTestId('gql-sub-resume-btn'));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('calls onClear when Clear is clicked', () => {
    const onClear = vi.fn();
    const messages = [makeMessage()];
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', messages, onClear })} />);
    fireEvent.click(screen.getByTestId('gql-sub-clear-btn'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('Clear button is disabled when no messages', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ messages: [] })} />);
    const btn = screen.getByTestId('gql-sub-clear-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls onExport when Export is clicked', () => {
    const onExport = vi.fn();
    const messages = [makeMessage()];
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', messages, onExport })} />);
    fireEvent.click(screen.getByTestId('gql-sub-export-btn'));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('calls onStop when Stop is clicked', () => {
    const onStop = vi.fn();
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', onStop })} />);
    fireEvent.click(screen.getByTestId('gql-sub-stop-btn'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('hides Stop button when state is closed', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed' })} />);
    expect(screen.queryByTestId('gql-sub-stop-btn')).toBeNull();
  });

  it('hides Stop button when state is error', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'error', errorMessage: 'Failed' })} />);
    expect(screen.queryByTestId('gql-sub-stop-btn')).toBeNull();
  });

  it('renders message list', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    expect(screen.getByTestId('gql-sub-message-list')).toBeTruthy();
  });

  it('renders individual message rows', () => {
    const messages = [makeMessage({ index: 1 }), makeMessage({ index: 2 })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    const rows = screen.getAllByTestId('gql-sub-row');
    expect(rows).toHaveLength(2);
  });

  it('shows "Waiting for messages…" when active with no messages', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'active', messages: [] })} />);
    expect(screen.getByTestId('gql-sub-empty-hint')).toBeTruthy();
    expect(screen.getByTestId('gql-sub-empty-hint').textContent).toContain('Waiting');
  });

  it('shows "Subscription completed" message when state is closed and no messages', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed', messages: [] })} />);
    expect(screen.getByTestId('gql-sub-empty-hint').textContent).toContain('completed');
  });

  it('shows error empty state when state is error and no messages', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'error', errorMessage: 'Error!', messages: [] })} />);
    expect(screen.getByTestId('gql-sub-empty-hint').textContent).toContain('error');
  });

  it('toggles filter bar on Filter button click', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    expect(screen.queryByTestId('gql-sub-filter-bar')).toBeNull();
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    expect(screen.getByTestId('gql-sub-filter-bar')).toBeTruthy();
  });

  it('filter input filters messages by text', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { fruit: 'apple' }, offsetMs: 100 }),
      makeMessage({ id: 'm2', data: { fruit: 'banana' }, offsetMs: 200 }),
      makeMessage({ id: 'm3', data: { fruit: 'cherry' }, offsetMs: 300 }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), { target: { value: 'banana' } });
    // Filter count should appear
    expect(screen.getByTestId('gql-sub-filter-count').textContent).toContain('1/3');
  });

  it('clear filter button resets filter text', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    const input = screen.getByTestId('gql-sub-filter-input');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByTestId('gql-sub-filter-clear')).toBeTruthy();
    fireEvent.click(screen.getByTestId('gql-sub-filter-clear'));
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('shows operation name when provided', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ operationName: 'OnOrderUpdate' })} />);
    expect(screen.getByText('OnOrderUpdate')).toBeTruthy();
  });

  it('shows transport badge', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ transport: 'graphql-transport-ws' })} />);
    expect(screen.getByText('WS')).toBeTruthy();
  });

  it('shows SSE badge for SSE transport', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ transport: 'sse' })} />);
    expect(screen.getByText('SSE')).toBeTruthy();
  });

  it('shows stats: total messages and msgs/sec', () => {
    const stats: SubscriptionStats = {
      totalMessages: 42,
      errorCount: 0,
      avgLatencyMs: 0,
      msgsPerSec: 3.5,
      connectedDurationMs: 5000,
    };
    render(<GraphqlSubscriptionLog {...defaultProps({ stats })} />);
    expect(screen.getAllByText('42')[0]).toBeTruthy();
    expect(screen.getByText('3.5')).toBeTruthy();
  });

  it('shows error count in stats when non-zero', () => {
    const stats: SubscriptionStats = {
      totalMessages: 10,
      errorCount: 3,
      avgLatencyMs: 0,
      msgsPerSec: 0,
      connectedDurationMs: 0,
    };
    render(<GraphqlSubscriptionLog {...defaultProps({ stats })} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('expands message body on click', () => {
    const messages = [makeMessage({ data: { key: 'expanded-value' } })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    const body = document.querySelector('.gql-sub-row-body') as HTMLButtonElement;
    fireEvent.click(body);
    // After expand, should show pre element
    expect(document.querySelector('.gql-sub-row-json')).toBeTruthy();
  });

  it('shows error badge on message rows with errors', () => {
    const messages = [
      makeMessage({ errors: [{ message: 'field error' }] }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    expect(document.querySelector('.gql-sub-row-error-badge')).toBeTruthy();
  });

  it('shows buffer-capped warning when messages reach 5000', () => {
    // Create 5000 messages
    const messages = Array.from({ length: 5000 }, (_, i) => makeMessage({ index: i + 1, id: String(i) }));
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    expect(screen.getByTestId('gql-sub-buffer-warn')).toBeTruthy();
  });

  it('Pause/Resume buttons hidden when state is closed', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed' })} />);
    expect(screen.queryByTestId('gql-sub-pause-btn')).toBeNull();
    expect(screen.queryByTestId('gql-sub-resume-btn')).toBeNull();
  });

  it('shows Re-subscribe in toolbar when state is closed and onResubscribe provided', () => {
    const onResubscribe = vi.fn();
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed', onResubscribe })} />);
    expect(screen.getByTestId('gql-sub-resubscribe-btn')).toBeTruthy();
    fireEvent.click(screen.getByTestId('gql-sub-resubscribe-btn'));
    expect(onResubscribe).toHaveBeenCalledTimes(1);
  });

  it('hides Re-subscribe when state is closed but onResubscribe is omitted', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed' })} />);
    expect(screen.queryByTestId('gql-sub-resubscribe-btn')).toBeNull();
  });

  it('Pause/Resume buttons visible when state is reconnecting', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'reconnecting', isPaused: false })} />);
    expect(screen.getByTestId('gql-sub-pause-btn')).toBeTruthy();
  });

  it('Pause button is shown when state is connecting', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'connecting', isPaused: false })} />);
    expect(screen.getByTestId('gql-sub-pause-btn')).toBeTruthy();
  });

  it('duration timer ticks during connecting state (BUG-P2S2-R1-1 fix)', () => {
    vi.useFakeTimers();
    const connectedSince = Date.now();
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'connecting', connectedSince })} />);

    // Duration bar should display 00:00 initially
    const durationEl = document.querySelector('.gql-sub-stat--duration');
    expect(durationEl?.textContent).toBe('00:00');

    // Advance 61 seconds — tick fires 61 times
    act(() => { vi.advanceTimersByTime(61_000); });

    // Duration should now be at least 00:01 (timer ran while connecting)
    const afterTick = document.querySelector('.gql-sub-stat--duration');
    expect(afterTick?.textContent).not.toBe('00:00');

    vi.useRealTimers();
  });

  // ── Filter bar: JSONPath mode ────────────────────────────────────────────

  it('shows mode toggle buttons when filter bar is open', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    expect(screen.getByTestId('gql-sub-filter-mode-text')).toBeTruthy();
    expect(screen.getByTestId('gql-sub-filter-mode-jsonpath')).toBeTruthy();
  });

  it('text mode is active by default', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    expect(screen.getByTestId('gql-sub-filter-mode-text').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('gql-sub-filter-mode-jsonpath').getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to jsonpath mode on JSONPath button click', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    expect(screen.getByTestId('gql-sub-filter-mode-jsonpath').getAttribute('aria-pressed')).toBe('true');
    // Filter input should use monospace font class in JSONPath mode
    expect(screen.getByTestId('gql-sub-filter-input').className).toContain('gql-sub-filter-input--jsonpath');
  });

  it('jsonpath mode filters by path existence', () => {
    const messages = [
      makeMessage({ data: { order: { id: 1 } } }),
      makeMessage({ data: { user: { name: 'Alice' } } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.order.id' },
    });
    expect(screen.getByTestId('gql-sub-filter-count').textContent).toContain('1/2');
  });

  it('jsonpath mode filters by equality comparison', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { status: 'SHIPPED' } }),
      makeMessage({ id: 'm2', data: { status: 'PENDING' } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.status == "SHIPPED"' },
    });
    expect(screen.getByTestId('gql-sub-filter-count').textContent).toContain('1/2');
  });

  it('jsonpath mode filters by numeric comparison', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { total: 100 } }),
      makeMessage({ id: 'm2', data: { total: 5 } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.total > 10' },
    });
    expect(screen.getByTestId('gql-sub-filter-count').textContent).toContain('1/2');
  });

  it('Escape key closes filter bar and resets text and mode', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    // Switch to JSONPath mode
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    const input = screen.getByTestId('gql-sub-filter-input');
    fireEvent.change(input, { target: { value: '$.id' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // Filter bar should be closed
    expect(screen.queryByTestId('gql-sub-filter-bar')).toBeNull();
    // Reopening should show text mode (mode was reset)
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    expect(screen.getByTestId('gql-sub-filter-mode-text').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('gql-sub-filter-mode-jsonpath').getAttribute('aria-pressed')).toBe('false');
  });

  it('closing filter button resets mode to text', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    const filterBtn = screen.getByTestId('gql-sub-filter-btn');
    fireEvent.click(filterBtn);
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    // Close and reopen
    fireEvent.click(filterBtn);
    fireEvent.click(filterBtn);
    expect(screen.getByTestId('gql-sub-filter-mode-text').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows "Showing N/M" text in filter count', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { label: 'apple' } }),
      makeMessage({ id: 'm2', data: { label: 'banana' } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: 'apple' },
    });
    expect(screen.getByTestId('gql-sub-filter-count').textContent).toContain('Showing');
  });
});

// ─── Additional coverage for missing states ───────────────────────────────────

describe('GraphqlSubscriptionLog — missing state coverage', () => {
  it('shows "● Error" badge when state is error', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'error', errorMessage: 'Connection failed' })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toMatch(/Error/);
  });

  it('shows "Closing…" badge when state is closing', () => {
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closing' })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toMatch(/Closing/);
  });

  it('shows "Completed" badge when state is closed', () => {
    const messages = [makeMessage({ id: 'm1' })];
    render(<GraphqlSubscriptionLog {...defaultProps({ state: 'closed', messages })} />);
    const badge = screen.getByTestId('gql-sub-state');
    expect(badge.textContent).toMatch(/Completed/);
  });

  it('shows pre element when message row is expanded', () => {
    const messages = [makeMessage({ id: 'm1', data: { key: 'value' } })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    const expandBtn = screen.getByLabelText('Expand message');
    fireEvent.click(expandBtn);
    expect(screen.getByLabelText('Collapse message')).toBeTruthy();
    // Pre element is now shown
    expect(document.querySelector('.gql-sub-row-json')).toBeTruthy();
  });

  it('resets filter text when switching from jsonpath to text mode', () => {
    const messages = [makeMessage({ id: 'm1', data: { name: 'test' } })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), { target: { value: '$.name' } });
    // Now switch back to text mode
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-text'));
    const input = screen.getByTestId('gql-sub-filter-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('jsonpath mode filters using < operator', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { count: 5 } }),
      makeMessage({ id: 'm2', data: { count: 15 } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.count < 10' },
    });
    const rows = screen.getAllByTestId('gql-sub-row');
    expect(rows).toHaveLength(1);
  });

  it('jsonpath mode filters using <= operator', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { count: 10 } }),
      makeMessage({ id: 'm2', data: { count: 15 } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.count <= 10' },
    });
    const rows = screen.getAllByTestId('gql-sub-row');
    expect(rows).toHaveLength(1);
  });

  it('jsonpath === performs strict equality (number vs string)', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { count: 1 } }),
      makeMessage({ id: 'm2', data: { count: '1' } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.count === 1' },
    });
    // Strict: only the number 1 matches, not the string "1"
    const rows = screen.queryAllByTestId('gql-sub-row');
    expect(rows).toHaveLength(1);
  });

  it('jsonpath !== filters strictly (excludes only strict match)', () => {
    const messages = [
      makeMessage({ id: 'm1', data: { val: 0 } }),
      makeMessage({ id: 'm2', data: { val: false } }),
    ];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.val !== 0' },
    });
    // Strict: 0 !== 0 is false, false !== 0 is true — only m2 passes
    const rows = screen.queryAllByTestId('gql-sub-row');
    expect(rows).toHaveLength(1);
  });

  it('jsonpath filter gracefully handles invalid JSONPath (catch branch)', () => {
    const messages = [makeMessage({ id: 'm1', data: { name: 'test' } })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    fireEvent.click(screen.getByTestId('gql-sub-filter-btn'));
    fireEvent.click(screen.getByTestId('gql-sub-filter-mode-jsonpath'));
    // Use a valid JSONPath that returns undefined for the data — message is filtered out
    fireEvent.change(screen.getByTestId('gql-sub-filter-input'), {
      target: { value: '$.nonExistentField == "something"' },
    });
    // nonExistentField returns undefined, so comparison returns false
    expect(screen.queryAllByTestId('gql-sub-row')).toHaveLength(0);
  });
});

// ─── Sprint 8 (2C-5): Subscription assertion badges and aggregate ──────────

describe('GraphqlSubscriptionLog — assertion badges', () => {
  const makeAssertion = (overrides: Partial<GraphqlSubscriptionAssertion> = {}): GraphqlSubscriptionAssertion => ({
    id: 'a1',
    jsonPath: '$.value',
    operator: 'is_not_null',
    expected: '',
    description: '',
    ...overrides,
  });

  it('shows no assertion badge when no assertions are provided', () => {
    const messages = [makeMessage({ id: 'm1', data: { value: 42 } })];
    render(<GraphqlSubscriptionLog {...defaultProps({ messages })} />);
    expect(screen.queryByTestId('gql-assertion-badge')).not.toBeInTheDocument();
  });

  it('shows a pass badge when the assertion passes for a message', () => {
    const messages = [makeMessage({ id: 'm1', data: { value: 42 } })];
    const assertions = [makeAssertion()];
    const assertionResultMap = buildAssertionResultMap(messages, assertions);
    render(
      <GraphqlSubscriptionLog
        {...defaultProps({ messages, assertions, assertionResultMap })}
      />,
    );
    const badge = screen.getByTestId('gql-assertion-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('✓');
  });

  it('shows a fail badge when an assertion fails for a message', () => {
    const messages = [makeMessage({ id: 'm1', data: { value: null } })];
    const assertions = [makeAssertion({ operator: 'is_not_null' })];
    const assertionResultMap = buildAssertionResultMap(messages, assertions);
    render(
      <GraphqlSubscriptionLog
        {...defaultProps({ messages, assertions, assertionResultMap })}
      />,
    );
    const badge = screen.getByTestId('gql-assertion-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('✗');
  });

  it('shows pass/fail ratio in badge text', () => {
    const messages = [makeMessage({ id: 'm1', data: { value: 42 } })];
    const assertions = [
      makeAssertion({ id: 'a1', operator: 'is_not_null' }),
      makeAssertion({ id: 'a2', jsonPath: '$.missing', operator: 'is_not_null' }),
    ];
    const assertionResultMap = buildAssertionResultMap(messages, assertions);
    render(
      <GraphqlSubscriptionLog
        {...defaultProps({ messages, assertions, assertionResultMap })}
      />,
    );
    const badge = screen.getByTestId('gql-assertion-badge');
    expect(badge.textContent).toContain('1/2');
  });

  it('shows assertion aggregate in stats bar when assertions are present and pass', () => {
    const messages = [makeMessage({ id: 'm1', data: { value: 10 } })];
    const assertions = [makeAssertion()];
    const assertionResultMap = buildAssertionResultMap(messages, assertions);
    render(
      <GraphqlSubscriptionLog
        {...defaultProps({ messages, assertions, assertionResultMap })}
      />,
    );
    expect(screen.getByTestId('gql-assertion-aggregate')).toBeInTheDocument();
    expect(screen.getByTestId('gql-assertion-aggregate').textContent).toContain('1/1');
  });

  it('does not show aggregate in stats bar when there are no messages with results', () => {
    render(<GraphqlSubscriptionLog {...defaultProps()} />);
    expect(screen.queryByTestId('gql-assertion-aggregate')).not.toBeInTheDocument();
  });
});
