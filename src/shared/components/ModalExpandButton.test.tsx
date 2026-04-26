/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ModalExpandButton from './ModalExpandButton';

describe('ModalExpandButton', () => {
  it('renders expand icon when not expanded', () => {
    const { container } = render(
      <ModalExpandButton expanded={false} onToggle={() => {}} />,
    );
    const btn = container.querySelector('.modal-expand-btn')!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('⊕');
    expect(btn.getAttribute('aria-label')).toBe('Expand modal');
    expect(btn.getAttribute('title')).toBe('Expand modal');
  });

  it('renders shrink icon when expanded', () => {
    const { container } = render(
      <ModalExpandButton expanded={true} onToggle={() => {}} />,
    );
    const btn = container.querySelector('.modal-expand-btn')!;
    expect(btn.textContent).toBe('⊖');
    expect(btn.getAttribute('aria-label')).toBe('Shrink modal');
    expect(btn.getAttribute('title')).toBe('Shrink modal');
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <ModalExpandButton expanded={false} onToggle={onToggle} />,
    );
    fireEvent.click(container.querySelector('.modal-expand-btn')!);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('defaults to header position (no bottom class)', () => {
    const { container } = render(
      <ModalExpandButton expanded={false} onToggle={() => {}} />,
    );
    const btn = container.querySelector('.modal-expand-btn')!;
    expect(btn.classList.contains('modal-expand-btn-bottom')).toBe(false);
  });

  it('applies bottom class for footer position', () => {
    const { container } = render(
      <ModalExpandButton expanded={false} onToggle={() => {}} position="footer" />,
    );
    const btn = container.querySelector('.modal-expand-btn')!;
    expect(btn.classList.contains('modal-expand-btn-bottom')).toBe(true);
  });

  it('does not apply bottom class for header position', () => {
    const { container } = render(
      <ModalExpandButton expanded={false} onToggle={() => {}} position="header" />,
    );
    const btn = container.querySelector('.modal-expand-btn')!;
    expect(btn.classList.contains('modal-expand-btn-bottom')).toBe(false);
  });
});
