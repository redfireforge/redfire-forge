/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../features/gallery/GalleryPage', () => ({
  GalleryPage: ({ initialDomain }: { initialDomain?: string }) => (
    <div data-testid="gallery-page">{initialDomain ?? 'all'}</div>
  ),
}));
vi.mock('../../features/training/TrainingTracksView', () => ({
  default: ({ onNavigateToSample }: { onNavigateToSample: () => void }) => (
    <button data-testid="open-gallery" onClick={onNavigateToSample}>open gallery</button>
  ),
}));
vi.mock('../../config/features', () => ({
  DEMO_HUB_ENABLED: true,
}));

import { AppDiscoveryPanes } from './AppDiscoveryPanes';

const gallery = {
  importedSamples: [],
  onImportRequest: vi.fn(),
  onTryItRequest: vi.fn(),
  onImportCatalog: vi.fn(),
  onImportTest: vi.fn(),
  onImportWorkflow: vi.fn(),
  onImportApiMock: vi.fn(),
  onNavigateTo: vi.fn(),
};

describe('AppDiscoveryPanes', () => {
  it('renders the gallery pane with the requested domain', () => {
    render(
      <AppDiscoveryPanes
        activeTab="gallery"
        gallery={gallery}
        galleryInitialDomain="api-mock"
        onOpenGallery={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gallery-page')).toHaveTextContent('api-mock');
  });

  it('mounts the demo hub pane when that tab is active', () => {
    const { container } = render(
      <AppDiscoveryPanes activeTab="demo-hub" gallery={gallery} onOpenGallery={vi.fn()} />,
    );
    expect(container.querySelector('.demo-hub-pane')).toBeTruthy();
  });

  it('renders training and forwards open-gallery', () => {
    const onOpenGallery = vi.fn();
    render(
      <AppDiscoveryPanes activeTab="training" gallery={gallery} onOpenGallery={onOpenGallery} />,
    );
    fireEvent.click(screen.getByTestId('open-gallery'));
    expect(onOpenGallery).toHaveBeenCalled();
  });

  it('renders nothing for unrelated tabs', () => {
    const { container } = render(
      <AppDiscoveryPanes activeTab="requests" gallery={gallery} onOpenGallery={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
