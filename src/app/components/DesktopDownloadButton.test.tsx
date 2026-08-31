/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DesktopDownloadButton } from './DesktopDownloadButton';

vi.mock('../utils/desktopFeatureGate', () => ({
  shouldShowWebDownloadCta: () => mockShow(),
}));
vi.mock('../hooks/useDesktopDownloadInfo', () => ({
  useDesktopDownloadInfo: () => mockInfo(),
}));

const mockShow = vi.fn(() => true);
const mockInfo = vi.fn(() => ({
  label: 'Download v1.2.3 for macOS',
  href: 'https://example.com/a.dmg',
  version: '1.2.3',
  loading: false,
}));

describe('DesktopDownloadButton', () => {
  beforeEach(() => {
    mockShow.mockReturnValue(true);
    mockInfo.mockReturnValue({
      label: 'Download v1.2.3 for macOS',
      href: 'https://example.com/a.dmg',
      version: '1.2.3',
      loading: false,
    });
  });

  it('renders nothing when CTA is hidden', () => {
    mockShow.mockReturnValue(false);
    const { container } = render(<DesktopDownloadButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders OS-aware download link', () => {
    render(<DesktopDownloadButton />);
    const link = screen.getByTestId('desktop-download-btn');
    expect(link).toHaveAttribute('href', 'https://example.com/a.dmg');
    expect(link).toHaveTextContent('Download v1.2.3 for macOS');
  });

  it('sets aria-busy while loading', () => {
    mockInfo.mockReturnValue({
      label: 'Download Desktop App',
      href: 'https://github.com/redfireforge/redfireforge-public/releases',
      version: null,
      loading: true,
    });
    render(<DesktopDownloadButton />);
    expect(screen.getByTestId('desktop-download-btn')).toHaveAttribute('aria-busy', 'true');
  });
});
