/**
 * @vitest-environment jsdom
 *
 * GqlDedupBanner — unit tests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GqlDedupBanner } from './GqlDedupBanner';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GqlDedupBanner — rendering', () => {
  it('renders nothing when visible=false', () => {
    const { container } = render(
      <GqlDedupBanner visible={false} onWait={vi.fn()} onCancelOriginal={vi.fn()} onSendAnyway={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when visible=true', () => {
    render(
      <GqlDedupBanner visible={true} onWait={vi.fn()} onCancelOriginal={vi.fn()} onSendAnyway={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.getByText('Duplicate in-flight')).not.toBeNull();
  });

  it('renders all three action buttons', () => {
    render(
      <GqlDedupBanner visible={true} onWait={vi.fn()} onCancelOriginal={vi.fn()} onSendAnyway={vi.fn()} />,
    );
    expect(screen.getByText('Wait & merge')).not.toBeNull();
    expect(screen.getByText('Cancel original')).not.toBeNull();
    expect(screen.getByText('Send anyway')).not.toBeNull();
  });
});

describe('GqlDedupBanner — interactions', () => {
  it('calls onWait when "Wait & merge" is clicked', () => {
    const onWait = vi.fn();
    render(
      <GqlDedupBanner visible={true} onWait={onWait} onCancelOriginal={vi.fn()} onSendAnyway={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Wait & merge'));
    expect(onWait).toHaveBeenCalled();
  });

  it('calls onCancelOriginal when "Cancel original" is clicked', () => {
    const onCancelOriginal = vi.fn();
    render(
      <GqlDedupBanner visible={true} onWait={vi.fn()} onCancelOriginal={onCancelOriginal} onSendAnyway={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Cancel original'));
    expect(onCancelOriginal).toHaveBeenCalled();
  });

  it('calls onSendAnyway when "Send anyway" is clicked', () => {
    const onSendAnyway = vi.fn();
    render(
      <GqlDedupBanner visible={true} onWait={vi.fn()} onCancelOriginal={vi.fn()} onSendAnyway={onSendAnyway} />,
    );
    fireEvent.click(screen.getByText('Send anyway'));
    expect(onSendAnyway).toHaveBeenCalled();
  });
});
