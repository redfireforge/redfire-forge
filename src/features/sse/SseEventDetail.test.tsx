/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SseEventDetail } from './SseEventDetail';
import type { SseEvent } from './sseTypes';

function makeEvent(overrides: Partial<SseEvent> = {}): SseEvent {
  return {
    id: 'e1',
    eventType: 'message',
    data: 'hello world',
    lastEventId: '',
    size: 11,
    timestamp: '2026-06-09T10:00:00Z',
    ...overrides,
  };
}

describe('SseEventDetail', () => {
  it('renders event detail panel', () => {
    render(<SseEventDetail event={makeEvent()} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail')).toBeTruthy();
  });

  it('displays event type badge', () => {
    render(<SseEventDetail event={makeEvent({ eventType: 'update' })} onClose={vi.fn()} />);
    const detail = screen.getByTestId('sse-event-detail');
    expect(detail.textContent).toContain('update');
  });

  it('displays size in bytes', () => {
    render(<SseEventDetail event={makeEvent({ size: 256 })} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').textContent).toContain('256 bytes');
  });

  it('shows lastEventId when provided', () => {
    render(<SseEventDetail event={makeEvent({ lastEventId: 'evt-42' })} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').textContent).toContain('Last-Event-ID');
    expect(screen.getByTestId('sse-event-detail').textContent).toContain('evt-42');
  });

  it('hides lastEventId when empty', () => {
    render(<SseEventDetail event={makeEvent({ lastEventId: '' })} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').textContent).not.toContain('Last-Event-ID');
  });

  it('shows JSON badge for valid JSON data', () => {
    render(<SseEventDetail event={makeEvent({ data: '{"key":"value"}' })} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').textContent).toContain('JSON');
  });

  it('pretty-prints valid JSON data', () => {
    render(<SseEventDetail event={makeEvent({ data: '{"key":"value"}' })} onClose={vi.fn()} />);
    const pre = screen.getByTestId('sse-event-detail').querySelector('pre');
    expect(pre!.textContent).toContain('"key": "value"');
  });

  it('does not show JSON badge for non-JSON data', () => {
    render(<SseEventDetail event={makeEvent({ data: 'plain text' })} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').querySelector('.sse-detail-json-badge')).toBeNull();
  });

  it('displays non-JSON data as-is', () => {
    render(<SseEventDetail event={makeEvent({ data: 'plain text content' })} onClose={vi.fn()} />);
    const pre = screen.getByTestId('sse-event-detail').querySelector('pre');
    expect(pre!.textContent).toBe('plain text content');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SseEventDetail event={makeEvent()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close detail'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays timestamp', () => {
    render(<SseEventDetail event={makeEvent()} onClose={vi.fn()} />);
    expect(screen.getByTestId('sse-event-detail').textContent).toContain('Timestamp');
  });
});
