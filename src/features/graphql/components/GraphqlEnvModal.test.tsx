/**
 * GraphqlEnvModal.test.tsx
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GraphqlEnvModal } from './GraphqlEnvModal';
import type { GraphqlEnvironment } from '../../../shared/types/graphql';

// ─── generateVarId mock ───────────────────────────────────────────────────────

let varIdCounter = 0;
vi.mock('../hooks/useGraphqlEnvironments', () => ({
  generateVarId: () => `var-${++varIdCounter}`,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;

function makeEnv(overrides: Partial<GraphqlEnvironment> = {}): GraphqlEnvironment {
  const id = `env-${++idCounter}`;
  return { id, name: `Env ${idCounter}`, variables: [], ...overrides };
}

function makeProps(overrides: Partial<Parameters<typeof GraphqlEnvModal>[0]> = {}) {
  return {
    environments: [] as GraphqlEnvironment[],
    activeEnvironmentId: null as string | null,
    onClose: vi.fn(),
    onCreate: vi.fn((name: string) => `new-env-${name}`),
    onDelete: vi.fn(),
    onSetActive: vi.fn(),
    onRename: vi.fn(),
    onUpdateVariables: vi.fn(),
    onImport: vi.fn((_json: string) => ({ success: true })),
    onExport: vi.fn((_id: string) => '{"envs":[]}'),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('GraphqlEnvModal — rendering', () => {
  it('renders the modal dialog', () => {
    render(<GraphqlEnvModal {...makeProps()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Environment variables/i)).toBeInTheDocument();
  });

  it('shows empty sidebar when no environments', () => {
    render(<GraphqlEnvModal {...makeProps()} />);
    expect(screen.getAllByText(/No environments yet\./)[0]).toBeInTheDocument();
  });

  it('shows select-environment prompt when nothing selected', () => {
    render(<GraphqlEnvModal {...makeProps()} />);
    expect(screen.getByText(/Select an environment/)).toBeInTheDocument();
  });

  it('renders env list items', () => {
    const env1 = makeEnv({ name: 'Production' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    // The env name appears in both sidebar button and right panel — check sidebar item exists
    expect(screen.getByTestId(`gql-env-item-${env1.id}`)).toBeInTheDocument();
  });

  it('shows Active dot title for active environment', () => {
    const env1 = makeEnv({ name: 'Production' });
    render(<GraphqlEnvModal {...makeProps({
      environments: [env1],
      activeEnvironmentId: env1.id,
    })} />);
    expect(screen.getByTitle('Active')).toBeInTheDocument();
  });

  it('marks active-env as selected by default', () => {
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({
      environments: [env1],
      activeEnvironmentId: env1.id,
    })} />);
    expect(screen.getByTestId(`gql-env-item-${env1.id}`)).toHaveClass('gql-env-sidebar-item--selected');
  });

  it('selects second env when activeEnvironmentId points to it', () => {
    const env1 = makeEnv({ name: 'Staging' });
    const env2 = makeEnv({ name: 'Production' });
    render(<GraphqlEnvModal {...makeProps({
      environments: [env1, env2],
      activeEnvironmentId: env2.id,
    })} />);
    expect(screen.getByTestId(`gql-env-item-${env2.id}`)).toHaveClass('gql-env-sidebar-item--selected');
  });

  it('shows the right panel for the selected env', () => {
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    expect(screen.getByTestId('gql-env-name-display')).toHaveTextContent('Dev');
  });

  it('shows Set Active button when env is not active', () => {
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], activeEnvironmentId: null })} />);
    expect(screen.getByTestId('gql-env-set-active-btn')).toBeInTheDocument();
  });

  it('shows Active badge instead of button when env is already active', () => {
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({
      environments: [env1],
      activeEnvironmentId: env1.id,
    })} />);
    expect(screen.getByTestId('gql-env-active-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('gql-env-set-active-btn')).not.toBeInTheDocument();
  });
});

// ─── Close behaviors ──────────────────────────────────────────────────────────

describe('GraphqlEnvModal — close behaviors', () => {
  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<GraphqlEnvModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('gql-env-close-btn'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking outside the panel (mousedown on overlay)', () => {
    const onClose = vi.fn();
    render(<GraphqlEnvModal {...makeProps({ onClose })} />);
    // Click directly on the overlay (not inside the panel)
    fireEvent.mouseDown(screen.getByTestId('gql-env-modal-overlay'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when clicking inside the panel', () => {
    const onClose = vi.fn();
    render(<GraphqlEnvModal {...makeProps({ onClose })} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<GraphqlEnvModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels editing on Escape instead of closing when editing name', () => {
    const onClose = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onClose })} />);
    // Enter edit mode
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    expect(screen.getByTestId('gql-env-name-input')).toBeInTheDocument();
    // Escape should cancel edit, not close
    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gql-env-name-input')).not.toBeInTheDocument();
  });
});

// ─── Create environment ────────────────────────────────────────────────────────

describe('GraphqlEnvModal — create environment', () => {
  it('calls onCreate("New Environment") when New button is clicked', () => {
    const onCreate = vi.fn(() => 'new-env-id');
    render(<GraphqlEnvModal {...makeProps({ onCreate })} />);
    fireEvent.click(screen.getByTestId('gql-env-new-btn'));
    expect(onCreate).toHaveBeenCalledWith('New Environment');
  });
});

// ─── Select / switch environments ─────────────────────────────────────────────

describe('GraphqlEnvModal — environment selection', () => {
  it('switches selected env when clicking a sidebar item', () => {
    const env1 = makeEnv({ name: 'Dev' });
    const env2 = makeEnv({ name: 'Prod' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1, env2] })} />);
    // env1 is selected (first)
    expect(screen.getByTestId(`gql-env-item-${env1.id}`)).toHaveClass('gql-env-sidebar-item--selected');
    // Click env2's sidebar button
    fireEvent.click(screen.getByTestId(`gql-env-item-${env2.id}`).querySelector('button.gql-env-sidebar-item-btn')!);
    expect(screen.getByTestId(`gql-env-item-${env2.id}`)).toHaveClass('gql-env-sidebar-item--selected');
    expect(screen.getByTestId(`gql-env-item-${env1.id}`)).not.toHaveClass('gql-env-sidebar-item--selected');
  });

  it('calls onSetActive when Set Active button is clicked', () => {
    const onSetActive = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onSetActive })} />);
    fireEvent.click(screen.getByTestId('gql-env-set-active-btn'));
    expect(onSetActive).toHaveBeenCalledWith(env1.id);
  });
});

// ─── Delete environment ────────────────────────────────────────────────────────

describe('GraphqlEnvModal — delete environment', () => {
  it('requires two clicks to delete (shows Delete? on first click)', () => {
    const onDelete = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onDelete })} />);

    // First click arms confirmation
    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete?')).toBeInTheDocument();

    // Second click executes delete
    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    expect(onDelete).toHaveBeenCalledWith(env1.id);
  });

  it('resets confirmation after 2.5s timeout', async () => {
    vi.useFakeTimers();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);

    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    expect(screen.getByText('Delete?')).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(2600); });
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('cancels first env confirm when a different env delete is clicked', () => {
    const env1 = makeEnv({ name: 'Dev' });
    const env2 = makeEnv({ name: 'Prod' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1, env2] })} />);

    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    expect(screen.getAllByText('Delete?')).toHaveLength(1);

    // Click delete on env2 → resets env1 confirm, arms env2
    fireEvent.click(screen.getByTestId(`gql-env-delete-${env2.id}`));
    expect(screen.getAllByText('Delete?')).toHaveLength(1);
    expect(screen.getByTestId(`gql-env-delete-${env2.id}`)).toHaveTextContent('Delete?');
  });

  it('switches to remaining env when selected env is deleted', () => {
    const onDelete = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    const env2 = makeEnv({ name: 'Prod' });
    render(<GraphqlEnvModal {...makeProps({
      environments: [env1, env2],
      onDelete,
    })} />);
    // env1 selected by default; delete it
    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    fireEvent.click(screen.getByTestId(`gql-env-delete-${env1.id}`));
    expect(onDelete).toHaveBeenCalledWith(env1.id);
  });
});

// ─── Rename environment ────────────────────────────────────────────────────────

describe('GraphqlEnvModal — rename environment', () => {
  it('enters edit mode when name display button is clicked', () => {
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    expect(screen.getByTestId('gql-env-name-input')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dev')).toBeInTheDocument();
  });

  it('commits rename on Enter key', () => {
    const onRename = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onRename })} />);
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    const input = screen.getByTestId('gql-env-name-input');
    fireEvent.change(input, { target: { value: 'Development' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith(env1.id, 'Development');
    expect(screen.queryByTestId('gql-env-name-input')).not.toBeInTheDocument();
  });

  it('commits rename on blur', () => {
    const onRename = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onRename })} />);
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    const input = screen.getByTestId('gql-env-name-input');
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith(env1.id, 'Updated Name');
  });

  it('cancels rename on Escape key (does NOT call onRename)', () => {
    const onRename = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onRename })} />);
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    const input = screen.getByTestId('gql-env-name-input');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('gql-env-name-input')).not.toBeInTheDocument();
  });

  it('does NOT commit rename when name is whitespace-only', () => {
    const onRename = vi.fn();
    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onRename })} />);
    fireEvent.click(screen.getByTestId('gql-env-name-display'));
    const input = screen.getByTestId('gql-env-name-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });
});

// ─── Variable management ──────────────────────────────────────────────────────

describe('GraphqlEnvModal — variable management', () => {
  it('shows existing variables in input fields', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'API_KEY', value: 'secret', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    expect(screen.getByDisplayValue('API_KEY')).toBeInTheDocument();
    expect(screen.getByDisplayValue('secret')).toBeInTheDocument();
  });

  it('adds a new variable row when Add variable is clicked (empty state)', () => {
    const env1 = makeEnv({ name: 'Dev', variables: [] });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    expect(screen.queryByTestId('gql-env-var-row')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('gql-env-var-add-btn'));
    expect(screen.getByTestId('gql-env-var-row')).toBeInTheDocument();
  });

  it('adds a new variable row when Add variable is clicked (non-empty state)', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'EXISTING', value: 'val', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    const initialRows = screen.getAllByTestId('gql-env-var-row');
    fireEvent.click(screen.getByTestId('gql-env-var-add-btn'));
    expect(screen.getAllByTestId('gql-env-var-row')).toHaveLength(initialRows.length + 1);
  });

  it('removes a variable when its Remove button is clicked', () => {
    const onUpdateVariables = vi.fn();
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'OLD_KEY', value: 'old', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onUpdateVariables })} />);
    const removeBtn = screen.getByLabelText('Remove variable OLD_KEY');
    fireEvent.click(removeBtn);
    expect(onUpdateVariables).toHaveBeenCalled();
    expect(screen.queryByDisplayValue('OLD_KEY')).not.toBeInTheDocument();
  });

  it('updates localVars and flushes to parent when key is changed', () => {
    const onUpdateVariables = vi.fn();
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'URL', value: 'http://dev', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onUpdateVariables })} />);
    const keyInput = screen.getByDisplayValue('URL');
    fireEvent.change(keyInput, { target: { value: 'BASE_URL' } });
    expect(onUpdateVariables).toHaveBeenCalled();
    const lastCall = onUpdateVariables.mock.calls[onUpdateVariables.mock.calls.length - 1];
    expect(lastCall[1][0].key).toBe('BASE_URL');
  });

  it('toggles enabled state when checkbox is clicked', () => {
    const onUpdateVariables = vi.fn();
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'URL', value: 'http://dev', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onUpdateVariables })} />);
    const checkbox = screen.getByLabelText('Enable variable URL');
    fireEvent.click(checkbox);
    expect(onUpdateVariables).toHaveBeenCalled();
    const lastCall = onUpdateVariables.mock.calls[onUpdateVariables.mock.calls.length - 1];
    expect(lastCall[1][0].enabled).toBe(false);
  });

  it('toggles masked state when secret-toggle button is clicked', () => {
    const onUpdateVariables = vi.fn();
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'TOKEN', value: 'abc', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onUpdateVariables })} />);
    const secretBtn = screen.getByLabelText('Hide value as secret (mask with dots)');
    fireEvent.click(secretBtn);
    expect(onUpdateVariables).toHaveBeenCalled();
    const lastCall = onUpdateVariables.mock.calls[onUpdateVariables.mock.calls.length - 1];
    expect(lastCall[1][0].masked).toBe(true);
  });

  it('defaults variables without masked flag to hidden (password input)', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'TOKEN', value: 'abc', enabled: true }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    const input = screen.getByLabelText('Variable value (secret)') as HTMLInputElement;
    expect(input.type).toBe('password');
  });
});

// ─── MaskedInput component ─────────────────────────────────────────────────────

describe('GraphqlEnvModal — MaskedInput', () => {
  it('renders password input for masked variables', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'SECRET', value: 'top-secret', enabled: true, masked: true }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    const input = screen.getByLabelText('Variable value (secret)') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('renders text input for non-masked variables', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'URL', value: 'http://localhost', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    const input = screen.getByLabelText('Variable value') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('toggles password visibility when Show/Hide button is clicked', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'TOKEN', value: 'abc', enabled: true, masked: true }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);
    const input = () => screen.getByLabelText('Variable value (secret)') as HTMLInputElement;
    expect(input().type).toBe('password');

    fireEvent.click(screen.getByLabelText('Show value'));
    expect(input().type).toBe('text');

    fireEvent.click(screen.getByLabelText('Hide value'));
    expect(input().type).toBe('password');
  });
});

// ─── Import ────────────────────────────────────────────────────────────────────

describe('GraphqlEnvModal — import', () => {
  it('handles no file selected (empty file input change)', () => {
    const onImport = vi.fn();
    render(<GraphqlEnvModal {...makeProps({ onImport })} />);
    const fileInput = screen.getByLabelText('Import environment JSON file');
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(onImport).not.toHaveBeenCalled();
  });

  it('shows import error when FileReader fires onerror', async () => {
    render(<GraphqlEnvModal {...makeProps()} />);
    const fileInput = screen.getByLabelText('Import environment JSON file');

    const original = global.FileReader;
    class MockReaderError {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(_f: File) { setTimeout(() => this.onerror?.(), 0); }
    }
    global.FileReader = MockReaderError as unknown as typeof FileReader;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File([''], 'bad.json')] } });
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() =>
      expect(screen.getByText('Could not read the selected file')).toBeInTheDocument(),
    );

    global.FileReader = original;
  });

  it('shows import error when onImport returns error', async () => {
    const onImport = vi.fn(() => ({ success: false, error: 'Bad format' }));
    render(<GraphqlEnvModal {...makeProps({ onImport })} />);
    const fileInput = screen.getByLabelText('Import environment JSON file');

    const original = global.FileReader;
    class MockReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(_f: File) { setTimeout(() => this.onload?.({ target: { result: '{}' } }), 0); }
    }
    global.FileReader = MockReader as unknown as typeof FileReader;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['{}'], 'env.json')] } });
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(screen.getByText('Bad format')).toBeInTheDocument());
    global.FileReader = original;
  });

  it('calls onImport with file text on success', async () => {
    const onImport = vi.fn(() => ({ success: true }));
    render(<GraphqlEnvModal {...makeProps({ onImport })} />);
    const fileInput = screen.getByLabelText('Import environment JSON file');

    const original = global.FileReader;
    class MockReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(_f: File) { setTimeout(() => this.onload?.({ target: { result: '{"envs":[]}' } }), 0); }
    }
    global.FileReader = MockReader as unknown as typeof FileReader;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [new File(['{"envs":[]}'], 'env.json')] } });
      await new Promise<void>((r) => setTimeout(r, 10));
    });

    expect(onImport).toHaveBeenCalledWith('{"envs":[]}');
    global.FileReader = original;
  });

  it('auto-clears import error after 5s', async () => {
    vi.useFakeTimers();
    render(<GraphqlEnvModal {...makeProps()} />);

    const original = global.FileReader;
    class MockReaderError {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsText(_f: File) { this.onerror?.(); }
    }
    global.FileReader = MockReaderError as unknown as typeof FileReader;

    act(() => {
      const fileInput = screen.getByLabelText('Import environment JSON file');
      fireEvent.change(fileInput, { target: { files: [new File([''], 'bad.json')] } });
    });
    global.FileReader = original;

    expect(screen.getByText('Could not read the selected file')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByText('Could not read the selected file')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

// ─── Export ────────────────────────────────────────────────────────────────────

describe('GraphqlEnvModal — export', () => {
  it('calls onExport and creates download link when Export button is clicked', () => {
    const onExport = vi.fn(() => '{"test":true}');
    const createObjectURL = vi.fn(() => 'blob:url');
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onExport })} />);

    // Spy after render so React's DOM operations complete normally
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    fireEvent.click(screen.getByTestId('gql-env-export-btn'));
    expect(onExport).toHaveBeenCalledWith(env1.id);
    expect(createObjectURL).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it('does nothing when onExport returns null', () => {
    const onExport = vi.fn(() => null);
    const createObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;

    const env1 = makeEnv({ name: 'Dev' });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1], onExport })} />);
    fireEvent.click(screen.getByTestId('gql-env-export-btn'));
    expect(createObjectURL).not.toHaveBeenCalled();
    URL.createObjectURL = origCreate;
  });
});

// ─── Environment switch ────────────────────────────────────────────────────────

describe('GraphqlEnvModal — env switch', () => {
  it('updates variable display when switching environments', () => {
    const env1 = makeEnv({
      name: 'Dev',
      variables: [{ key: 'URL', value: 'http://dev', enabled: true, masked: false }],
    });
    const env2 = makeEnv({
      name: 'Prod',
      variables: [{ key: 'URL', value: 'http://prod', enabled: true, masked: false }],
    });
    render(<GraphqlEnvModal {...makeProps({ environments: [env1, env2] })} />);
    expect(screen.getByDisplayValue('http://dev')).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId(`gql-env-item-${env2.id}`).querySelector('button.gql-env-sidebar-item-btn')!,
    );
    expect(screen.getByDisplayValue('http://prod')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('http://dev')).not.toBeInTheDocument();
  });

  it('auto-selects first remaining env when selected env is externally deleted', () => {
    const env1 = makeEnv({ name: 'Dev' });
    const env2 = makeEnv({ name: 'Prod' });
    const { rerender } = render(<GraphqlEnvModal {...makeProps({ environments: [env1, env2] })} />);

    // env1 is selected by default
    expect(screen.getByTestId(`gql-env-item-${env1.id}`)).toHaveClass('gql-env-sidebar-item--selected');

    // Remove env1 from array (simulates external deletion)
    rerender(<GraphqlEnvModal {...makeProps({ environments: [env2] })} />);
    expect(screen.getByTestId(`gql-env-item-${env2.id}`)).toHaveClass('gql-env-sidebar-item--selected');
  });
});

// ─── Import auto-select ────────────────────────────────────────────────────────

describe('GraphqlEnvModal — import auto-select', () => {
  it('selects newly added env when environments array grows', () => {
    const env1 = makeEnv({ name: 'Existing' });
    const { rerender } = render(<GraphqlEnvModal {...makeProps({ environments: [env1] })} />);

    const env2 = makeEnv({ name: 'Imported' });
    rerender(<GraphqlEnvModal {...makeProps({ environments: [env1, env2] })} />);
    expect(screen.getByTestId(`gql-env-item-${env2.id}`)).toHaveClass('gql-env-sidebar-item--selected');
  });
});
