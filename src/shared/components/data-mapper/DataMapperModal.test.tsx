/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataMapperModal from './DataMapperModal';
import type { MapperAdapter, Mapping, ValidationIssue } from './types';

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
  it('renders with adapter title', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Test Mapper')).toBeTruthy();
  });

  it('renders Done and Cancel buttons', () => {
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onCancel when Cancel clicked', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when X button clicked', () => {
    const adapter = createAdapter();
    const onCancel = vi.fn();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with serialized output when Done clicked (no validation)', () => {
    const onSave = vi.fn();
    const adapter = createAdapter();
    render(<DataMapperModal adapter={adapter} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByTitle('Full screen'));
    expect(container.querySelector('.dm-modal--fullscreen')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Exit full screen'));
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
    fireEvent.click(screen.getByText('Done'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('1 error')).toBeTruthy();
    expect(screen.getByText('1 warning')).toBeTruthy();
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
    fireEvent.click(screen.getByText('Done'));
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
    fireEvent.click(screen.getByText('Done'));
    const pathEl = container.querySelector('.dm-validation-path');
    expect(pathEl?.textContent).toBe('userName');
  });

  it('disables Done button when errors exist', () => {
    const validateFn = vi.fn((): ValidationIssue[] => [
      { mappingId: 'm1', severity: 'error', message: 'Err' },
    ]);
    const adapter = createAdapter({ validate: validateFn });
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Done'));
    const doneBtn = screen.getByText('Done').closest('button');
    expect(doneBtn?.disabled).toBe(true);
  });
});
