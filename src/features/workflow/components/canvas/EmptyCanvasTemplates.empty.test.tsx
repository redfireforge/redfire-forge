/**
 * @vitest-environment jsdom
 * Separate test file for EmptyCanvasTemplates with empty templates array.
 * Using a separate file because vi.mock affects the entire module scope.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../data/emptyCanvasTemplates', () => ({
  emptyCanvasTemplates: [],
}));

describe('EmptyCanvasTemplates with empty templates', () => {
  it('returns null when emptyCanvasTemplates is empty', async () => {
    const { default: EmptyCanvasTemplates } = await import('./EmptyCanvasTemplates');
    const { container } = render(
      <EmptyCanvasTemplates
        onSelectTemplate={vi.fn()}
        onBrowseGallery={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
