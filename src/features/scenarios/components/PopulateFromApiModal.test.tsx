/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOption } from '../../../test-utils/customSelectHelper';
import type { Scenario, DataSource } from '../../../shared/types';
import PopulateFromApiModal from './PopulateFromApiModal';

const mockHookReturn = {
  step: 'fetch' as const,
  loading: false,
  error: null as string | null,
  selectedArray: '',
  fieldMappings: [],
  insertMode: 'append' as const,
  setInsertMode: vi.fn(),
  lastRequest: null,
  lastResponse: null,
  detectedArrays: [],
  arrayItems: [],
  enabledMappings: [] as { field: string; colType: string; enabled: boolean }[],
  duplicateFlags: [],
  duplicateCount: 0,
  effectiveSelections: [],
  selectedCount: 0,
  setRowSelections: vi.fn(),
  handleFetch: vi.fn(),
  handleArrayChange: vi.fn(),
  toggleField: vi.fn(),
  changeFieldType: vi.fn(),
  buildPopulatedData: vi.fn(),
};

vi.mock('../hooks/usePopulateFromApi', () => ({
  usePopulateFromApi: vi.fn(() => mockHookReturn),
}));

import { usePopulateFromApi } from '../hooks/usePopulateFromApi';

const mockUsePopulateFromApi = vi.mocked(usePopulateFromApi);

function makeDraft(): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com',
    method: 'GET',
    headers: [],
    body: '',
    bodyType: 'none',
    validation: { mode: 'none' },
  };
}

function makeDataTable(): DataSource {
  return {
    id: 'ds1',
    columns: [],
    rows: [],
    source: { type: 'inline' },
  };
}

describe('PopulateFromApiModal', () => {
  beforeEach(() => {
    resetAllMocks();
    mockHookReturn.step = 'fetch';
    mockHookReturn.insertMode = 'append';
    mockHookReturn.enabledMappings = [];
    mockHookReturn.arrayItems = [];
    mockHookReturn.selectedCount = 0;
    mockHookReturn.duplicateCount = 0;
    mockHookReturn.buildPopulatedData = vi.fn();
    mockUsePopulateFromApi.mockImplementation(() => ({ ...mockHookReturn }));
  });

  it('renders fetch step and cancel in footer', () => {
    const onClose = vi.fn();
    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('map step shows append footer with duplicate plural', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'append',
      arrayItems: [{}, {}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      duplicateCount: 2,
      selectedCount: 1,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/Populate 1 Row$/)).toBeTruthy();
    const footer = document.querySelector('.populate-api-footer-info');
    expect(footer?.textContent).toMatch(/2 duplicates/);
  });

  it('replace mode shows row count label', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'replace',
      selectedArray: 'items',
      arrayItems: [{ id: 1 }, { id: 2 }],
      enabledMappings: [{ field: 'id', colType: 'path', enabled: true }],
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/items/)).toBeTruthy();
    expect(screen.getByText('Populate 2 Rows')).toBeTruthy();
  });

  it('handlePopulate calls onApply and onClose when buildPopulatedData returns data', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const columns = [{ id: 'c1', name: 'a', type: 'path' as const, mapping: 'a' }];
    const rows = [{ id: 'r1', values: {}, enabled: true }];

    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'append',
      arrayItems: [{}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      selectedCount: 1,
      buildPopulatedData: () => ({ columns, rows }),
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={onApply} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText('Populate 1 Row'));
    expect(onApply).toHaveBeenCalledWith(columns, rows, 'append');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onApply when buildPopulatedData returns null', () => {
    const onApply = vi.fn();
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      arrayItems: [{}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      selectedCount: 1,
      buildPopulatedData: () => null,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={onApply} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('Populate 1 Row'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('changes insert mode via select', () => {
    const setInsertMode = vi.fn();
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      setInsertMode,
      arrayItems: [{}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      selectedCount: 1,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    selectOption(document.body, 'Replace all rows');
    expect(setInsertMode).toHaveBeenCalledWith('replace');
  });

  it('disables populate when no enabled mappings', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      arrayItems: [{}],
      enabledMappings: [],
      selectedCount: 1,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Populate 1 Row/ })).toBeDisabled();
  });

  it('invokes handleFetch when Send Request is clicked in fetch step', () => {
    const handleFetch = vi.fn();
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'fetch',
      handleFetch,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('▶ Send Request'));
    expect(handleFetch).toHaveBeenCalled();
  });

  it('map append footer uses singular duplicate when duplicateCount is 1', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'append',
      arrayItems: [{}, {}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      duplicateCount: 1,
      selectedCount: 1,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    const footer = document.querySelector('.populate-api-footer-info');
    expect(footer?.textContent).toMatch(/1 duplicate/);
    expect(footer?.textContent).not.toMatch(/duplicates/);
  });

  it('map append footer omits duplicate segment when duplicateCount is 0', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'append',
      arrayItems: [{}],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
      duplicateCount: 0,
      selectedCount: 1,
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.queryByText(/duplicate/)).toBeNull();
  });

  it('disables populate in replace mode when arrayItems is empty', () => {
    mockUsePopulateFromApi.mockImplementation(() => ({
      ...mockHookReturn,
      step: 'map',
      insertMode: 'replace',
      selectedArray: 'items',
      arrayItems: [],
      enabledMappings: [{ field: 'a', colType: 'path', enabled: true }],
    }));

    render(
      <PopulateFromApiModal draft={makeDraft()} dataTable={makeDataTable()} onApply={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Populate 0 Rows/ })).toBeDisabled();
  });
});
