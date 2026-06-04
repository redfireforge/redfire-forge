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

const defaultTemplateProps = () => ({
  publishTemplates: [] as { id: string; name: string; createdAt: string; draft: KafkaPublishDraft }[],
  templatesLoading: false,
  onSaveTemplate: vi.fn().mockResolvedValue(undefined),
  onLoadTemplate: vi.fn(),
  onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
});

describe('KafkaPublishStudio', () => {
  it('renders topic input with current value', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    const input = screen.getByLabelText('Topic') as HTMLInputElement;
    expect(input.value).toBe('orders.events');
  });

  it('Send Once button is enabled when topic is set', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Send Once button is disabled when topic is empty', () => {
    const studio = makeStudio({
      publishDraft: { ...basePublishDraft(), topic: '' },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Send Once button is disabled while loading', () => {
    render(<KafkaPublishStudio studio={makeStudio({ publishLoading: true })} clusterId="c" {...defaultTemplateProps()} />);
    const btn = screen.getByTestId('pub-send-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Sending…');
  });

  it('calls sendOnce when Send Once is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTestId('pub-send-btn'));
    expect(studio.sendOnce).toHaveBeenCalledOnce();
  });

  it('calls validateJsonBody when Validate & Format JSON is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByText('Validate & Format JSON'));
    expect(studio.validateJsonBody).toHaveBeenCalledOnce();
  });

  it('shows error message when publishError is set', () => {
    const studio = makeStudio({
      publishError: { kind: 'server', code: 'TOPIC_MISSING', message: 'Topic not found', retryable: true },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.getByTestId('pub-error').textContent).toContain('Topic not found');
  });

  it('shows non-retryable tag for non-retryable publish errors', () => {
    const studio = makeStudio({
      publishError: { kind: 'server', code: 'ERR', message: 'Fatal error', retryable: false },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.getByTestId('pub-error').textContent).toContain('(non-retryable)');
  });

  it('shows success result when publishResult is set', () => {
    const studio = makeStudio({
      publishResult: { topic: 'orders.events', sentCount: 1, records: [{ partition: 0, offset: '42' }] },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.getByTestId('pub-result').textContent).toContain('1 message');
    expect(screen.getByTestId('pub-result').textContent).toContain('orders.events');
  });

  it('calls clearPublishResult when Clear is clicked', () => {
    const studio = makeStudio({
      publishResult: { topic: 't', sentCount: 1, records: [] },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(studio.clearPublishResult).toHaveBeenCalledOnce();
  });

  it('calls setPublishDraft when topic input changes', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'new-topic' } });
    expect(studio.setPublishDraft).toHaveBeenCalledWith({ topic: 'new-topic' });
  });

  it('adds a header row when + Add is clicked', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(studio.setPublishDraft).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.arrayContaining([expect.objectContaining({ enabled: true })]) }),
    );
  });

  it('shows "No headers" when headers array is empty', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.getByText('No headers')).toBeTruthy();
  });

  it('shows inline validation hint when topic is blurred while empty', () => {
    const studio = makeStudio({
      publishDraft: { ...basePublishDraft(), topic: '' },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.queryByTestId('pub-topic-hint')).toBeNull();
    fireEvent.blur(screen.getByLabelText('Topic'));
    expect(screen.getByTestId('pub-topic-hint').textContent).toBe('Topic is required');
  });

  it('shows inline validation hint when body is blurred while empty', () => {
    const studio = makeStudio({
      publishDraft: { ...basePublishDraft(), body: '' },
    });
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} />);
    expect(screen.queryByTestId('pub-body-hint')).toBeNull();
    fireEvent.blur(screen.getByLabelText('Message Body (JSON)'));
    expect(screen.getByTestId('pub-body-hint').textContent).toBe('Message body is required');
  });

  it('opens and closes template Load dropdown', () => {
    const tplProps = defaultTemplateProps();
    tplProps.publishTemplates = [
      { id: 'tpl-1', name: 'My Template', createdAt: '2026-01-01', draft: basePublishDraft() },
    ];
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...tplProps} />);
    fireEvent.click(screen.getByTitle('Load a saved template'));
    expect(screen.getByText('My Template')).toBeTruthy();
  });

  it('loads a template when clicked from dropdown', () => {
    const tplProps = defaultTemplateProps();
    tplProps.publishTemplates = [
      { id: 'tpl-1', name: 'My Template', createdAt: '2026-01-01', draft: basePublishDraft() },
    ];
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...tplProps} />);
    fireEvent.click(screen.getByTitle('Load a saved template'));
    fireEvent.click(screen.getByText('My Template'));
    expect(tplProps.onLoadTemplate).toHaveBeenCalledWith('tpl-1');
  });

  it('shows "No saved templates" when list is empty', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    fireEvent.click(screen.getByTitle('Load a saved template'));
    expect(screen.getByText('No saved templates')).toBeTruthy();
  });
});

// ─────────────────────── Workflow Integration (Phase 3D) ───────────────────────

describe('KafkaPublishStudio — Map from Workflow', () => {
  const WF_OUTPUT = { response_body: '{"status":"ok"}', total_count: '42', raw_text: 'hello' };

  it('[Map from Workflow] disabled when no workflow output', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    const btn = screen.getByTestId('pub-map-workflow-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('[Map from Workflow] disabled when output is null', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={null} />);
    const btn = screen.getByTestId('pub-map-workflow-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('[Map from Workflow] enabled when output has entries', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    const btn = screen.getByTestId('pub-map-workflow-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('opens dropdown with variable entries', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    fireEvent.click(screen.getByTestId('pub-map-workflow-btn'));
    expect(screen.getByTestId('pub-wf-dropdown')).toBeTruthy();
    expect(screen.getByTestId('pub-wf-var-response_body')).toBeTruthy();
    expect(screen.getByTestId('pub-wf-var-total_count')).toBeTruthy();
    expect(screen.getByTestId('pub-wf-var-raw_text')).toBeTruthy();
  });

  it('selecting a JSON variable fills body with pretty-printed value', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    fireEvent.click(screen.getByTestId('pub-map-workflow-btn'));
    fireEvent.click(screen.getByTestId('pub-wf-var-response_body'));
    expect(studio.setPublishDraft).toHaveBeenCalledWith({ body: JSON.stringify({ status: 'ok' }, null, 2) });
  });

  it('selecting a non-JSON variable fills body as raw string', () => {
    const studio = makeStudio();
    render(<KafkaPublishStudio studio={studio} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    fireEvent.click(screen.getByTestId('pub-map-workflow-btn'));
    fireEvent.click(screen.getByTestId('pub-wf-var-raw_text'));
    expect(studio.setPublishDraft).toHaveBeenCalledWith({ body: 'hello' });
  });

  it('search input filters variables', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    fireEvent.click(screen.getByTestId('pub-map-workflow-btn'));
    fireEvent.change(screen.getByTestId('pub-wf-search'), { target: { value: 'count' } });
    expect(screen.queryByTestId('pub-wf-var-response_body')).toBeNull();
    expect(screen.getByTestId('pub-wf-var-total_count')).toBeTruthy();
  });

  it('shows "No matching variables" when search has no results', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} lastWorkflowOutput={WF_OUTPUT} />);
    fireEvent.click(screen.getByTestId('pub-map-workflow-btn'));
    fireEvent.change(screen.getByTestId('pub-wf-search'), { target: { value: 'zzzzz' } });
    expect(screen.getByText('No matching variables')).toBeTruthy();
  });

  it('has tooltip "Run a workflow first" when disabled', () => {
    render(<KafkaPublishStudio studio={makeStudio()} clusterId="c" {...defaultTemplateProps()} />);
    const btn = screen.getByTestId('pub-map-workflow-btn');
    expect(btn.getAttribute('title')).toBe('Run a workflow first');
  });
});
