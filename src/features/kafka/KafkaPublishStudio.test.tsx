/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KafkaPublishStudio } from './KafkaPublishStudio';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { KafkaPublishDraft } from './types';

function basePublishDraft(): KafkaPublishDraft {
  return {
    topic: 'orders.events', key: '', partition: '', acks: -1,
    timeoutMs: '', headers: [], body: '{"hello":"world"}',
  };
}

function makeStudio(overrides?: Partial<UseKafkaMessageStudioReturn>): UseKafkaMessageStudioReturn {
  return {
    publishDraft: basePublishDraft(),
    setPublishDraft: vi.fn(),
    publishLoading: false,
    publishResult: null,
    publishError: null,
    sendOnce: vi.fn().mockResolvedValue(undefined),
    validateJsonBody: vi.fn().mockReturnValue(true),
    consumeDraft: {
      topic: '', groupId: 'redfireforge-debug-12345678', startPosition: 'latest',
      timeoutMs: '10000', maxMessages: '50', keyEquals: '', headerMatch: '',
      jsonPath: '', jsonPathEquals: '',
    },
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

describe('KafkaPublishStudio', () => {
  it('renders topic input with current value', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" />);
    const input = screen.getByLabelText('Topic') as HTMLInputElement;
    expect(input.value).toBe('orders.events');
  });

  it('Send Once button is enabled when topic is set', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Send Once button is disabled when topic is empty', () => {
    const studio = makeStudio({
      publishDraft: { ...basePublishDraft(), topic: '' },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Send Once button is disabled while loading', () => {
    render(<KafkaPublishStudio studio={makeStudio({ publishLoading: true })} clusterId="c" />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Sending…');
  });

  it('calls sendOnce when Send Once is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByTestId('pub-send-btn'));
    expect(studio.sendOnce).toHaveBeenCalledOnce();
  });

  it('calls validateJsonBody when Format JSON is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByText('Format JSON'));
    expect(studio.validateJsonBody).toHaveBeenCalledOnce();
  });

  it('shows error message when publishError is set', () => {
    const studio = makeStudio({
      publishError: { kind: 'server', code: 'TOPIC_MISSING', message: 'Topic not found', retryable: true },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    expect(screen.getByTestId('pub-error').textContent).toContain('Topic not found');
  });

  it('shows success result when publishResult is set', () => {
    const studio = makeStudio({
      publishResult: { topic: 'orders.events', sentCount: 1, records: [{ partition: 0, offset: '42' }] },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    expect(screen.getByTestId('pub-result').textContent).toContain('1 message');
    expect(screen.getByTestId('pub-result').textContent).toContain('orders.events');
  });

  it('calls clearPublishResult when Clear is clicked', () => {
    const studio = makeStudio({
      publishResult: { topic: 't', sentCount: 1, records: [] },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByText('Clear'));
    expect(studio.clearPublishResult).toHaveBeenCalledOnce();
  });

  it('calls setPublishDraft when topic input changes', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'new-topic' } });
    expect(studio.setPublishDraft).toHaveBeenCalledWith({ topic: 'new-topic' });
  });

  it('adds a header row when + Add is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(studio.setPublishDraft).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.arrayContaining([expect.objectContaining({ enabled: true })]) }),
    );
  });

  it('shows "No headers" when headers array is empty', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" />);
    expect(screen.getByText('No headers')).toBeTruthy();
  });
});
