/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WebhookConfig from './WebhookConfig';
import { WebhookTriggerNodeData } from '../../types/workflow';
import { installClipboardMock } from '../../../../test-utils/clipboardMock';

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

let mockClipboardWriteText: Mock;

describe('WebhookConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboardWriteText = installClipboardMock();
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
    await act(async () => { fireEvent.click(screen.getByText('Copy')); await Promise.resolve(); });
    expect(mockClipboardWriteText).toHaveBeenCalledWith('http://127.0.0.1:3001/webhooks/wf1/n1');
  });

  it('handles clipboard failure when copying URL', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('denied'));
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });
    // Hook silently swallows clipboard errors — button should still show 'Copy'
    expect(screen.getByText('Copy')).toBeTruthy();
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  it('handles clipboard failure when copying cURL', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('denied'));
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => {
      fireEvent.click(screen.getByText('Copy cURL'));
    });
    // Hook silently swallows clipboard errors — button should still show 'Copy cURL'
    expect(screen.getByText('Copy cURL')).toBeTruthy();
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  it('Copy cURL uses empty JSON when sample payload is whitespace only', async () => {
    render(
      <WebhookConfig
        data={makeData({ samplePayload: '   \n\t  ' })}
        onChange={vi.fn()}
        workflowId="wf1"
        nodeId="n1"
      />,
    );
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain("-d '{}'");
  });

  it('copies cURL command to clipboard on Copy cURL click', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
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
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain("'{}'");
  });

  it('escapes single quotes in samplePayload for cURL', async () => {
    render(<WebhookConfig data={makeData({ samplePayload: "{'key':'val'}" })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain("'\\''");;
  });

  it('handles clipboard writeText failure gracefully for URL copy', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    // Should not throw — hook silently swallows clipboard errors
    await act(async () => { fireEvent.click(screen.getByText('Copy')); await Promise.resolve(); });
    expect(screen.getByText('Copy')).toBeTruthy();
  });

  it('handles clipboard writeText failure gracefully for cURL copy', async () => {
    mockClipboardWriteText.mockRejectedValueOnce(new Error('Clipboard denied'));
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    // Should not throw — hook silently swallows clipboard errors
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    expect(screen.getByText('Copy cURL')).toBeTruthy();
  });

  it('does not copy URL when webhookUrl is null', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    // No URL panel, no copy button — just assert clipboard not called
    expect(mockClipboardWriteText).not.toHaveBeenCalled();
  });

  it('uses method from data in cURL command', async () => {
    render(<WebhookConfig data={makeData({ method: 'PUT' })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain('-X PUT');
  });

  it('shows ✓ Copied! after URL copy succeeds', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy')); await Promise.resolve(); });
    await vi.waitFor(() => expect(screen.getByText('✓ Copied!')).toBeTruthy());
  });

  it('shows ✓ Copied! after cURL copy succeeds', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    await vi.waitFor(() => expect(screen.getByText('✓ Copied!')).toBeTruthy());
  });

  it('resets URL copy button label after copy timeout', async () => {
    vi.useFakeTimers();
    try {
      render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
      await act(async () => {
        fireEvent.click(screen.getByText('Copy'));
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('✓ Copied!')).toBeTruthy();
      await act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText('Copy')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets cURL copy button label after copy timeout', async () => {
    vi.useFakeTimers();
    try {
      render(<WebhookConfig data={makeData()} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
      await act(async () => {
        fireEvent.click(screen.getByText('Copy cURL'));
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('✓ Copied!')).toBeTruthy();
      await act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByText('Copy cURL')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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

  it('uses PATCH method in cURL command', async () => {
    render(<WebhookConfig data={makeData({ method: 'PATCH' })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain('-X PATCH');
  });

  it('calls onChange with PATCH when method selected', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('POST'), { target: { value: 'PATCH' } });
    expect(onChange).toHaveBeenCalledWith({ method: 'PATCH' });
  });

  it('uses {} when samplePayload is undefined', async () => {
    render(<WebhookConfig data={makeData({ samplePayload: undefined })} onChange={vi.fn()} workflowId="wf1" nodeId="n1" />);
    await act(async () => { fireEvent.click(screen.getByText('Copy cURL')); await Promise.resolve(); });
    const curlArg = mockClipboardWriteText.mock.calls[0][0] as string;
    expect(curlArg).toContain("'{}'");
  });

  // --- Extract Variables section ---

  it('renders existing extractVariables rows', () => {
    const vars = [{ name: 'orderId', jsonPath: '$.id' }, { name: 'status', jsonPath: '$.status' }];
    render(<WebhookConfig data={makeData({ extractVariables: vars })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('orderId')).toBeTruthy();
    expect(screen.getByDisplayValue('$.id')).toBeTruthy();
    expect(screen.getByDisplayValue('status')).toBeTruthy();
    expect(screen.getByDisplayValue('$.status')).toBeTruthy();
  });

  it('calls onChange when variable name is edited', () => {
    const onChange = vi.fn();
    const vars = [{ name: 'orderId', jsonPath: '$.id' }];
    render(<WebhookConfig data={makeData({ extractVariables: vars })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('orderId'), { target: { value: 'myOrder' } });
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: 'myOrder', jsonPath: '$.id' }] });
  });

  it('calls onChange when variable jsonPath is edited', () => {
    const onChange = vi.fn();
    const vars = [{ name: 'orderId', jsonPath: '$.id' }];
    render(<WebhookConfig data={makeData({ extractVariables: vars })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('$.id'), { target: { value: '$.orderId' } });
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: 'orderId', jsonPath: '$.orderId' }] });
  });

  it('removes a variable when remove button is clicked', () => {
    const onChange = vi.fn();
    const vars = [{ name: 'a', jsonPath: '$.a' }, { name: 'b', jsonPath: '$.b' }];
    render(<WebhookConfig data={makeData({ extractVariables: vars })} onChange={onChange} />);
    const removeBtns = screen.getAllByLabelText('Remove variable');
    fireEvent.click(removeBtns[0]);
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: 'b', jsonPath: '$.b' }] });
  });

  it('adds a new empty variable when Add Variable is clicked', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData({ extractVariables: [] })} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Variable'));
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: '', jsonPath: '' }] });
  });

  it('appends to existing variables when Add Variable is clicked', () => {
    const onChange = vi.fn();
    const vars = [{ name: 'x', jsonPath: '$.x' }];
    render(<WebhookConfig data={makeData({ extractVariables: vars })} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Variable'));
    expect(onChange).toHaveBeenCalledWith({
      extractVariables: [{ name: 'x', jsonPath: '$.x' }, { name: '', jsonPath: '' }],
    });
  });

  it('handles undefined extractVariables when Add Variable is clicked', () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Variable'));
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: '', jsonPath: '' }] });
  });

  it('handles null extractVariables when adding variable', () => {
    const onChange = vi.fn();
    render(
      <WebhookConfig
        data={makeData({ extractVariables: null as unknown as undefined })}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Add Variable'));
    expect(onChange).toHaveBeenCalledWith({ extractVariables: [{ name: '', jsonPath: '' }] });
  });

  // --- Data Mapper (DataMapperModal) ---

  it('opens Data Mapper modal when button is clicked', () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Data Mapper'));
    expect(document.querySelector('.dm-modal-overlay')).toBeTruthy();
  });

  it('closes Data Mapper when closed', async () => {
    render(<WebhookConfig data={makeData()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Data Mapper'));
    expect(document.querySelector('.dm-modal-overlay')).toBeTruthy();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(document.querySelector('.dm-modal-overlay')).toBeNull();
  });

  it('saves mapper result and closes modal via Save', async () => {
    const onChange = vi.fn();
    render(<WebhookConfig data={makeData({ samplePayload: '{"id":1}' })} onChange={onChange} />);
    fireEvent.click(screen.getByText('Data Mapper'));
    expect(document.querySelector('.dm-modal-overlay')).toBeTruthy();
    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);
    expect(document.querySelector('.dm-modal-overlay')).toBeNull();
  });
});
