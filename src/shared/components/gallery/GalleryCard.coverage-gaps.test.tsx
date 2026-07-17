/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryCard } from './GalleryCard';
import type { GalleryEntry } from '../../../data/galleries/types';

function makeEntry(overrides: Partial<GalleryEntry<string>> = {}): GalleryEntry<string> {
  return {
    id: 'gap-1',
    domain: 'requests',
    name: 'Gap Entry',
    description: 'Coverage gap sample',
    icon: '📦',
    category: 'crud',
    difficulty: 'easy',
    tags: ['alpha', 'beta'],
    liveApis: ['https://example.com'],
    factory: () => 'payload',
    ...overrides,
  };
}

describe('GalleryCard coverage gaps', () => {
  it('covers selected, status badge, tutorial tag branch, and optional onClick', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <GalleryCard
        entry={makeEntry({
          tags: ['versioning-tutorial', 'one', 'two', 'three', 'four'],
          liveApis: [],
        })}
        selected
        sampleStatus="updated"
        showDomain
        onClick={onClick}
      />,
    );
    expect(screen.getByText(/versioning-tutorial/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.queryByText('#four')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <GalleryCard
        entry={makeEntry({ tags: ['versioning-tutorial'] })}
        sampleStatus="imported"
      />,
    );
    expect(screen.getByText(/Loaded/)).toBeTruthy();
  });

  it('renders plain tags when tutorial tag is absent', () => {
    render(<GalleryCard entry={makeEntry({ tags: ['solo', 'pair', 'trio', 'quad', 'extra'] })} />);
    expect(screen.getByText('#solo')).toBeTruthy();
    expect(screen.getByText('#pair')).toBeTruthy();
    expect(screen.getByText('#trio')).toBeTruthy();
    expect(screen.getByText('#quad')).toBeTruthy();
    expect(screen.queryByText('#extra')).toBeNull();
  });
});
