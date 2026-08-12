/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockImportReview } from './ApiMockImportReview';

describe('ApiMockImportReview', () => {
  it('switches import modes and non-curl sources', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-import-mode-replace'));
    expect(screen.getByTestId('api-mock-import-mode-replace')).toHaveClass('active');
    fireEvent.click(screen.getByTestId('api-mock-import-mode-copy'));
    expect(screen.getByTestId('api-mock-import-mode-copy')).toHaveClass('active');

    fireEvent.click(screen.getByTestId('api-mock-import-source-openapi'));
    expect(screen.getByText(/OpenAPI\/Swagger import/i)).toBeTruthy();
    fireEvent.click(screen.getByTestId('api-mock-import-source-native'));
    expect(screen.getByText(/RedfireForge\/WireMock import/i)).toBeTruthy();
  });

  it('ignores parse when curl input is blank', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    expect(screen.queryByTestId('api-mock-import-confirm')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('parses a curl command, shows a preview, and imports the generated route', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl -X POST https://api.example.com/users?active=true -H 'Content-Type: application/json' -H 'X-Tenant: acme' -d '{\"name\":\"Alice\"}'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    expect(screen.getByText('Generated route (exact-by-default)')).toBeTruthy();
    expect(screen.getByText('POST')).toBeTruthy();
    expect(screen.getByText('/users')).toBeTruthy();
    expect(screen.getByTestId('api-mock-import-confirm')).toBeTruthy();

    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));
    expect(onImport).toHaveBeenCalledTimes(1);
    const imported = onImport.mock.calls[0][0][0];
    expect(imported.method).toBe('POST');
    expect(imported.path.value).toBe('/users');
  });

  it('cancels from the preview state', () => {
    const onCancel = vi.fn();
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={onCancel} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), { target: { value: 'curl /users' } });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders diagnostics for unknown methods and invalid json bodies', () => {
    render(<ApiMockImportReview onImport={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl -X FOO https://api.example.com/users -H 'Content-Type: application/json' -d 'not-json'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));

    expect(screen.getByText('Diagnostics')).toBeTruthy();
    expect(screen.getByText(/Unknown HTTP method/i)).toBeTruthy();
    expect(screen.getByText(/not valid JSON/i)).toBeTruthy();
  });

  it('parses relative paths, data-raw bodies, and header values containing colons', () => {
    const onImport = vi.fn();
    render(<ApiMockImportReview onImport={onImport} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByTestId('api-mock-curl-input'), {
      target: {
        value: "curl /orders?x=1 -H 'X-Trace: a:b:c' --data-raw 'raw-body'",
      },
    });
    fireEvent.click(screen.getByTestId('api-mock-curl-parse'));
    fireEvent.click(screen.getByTestId('api-mock-import-confirm'));

    const imported = onImport.mock.calls[0][0][0];
    expect(imported.path.value).toBe('/orders');
    expect(imported.responses).toHaveLength(1);
  });
});
