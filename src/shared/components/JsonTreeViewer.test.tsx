/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import JsonTreeViewer from './JsonTreeViewer';

describe('JsonTreeViewer', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders empty state for null and undefined parsed root', () => {
    const { rerender } = render(<JsonTreeViewer data={null} />);
    expect(screen.getByText('null')).toHaveClass('jtv-empty');

    rerender(<JsonTreeViewer data={undefined as unknown as null} />);
    expect(screen.getByText('null')).toHaveClass('jtv-empty');
  });

  it('renders primitive root for number, boolean, and non-JSON string', () => {
    const { container, rerender } = render(<JsonTreeViewer data={42} />);
    expect(container.querySelector('.jtv-number')).toHaveTextContent('42');

    rerender(<JsonTreeViewer data={false} />);
    expect(container.querySelector('.jtv-boolean')).toHaveTextContent('false');

    rerender(<JsonTreeViewer data="plain text" copyable={false} />);
    expect(container.querySelector('.jtv-string')).toHaveTextContent('"plain text"');

    rerender(<JsonTreeViewer data={42} compact maxHeight={220} />);
    expect(container.firstChild).toHaveClass('jtv-compact');
    expect(container.firstChild).toHaveStyle({ maxHeight: '220px' });

    rerender(<JsonTreeViewer data={42} maxHeight={0} />);
    expect(container.firstChild).not.toHaveClass('jtv-compact');
    const primitiveRoot = container.firstChild as HTMLElement;
    expect(primitiveRoot.getAttribute('style') ?? '').not.toMatch(/max-height\s*:/i);
  });

  it('parses valid JSON string input into structured tree', () => {
    const json = '{"a":1,"b":"ok"}';
    render(<JsonTreeViewer data={json} />);
    expect(screen.getAllByText('a').some((el) => el.classList.contains('jtv-key'))).toBe(true);
    expect(screen.getByTitle('Copy JSON')).toBeInTheDocument();
  });

  it('uses pretty-printed stringify for copied text when JSON string is valid', async () => {
    const inner = '{"x": 1 }';
    render(<JsonTreeViewer data={inner} />);
    fireEvent.click(screen.getByTitle('Copy JSON'));
    await act(async () => {
      Promise.resolve().then(() => {});
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toContain('"x": 1');
    expect(writeText.mock.calls[0]![0]).toContain('\n');
  });

  it('handles invalid JSON string as primitive root (no copy UI) and pretty copy when wrapped in JSON', async () => {
    const raw = '{"broken":';
    const { rerender } = render(<JsonTreeViewer data={raw} copyable />);

    expect(screen.queryByRole('button', { name: 'Copy JSON' })).not.toBeInTheDocument();
    expect(document.querySelector('.jtv-string')).toHaveTextContent(JSON.stringify(raw));

    rerender(<JsonTreeViewer data={JSON.stringify({ raw })} />);
    fireEvent.click(screen.getByTitle('Copy JSON'));
    await act(async () => {
      Promise.resolve().then(() => {});
    });

    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ raw }, null, 2));
  });

  it('omits copy button when copyable is false', () => {
    render(<JsonTreeViewer data={{ ok: true }} copyable={false} />);
    expect(screen.queryByTitle('Copy JSON')).not.toBeInTheDocument();
  });

  it('applies compact class and maxHeight style', () => {
    const { container, rerender } = render(<JsonTreeViewer data={{}} compact />);
    expect(container.firstChild).toHaveClass('jtv-compact');
    expect(container.firstChild).toHaveStyle({ maxHeight: '400px' });

    rerender(<JsonTreeViewer data={{}} maxHeight={0} />);
    expect(container.firstChild).not.toHaveStyle({ maxHeight: '400px' });
    const styleAttr = container.firstChild?.hasAttribute?.('style');
    if (styleAttr) {
      expect(container.firstChild).toHaveAttribute('style', '');
    }
  });

  it('shows copy success state briefly then restores text', async () => {
    render(<JsonTreeViewer data={{ k: 'v' }} />);
    const btn = screen.getByTitle('Copy JSON');
    expect(btn.textContent).toBe('Copy');

    fireEvent.click(btn);
    await act(async () => {
      Promise.resolve().then(() => {});
    });

    expect(btn.textContent).toBe('✓');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(btn.textContent).toBe('Copy');
  });

  it('renders nested object/array with expand/collapse and root class', () => {
    render(
      <JsonTreeViewer
        data={{
          nested: { deep: [] },
          list: ['a'],
        }}
        defaultExpandDepth={3}
      />,
    );

    expect(document.querySelector('.jtv-node-root')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(screen.getByText('list')).toBeInTheDocument();
    expect(
      [...document.querySelectorAll('.jtv-string')]
        .map((el) => el.textContent!.replace(/\s/g, ''))
        .includes('"a"'),
    ).toBe(true);
  });

  it('collapse node shows ellipsis with key vs item wording', () => {
    render(
      <JsonTreeViewer
        data={{ obj: { a: 1, b: 2 }, arr: [1, 2] }}
        defaultExpandDepth={1}
      />,
    );

    expect(screen.getByText('2 keys')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
  });

  it('toggle row expands collapsed children', () => {
    render(
      <JsonTreeViewer
        data={{ only: 'child' }}
        defaultExpandDepth={0}
      />,
    );

    expect(document.querySelector('.jtv-children')).toBeNull();
    const rootToggle = document.querySelector('.jtv-line-toggle')!;
    fireEvent.click(rootToggle);
    expect(document.querySelector('.jtv-children')).toBeTruthy();
    expect(within(document.body).getByText('only')).toBeInTheDocument();
    fireEvent.click(rootToggle);
    expect(document.querySelector('.jtv-children')).toBeNull();
  });

  it('renders empty object and empty array branches', () => {
    render(
      <JsonTreeViewer
        data={{ emptyObj: {}, emptyArr: [] }}
        defaultExpandDepth={10}
      />,
    );

    const lines = document.querySelectorAll('.jtv-line');
    const braces = [...lines].map((l) => l.textContent);
    expect(braces.some((t) => t?.includes('{}'))).toBe(true);
    expect(braces.some((t) => t?.includes('[]'))).toBe(true);
  });

  it('renders null property, numbers, booleans, and commas for non-last siblings', () => {
    render(
      <JsonTreeViewer
        data={{
          n: null,
          num: 3.14,
          ok: true,
          nope: false,
        }}
        defaultExpandDepth={5}
      />,
    );

    expect(screen.getByText('n')).toBeInTheDocument();
    const lines = [...document.querySelectorAll('.jtv-line')]
      .map((el) => el.textContent!.replace(/\s/g, ''));

    expect(lines.some((t) => t.includes('null'))).toBe(true);
    expect(lines.some((t) => t.includes(','))).toBe(true);
    expect([...document.querySelectorAll('.jtv-number')].some((el) => el.textContent === '3.14')).toBe(true);
    expect([...document.querySelectorAll('.jtv-boolean')].map((el) => el.textContent).sort()).toEqual([
      'false',
      'true',
    ]);
  });

  it('detects URLs in string values as links', () => {
    render(
      <JsonTreeViewer
        data={{ link: 'https://example.test/path?q=1' }}
        defaultExpandDepth={10}
      />,
    );

    const link = screen.getByRole('link', {
      name: 'https://example.test/path?q=1',
    });
    expect(link).toHaveAttribute('href', 'https://example.test/path?q=1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('marks long strings (+120 chars) and sets title for full value', () => {
    const long = 'z'.repeat(121);
    render(
      <JsonTreeViewer
        data={{ s: long }}
        defaultExpandDepth={10}
      />,
    );

    const wrap = [...document.querySelectorAll('.jtv-string')]
      .find((el) => el.classList.contains('jtv-string-long'))!;
    expect(wrap).toBeTruthy();
    expect(wrap).toHaveAttribute('title', long);
    expect(within(document.body).getByTitle(long)).toBeTruthy();
  });

  it('string without URL path uses plain span text inside quotes', () => {
    render(
      <JsonTreeViewer
        data={{ s: '/not-an-url/local' }}
        defaultExpandDepth={10}
      />,
    );
    expect(document.querySelector('.jtv-url')).toBeNull();
    expect(within(document.body).getByText('/not-an-url/local', { exact: false })).toBeInTheDocument();
  });

  it('pass-through object/array from non-string data stringifies consistently for copy', async () => {
    const payload = [{ id: 'x' }] as Record<string, unknown>[];
    render(<JsonTreeViewer data={payload} />);

    fireEvent.click(screen.getByTitle('Copy JSON'));
    await act(async () => {
      Promise.resolve().then(() => {});
    });

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(payload, null, 2));
  });
});
