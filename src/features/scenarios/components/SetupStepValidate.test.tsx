/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SetupStepValidate from './SetupStepValidate';
import type { SetupStepValidateProps } from './SetupStepValidate';

// Mock JsonPathBuilder since it's complex
vi.mock('../../requests/components/JsonPathBuilder', () => ({
  default: ({ onUpdate }: { onUpdate: (patch: Record<string, unknown>) => void }) => (
    <div data-testid="json-path-builder">
      <button type="button" onClick={() => onUpdate({ expectedFields: [{ jsonPath: '$.name', expectedValue: '"test"' }] })}>
        Update Fields
      </button>
      <button type="button" onClick={() => onUpdate({ excludedPaths: ['/skip'] })}>
        Exclude Paths
      </button>
    </div>
  ),
}));

vi.mock('../../../shared/components/data-mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/components/data-mapper')>();
  return {
    ...actual,
    DataMapperModal: ({ onSave, onCancel }: { onSave: (output: { expectedFields: unknown[]; excludedPaths: string[] }) => void; onCancel: () => void }) => (
      <div data-testid="data-mapper-modal">
        <button type="button" onClick={() => onSave({ expectedFields: [{ jsonPath: '$.mapped', expectedValue: '"yes"' }], excludedPaths: ['$.skip'] })}>
          Save Mapper
        </button>
        <button type="button" onClick={onCancel}>
          Cancel Mapper
        </button>
      </div>
    ),
  };
});

function createDefaultProps(overrides: Partial<SetupStepValidateProps> = {}): SetupStepValidateProps {
  return {
    validationMode: 'selective',
    setValidationMode: vi.fn(),
    validateFields: [],
    setValidateFields: vi.fn(),
    validateExcluded: [],
    setValidateExcluded: vi.fn(),
    sampleJson: '',
    setSampleJson: vi.fn(),
    handleFetchForValidate: vi.fn(() => Promise.resolve()),
    fetching: false,
    fetchError: null,
    arrayPrefixes: [],
    arrayModes: {},
    setArrayModes: vi.fn(),
    test: { validation: { mode: 'none', fields: [], sampleJson: undefined } },
    ...overrides,
  };
}

function renderWithRealArrayModes(
  arrayPrefixes: string[],
  initialModes: Record<string, 'ordered' | 'unordered'>,
) {
  const Wrapper = () => {
    const [arrayModes, setArrayModes] = useState(initialModes);
    return (
      <>
        <SetupStepValidate
          {...createDefaultProps({
            sampleJson: '{}',
            arrayPrefixes,
            arrayModes,
            setArrayModes,
          })}
        />
        <span data-testid="array-modes-json">{JSON.stringify(arrayModes)}</span>
      </>
    );
  };
  return render(<Wrapper />);
}

describe('SetupStepValidate', () => {
  it('renders validation mode selector', () => {
    render(<SetupStepValidate {...createDefaultProps()} />);
    expect(screen.getByText('Validation Mode')).toBeInTheDocument();
  });

  it('shows all validation mode options', () => {
    render(<SetupStepValidate {...createDefaultProps()} />);
    expect(screen.getByText('No Rows')).toBeInTheDocument();
    expect(screen.getByText('Sample Rows Only')).toBeInTheDocument();
    expect(screen.getByText('All Rows')).toBeInTheDocument();
  });

  it('calls setValidationMode when mode changes', () => {
    const setValidationMode = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({ setValidationMode })} />);
    
    const noneRadio = screen.getByLabelText('No Rows');
    fireEvent.click(noneRadio);
    expect(setValidationMode).toHaveBeenCalledWith('none');
  });

  it('calls setValidationMode with selective when Sample Rows Only is chosen', () => {
    const setValidationMode = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({
      validationMode: 'none',
      setValidationMode,
    })} />);
    fireEvent.click(screen.getByRole('radio', { name: /Sample Rows Only/ }));
    expect(setValidationMode).toHaveBeenCalledWith('selective');
  });

  it('shows fetch button when no sampleJson', () => {
    render(<SetupStepValidate {...createDefaultProps()} />);
    expect(screen.getByText('📡 Fetch Sample Response')).toBeInTheDocument();
  });

  it('calls handleFetchForValidate when fetch button clicked', () => {
    const handleFetchForValidate = vi.fn(() => Promise.resolve());
    render(<SetupStepValidate {...createDefaultProps({ handleFetchForValidate })} />);
    
    fireEvent.click(screen.getByText('📡 Fetch Sample Response'));
    expect(handleFetchForValidate).toHaveBeenCalled();
  });

  it('shows loading state when fetching', () => {
    render(<SetupStepValidate {...createDefaultProps({ fetching: true })} />);
    expect(screen.getByText('⏳ Fetching…')).toBeInTheDocument();
  });

  it('shows error message when fetchError is present', () => {
    render(<SetupStepValidate {...createDefaultProps({ fetchError: 'Connection failed' })} />);
    expect(screen.getByText('⚠️ Connection failed')).toBeInTheDocument();
  });

  it('shows stored response button when test has sampleJson', () => {
    render(<SetupStepValidate {...createDefaultProps({
      test: { validation: { mode: 'none', fields: [], sampleJson: '{"test": true}' } },
    })} />);
    expect(screen.getByText(/Or use stored response/)).toBeInTheDocument();
  });

  it('renders JsonPathBuilder when sampleJson is present', () => {
    render(<SetupStepValidate {...createDefaultProps({ sampleJson: '{"name": "test"}' })} />);
    expect(screen.getByTestId('json-path-builder')).toBeInTheDocument();
  });

  it('shows re-fetch button when sampleJson is present', () => {
    render(<SetupStepValidate {...createDefaultProps({ sampleJson: '{"name": "test"}' })} />);
    expect(screen.getByText('↻ Re-fetch')).toBeInTheDocument();
  });

  it('calls handleFetchForValidate when re-fetch is clicked', () => {
    const handleFetchForValidate = vi.fn(() => Promise.resolve());
    render(<SetupStepValidate {...createDefaultProps({
      sampleJson: '{}',
      handleFetchForValidate,
    })} />);
    fireEvent.click(screen.getByText('↻ Re-fetch'));
    expect(handleFetchForValidate).toHaveBeenCalled();
  });

  it('displays validate field count when fields selected', () => {
    render(<SetupStepValidate {...createDefaultProps({
      validateFields: [
        { jsonPath: '$.name', expectedValue: '"test"' },
        { jsonPath: '$.id', expectedValue: '123' },
      ],
    })} />);
    expect(screen.getByText('2 fields selected')).toBeInTheDocument();
  });

  it('shows singular for one field', () => {
    render(<SetupStepValidate {...createDefaultProps({
      validateFields: [{ jsonPath: '$.name', expectedValue: '"test"' }],
    })} />);
    expect(screen.getByText('1 field selected')).toBeInTheDocument();
  });

  it('renders array mode toggles when arrayPrefixes present', () => {
    render(<SetupStepValidate {...createDefaultProps({
      sampleJson: '{"items": []}',
      arrayPrefixes: ['items'],
      arrayModes: { items: 'ordered' },
    })} />);
    expect(screen.getByText('Array Validation Order')).toBeInTheDocument();
    expect(screen.getByText('items')).toBeInTheDocument();
  });

  it('calls setValidationMode for full validation', () => {
    const setValidationMode = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({ setValidationMode })} />);
    fireEvent.click(screen.getByLabelText('All Rows'));
    expect(setValidationMode).toHaveBeenCalledWith('full');
  });

  it('loads stored sample JSON when button clicked', () => {
    const setSampleJson = vi.fn();
    const stored = '{"stored":true}';
    render(<SetupStepValidate {...createDefaultProps({
      setSampleJson,
      test: { validation: { mode: 'none', fields: [], sampleJson: stored } },
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Or use stored response/ }));
    expect(setSampleJson).toHaveBeenCalledWith(stored);
  });

  it('forwards excludedPaths from JsonPathBuilder', () => {
    const setValidateExcluded = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({
      sampleJson: '{}',
      setValidateExcluded,
    })} />);
    fireEvent.click(screen.getByText('Exclude Paths'));
    expect(setValidateExcluded).toHaveBeenCalledWith(['/skip']);
  });

  it('forwards expectedFields from JsonPathBuilder', () => {
    const setValidateFields = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({
      sampleJson: '{}',
      setValidateFields,
    })} />);
    fireEvent.click(screen.getByText('Update Fields'));
    expect(setValidateFields).toHaveBeenCalledWith([
      { jsonPath: '$.name', expectedValue: '"test"' },
    ]);
  });

  it('disables re-fetch while fetching', () => {
    render(<SetupStepValidate {...createDefaultProps({
      sampleJson: '{}',
      fetching: true,
    })} />);
    const btn = screen.getByRole('button', { name: /Fetching/ });
    expect(btn).toBeDisabled();
  });

  it('defaults array order mode to ordered then toggles unordered', () => {
    renderWithRealArrayModes(['$.items'], {});
    fireEvent.click(screen.getByText('⟳ Unordered'));
    expect(screen.getByTestId('array-modes-json').textContent).toContain('"$.items":"unordered"');
  });

  it('calls setArrayModes when mode toggle clicked', () => {
    renderWithRealArrayModes(['items'], { items: 'ordered' });
    fireEvent.click(screen.getByText('⟳ Unordered'));
    expect(screen.getByTestId('array-modes-json').textContent).toContain('"items":"unordered"');
  });

  it('calls setArrayModes when switching back to ordered', () => {
    renderWithRealArrayModes(['items'], { items: 'unordered' });
    fireEvent.click(screen.getByText('↕ Ordered'));
    expect(screen.getByTestId('array-modes-json').textContent).toContain('"items":"ordered"');
  });

  // --- Visual Mapper (DataMapperModal) ---

  it('opens Visual Mapper modal when button is clicked', () => {
    render(<SetupStepValidate {...createDefaultProps({ sampleJson: '{"x":1}' })} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
  });

  it('saves mapper output and closes modal', () => {
    const setValidateFields = vi.fn();
    const setValidateExcluded = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({ sampleJson: '{}', setValidateFields, setValidateExcluded })} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    fireEvent.click(screen.getByText('Save Mapper'));
    expect(setValidateFields).toHaveBeenCalledWith([{ jsonPath: '$.mapped', expectedValue: '"yes"' }]);
    expect(setValidateExcluded).toHaveBeenCalledWith(['$.skip']);
    expect(screen.queryByTestId('data-mapper-modal')).toBeNull();
  });

  it('cancels mapper modal without saving', () => {
    const setValidateFields = vi.fn();
    render(<SetupStepValidate {...createDefaultProps({ sampleJson: '{}', setValidateFields })} />);
    fireEvent.click(screen.getByText('⚡ Visual Mapper'));
    expect(screen.getByTestId('data-mapper-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel Mapper'));
    expect(screen.queryByTestId('data-mapper-modal')).toBeNull();
    expect(setValidateFields).not.toHaveBeenCalled();
  });
});
