/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CatalogDarkSelect from './CatalogDarkSelect';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('CatalogDarkSelect', () => {
  it('renders fallback selected option when value does not exist and handles empty options', () => {
    const { rerender } = render(
      <CatalogDarkSelect value="missing" options={options} onChange={vi.fn()} aria-label="Engine" />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    rerender(<CatalogDarkSelect value="missing" options={[]} onChange={vi.fn()} aria-label="Engine" />);
    expect(screen.getByRole('button', { name: 'Engine' })).toBeInTheDocument();
  });

  it('opens, repositions on resize/scroll, selects an option and closes', () => {
    const onChange = vi.fn();
    render(<CatalogDarkSelect value="a" options={options} onChange={onChange} aria-label="Engine" />);

    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    expect(screen.getByRole('listbox', { name: 'Engine' })).toBeInTheDocument();

    fireEvent(window, new Event('resize'));
    fireEvent(document, new Event('scroll', { bubbles: true }));

    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox', { name: 'Engine' })).toBeNull();
  });

  it('closes on outside click and Escape and ignores non-Escape keydown', () => {
    render(<CatalogDarkSelect value="a" options={options} onChange={vi.fn()} aria-label="Engine" />);

    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    expect(screen.getByRole('listbox', { name: 'Engine' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: 'Engine' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox', { name: 'Engine' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: 'Engine' })).toBeNull();
  });

  it('does not crash when trigger lookup returns null during reposition', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'querySelector');
    spy.mockImplementation(function mockQuery(selector: string) {
      if (selector === '.cat-dark-select__trigger' && this.classList?.contains('cat-dark-select')) return null;
      return Element.prototype.querySelector.call(this, selector);
    });

    render(<CatalogDarkSelect value="a" options={options} onChange={vi.fn()} aria-label="Engine" />);
    fireEvent.click(screen.getByRole('button', { name: 'Engine' }));
    fireEvent(window, new Event('resize'));

    spy.mockRestore();
  });
});
