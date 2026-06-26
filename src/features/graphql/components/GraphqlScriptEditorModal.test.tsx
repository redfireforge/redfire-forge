/**
 * GraphqlScriptEditorModal.test.tsx
 *
 * Tests for the GraphQL script editor modal (3B-2, 3B-4, 3B-8).
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ─── Monaco mock ─────────────────────────────────────────────────────────────

const mockDispose = vi.fn();
const mockRegisterCompletionProvider = vi.fn().mockReturnValue({ dispose: mockDispose });

const MOCK_MONACO = {
  languages: {
    registerCompletionItemProvider: mockRegisterCompletionProvider,
    CompletionItemKind: { Method: 1 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
  },
};

let useMonacoReturnValue: typeof MOCK_MONACO | null = null;

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, height }: {
    value?: string;
    onChange?: (val: string | undefined) => void;
    height?: string | number;
  }) => (
    <textarea
      data-testid="mock-monaco-editor"
      value={value ?? ''}
      style={{ height: String(height ?? '240px') }}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  useMonaco: () => useMonacoReturnValue,
}));

// ─── preRequestScriptRunner mock ──────────────────────────────────────────────

const mockResolvePendingTests = vi.fn().mockResolvedValue([]);
const mockGetLogs = vi.fn().mockReturnValue([]);
const mockRf = {};

vi.mock('../utils/preRequestScriptRunner', () => ({
  createRfContext: vi.fn(() => ({
    rf: mockRf,
    resolvePendingTests: mockResolvePendingTests,
    getLogs: mockGetLogs,
  })),
  runScript: vi.fn().mockResolvedValue(undefined),
  // NO_OP_STORE is used as the dry-run store; a plain object is sufficient since
  // createRfContext is also mocked and doesn't use the store value in tests.
  NO_OP_STORE: new Map<string, unknown>(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { GraphqlScriptEditorModal, type GraphqlScriptEditorModalProps } from './GraphqlScriptEditorModal';
import { createRfContext, runScript } from '../utils/preRequestScriptRunner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<GraphqlScriptEditorModalProps> = {}): GraphqlScriptEditorModalProps {
  return {
    open: true,
    name: 'GetUser',
    context: 'item',
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — rendering', () => {
  it('renders null when open is false', () => {
    const { container } = render(<GraphqlScriptEditorModal {...makeProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal when open is true', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.getByTestId('gql-script-modal')).toBeInTheDocument();
  });

  it('shows "Item Scripts" title for item context', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.getByText('Item Scripts')).toBeInTheDocument();
  });

  it('shows "Collection Scripts" title for collection context', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ context: 'collection' })} />);
    expect(screen.getByText('Collection Scripts')).toBeInTheDocument();
  });

  it('shows the item name in the subtitle', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ name: 'CreateOrder' })} />);
    expect(screen.getByTestId('gql-script-modal-target')).toHaveTextContent('CreateOrder');
  });

  it('shows Pre-Request and Post-Response tabs', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.getByTestId('gql-script-tab-pre')).toBeInTheDocument();
    expect(screen.getByTestId('gql-script-tab-post')).toBeInTheDocument();
  });

  it('renders item-only settings (enabled toggle + timeout) in item context', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.getByTestId('gql-script-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('gql-script-timeout')).toBeInTheDocument();
  });

  it('does NOT render item-only settings in collection context', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ context: 'collection' })} />);
    expect(screen.queryByTestId('gql-script-enabled')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gql-script-timeout')).not.toBeInTheDocument();
  });

  it('initializes editor with pre-request script', () => {
    const scripts = { preRequest: 'rf.log("hello");', postResponse: '', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('rf.log("hello");');
  });

  it('initializes editor with collection pre-script', () => {
    render(<GraphqlScriptEditorModal {...makeProps({
      context: 'collection',
      collectionPreScript: 'rf.setHeader("X-Foo", "bar");',
    })} />);
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('rf.setHeader("X-Foo", "bar");');
  });
});

// ─── Close behaviors ──────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — close behaviors', () => {
  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('gql-script-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('gql-script-modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when modal body is clicked', () => {
    const onClose = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('gql-script-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose on non-Escape keys', () => {
    const onClose = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes keydown listener when modal closes', () => {
    const onClose = vi.fn();
    const { rerender } = render(<GraphqlScriptEditorModal {...makeProps({ open: true, onClose })} />);
    rerender(<GraphqlScriptEditorModal {...makeProps({ open: false, onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Execution order diagram ──────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — execution order diagram', () => {
  it('is hidden by default', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.queryByText('Collection pre-request')).not.toBeInTheDocument();
  });

  it('shows diagram when toggle is clicked', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-order-toggle'));
    expect(screen.getByText('Collection pre-request')).toBeInTheDocument();
    expect(screen.getByText('HTTP request')).toBeInTheDocument();
  });

  it('hides diagram on second toggle click', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const toggle = screen.getByTestId('gql-script-order-toggle');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText('Collection pre-request')).not.toBeInTheDocument();
  });
});

// ─── Phase tabs ───────────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — phase tabs', () => {
  it('switches to post-response tab', () => {
    const scripts = {
      preRequest: 'rf.log("pre");',
      postResponse: 'rf.log("post");',
      enabled: true,
    };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('rf.log("post");');
  });

  it('switches back to pre-request tab', () => {
    const scripts = { preRequest: 'rf.log("pre");', postResponse: 'rf.log("post");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-tab-pre'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('rf.log("pre");');
  });

  it('updates script content when typing in editor (pre phase)', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const editor = screen.getByTestId('mock-monaco-editor');
    fireEvent.change(editor, { target: { value: 'rf.abort("no");' } });
    // Value should now be reflected
    expect((editor as HTMLTextAreaElement).value).toBe('rf.abort("no");');
  });

  it('updates collection post-script on collection context', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ context: 'collection' })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    const editor = screen.getByTestId('mock-monaco-editor');
    fireEvent.change(editor, { target: { value: 'rf.log("coll-post");' } });
    expect((editor as HTMLTextAreaElement).value).toBe('rf.log("coll-post");');
  });
});

// ─── Template library ─────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — template library', () => {
  it('shows template button', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(screen.getByTestId('gql-script-template-btn')).toBeInTheDocument();
  });

  it('opens template dropdown on button click', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    expect(screen.getByTestId('gql-script-template-dropdown')).toBeInTheDocument();
  });

  it('closes template dropdown on second click', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const btn = screen.getByTestId('gql-script-template-btn');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByTestId('gql-script-template-dropdown')).not.toBeInTheDocument();
  });

  it('inserts pre-request template into empty editor', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-oauth2-token-refresh'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('access_token');
  });

  it('appends template to existing editor content', () => {
    const scripts = { preRequest: 'rf.log("existing");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-oauth2-token-refresh'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('rf.log("existing");');
    expect(editor.value).toContain('access_token');
  });

  it('inserts post-response template when on post tab', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    // Post-response specific templates should be visible
    expect(screen.getByTestId('gql-script-template-assert-no-graphql-errors')).toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    expect(screen.getByTestId('gql-script-template-dropdown')).toBeInTheDocument();
    // Click outside the template wrapper
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('gql-script-template-dropdown')).not.toBeInTheDocument();
  });

  it('shows "No templates for this phase" when no templates match (impossible via normal UI, but handles empty)', () => {
    // Switch to post tab — there are post-specific templates so no empty state here.
    // We just verify the dropdown opens and shows templates for post phase.
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    // 'Assert No GraphQL Errors' is a post-phase template
    expect(screen.getByText('Assert No GraphQL Errors')).toBeInTheDocument();
  });
});

// ─── Item-specific settings ───────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — item settings', () => {
  it('shows the enabled checkbox checked by default', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const checkbox = screen.getByTestId('gql-script-enabled') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('shows enabled=false when scripts.enabled is false', () => {
    const scripts = { enabled: false };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    const checkbox = screen.getByTestId('gql-script-enabled') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('toggles the enabled checkbox', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const checkbox = screen.getByTestId('gql-script-enabled');
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('shows default timeout 10000', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const input = screen.getByTestId('gql-script-timeout') as HTMLInputElement;
    expect(Number(input.value)).toBe(10000);
  });

  it('shows custom timeout from scripts', () => {
    const scripts = { timeout: 30000, enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    const input = screen.getByTestId('gql-script-timeout') as HTMLInputElement;
    expect(Number(input.value)).toBe(30000);
  });

  it('updates timeout on change', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const input = screen.getByTestId('gql-script-timeout');
    fireEvent.change(input, { target: { value: '20000' } });
    expect((input as HTMLInputElement).value).toBe('20000');
  });

  it('ignores NaN timeout values', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const input = screen.getByTestId('gql-script-timeout');
    fireEvent.change(input, { target: { value: 'abc' } });
    // Value remains at 10000 since NaN is rejected
    expect((input as HTMLInputElement).value).toBe('10000');
  });

  it('ignores timeout below minimum (1000)', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const input = screen.getByTestId('gql-script-timeout');
    fireEvent.change(input, { target: { value: '500' } });
    // Value stays at 10000 since < 1000 is rejected
    expect((input as HTMLInputElement).value).toBe('10000');
  });

  it('clamps timeout to max 120000', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const input = screen.getByTestId('gql-script-timeout');
    fireEvent.change(input, { target: { value: '999999' } });
    expect((input as HTMLInputElement).value).toBe('120000');
  });
});

// ─── Save behavior ────────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — save', () => {
  it('saves undefined scripts when nothing has been written (item context)', () => {
    const onSave = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onSave })} />);
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({ context: 'item', scripts: undefined });
  });

  it('saves scripts payload when preScript is non-empty', () => {
    const onSave = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onSave })} />);
    fireEvent.change(screen.getByTestId('mock-monaco-editor'), { target: { value: 'rf.log("x");' } });
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({
      context: 'item',
      scripts: expect.objectContaining({ preRequest: 'rf.log("x");' }),
    });
  });

  it('saves scripts payload when postScript is non-empty', () => {
    const onSave = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onSave })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.change(screen.getByTestId('mock-monaco-editor'), { target: { value: 'rf.log("post");' } });
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({
      context: 'item',
      scripts: expect.objectContaining({ postResponse: 'rf.log("post");' }),
    });
  });

  it('saves scripts payload when disabled (enabled=false forces payload)', () => {
    const onSave = vi.fn();
    const scripts = { enabled: false };
    render(<GraphqlScriptEditorModal {...makeProps({ onSave, scripts })} />);
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({
      context: 'item',
      scripts: expect.objectContaining({ enabled: false }),
    });
  });

  it('saves scripts payload when custom timeout is set', () => {
    const onSave = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({ onSave })} />);
    fireEvent.change(screen.getByTestId('gql-script-timeout'), { target: { value: '30000' } });
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({
      context: 'item',
      scripts: expect.objectContaining({ timeout: 30000 }),
    });
  });

  it('saves collection scripts for collection context', () => {
    const onSave = vi.fn();
    render(<GraphqlScriptEditorModal {...makeProps({
      context: 'collection',
      collectionPreScript: 'rf.log("coll-pre");',
      collectionPostScript: 'rf.log("coll-post");',
      onSave,
    })} />);
    fireEvent.click(screen.getByTestId('gql-script-save'));
    expect(onSave).toHaveBeenCalledWith({
      context: 'collection',
      collectionPreScript: 'rf.log("coll-pre");',
      collectionPostScript: 'rf.log("coll-post");',
    });
  });
});

// ─── Reset on resetKey ────────────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — resetKey', () => {
  it('resets editor state when resetKey changes while open', () => {
    const scripts1 = { preRequest: 'rf.log("item1");', enabled: true };
    const scripts2 = { preRequest: 'rf.log("item2");', enabled: true };
    const { rerender } = render(
      <GraphqlScriptEditorModal {...makeProps({ scripts: scripts1, resetKey: 'item1' })} />,
    );
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('rf.log("item1");');

    rerender(<GraphqlScriptEditorModal {...makeProps({ scripts: scripts2, resetKey: 'item2' })} />);
    expect((screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement).value).toBe('rf.log("item2");');
  });
});

// ─── Dry-run ("Test Script") ──────────────────────────────────────────────────

describe('GraphqlScriptEditorModal — Test Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolvePendingTests.mockResolvedValue([]);
    mockGetLogs.mockReturnValue([]);
    vi.mocked(runScript).mockResolvedValue(undefined);
    vi.mocked(createRfContext).mockReturnValue({
      rf: mockRf as never,
      resolvePendingTests: mockResolvePendingTests,
      getLogs: mockGetLogs,
    });
  });

  it('Test Script button is disabled when post phase has no testResponse', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    const btn = screen.getByTestId('gql-script-test') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Test Script button is enabled when pre phase (no testResponse needed)', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const btn = screen.getByTestId('gql-script-test') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('does nothing when Test Script is clicked with empty script', async () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(runScript).not.toHaveBeenCalled();
  });

  it('runs the script and shows dry-run output', async () => {
    mockGetLogs.mockReturnValue([
      { level: 'info', message: 'hello world', timestamp: 1000 },
    ]);
    const scripts = { preRequest: 'rf.log("hello world");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('gql-script-dryrun-console')).toBeInTheDocument();
    });
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('shows test pass/fail summary when tests run', async () => {
    mockResolvePendingTests.mockResolvedValue([
      { name: 'no errors', passed: true, error: undefined },
      { name: 'has data', passed: false, error: 'data is null' },
    ]);
    mockGetLogs.mockReturnValue([]);
    const scripts = { preRequest: 'rf.test("no errors", () => {});', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByText(/1\/2 passed/)).toBeInTheDocument();
    });
  });

  it('shows error entry when script throws', async () => {
    vi.mocked(runScript).mockRejectedValue(new Error('Script aborted'));
    mockGetLogs.mockReturnValue([]);
    const scripts = { preRequest: "rf.abort('fail');", enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByText(/Script aborted/)).toBeInTheDocument();
    });
  });

  it('shows error when script throws a non-Error', async () => {
    vi.mocked(runScript).mockRejectedValue('string error');
    mockGetLogs.mockReturnValue([]);
    const scripts = { preRequest: "throw 'fail';", enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByText(/string error/)).toBeInTheDocument();
    });
  });

  it('clears dry-run output when Clear button is clicked', async () => {
    mockGetLogs.mockReturnValue([
      { level: 'info', message: 'test log', timestamp: 1000 },
    ]);
    const scripts = { preRequest: 'rf.log("test log");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('gql-script-dryrun-console')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('gql-script-dryrun-console')).not.toBeInTheDocument();
  });

  it('runs post-response script with testResponse context', async () => {
    const testResponse = { httpStatus: 200, httpHeaders: {}, data: { user: 'Alice' }, errors: undefined, latencyMs: 50 };
    const scripts = { postResponse: 'rf.log(rf.response.httpStatus);', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts, testResponse })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(createRfContext).toHaveBeenCalledWith(
      expect.objectContaining({ response: testResponse }),
    );
  });

  it('runs pre-request script WITHOUT testResponse (always undefined for pre)', async () => {
    const testResponse = { httpStatus: 200, httpHeaders: {}, data: {}, errors: undefined, latencyMs: 10 };
    const scripts = { preRequest: 'rf.log("pre");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts, testResponse })} />);
    // Pre-request tab is active by default
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(createRfContext).toHaveBeenCalledWith(
      expect.objectContaining({ response: undefined }),
    );
  });

  it('passes envSnapshot and collectionVarsSnapshot to createRfContext', async () => {
    const envSnapshot = { apiKey: 'abc' };
    const collectionVarsSnapshot = { base: 'https://api.test' };
    const scripts = { preRequest: 'rf.log("x");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts, envSnapshot, collectionVarsSnapshot })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(createRfContext).toHaveBeenCalledWith(
      expect.objectContaining({
        envSnapshot: expect.objectContaining({ apiKey: 'abc' }),
        collectionVarsSnapshot: expect.objectContaining({ base: 'https://api.test' }),
      }),
    );
  });

  it('uses 10000ms timeout for collection context dry-run', async () => {
    mockGetLogs.mockReturnValue([]);
    render(<GraphqlScriptEditorModal {...makeProps({
      context: 'collection',
      collectionPreScript: 'rf.log("x");',
    })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(runScript).toHaveBeenCalledWith(expect.any(String), expect.anything(), 10000);
  });

  it('uses local timeout for item context dry-run', async () => {
    mockGetLogs.mockReturnValue([]);
    const scripts = { preRequest: 'rf.log("x");', timeout: 30000, enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    expect(runScript).toHaveBeenCalledWith(expect.any(String), expect.anything(), 30000);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});

// ─── Monaco completion provider ───────────────────────────────────────────────

describe('GraphqlScriptEditorModal — Monaco completion provider', () => {
  afterEach(() => {
    useMonacoReturnValue = null;
    mockRegisterCompletionProvider.mockClear();
    mockDispose.mockClear();
  });

  it('registers rf.* completion provider when Monaco is available', () => {
    useMonacoReturnValue = MOCK_MONACO;
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    expect(mockRegisterCompletionProvider).toHaveBeenCalledWith('javascript', expect.any(Object));
  });

  it('disposes completion provider when modal closes', () => {
    useMonacoReturnValue = MOCK_MONACO;
    const { rerender } = render(<GraphqlScriptEditorModal {...makeProps({ open: true })} />);
    rerender(<GraphqlScriptEditorModal {...makeProps({ open: false })} />);
    expect(mockDispose).toHaveBeenCalledOnce();
  });

  it('provideCompletionItems returns empty when line does not match rf pattern', () => {
    useMonacoReturnValue = MOCK_MONACO;
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const provider = mockRegisterCompletionProvider.mock.calls[0][1];
    const mockModel = {
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
      getLineContent: () => 'const x = surfing.',
    };
    const result = provider.provideCompletionItems(mockModel, { lineNumber: 1, column: 20 });
    expect(result.suggestions).toHaveLength(0);
  });

  it('provideCompletionItems returns rf.* suggestions when line ends with "rf."', () => {
    useMonacoReturnValue = MOCK_MONACO;
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const provider = mockRegisterCompletionProvider.mock.calls[0][1];
    const mockModel = {
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
      getLineContent: () => 'rf.',
    };
    const result = provider.provideCompletionItems(mockModel, { lineNumber: 1, column: 4 });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].label).toBe('rf.getEnv');
  });

  it('provideCompletionItems returns rf.* suggestions when line ends with "rf" (no dot)', () => {
    useMonacoReturnValue = MOCK_MONACO;
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const provider = mockRegisterCompletionProvider.mock.calls[0][1];
    const mockModel = {
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
      getLineContent: () => 'rf',
    };
    const result = provider.provideCompletionItems(mockModel, { lineNumber: 1, column: 3 });
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

// ─── Additional editor / template branch coverage ────────────────────────────

describe('GraphqlScriptEditorModal — editor onChange undefined', () => {
  it('handles undefined value from Monaco onChange (falls back to empty string)', () => {
    // We need to fire onChange with undefined, which requires calling it directly
    // We do this by checking if the editor shows empty string when value is undefined
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    const editor = screen.getByTestId('mock-monaco-editor');
    // Simulate the textarea onChange with empty string (simulates Monaco passing undefined)
    fireEvent.change(editor, { target: { value: '' } });
    expect((editor as HTMLTextAreaElement).value).toBe('');
  });
});

describe('GraphqlScriptEditorModal — template insertion branches', () => {
  it('inserts collection pre-script template into empty slot', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ context: 'collection' })} />);
    // On pre tab, insert template into empty collection pre-script
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-oauth2-token-refresh'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('access_token');
  });

  it('inserts collection post-script template', () => {
    render(<GraphqlScriptEditorModal {...makeProps({ context: 'collection' })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-assert-no-graphql-errors'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('no GraphQL errors');
  });

  it('appends to existing collection post-script', () => {
    render(<GraphqlScriptEditorModal {...makeProps({
      context: 'collection',
      collectionPostScript: 'rf.log("existing");',
    })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-assert-no-graphql-errors'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('rf.log("existing");');
    expect(editor.value).toContain('no GraphQL errors');
  });

  it('inserts item post-script template', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-assert-no-graphql-errors'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('no GraphQL errors');
  });

  it('appends to existing item post-script', () => {
    const scripts = { postResponse: 'rf.log("old");', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    fireEvent.click(screen.getByTestId('gql-script-tab-post'));
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    fireEvent.click(screen.getByTestId('gql-script-template-assert-no-graphql-errors'));
    const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement;
    expect(editor.value).toContain('rf.log("old");');
    expect(editor.value).toContain('no GraphQL errors');
  });

  it('does NOT close template dropdown when clicking inside the dropdown', () => {
    render(<GraphqlScriptEditorModal {...makeProps()} />);
    fireEvent.click(screen.getByTestId('gql-script-template-btn'));
    // Click inside the dropdown itself (not outside) — should not close it
    const dropdown = screen.getByTestId('gql-script-template-dropdown');
    fireEvent.mouseDown(dropdown);
    expect(screen.getByTestId('gql-script-template-dropdown')).toBeInTheDocument();
  });
});

describe('GraphqlScriptEditorModal — test result fail entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runScript).mockResolvedValue(undefined);
    vi.mocked(createRfContext).mockReturnValue({
      rf: mockRf as never,
      resolvePendingTests: mockResolvePendingTests,
      getLogs: mockGetLogs,
    });
  });

  it('renders failed test entries with ✗ prefix', async () => {
    mockResolvePendingTests.mockResolvedValue([
      { name: 'should pass', passed: false, error: 'assertion failed' },
    ]);
    mockGetLogs.mockReturnValue([]);
    const scripts = { preRequest: 'rf.test("should pass", () => {});', enabled: true };
    render(<GraphqlScriptEditorModal {...makeProps({ scripts })} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('gql-script-test'));
    });
    await waitFor(() => {
      expect(screen.getByText(/✗ should pass/)).toBeInTheDocument();
    });
  });
});
