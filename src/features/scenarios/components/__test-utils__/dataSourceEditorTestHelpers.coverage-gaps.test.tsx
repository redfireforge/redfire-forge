/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  makeScenario,
  makeDataSource,
  makeDataTransferWithId,
  buildDataSourceGridTableWrapper,
  buildDataSourceToolbarWrapper,
  MockDataSourceRowDetailModal,
} from './dataSourceEditorTestHelpers';

describe('dataSourceEditorTestHelpers coverage gaps', () => {
  it('creates fixtures and transfer payload fallback paths', () => {
    const scenario = makeScenario();
    expect(scenario.validation.mode).toBe('none');

    const scenarioOverride = makeScenario({ method: 'POST', body: '{"ok":true}' as any });
    expect(scenarioOverride.method).toBe('POST');

    const ds = makeDataSource();
    expect(ds.columns).toHaveLength(2);
    expect(ds.rows).toHaveLength(2);

    const transfer = makeDataTransferWithId('abc-id');
    expect(transfer.getData('text/plain')).toBe('abc-id');
    transfer.setData('custom/type', 'v1');
    expect(transfer.getData('custom/type')).toBe('v1');
    expect(transfer.getData('missing/type')).toBe('');
  });

  it('wraps grid and toolbar and forwards probe actions', () => {
    const Grid = vi.fn(() => <div data-testid="actual-grid">grid</div>);
    const WrappedGrid = buildDataSourceGridTableWrapper(Grid as any);

    const setEditingRowId = vi.fn();
    const { getByTestId: getByTestIdGrid } = render(<WrappedGrid setEditingRowId={setEditingRowId} /> as any);
    fireEvent.click(getByTestIdGrid('probe-open-row-detail-ghost'));
    expect(setEditingRowId).toHaveBeenCalledWith('no-such-row-id');
    expect(getByTestIdGrid('actual-grid')).toBeInTheDocument();

    const Toolbar = vi.fn(() => <div data-testid="actual-toolbar">toolbar</div>);
    const WrappedToolbar = buildDataSourceToolbarWrapper(Toolbar as any);

    const onDetachWithCopy = vi.fn();
    const onShowPromoteModal = vi.fn();
    const { getByTestId: getByTestIdToolbar } = render(
      <WrappedToolbar onDetachWithCopy={onDetachWithCopy} onShowPromoteModal={onShowPromoteModal} /> as any,
    );

    fireEvent.click(getByTestIdToolbar('probe-detach-with-copy'));
    fireEvent.click(getByTestIdToolbar('probe-show-promote-modal'));
    expect(onDetachWithCopy).toHaveBeenCalledTimes(1);
    expect(onShowPromoteModal).toHaveBeenCalledTimes(1);
    expect(getByTestIdToolbar('actual-toolbar')).toBeInTheDocument();
  });

  it('row detail modal save branches propagate row and new columns', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const row = { id: 'r1', values: { c1: 'v1' }, enabled: true } as any;
    const dataTable = makeDataSource();

    const { getByText } = render(
      <MockDataSourceRowDetailModal
        onSave={onSave}
        onClose={onClose}
        row={row}
        draft={makeScenario() as any}
        dataTable={dataTable as any}
        rowIndex={0}
      />,
    );

    fireEvent.click(getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ label: 'from-modal' }));

    fireEvent.click(getByText('Save With New Columns'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ values: expect.objectContaining({ 'new-val-col': '' }) }),
      expect.arrayContaining([expect.objectContaining({ id: 'new-val-col' })]),
    );

    fireEvent.click(getByText('Close Row Detail'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
