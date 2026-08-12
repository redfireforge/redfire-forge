/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApiMockStudioPage } from './ApiMockStudioPage';

describe('ApiMockStudioPage', () => {
  beforeEach(() => localStorage.clear());
  it('renders empty state with create button', () => {
    render(<ApiMockStudioPage />);
    expect(screen.getByTestId('api-mock-empty')).toBeTruthy();
    expect(screen.getByTestId('api-mock-create-first')).toBeTruthy();
  });

  it('creates a server and shows studio', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    expect(screen.getByTestId('api-mock-studio')).toBeTruthy();
    expect(screen.getByTestId('api-mock-server-tabs')).toBeTruthy();
    expect(screen.getByTestId('api-mock-server-bar')).toBeTruthy();
  });

  it('creates a route and shows editor', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    expect(screen.getByTestId('api-mock-route-editor')).toBeTruthy();
  });

  it('shows no-route message when no route selected', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    expect(screen.getByTestId('api-mock-no-route')).toBeTruthy();
  });

  it('creates multiple servers with tabs', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    const tabs = screen.getByTestId('api-mock-server-tabs');
    expect(tabs.querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it('switches active server on tab click', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-tab-add'));
    const tabs = screen.getByTestId('api-mock-server-tabs').querySelectorAll('[role="tab"]');
    fireEvent.click(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('edits route method', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const select = screen.getByTestId('api-mock-method-select');
    fireEvent.click(select.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="POST"]') as HTMLElement);
    expect(select.getAttribute('data-value')).toBe('POST');
  });

  it('edits route path', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const input = screen.getByTestId('api-mock-path-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/users' } });
    expect(input.value).toBe('/users');
  });

  it('edits route priority', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    fireEvent.click(screen.getByTestId('api-mock-add-route'));
    const input = screen.getByTestId('api-mock-priority-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');
  });

  it('shows empty routes message', () => {
    render(<ApiMockStudioPage />);
    fireEvent.click(screen.getByTestId('api-mock-create-first'));
    expect(screen.getByTestId('api-mock-routes-empty')).toBeTruthy();
  });
});
