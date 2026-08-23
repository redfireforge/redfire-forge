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

  describe('Rendering', () => {
    it('renders modal with configure title', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Configure Data Source')).toBeInTheDocument();
    });

    it('renders modal with export title', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      expect(screen.getByText('Export Template')).toBeInTheDocument();
    });

    it('renders modal with parameterize title', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      expect(screen.getByText('Create Parameterized Copy')).toBeInTheDocument();
    });

    it('shows test name and method badge', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('Get User')).toBeInTheDocument();
    });

    it('shows step bar with correct labels for configure mode', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Path Variables')).toBeInTheDocument();
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });

    it('shows step bar with all labels for parameterize mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      expect(screen.getByText('Detect Variables')).toBeInTheDocument();
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
      expect(screen.getByText('Validate Fields')).toBeInTheDocument();
      expect(screen.getByText('Column Order')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  describe('Step 1: Variables', () => {
    it('exercises auth and variable setter callbacks passed to SetupStepVariables', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users/1/orders?q=a',
        method: 'POST',
        body: '{"x":"{{bodyVar}}"}',
        headers: [{ key: 'Authorization', value: '{{token}}' }],
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      fireEvent.click(screen.getByTestId('exercise-variable-callbacks'));
    });

    it('renders SetupStepVariables on initial load', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('shows URL segments', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
    });

    it('shows Next: Columns button', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Next: Columns')).toBeInTheDocument();
    });

    it('shows Cancel button', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onClose when Cancel clicked', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('allows toggling segment variable', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      const checkbox = screen.getByTestId('check-1');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('allows setting variable name', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      const checkbox = screen.getByTestId('check-1');
      fireEvent.click(checkbox);
      const nameInput = screen.getByTestId('name-1');
      fireEvent.change(nameInput, { target: { value: 'userId' } });
      expect(nameInput).toHaveValue('userId');
    });
  });

  describe('Step 2: Columns', () => {
    it('navigates to columns step on Next click', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      // Select a segment first
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      
      fireEvent.click(screen.getByText('Next: Columns'));
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
    });

    it('shows columns table after navigating', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Configure Columns')).toBeInTheDocument();
      expect(screen.getByText(/Column Name/)).toBeInTheDocument();
    });

    it('shows Apply to Data Source button in configure mode', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Apply to Data Source')).toBeInTheDocument();
    });

    it('shows Export .xlsx button in export mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Export .xlsx')).toBeInTheDocument();
    });

    it('shows Back button on columns step', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText(/Back/)).toBeInTheDocument();
    });

    it('navigates back to variables step', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      fireEvent.click(screen.getByText(/Back/));
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('loads remembered validate fields and default sampleJson from existing data source', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users/9/orders',
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
            { id: 'vk', name: 'chk', type: 'validate', mapping: 'data.id' },
          ],
          rows: [{ id: 'r1', values: { c1: '9', vk: 'expected-val' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={test} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      expect(screen.getByTestId('first-validate-path')).toHaveTextContent('data.id');
      expect(screen.getByTestId('sample-json-preview')).toHaveTextContent('{}');
    });

    it('shows Next: Validate Fields in parameterize mode', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      expect(screen.getByText('Next: Validate Fields')).toBeInTheDocument();
    });

    it('allows editing column name', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      const inputs = screen.getAllByDisplayValue('userId');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('allows removing a column', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      const removeButtons = screen.getAllByTitle('Remove column');
      const initialCount = removeButtons.length;
      expect(initialCount).toBeGreaterThan(0);
      fireEvent.click(removeButtons[removeButtons.length - 1]);
      expect(screen.getAllByTitle('Remove column').length).toBe(initialCount - 1);
    });

    it('calls onApply when Apply clicked', () => {
      const onApply = vi.fn();
      render(<DataSourceSetupModal {...defaultProps} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      fireEvent.click(screen.getByText('Apply to Data Source'));
      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('Parameterize mode - Steps 3-5', () => {
    function goToStep3() {
      const result = render(
        <DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      return result;
    }

    it('navigates to validate step', () => {
      goToStep3();
      expect(screen.getByTestId('step-validate')).toBeInTheDocument();
    });

    it('shows validation mode', () => {
      goToStep3();
      expect(screen.getByTestId('val-mode')).toHaveTextContent('selective');
    });

    it('navigates to order step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('navigates to review step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });

    it('shows Create & Open button on review step', () => {
      goToStep3();
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      expect(screen.getByText('Create & Open')).toBeInTheDocument();
    });

    it('calls onApply with parameterize options on Create', () => {
      const onApply = vi.fn();
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onApply={onApply}
          sourceName="My Test"
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      fireEvent.click(screen.getByText('Next: Column Order'));
      fireEvent.click(screen.getByText('Next: Review'));
      fireEvent.click(screen.getByText('Create & Open'));
      
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ columns: expect.any(Array), rows: expect.any(Array) }),
        expect.any(String),
        expect.objectContaining({ copyName: expect.any(String) }),
      );
    });
  });

  describe('Column Order in columns step', () => {
    it('shows Column Order button when multiple columns', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      expect(screen.getByText('↕ Column Order')).toBeInTheDocument();
    });

    it('opens column order popover', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('closes column order popover when toggled again', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.queryByTestId('col-order-popover')).not.toBeInTheDocument();
    });

    it('applies column order from popover', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      fireEvent.click(screen.getByTestId('col-order-apply'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
    });

    it('closes column order popover via ColumnOrderPopover onClose', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('↕ Column Order'));
      expect(screen.getByTestId('col-order-popover')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('col-order-close'));
      expect(screen.queryByTestId('col-order-popover')).not.toBeInTheDocument();
    });
  });

  describe('Existing data source', () => {
    it('pre-populates selections from existing data source', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users/{{userId}}/orders',
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [{ id: 'r1', values: { c1: '42' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });

    it('preserves existing rows on Apply', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [
            { id: 'r1', values: { c1: '1' }, enabled: true },
            { id: 'r2', values: { c1: '2' }, enabled: true },
          ],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Apply to Data Source'));
      
      expect(onApply).toHaveBeenCalled();
      const appliedDataTable = onApply.mock.calls[0][0];
      expect(appliedDataTable.rows.length).toBe(2);
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
