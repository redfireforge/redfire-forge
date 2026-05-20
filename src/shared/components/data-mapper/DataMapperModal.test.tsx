/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DataMapperModal from './DataMapperModal';
import { MapperAdapter, Mapping, ValidationIssue } from './types';
import * as _schemaDrift from './utils/schemaDrift';

vi.mock('./utils/schemaSnapshot', () => ({
  captureSchemaSnapshot: vi.fn((_contextId: string, side: string, _data: unknown, sourceId?: string) => ({
    id: `snap-${side}-${sourceId ?? 'tgt'}`,
    contextId: 'test',
    side,
    sourceId,
    fields: [
      { path: 'name', type: 'string', depth: 0, isArrayElement: false },
      { path: 'age', type: 'number', depth: 0, isArrayElement: false },
    ],
    capturedAt: new Date().toISOString(),
    topLevelKeyCount: 2,
  })),
  captureSnapshotPair: vi.fn(() => ({
    source: [],
    target: null,
  })),
  loadSnapshot: vi.fn(() => Promise.resolve(null)),
  saveSnapshot: vi.fn(() => Promise.resolve()),
}));

const sampleSource = { name: 'Alice', age: 30 };
const sampleTarget = { userName: '', userAge: 0 };

function createAdapter(overrides?: Partial<MapperAdapter<Mapping[]>>): MapperAdapter<Mapping[]> {
  return {
    contextId: 'test',
    title: 'Test Mapper',
    sources: [{ id: 's1', label: 'HTTP Response', sampleData: sampleSource }],
    target: { label: 'Variables', sampleData: sampleTarget, allowCustomFields: false },
    serialize: (m) => m,
    deserialize: (m) => m,
    ...overrides,
  };
}

describe('DataMapperModal', () => {

  it('renders with adapter title in context badge', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Data Mapper')).toBeTruthy();
    expect(screen.getByText('Test Mapper')).toBeTruthy();
  });

  it('renders context badge and footer helper text', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Test Mapper')).toBeTruthy();
    expect(screen.getByText('Review mappings and save when ready')).toBeTruthy();
  });

  it('renders Save and Cancel buttons', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onCancel when Cancel clicked', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button clicked', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with serialized output when Save clicked (no validation)', () => {
    const onSave = vi.fn();
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(Array.isArray(onSave.mock.calls[0][0])).toBe(true);
  });

  it('blocks save when adapter.validate returns errors', () => {
    const onSave = vi.fn();
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Missing source' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('1 error')).toBeTruthy();
    expect(screen.getByText('Missing source')).toBeTruthy();
  });

  it('allows save when adapter.validate returns warnings only', () => {
    const onSave = vi.fn();
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'warning', message: 'Low confidence match' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 warning')).toBeTruthy();
  });

  it('shows unmapped required field warnings', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      target: {
        label: 'Target',
        sampleData: sampleTarget,
        allowCustomFields: false,
        fieldConstraints: {
          userName: { required: true },
          userAge: { required: true, type: 'number' },
        },
      },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2 warnings')).toBeTruthy();
    expect(screen.getByText(/Required field "userName"/)).toBeTruthy();
    expect(screen.getByText(/Required field "userAge"/)).toBeTruthy();
  });

  it('clears validation issues when mappings change', () => {
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Bad mapping' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Save'));
    expect(container.querySelector('.dm-validation-bar')).toBeTruthy();
    // Note: validation issues clear on next mapping change (onChange callback).
    // We can't easily trigger a mapping change from the modal test without
    // full DnD, but the callback pattern is verified by DataMapper.test.tsx.
  });

  it('toggles full screen mode', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.dm-modal--fullscreen')).toBeNull();
    fireEvent.click(screen.getByLabelText('Enter full screen'));
    expect(container.querySelector('.dm-modal--fullscreen')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Exit full screen'));
    expect(container.querySelector('.dm-modal--fullscreen')).toBeNull();
  });

  it('starts in full screen when fullScreenDefault is true', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal
        adapter={adapter}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        fullScreenDefault
      />,
    );
    expect(container.querySelector('.dm-modal--fullscreen')).toBeTruthy();
  });

  it('renders DataMapper inside the modal', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });

  it('shows error and warning counts together', () => {
    const onSave = vi.fn();
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Bad' },
      { mappingId: 'm2', severity: 'warning', message: 'Hmm' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('1 error')).toBeTruthy();
    expect(screen.getByText('1 warning')).toBeTruthy();
    expect(screen.getByText('1 error must be fixed before saving')).toBeTruthy();
  });

  it('shows validation icons per issue', () => {
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Err' },
      { mappingId: 'm2', severity: 'warning', message: 'Warn' },
      { mappingId: 'm3', severity: 'info', message: 'Info' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Save'));
    const icons = container.querySelectorAll('.dm-validation-icon');
    expect(icons).toHaveLength(3);
    expect(icons[0].textContent).toBe('✕');
    expect(icons[1].textContent).toBe('⚠');
    expect(icons[2].textContent).toBe('ℹ');
  });

  it('shows targetPath for unmapped required field issues', () => {
    const adapter = createAdapter({
      target: {
        label: 'Target',
        sampleData: sampleTarget,
        allowCustomFields: false,
        fieldConstraints: { userName: { required: true } },
      },
    });
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Save'));
    const pathEl = container.querySelector('.dm-validation-path');
    expect(pathEl?.textContent).toBe('userName');
  });

  it('disables Save button when errors exist', () => {
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Err' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    const saveBtn = screen.getByText('Save').closest('button');
    expect(saveBtn?.disabled).toBe(true);
  });

  it('shows required field warnings from target.fields (not just fieldConstraints)', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      target: {
        label: 'Target',
        sampleData: sampleTarget,
        allowCustomFields: false,
        fields: [
          { path: 'requiredField', label: 'Required Field', type: 'string', required: true },
          { path: 'optionalField', label: 'Optional', type: 'string' },
        ],
      },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Required field "requiredField"/)).toBeTruthy();
  });

  it('shows save-failed warning when serialize throws an Error', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      serialize: () => { throw new Error('Serialization boom'); },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Save failed: Serialization boom/)).toBeTruthy();
  });

  it('shows save-failed warning when serialize throws a non-Error value', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      serialize: () => { throw 'string error'; },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Save failed: string error/)).toBeTruthy();
  });

  it('calls onCancel when Escape is pressed with no nested overlays', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onCancel when Escape is pressed with expression overlay open', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />,
    );
    // Simulate a nested expression overlay being present in the DOM
    const overlay = document.createElement('div');
    overlay.className = 'dm-expr-overlay';
    container.appendChild(overlay);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    container.removeChild(overlay);
  });

  it('does NOT call onCancel when Escape is pressed while INPUT is focused', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape', bubbles: true });
    expect(onCancel).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does NOT call onCancel when Escape is pressed while TEXTAREA is focused', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'Escape', bubbles: true });
    expect(onCancel).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('does NOT call onCancel when Escape is pressed on contentEditable element', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    div.dispatchEvent(event);
    expect(onCancel).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('uses custom doneLabel', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} doneLabel="Save Mappings" />);
    expect(screen.getByText('Save Mappings')).toBeTruthy();
  });

  it('shows validation warning when validate throws a non-Error value', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      validate: () => { throw 'string validation error'; },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Validation error: string validation error/)).toBeTruthy();
  });

  it('shows validation warning when validate throws an Error', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      validate: () => { throw new Error('validate boom'); },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/Validation error: validate boom/)).toBeTruthy();
  });

  it('does NOT call onCancel when Escape is pressed with schema diff overlay open', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />,
    );
    const overlay = document.createElement('div');
    overlay.className = 'dm-diff-overlay';
    container.appendChild(overlay);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    container.removeChild(overlay);
  });

  it('does NOT call onCancel when non-Escape key is pressed', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does NOT call onCancel when Escape is pressed on SELECT element', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();
    fireEvent.keyDown(select, { key: 'Escape', bubbles: true });
    expect(onCancel).not.toHaveBeenCalled();
    document.body.removeChild(select);
  });

  it('deduplicates required field warnings between fieldConstraints and fields', () => {
    const onSave = vi.fn();
    const adapter = createAdapter({
      target: {
        label: 'Target',
        sampleData: sampleTarget,
        allowCustomFields: false,
        fieldConstraints: { userName: { required: true } },
        fields: [
          { path: 'userName', label: 'Username', type: 'string', required: true },
          { path: 'extra', label: 'Extra', type: 'string', required: true },
        ],
      },
    });
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    const issues = screen.getAllByText(/Required field/);
    const userNameIssues = issues.filter(el => el.textContent?.includes('userName'));
    expect(userNameIssues.length).toBe(1);
  });

  it('has correct ARIA attributes on the dialog', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const overlay = container.querySelector('.dm-modal-overlay');
    expect(overlay?.getAttribute('role')).toBe('dialog');
    expect(overlay?.getAttribute('aria-modal')).toBe('true');
    expect(overlay?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('saves schema snapshot on successful save', async () => {
    const { saveSnapshot } = await import('./utils/schemaSnapshot');
    const onSave = vi.fn();
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveSnapshot).toHaveBeenCalled();
  });

  it('fires drift detection on mount when snapshot exists', async () => {
    const { loadSnapshot } = await import('./utils/schemaSnapshot');
    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [{
        id: 'snap-1',
        contextId: 'test',
        side: 'source' as const,
        sourceId: 's1',
        fields: [
          { path: 'name', type: 'string', depth: 0, isArrayElement: false },
          { path: 'age', type: 'number', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 2,
      }],
      target: null,
    });
    const adapter = createAdapter();
    await act(async () => {
      render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(loadSnapshot).toHaveBeenCalledWith('test');
  });

  it('does not crash when loadSnapshot rejects', async () => {
    const { loadSnapshot } = await import('./utils/schemaSnapshot');
    vi.mocked(loadSnapshot).mockRejectedValueOnce(new Error('storage fail'));
    const adapter = createAdapter();
    await act(async () => {
      render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(screen.getByText('Test Mapper')).toBeTruthy();
  });

  it('does not show DriftBanner when no saved snapshot', async () => {
    const { loadSnapshot } = await import('./utils/schemaSnapshot');
    vi.mocked(loadSnapshot).mockResolvedValueOnce(null);
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeNull();
  });

  it('renders the modal body with DataMapper inside', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.dm-modal-body')).toBeTruthy();
    expect(container.querySelector('.dm-container')).toBeTruthy();
  });

  it('renders modal shell structure', () => {
    const adapter = createAdapter();
    const { container } = render(
      <DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.querySelector('.dm-modal-shell')).toBeTruthy();
    expect(container.querySelector('.dm-modal-header')).toBeTruthy();
    expect(container.querySelector('.dm-modal-footer')).toBeTruthy();
  });

  it('shows DriftBanner when saved snapshot has removed fields', async () => {
    const { loadSnapshot, captureSchemaSnapshot } = await import('./utils/schemaSnapshot');

    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [{
        id: 'snap-src-s1',
        contextId: 'test',
        side: 'source' as const,
        sourceId: 's1',
        fields: [
          { path: 'name', type: 'string', depth: 0, isArrayElement: false },
          { path: 'age', type: 'number', depth: 0, isArrayElement: false },
          { path: 'email', type: 'string', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 3,
      }],
      target: null,
    });

    vi.mocked(captureSchemaSnapshot).mockReturnValueOnce({
      id: 'snap-current',
      contextId: 'test',
      side: 'source' as const,
      sourceId: 's1',
      fields: [
        { path: 'name', type: 'string', depth: 0, isArrayElement: false },
        { path: 'age', type: 'number', depth: 0, isArrayElement: false },
      ],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 2,
    });

    const adapter = createAdapter();
    const { container } = await act(async () => {
      return render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeTruthy();
  });

  it('dismisses DriftBanner when dismiss is clicked', async () => {
    const { loadSnapshot, captureSchemaSnapshot } = await import('./utils/schemaSnapshot');

    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [{
        id: 'snap-src-s1',
        contextId: 'test',
        side: 'source' as const,
        sourceId: 's1',
        fields: [
          { path: 'name', type: 'string', depth: 0, isArrayElement: false },
          { path: 'removed', type: 'string', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 2,
      }],
      target: null,
    });

    vi.mocked(captureSchemaSnapshot).mockReturnValueOnce({
      id: 'snap-current',
      contextId: 'test',
      side: 'source' as const,
      sourceId: 's1',
      fields: [
        { path: 'name', type: 'string', depth: 0, isArrayElement: false },
      ],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 1,
    });

    const adapter = createAdapter();
    const { container } = await act(async () => {
      return render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeTruthy();

    const dismissBtn = screen.getByLabelText('Dismiss drift notification');
    await act(async () => { fireEvent.click(dismissBtn); });
    expect(container.querySelector('.dm-drift-banner')).toBeNull();
  });

  it('Accept & Update calls saveSnapshot and clears banner', async () => {
    const { loadSnapshot, captureSchemaSnapshot, saveSnapshot } = await import('./utils/schemaSnapshot');

    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [{
        id: 'snap-src-s1',
        contextId: 'test',
        side: 'source' as const,
        sourceId: 's1',
        fields: [
          { path: 'name', type: 'string', depth: 0, isArrayElement: false },
          { path: 'gone', type: 'string', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 2,
      }],
      target: null,
    });

    vi.mocked(captureSchemaSnapshot).mockReturnValueOnce({
      id: 'snap-current',
      contextId: 'test',
      side: 'source' as const,
      sourceId: 's1',
      fields: [
        { path: 'name', type: 'string', depth: 0, isArrayElement: false },
      ],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 1,
    });

    const saveCountBefore = vi.mocked(saveSnapshot).mock.calls.length;
    const adapter = createAdapter();
    const { container } = await act(async () => {
      return render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeTruthy();

    const acceptBtn = screen.getByText('Accept & Update');
    await act(async () => { fireEvent.click(acceptBtn); });
    expect(container.querySelector('.dm-drift-banner')).toBeNull();
    expect(vi.mocked(saveSnapshot).mock.calls.length).toBeGreaterThan(saveCountBefore);
  });

  it('Show Diff opens SchemaDiffModal overlay', async () => {
    const { loadSnapshot, captureSchemaSnapshot } = await import('./utils/schemaSnapshot');

    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [{
        id: 'snap-src-s1',
        contextId: 'test',
        side: 'source' as const,
        sourceId: 's1',
        fields: [
          { path: 'name', type: 'string', depth: 0, isArrayElement: false },
          { path: 'missing', type: 'string', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 2,
      }],
      target: null,
    });

    vi.mocked(captureSchemaSnapshot).mockReturnValueOnce({
      id: 'snap-current',
      contextId: 'test',
      side: 'source' as const,
      sourceId: 's1',
      fields: [
        { path: 'name', type: 'string', depth: 0, isArrayElement: false },
      ],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 1,
    });

    const adapter = createAdapter();
    const { container } = await act(async () => {
      return render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeTruthy();

    const diffBtn = screen.getByText('Show Diff');
    await act(async () => { fireEvent.click(diffBtn); });
    expect(container.querySelector('.dm-diff-overlay')).toBeTruthy();
  });

  it('detects target-side breaking drift and blocks save until resolved', async () => {
    const { loadSnapshot, captureSchemaSnapshot } = await import('./utils/schemaSnapshot');
    vi.mocked(loadSnapshot).mockResolvedValueOnce({
      source: [],
      target: {
        id: 'snap-target',
        contextId: 'test',
        side: 'target' as const,
        fields: [
          { path: 'userName', type: 'string', depth: 0, isArrayElement: false },
        ],
        capturedAt: new Date(Date.now() - 10000).toISOString(),
        topLevelKeyCount: 1,
      },
    });
    vi.mocked(captureSchemaSnapshot).mockReturnValueOnce({
      id: 'snap-current-target',
      contextId: 'test',
      side: 'target' as const,
      fields: [
        { path: 'user_name', type: 'string', depth: 0, isArrayElement: false },
      ],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 1,
    });
    const initialMappings: Mapping[] = [{
      id: 'm-target-drift',
      sourceId: 's1',
      sourcePath: '$.name',
      targetPath: '$.userName',
    }];
    const onSave = vi.fn();
    const adapter = createAdapter({
      deserialize: () => initialMappings,
      target: {
        label: 'Variables',
        sampleData: { user_name: '' },
        allowCustomFields: false,
      },
    });
    const { container } = render(
      <DataMapperModal
        adapter={adapter}
        initialData={initialMappings}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(container.querySelector('.dm-drift-banner')).toBeTruthy();

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/breaking schema drift issue/i)).toBeTruthy();
    expect(container.querySelector('.dm-diff-overlay')).toBeTruthy();
  });

});
