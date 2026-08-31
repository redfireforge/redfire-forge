/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { DesktopRequiredModal } from './DesktopRequiredModal';

vi.mock('../hooks/useDesktopDownloadInfo', () => ({
  useDesktopDownloadInfo: () => ({
    label: 'Download v1.2.3 for macOS',
    href: 'https://example.com/a.dmg',
    version: '1.2.3',
    loading: false,
  }),
}));

vi.mock('../utils/desktopFeatureGate', () => ({
  featureRequiresDesktopReason: (name: string) => `${name} requires desktop.`,
}));

describe('DesktopRequiredModal', () => {
  it('renders feature reason and benefits list', () => {
    render(<DesktopRequiredModal featureName="gRPC Studio" onClose={vi.fn()} />);
    expect(screen.getByTestId('desktop-required-modal')).toBeTruthy();
    expect(screen.getByText('gRPC Studio requires desktop.')).toBeTruthy();
    expect(screen.getByText('API Mock Server')).toBeTruthy();
    expect(screen.getByText('gRPC / Kafka testing')).toBeTruthy();
  });

  it('dismisses via Maybe later', () => {
    const onClose = vi.fn();
    render(<DesktopRequiredModal featureName="API Mock Server" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('desktop-required-later'));
    expect(onClose).toHaveBeenCalled();
  });

  it('offers download link', () => {
    render(<DesktopRequiredModal featureName="Kafka Studio" onClose={vi.fn()} />);
    const link = screen.getByTestId('desktop-required-download');
    expect(link).toHaveAttribute('href', 'https://example.com/a.dmg');
    expect(link).toHaveTextContent('Download v1.2.3 for macOS');
  });
});
