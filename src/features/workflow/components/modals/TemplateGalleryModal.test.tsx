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
    expect(container.querySelector('.tg-content')).toBeNull();
  });

  it('renders content when open is true', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('Template Gallery')).toBeTruthy();
  });

  it('renders category tabs', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('All Templates')).toBeTruthy();
    expect(screen.getByText('API Patterns')).toBeTruthy();
    expect(screen.getByText('Flow Control')).toBeTruthy();
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
    fireEvent.click(screen.getByText('API Patterns'));
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

  it('renders node filter dropdown', () => {
    render(<TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByLabelText('Filter by node type')).toBeTruthy();
  });

  it('renders cards with data-cat and difficulty dots', () => {
    const { container } = render(
      <TemplateGalleryModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    const firstCard = container.querySelector('.tg-card') as HTMLElement;
    expect(firstCard.dataset.cat).toBeTruthy();
    expect(['api', 'flow', 'event', 'orch']).toContain(firstCard.dataset.cat);
    const dots = firstCard.querySelectorAll('.tg-difficulty-dots .tg-dot');
    expect(dots.length).toBe(3);
  });
});
