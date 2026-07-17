/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NodeConfigureButton } from './NodeConfigureButton';

describe('NodeConfigureButton', () => {
  it('renders a button with the given title', () => {
    const { container } = render(<NodeConfigureButton title="Configure this step" onClick={vi.fn()} />);
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn?.title).toBe('Configure this step');
  });

  it('renders the edit SVG by default', () => {
    const { container } = render(<NodeConfigureButton title="Edit" onClick={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const paths = svg!.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('renders the open-external SVG for variant="open"', () => {
    const { container } = render(<NodeConfigureButton title="Open" onClick={vi.fn()} variant="open" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.querySelector('polyline')).toBeTruthy();
    expect(svg!.querySelector('line')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<NodeConfigureButton title="Click me" onClick={onClick} />);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the wf-node-configure-badge class', () => {
    const { container } = render(<NodeConfigureButton title="Test" onClick={vi.fn()} />);
    expect(container.querySelector('.wf-node-configure-badge')).toBeTruthy();
  });

  it('appends additional className when provided', () => {
    const { container } = render(<NodeConfigureButton title="Test" onClick={vi.fn()} className="extra-class" />);
    const btn = container.querySelector('button');
    expect(btn?.classList.contains('wf-node-configure-badge')).toBe(true);
    expect(btn?.classList.contains('extra-class')).toBe(true);
  });

  it('does not add extra class when className is not provided', () => {
    const { container } = render(<NodeConfigureButton title="Test" onClick={vi.fn()} />);
    const btn = container.querySelector('button');
    expect(btn?.className).toBe('wf-node-configure-badge');
  });

  it('treats an empty className like no extra class', () => {
    const { container } = render(<NodeConfigureButton title="Test" onClick={vi.fn()} className="" />);
    const btn = container.querySelector('button');
    expect(btn?.className).toBe('wf-node-configure-badge');
  });
});
