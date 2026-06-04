/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KafkaConsumeStudio } from './KafkaConsumeStudio';
import type { UseKafkaMessageStudioReturn } from '../../app/hooks/useKafkaMessageStudio';
import type { UseKafkaStreamModeReturn } from '../../app/hooks/useKafkaStreamMode';
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

function makeStreamMode(overrides?: Partial<UseKafkaStreamModeReturn>): UseKafkaStreamModeReturn {
  return {
    isStreaming: false,
    streamMessages: [],
    streamError: null,
    streamSubscriptionId: null,
    cursorGap: false,
    startStream: vi.fn().mockResolvedValue(undefined),
    stopStream: vi.fn().mockResolvedValue(undefined),
    clearStreamMessages: vi.fn(),
    selectedStreamIndex: null,
    selectedStreamMessage: null,
    selectStreamMessage: vi.fn(),
    ...overrides,
  };
}

const defaultTemplateProps = () => ({
  consumeTemplates: [] as { id: string; name: string; createdAt: string; draft: KafkaConsumeDraft }[],
  templatesLoading: false,
  onSaveConsumeTemplate: vi.fn().mockResolvedValue(undefined),
  onLoadConsumeTemplate: vi.fn(),
  onDeleteConsumeTemplate: vi.fn().mockResolvedValue(undefined),
});

const SAMPLE_MESSAGES: KafkaConsumeResultRow[] = [
  { topic: 'orders.events', partition: 0, offset: '10', value: '{"id":1}', key: 'order-1' },
  { topic: 'orders.events', partition: 1, offset: '3', value: '{"id":2}', key: undefined },
];

const STREAM_MESSAGES: KafkaConsumeResultRow[] = [
  { topic: 'orders.events', partition: 0, offset: '100', value: '{"seq":1}', key: 'sk-0' },
  { topic: 'orders.events', partition: 1, offset: '101', value: '{"seq":2}', key: 'sk-1' },
  { topic: 'orders.events', partition: 0, offset: '102', value: '{"seq":3}', key: 'sk-2' },
];

function renderConsume(opts?: {
  studio?: Partial<UseKafkaMessageStudioReturn>;
  stream?: Partial<UseKafkaStreamModeReturn>;
  onUseAsWorkflowInput?: (p: string, m: { topic: string; partition: number; offset: string }) => void;
}) {
  return render(
    <KafkaConsumeStudio
      studio={makeStudio(opts?.studio)}
      clusterId="c"
      streamMode={makeStreamMode(opts?.stream)}
      onUseAsWorkflowInput={opts?.onUseAsWorkflowInput}
      {...defaultTemplateProps()}
    />,
  );
}

// ─────────────────────── Consume Once (existing behavior) ───────────────────────

describe('KafkaConsumeStudio — Consume Once', () => {
  it('renders topic input', () => {
    renderConsume();
    const input = screen.getByLabelText('Topic') as HTMLInputElement;
    expect(input.value).toBe('orders.events');
  });

  it('Consume Once button is enabled when topic is set', () => {
    renderConsume();
    const btn = screen.getByTestId('con-consume-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Consume Once button disabled when topic is empty', () => {
    renderConsume({ studio: { consumeDraft: { ...baseConsumeDraft(), topic: '' } } });
    expect((screen.getByTestId('con-consume-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Consume Once shows "Consuming…" while loading', () => {
    renderConsume({ studio: { consumeLoading: true } });
    expect(screen.getByTestId('con-consume-btn').textContent).toBe('Consuming…');
  });

  it('calls consumeOnce when button clicked', () => {
    const studio = makeStudio();
    render(<KafkaConsumeStudio studio={studio} clusterId="c" streamMode={makeStreamMode()} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-consume-btn'));
    expect(studio.consumeOnce).toHaveBeenCalledOnce();
  });

  it('shows error message', () => {
    renderConsume({ studio: { consumeError: { kind: 'server', code: 'ERR', message: 'broker error', retryable: true } } });
    expect(screen.getByTestId('con-error').textContent).toContain('broker error');
  });

  it('shows non-retryable tag for non-retryable consume errors', () => {
    renderConsume({ studio: { consumeError: { kind: 'server', code: 'ERR', message: 'Fatal', retryable: false } } });
    expect(screen.getByTestId('con-error').textContent).toContain('(non-retryable)');
  });

  it('shows results zone with message rows', () => {
    renderConsume({ studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2 } });
    expect(screen.getByTestId('con-results-zone')).toBeTruthy();
    expect(screen.getByTestId('con-row-0')).toBeTruthy();
    expect(screen.getByTestId('con-row-1')).toBeTruthy();
  });

  it('shows "No messages received" when result is empty array', () => {
    renderConsume({ studio: { consumeResult: [], consumeMessageCount: 0 } });
    expect(screen.getByText('No messages received')).toBeTruthy();
  });

  it('shows timed-out badge when consumeTimedOut=true', () => {
    renderConsume({ studio: { consumeResult: [], consumeMessageCount: 0, consumeTimedOut: true } });
    expect(screen.getByTestId('con-timed-out')).toBeTruthy();
  });

  it('shows "max reached" when message count equals maxMessages', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({
      topic: 'orders.events', partition: 0, offset: String(i), value: '{}', key: `k-${i}`,
    }));
    renderConsume({ studio: { consumeResult: msgs, consumeMessageCount: 50, consumeDraft: { ...baseConsumeDraft(), maxMessages: '50' } } });
    expect(screen.getByTestId('con-max-reached').textContent).toContain('max reached');
  });

  it('shows detail pane when selectedMessage is set', () => {
    renderConsume({ studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 0, selectedMessage: SAMPLE_MESSAGES[0] } });
    expect(screen.getByTestId('con-detail-pane')).toBeTruthy();
    expect(screen.getByTestId('con-detail-body').textContent).toContain('"id"');
  });

  it('calls selectMessage when a row is clicked', () => {
    const studio = makeStudio({ consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2 });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" streamMode={makeStreamMode()} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-row-0'));
    expect(studio.selectMessage).toHaveBeenCalledWith(0);
  });

  it('deselects when clicking the same selected row', () => {
    const studio = makeStudio({ consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 0, selectedMessage: SAMPLE_MESSAGES[0] });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" streamMode={makeStreamMode()} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-row-0'));
    expect(studio.selectMessage).toHaveBeenCalledWith(null);
  });

  it('calls clearConsumeResult when Clear is clicked', () => {
    const studio = makeStudio({ consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2 });
    render(<KafkaConsumeStudio studio={studio} clusterId="c" streamMode={makeStreamMode()} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-clear-btn'));
    expect(studio.clearConsumeResult).toHaveBeenCalledOnce();
  });

  it('calls setConsumeDraft when topic changes', () => {
    const studio = makeStudio();
    render(<KafkaConsumeStudio studio={studio} clusterId="c" streamMode={makeStreamMode()} {...defaultTemplateProps()} />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'events.v2' } });
    expect(studio.setConsumeDraft).toHaveBeenCalledWith({ topic: 'events.v2' });
  });

  it('Copy Key button disabled when no key', () => {
    renderConsume({ studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 1, selectedMessage: SAMPLE_MESSAGES[1] } });
    expect((screen.getByTestId('con-copy-key-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows inline validation hint when topic is blurred while empty', () => {
    renderConsume({ studio: { consumeDraft: { ...baseConsumeDraft(), topic: '' } } });
    expect(screen.queryByTestId('con-topic-hint')).toBeNull();
    fireEvent.blur(screen.getByLabelText('Topic'));
    expect(screen.getByTestId('con-topic-hint').textContent).toBe('Topic is required');
  });

  it('opens template dropdown and shows empty state', () => {
    renderConsume();
    fireEvent.click(screen.getByTitle('Load a saved template'));
    expect(screen.getByText('No saved templates')).toBeTruthy();
  });

  it('loads a template when clicked from dropdown', () => {
    const tplProps = defaultTemplateProps();
    tplProps.consumeTemplates = [
      { id: 'tpl-1', name: 'Consume Preset', createdAt: '2026-01-01', draft: baseConsumeDraft() },
    ];
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" streamMode={makeStreamMode()} {...tplProps} />);
    fireEvent.click(screen.getByTitle('Load a saved template'));
    fireEvent.click(screen.getByText('Consume Preset'));
    expect(tplProps.onLoadConsumeTemplate).toHaveBeenCalledWith('tpl-1');
  });
});

// ─────────────────────── Mode tabs ───────────────────────

describe('KafkaConsumeStudio — Mode Tabs', () => {
  it('renders both mode tabs', () => {
    renderConsume();
    expect(screen.getByTestId('con-mode-once')).toBeTruthy();
    expect(screen.getByTestId('con-mode-stream')).toBeTruthy();
  });

  it('defaults to Consume Once mode', () => {
    renderConsume();
    expect(screen.getByTestId('con-mode-once').className).toContain('active');
    expect(screen.getByTestId('con-mode-stream').className).not.toContain('active');
  });

  it('switches to Stream mode when Stream tab clicked', () => {
    renderConsume();
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    expect(screen.getByTestId('stream-action-row')).toBeTruthy();
    expect(screen.queryByTestId('con-consume-btn')).toBeNull();
  });

  it('switches back to Consume Once mode', () => {
    renderConsume();
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('con-mode-once'));
    expect(screen.getByTestId('con-consume-btn')).toBeTruthy();
  });
});

// ─────────────────────── Stream Mode ───────────────────────

describe('KafkaConsumeStudio — Stream Mode', () => {
  function renderStream(opts?: {
    stream?: Partial<UseKafkaStreamModeReturn>;
    studio?: Partial<UseKafkaMessageStudioReturn>;
    onUseAsWorkflowInput?: (p: string, m: { topic: string; partition: number; offset: string }) => void;
  }) {
    const result = renderConsume({ stream: opts?.stream, studio: opts?.studio, onUseAsWorkflowInput: opts?.onUseAsWorkflowInput });
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    return result;
  }

  it('shows Start Stream button when not streaming', () => {
    renderStream();
    expect(screen.getByTestId('stream-start-btn')).toBeTruthy();
    expect(screen.queryByTestId('stream-stop-btn')).toBeNull();
  });

  it('Start Stream button disabled when topic is empty', () => {
    renderStream({ studio: { consumeDraft: { ...baseConsumeDraft(), topic: '' } } });
    expect((screen.getByTestId('stream-start-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Stop Stream button when streaming', () => {
    renderStream({ stream: { isStreaming: true } });
    expect(screen.getByTestId('stream-stop-btn')).toBeTruthy();
    expect(screen.queryByTestId('stream-start-btn')).toBeNull();
  });

  it('shows LIVE badge when streaming', () => {
    renderStream({ stream: { isStreaming: true } });
    expect(screen.getByTestId('stream-live-badge')).toBeTruthy();
    expect(screen.getByTestId('stream-live-badge').textContent).toBe('LIVE');
  });

  it('shows "Waiting for messages…" when streaming with no messages', () => {
    renderStream({ stream: { isStreaming: true } });
    expect(screen.getByText('Waiting for messages…')).toBeTruthy();
  });

  it('shows "No stream messages" when not streaming and no messages', () => {
    renderStream();
    expect(screen.getByText('No stream messages')).toBeTruthy();
  });

  it('shows stream messages in results table', () => {
    renderStream({ stream: { streamMessages: STREAM_MESSAGES } });
    expect(screen.getByTestId('stream-row-0')).toBeTruthy();
    expect(screen.getByTestId('stream-row-1')).toBeTruthy();
    expect(screen.getByTestId('stream-row-2')).toBeTruthy();
  });

  it('shows message count', () => {
    renderStream({ stream: { streamMessages: STREAM_MESSAGES } });
    expect(screen.getByTestId('stream-count').textContent).toContain('3 messages');
  });

  it('shows cursorGap warning badge', () => {
    renderStream({ stream: { cursorGap: true } });
    expect(screen.getByTestId('stream-cursor-gap')).toBeTruthy();
    expect(screen.getByTestId('stream-cursor-gap').textContent).toContain('Buffer wrapped');
  });

  it('shows stream error', () => {
    renderStream({ stream: { streamError: { kind: 'server', code: 'ERR', message: 'Stream error', retryable: true } } });
    expect(screen.getByTestId('stream-error').textContent).toContain('Stream error');
  });

  it('shows Clear and Export buttons when messages exist', () => {
    renderStream({ stream: { streamMessages: STREAM_MESSAGES } });
    expect(screen.getByTestId('stream-clear-btn')).toBeTruthy();
    expect(screen.getByTestId('stream-export-btn')).toBeTruthy();
  });

  it('calls clearStreamMessages when Clear clicked', () => {
    const sm = makeStreamMode({ streamMessages: STREAM_MESSAGES });
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" streamMode={sm} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('stream-clear-btn'));
    expect(sm.clearStreamMessages).toHaveBeenCalledOnce();
  });

  it('calls startStream when Start Stream clicked', () => {
    const sm = makeStreamMode();
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="test-cluster" streamMode={sm} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('stream-start-btn'));
    expect(sm.startStream).toHaveBeenCalledWith(expect.objectContaining({ topic: 'orders.events' }), 'test-cluster');
  });

  it('calls stopStream when Stop Stream clicked', () => {
    const sm = makeStreamMode({ isStreaming: true });
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" streamMode={sm} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('stream-stop-btn'));
    expect(sm.stopStream).toHaveBeenCalledOnce();
  });

  it('shows detail pane when stream message selected', () => {
    renderStream({
      stream: {
        streamMessages: STREAM_MESSAGES,
        selectedStreamIndex: 0,
        selectedStreamMessage: STREAM_MESSAGES[0],
      },
    });
    expect(screen.getByTestId('con-detail-pane')).toBeTruthy();
    expect(screen.getByTestId('con-detail-body').textContent).toContain('"seq"');
  });

  it('calls selectStreamMessage when a stream row is clicked', () => {
    const sm = makeStreamMode({ streamMessages: STREAM_MESSAGES });
    render(<KafkaConsumeStudio studio={makeStudio()} clusterId="c" streamMode={sm} {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('stream-row-1'));
    expect(sm.selectStreamMessage).toHaveBeenCalledWith(1);
  });
});

// ─────────────────────── Workflow Integration (3C) ───────────────────────

describe('KafkaConsumeStudio — Workflow Input', () => {
  it('[Use as Workflow Input] visible when prop provided + message selected', () => {
    const handler = vi.fn();
    renderConsume({
      studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 0, selectedMessage: SAMPLE_MESSAGES[0] },
      onUseAsWorkflowInput: handler,
    });
    expect(screen.getByTestId('con-workflow-input-btn')).toBeTruthy();
  });

  it('[Use as Workflow Input] hidden when prop not provided', () => {
    renderConsume({
      studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 0, selectedMessage: SAMPLE_MESSAGES[0] },
    });
    expect(screen.queryByTestId('con-workflow-input-btn')).toBeNull();
  });

  it('clicking calls onUseAsWorkflowInput with correct payload + meta', () => {
    const handler = vi.fn();
    renderConsume({
      studio: { consumeResult: SAMPLE_MESSAGES, consumeMessageCount: 2, selectedMessageIndex: 0, selectedMessage: SAMPLE_MESSAGES[0] },
      onUseAsWorkflowInput: handler,
    });
    fireEvent.click(screen.getByTestId('con-workflow-input-btn'));
    expect(handler).toHaveBeenCalledWith('{"id":1}', { topic: 'orders.events', partition: 0, offset: '10' });
  });

  it('[Use as Workflow Input] works in Stream mode', () => {
    const handler = vi.fn();
    renderConsume({
      stream: {
        streamMessages: STREAM_MESSAGES,
        selectedStreamIndex: 0,
        selectedStreamMessage: STREAM_MESSAGES[0],
      },
      onUseAsWorkflowInput: handler,
    });
    fireEvent.click(screen.getByTestId('con-mode-stream'));
    fireEvent.click(screen.getByTestId('con-workflow-input-btn'));
    expect(handler).toHaveBeenCalledWith('{"seq":1}', { topic: 'orders.events', partition: 0, offset: '100' });
  });
});
