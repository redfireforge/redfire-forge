/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockResponseTimingPanel } from './ApiMockResponseTimingPanel';
import { createDefaultResponse } from '../../../shared/api-mock/defaults';

describe('ApiMockResponseTimingPanel', () => {
  it('updates delay, jitter, max matches, probability, and expiry', () => {
    const onUpdateVariant = vi.fn();
    const variant = {
      ...createDefaultResponse('resp-1'),
      behavior: {
        delayMs: 10,
        jitterMs: 5,
        maxMatches: 2,
        probability: 0.5,
        expiresAt: '2026-12-01T12:00:00.000Z',
      },
    };
    render(<ApiMockResponseTimingPanel variant={variant} onUpdateVariant={onUpdateVariant} />);

    fireEvent.change(screen.getByTestId('api-mock-variant-delay'), { target: { value: '250' } });
    expect(onUpdateVariant).toHaveBeenCalledWith({
      behavior: expect.objectContaining({ delayMs: 250 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-jitter'), { target: { value: '15' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ jitterMs: 15 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-delay'), { target: { value: '' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ delayMs: 0 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-jitter'), { target: { value: 'abc' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ jitterMs: 0 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: '' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ maxMatches: undefined }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: '4' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ maxMatches: 4 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-max-matches'), { target: { value: '-3' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ maxMatches: 0 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ probability: undefined }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '1.5' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ probability: 1 }),
    });

    fireEvent.change(screen.getByTestId('api-mock-variant-probability'), { target: { value: '-0.2' } });
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ probability: 0 }),
    });

    fireEvent.click(screen.getByTitle('1 hour from now'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ expiresAt: expect.any(String) }),
    });

    fireEvent.click(screen.getByTitle('Clear expiry'));
    expect(onUpdateVariant).toHaveBeenLastCalledWith({
      behavior: expect.objectContaining({ expiresAt: undefined }),
    });
  });

  it('renders empty placeholders for unlimited probability and matches', () => {
    render(
      <ApiMockResponseTimingPanel
        variant={createDefaultResponse('resp-1')}
        onUpdateVariant={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-variant-max-matches')).toHaveValue(null);
    expect(screen.getByTestId('api-mock-variant-probability')).toHaveValue(null);
    expect(screen.getByTestId('api-mock-timing-spread')).toHaveTextContent('0±0 ms');
    expect(screen.getByTestId('api-mock-eligibility-summary')).toHaveTextContent(
      'Unlimited matches · Never expires · Always eligible',
    );
  });

  it('summarises a limited, expiring, flaky variant', () => {
    render(
      <ApiMockResponseTimingPanel
        variant={{
          ...createDefaultResponse('resp-1'),
          behavior: {
            delayMs: 800,
            jitterMs: 200,
            maxMatches: 1,
            probability: 0.5,
            expiresAt: '2026-12-01T12:00:00.000Z',
          },
        }}
        onUpdateVariant={vi.fn()}
      />,
    );
    expect(screen.getByTestId('api-mock-timing-spread')).toHaveTextContent('800±200 ms');
    expect(screen.getByTestId('api-mock-eligibility-summary').textContent).toMatch(/Limit 1/);
    expect(screen.getByTestId('api-mock-eligibility-summary').textContent).toMatch(/P=0\.5/);
    expect(screen.getByTestId('api-mock-eligibility-summary').textContent).toMatch(/Expires/);
  });
});
