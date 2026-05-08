/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { createRef, type ComponentProps, type RefObject } from 'react';
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

function renderDropdown(props: Partial<ComponentProps<typeof ExpressionHintDropdown>> = {}) {
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

  it('renders nothing when anchor ref has no element', () => {
    const anchorRef: RefObject<HTMLElement> = { current: null };
    render(
      <ExpressionHintDropdown
        open
        items={varItems}
        selectedIndex={0}
        onSelect={vi.fn()}
        anchorRef={anchorRef}
      />,
    );
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('positions dropdown above anchor when space below is tighter than space above', () => {
    const innerHeight = window.innerHeight;
    try {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
      const anchorRef = createRef<HTMLElement>();
      const anchor = document.createElement('input');
      anchor.getBoundingClientRect = () =>
        ({ bottom: 380, left: 10, width: 100, top: 360, right: 110, height: 20, x: 10, y: 360, toJSON: () => ({}) } as DOMRect);
      document.body.appendChild(anchor);
      (anchorRef as React.MutableRefObject<HTMLElement | null>).current = anchor;
      render(
        <ExpressionHintDropdown
          open
          items={varItems}
          selectedIndex={0}
          onSelect={vi.fn()}
          anchorRef={anchorRef}
        />,
      );
      const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
      expect(Number.parseFloat(listbox.style.top)).toBeLessThan(360);
      anchor.remove();
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
    }
  });

  it('scrolls selected option into view when list ref exists', async () => {
    const anchorRef = createRef<HTMLElement>();
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () =>
      ({ bottom: 50, left: 0, width: 200, top: 0, right: 200, height: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    (anchorRef as React.MutableRefObject<HTMLElement | null>).current = anchor;
    const scrollIntoView = vi.fn();
    const { rerender } = render(
      <ExpressionHintDropdown
        open
        items={varItems}
        selectedIndex={0}
        onSelect={vi.fn()}
        anchorRef={anchorRef}
      />,
    );
    const listbox = document.querySelector('[role="listbox"]')!;
    const opt1 = listbox.children[1] as HTMLElement;
    opt1.scrollIntoView = scrollIntoView;
    rerender(
      <ExpressionHintDropdown
        open
        items={varItems}
        selectedIndex={1}
        onSelect={vi.fn()}
        anchorRef={anchorRef}
      />,
    );
    expect(scrollIntoView).toHaveBeenCalled();
    anchor.remove();
  });
});
