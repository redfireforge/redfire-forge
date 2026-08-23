/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import OverviewTab, { type OverviewTabProps } from './DetailOverviewTab';
import type { ExecutionEvent } from '@shared/types';

vi.mock('../../../shared/components/JsonTreeViewer', () => ({
  default: ({ data }: { data: unknown }) => (
    <div data-testid="json-tree">{JSON.stringify(data)}</div>
  ),
}));

const computeHistogramBinsMock = vi.fn();
vi.mock('../utils/responseTimeHistogram', () => ({
  computeHistogramBins: (...args: unknown[]) => computeHistogramBinsMock(...args),
}));

function baseStats(overrides: Partial<NonNullable<OverviewTabProps['stats']>> = {}) {
  return {
    totalExecutions: 4,
    passCount: 3,
    failCount: 1,
    passRate: 75,
    avgDuration: 100,
    minDuration: 50,
    maxDuration: 200,
    p95Duration: 180,
    durations: [50, 80, 120, 200],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<ExecutionEvent> = {}): ExecutionEvent {
  return {
    nodeId: 'n1',
    nodeType: 'http',
    nodeLabel: 'HTTP',
    timestamp: 1,
    state: 'pass',
    durationMs: 100,
    details: { statusCode: 200, method: 'GET', url: '/api' },
    ...overrides,
  };
}

describe('DetailOverviewTab coverage gaps', () => {
  const onIterationClick = vi.fn();

  afterEach(() => {
    cleanup();
    resetAllMocks();
    computeHistogramBinsMock.mockReset();
    computeHistogramBinsMock.mockImplementation((durations: number[]) => {
      if (durations.length === 0) return [];
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      return [
        { min, max: min + (max - min) / 2, count: 2, percent: 50 },
        { min: min + (max - min) / 2, max, count: durations.length - 2, percent: 50 },
      ];
    });
  });

  it('shows empty state when stats is null', () => {
    render(
      <OverviewTab
        events={[]}
        stats={null}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('No execution data available')).toBeInTheDocument();
  });

  it('colors pass rate green at 100%, red at 0%, amber otherwise', () => {
    const { rerender } = render(
      <OverviewTab
        events={[makeEvent({ state: 'pass' })]}
        stats={baseStats({ passRate: 100, passCount: 1, failCount: 0, totalExecutions: 1 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('100%').style.color).toBe('rgb(34, 197, 94)');

    rerender(
      <OverviewTab
        events={[makeEvent({ state: 'fail' })]}
        stats={baseStats({ passRate: 0, passCount: 0, failCount: 1, totalExecutions: 1 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('0%').style.color).toBe('rgb(239, 68, 68)');

    rerender(
      <OverviewTab
        events={[makeEvent(), makeEvent({ state: 'fail' })]}
        stats={baseStats({ passRate: 50 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('50%').style.color).toBe('rgb(245, 158, 11)');
  });

  it('renders status bar segments and legend for pass/fail counts', () => {
    const { container, rerender } = render(
      <OverviewTab
        events={[makeEvent(), makeEvent({ state: 'fail' })]}
        stats={baseStats({ passCount: 3, failCount: 0, totalExecutions: 3 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(container.querySelector('.status-segment.pass')).toBeTruthy();
    expect(container.querySelector('.status-segment.fail')).toBeNull();
    expect(screen.getByText(/✓ 3/)).toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent({ state: 'fail' })]}
        stats={baseStats({ passCount: 0, failCount: 2, totalExecutions: 2, passRate: 0 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(container.querySelector('.status-segment.fail')).toBeTruthy();
    expect(screen.getByText(/✗ 2/)).toBeInTheDocument();
  });

  it('shows timing stats only when avgDuration is set and totalExecutions > 1', () => {
    const { rerender } = render(
      <OverviewTab
        events={[makeEvent()]}
        stats={baseStats({ totalExecutions: 1, avgDuration: 100 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.queryByText('Min')).not.toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent(), makeEvent({ durationMs: 200 })]}
        stats={baseStats({ totalExecutions: 2, avgDuration: 150 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getAllByText('P95').length).toBeGreaterThan(0);
  });

  it('renders mini histogram in aggregate view with 3+ durations', () => {
    computeHistogramBinsMock.mockReturnValue([
      { min: 50, max: 100, count: 2, percent: 50 },
      { min: 100, max: 200, count: 2, percent: 50 },
    ]);
    const events = [50, 80, 120, 200].map((durationMs, i) =>
      makeEvent({ durationMs, state: i === 3 ? 'fail' : 'pass' }),
    );
    const { container } = render(
      <OverviewTab
        events={events}
        stats={baseStats()}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByTestId('mini-histogram')).toBeInTheDocument();
    expect(container.querySelector('.mini-histogram-bar-fail')).toBeTruthy();
    expect(container.querySelector('.fail-legend')).toBeTruthy();
  });

  it('hides histogram when selectedIteration is set or durations < 3', () => {
    const events = [makeEvent(), makeEvent({ durationMs: 80 })];
    const { rerender } = render(
      <OverviewTab
        events={events}
        stats={baseStats({ durations: [100, 80], totalExecutions: 2 })}
        currentEvent={null}
        selectedIteration={0}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.queryByTestId('mini-histogram')).not.toBeInTheDocument();

    rerender(
      <OverviewTab
        events={events}
        stats={baseStats({ durations: [100, 80], totalExecutions: 2 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.queryByTestId('mini-histogram')).not.toBeInTheDocument();
  });

  it('returns null histogram when bins are empty', () => {
    computeHistogramBinsMock.mockReturnValue([]);
    render(
      <OverviewTab
        events={[makeEvent(), makeEvent({ durationMs: 80 }), makeEvent({ durationMs: 90 })]}
        stats={baseStats({ durations: [100, 80, 90] })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.queryByTestId('mini-histogram')).not.toBeInTheDocument();
  });

  it('renders timing split when avgWaitDuration is defined', () => {
    render(
      <OverviewTab
        events={[makeEvent(), makeEvent({ details: { waitDurationMs: 300 } })]}
        stats={baseStats({ avgWaitDuration: 250, avgDuration: 500 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Timing Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Wait for Event/)).toBeInTheDocument();
    expect(screen.getByText(/Processing/)).toBeInTheDocument();
  });

  it('renders webhook input with endpoint and payload', () => {
    render(
      <OverviewTab
        events={[makeEvent()]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          details: {
            webhookInput: { method: 'POST', path: '/hook', payload: { id: 1 } },
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Webhook Input')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/hook')).toBeInTheDocument();
    expect(screen.getByTestId('json-tree')).toBeInTheDocument();
  });

  it('renders webhook input without method/path when absent', () => {
    render(
      <OverviewTab
        events={[makeEvent()]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          details: { webhookInput: { payload: { only: true } } },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Webhook Input')).toBeInTheDocument();
    expect(screen.queryByText('POST')).not.toBeInTheDocument();
  });

  it('renders wsDetails for connect/send/receive node types', () => {
    const { rerender } = render(
      <OverviewTab
        events={[makeEvent({ nodeType: 'wsConnect' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100, maxDuration: 100 })}
        currentEvent={makeEvent({
          nodeType: 'wsConnect',
          state: 'pass',
          details: {
            wsDetails: {
              url: 'ws://localhost',
              connectionId: 'c1',
              protocol: 'chat',
              extensions: 'permessage-deflate',
              messageType: 'text',
              bodyPreview: 'hello',
              durationMs: 50,
            },
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('CONNECT')).toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent({ nodeType: 'wsSend' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100, maxDuration: 100 })}
        currentEvent={makeEvent({
          nodeType: 'wsSend',
          details: { wsDetails: { connectionId: 'c1', bodyPreview: 'ping' } },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('SEND')).toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent({ nodeType: 'wsReceive', state: 'fail' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 0, failCount: 1, passRate: 0, maxDuration: 100 })}
        currentEvent={makeEvent({
          nodeType: 'wsReceive',
          state: 'fail',
          details: {
            wsDetails: { connectionId: 'c1', durationMs: 80, failureClass: 'timeout' },
            error: 'Timed out',
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('RECEIVE')).toBeInTheDocument();
    expect(screen.getByText('Failure: timeout')).toBeInTheDocument();
    expect(screen.getByText('Timed out')).toBeInTheDocument();
  });

  it('renders wsTriggerDetails matched and failed states', () => {
    const { rerender } = render(
      <OverviewTab
        events={[makeEvent({ nodeType: 'wsTrigger' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          nodeType: 'wsTrigger',
          state: 'pass',
          details: {
            wsTriggerDetails: { url: 'ws://t', connectionId: 'c1', messageType: 'json' },
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent({ nodeType: 'wsTrigger', state: 'fail' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 0, failCount: 1, passRate: 0 })}
        currentEvent={makeEvent({
          nodeType: 'wsTrigger',
          state: 'fail',
          details: {
            wsTriggerDetails: { url: 'ws://t', connectionId: 'c1' },
            error: 'No match',
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('renders kafka produce and consume details', () => {
    const { rerender } = render(
      <OverviewTab
        events={[makeEvent({ nodeType: 'kafkaProduce' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          nodeType: 'kafkaProduce',
          details: { kafkaDetails: { topic: 'orders', partition: 2, durationMs: 40 } },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('PRODUCE')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    rerender(
      <OverviewTab
        events={[makeEvent({ nodeType: 'kafkaConsume' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          nodeType: 'kafkaConsume',
          details: { kafkaDetails: { topic: 'events' } },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('CONSUME')).toBeInTheDocument();
  });

  it('renders last execution card for generic http events', () => {
    render(
      <OverviewTab
        events={[makeEvent({ state: 'fail' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 0, failCount: 1, passRate: 0, maxDuration: 200 })}
        currentEvent={makeEvent({
          state: 'fail',
          durationMs: 150,
          details: {
            statusCode: 500,
            method: 'POST',
            url: '/api/x',
            error: 'Server error',
            responseTimeMs: 150,
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Last Execution')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('renders per-iteration breakdown and handles row clicks', () => {
    const events = [
      makeEvent({ state: 'pass', durationMs: 100 }),
      makeEvent({ state: 'fail', durationMs: 80 }),
      makeEvent({ state: 'skipped' as 'pass', durationMs: 0 }),
    ];
    render(
      <OverviewTab
        events={events}
        stats={baseStats({ totalExecutions: 3, passCount: 1, failCount: 1, passRate: 33.33, durations: [100, 80, 0] })}
        currentEvent={events[0]}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByText('Per-Iteration Breakdown')).toBeInTheDocument();
    fireEvent.click(screen.getByText('#2'));
    expect(onIterationClick).toHaveBeenCalledWith(1);
  });

  it('omits avg/p95 markers when outside chart range', () => {
    computeHistogramBinsMock.mockReturnValue([
      { min: 1000, max: 2000, count: 3, percent: 100 },
    ]);
    const { container } = render(
      <OverviewTab
        events={[makeEvent(), makeEvent({ durationMs: 80 }), makeEvent({ durationMs: 90 })]}
        stats={baseStats({
          durations: [50, 80, 90],
          avgDuration: 10,
          p95Duration: 5000,
        })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByTestId('mini-histogram')).toBeInTheDocument();
    expect(container.querySelector('.mini-histogram-marker.avg')).toBeNull();
    expect(container.querySelector('.mini-histogram-marker.p95')).toBeNull();
  });

  it('counts fail durations in the last histogram bin inclusive upper bound', () => {
    computeHistogramBinsMock.mockReturnValue([
      { min: 50, max: 100, count: 1, percent: 50 },
      { min: 100, max: 100, count: 1, percent: 50 },
    ]);
    const events = [
      makeEvent({ durationMs: 100, state: 'pass' }),
      makeEvent({ durationMs: 100, state: 'fail' }),
      makeEvent({ durationMs: 80, state: 'pass' }),
    ];
    const { container } = render(
      <OverviewTab
        events={events}
        stats={baseStats({ durations: [100, 100, 80], totalExecutions: 3, passCount: 2, failCount: 1, passRate: 66.67 })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(container.querySelector('.mini-histogram-bar-fail')).toBeTruthy();
  });

  it('renders api mock details with optional metadata fields', () => {
    render(
      <OverviewTab
        events={[makeEvent({ nodeType: 'apiMockStart' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          nodeType: 'apiMockStart',
          state: 'pass',
          details: {
            apiMockDetails: {
              transport: 'apiMockStart',
              serverId: 'mock-1',
              port: 4010,
              generation: 3,
              durationMs: 42,
              expected: '>= 1 call',
              actual: '2 calls',
              transactionIds: ['tx-1', 'tx-2'],
              nearMisses: ['GET /pets', 'POST /pets', 'PUT /pets', 'DELETE /pets', 'PATCH /pets', 'HEAD /pets'],
            },
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.getByTestId('exec-apimock-details')).toBeInTheDocument();
    expect(screen.getByText('START')).toBeInTheDocument();
    expect(screen.getByText('mock-1')).toBeInTheDocument();
    expect(screen.getByText('4010')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('>= 1 call')).toBeInTheDocument();
    expect(screen.getByText('2 calls')).toBeInTheDocument();
    expect(screen.getByText('tx-1, tx-2')).toBeInTheDocument();
    expect(screen.getByText(/GET \/pets/)).toBeInTheDocument();
  });

  it('shows avg and p95 histogram markers when within range and omits fail overlay when all pass', () => {
    computeHistogramBinsMock.mockReturnValue([
      { min: 50, max: 150, count: 4, percent: 100 },
    ]);
    const events = [50, 80, 120, 140].map((durationMs) => makeEvent({ durationMs, state: 'pass' }));
    const { container } = render(
      <OverviewTab
        events={events}
        stats={baseStats({
          durations: [50, 80, 120, 140],
          avgDuration: 100,
          p95Duration: 130,
        })}
        currentEvent={null}
        onIterationClick={onIterationClick}
      />,
    );
    expect(container.querySelector('.mini-histogram-marker.avg')).toBeTruthy();
    expect(container.querySelector('.mini-histogram-marker.p95')).toBeTruthy();
    expect(container.querySelector('.mini-histogram-bar-fail')).toBeNull();
    expect(container.querySelector('.fail-legend')).toBeNull();
  });

  it('uses responseTimeMs for generic execution timing when durationMs is absent', () => {
    const { container } = render(
      <OverviewTab
        events={[makeEvent()]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100, maxDuration: 300 })}
        currentEvent={makeEvent({
          durationMs: undefined,
          details: {
            statusCode: 200,
            method: 'GET',
            url: '/health',
            responseTimeMs: 120,
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(container.querySelector('.exec-timing-bar-fill')).toBeTruthy();
    expect(container.querySelector('.exec-timing-bar-fill.error')).toBeNull();
  });

  it('skips generic execution card when kafka trigger details are present', () => {
    render(
      <OverviewTab
        events={[makeEvent({ nodeType: 'kafkaTrigger' })]}
        stats={baseStats({ totalExecutions: 1, passCount: 1, failCount: 0, passRate: 100 })}
        currentEvent={makeEvent({
          nodeType: 'kafkaTrigger',
          details: {
            kafkaTriggerDetails: { topic: 'orders' },
            statusCode: 200,
            method: 'GET',
            url: '/ignored',
          },
        })}
        onIterationClick={onIterationClick}
      />,
    );
    expect(screen.queryByText('Last Execution')).not.toBeInTheDocument();
  });
});
