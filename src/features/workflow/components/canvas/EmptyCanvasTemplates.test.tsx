/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmptyCanvasTemplates from './EmptyCanvasTemplates';
import { emptyCanvasTemplates } from '../../data/emptyCanvasTemplates';

describe('EmptyCanvasTemplates', () => {
  it('renders divider text', () => {
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    expect(screen.getByText('or start from a template')).toBeInTheDocument();
  });

  it('renders template cards for each template', () => {
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    for (const template of emptyCanvasTemplates) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
  });

  it('shows node count and difficulty in metadata', () => {
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    for (const template of emptyCanvasTemplates) {
      const metaText = `${template.nodeCount} nodes · ${template.difficulty}`;
      expect(screen.getByText(metaText)).toBeInTheDocument();
    }
  });

  it('renders browse gallery link', () => {
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    expect(screen.getByText('Browse All Templates →')).toBeInTheDocument();
  });

  it('calls onSelectTemplate when a template card is clicked', () => {
    const onSelectTemplate = vi.fn();
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={onSelectTemplate}
        onBrowseGallery={vi.fn()}
      />
    );
    const firstTemplate = emptyCanvasTemplates[0];
    const card = screen.getByText(firstTemplate.name).closest('button')!;
    fireEvent.click(card);
    expect(onSelectTemplate).toHaveBeenCalledTimes(1);
    expect(onSelectTemplate).toHaveBeenCalledWith(firstTemplate);
  });

  it('calls onBrowseGallery when browse link is clicked', () => {
    const onBrowseGallery = vi.fn();
    render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={onBrowseGallery}
      />
    );
    fireEvent.click(screen.getByText('Browse All Templates →'));
    expect(onBrowseGallery).toHaveBeenCalledTimes(1);
  });

  it('renders template icons', () => {
    const { container } = render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    const icons = container.querySelectorAll('.wf-empty-template-icon');
    expect(icons.length).toBe(emptyCanvasTemplates.length);
  });

});
