/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConceptSlide, { renderMarkdown } from './ConceptSlide';

describe('ConceptSlide — coverage gaps', () => {
  it('renders title, terms, and diagram when present', () => {
    render(
      <ConceptSlide
        concept={{
          title: 'Schema Diff',
          body: 'Compare **before** and **after**.',
          keyTerms: [
            { term: 'Breaking', definition: 'A change that can break clients' },
            { term: 'Informational', definition: 'A safe metadata change' },
          ],
          diagram: '<svg><text>demo</text></svg>',
        }}
      />, 
    );

    expect(screen.getByText('Schema Diff')).toBeTruthy();
    expect(screen.getByText('Key Terms')).toBeTruthy();
    expect(screen.getByText('Breaking')).toBeTruthy();
    expect(screen.getByText('Informational')).toBeTruthy();
    expect(document.querySelector('.demo-concept-diagram svg')).toBeTruthy();
  });

  it('omits terms and diagram when not provided', () => {
    render(<ConceptSlide concept={{ title: 'Empty', body: 'Only body.' }} />);
    expect(screen.getByText('Empty')).toBeTruthy();
    expect(document.querySelector('.demo-concept-terms')).toBeNull();
    expect(document.querySelector('.demo-concept-diagram')).toBeNull();
  });

  it('renders fenced code blocks and keeps escaped content safe', () => {
    const html = renderMarkdown('```ts\nconst x = 1 < 2 && 3 > 2\n```');
    expect(html).toContain('<pre class="demo-concept-code"><code>');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('normalizes literal newline escapes in prose after fenced code extraction', () => {
    const html = renderMarkdown('Line one\\n\\nLine two');
    expect(html).toContain('<p>Line one</p>');
    expect(html).toContain('<p>Line two</p>');
    expect(html).toContain('Line one');
    expect(html).toContain('Line two');
  });

  it('renders markdown tables including a leading paragraph block', () => {
    const html = renderMarkdown(
      'Summary line\n\nName | Type\n---|---\nmessage | string\ncount | int32',
    );

    expect(html).toContain('<table class="demo-concept-table">');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>message</td>');
    expect(html).toContain('<p>Summary line</p>');
  });

  it('renders bullet and numbered lists', () => {
    const bullets = renderMarkdown('- alpha\n- beta');
    const numbered = renderMarkdown('1. one\n2. two');

    expect(bullets).toContain('<ul>');
    expect(bullets).toContain('<li>alpha</li>');
    expect(numbered).toContain('<ol>');
    expect(numbered).toContain('<li>one</li>');
  });

  it('formats bold and inline code while escaping HTML', () => {
    const html = renderMarkdown('Use **bold** and `x < y` safely.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>x &lt; y</code>');
    expect(html).not.toContain('<script>');
  });
});
