/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataSourceEditor from './DataSourceEditor';
import type { Scenario, DataSource } from '../../../shared/types';

vi.mock('uuid', () => ({ v4: () => `uuid-${Math.random().toString(36).slice(2, 8)}` }));

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test',
    url: 'https://api.example.com/api?channel=WEBRNW',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

function makeDataSource(): DataSource {
  return {
    id: 'dt1',
    columns: [
      { id: 'c1', name: 'vin', type: 'body', mapping: 'vin' },
      { id: 'c2', name: 'channel', type: 'param', mapping: 'channel' },
    ],
    rows: [
      { id: 'r1', values: { c1: '1GYVUZ', c2: 'WEBRNW' }, enabled: true },
      { id: 'r2', values: { c1: '2GYVUZ', c2: 'DEALER' }, enabled: true },
    ],
    source: { type: 'inline' },
  };
}

describe('DataSourceEditor', () => {
  describe('no data source', () => {
    it('renders empty state with setup buttons', () => {
      render(<DataSourceEditor draft={makeScenario()} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Quick Setup/)).toBeTruthy();
      expect(screen.getByText('Configure Wizard')).toBeTruthy();
      expect(screen.getByText(/No data source attached/)).toBeTruthy();
    });

    it('opens wizard on Configure Wizard click', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario()} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('Configure Wizard'));
      // Opens the setup modal
      expect(screen.getByText('Configure Data Source')).toBeTruthy();
    });

    it('Quick Setup auto-creates data source from URL params', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ url: 'https://api.example.com/api?channel=WEBRNW' })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText(/Quick Setup/));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource).toBeTruthy();
      expect(updated.dataSource!.columns.length).toBeGreaterThan(0);
    });
  });

  describe('with data source', () => {
    it('renders DATA SOURCE label and row count', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('DATA SOURCE')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy(); // badge
    });

    it('renders column headers', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText('vin')).toBeTruthy();
      expect(screen.getByText('channel')).toBeTruthy();
    });

    it('renders cell values', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByDisplayValue('1GYVUZ')).toBeTruthy();
      expect(screen.getByDisplayValue('WEBRNW')).toBeTruthy();
    });

    it('calls onDraftChange when cell value changes', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.change(screen.getByDisplayValue('1GYVUZ'), { target: { value: '3GYVUZ' } });
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].values.c1).toBe('3GYVUZ');
    });

    it('adds a row when + Row is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('+ Row'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(3);
    });

    it('adds a column when + Column is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByText('+ Column'));
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns).toHaveLength(3);
      // Each existing row should have the new column's value
      expect(Object.keys(updated.dataSource!.rows[0].values)).toHaveLength(3);
    });

    it('toggles row enabled/disabled', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.data-source-td-checkbox input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].enabled).toBe(false);
    });

    it('deletes a row', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const deleteButtons = screen.getAllByTitle('Delete row');
      fireEvent.click(deleteButtons[0]);
      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(1);
      expect(updated.dataSource!.rows[0].id).toBe('r2');
    });

    it('deletes all rows (resets to one empty row)', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Delete all rows'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows).toHaveLength(1);
      expect(updated.dataSource!.rows[0].values.c1).toBe('');
    });

    it('removes a column and its values from all rows', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const removeColBtns = screen.getAllByTitle('Remove column');
      fireEvent.click(removeColBtns[0]); // remove 'vin'
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.columns).toHaveLength(1);
      expect(updated.dataSource!.columns[0].name).toBe('channel');
      expect(updated.dataSource!.rows[0].values).not.toHaveProperty('c1');
    });

    it('moves row up', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const moveUpBtns = screen.getAllByTitle('Move up');
      fireEvent.click(moveUpBtns[1]); // move row 2 up
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.rows[0].id).toBe('r2');
      expect(updated.dataSource!.rows[1].id).toBe('r1');
    });

    it('renders run preview with correct count', () => {
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={vi.fn()} />);
      expect(screen.getByText(/Run Preview: 2 enabled rows → 2 requests/)).toBeTruthy();
    });

    it('removes entire table when Remove is clicked', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      fireEvent.click(screen.getByTitle('Remove entire data source'));
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource).toBeUndefined();
    });

    it('changes distribution strategy', () => {
      const onChange = vi.fn();
      render(<DataSourceEditor draft={makeScenario({ dataSource: makeDataSource() })} onDraftChange={onChange} />);
      const select = screen.getByTitle('Row distribution strategy');
      fireEvent.change(select, { target: { value: 'random' } });
      const updated = onChange.mock.calls[0][0] as Scenario;
      expect(updated.dataSource!.distribution).toBe('random');
    });
  });
});
