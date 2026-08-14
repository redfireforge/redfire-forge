/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiMockStudioPage } from './ApiMockStudioPage';

/** Creating a server asks the control plane for a free port, so it settles async. */
async function createFirstServer() {
  render(<ApiMockStudioPage />);
  fireEvent.click(screen.getByTestId('api-mock-create-first'));
  await screen.findByTestId('api-mock-studio');
}

function serverTabs() {
  return screen.getByTestId('api-mock-server-tabs').querySelectorAll('[role="tab"]');
}

/** Add a tab and wait for the auto-port round trip to land it in the tab bar. */
async function addServerTab(expectedTabs: number) {
  fireEvent.click(screen.getByTestId('api-mock-tab-add'));
  await waitFor(() => expect(serverTabs().length).toBe(expectedTabs));
}

describe('ApiMockStudioPage', () => {
  beforeEach(() => localStorage.clear());
  it('renders empty state with create button', () => {
    render(<ApiMockStudioPage />);
    expect(screen.getByTestId('api-mock-empty')).toBeTruthy();
    expect(screen.getByTestId('api-mock-create-first')).toBeTruthy();
  });

  it('creates a server and shows studio', async () => {
    await createFirstServer();
    expect(screen.getByTestId('api-mock-server-tabs')).toBeTruthy();
    expect(screen.getByTestId('api-mock-server-bar')).toBeTruthy();
  });

  it('creates a route and shows editor', async () => {
    await createFirstServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    expect(screen.getByTestId('api-mock-route-editor')).toBeTruthy();
  });

  it('shows no-route message when no route selected', async () => {
    await createFirstServer();
    expect(screen.getByTestId('api-mock-no-route')).toBeTruthy();
  });

  it('creates multiple servers with tabs', async () => {
    await createFirstServer();
    await addServerTab(2);
  });

  it('switches active server on tab click', async () => {
    await createFirstServer();
    await addServerTab(2);
    const tabs = serverTabs();
    fireEvent.click(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('edits route method', async () => {
    await createFirstServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const select = screen.getByTestId('api-mock-method-select');
    fireEvent.click(select.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="POST"]') as HTMLElement);
    expect(select.getAttribute('data-value')).toBe('POST');
  });

  it('edits route path', async () => {
    await createFirstServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const input = screen.getByTestId('api-mock-path-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/users' } });
    expect(input.value).toBe('/users');
  });

  it('edits route priority', async () => {
    await createFirstServer();
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const input = screen.getByTestId('api-mock-priority-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');
  });

  it('shows empty routes message', async () => {
    await createFirstServer();
    expect(screen.getByTestId('api-mock-routes-empty')).toBeTruthy();
  });
});
