/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockPatternToolboxModal } from './ApiMockPatternToolboxModal';
import type { ApiMockPathMatcherV1 } from '../../../shared/api-mock/contracts';

function renderModal(initial: ApiMockPathMatcherV1 = { kind: 'parameterized', value: '/users/:id' }) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<ApiMockPatternToolboxModal initial={initial} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose };
}

describe('ApiMockPatternToolboxModal', () => {
  it('shows a live match with captured params and applies the matcher', () => {
    const { onApply, onClose } = renderModal();
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('Matches');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('id=123');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-apply'));
    expect(onApply).toHaveBeenCalledWith({ kind: 'parameterized', value: '/users/:id', flags: undefined });
    expect(onClose).toHaveBeenCalled();
  });

  it('covers toggle, kind select, sample editing, and a non-match danger state', () => {
    renderModal({ kind: 'exact', value: '/users' });

    const kind = screen.getByTestId('api-mock-toolbox-kind');
    fireEvent.click(kind.querySelector('.cs-trigger') as HTMLElement);
    fireEvent.click(document.querySelector('[role="option"][data-value="regex"]') as HTMLElement);

    fireEvent.click(screen.getByTestId('api-mock-toolbox-ci'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-pattern'), { target: { value: '^/users/[0-9]+$' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-sample'), { target: { value: '/orders/x' } });

    const result = screen.getByTestId('api-mock-toolbox-result');
    expect(result.textContent).toContain('Does not match');
    expect(result.className).toContain('danger');
  });

  it('applies presets and can cancel without applying', () => {
    const { onApply, onClose } = renderModal({ kind: 'exact', value: '/' });

    fireEvent.click(screen.getByTestId('api-mock-toolbox-preset-nested params'));
    expect((screen.getByTestId('api-mock-toolbox-pattern') as HTMLInputElement).value).toBe('/orders/{orderId}/items/{itemId}');
    expect((screen.getByTestId('api-mock-toolbox-sample') as HTMLInputElement).value).toBe('/orders/7/items/3');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('orderId=7');
    expect(screen.getByTestId('api-mock-toolbox-result').textContent).toContain('itemId=3');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-cancel'));
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
