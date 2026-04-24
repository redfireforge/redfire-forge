/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import TemplateGalleryModal from './TemplateGalleryModal';

describe('TemplateGalleryModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <TemplateGalleryModal open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector('.tg-overlay')).toBeNull();
  });

  it('renders modal when open is true', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Template Gallery')).toBeTruthy();
  });

  it('renders category tabs', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('All Templates')).toBeTruthy();
    expect(screen.getByText('Basics')).toBeTruthy();
    expect(screen.getByText('Logic')).toBeTruthy();
  });

  it('renders template cards', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    const cards = container.querySelectorAll('.tg-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('filters by category when tab is clicked', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    const allCount = container.querySelectorAll('.tg-card').length;
    fireEvent.click(screen.getByText('Basics'));
    const filteredCount = container.querySelectorAll('.tg-card').length;
    expect(filteredCount).toBeLessThanOrEqual(allCount);
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={onSelect} />,
    );
    const firstCard = container.querySelector('.tg-card') as HTMLElement;
    fireEvent.click(firstCard);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={onClose} onSelect={vi.fn()} />,
    );
    const overlay = container.querySelector('.tg-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<TemplateGalleryModal open={true} onClose={onClose} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<TemplateGalleryModal open={true} onClose={onClose} onSelect={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
