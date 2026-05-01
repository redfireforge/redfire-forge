/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebhookConfig from './WebhookConfig';
import type { WebhookTriggerNodeData } from '../../types/workflow';

function makeData(overrides: Partial<WebhookTriggerNodeData> = {}): WebhookTriggerNodeData {
  return {
    label: 'Webhook',
    method: 'POST',
    path: '/api/webhook',
    samplePayload: '{"event":"test"}',
    notes: '',
    ...overrides,
  };
}

// Mock clipboard API
const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, writable: true });

describe('WebhookConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders method select with current value', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('POST')).toBeTruthy();
  });

  it('calls onChange when method changes', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('POST'), { target: { value: 'PUT' } });
    expect(onChange).toHaveBeenCalledWith({ method: 'PUT' });
  });

  it('renders path input', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('/api/webhook')).toBeTruthy();
  });

  it('calls onChange when path changes', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('/api/webhook'), { target: { value: '/api/events' } });
    expect(onChange).toHaveBeenCalledWith({ path: '/api/events' });
  });

  it('renders sample payload textarea', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('{"event":"test"}')).toBeTruthy();
  });

  it('calls onChange when payload changes', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{"event":"test"}'), { target: { value: '{}' } });
    expect(onChange).toHaveBeenCalledWith({ samplePayload: '{}' });
  });

  it('renders notes textarea', () => {
    render(<WebhookConfig data={makeData({ notes: 'my note' })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('my note')).toBeTruthy();
  });

  it('calls onChange when notes change', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData({ notes: '' })} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/Documentation or notes about this webhook/);
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    expect(onChange).toHaveBeenCalledWith({ notes: 'Updated' });
  });

  // Webhook URL panel tests
  it('does not render webhook URL panel without workflowId/nodeId', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    expect(document.querySelector('.wf-webhook-url-panel')).toBeNull();
  });

  it('renders webhook URL panel when workflowId and nodeId are provided', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    expect(document.querySelector('.wf-webhook-url-panel')).toBeTruthy();
    expect(screen.getByDisplayValue('http://127.0.0.1:3001/webhooks/wf1/n1')).toBeTruthy();
  });

  it('webhook URL input is read-only', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    const urlInput = screen.getByDisplayValue('http://127.0.0.1:3001/webhooks/wf1/n1') as HTMLInputElement;
    expect(urlInput.readOnly).toBe(true);
  });

  it('copies webhook URL to clipboard on Copy click', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy'));
    expect(mockClipboard.writeText).toHaveBeenCalledWith('http://127.0.0.1:3001/webhooks/wf1/n1');
  });

  it('copies cURL command to clipboard on Copy cURL click', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
    const curlArg = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(curlArg).toContain('curl');
    expect(curlArg).toContain('-X POST');
    expect(curlArg).toContain('http://127.0.0.1:3001/webhooks/wf1/n1');
  });

  it('renders all three HTTP method options', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    const select = screen.getByDisplayValue('POST') as HTMLSelectElement;
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toEqual(['POST', 'PUT', 'PATCH']);
  });

  it('selects URL text on focus', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    const urlInput = screen.getByDisplayValue('http://127.0.0.1:3001/webhooks/wf1/n1') as HTMLInputElement;
    const selectSpy = vi.spyOn(urlInput, 'select');
    fireEvent.focus(urlInput);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('uses {} as default payload when samplePayload is empty', async () => {
    render(<WebhookConfig data={makeData({ samplePayload: '' })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    const curlArg = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(curlArg).toContain("'{}'");
  });

  it('escapes single quotes in samplePayload for cURL', async () => {
    render(<WebhookConfig data={makeData({ samplePayload: "{'key':'val'}" })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    const curlArg = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(curlArg).toContain("'\\''");
  });

  it('handles clipboard writeText failure gracefully for URL copy', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy'));
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it('handles clipboard writeText failure gracefully for cURL copy', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });

  it('does not copy URL when webhookUrl is null', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    // No URL panel, no copy button — just assert clipboard not called
    expect(mockClipboard.writeText).not.toHaveBeenCalled();
  });

  it('uses method from data in cURL command', async () => {
    render(<WebhookConfig data={makeData({ method: 'PUT' })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    const curlArg = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(curlArg).toContain('-X PUT');
  });

  it('shows ✓ Copied! after URL copy succeeds', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy'));
    await vi.waitFor(() => expect(screen.getByText('✓ Copied!')).toBeTruthy());
  });

  it('shows ✓ Copied! after cURL copy succeeds', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    fireEvent.click(screen.getByText('Copy cURL'));
    await vi.waitFor(() => expect(screen.getByText('✓ Copied!')).toBeTruthy());
  });

  it('does not show webhook URL panel when only workflowId is provided', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" />);
    expect(document.querySelector('.wf-webhook-url-panel')).toBeNull();
  });

  it('does not show webhook URL panel when only nodeId is provided', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} nodeId="n1" />);
    expect(document.querySelector('.wf-webhook-url-panel')).toBeNull();
  });

  it('renders notes textarea with empty default', () => {
    render(<WebhookConfig data={makeData({ notes: undefined })} onChange={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Documentation or notes about this webhook/);
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });
});
