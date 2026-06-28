/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GalleryGrid } from './GalleryGrid';
import type { GalleryEntry } from '../../../data/galleries/types';

function baseEntry(id: string, overrides: Partial<GalleryEntry<unknown>> = {}): GalleryEntry<unknown> {
  return {
    id,
    domain: 'requests',
    name: `Sample ${id}`,
    description: `Desc ${id}`,
    icon: 'i',
    category: 'apis',
    difficulty: 'easy',
    tags: ['alpha'],
    liveApis: ['https://api.example.com'],
    factory: () => ({}),
    ...overrides,
  };
}

describe('GalleryGrid — coverage gaps', () => {
  it('updates domain filter when initialDomain prop changes', () => {
    const { rerender } = render(
      <GalleryGrid entries={[baseEntry('e1'), baseEntry('e2', { domain: 'catalog' })]} initialDomain="requests" />,
    );
    rerender(
      <GalleryGrid entries={[baseEntry('e1'), baseEntry('e2', { domain: 'catalog' })]} initialDomain="catalog" />,
    );
    expect(screen.getByText(/1 sample/)).toBeTruthy();
    expect(screen.getByText('Sample e2')).toBeTruthy();
  });

});
