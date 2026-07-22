/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CustomSelect } from './CustomSelect';

const simpleOptions = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', detail: 'Third letter' },
];

const groupedOptions = [
  {
    label: 'Primary',
    options: [
      { value: 'r', label: 'Red' },
      { value: 'b', label: 'Blue' },
    ],
  },
  {
    label: 'Secondary',
    options: [
      { value: 'o', label: 'Orange' },
    ],
  },
];

describe('CustomSelect', () => {
  it('renders trigger with placeholder when no value', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} placeholder="Pick one..." />);
    expect(screen.getByText('Pick one...')).toBeInTheDocument();
  });

  it('renders trigger with selected label when value is set', () => {
    render(<CustomSelect value="b" onChange={vi.fn()} options={simpleOptions} />);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('opens dropdown on click and shows all options', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows detail text for options that have it', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Third letter')).toBeInTheDocument();
  });

  it('calls onChange and closes on option click', () => {
    const onChange = vi.fn();
    render(<CustomSelect value="" onChange={onChange} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('marks selected option as active with checkmark', () => {
    render(<CustomSelect value="a" onChange={vi.fn()} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    const activeOption = document.querySelector('.cs-item.active');
    expect(activeOption).toBeTruthy();
    expect(activeOption?.querySelector('.cs-check')).toBeTruthy();
    expect(activeOption?.getAttribute('aria-selected')).toBe('true');
  });

  it('renders grouped options with group labels', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={groupedOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Secondary')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Orange')).toBeInTheDocument();
  });

  it('selects from grouped options correctly', () => {
    const onChange = vi.fn();
    render(<CustomSelect value="" onChange={onChange} options={groupedOptions} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Orange'));
    expect(onChange).toHaveBeenCalledWith('o');
  });

  it('does not open when disabled', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ignores keyboard toggles when disabled', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} disabled />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('sets aria-expanded correctly', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape key', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('passes data-testid and aria-label', () => {
    render(
      <CustomSelect
        value=""
        onChange={vi.fn()}
        options={simpleOptions}
        data-testid="my-select"
        aria-label="Choose option"
      />,
    );
    expect(document.querySelector('[data-testid="my-select"]')).toBeTruthy();
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Choose option');
  });

  it('applies sm size class', () => {
    const { container } = render(
      <CustomSelect value="" onChange={vi.fn()} options={simpleOptions} size="sm" />,
    );
    expect(container.querySelector('.cs-sm')).toBeTruthy();
  });

  it('skips disabled options on click', () => {
    const onChange = vi.fn();
    const opts = [
      { value: 'a', label: 'Active' },
      { value: 'x', label: 'Locked', disabled: true },
    ];
    render(<CustomSelect value="" onChange={onChange} options={opts} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Locked'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when clicking outside the wrapper', () => {
    render(<CustomSelect value="" onChange={vi.fn()} options={simpleOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('toggles from keyboard input and scrolls the active option into view', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
    });

    render(<CustomSelect value="b" onChange={vi.fn()} options={simpleOptions} />);
    const trigger = screen.getByRole('button');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });

    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.queryByRole('listbox')).toBeNull();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: original,
      configurable: true,
    });
  });
});
