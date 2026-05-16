/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FetchErrorBanner from './FetchErrorBanner';
import type { FetchErrorDetail } from './types';

describe('FetchErrorBanner', () => {
  it('renders message inside alert with summary row', () => {
    const error: FetchErrorDetail = { message: 'Network failure' };
    render(<FetchErrorBanner error={error} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(screen.getByText('Network failure')).toBeTruthy();
  });

  it('does not treat summary as button when there is no expandable detail', () => {
    const error: FetchErrorDetail = { message: 'Plain message only' };
    render(<FetchErrorBanner error={error} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Details/)).toBeNull();
  });

  it('marks summary clickable when status is present', () => {
    const error: FetchErrorDetail = { message: 'Failed', status: 503 };
    const { container } = render(<FetchErrorBanner error={error} />);
    expect(screen.getByRole('button', { name: /toggle error details/i })).toBeTruthy();
    expect(container.querySelector('.dm-fetch-error-clickable')).toBeTruthy();
    expect(screen.getByText(/▸ Details/)).toBeTruthy();
  });

  it('marks summary clickable when headers object is present even if empty', () => {
    const error: FetchErrorDetail = { message: 'Err', headers: {} };
    render(<FetchErrorBanner error={error} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('marks summary clickable when body is present', () => {
    const error: FetchErrorDetail = { message: 'Err', body: 'not json' };
    render(<FetchErrorBanner error={error} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('toggles expanded detail on click and updates toggle glyph', () => {
    const error: FetchErrorDetail = { message: 'Bad', status: 400 };
    render(<FetchErrorBanner error={error} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/▾ Details/)).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Status')).toBeNull();
  });

  it('toggles expanded detail on Enter and Space', async () => {
    const user = userEvent.setup();
    const error: FetchErrorDetail = { message: 'Bad', status: 418 };
    render(<FetchErrorBanner error={error} />);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard('{Enter}');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Status')).toBeTruthy();
    await user.keyboard(' ');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders status row with 5xx badge class', () => {
    const error: FetchErrorDetail = { message: 'Srv', status: 502, statusText: 'Bad Gateway' };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const badge = document.querySelector('.dm-fetch-error-status-badge.status-5xx');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('502');
    expect(screen.getByText('Bad Gateway')).toBeTruthy();
  });

  it('renders status row with 4xx badge class', () => {
    const error: FetchErrorDetail = { message: 'Cli', status: 404 };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('.status-4xx')).toBeTruthy();
    expect(document.querySelector('.status-5xx')).toBeNull();
  });

  it('renders status row with ok badge class for sub-400 codes', () => {
    const error: FetchErrorDetail = { message: 'Weird', status: 200 };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('.status-ok')).toBeTruthy();
    expect(document.querySelector('.status-4xx')).toBeNull();
  });

  it('renders empty statusText when statusText is undefined', () => {
    const error: FetchErrorDetail = { message: 'M', status: 500 };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const row = document.querySelector('.dm-fetch-error-row');
    expect(row?.textContent).toContain('500');
  });

  it('shows timing row with TTFB only', () => {
    const error: FetchErrorDetail = { message: 'T', status: 1, timing: { ttfb: 12 } };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Timing')).toBeTruthy();
    expect(screen.getByText(/TTFB/)).toBeTruthy();
    expect(screen.getByText(/12ms/)).toBeTruthy();
    expect(screen.queryByText(/Total/)).toBeNull();
  });

  it('shows timing row with Total only', () => {
    const error: FetchErrorDetail = { message: 'T', body: 'x', timing: { total: 99 } };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Total/)).toBeTruthy();
    expect(screen.getByText(/99ms/)).toBeTruthy();
    expect(screen.queryByText(/TTFB/)).toBeNull();
  });

  it('shows timing separator when both ttfb and total are set', () => {
    const error: FetchErrorDetail = {
      message: 'T',
      headers: { a: 'b' },
      timing: { ttfb: 5, total: 20 },
    };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/TTFB/)).toBeTruthy();
    expect(screen.getByText(/Total/)).toBeTruthy();
    expect(document.querySelector('.dm-fetch-error-timing-sep')).toBeTruthy();
  });

  it('renders timing label row when timing object is empty', () => {
    const error: FetchErrorDetail = { message: 'T', status: 400, timing: {} };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Timing')).toBeTruthy();
  });

  it('does not render headers section when headers has no keys', () => {
    const error: FetchErrorDetail = { message: 'H', headers: {}, status: 400 };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText(/Response Headers/)).toBeNull();
  });

  it('renders mapped header rows inside details', () => {
    const error: FetchErrorDetail = {
      message: 'H',
      headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc' },
      status: 400,
    };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Response Headers/)).toBeTruthy();
    expect(screen.getByText('(2)')).toBeTruthy();
    expect(screen.getByText('Content-Type')).toBeTruthy();
    expect(screen.getByText('application/json')).toBeTruthy();
    expect(screen.getByText('X-Trace')).toBeTruthy();
  });

  it('pretty-prints valid JSON body and applies highlight spans', () => {
    const raw = JSON.stringify({ answer: 42, ok: true, empty: null, label: 'hi' });
    const error: FetchErrorDetail = { message: 'B', body: raw };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const pre = document.querySelector('.dm-fetch-error-body');
    expect(pre).toBeTruthy();
    const html = pre?.innerHTML ?? '';
    expect(html).toContain('json-hl-key');
    expect(html).toContain('json-hl-num');
    expect(html).toContain('json-hl-kw');
    expect(html).toContain('json-hl-str');
    expect(html).toContain('42');
  });

  it('falls back to raw body when JSON parse fails', () => {
    const error: FetchErrorDetail = { message: 'B', body: '<<< not json' };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const pre = document.querySelector('.dm-fetch-error-body');
    expect(pre?.innerHTML).toContain('&lt;&lt;&lt;');
    expect(pre?.textContent).toContain('<<< not json');
  });

  it('highlights numeric literals after JSON prettify (includes normalized decimals)', () => {
    const raw = '{"n":1.2e-3}';
    const error: FetchErrorDetail = { message: 'B', body: raw };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const pre = document.querySelector('.dm-fetch-error-body');
    expect(pre?.innerHTML).toContain('json-hl-num');
    expect(pre?.textContent).toContain('0.0012');
  });

  it('opens response body details by default', () => {
    const error: FetchErrorDetail = { message: 'B', body: '{}' };
    render(<FetchErrorBanner error={error} />);
    fireEvent.click(screen.getByRole('button'));
    const details = document.querySelector('details.dm-fetch-error-section[open]');
    expect(details).toBeTruthy();
    expect(screen.getByText('Response Body')).toBeTruthy();
  });

  it('ignores unrelated keys on keydown when expandable', () => {
    const error: FetchErrorDetail = { message: 'K', status: 500 };
    render(<FetchErrorBanner error={error} />);
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });
});
