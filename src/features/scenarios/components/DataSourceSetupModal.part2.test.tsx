/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataSourceSetupModal from './DataSourceSetupModal';
import {
  createTestScenario,
  scenarioWithExtraValidateColumn,
  ensurePathVariableChecked,
} from './__test-utils__/dataSourceSetupModalTestHelpers';
import { proxyFetch } from '@engine/core/executor';
import { applyAuthHeaders } from '@shared/utils/applyAuthHeaders';
import { downloadExcel, generateExcelTemplate } from '../utils/csvTemplate';
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

  describe('handleClose with contract changes', () => {
    it('persists validationContract updates when modal closes via FullPanelModal', () => {
      const onApply = vi.fn();
      const onClose = vi.fn();
      const test = createTestScenario({
        validation: { mode: 'none', expectedFields: [{ jsonPath: 'items[0].code', expectedValue: '' }] },
        dataSource: {
          columns: [
            { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
          ],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByRole('button', { name: /fixed → dynamic\?/i }));
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ validationContract: expect.arrayContaining(['items[*].code']) }),
        expect.any(String),
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('removes a dynamic contract pattern when dynamic badge is clicked', () => {
      const onApply = vi.fn();
      const test = createTestScenario({
        validation: { mode: 'none', expectedFields: [{ jsonPath: 'items[0].code', expectedValue: '' }] },
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', values: { c1: '1' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}/orders',
          validationContract: ['items[*].code'],
        },
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} onApply={onApply} onClose={vi.fn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('dynamic'));
      fireEvent.click(screen.getByTestId('full-panel-close'));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ validationContract: undefined }),
        expect.any(String),
      );
    });
  });

  describe('Export mode', () => {
    it('shows Export .xlsx and Apply & Close buttons', () => {
      render(<DataSourceSetupModal {...defaultProps} mode="export" />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText('Export .xlsx')).toBeInTheDocument();
      expect(screen.getByText('Apply & Close')).toBeInTheDocument();
    });
  });

  describe('Query params', () => {
    it('handles URL with query params', () => {
      const test = createTestScenario({
        url: 'https://api.example.com/users?page=1&limit=10',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });
  });

  describe('Body variables', () => {
    it('detects body template variables', () => {
      const test = createTestScenario({
        method: 'POST',
        body: '{"name": "{{userName}}", "age": {{userAge}}}',
      });
      render(<DataSourceSetupModal {...defaultProps} test={test} />);
      expect(screen.getByTestId('step-variables')).toBeInTheDocument();
    });
  });

  describe('Column name validation', () => {
    it('disables Apply when column names are empty', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      const nameInputs = screen.getAllByRole('textbox');
      const emptyCandidate = nameInputs.find(el => (el as HTMLInputElement).value === 'meta');
      expect(emptyCandidate).toBeTruthy();
      fireEvent.change(emptyCandidate!, { target: { value: '' } });
      const applyBtn = screen.getByText('Apply to Data Source');
      expect(applyBtn).toBeDisabled();
    });

    it('shows column type badges', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getAllByText('path').length).toBeGreaterThan(0);
    });

    it('shows column stats', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      
      expect(screen.getByText(/total/)).toBeInTheDocument();
    });

    it('edits column name and strips special chars', () => {
      render(<DataSourceSetupModal {...defaultProps} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));

      const inputs = screen.getAllByRole('textbox');
      const colInput = inputs.find(i => (i as HTMLInputElement).value === 'userId');
      expect(colInput).toBeTruthy();
      fireEvent.change(colInput!, { target: { value: 'bad$name' } });
      expect((colInput as HTMLInputElement).value).toBe('badname');
    });

    it('shows duplicate column name errors', () => {
      render(<DataSourceSetupModal {...defaultProps} test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      validateColumnNameInput('meta').change('userId');
      expect(screen.getAllByText('duplicate').length).toBeGreaterThan(0);
      expect(screen.getByText('Apply to Data Source')).toBeDisabled();
    });
  });

  describe('handleFetchForValidate', () => {
    beforeEach(() => {
      vi.mocked(applyAuthHeaders).mockResolvedValue({});
    });

    it('returns immediately when URL is blank', async () => {
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          test={createTestScenario({
            url: '   ',
            validation: { mode: 'none', expectedFields: [{ jsonPath: 'a', expectedValue: '' }] },
          })}
        />,
      );
      ensurePathVariableChecked(0);
      fireEvent.change(screen.getByTestId('name-0'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(proxyFetch).not.toHaveBeenCalled();
    });

    it('uses onFetchRow when provided and completes without error', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{"x":1}',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(onFetchRow).toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('fetching')).toHaveTextContent('no'));
    });

    it('sets fetchError when onFetchRow returns error', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '',
        error: 'boom',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('boom'));
    });

    it('sets fetchError on HTTP error status', async () => {
      const onFetchRow = vi.fn().mockResolvedValue({
        status: 500,
        statusText: 'Err',
        headers: {},
        body: '',
      });
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('HTTP 500'));
    });

    it('uses proxyFetch when onFetchRow is omitted', async () => {
      vi.mocked(proxyFetch).mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {},
        body: '{}',
      });
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      expect(applyAuthHeaders).toHaveBeenCalled();
      expect(proxyFetch).toHaveBeenCalled();
    });

    it('captures thrown Error in fetchError', async () => {
      const onFetchRow = vi.fn().mockRejectedValue(new Error('network'));
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('network'));
    });

    it('captures non-Error rejection in fetchError', async () => {
      const onFetchRow = vi.fn().mockRejectedValue('raw');
      render(
        <DataSourceSetupModal
          {...defaultProps}
          mode="parameterize"
          onFetchRow={onFetchRow}
          test={scenarioWithExtraValidateColumn()}
        />,
      );
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('raw'));
    });

    it('captures errors when proxyFetch throws', async () => {
      vi.mocked(applyAuthHeaders).mockResolvedValue({});
      vi.mocked(proxyFetch).mockRejectedValue(new Error('proxy down'));
      render(<DataSourceSetupModal {...defaultProps} mode="parameterize" test={scenarioWithExtraValidateColumn()} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      fireEvent.click(screen.getByText('Next: Validate Fields'));
      await act(async () => {
        fireEvent.click(screen.getByTestId('run-fetch-validate'));
      });
      await waitFor(() => expect(screen.getByTestId('fetch-error')).toHaveTextContent('proxy down'));
    });
  });

  describe('handleExport', () => {
    it('downloads template and closes in export mode', async () => {
      const onClose = vi.fn();
      render(<DataSourceSetupModal {...defaultProps} mode="export" onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      await act(async () => {
        fireEvent.click(screen.getByText('Export .xlsx'));
      });
      expect(downloadExcel).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('passes dataRows into generateExcelTemplate when rows exist', async () => {
      const onClose = vi.fn();
      const test = createTestScenario({
        dataSource: {
          columns: [{ id: 'c1', name: 'userId', type: 'path', mapping: 'userId' }],
          rows: [{ id: 'r1', label: 'Row A', values: { c1: '9' }, enabled: true }],
          source: { type: 'inline' },
          urlTemplate: 'https://api.example.com/users/{{userId}}',
        },
      });
      render(<DataSourceSetupModal {...defaultProps} mode="export" test={test} onClose={onClose} />);
      ensurePathVariableChecked(1);
      fireEvent.change(screen.getByTestId('name-1'), { target: { value: 'userId' } });
      fireEvent.click(screen.getByText('Next: Columns'));
      await act(async () => {
        fireEvent.click(screen.getByText('Export .xlsx'));
      });
      expect(generateExcelTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ dataRows: expect.any(Array) }),
      );
    });
  });

});

/** Find column table textbox by current display value */
function validateColumnNameInput(value: string): { change: (v: string) => void } {
  const el = screen.getAllByRole('textbox').find(i => (i as HTMLInputElement).value === value);
  expect(el).toBeTruthy();
  return {
    change: (v: string) => fireEvent.change(el!, { target: { value: v } }),
  };
}
