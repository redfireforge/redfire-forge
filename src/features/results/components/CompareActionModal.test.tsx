// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompareActionModal } from './CompareActionModal';

describe('CompareActionModal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <CompareActionModal
        open={false}
        compareActionRunLabel="A"
        selectedRunLabel="B"
        onClose={vi.fn()}
        onUseAsCompared={vi.fn()}
        onSwapDirection={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders labels and action descriptions when open', () => {
    render(
      <CompareActionModal
        open
        compareActionRunLabel="run-a"
        selectedRunLabel="run-b"
        onClose={vi.fn()}
        onUseAsCompared={vi.fn()}
        onSwapDirection={vi.fn()}
      />,
    );

    expect(screen.getByText('Choose Comparison Action')).toBeTruthy();
    expect(screen.getByText(/You selected:/)).toBeTruthy();
    expect(screen.getByText(/Current baseline run:/)).toBeTruthy();
    expect(screen.getByText(/Use As Compared Run:/)).toBeTruthy();
    expect(screen.getByText(/Swap Direction:/)).toBeTruthy();
  });

  it('fires callback actions', () => {
    const onClose = vi.fn();
    const onUseAsCompared = vi.fn();
    const onSwapDirection = vi.fn();

    render(
      <CompareActionModal
        open
        compareActionRunLabel="run-a"
        selectedRunLabel="run-b"
        onClose={onClose}
        onUseAsCompared={onUseAsCompared}
        onSwapDirection={onSwapDirection}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use As Compared Run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap Direction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onUseAsCompared).toHaveBeenCalledTimes(1);
    expect(onSwapDirection).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows None when selected run label is empty', () => {
    render(
      <CompareActionModal
        open
        compareActionRunLabel="run-a"
        selectedRunLabel=""
        onClose={vi.fn()}
        onUseAsCompared={vi.fn()}
        onSwapDirection={vi.fn()}
      />,
    );

    expect(screen.getByText('None')).toBeTruthy();
  });
});
