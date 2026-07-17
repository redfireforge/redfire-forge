/**
 * @vitest-environment jsdom
 *
 * GraphqlCollectionsIcons — unit tests.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChevronIcon, PlusIcon, ExportIcon, ImportIcon } from './GraphqlCollectionsIcons';

describe('ChevronIcon', () => {
  it('renders without expanded class when expanded=false', () => {
    const { container } = render(<ChevronIcon expanded={false} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // SVG className is SVGAnimatedString — use getAttribute
    expect(svg!.getAttribute('class') ?? '').not.toContain('gql-col-chevron--open');
  });

  it('renders with expanded class when expanded=true', () => {
    const { container } = render(<ChevronIcon expanded={true} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // SVG className is SVGAnimatedString — use getAttribute
    expect(svg!.getAttribute('class')).toContain('gql-col-chevron--open');
  });
});

describe('PlusIcon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<PlusIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

describe('ExportIcon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ExportIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});

describe('ImportIcon', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ImportIcon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
