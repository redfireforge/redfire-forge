/**
 * @vitest-environment jsdom
 *
 * Tests for GraphqlEditor.tsx — thin Monaco wrapper with:
 *  - beforeMount: registerGraphqlLanguage + getOrInitGraphqlMode
 *  - onMount: stores editor ref, optionally sets editorMountRef, focuses when !readOnly
 *  - useEffect on modelPath/readOnly: re-focuses via requestAnimationFrame
 *  - useEffect on monaco: MutationObserver for theme re-application
 *  - onChange: calls props.onChange with value ?? ''
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GraphqlEditor } from './GraphqlEditor';

// ─── Monaco mock ──────────────────────────────────────────────────────────────

const mockFocus = vi.fn();
const mockStopPropagation = vi.fn();
const mockOnKeyDown = vi.fn((handler: (e: { keyCode: number; stopPropagation: () => void }) => void) => {
  keyDownHandler = handler;
  return { dispose: mockKeyDownDispose };
});
const mockKeyDownDispose = vi.fn();
let keyDownHandler: ((e: { keyCode: number; stopPropagation: () => void }) => void) | null = null;

const mockEditorInstance = {
  focus: mockFocus,
  onKeyDown: mockOnKeyDown,
};

let mountCallback: ((editor: unknown) => void) | null = null;
let beforeMountCallback: ((monaco: unknown) => void) | null = null;
let onChangeCb: ((val: string | undefined) => void) | null = null;
let mockedMonacoValue: unknown = null;

vi.mock('@monaco-editor/react', () => ({
  default: ({ onMount, beforeMount, onChange, height }: {
    onMount?: (editor: unknown) => void;
    beforeMount?: (monaco: unknown) => void;
    onChange?: (val: string | undefined) => void;
    height?: string | number;
  }) => {
    mountCallback = onMount ?? null;
    beforeMountCallback = beforeMount ?? null;
    onChangeCb = onChange ?? null;
    return <textarea data-testid="mock-monaco" style={{ height: String(height) }} />;
  },
  useMonaco: () => mockedMonacoValue,
}));

vi.mock('../utils/monacoGraphqlSetup', () => ({
  GRAPHQL_LANGUAGE_ID: 'graphql',
  GRAPHQL_THEME_ID: 'graphql-dark',
  registerGraphqlLanguage: vi.fn(),
  defineGraphqlTheme: vi.fn(),
  getGraphqlEditorOptions: vi.fn(() => ({ minimap: { enabled: false } })),
  getOrInitGraphqlMode: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProps(overrides: Partial<Parameters<typeof GraphqlEditor>[0]> = {}) {
  return {
    modelPath: 'inmemory://graphql/test',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mountCallback = null;
  beforeMountCallback = null;
  onChangeCb = null;
  mockedMonacoValue = null;
  keyDownHandler = null;
  // Reset RAF stubs
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphqlEditor', () => {
  it('renders wrapper div with default data-testid', () => {
    render(<GraphqlEditor {...makeProps()} />);
    expect(screen.getByTestId('gql-editor')).toBeInTheDocument();
  });

  it('renders with custom data-testid', () => {
    render(<GraphqlEditor {...makeProps({ 'data-testid': 'custom-editor' })} />);
    expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
  });

  it('passes height to the wrapper div', () => {
    render(<GraphqlEditor {...makeProps({ height: 400 })} />);
    const wrapper = screen.getByTestId('gql-editor');
    expect(wrapper).toHaveStyle({ height: '400px' });
  });

  it('beforeMount calls registerGraphqlLanguage and getOrInitGraphqlMode', async () => {
    const { registerGraphqlLanguage, getOrInitGraphqlMode } = await import('../utils/monacoGraphqlSetup');
    render(<GraphqlEditor {...makeProps()} />);
    const fakeMonaco = {};
    act(() => { beforeMountCallback?.(fakeMonaco); });
    expect(registerGraphqlLanguage).toHaveBeenCalledWith(fakeMonaco);
    expect(getOrInitGraphqlMode).toHaveBeenCalled();
  });

  it('beforeMount handles getOrInitGraphqlMode throwing without propagating', async () => {
    const { getOrInitGraphqlMode } = await import('../utils/monacoGraphqlSetup');
    vi.mocked(getOrInitGraphqlMode).mockImplementationOnce(() => { throw new Error('worker error'); });
    render(<GraphqlEditor {...makeProps()} />);
    // Should not throw
    expect(() => act(() => { beforeMountCallback?.({}); })).not.toThrow();
  });

  it('onMount stores editor in editorMountRef and focuses when not readOnly', () => {
    const editorMountRef = { current: null as unknown };
    render(<GraphqlEditor {...makeProps({ editorMountRef: editorMountRef as never })} />);
    act(() => { mountCallback?.(mockEditorInstance); });
    expect(editorMountRef.current).toBe(mockEditorInstance);
    expect(mockFocus).toHaveBeenCalled();
  });

  it('onMount registers Space stopPropagation so demo shortcuts do not steal input', () => {
    render(<GraphqlEditor {...makeProps()} />);
    act(() => { mountCallback?.(mockEditorInstance, { KeyCode: { Space: 10 } }); });
    expect(mockOnKeyDown).toHaveBeenCalled();
    const event = { keyCode: 10, stopPropagation: mockStopPropagation };
    keyDownHandler?.(event);
    expect(mockStopPropagation).toHaveBeenCalled();
  });

  it('onMount does NOT focus when readOnly=true', () => {
    render(<GraphqlEditor {...makeProps({ readOnly: true })} />);
    act(() => { mountCallback?.(mockEditorInstance); });
    expect(mockFocus).not.toHaveBeenCalled();
  });

  it('onMount skips editorMountRef assignment when not provided', () => {
    render(<GraphqlEditor {...makeProps()} />);
    act(() => { mountCallback?.(mockEditorInstance); });
    // No error thrown — editorMountRef is optional
    expect(true).toBe(true);
  });

  it('onChange calls props.onChange with value', () => {
    const onChange = vi.fn();
    render(<GraphqlEditor {...makeProps({ onChange })} />);
    act(() => { onChangeCb?.('query { user }'); });
    expect(onChange).toHaveBeenCalledWith('query { user }');
  });

  it('onChange calls props.onChange with empty string when value is undefined', () => {
    const onChange = vi.fn();
    render(<GraphqlEditor {...makeProps({ onChange })} />);
    act(() => { onChangeCb?.(undefined); });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('onChange does not throw when props.onChange is undefined', () => {
    render(<GraphqlEditor {...makeProps()} />);
    expect(() => act(() => { onChangeCb?.('value'); })).not.toThrow();
  });

  it('useEffect on modelPath requests animation frame and focuses (not readOnly)', () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    render(<GraphqlEditor {...makeProps({ modelPath: 'inmemory://graphql/tab-1' })} />);
    // Trigger the onMount to set editorRef
    act(() => { mountCallback?.(mockEditorInstance); });
    expect(rafSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('useEffect on modelPath skips focus when readOnly', () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<GraphqlEditor {...makeProps({ readOnly: true })} />);
    act(() => { mountCallback?.(mockEditorInstance); });
    // Verify RAF was not triggered for readOnly (effect returns early)
    expect(rafSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('MutationObserver fires defineGraphqlTheme and setTheme when data-theme changes', async () => {
    const { defineGraphqlTheme } = await import('../utils/monacoGraphqlSetup');
    const fakeMonacoEditor = { setTheme: vi.fn() };
    const fakeMonaco = { editor: fakeMonacoEditor };
    mockedMonacoValue = fakeMonaco;

    let mutationCallback: MutationCallback | null = null;
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    vi.stubGlobal('MutationObserver', class {
      constructor(cb: MutationCallback) { mutationCallback = cb; }
      observe = observeSpy;
      disconnect = disconnectSpy;
    });

    const { unmount } = render(<GraphqlEditor {...makeProps()} />);
    // Trigger the observer callback
    act(() => { mutationCallback?.([], {} as MutationObserver); });
    expect(defineGraphqlTheme).toHaveBeenCalledWith(fakeMonaco);
    expect(fakeMonacoEditor.setTheme).toHaveBeenCalledWith('graphql-dark');

    // On unmount, observer.disconnect should be called
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('MutationObserver effect returns early when monaco is null', () => {
    mockedMonacoValue = null;
    const observeSpy = vi.fn();
    vi.stubGlobal('MutationObserver', class {
      observe = observeSpy;
      disconnect = vi.fn();
    });
    render(<GraphqlEditor {...makeProps()} />);
    // monaco is null — effect should return without calling observe
    expect(observeSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
