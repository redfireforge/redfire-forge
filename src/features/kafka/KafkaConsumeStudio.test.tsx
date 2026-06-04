/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KafkaConsumeStudio } from './KafkaConsumeStudio';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { KafkaConsumeDraft, KafkaConsumeResultRow } from './types';

function baseConsumeDraft(): KafkaConsumeDraft {
  return {
    topic: 'orders.events', groupId: 'redfireforge-debug-abcdef12',
    startPosition: 'latest', timeoutMs: '10000', maxMessages: '50',
    keyEquals: '', headerMatch: '', jsonPath: '', jsonPathEquals: '',
  };
}

function makeStudio(overrides?: Partial<UseKafkaMessageStudioReturn>): UseKafkaMessageStudioReturn {
  return {
    publishDraft: {
      topic: '', key: '', partition: '', acks: -1,
      timeoutMs: '', headers: [], body: '',
    },
    setPublishDraft: vi.fn(),
    publishLoading: false,
    publishResult: null,
    publishError: null,
    sendOnce: vi.fn().mockResolvedValue(undefined),
    validateJsonBody: vi.fn().mockReturnValue(true),
    consumeDraft: baseConsumeDraft(),
    setConsumeDraft: vi.fn(),
    consumeLoading: false,
    consumeResult: null,
    consumeTimedOut: false,
    consumeError: null,
    selectedMessageIndex: null,
    selectedMessage: null,
    selectMessage: vi.fn(),
    consumeOnce: vi.fn().mockResolvedValue(undefined),
    clearPublishResult: vi.fn(),
    clearConsumeResult: vi.fn(),
    consumeMessageCount: 0,
    ...overrides,
  } as UseKafkaMessageStudioReturn;
}

const SAMPLE_MESSAGES: KafkaConsumeResultRow[] = [
  { topic: 'orders.events', partition: 0, offset: '10', value: '{"id":1}', key: 'order-1' },
  { topic: 'orders.events', partition: 1, offset: '3', value: '{"id":2}', key: undefined },
];

describe('KafkaConsumeStudio', () => {
  it('renders topic input', () => {
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" />);
    const input = screen.getByLabelText('Topic') as HTMLInputElement;
    expect(input.value).toBe('orders.events');
  });

  it('Consume Once button is enabled when topic is set', () => {
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" />);
    const btn = screen.getByTestId('con-consume-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Consume Once button disabled when topic is empty', () => {
    render(<KafkaConsumeStudio studio={makeStudio({ consumeDraft: { ...baseConsumeDraft(), topic: '' } })} clusterId="c" />);
    expect((screen.getByTestId('con-consume-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Consume Once shows "Consuming…" while loading', () => {
    render(<KafkaConsumeStudio studio={makeStudio({ consumeLoading: true })} clusterId="c" />);
    expect(screen.getByTestId('con-consume-btn').textContent).toBe('Consuming…');
  });

  it('calls consumeOnce when button clicked', () => {
    const studio = makeStudio();
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByTestId('con-consume-btn'));
    expect(studio.consumeOnce).toHaveBeenCalledOnce();
  });

  it('shows error message', () => {
    const studio = makeStudio({
      consumeError: { kind: 'server', code: 'ERR', message: 'broker error', retryable: true },
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    expect(screen.getByTestId('con-error').textContent).toContain('broker error');
  });

  it('shows results zone with message rows', () => {
    const studio = makeStudio({
      consumeResult: SAMPLE_MESSAGES,
      consumeMessageCount: 2,
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    expect(screen.getByTestId('con-results-zone')).toBeTruthy();
    expect(screen.getByTestId('con-row-0')).toBeTruthy();
    expect(screen.getByTestId('con-row-1')).toBeTruthy();
  });

  it('shows "No messages received" when result is empty array', () => {
    render(<KafkaConsumeStudio studio={makeStudio({ consumeResult: [], consumeMessageCount: 0 })} clusterId="c" />);
    expect(screen.getByText('No messages received')).toBeTruthy();
  });

  it('shows timed-out badge when consumeTimedOut=true', () => {
    render(<KafkaConsumeStudio studio={makeStudio({ consumeResult: [], consumeMessageCount: 0, consumeTimedOut: true })} clusterId="c" />);
    expect(screen.getByTestId('con-timed-out')).toBeTruthy();
  });

  it('shows detail pane when selectedMessage is set', () => {
    const studio = makeStudio({
      consumeResult: SAMPLE_MESSAGES,
      consumeMessageCount: 2,
      selectedMessageIndex: 0,
      selectedMessage: SAMPLE_MESSAGES[0],
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    expect(screen.getByTestId('con-detail-pane')).toBeTruthy();
    expect(screen.getByTestId('con-detail-body').textContent).toContain('"id"');
  });

  it('calls selectMessage when a row is clicked', () => {
    const studio = makeStudio({
      consumeResult: SAMPLE_MESSAGES,
      consumeMessageCount: 2,
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByTestId('con-row-0'));
    expect(studio.selectMessage).toHaveBeenCalledWith(0);
  });

  it('deselects when clicking the same selected row', () => {
    const studio = makeStudio({
      consumeResult: SAMPLE_MESSAGES,
      consumeMessageCount: 2,
      selectedMessageIndex: 0,
      selectedMessage: SAMPLE_MESSAGES[0],
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByTestId('con-row-0'));
    expect(studio.selectMessage).toHaveBeenCalledWith(null);
  });

  it('calls clearConsumeResult when Clear is clicked', () => {
    const studio = makeStudio({ consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2 });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByTestId('con-clear-btn'));
    expect(studio.clearConsumeResult).toHaveBeenCalledOnce();
  });

  it('calls setConsumeDraft when topic changes', () => {
    const studio = makeStudio();
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'events.v2' } });
    expect(studio.setConsumeDraft).toHaveBeenCalledWith({ topic: 'events.v2' });
  });

  it('Copy Key button disabled when no key', () => {
    const studio = makeStudio({
      consumeResult: SAMPLE_MESSAGES,
      consumeMessageCount: 2,
      selectedMessageIndex: 1,
      selectedMessage: SAMPLE_MESSAGES[1], // key is undefined
    });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" />);
    expect((screen.getByTestId('con-copy-key-btn') as HTMLButtonElement).disabled).toBe(true);
  });
});
