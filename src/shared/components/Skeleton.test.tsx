/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Skeleton, { SkeletonGroup } from './Skeleton';

describe('Skeleton', () => {
  it('renders with default styles', () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('skeleton');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies custom width and height via style attribute', () => {
    render(<Skeleton width="200px" height="50px" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton.style.width).toBe('200px');
    expect(skeleton.style.height).toBe('50px');
  });

  it('applies custom borderRadius via style attribute', () => {
    render(<Skeleton borderRadius="50%" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton.style.borderRadius).toBe('50%');
  });

  it('applies additional className', () => {
    render(<Skeleton className="my-custom-class" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveClass('skeleton', 'my-custom-class');
  });

  describe('variants', () => {
    it('applies text variant styles', () => {
      render(<Skeleton variant="text" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('100%');
      expect(skeleton.style.height).toBe('0.875rem');
      expect(skeleton.style.borderRadius).toBe('4px');
    });

    it('applies title variant styles', () => {
      render(<Skeleton variant="title" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('60%');
      expect(skeleton.style.height).toBe('1.25rem');
      expect(skeleton.style.borderRadius).toBe('4px');
    });

    it('applies avatar variant styles', () => {
      render(<Skeleton variant="avatar" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('40px');
      expect(skeleton.style.height).toBe('40px');
      expect(skeleton.style.borderRadius).toBe('50%');
    });

    it('applies button variant styles', () => {
      render(<Skeleton variant="button" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('80px');
      expect(skeleton.style.height).toBe('32px');
      expect(skeleton.style.borderRadius).toBe('6px');
    });

    it('applies card variant styles', () => {
      render(<Skeleton variant="card" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('100%');
      expect(skeleton.style.height).toBe('120px');
      expect(skeleton.style.borderRadius).toBe('8px');
    });

    it('allows custom props to override variant styles', () => {
      render(<Skeleton variant="text" width="50%" height="2rem" />);
      const skeleton = screen.getByRole('status');
      expect(skeleton.style.width).toBe('50%');
      expect(skeleton.style.height).toBe('2rem');
    });
  });
});

describe('SkeletonGroup', () => {
  it('renders default number of skeletons', () => {
    render(<SkeletonGroup />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(3);
  });

  it('renders specified count of skeletons', () => {
    render(<SkeletonGroup count={5} />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(5);
  });

  it('applies gap to container', () => {
    const { container } = render(<SkeletonGroup gap="16px" />);
    const group = container.querySelector('.skeleton-group') as HTMLElement;
    expect(group?.style.gap).toBe('16px');
  });

  it('applies additional className to container', () => {
    const { container } = render(<SkeletonGroup className="my-group" />);
    const group = container.querySelector('.skeleton-group');
    expect(group).toHaveClass('skeleton-group', 'my-group');
  });

  it('passes itemProps to each skeleton', () => {
    render(<SkeletonGroup count={2} itemProps={{ variant: 'avatar' }} />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(2);
    skeletons.forEach(skeleton => {
      expect((skeleton as HTMLElement).style.width).toBe('40px');
      expect((skeleton as HTMLElement).style.height).toBe('40px');
    });
  });
});
