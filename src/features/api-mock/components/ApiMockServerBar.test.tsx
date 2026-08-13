/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockServerBar } from './ApiMockServerBar';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-1',
    name: 'Mock Server 1',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '/api',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('ApiMockServerBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders stopped state and starts the server', () => {
    const onStart = vi.fn();
    render(<ApiMockServerBar server={makeServer()} onUpdate={vi.fn()} onStart={onStart} />);

    expect(screen.getByText('Stopped')).toBeTruthy();
    expect(screen.getByTestId('api-mock-address').textContent).toContain('http://127.0.0.1:4600/api');
    fireEvent.click(screen.getByTestId('api-mock-start'));
    expect(onStart).toHaveBeenCalled();
  });

  it('renders running controls, dirty badge, generation, and error message', () => {
    const onApply = vi.fn();
    const onRestart = vi.fn();
    const onStop = vi.fn();
    const onSettings = vi.fn();
    render(
      <ApiMockServerBar
        server={makeServer()}
        onUpdate={vi.fn()}
        status="running"
        dirty
        generation={7}
        error="Validation warning"
        onApply={onApply}
        onRestart={onRestart}
        onStop={onStop}
        onSettings={onSettings}
      />,
    );

    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByTestId('api-mock-dirty-badge')).toHaveTextContent('Draft changed');
    expect(screen.getByText('Generation 7')).toBeTruthy();
    expect(screen.getByTestId('api-mock-server-error')).toHaveTextContent('Validation warning');

    fireEvent.click(screen.getByTestId('api-mock-apply'));
    fireEvent.click(screen.getByTestId('api-mock-restart'));
    fireEvent.click(screen.getByTestId('api-mock-stop'));
    fireEvent.click(screen.getByTestId('api-mock-settings'));

    expect(onApply).toHaveBeenCalled();
    expect(onRestart).toHaveBeenCalled();
    expect(onStop).toHaveBeenCalled();
    expect(onSettings).toHaveBeenCalled();
  });

  it('shows the full companion-unavailable diagnostic without truncating', () => {
    const full =
      'Companion unavailable: The companion runtime is not reachable. Start it with `npm run server:dev`, then retry.';
    render(
      <ApiMockServerBar
        server={makeServer()}
        onUpdate={vi.fn()}
        status="error"
        error={full}
        onStart={vi.fn()}
      />,
    );
    const el = screen.getByTestId('api-mock-server-error');
    expect(el).toHaveTextContent(full);
    expect(el.textContent).not.toMatch(/\.\.\.$/);
    expect(el.getAttribute('role')).toBe('alert');
  });

  it('disables start while busy and shows the transitional label', () => {
    render(<ApiMockServerBar server={makeServer()} onUpdate={vi.fn()} status="starting" onStart={vi.fn()} />);
    const start = screen.getByTestId('api-mock-start');
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Starting…');
  });

  it('copies the address and toggles the button label', async () => {
    render(<ApiMockServerBar server={makeServer()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-copy-address'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://127.0.0.1:4600/api');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('api-mock-copy-address')).toHaveAttribute('title', 'Copied!');
    act(() => { vi.runAllTimers(); });
    expect(screen.getByTestId('api-mock-copy-address')).toHaveAttribute('title', 'Copy address');
  });

  it('swallows clipboard failures without crashing', () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<ApiMockServerBar server={makeServer()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByTestId('api-mock-copy-address'));
    expect(screen.getByTestId('api-mock-copy-address')).toHaveAttribute('title', 'Copy address');
  });
});
