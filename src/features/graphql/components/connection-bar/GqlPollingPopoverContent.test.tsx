/**
 * @vitest-environment jsdom
 *
 * GqlPollingPopoverContent — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GqlPollingPopoverContent } from './GqlPollingPopoverContent';

function defaultProps(overrides = {}) {
  return {
    pollingEnabled: false,
    localIntervalSeconds: 60,
    setLocalIntervalSeconds: vi.fn(),
    onPollingChange: vi.fn(),
    onClose: vi.fn(),
    commitPollingInterval: vi.fn(() => 60),
    intervalInputId: 'test-interval',
    pollingSwitchRef: { current: null } as React.RefObject<HTMLButtonElement>,
    popoverRef: { current: null } as React.RefObject<HTMLDivElement>,
    popoverPos: { top: 100, right: 20 },
    ...overrides,
  };
}

describe('GqlPollingPopoverContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the popover with data-testid', () => {
    render(<GqlPollingPopoverContent {...defaultProps()} />);
    expect(screen.getByTestId('gql-polling-popover')).toBeInTheDocument();
  });

  it('accepts a custom data-testid', () => {
    render(<GqlPollingPopoverContent {...defaultProps({ 'data-testid': 'my-popover' })} />);
    expect(screen.getByTestId('my-popover')).toBeInTheDocument();
  });

  it('renders the close button and calls onClose when clicked', () => {
    const onClose = vi.fn();
    render(<GqlPollingPopoverContent {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Close polling config'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the toggle switch', () => {
    render(<GqlPollingPopoverContent {...defaultProps()} />);
    expect(screen.getByTestId('gql-polling-toggle')).toBeInTheDocument();
  });

  it('calls onPollingChange when toggle row is clicked', () => {
    const onPollingChange = vi.fn();
    const setLocalIntervalSeconds = vi.fn();
    render(<GqlPollingPopoverContent {...defaultProps({ onPollingChange, setLocalIntervalSeconds })} />);
    const row = screen.getByRole('none');
    fireEvent.click(row);
    expect(onPollingChange).toHaveBeenCalled();
    expect(setLocalIntervalSeconds).toHaveBeenCalled();
  });

  it('uses fallback interval=30 when localIntervalSeconds=0 in toggle row click', () => {
    const onPollingChange = vi.fn();
    const setLocalIntervalSeconds = vi.fn();
    render(
      <GqlPollingPopoverContent
        {...defaultProps({ localIntervalSeconds: 0, onPollingChange, setLocalIntervalSeconds })}
      />,
    );
    const row = screen.getByRole('none');
    fireEvent.click(row);
    // Should use fallback 30 when 0 is passed
    expect(setLocalIntervalSeconds).toHaveBeenCalledWith(30);
    expect(onPollingChange).toHaveBeenCalledWith(true, 30);
  });

  it('calls onPollingChange when toggle button is clicked', () => {
    const onPollingChange = vi.fn();
    render(<GqlPollingPopoverContent {...defaultProps({ onPollingChange })} />);
    fireEvent.click(screen.getByTestId('gql-polling-toggle'));
    expect(onPollingChange).toHaveBeenCalled();
  });

  it('uses fallback interval=30 when localIntervalSeconds=0 in toggle button click', () => {
    const onPollingChange = vi.fn();
    const setLocalIntervalSeconds = vi.fn();
    render(
      <GqlPollingPopoverContent
        {...defaultProps({ localIntervalSeconds: 0, onPollingChange, setLocalIntervalSeconds })}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-polling-toggle'));
    expect(setLocalIntervalSeconds).toHaveBeenCalledWith(30);
    expect(onPollingChange).toHaveBeenCalledWith(true, 30);
  });

  it('renders the interval input when pollingEnabled=true', () => {
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true })} />);
    expect(screen.getByTestId('gql-polling-interval-input')).toBeInTheDocument();
  });

  it('does not render interval input when pollingEnabled=false', () => {
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: false })} />);
    expect(screen.queryByTestId('gql-polling-interval-input')).toBeNull();
  });

  it('calls setLocalIntervalSeconds when interval input changes', () => {
    const setLocalIntervalSeconds = vi.fn();
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true, setLocalIntervalSeconds })} />);
    fireEvent.change(screen.getByTestId('gql-polling-interval-input'), { target: { value: '120' } });
    expect(setLocalIntervalSeconds).toHaveBeenCalledWith(120);
  });

  it('falls back to 0 when interval input is not a valid number', () => {
    const setLocalIntervalSeconds = vi.fn();
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true, setLocalIntervalSeconds })} />);
    fireEvent.change(screen.getByTestId('gql-polling-interval-input'), { target: { value: 'abc' } });
    expect(setLocalIntervalSeconds).toHaveBeenCalledWith(0);
  });

  it('calls commitPollingInterval on interval input blur', () => {
    const commitPollingInterval = vi.fn(() => 60);
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true, commitPollingInterval })} />);
    fireEvent.blur(screen.getByTestId('gql-polling-interval-input'));
    expect(commitPollingInterval).toHaveBeenCalled();
  });

  it('calls commitPollingInterval on Enter key in interval input', () => {
    const commitPollingInterval = vi.fn(() => 60);
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true, commitPollingInterval })} />);
    fireEvent.keyDown(screen.getByTestId('gql-polling-interval-input'), { key: 'Enter' });
    expect(commitPollingInterval).toHaveBeenCalled();
  });

  it('shows polling-enabled hint when pollingEnabled', () => {
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: true, localIntervalSeconds: 60 })} />);
    expect(screen.getByText(/re-introspected every/)).toBeInTheDocument();
  });

  it('shows polling-disabled hint when not enabled', () => {
    render(<GqlPollingPopoverContent {...defaultProps({ pollingEnabled: false })} />);
    expect(screen.getByText(/Automatically re-introspect/)).toBeInTheDocument();
  });

  it('applies style from popoverPos', () => {
    const { container } = render(
      <GqlPollingPopoverContent {...defaultProps({ popoverPos: { top: 200, right: 40 } })} />,
    );
    const popover = container.querySelector('.gql-polling-popover') as HTMLElement;
    expect(popover.style.top).toBe('200px');
    expect(popover.style.right).toBe('40px');
  });

  it('applies visibility:hidden style when popoverPos is null', () => {
    const { container } = render(
      <GqlPollingPopoverContent {...defaultProps({ popoverPos: null })} />,
    );
    const popover = container.querySelector('.gql-polling-popover') as HTMLElement;
    expect(popover.style.visibility).toBe('hidden');
  });
});
