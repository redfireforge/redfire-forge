/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn().mockResolvedValue(undefined),
}));

import { readKey, writeKey } from '../../shared/utils/storage';
import { AppCloudWaitlistBanner } from './AppCloudWaitlistBanner';

const mockReadKey = readKey as ReturnType<typeof vi.fn>;
const mockWriteKey = writeKey as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockWriteKey.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppCloudWaitlistBanner', () => {
  it('renders nothing while dismissed state is loading (null)', () => {
    mockReadKey.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<AppCloudWaitlistBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when storage returns a non-true value', async () => {
    mockReadKey.mockResolvedValue('false');
    render(<AppCloudWaitlistBanner />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toBeInTheDocument(),
    );
    expect(screen.getByText(/RedfireForge Cloud/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Join the waitlist/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
  });

  it('renders the banner when storage returns null (first visit)', async () => {
    mockReadKey.mockResolvedValue(null);
    render(<AppCloudWaitlistBanner />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toBeInTheDocument(),
    );
  });

  it('hides the banner when storage returns "true" (already dismissed)', async () => {
    mockReadKey.mockResolvedValue('true');
    const { container } = render(<AppCloudWaitlistBanner />);
    await waitFor(() => expect(mockReadKey).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('dismisses the banner and writes to storage when the close button is clicked', async () => {
    mockReadKey.mockResolvedValue('false');
    const { container } = render(<AppCloudWaitlistBanner />);
    await waitFor(() => screen.getByRole('button', { name: /Dismiss/i }));

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));

    expect(container.firstChild).toBeNull();
    expect(mockWriteKey).toHaveBeenCalledWith('cloud-waitlist-dismissed', 'true');
  });

  it('waitlist link points to tally.so with source param', async () => {
    mockReadKey.mockResolvedValue(null);
    render(<AppCloudWaitlistBanner />);
    await waitFor(() => screen.getByRole('link', { name: /Join the waitlist/i }));

    const link = screen.getByRole('link', { name: /Join the waitlist/i }) as HTMLAnchorElement;
    expect(link.href).toContain('tally.so');
    expect(link.href).toContain('source=in-app');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('privacy link opens in a new tab', async () => {
    mockReadKey.mockResolvedValue(null);
    render(<AppCloudWaitlistBanner />);
    await waitFor(() => screen.getByRole('link', { name: /Privacy Policy/i }));

    const link = screen.getByRole('link', { name: /Privacy Policy/i }) as HTMLAnchorElement;
    expect(link.href).toContain('PRIVACY.md');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });
});
