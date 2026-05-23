/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import OnboardingTooltip from './OnboardingTooltip';
import type { OnboardingHint } from '../../data/onboardingHints';

const mockHint: OnboardingHint = {
  id: 'test-hint',
  target: '.test-target',
  title: 'Test Title',
  message: 'Test message content',
  placement: 'bottom',
  triggerOn: 'mount',
  priority: 1,
};

function appendTarget() {
  const target = document.createElement('div');
  target.className = 'test-target';
  target.style.position = 'fixed';
  target.style.top = '100px';
  target.style.left = '100px';
  target.style.width = '100px';
  target.style.height = '50px';
  document.body.appendChild(target);
  return target;
}

describe('OnboardingTooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    appendTarget();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('renders title and message', () => {
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  it('shows remaining count when more than 1', () => {
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(screen.getByText('3 tips left')).toBeInTheDocument();
  });

  it('hides remaining count when only 1 left', () => {
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={1}
      />
    );

    expect(screen.queryByText(/tips left/)).not.toBeInTheDocument();
  });

  it('calls onDismiss when Got it button clicked', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    fireEvent.click(screen.getByText('Got it'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    fireEvent.click(screen.getByLabelText('Dismiss hint'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismissAll when Skip all tips clicked', () => {
    const onDismissAll = vi.fn();
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={onDismissAll}
        remainingCount={3}
      />
    );

    fireEvent.click(screen.getByText('Skip all tips'));
    expect(onDismissAll).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Escape key pressed', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies correct placement class', () => {
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(container.querySelector('.onboarding-tooltip-bottom')).toBeInTheDocument();
  });

  it('renders with top placement', () => {
    const topHint = { ...mockHint, placement: 'top' as const };
    const { container } = render(
      <OnboardingTooltip
        hint={topHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(container.querySelector('.onboarding-tooltip-top')).toBeInTheDocument();
  });

  it('renders with left placement', () => {
    const leftHint = { ...mockHint, placement: 'left' as const };
    const { container } = render(
      <OnboardingTooltip
        hint={leftHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(container.querySelector('.onboarding-tooltip-left')).toBeInTheDocument();
  });

  it('renders with right placement', () => {
    const rightHint = { ...mockHint, placement: 'right' as const };
    const { container } = render(
      <OnboardingTooltip
        hint={rightHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    expect(container.querySelector('.onboarding-tooltip-right')).toBeInTheDocument();
  });

  it('has accessible role and aria-live', () => {
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    const tooltip = container.querySelector('.onboarding-tooltip');
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip).toHaveAttribute('aria-live', 'polite');
  });

  it('hides tooltip when target element is missing', () => {
    document.body.innerHTML = '';
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    const tooltip = container.querySelector('.onboarding-tooltip') as HTMLElement;
    expect(tooltip.style.opacity).toBe('0');
    expect(tooltip.style.pointerEvents).toBe('none');
  });

  it('shows tooltip when target is present after layout', async () => {
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const tooltip = container.querySelector('.onboarding-tooltip') as HTMLElement;
    expect(tooltip.style.opacity).toBe('1');
    expect(tooltip.style.pointerEvents).toBe('auto');
  });

  it('recalculates position on window resize', async () => {
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      fireEvent(window, new Event('resize'));
    });

    const tooltip = container.querySelector('.onboarding-tooltip') as HTMLElement;
    expect(tooltip.style.opacity).toBe('1');
  });

  it('recalculates position on scroll', async () => {
    const { container } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    act(() => {
      fireEvent.scroll(window);
    });

    const tooltip = container.querySelector('.onboarding-tooltip') as HTMLElement;
    expect(tooltip.style.opacity).toBe('1');
  });

  it('does not call onDismiss for non-Escape keys', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={onDismiss}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('recalculates position after hint id change', async () => {
    vi.useFakeTimers();
    const nextHint = { ...mockHint, id: 'next-hint', placement: 'top' as const };
    const { container, rerender } = render(
      <OnboardingTooltip
        hint={mockHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={3}
      />
    );

    rerender(
      <OnboardingTooltip
        hint={nextHint}
        onDismiss={vi.fn()}
        onDismissAll={vi.fn()}
        remainingCount={2}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(container.querySelector('.onboarding-tooltip-top')).toBeInTheDocument();
  });
});
