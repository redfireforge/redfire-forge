/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceSetupModal from './DataSourceSetupModal';
import {
  createTestScenario,
  scenarioWithExtraValidateColumn,
  ensurePathVariableChecked,
} from './__test-utils__/dataSourceSetupModalTestHelpers';
import type { FeatureGroup } from '@shared/types';
import { TestEditingContext } from './TestEditorModal';
import { extractJsonPath } from '../utils/dataSourceImport';

vi.mock('../../../shared/components/FullPanelModal', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeFullPanelModalMock();
});

vi.mock('./SetupStepVariables', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeSetupStepVariablesMock();
});

vi.mock('./SetupStepValidate', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeSetupStepValidateMock();
});

vi.mock('./SetupStepReview', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeSetupStepReviewMock();
});

vi.mock('./ColumnOrderPopover', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeColumnOrderPopoverMock();
});

vi.mock('../utils/csvTemplate', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeCsvTemplateMock();
});

vi.mock('../utils/dataSourceSetupUtils', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeDataSourceSetupUtilsMock();
});

vi.mock('../../../shared/utils/templateHelpers', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeTemplateHelpersMock();
});

vi.mock('@engine/core/executor', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeExecutorMock();
});

vi.mock('../../../shared/utils/applyAuthHeaders', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeApplyAuthHeadersMock();
});

vi.mock('../utils/dataSourceImport', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeDataSourceImportMock();
});

vi.mock('uuid', async () => {
  const h = await import('./__test-utils__/dataSourceSetupModalTestHelpers');
  return h.makeUuidMock();
});


describe('DataSourceSetupModal', () => {
  const defaultProps = {
    test: createTestScenario(),
    mode: 'configure' as const,
    onApply: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    resetAllMocks();
  });

  describe('handleApply edge cases', () => {
    it('pre-fills validate cells via extractJsonPath when no data source rows exist', () => {
      vi.mocked(extractJsonPath).mockReturnValueOnce('extracted');
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: {
          mode: 'none',
          sampleJson: '{"items":[{"id":"1"}]}',
          expectedFields: [{ jsonPath: 'items[0].id', expectedValue: '' }],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(extractJsonPath).toHaveBeenCalled();
      expect(onApply).toHaveBeenCalled();
      const [dataTable] = onApply.mock.calls[0];
      expect(dataTable.rows[0].isSample).toBe(true);
    });

    it('ignores invalid sample JSON when parsing', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: {
          mode: 'none',
          sampleJson: 'not-json',
          expectedFields: [{ jsonPath: 'items[0].id', expectedValue: '' }],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalled();
    });

    it('matches migrated columns by name when mapping changes', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'legacy' }],
          rows: [{ id: 'r1', values: { c1: 'migrated-value' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(pathCol).toBeDefined();
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('migrated-value');
    });

    it('passes working auth in configure mode', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        auth: { type: 'bearer', token: 'tok' },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ auth: expect.objectContaining({ type: 'bearer' }) }),
      );
    });

    it('seeds a new param column on the first migrated row when it did not exist before', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref=abc',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('abc');
    });

    it('pre-fills param cells from the literal URL when creating the first data row', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref=xyz',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('xyz');
    });

    it('resolves target scenario when feature groups are provided', () => {
      const groups: FeatureGroup[] = [
        {
          id: 'fg1',
          name: 'G1',
          scenarios: [{ id: 'sc1', name: 'S1', tests: [] }],
        },
      ];
      const editingTest: TestEditingContext = { fgId: 'fg1', scenarioId: 'sc1', testId: 't1' };
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          test={scenarioWithExtraValidateColumn()}
          featureGroups={groups}
          editingTest={editingTest}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });
  });

  describe('handleApply defaultValueForColumn branches and handleClose', () => {
    it('fills path cell from literal URL when template path segment is a placeholder', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(pathCol).toBeDefined();
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('123');
    });

    it('uses empty default when literal path is still a template token', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/{{userId}}/orders',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const pathCol = dataTable.columns.find((c: { type: string }) => c.type === 'path');
      expect(dataTable.rows[0].values[pathCol!.id]).toBe('');
    });

    it('seeds param cell as empty when query value is a placeholder', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        url: 'https://api.example.com/users/123/orders?ref={{dynVar}}',
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const paramCol = dataTable.columns.find((c: { type: string }) => c.type === 'param');
      expect(paramCol).toBeDefined();
      expect(dataTable.rows[0].values[paramCol!.id]).toBe('');
    });

    it('seeds new header column on migrated row via non-path defaultValue branch', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        headers: [{ key: 'X-Trace', value: '{{traceId}}' }],
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      const [dataTable] = onApply.mock.calls[0];
      const headerCol = dataTable.columns.find((c: { type: string }) => c.type === 'header');
      expect(headerCol).toBeDefined();
      expect(dataTable.rows[0].values[headerCol!.id]).toBe('');
    });

    it('does not call onApply when closing panel without validation contract edits', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('persists arrayValidationMode on parameterized create when array mode is set', () => {
      const onApply = vi.fn();
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onApply={onApply}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByTestId('set-array-unordered'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      fireEvent.click(screen.getByText('Create & Open'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ arrayValidationMode: { arrPrefix: 'unordered' } }),
        expect.any(String),
        expect.objectContaining({ copyName: expect.any(String) }),
      );
    });
  });

  describe('Parameterize mode details', () => {
    function goToReview(validationMode?: 'none' | 'full') {
      render(
        <DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      if (validationMode === 'none') {
        fireEvent.click(screen.getByTestId('set-mode-none'));
      }
      if (validationMode === 'full') {
        fireEvent.click(screen.getByTestId('set-mode-full'));
      }
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
    }

    it('shows validation mode labels on review', () => {
      goToReview();
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('Sample Rows Only');
      expect(screen.getByTestId('review-url-preview').textContent).toContain('api.example.com');
    });

    it('sorts review path variables alphabetically', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(0);
      fireEvent.change(screen.getByTestId('name-0'), { target: { value: 'zebra' } });
      ensurePathVariableChecked(2);
      fireEvent.change(screen.getByTestId('name-2'), { target: { value: 'alpha' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('path-projection-order')).toHaveTextContent('alpha,zebra');
    });

    it('shows No Rows label when validation mode is none', () => {
      goToReview('none');
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('No Rows');
    });

    it('shows All Rows label when validation mode is full', () => {
      goToReview('full');
      expect(screen.getByTestId('review-val-mode-label')).toHaveTextContent('All Rows');
    });

    it('disables Create & Open when copy name is empty', () => {
      goToReview();
      fireEvent.change(screen.getByTestId('copy-name'), { target: { value: '   ' } });
      expect(screen.getByText('Create & Open')).toBeDisabled();
    });

    it('merges extra validate fields when advancing from validate step', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByTestId('append-validate-field'));
      expect(screen.getByTestId('val-field-count')).toHaveTextContent('2');
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getAllByTestId('col-order-popover').length).toBeGreaterThan(0);
    });

    it('applies reorder on the column order step', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getAllByTestId('col-order-apply')[0]);
      expect(screen.getByText('Next: Review')).toBeInTheDocument();
    });

    it('shows order step stats', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getByText(/input/)).toBeInTheDocument();
      expect(screen.getByText(/total/)).toBeInTheDocument();
    });
  });
});

/** Find column table textbox by current display value */
function _validateColumnNameInput(value: string): { change: (v: string) => void } {
  const el = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === value);
  expect(el).toBeTruthy();
  return {
    change: (v: string) => fireEvent.change(el!, { target: { value: v } }),
  };
}
