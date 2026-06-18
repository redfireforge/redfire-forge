/**
 * @vitest-environment jsdom
 *
 * GeneratedQueryPreview — unit tests.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GeneratedQueryPreview } from './GeneratedQueryPreview';

const mockTokenizeSDL = vi.fn((line: string) => [{ text: line, cls: null as string | null }]);

vi.mock('../../utils/sdlTokenizer', () => ({
  tokenizeSDL: (line: string) => mockTokenizeSDL(line),
}));

describe('GeneratedQueryPreview', () => {
  it('renders the query preview container', () => {
    render(<GeneratedQueryPreview sdl="query { hello }" variables={{}} />);
    expect(screen.getByTestId('gql-qb-preview')).toBeInTheDocument();
  });

  it('renders each line of the SDL', () => {
    render(<GeneratedQueryPreview sdl={'query {\n  hello\n}'} variables={{}} />);
    const code = screen.getByTestId('gql-qb-code');
    expect(code).toBeInTheDocument();
    // Should have 3 lines
    const lines = code.querySelectorAll('.gql-qb-code-line');
    expect(lines).toHaveLength(3);
  });

  it('does not render variables section when variables is empty', () => {
    render(<GeneratedQueryPreview sdl="query { hello }" variables={{}} />);
    expect(screen.queryByText('Variables')).toBeNull();
  });

  it('renders variables section when variables are present', () => {
    const { container } = render(<GeneratedQueryPreview sdl="query { hello }" variables={{ id: '1' }} />);
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(container.querySelector('.gql-qb-vars-body')).not.toBeNull();
  });

  it('renders line numbers', () => {
    const { container } = render(<GeneratedQueryPreview sdl={'line1\nline2'} variables={{}} />);
    const lineNumbers = container.querySelectorAll('.gql-qb-ln');
    expect(lineNumbers.length).toBeGreaterThan(0);
  });

  it('renders tokens with a CSS class when tok.cls is set', () => {
    mockTokenizeSDL.mockReturnValueOnce([
      { text: 'query', cls: 'gql-kw' },
      { text: ' { hello }', cls: null },
    ]);
    const { container } = render(<GeneratedQueryPreview sdl="query { hello }" variables={{}} />);
    const keyword = container.querySelector('.gql-kw');
    expect(keyword).not.toBeNull();
    expect(keyword?.textContent).toBe('query');
  });

  it('pretty-prints the variables JSON', () => {
    const vars = { id: '1', name: 'Alice' };
    const { container } = render(<GeneratedQueryPreview sdl="query { hello }" variables={vars} />);
    const pre = container.querySelector('.gql-qb-vars-body');
    expect(pre?.textContent).toContain('"id"');
    expect(pre?.textContent).toContain('"Alice"');
  });
});
