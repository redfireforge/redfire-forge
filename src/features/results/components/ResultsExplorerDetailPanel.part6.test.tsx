/**
 * @vitest-environment jsdom
 *
 * Part 6: Coverage for DetailOverviewTab.tsx wsDetails, wsTriggerDetails,
 * kafkaDetails, and timing-split branches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResultsExplorerDetailPanel from './ResultsExplorerDetailPanel';
import type { ExecutionEvent, WorkflowIterationTrace } from '@shared/types';

describe('ResultsExplorerDetailPanel — part6 (DetailOverviewTab wsDetails)', () => {
  const noop = vi.fn();

  afterEach(() => {
    cleanup();
    resetAllMocks();
  });

  function makeIteration(event: ExecutionEvent): WorkflowIterationTrace {
    return {
      index: 0,
      passed: event.state === 'pass',
      durationMs: event.durationMs ?? 100,
      traversedEdges: [],
      events: [event],
    };
  }

  function renderWithEvent(event: ExecutionEvent) {
    const iterations = [makeIteration(event)];
    render(
      <ResultsExplorerDetailPanel
        nodeId={event.nodeId}
        nodeType={event.nodeType as string}
        nodeLabel={event.nodeLabel}
        events={[event]}
        iterations={iterations}
        selectedIteration={0}
        onIterationChange={noop}
        onClose={noop}
        fullTraceCaptured
        forkJoinTopology={undefined}
        onDrillDown={noop}
        onOpenMapper={noop}
      />,
    );
  }

  // ── wsConnect with all optional fields ──────────────────────────────────────

  it('renders wsConnect CONNECT badge and URL (lines 153/154 true branches)', () => {
    renderWithEvent({
      nodeId: 'ws-1',
      nodeType: 'wsConnect',
      nodeLabel: 'Connect',
      timestamp: 1000,
      state: 'pass',
      durationMs: 50,
      details: {
        wsDetails: {
          url: 'ws://localhost:9876/chat',
          connectionId: 'conn-abc',
          protocol: 'chat',
          extensions: 'permessage-deflate',
          messageType: 'text',
          bodyPreview: '{"type":"connect"}',
          durationMs: 50,
          failureClass: undefined,
        },
      },
    });
    expect(screen.getByText('CONNECT')).toBeInTheDocument();
    expect(screen.getByText('ws://localhost:9876/chat')).toBeInTheDocument();
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(screen.getByText('permessage-deflate')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('{"type":"connect"}')).toBeInTheDocument();
  });

  it('renders wsSend SEND badge (line 154 wsSend branch)', () => {
    renderWithEvent({
      nodeId: 'ws-2',
      nodeType: 'wsSend',
      nodeLabel: 'Send',
      timestamp: 1000,
      state: 'pass',
      durationMs: 10,
      details: {
        wsDetails: {
          connectionId: 'conn-abc',
          messageType: 'json',
          bodyPreview: '{"action":"ping"}',
        },
      },
    });
    expect(screen.getByText('SEND')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();
  });

  it('renders wsReceive RECEIVE badge for non-wsConnect/wsSend type (line 154 else branch)', () => {
    renderWithEvent({
      nodeId: 'ws-3',
      nodeType: 'wsReceive',
      nodeLabel: 'Receive',
      timestamp: 1000,
      state: 'fail',
      durationMs: 200,
      details: {
        wsDetails: {
          connectionId: 'conn-xyz',
          durationMs: 200,
          failureClass: 'recv_timeout',
        },
        error: 'Receive timed out',
      },
    });
    expect(screen.getByText('RECEIVE')).toBeInTheDocument();
    expect(screen.getByText('Failure: recv_timeout')).toBeInTheDocument();
    expect(screen.getByText('Receive timed out')).toBeInTheDocument();
  });

  it('renders error badge on wsConnect fail state (line 153 false branch = error class)', () => {
    renderWithEvent({
      nodeId: 'ws-4',
      nodeType: 'wsConnect',
      nodeLabel: 'Connect',
      timestamp: 1000,
      state: 'fail',
      details: {
        wsDetails: {
          connectionId: 'conn-err',
          failureClass: 'CONN_REFUSED',
        },
      },
    });
    const badge = screen.getByText('CONNECT').closest('span');
    expect(badge?.className).toContain('error');
    expect(screen.getByText(/CONN_REFUSED/)).toBeInTheDocument();
  });

  it('wsDetails with no optional fields renders only connection ID (lines 157/166/172/178/185 false branches)', () => {
    renderWithEvent({
      nodeId: 'ws-5',
      nodeType: 'wsConnect',
      nodeLabel: 'Connect',
      timestamp: 1000,
      state: 'pass',
      details: {
        wsDetails: {
          connectionId: 'conn-minimal',
        },
      },
    });
    expect(screen.getByText('conn-minimal')).toBeInTheDocument();
    // Optional fields should not appear
    expect(screen.queryByText('Protocol')).not.toBeInTheDocument();
    expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
    expect(screen.queryByText('Message Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Message')).not.toBeInTheDocument();
  });

  // ── wsTriggerDetails ─────────────────────────────────────────────────────────

  it('renders wsTriggerDetails with messageType (lines 218-246)', () => {
    renderWithEvent({
      nodeId: 'wst-1',
      nodeType: 'wsTrigger',
      nodeLabel: 'WSTriggerNode',
      timestamp: 1000,
      state: 'pass',
      details: {
        wsTriggerDetails: {
          url: 'ws://localhost:9876',
          connectionId: 'conn-trig',
          messageType: 'binary',
        },
      },
    });
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('ws://localhost:9876')).toBeInTheDocument();
    expect(screen.getByText('binary')).toBeInTheDocument();
  });

  it('renders wsTriggerDetails with error (line 240 true branch)', () => {
    renderWithEvent({
      nodeId: 'wst-2',
      nodeType: 'wsTrigger',
      nodeLabel: 'WS Trigger',
      timestamp: 1000,
      state: 'fail',
      details: {
        wsTriggerDetails: {
          url: 'ws://srv',
          connectionId: 'c1',
        },
        error: 'Pattern not matched',
      },
    });
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Pattern not matched')).toBeInTheDocument();
  });

  it('renders wsTriggerDetails without messageType (line 233 false branch)', () => {
    renderWithEvent({
      nodeId: 'wst-3',
      nodeType: 'wsTrigger',
      nodeLabel: 'WS Trigger',
      timestamp: 1000,
      state: 'pass',
      details: {
        wsTriggerDetails: {
          url: 'ws://srv',
          connectionId: 'c2',
        },
      },
    });
    expect(screen.queryByText('Message Type')).not.toBeInTheDocument();
  });

  // ── kafkaDetails ─────────────────────────────────────────────────────────────

  it('renders kafkaProduce with partition and duration (lines 249-275)', () => {
    renderWithEvent({
      nodeId: 'kp-1',
      nodeType: 'kafkaProduce',
      nodeLabel: 'Kafka Produce',
      timestamp: 1000,
      state: 'pass',
      durationMs: 80,
      details: {
        kafkaDetails: {
          topic: 'orders.events',
          partition: 3,
          durationMs: 80,
        },
      },
    });
    expect(screen.getByText('PRODUCE')).toBeInTheDocument();
    expect(screen.getByText('orders.events')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders kafkaConsume badge (kafkaDetails with nodeType != kafkaProduce)', () => {
    renderWithEvent({
      nodeId: 'kc-1',
      nodeType: 'kafkaConsume',
      nodeLabel: 'Kafka Consume',
      timestamp: 1000,
      state: 'pass',
      details: {
        kafkaDetails: { topic: 'my.topic' },
      },
    });
    expect(screen.getByText('CONSUME')).toBeInTheDocument();
  });

  it('kafkaDetails without partition/duration omits those rows (lines 261/267 false branches)', () => {
    renderWithEvent({
      nodeId: 'kp-2',
      nodeType: 'kafkaProduce',
      nodeLabel: 'Kafka Produce',
      timestamp: 1000,
      state: 'pass',
      details: {
        kafkaDetails: { topic: 'minimal-topic' },
      },
    });
    expect(screen.getByText('minimal-topic')).toBeInTheDocument();
    expect(screen.queryByText('Partition')).not.toBeInTheDocument();
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  // ── CorrelationWait timing split with avgWaitDuration ───────────────────────
  // avgWaitDuration is set when events have details.waitDurationMs

  it('renders timing split when event has waitDurationMs (lines 110-130)', () => {
    const event: ExecutionEvent = {
      nodeId: 'corr-1',
      nodeType: 'correlationWait',
      nodeLabel: 'Correlation Wait',
      timestamp: 1000,
      state: 'pass',
      durationMs: 500,
      details: {
        waitDurationMs: 200,
        statusCode: 200,
        method: 'GET',
        url: '/api/wait',
        responseTimeMs: 500,
      },
    };
    const event2: ExecutionEvent = {
      ...event,
      nodeId: 'corr-1',
      timestamp: 2000,
      details: {
        waitDurationMs: 300,
        statusCode: 200,
        method: 'GET',
        url: '/api/wait',
        responseTimeMs: 400,
      },
    };
    const iter1 = makeIteration(event);
    const iter2 = makeIteration(event2);
    render(
      <ResultsExplorerDetailPanel
        nodeId="corr-1"
        nodeType="correlationWait"
        nodeLabel="Correlation Wait"
        events={[event, event2]}
        iterations={[iter1, iter2]}
        selectedIteration={undefined}
        onIterationChange={noop}
        onClose={noop}
        fullTraceCaptured
        forkJoinTopology={undefined}
        onDrillDown={noop}
        onOpenMapper={noop}
      />,
    );
    expect(screen.getByText('Timing Breakdown')).toBeInTheDocument();
    expect(screen.getByText(/Wait for Event/)).toBeInTheDocument();
    expect(screen.getByText(/Processing/)).toBeInTheDocument();
  });
});
