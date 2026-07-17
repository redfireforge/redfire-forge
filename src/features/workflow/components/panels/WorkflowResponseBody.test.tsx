/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowResponseBody, { splitWorkflowResponseDetail } from './WorkflowResponseBody';

// jsdom does not implement scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

const goNext = vi.fn();
const goPrev = vi.fn();
const clearNav = vi.fn();
const setCurrentMatchIndex = vi.fn();

vi.mock('../../../requests/components/JsonTreePreview', () => ({
  default: ({
    onMatchCountChange,
    onToggle,
  }: {
    onMatchCountChange: (n: number) => void;
    onToggle: (p: string) => void;
  }) => (
    <div data-testid="json-preview">
      <button type="button" onClick={() => onMatchCountChange(2)}>setcount</button>
      <button type="button" onClick={() => onToggle('root.a')}>toggle</button>
    </div>
  ),
  buildJTree: vi.fn(() => ({ kind: 'object' })),
  collectMatchNodes: (_tree: unknown, _term: string, results: unknown[]) => {
    results.push({});
  },
  collectJTreePaths: () => ['root.a', 'root.b'],
}));

vi.mock('../../../../shared/hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}));

vi.mock('../../../../shared/hooks/useSearchMatchNavigation', () => ({
  useSearchMatchNavigation: () => ({
    currentMatchIndex: 0,
    setCurrentMatchIndex,
    goNext,
    goPrev,
    clear: clearNav,
  }),
}));

vi.mock('../../../../shared/components/SearchMatchBar', () => ({
  SearchMatchBar: ({
    value,
    onChange,
    onPrev,
    onNext,
    onClear,
    onKeyDown,
  }: {
    value: string;
    onChange: (v: string) => void;
    onPrev: () => void;
    onNext: () => void;
    onClear: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  }) => (
    <div>
      <input
        aria-label="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button type="button" onClick={onPrev}>prevbtn</button>
      <button type="button" onClick={onNext}>nextbtn</button>
      <button type="button" onClick={onClear}>clearbtn</button>
    </div>
  ),
}));

describe('splitWorkflowResponseDetail', () => {
  it('returns full body as meta when no marker', () => {
    expect(splitWorkflowResponseDetail('hello')).toEqual({ meta: 'hello', jsonText: null });
  });

  it('splits meta and json body around the marker', () => {
    expect(splitWorkflowResponseDetail('meta\nResponse body:\n{"a":1}')).toEqual({
      meta: 'meta',
      jsonText: '{"a":1}',
    });
  });
});

describe('WorkflowResponseBody', () => {
  it('renders fallback meta when there is no response body marker', async () => {
    const user = userEvent.setup();
    const { container } = render(<WorkflowResponseBody body="plain text body" />);
    expect(container.querySelector('.wf-resp-meta--only')).toBeTruthy();
    await user.type(screen.getByLabelText('search-input'), 'text');
    expect(screen.getByLabelText('search-input')).toBeTruthy();
  });

  it('renders JSON tree preview for valid JSON with toolbar actions', async () => {
    const user = userEvent.setup();
    render(<WorkflowResponseBody body={'meta line\nResponse body:\n{"a":1}'} subtitle="Captured body" />);
    expect(screen.getByTestId('json-preview')).toBeTruthy();
    expect(screen.getByText('Captured body')).toBeTruthy();
    await user.click(screen.getByText('setcount'));
    await user.click(screen.getByText('toggle'));
    await user.click(screen.getByText('toggle'));
    await user.click(screen.getByText('Expand All'));
    await user.click(screen.getByText('Collapse All'));
    await user.type(screen.getByLabelText('search-input'), 'a');
  });

  it('renders raw fallback and parse note for invalid JSON, with search highlight', async () => {
    const user = userEvent.setup();
    const richInvalid = 'meta a\nResponse body:\n{"a":1,\n  "b":[2],\n  "c":"x\\"y",}';
    const { container } = render(<WorkflowResponseBody body={richInvalid} />);
    expect(container.querySelector('.wf-resp-raw-fallback')).toBeTruthy();
    expect(screen.getByText(/Could not parse as JSON/)).toBeTruthy();
    const input = screen.getByLabelText('search-input');
    await user.type(input, 'a');
    await user.keyboard('{Enter}');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.keyboard('{Escape}');
    expect(goNext).toHaveBeenCalled();
    expect(goPrev).toHaveBeenCalled();
  });

  it('handles prev/next/clear toolbar buttons', async () => {
    const user = userEvent.setup();
    render(<WorkflowResponseBody body={'meta\nResponse body:\n{bad json'} />);
    await user.type(screen.getByLabelText('search-input'), 'bad');
    await user.click(screen.getByText('prevbtn'));
    await user.click(screen.getByText('nextbtn'));
    await user.click(screen.getByText('clearbtn'));
    expect(clearNav).toHaveBeenCalled();
  });
});
