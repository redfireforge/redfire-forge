/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OPENAPI_YAML =
  'openapi: "3.0.0"\ninfo:\n  title: Test\npaths:\n  /users:\n    get:\n      summary: Get users';

const SWAGGER_YAML =
  'swagger: "2.0"\ninfo:\n  title: Test\npaths:\n  /users:\n    get:\n      summary: Get users\n  /items:\n    post:\n      summary: Create item';

const PLAIN_YAML = 'info:\n  title: Plain\nversion: 1.0';

const OPENAPI_NO_PATHS = 'openapi: "3.0.0"\ninfo:\n  title: Test';

const ESCAPE_YAML = 'info:\n  desc: <script>alert("x")</script> & foo > bar';

const mockSetCurrentMatchIndex = vi.fn();
const mockClearNav = vi.fn();
let mockCurrentMatchIndex = 0;

vi.mock('../../../shared/components/FullPanelModal', () => ({
  default: ({
    title,
    children,
    footer,
    onClose,
  }: {
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="full-panel-modal">
      <h1 data-testid="modal-title">{title}</h1>
      <button type="button" data-testid="modal-header-close" onClick={onClose}>
        Header close
      </button>
      <div data-testid="modal-body">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
    </div>
  ),
}));

vi.mock('../../../shared/components/SearchMatchBar', () => ({
  SearchMatchBar: ({
    value,
    onChange,
    onPrev,
    onNext,
    onClear,
    onKeyDown,
    inputRef,
  }: {
    value: string;
    onChange: (v: string) => void;
    onPrev: () => void;
    onNext: () => void;
    onClear: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    inputRef?: React.RefObject<HTMLInputElement | null>;
  }) => (
    <div data-testid="search-match-bar">
      <input
        ref={inputRef}
        aria-label="Search YAML"
        data-testid="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" data-testid="search-prev" onClick={onPrev}>
        Prev
      </button>
      <button type="button" data-testid="search-next" onClick={onNext}>
        Next
      </button>
      <button type="button" data-testid="search-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  ),
}));

vi.mock('../../../shared/hooks/useSearchMatchNavigation', () => ({
  useSearchMatchNavigation: () => ({
    currentMatchIndex: mockCurrentMatchIndex,
    setCurrentMatchIndex: mockSetCurrentMatchIndex,
    clear: mockClearNav,
  }),
}));

import CatalogYamlViewerModal from './CatalogYamlViewerModal';

function renderModal(
  props: Partial<{ yaml: string; title: string; onClose: () => void }> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  render(
    <CatalogYamlViewerModal
      yaml={props.yaml ?? OPENAPI_YAML}
      title={props.title ?? 'My API Entry'}
      onClose={onClose}
    />,
  );
  return { onClose };
}

beforeEach(() => {
  mockCurrentMatchIndex = 0;
  mockSetCurrentMatchIndex.mockImplementation((index: number) => {
    mockCurrentMatchIndex = index;
  });
  mockClearNav.mockImplementation(() => {
    mockCurrentMatchIndex = 0;
  });

  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CatalogYamlViewerModal', () => {
  it('renders title with entry name', () => {
    renderModal({ title: 'Payments API' });
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Payments API — YAML Spec');
  });

  it('shows "YAML" badge for plain YAML', () => {
    renderModal({ yaml: PLAIN_YAML });
    expect(screen.getByText('YAML')).toBeInTheDocument();
  });

  it('shows "OpenAPI X.X" badge for openapi: specs', () => {
    renderModal({ yaml: OPENAPI_YAML });
    expect(screen.getByText('OpenAPI 3.0.0')).toBeInTheDocument();
  });

  it('shows "Swagger X.X" badge for swagger: specs', () => {
    renderModal({ yaml: SWAGGER_YAML });
    expect(screen.getByText('Swagger 2.0')).toBeInTheDocument();
  });

  it('shows endpoint count badge when paths with methods exist', () => {
    renderModal({ yaml: SWAGGER_YAML });
    expect(screen.getByText('2 endpoints')).toBeInTheDocument();
  });

  it('shows singular endpoint label for a single method', () => {
    renderModal({ yaml: OPENAPI_YAML });
    expect(screen.getByText('1 endpoint')).toBeInTheDocument();
  });

  it('does not show endpoint count when no paths section', () => {
    renderModal({ yaml: OPENAPI_NO_PATHS });
    expect(screen.queryByText(/endpoint/)).not.toBeInTheDocument();
  });

  it('shows line numbers matching line count', () => {
    const { container } = render(
      <CatalogYamlViewerModal yaml={PLAIN_YAML} title="Plain" onClose={vi.fn()} />,
    );
    const lineCount = PLAIN_YAML.split('\n').length;
    const lineNumbers = container.querySelectorAll('.cat-yaml-lineno');
    expect(lineNumbers).toHaveLength(lineCount);
    expect(lineNumbers[0]).toHaveTextContent('1');
    expect(lineNumbers[lineCount - 1]).toHaveTextContent(String(lineCount));
  });

  it('copy button copies to clipboard and shows "Copied" state', async () => {
    vi.useFakeTimers();
    renderModal({ yaml: OPENAPI_YAML });

    const copyBtn = screen.getByRole('button', { name: /Copy YAML/ });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(OPENAPI_YAML);
    expect(copyBtn).toHaveTextContent('✓ Copied');
    expect(copyBtn).toHaveClass('copied');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(copyBtn).toHaveTextContent('Copy YAML');
    expect(copyBtn).not.toHaveClass('copied');
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows footer with line count', () => {
    renderModal({ yaml: PLAIN_YAML });
    const lineCount = PLAIN_YAML.split('\n').length;
    expect(screen.getByText(`${lineCount} lines`)).toBeInTheDocument();
  });

  it('search highlights matching lines in gutter (cat-yaml-lineno--match class)', () => {
    const { container } = render(
      <CatalogYamlViewerModal yaml={OPENAPI_YAML} title="Search test" onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'title' } });

    const matchingGutterLines = container.querySelectorAll('.cat-yaml-lineno--match');
    expect(matchingGutterLines.length).toBeGreaterThan(0);

    const titleLineIndex = OPENAPI_YAML.split('\n').findIndex((line) => line.includes('title'));
    expect(titleLineIndex).toBeGreaterThanOrEqual(0);
    expect(matchingGutterLines[0]).toHaveTextContent(String(titleLineIndex + 1));
  });

  it('escapeHtml escapes < > & correctly in rendered output', () => {
    const { container } = render(
      <CatalogYamlViewerModal yaml={ESCAPE_YAML} title="Escape test" onClose={vi.fn()} />,
    );

    const code = container.querySelector('.cat-yaml-code');
    expect(code).toBeTruthy();
    const html = code!.innerHTML;
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; foo');
    expect(html).toContain('&gt; bar');
    expect(html).not.toContain('<script>');
  });

  it('wraps search matches in mark tags when searching', () => {
    const { container } = render(
      <CatalogYamlViewerModal yaml={OPENAPI_YAML} title="Highlight test" onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'openapi' } });

    const code = container.querySelector('.cat-yaml-code');
    expect(code!.innerHTML).toContain('<mark class="cat-yaml-hit');
  });

  it('marks the active search match with cat-yaml-hit--active', () => {
    mockCurrentMatchIndex = 0;
    const yaml = 'alpha\nbeta\nalpha\n';
    const { container, rerender } = render(
      <CatalogYamlViewerModal yaml={yaml} title="Active match" onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'alpha' } });
    rerender(<CatalogYamlViewerModal yaml={yaml} title="Active match" onClose={vi.fn()} />);

    expect(container.querySelector('.cat-yaml-code')!.innerHTML).toContain('cat-yaml-hit--active');
  });

  it('focuses search input on Cmd+F', () => {
    renderModal();
    const searchInput = screen.getByTestId('search-input');

    fireEvent.keyDown(window, { key: 'f', metaKey: true });

    expect(document.activeElement).toBe(searchInput);
  });

  it('focuses search input on Ctrl+F', () => {
    renderModal();
    const searchInput = screen.getByTestId('search-input');

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

    expect(document.activeElement).toBe(searchInput);
  });

  it('Escape clears search when query is present', () => {
    renderModal();
    const searchInput = screen.getByTestId('search-input');

    fireEvent.change(searchInput, { target: { value: 'title' } });
    expect(searchInput).toHaveValue('title');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(searchInput).toHaveValue('');
    expect(mockClearNav).toHaveBeenCalled();
  });

  it('Escape calls onClose when search is empty', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter in search bar advances to next match', () => {
    renderModal({ yaml: 'one\ntwo\nthree\n' });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'o' } });
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Enter' });

    expect(mockSetCurrentMatchIndex).toHaveBeenCalled();
  });

  it('Shift+Enter in search bar goes to previous match', () => {
    renderModal({ yaml: 'one\ntwo\nthree\n' });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'o' } });
    fireEvent.keyDown(screen.getByTestId('search-input'), {
      key: 'Enter',
      shiftKey: true,
    });

    expect(mockSetCurrentMatchIndex).toHaveBeenCalled();
  });

  it('search next/prev buttons navigate matches and scroll', () => {
    renderModal({ yaml: 'alpha\nbeta\nalpha\n' });

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'alpha' } });

    fireEvent.click(screen.getByTestId('search-next'));
    expect(mockSetCurrentMatchIndex).toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('search-prev'));
    expect(mockSetCurrentMatchIndex).toHaveBeenCalledTimes(2);
  });

  it('clear search button resets query and navigation', () => {
    renderModal();

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'title' } });
    fireEvent.click(screen.getByTestId('search-clear'));

    expect(screen.getByTestId('search-input')).toHaveValue('');
    expect(mockClearNav).toHaveBeenCalled();
  });

  it('Escape in search input clears the query', () => {
    renderModal();

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'title' } });
    fireEvent.keyDown(searchInput, { key: 'Escape' });

    expect(searchInput).toHaveValue('');
    expect(mockClearNav).toHaveBeenCalled();
  });

  it('falls back to generic OpenAPI badge when version is missing', () => {
    renderModal({ yaml: 'openapi:\n' });
    expect(screen.getByText('OpenAPI')).toBeInTheDocument();
  });

  it('falls back to Swagger 2.0 badge when version is missing', () => {
    renderModal({ yaml: 'swagger:\n' });
    expect(screen.getByText('Swagger 2.0')).toBeInTheDocument();
  });

  it('does not navigate when there are no search matches', () => {
    renderModal({ yaml: PLAIN_YAML });

    fireEvent.click(screen.getByTestId('search-next'));
    fireEvent.click(screen.getByTestId('search-prev'));

    expect(mockSetCurrentMatchIndex).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('handles clipboard write failures without throwing', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Copy YAML/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /✓ Copied/ })).toBeInTheDocument();
    });
  });
});
