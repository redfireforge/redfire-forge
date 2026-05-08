/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestPreview from './RequestPreview';
import type { Scenario } from '../../shared/types';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Request',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/users/1',
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    auth: { type: 'none' },
    validation: { assertions: [] },
    ...overrides,
  } as Scenario;
}

describe('RequestPreview', () => {
  it('renders request tab by default', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    expect(screen.getByText(/GET/)).toBeTruthy();
    expect(screen.getByText(/jsonplaceholder/)).toBeTruthy();
  });

  it('renders method and URL in request preview', () => {
    const { container } = render(<RequestPreview scenario={makeScenario()} />);
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).toContain('"method": "GET"');
    expect(code?.textContent).toContain('"url": "https://jsonplaceholder.typicode.com/users/1"');
  });

  it('renders headers in request preview', () => {
    const { container } = render(<RequestPreview scenario={makeScenario()} />);
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).toContain('"Accept": "application/json"');
  });

  it('renders body in request preview when present', () => {
    const { container } = render(
      <RequestPreview scenario={makeScenario({ method: 'POST', body: '{"name":"test"}' })} />,
    );
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).toContain('"body"');
  });

  it('truncates long body in preview', () => {
    const longBody = 'x'.repeat(200);
    const { container } = render(
      <RequestPreview scenario={makeScenario({ method: 'POST', body: longBody })} />,
    );
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).toContain('…');
  });

  it('switches to response tab', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    expect(screen.getByText(/Fetch a sample response/)).toBeTruthy();
  });

  it('can switch back to the request tab', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Request'));
    expect(screen.getByText(/GET/)).toBeTruthy();
  });

  it('shows Fetch Sample button on response tab', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    expect(screen.getByText('Fetch Sample')).toBeTruthy();
  });

  it('fetches response when Fetch Sample clicked', async () => {
    const mockResponse = { ok: true, status: 200, text: () => Promise.resolve('{"id":1,"name":"Leanne"}') };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

    const { container } = render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));

    await waitFor(() => {
      const code = container.querySelector('.gallery-tab-code');
      expect(code?.textContent).toContain('Status: 200');
      expect(code?.textContent).toContain('Leanne');
    });

    vi.restoreAllMocks();
  });

  it('shows error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });

    vi.restoreAllMocks();
  });

  it('shows non-JSON response as plain text', async () => {
    const mockResponse = { ok: true, status: 200, text: () => Promise.resolve('plain text response') };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

    const { container } = render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));

    await waitFor(() => {
      const code = container.querySelector('.gallery-tab-code');
      expect(code?.textContent).toContain('plain text response');
    });

    vi.restoreAllMocks();
  });

  it('calls onExpand with request tab content', () => {
    const onExpand = vi.fn();
    render(<RequestPreview scenario={makeScenario()} onExpand={onExpand} />);
    const expandBtn = screen.getByTitle(/View full request/);
    fireEvent.click(expandBtn);
    expect(onExpand).toHaveBeenCalledWith('request', expect.stringContaining('"method": "GET"'));
  });

  it('calls onExpand with response tab content after fetch', async () => {
    const onExpand = vi.fn();
    const mockResponse = { ok: true, status: 200, text: () => Promise.resolve('{"data":1}') };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as any);

    render(<RequestPreview scenario={makeScenario()} onExpand={onExpand} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));

    await waitFor(() => {
      expect(screen.getByTitle(/View full response/)).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle(/View full response/));
    expect(onExpand).toHaveBeenCalledWith('response', expect.stringContaining('Status: 200'));

    vi.restoreAllMocks();
  });

  it('renders assertions in request preview', () => {
    const scenario = makeScenario({
      validation: {
        assertions: [
          { type: 'status', expected: '200' },
          { type: 'jsonPath', path: '$.name', expected: 'Leanne' },
        ],
      },
    } as any);
    const { container } = render(<RequestPreview scenario={scenario} />);
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).toContain('assertions');
  });

  it('hides expand button on response tab when no content fetched', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    expect(screen.queryByTitle(/View full response/)).toBeNull();
  });

  it('sends body for non-GET requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 201, text: () => Promise.resolve('{}'),
    } as any);

    render(<RequestPreview scenario={makeScenario({ method: 'POST', body: '{"name":"test"}' })} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST', body: '{"name":"test"}' }),
      );
    });

    vi.restoreAllMocks();
  });

  it('uses raw URL as host label when URL is invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, text: () => Promise.resolve('{}'),
    } as any);
    render(<RequestPreview scenario={makeScenario({ url: 'not-a-url' })} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));
    await waitFor(() => {
      expect(screen.getByText(/Fetching from not-a-url/)).toBeTruthy();
    });
    vi.restoreAllMocks();
  });

  it('stringifies non-Error fetch failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('offline');
    render(<RequestPreview scenario={makeScenario()} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));
    await waitFor(() => {
      expect(screen.getByText(/offline/)).toBeTruthy();
    });
    vi.restoreAllMocks();
  });

  it('does not throw when expand is clicked without onExpand', () => {
    render(<RequestPreview scenario={makeScenario()} />);
    expect(() => fireEvent.click(screen.getByTitle(/View full request/))).not.toThrow();
  });

  it('omits fetch headers when scenario has none', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, status: 200, text: () => Promise.resolve('{}'),
    } as any);
    render(<RequestPreview scenario={makeScenario({ headers: undefined } as any)} />);
    fireEvent.click(screen.getByText('Response'));
    fireEvent.click(screen.getByText('Fetch Sample'));
    await waitFor(() => {
      const [, init] = fetchSpy.mock.calls[0];
      expect(init).toMatchObject({ headers: undefined });
    });
    vi.restoreAllMocks();
  });

  it('buildRequestPreview omits headers when empty and adds jsonPath assertion parts', () => {
    const scenario = makeScenario({
      headers: [],
      validation: {
        assertions: [
          { type: 'jsonPath', jsonPath: '$.id', operator: 'eq', value: 42 },
        ],
      },
    } as any);
    const { container } = render(<RequestPreview scenario={scenario} />);
    const code = container.querySelector('.gallery-tab-code');
    expect(code?.textContent).not.toContain('"headers"');
    expect(code?.textContent).toContain('jsonPath');
    expect(code?.textContent).toContain('op');
    expect(code?.textContent).toContain('42');
  });
});
