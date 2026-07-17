/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConceptSlide, { renderMarkdown } from './ConceptSlide';
import type { ConceptContent } from './types';
vi.mock('./utils/checkEndpoint', () => ({
  checkEndpoint: vi.fn().mockResolvedValue(false),
}));

vi.mock('@shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('./adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./adapters')>();
  return {
    ...actual,
    countUserTabsInStorage: vi.fn().mockResolvedValue(0),
    userTabsToCloseForLesson: vi.fn(() => 0),
  };
});

// ── ConceptSlide ────────────────────────────────────────────────

describe('ConceptSlide', () => {
  const baseConcept: ConceptContent = {
    title: 'WebSocket Basics',
    body: 'WebSockets provide **full-duplex** communication.',
  };

  it('renders title', () => {
    render(<ConceptSlide concept={baseConcept} />);
    expect(screen.getByText('WebSocket Basics')).toBeTruthy();
  });

  it('renders body as HTML with bold formatting', () => {
    const { container } = render(<ConceptSlide concept={baseConcept} />);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('full-duplex');
  });

  it('renders key terms when provided', () => {
    const concept: ConceptContent = {
      ...baseConcept,
      keyTerms: [{ term: 'WebSocket', definition: 'A protocol for real-time communication' }],
    };
    render(<ConceptSlide concept={concept} />);
    expect(screen.getByText('Key Terms')).toBeTruthy();
    expect(screen.getByText('WebSocket')).toBeTruthy();
  });

  it('does not render key terms when empty', () => {
    render(<ConceptSlide concept={baseConcept} />);
    expect(screen.queryByText('Key Terms')).toBeNull();
  });

  it('renders diagram when provided', () => {
    const concept: ConceptContent = {
      ...baseConcept,
      diagram: '<svg><circle r="10"/></svg>',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const wrapper = container.querySelector('.demo-concept-diagram');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector('svg')).toBeTruthy();
  });

  it('renders bullet list', () => {
    const concept: ConceptContent = {
      title: 'Lists',
      body: '- Item 1\n- Item 2',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  it('renders numbered list', () => {
    const concept: ConceptContent = {
      title: 'Steps',
      body: '1. First\n2. Second',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    expect(container.querySelector('ol')).toBeTruthy();
  });

  it('renders inline code', () => {
    const concept: ConceptContent = {
      title: 'Code',
      body: 'Use `ws://localhost` to connect.',
    };
    const { container } = render(<ConceptSlide concept={concept} />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('ws://localhost');
  });
});

// ── renderMarkdown ──────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('wraps plain text in <p>', () => {
    expect(renderMarkdown('Hello')).toBe('<p>Hello</p>');
  });

  it('renders bold text', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('Use `foo` here')).toContain('<code>foo</code>');
  });

  it('renders bullet lists', () => {
    const html = renderMarkdown('- One\n- Two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>One</li>');
    expect(html).toContain('<li>Two</li>');
  });

  it('renders numbered lists', () => {
    const html = renderMarkdown('1. First\n2. Second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  it('renders markdown tables', () => {
    const md = '| Name | Value |\n| --- | --- |\n| Foo | 1 |\n| Bar | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Foo</td>');
    expect(html).toContain('<td>2</td>');
  });

  it('renders fenced code blocks', () => {
    const md = '```\nconst x = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="demo-concept-code">');
    expect(html).toContain('const x = 1;');
  });

  it('escapes HTML in fenced code blocks', () => {
    const md = '```\n<div>&test</div>\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;div&gt;');
    expect(html).toContain('&amp;test');
  });

  it('handles multiple paragraphs', () => {
    const html = renderMarkdown('First para\n\nSecond para');
    expect(html).toContain('<p>First para</p>');
    expect(html).toContain('<p>Second para</p>');
  });

  it('converts line breaks within a paragraph to <br/>', () => {
    const html = renderMarkdown('Line 1\nLine 2');
    expect(html).toContain('Line 1<br/>Line 2');
  });

  it('renders table with leading text', () => {
    const md = 'Header text\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<p>Header text</p>');
    expect(html).toContain('<table');
  });

  it('handles asterisk bullet lists', () => {
    const html = renderMarkdown('* Alpha\n* Beta');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Alpha</li>');
  });

  it('renders fenced code block with language tag', () => {
    const md = '```typescript\nconst a = 1;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre class="demo-concept-code">');
    expect(html).toContain('const a = 1;');
  });

  it('preserves multiple code blocks', () => {
    const md = '```\nblock1\n```\n\n```\nblock2\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('block1');
    expect(html).toContain('block2');
  });

  it('handles empty string', () => {
    const html = renderMarkdown('');
    expect(html).toBeTruthy();
  });

  it('escapes angle brackets in inline code', () => {
    expect(renderMarkdown('Path `/<service>/<method>`')).toContain('&lt;service&gt;/&lt;method&gt;');
  });

  it('escapes angle brackets in plain text', () => {
    expect(renderMarkdown('POST to /<service>/<method>')).toContain('&lt;service&gt;/&lt;method&gt;');
  });

  it('handles table cells with formatting', () => {
    const md = '| **Name** | `code` |\n| --- | --- |\n| x | y |';
    const html = renderMarkdown(md);
    expect(html).toContain('<strong>Name</strong>');
    expect(html).toContain('<code>code</code>');
  });
});
