/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { MapperAdapter, Mapping } from './types';
import * as schemaDrift from './utils/schemaDrift';
import * as schemaSnapshot from './utils/schemaSnapshot';

const captured: { props: Record<string, unknown> | null } = { props: null };

vi.mock('./DataMapper', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    captured.props = props;
    return <div data-testid="mock-data-mapper" />;
  },
}));

vi.mock('./DriftBanner', () => ({
  __esModule: true,
  default: (props: { onAccept: () => void; onDismiss: () => void; onShowDiff: () => void }) => (
    <div data-testid="drift-banner">
      <button type="button" onClick={props.onAccept}>accept</button>
      <button type="button" onClick={props.onDismiss}>dismiss</button>
      <button type="button" onClick={props.onShowDiff}>diff</button>
    </div>
  ),
}));

vi.mock('./SchemaDiffModal', () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="schema-diff-modal">
      <button type="button" onClick={props.onClose}>close-diff</button>
    </div>
  ),
}));

import DataMapperModal from './DataMapperModal';

function makeAdapter(overrides: Partial<MapperAdapter<Mapping[]>> = {}): MapperAdapter<Mapping[]> {
  return {
    contextId: 'ctx-drift',
    title: 'Drift Mapper',
    sources: [{ id: 's1', label: 'Source', sampleData: { name: 'Alice' } }],
    target: {
      label: 'Target',
      sampleData: { userName: '' },
      allowCustomFields: false,
      fieldConstraints: { userName: { required: true } },
      fields: [{ path: 'userAge', required: true, type: 'number' }],
    },
    serialize: (m) => m,
    deserialize: (m) => m,
    ...overrides,
  };
}

describe('DataMapperModal — coverage gaps', () => {
  beforeEach(() => {
    captured.props = null;
    vi.restoreAllMocks();
  });

  it('shows validation warnings for unmapped required target fields on save', async () => {
    const adapter = makeAdapter();
    render(<DataMapperModal adapter={adapter} onSave={vi.fn()} onCancel={vi.fn()} />);
    act(() => {
      (captured.props?.onChange as ((m: Mapping[]) => void) | undefined)?.([]);
    });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getAllByText(/Required field/).length).toBeGreaterThan(0);
  });

  it('runs drift detection and shows banner when saved snapshot differs', async () => {
    const savedSource = {
      id: 'snap-s1',
      contextId: 'ctx-drift',
      side: 'source' as const,
      sourceId: 's1',
      fields: [{ path: 'name', type: 'string', depth: 0, isArrayElement: false }],
      capturedAt: new Date().toISOString(),
      topLevelKeyCount: 1,
    };
    vi.spyOn(schemaSnapshot, 'loadSnapshot').mockResolvedValue({
      source: [savedSource],
      target: null,
    });
    vi.spyOn(schemaDrift, 'diffSchemas').mockReturnValue([
      { path: 'name', changeType: 'modified', severity: 'dangerous', oldValue: 'Bob', newValue: 'Alice' },
    ] as never);
    vi.spyOn(schemaDrift, 'findAffectedMappings').mockImplementation((drifts) =>
      drifts.map((d) => ({ ...d, affectedMappingIds: ['m1'] })),
    );
    vi.spyOn(schemaDrift, 'classifyDrift').mockImplementation((drifts) =>
      drifts.map((d) => ({
        ...d,
        affectedMappingIds: ['m1'],
        severity: 'warning' as const,
        description: 'changed',
      })),
    );

    render(<DataMapperModal adapter={makeAdapter()} onSave={vi.fn()} onCancel={vi.fn()} />);
    act(() => {
      (captured.props?.onChange as ((m: Mapping[]) => void) | undefined)?.([
        { sourcePath: 'name', targetPath: 'userName', sourceId: 's1' },
      ]);
    });

    await waitFor(() => expect(screen.getByTestId('drift-banner')).toBeTruthy());
    fireEvent.click(screen.getByText('accept'));
    fireEvent.click(screen.getByText('diff'));
    await waitFor(() => expect(screen.getByTestId('schema-diff-modal')).toBeTruthy());
    fireEvent.click(screen.getByText('close-diff'));
    fireEvent.click(screen.getByText('dismiss'));
  });

  it('uses contextScope in snapshot id', async () => {
    const loadSpy = vi.spyOn(schemaSnapshot, 'loadSnapshot').mockResolvedValue(null);
    render(
      <DataMapperModal
        adapter={makeAdapter()}
        contextScope="scope-1"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    act(() => {
      (captured.props?.onChange as ((m: Mapping[]) => void) | undefined)?.([]);
    });
    await waitFor(() => expect(loadSpy).toHaveBeenCalledWith('ctx-drift:scope-1'));
  });
});
