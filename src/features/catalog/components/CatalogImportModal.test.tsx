/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import CatalogImportModal from './CatalogImportModal';

describe('CatalogImportModal — Sample Gallery tab', () => {
  const defaultProps = {
    existingEntries: [],
    onImport: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders the Sample Gallery tab', () => {
    render(<CatalogImportModal {...defaultProps} />);
    expect(screen.getByText('Sample Gallery')).toBeTruthy();
  });

  it('shows gallery cards when Sample Gallery tab is clicked', () => {
    const { container } = render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const cards = container.querySelectorAll('.cat-gallery-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows gallery search and category pills', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    expect(screen.getByPlaceholderText('Search sample APIs...')).toBeTruthy();
    expect(screen.getByText('Webhooks')).toBeTruthy();
    expect(screen.getByText('REST API')).toBeTruthy();
  });

  it('filters cards by category', () => {
    const { container } = render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const allCount = container.querySelectorAll('.cat-gallery-card').length;
    fireEvent.click(screen.getByText('Webhooks'));
    const webhookCount = container.querySelectorAll('.cat-gallery-card').length;
    expect(webhookCount).toBeLessThanOrEqual(allCount);
    expect(webhookCount).toBeGreaterThan(0);
  });

  it('filters cards by search text', () => {
    const { container } = render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const allCount = container.querySelectorAll('.cat-gallery-card').length;
    const searchInput = screen.getByPlaceholderText('Search sample APIs...');
    fireEvent.change(searchInput, { target: { value: 'Correlation' } });
    const filteredCount = container.querySelectorAll('.cat-gallery-card').length;
    expect(filteredCount).toBeLessThanOrEqual(allCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  it('shows empty state when search has no match', () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const searchInput = screen.getByPlaceholderText('Search sample APIs...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('No samples match your search.')).toBeTruthy();
  });

  it('navigates to preview when a gallery card is clicked', async () => {
    render(<CatalogImportModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Sample Gallery'));
    const card = screen.getByText('Correlation Wait API');
    fireEvent.click(card.closest('button')!);
    // Should navigate to preview step — look for the preview content
    await vi.waitFor(() => {
      expect(screen.getByText(/Valid OpenAPI/)).toBeTruthy();
    });
  });
});
