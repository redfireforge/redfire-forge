/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MultiEnvResultRow from './MultiEnvResultRow';

vi.mock('./JsonTreePreview', () => ({
  default: function JsonPreviewStub({
    body,
    error,
    onToggle,
  }: {
    body?: string;
    error?: string;
    onToggle?: (path: string) => void;
  }) {
    return (
      <div data-testid="preview">
        {error ?? body ?? ''}
        <button type="button" aria-label="mock-toggle" onClick={() => onToggle?.('/')} />
      </div>
    );
  },
  buildJTreeFromBody: () => null,
}));

describe('MultiEnvResultRow', () => {
  it('invokes nested JsonPreview onToggle when expanded', () => {
    const { container } = render(
      <MultiEnvResultRow
        envName="Perf"
        response={{ status: 201, statusText: 'Created', headers: {}, body: '{}' }}
        time={3}
      />,
    );
    fireEvent.click(screen.getByText('Perf').closest('.req-multi-row-header')!);
    fireEvent.click(screen.getByRole('button', { name: 'mock-toggle' }));
    expect(container.querySelector('.success')).toBeTruthy();
  });

  it('toggles expand and shows preview with success styling for 200', () => {
    const { container } = render(
      <MultiEnvResultRow
        envName="QA"
        response={{
          status: 200,
          statusText: 'OK',
          headers: {},
          body: '{"a":1}',
        }}
        time={12}
      />,
    );
    expect(container.querySelector('.success')).toBeTruthy();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
    expect(screen.queryByTestId('preview')).toBeNull();
    fireEvent.click(screen.getByText('QA').closest('.req-multi-row-header')!);
    expect(screen.getByTestId('preview')).toHaveTextContent('{"a":1}');
    fireEvent.click(screen.getByText('QA').closest('.req-multi-row-header')!);
    expect(screen.queryByTestId('preview')).toBeNull();
  });

  it('uses non-success styling when status is 4xx', () => {
    const { container } = render(
      <MultiEnvResultRow
        envName="Staging"
        response={{ status: 404, statusText: 'Not Found', headers: {}, body: '{}' }}
        time={8}
      />,
    );
    expect(container.querySelector('.error')).toBeTruthy();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('labels non-success HTTP codes outside 2xx as error rows including 301', () => {
    const { container } = render(
      <MultiEnvResultRow
        envName="Edge"
        response={{ status: 301, statusText: 'Moved', headers: {}, body: '{}' }}
        time={2}
      />,
    );
    expect(container.querySelector('.error')).toBeTruthy();
    expect(screen.getByText('301')).toBeInTheDocument();
  });

  it('uses ERR label and error class when status is zero', () => {
    const { container } = render(
      <MultiEnvResultRow
        envName="DEV"
        response={{
          status: 0,
          statusText: '',
          headers: {},
          body: '',
          error: 'timeout',
        }}
        time={5000}
      />,
    );
    expect(container.querySelector('.error')).toBeTruthy();
    expect(screen.getByText('ERR')).toBeInTheDocument();
    fireEvent.click(screen.getByText('DEV').closest('.req-multi-row-header')!);
    expect(screen.getByTestId('preview')).toHaveTextContent('timeout');
  });
});
