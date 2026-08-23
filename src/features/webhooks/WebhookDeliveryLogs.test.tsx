// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WebhookDeliveryLogs from './WebhookDeliveryLogs';
import type { WebhookDelivery } from '@shared/types/server-api';

// ── Mock EventSource (jsdom has none) ──
class MockEventSource {
  static instances: MockEventSource[] = [];
  static throwOnConstruct = false;
  url: string;
  onmessage: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  constructor(url: string) {
    if (MockEventSource.throwOnConstruct) throw new Error('no SSE');
    this.url = url;
    MockEventSource.instances.push(this);
  }
  close() { this.closed = true; }
}

const today = new Date().toISOString().split('T')[0];

function makeDelivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    triggerId: 'trig-1',
    method: 'post',
    payload: { hello: 'world' },
    status: 'success',
    duration: 42,
    timestamp: '2026-06-11T10:00:00.000Z',
    ...overrides,
  };
}

function mockFetchOnce(deliveries: WebhookDelivery[] | null, opts: { ok?: boolean; status?: number; reject?: boolean; bare?: boolean } = {}) {
  const fetchMock = vi.fn().mockImplementation(() => {
    if (opts.reject) return Promise.reject(new Error('network down'));
    return Promise.resolve({
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      json: () => Promise.resolve(opts.bare ? {} : { deliveries: deliveries ?? [] }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('WebhookDeliveryLogs', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    MockEventSource.throwOnConstruct = false;
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the loading state while the initial fetch is pending', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ })));
    render(<WebhookDeliveryLogs />);
    expect(screen.getByText('Loading webhook deliveries...')).toBeInTheDocument();
  });

  it('renders deliveries, auto-selects the first and shows its detail panel', async () => {
    mockFetchOnce([makeDelivery({ triggerId: 'trig-1' })]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument());
    expect(screen.getByText(`1 delivery on ${today}`)).toBeInTheDocument();
    // Detail panel auto-selected
    expect(screen.getByText('Delivery Details')).toBeInTheDocument();
    expect(screen.getByText('Payload')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    // Status/method badges shown
    expect(screen.getAllByText('POST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SUCCESS').length).toBeGreaterThan(0);
  });

  it('renders the empty state when there are no deliveries', async () => {
    mockFetchOnce([]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('No webhook deliveries found')).toBeInTheDocument());
    expect(screen.getByText(`Trigger a webhook on ${today} to see deliveries here`)).toBeInTheDocument();
  });

  it('treats a response missing the deliveries field as empty', async () => {
    mockFetchOnce(null, { bare: true });
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('No webhook deliveries found')).toBeInTheDocument());
  });

  it('renders the error state when the server responds with a non-ok status and retries', async () => {
    const fetchMock = mockFetchOnce(null, { ok: false, status: 500 });
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Error Loading Webhook Deliveries')).toBeInTheDocument());
    expect(screen.getByText('Server returned 500')).toBeInTheDocument();
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('renders the error state when the fetch rejects', async () => {
    mockFetchOnce(null, { reject: true });
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Error Loading Webhook Deliveries')).toBeInTheDocument());
    expect(screen.getByText('network down')).toBeInTheDocument();
  });

  it('toggles sort order between newest and oldest first', async () => {
    mockFetchOnce([
      makeDelivery({ triggerId: 'old', timestamp: '2026-06-11T08:00:00.000Z' }),
      makeDelivery({ triggerId: 'new', timestamp: '2026-06-11T12:00:00.000Z' }),
    ]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText(`2 deliveries on ${today}`)).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /Newest/ });
    // Default desc → newest first
    let triggers = screen.getAllByText(/^(old|new)$/).map((n) => n.textContent);
    expect(triggers[0]).toBe('new');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /Oldest/ })).toBeInTheDocument();
    triggers = screen.getAllByText(/^(old|new)$/).map((n) => n.textContent);
    expect(triggers[0]).toBe('old');
  });

  it('selects a different delivery and closes the detail panel', async () => {
    mockFetchOnce([
      makeDelivery({ triggerId: 'a', timestamp: '2026-06-11T09:00:00.000Z' }),
      makeDelivery({ triggerId: 'b', timestamp: '2026-06-11T11:00:00.000Z' }),
    ]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Delivery Details')).toBeInTheDocument());
    // 'a' (09:00) is auto-selected; click 'b' (only present in the list) to switch
    fireEvent.click(screen.getByText('b'));
    expect(screen.getByText('Delivery Details')).toBeInTheDocument();
    // Close detail
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Delivery Details')).not.toBeInTheDocument();
  });

  it('navigates dates with Prev/Next and disables Next at today', async () => {
    const fetchMock = mockFetchOnce([makeDelivery()]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument());
    // Next disabled at today
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled();
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '← Prev' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    // Now Next is enabled (date is in the past)
    expect(screen.getByRole('button', { name: 'Next →' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled());
  });

  it('reloads when the date input changes', async () => {
    const fetchMock = mockFetchOnce([makeDelivery()]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument());
    const callsBefore = fetchMock.mock.calls.length;
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-06-01' } });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(screen.getByText(/on 2026-06-01/)).toBeInTheDocument();
  });

  it('shows an error block and omits duration when the delivery has those traits', async () => {
    mockFetchOnce([makeDelivery({ status: 'error', duration: undefined, error: 'boom!' })]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Delivery Details')).toBeInTheDocument());
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('boom!')).toBeInTheDocument();
    // No duration label in the info grid
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  it('auto-refreshes via the SSE stream when a message arrives for today', async () => {
    const fetchMock = mockFetchOnce([makeDelivery()]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument());
    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();
    const callsBefore = fetchMock.mock.calls.length;
    es.onmessage?.({});
    es.onerror?.({}); // no-op handler
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore), { timeout: 2000 });
  });

  it('closes the EventSource on unmount', async () => {
    mockFetchOnce([makeDelivery()]);
    const { unmount } = render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(MockEventSource.instances.length).toBeGreaterThan(0));
    const es = MockEventSource.instances[0];
    // Schedule a debounce so the cleanup also clears the pending timer
    es.onmessage?.({});
    unmount();
    expect(es.closed).toBe(true);
  });

  it('does not crash when EventSource construction throws', async () => {
    MockEventSource.throwOnConstruct = true;
    mockFetchOnce([makeDelivery()]);
    render(<WebhookDeliveryLogs />);
    await waitFor(() => expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument());
    expect(MockEventSource.instances.length).toBe(0);
  });
});
