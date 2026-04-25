/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import ExpressionHintDropdown from './ExpressionHintDropdown';
import type { HintItem } from '../../hooks/useExpressionHints';

const varItems: HintItem[] = [
  { kind: 'variable', label: 'myVar', detail: 'A test variable', insertText: 'myVar}}' },
  { kind: 'variable', label: 'userId', detail: 'User ID', insertText: 'userId}}' },
];

const fnItems: HintItem[] = [
  {
    kind: 'function', label: '$upper', detail: 'Uppercase',
    insertText: '$upper(val)}}',
    meta: { name: '$upper', description: 'Convert to uppercase', signature: '$upper(value)', category: 'text', params: [{ name: 'value', description: 'Input' }] },
  },
];

function renderDropdown(props: Partial<React.ComponentProps<typeof ExpressionHintDropdown>> = {}) {
  const anchorRef = createRef<HTMLElement>();
  const defaults = {
    open: false,
    items: varItems,
    selectedIndex: 0,
    onSelect: vi.fn(),
    anchorRef,
    ...props,
  };

  // Create a real anchor element for getBoundingClientRect
  const anchor = document.createElement('input');
  anchor.style.position = 'absolute';
  anchor.style.top = '100px';
  anchor.style.left = '50px';
  anchor.style.width = '300px';
  anchor.style.height = '30px';
  document.body.appendChild(anchor);
  (defaults.anchorRef as React.MutableRefObject<HTMLElement>).current = anchor;

  const result = render(<ExpressionHintDropdown {...defaults} />);
  return { ...result, anchor, onSelect: defaults.onSelect };
}

describe('ExpressionHintDropdown', () => {
  afterEach(() => {
    // Clean up any anchors
    document.querySelectorAll('input[style]').forEach((el) => el.remove());
  });

  it('renders nothing when not open', () => {
    renderDropdown({ open: false });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders nothing when items are empty', () => {
    renderDropdown({ open: true, items: [] });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders a listbox with items when open', () => {
    renderDropdown({ open: true, items: varItems });
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    const options = listbox!.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
  });

  it('shows variable icon for variable items', () => {
    renderDropdown({ open: true, items: varItems });
    const icons = document.querySelectorAll('.expr-hint-icon-var');
    expect(icons.length).toBe(2);
    expect(icons[0].textContent).toBe('𝑥');
  });

  it('shows function icon for function items', () => {
    renderDropdown({ open: true, items: fnItems });
    const icons = document.querySelectorAll('.expr-hint-icon-fn');
    expect(icons.length).toBe(1);
    expect(icons[0].textContent).toBe('ƒ');
  });

  it('shows function signature in detail', () => {
    renderDropdown({ open: true, items: fnItems });
    const detail = document.querySelector('.expr-hint-detail');
    expect(detail!.textContent).toBe('$upper(value)');
  });

  it('shows variable description in detail', () => {
    renderDropdown({ open: true, items: varItems });
    const details = document.querySelectorAll('.expr-hint-detail');
    expect(details[0].textContent).toBe('A test variable');
  });

  it('highlights the selected index', () => {
    renderDropdown({ open: true, items: varItems, selectedIndex: 1 });
    const options = document.querySelectorAll('[role="option"]');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[1].className).toContain('expr-hint-item-active');
  });

  it('calls onSelect on mouseDown', () => {
    const { onSelect } = renderDropdown({ open: true, items: varItems });
    const options = document.querySelectorAll('[role="option"]');
    const event = new MouseEvent('mousedown', { bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    options[1].dispatchEvent(event);
    expect(onSelect).toHaveBeenCalledWith(varItems[1]);
  });

  it('renders with mixed variable and function items', () => {
    const mixed = [...varItems, ...fnItems];
    renderDropdown({ open: true, items: mixed });
    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
    expect(document.querySelectorAll('.expr-hint-icon-var').length).toBe(2);
    expect(document.querySelectorAll('.expr-hint-icon-fn').length).toBe(1);
  });

  it('has proper z-index for layering', () => {
    renderDropdown({ open: true, items: varItems });
    const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox.style.zIndex).toBe('10100');
  });
});
