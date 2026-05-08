/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TestEditorValidationTab from './TestEditorValidationTab';
import type { TestEditorValidationTabProps } from './TestEditorValidationTab';
import type { Scenario } from '../../../shared/types';
import { createRef } from 'react';

// ── Shared mock setup ────────────────────────────────────────────────────────

vi.mock('../../requests/components/JsonPathBuilder', () => ({
  default: ({ onSampleJsonChange, onUpdate }: { onSampleJsonChange?: (json: string) => void; onUpdate?: (patch: Record<string, unknown>) => void }) => (
    <div data-testid="json-path-builder">
      {onSampleJsonChange && <button data-testid="change-sample" onClick={() => onSampleJsonChange('{"new":"json"}')}>Change Sample</button>}
      {onUpdate && <button data-testid="update-fields" onClick={() => onUpdate({ expectedFields: [{ jsonPath: '$.x', expectedValue: '1' }] })}>Update Fields</button>}
    </div>
  ),
}));
vi.mock('../../requests/components/ResponseVersionPanel', () => ({
  default: ({ onSaveVersion, onRestore, onDeleteVersion, onRenameVersion, versions }: {
    onSaveVersion: () => void;
    onRestore: (v: unknown) => void;
    onDeleteVersion: (id: string) => void;
    onRenameVersion: (id: string, label: string) => void;
    versions: unknown[];
  }) => (
    <div data-testid="response-version-panel">
      <button data-testid="resp-save" onClick={onSaveVersion}>Save Version</button>
      <button data-testid="resp-restore" onClick={() => onRestore({ json: '{}', validationMode: 'selective', selectiveMode: 'include', expectedFields: [], excludedPaths: [] })}>Restore</button>
      <button type="button" data-testid="resp-restore-partial" onClick={() => onRestore({ json: '{"partial":true}' })}>Restore Partial</button>
      {versions.length > 0 && <button data-testid="resp-delete" onClick={() => onDeleteVersion('v1')}>Delete</button>}
      <button data-testid="resp-rename" onClick={() => onRenameVersion('v1', 'renamed')}>Rename</button>
    </div>
  ),
}));
vi.mock('../../requests/components/RulesVersionPanel', () => ({
  default: ({ onSaveVersion, onRestore, onDeleteVersion, onRenameVersion }: {
    onSaveVersion: () => void;
    onRestore: (v: unknown) => void;
    onDeleteVersion: (id: string) => void;
    onRenameVersion: (id: string, label: string) => void;
  }) => (
    <div data-testid="rules-version-panel">
      <button data-testid="rules-save" onClick={onSaveVersion}>Save Rules Version</button>
      <button data-testid="rules-restore" onClick={() => onRestore({ validationMode: 'full', selectiveMode: 'include', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }], excludedPaths: [] })}>Restore Rules</button>
      <button type="button" data-testid="rules-restore-partial" onClick={() => onRestore({ validationMode: 'selective' })}>Restore Rules Partial</button>
      <button data-testid="rules-delete" onClick={() => onDeleteVersion('rv1')}>Delete Rules</button>
      <button data-testid="rules-rename" onClick={() => onRenameVersion('rv1', 'renamed-rule')}>Rename Rules</button>
    </div>
  ),
}));
vi.mock('../../requests/components/RegexAssertionModal', () => ({
  default: ({ onClose, onApply }: { onClose: () => void; onApply: (result: { jsonPath: string; pattern: string }) => void }) => (
    <div data-testid="regex-assertion-modal">
      <button onClick={onClose}>Close Regex Modal</button>
      <button data-testid="apply-regex" onClick={() => onApply({ jsonPath: '$.name', pattern: '^[A-Z]+$' })}>Apply Regex</button>
    </div>
  ),
}));

function makeDraft(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 's1',
    name: 'Test Scenario',
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: {
      mode: 'none',
      assertions: [],
      ...overrides.validation,
    },
    ...overrides,
  };
}

function makeProps(overrides: Partial<TestEditorValidationTabProps> = {}): TestEditorValidationTabProps {
  const draft = overrides.draft ?? makeDraft();
  const draftRef = createRef<Scenario>() as React.MutableRefObject<Scenario>;
  draftRef.current = draft;
  return {
    draft,
    onDraftChange: vi.fn(),
    draftRef,
    resolvedBaseUrl: 'https://api.example.com',
    fetchingResponse: false,
    fetchError: null,
    fetchHostOverride: '',
    setFetchHostOverride: vi.fn(),
    fetchHostEnabled: false,
    setFetchHostEnabled: vi.fn(),
    onFetchSampleResponse: vi.fn(),
    validating: false,
    validationResult: null,
    setValidationResult: vi.fn(),
    onValidateResponse: vi.fn(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TestEditorValidationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertions section', () => {
    it('renders assertions title and preset menu button', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByText('Assertions')).toBeInTheDocument();
      expect(screen.getByText('📋 Presets')).toBeInTheDocument();
    });

    it('shows the + Add button', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByText('+ Add')).toBeInTheDocument();
    });

    it('opens and closes the add-type menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      const addBtn = screen.getByText('+ Add');
      fireEvent.click(addBtn);
      expect(screen.getByText('Status Code')).toBeInTheDocument();
      expect(screen.getByText('Response Time SLA')).toBeInTheDocument();
      expect(screen.getByText('Response Header')).toBeInTheDocument();
      expect(screen.getByText('Regex Match')).toBeInTheDocument();
      expect(screen.getByText('Array Length')).toBeInTheDocument();
      expect(screen.getByText('Numeric Compare')).toBeInTheDocument();
      expect(screen.getByText('Date Compare')).toBeInTheDocument();
    });

    it('calls onDraftChange when adding a status assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Status Code'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'status', expected: '200' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a responseTime assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Response Time SLA'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'responseTime', maxMs: 500 })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a header assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Response Header'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'header' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding an arrayLength assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Array Length'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'arrayLength', operator: '>=' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a numeric assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Numeric Compare'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'numeric' })],
          }),
        })
      );
    });

    it('calls onDraftChange when adding a date assertion', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Date Compare'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'date' })],
          }),
        })
      );
    });

    it('renders existing assertions', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [
            { type: 'status', expected: '201' },
            { type: 'responseTime', maxMs: 300 },
          ],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('STATUS')).toBeInTheDocument();
      expect(screen.getByText('TIME')).toBeInTheDocument();
    });

    it('removes assertion when × button clicked', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const removeBtn = screen.getAllByTitle('Remove assertion')[0];
      fireEvent.click(removeBtn);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ assertions: [] }),
        })
      );
    });

    it('updates status assertion value on change', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const input = screen.getByDisplayValue('200');
      fireEvent.change(input, { target: { value: '201' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates responseTime assertion value on change', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'responseTime', maxMs: 500 }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const input = screen.getByDisplayValue('500');
      fireEvent.change(input, { target: { value: '1000' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('opens regex builder modal when Builder button clicked', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      const builderBtn = screen.getByText('Builder');
      fireEvent.click(builderBtn);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });

    it('closes regex modal on close', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.name', pattern: '.*' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close Regex Modal'));
      expect(screen.queryByTestId('regex-assertion-modal')).not.toBeInTheDocument();
    });

    it('adds regex assertion and opens builder via menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Builder…'));
      expect(onDraftChange).toHaveBeenCalled();
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });
  });

  describe('body validation mode', () => {
    it('renders all three validation mode radio buttons', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.getByLabelText('No Body Validation')).toBeInTheDocument();
      expect(screen.getByLabelText('Full JSON Match')).toBeInTheDocument();
      expect(screen.getByLabelText('Selective Fields')).toBeInTheDocument();
    });

    it('defaults to none mode — no JSON textarea shown', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      expect(screen.queryByPlaceholderText(/Paste the complete expected JSON/)).not.toBeInTheDocument();
    });

    it('shows textarea when full mode selected', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByPlaceholderText(/Paste the complete expected JSON/)).toBeInTheDocument();
    });

    it('shows warning when full mode has no expected JSON', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText(/No expected JSON provided/)).toBeInTheDocument();
    });

    it('calls onDraftChange when mode radio changes', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      const fullRadio = screen.getByLabelText('Full JSON Match');
      fireEvent.click(fullRadio);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'full' }),
        })
      );
    });

    it('shows selective-mode UI elements when in selective mode', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText('Fetch Response')).toBeInTheDocument();
      expect(screen.getByTestId('json-path-builder')).toBeInTheDocument();
    });

    it('shows fetching state on Fetch Response button', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, fetchingResponse: true })} />);
      expect(screen.getByText('Fetching...')).toBeInTheDocument();
    });

    it('shows fetch error when present', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, fetchError: 'Network error' })} />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows pending fetch confirmation when pendingFetchResponse is set', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/New response fetched/)).toBeInTheDocument();
      expect(screen.getByText('Keep Rules & Update Response')).toBeInTheDocument();
      expect(screen.getByText('Replace All')).toBeInTheDocument();
    });

    it('calls onFetchKeepRules when "Keep Rules" clicked', () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective', assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText('Keep Rules & Update Response'));
      expect(onFetchKeepRules).toHaveBeenCalled();
    });

    it('calls onFetchReplaceAll when "Replace All" clicked', () => {
      const onFetchReplaceAll = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective', assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        pendingFetchResponse: '{"id":2}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll,
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText('Replace All'));
      expect(onFetchReplaceAll).toHaveBeenCalled();
    });
  });

  describe('validation result display', () => {
    it('shows passed validation result', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
      })} />);
      expect(screen.getByText('PASSED')).toBeInTheDocument();
    });

    it('shows failed validation result with failure table', () => {
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [{ path: '$.id', expected: '1', actual: '2' }],
        },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByText('$.id')).toBeInTheDocument();
    });

    it('closes validation result on × click', () => {
      const setValidationResult = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.id', expectedValue: '1' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
        setValidationResult,
      })} />);
      const closeBtn = screen.getByRole('button', { name: '×' });
      fireEvent.click(closeBtn);
      expect(setValidationResult).toHaveBeenCalledWith(null);
    });
  });

  describe('host override controls', () => {
    it('updates fetch-row host override input and uses first-row Use Settings', () => {
      const setFetchHostOverride = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      const inputs = () => screen.getAllByPlaceholderText('https://api.example.com');
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        setFetchHostOverride,
        resolvedBaseUrl: 'https://api.example.com',
      })} />);
      expect(inputs()).toHaveLength(1);
      fireEvent.change(inputs()[0], { target: { value: 'https://row-one.test' } });
      expect(setFetchHostOverride).toHaveBeenCalled();
      const useFirst = screen.getAllByTitle('Use Settings base URL')[0]!;
      fireEvent.click(useFirst);
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://api.example.com');
    });

    it('toggles Host Override from validate row when rules exist', () => {
      const setFetchHostEnabled = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        setFetchHostEnabled,
      })} />);
      const hostToggles = screen.getAllByRole('checkbox', { name: /Host Override/i });
      expect(hostToggles.length).toBeGreaterThanOrEqual(2);
      fireEvent.click(hostToggles[hostToggles.length - 1]!);
      expect(setFetchHostEnabled).toHaveBeenCalled();
    });

    it('shows host override input in selective mode', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.getByText('Host Override')).toBeInTheDocument();
    });

    it('shows "Use Settings" button when host override enabled and resolvedBaseUrl present', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        resolvedBaseUrl: 'https://api.example.com',
      })} />);
      const useSettingsBtn = screen.getAllByTitle('Use Settings base URL');
      expect(useSettingsBtn.length).toBeGreaterThan(0);
    });

    it('calls setFetchHostEnabled on checkbox change', () => {
      const setFetchHostEnabled = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({
        draft, draftRef: { current: draft },
        setFetchHostEnabled,
      })} />);
      // The "Host Override" label is a checkbox-label element; find it by label text
      const checkboxes = screen.getAllByRole('checkbox');
      // First is unordered-arrays, second is the Host Override toggle
      fireEvent.click(checkboxes[1]);
      expect(setFetchHostEnabled).toHaveBeenCalled();
    });
  });

  describe('date assertion controls', () => {
    it('renders date assertion with today/fixed selector', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByText('DATE')).toBeInTheDocument();
      expect(screen.getByDisplayValue('today')).toBeInTheDocument();
    });

    it('renders fixed date picker when reference kind is fixed', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef })} />);
      expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    });
  });

  describe('unordered arrays checkbox', () => {
    it('toggles unordered array mode', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      const checkbox = screen.getByRole('checkbox', { name: /Unordered array matching/i });
      fireEvent.click(checkbox);
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ unorderedArrays: true }),
        })
      );
    });
  });

  describe('date assertion interactions', () => {
    it('changes date reference kind to fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const kindSelect = screen.getByDisplayValue('today');
      fireEvent.change(kindSelect, { target: { value: 'fixed' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes timezone for today reference', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const tzSelect = screen.getByDisplayValue('UTC');
      fireEvent.change(tzSelect, { target: { value: 'local' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes fixed date value', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const dateInput = screen.getByDisplayValue('2026-01-01');
      fireEvent.change(dateInput, { target: { value: '2026-06-15' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('changes date comparison operator', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.expiresAt', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const opSelect = screen.getByDisplayValue('after (>)');
      fireEvent.change(opSelect, { target: { value: '<' } });
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('validation result display', () => {
    it('shows PASSED badge', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: true, failures: [], httpStatus: 200 },
      })} />);
      expect(screen.getByText('PASSED')).toBeInTheDocument();
      expect(screen.getByText('HTTP 200')).toBeInTheDocument();
    });

    it('shows FAILED badge with failure table', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [{ path: '$.a', expected: '1', actual: '2' }],
          httpStatus: 200,
        },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.getByText('$.a')).toBeInTheDocument();
    });

    it('dismisses validation result on × click', () => {
      const setValidationResult = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: true, failures: [] },
        setValidationResult,
      })} />);
      fireEvent.click(screen.getByText('×'));
      expect(setValidationResult).toHaveBeenCalledWith(null);
    });
  });

  describe('pending fetch response bar', () => {
    it('shows confirmation bar when pendingFetchResponse is set', () => {
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"new":"data"}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/existing rule/)).toBeInTheDocument();
    });

    it('calls onFetchKeepRules', () => {
      const onFetchKeepRules = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"x":1}',
        onFetchKeepRules,
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText(/Keep Rules/));
      expect(onFetchKeepRules).toHaveBeenCalled();
    });

    it('calls onFetchReplaceAll', () => {
      const onFetchReplaceAll = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{"x":1}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll,
        onFetchCancel: vi.fn(),
      })} />);
      fireEvent.click(screen.getByText(/Replace All/));
      expect(onFetchReplaceAll).toHaveBeenCalled();
    });
  });

  describe('JsonPathBuilder callbacks', () => {
    it('updates sample JSON through JsonPathBuilder', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('change-sample'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ sampleJson: '{"new":"json"}' }),
      }));
    });

    it('updates validation fields through JsonPathBuilder', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('update-fields'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ expectedFields: [{ jsonPath: '$.x', expectedValue: '1' }] }),
      }));
    });
  });

  describe('version panel callbacks', () => {
    it('saves response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], sampleJson: '{"data":true}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-save'));
      expect(onDraftChange).toHaveBeenCalled();
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.responseVersions?.length).toBeGreaterThan(0);
    });

    it('restores a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-restore'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ sampleJson: '{}' }),
      }));
    });

    it('deletes a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], responseVersions: [{ id: 'v1', json: '{}', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ responseVersions: [] }),
      }));
    });

    it('renames a response version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], responseVersions: [{ id: 'v1', json: '{}', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-rename'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('saves rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('restores rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-restore'));
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        validation: expect.objectContaining({ mode: 'full', expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] }),
      }));
    });

    it('deletes rules version', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], rulesVersions: [{ id: 'rv1', timestamp: 1000 }] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-delete'));
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('regex modal apply', () => {
    it('applies regex from modal', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '', pattern: '' }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      // Open regex builder
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      // Apply regex
      fireEvent.click(screen.getByTestId('apply-regex'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('renders modal with empty path when index targets a non-regex assertion after rerender', () => {
      const draftRegex = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.a', pattern: 'x' }],
        },
      });
      const draftRef = { current: draftRegex };
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft: draftRegex, draftRef })} />);
      fireEvent.click(screen.getByText('Builder'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      const draftStatus = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'status', expected: '200' }],
        },
      });
      draftRef.current = draftStatus;
      rerender(<TestEditorValidationTab {...makeProps({ draft: draftStatus, draftRef })} />);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('apply-regex'));
    });
  });

  describe('add assertion menu edge cases', () => {
    it('closes the add menu when clicking outside', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      expect(screen.getByText('Regex Builder…')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText('Regex Builder…')).not.toBeInTheDocument();
    });

    it('adds quick Regex Match assertion from menu', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Match'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ type: 'regex', jsonPath: '$.name', pattern: '^[A-Z].*' })],
          }),
        })
      );
    });
  });

  describe('header assertion row', () => {
    it('updates header name and expected value when operator is contains', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x-h', operator: 'contains', value: 'v' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('Header name'), { target: { value: 'content-type' } });
      fireEvent.change(screen.getByPlaceholderText('Expected value'), { target: { value: 'json' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('does not render value input when operator is exists', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x-h', operator: 'exists' }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });

    it('hides value field after changing operator to exists (parent sync)', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'h', operator: 'contains', value: 'v' }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('contains'), { target: { value: 'exists' } });
      const next = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      draftRef.current = next;
      rerender(<TestEditorValidationTab {...makeProps({ draft: next, draftRef, onDraftChange })} />);
      expect(screen.queryByPlaceholderText('Expected value')).not.toBeInTheDocument();
    });
  });

  describe('regex / array / numeric assertion rows', () => {
    it('updates regex jsonPath and pattern', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '$.a', pattern: 'old' }],
          sampleJson: '{"id":1}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.path'), { target: { value: '$.b' } });
      fireEvent.change(screen.getByPlaceholderText('pattern'), { target: { value: 'newpat' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for regex assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'regex', jsonPath: '', pattern: '' }],
          sampleJson: '{"foo":true}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const pickBtns = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(pickBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('$.foo')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.foo'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates arrayLength path, operator, and compare value', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '$.a', operator: '>=', value: 1 }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.items'), { target: { value: '$.items[*]' } });
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const opSel = selects.find((s) => s.className.includes('assertion-select-operator'))!;
      fireEvent.change(opSel, { target: { value: '=' } });
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '3' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates numeric path, operator, and value', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '$.p', operator: '=', value: 0 }],
          sampleJson: '{}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.price'), { target: { value: '$.qty' } });
      const opSel = screen.getByDisplayValue('equals (=)');
      fireEvent.change(opSel, { target: { value: '>' } });
      fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '42.5' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for arrayLength assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '', operator: '>=', value: 1 }],
          sampleJson: '{"items":[1,2]}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.items')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.items'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('selects json path from JsonPathPicker for numeric assertion', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '', operator: '=', value: 0 }],
          sampleJson: '{"price":9}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getAllByTitle('Pick JSON path from sample response')[0]!);
      await waitFor(() => {
        expect(screen.getByText('$.price')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.price'));
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('date assertion JsonPathPicker', () => {
    it('updates date jsonPath when picking from sample', async () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
          sampleJson: '{"expires":"2026-01-01"}',
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const pickBtns = screen.getAllByTitle('Pick JSON path from sample response');
      fireEvent.click(pickBtns[0]);
      await waitFor(() => {
        expect(screen.getByText('$.expires')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('$.expires'));
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('updates date jsonPath via text input', () => {
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.a', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByPlaceholderText('$.expiresAt'), { target: { value: '$.b' } });
      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('date reference kind switch from fixed to today', () => {
    it('sets today reference with default utc when switching from fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'fixed', iso: '2026-01-01' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const kindSel = screen.getByDisplayValue('fixed date');
      fireEvent.change(kindSel, { target: { value: 'today' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [
              expect.objectContaining({
                reference: { kind: 'today', timezone: 'utc' },
              }),
            ],
          }),
        })
      );
    });
  });

  describe('full body validation mode', () => {
    it('updates expected JSON textarea', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '{}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      const ta = screen.getByPlaceholderText(/Paste the complete expected JSON/);
      fireEvent.change(ta, { target: { value: '{"x":1}' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ expectedJson: '{"x":1}' }),
        })
      );
    });

    it('switches to none via warning link when expected JSON empty', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByRole('button', { name: 'No Body Validation' }));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'none' }),
        })
      );
    });

    it('does not show empty-json warning when expectedJson has content', () => {
      const draft = makeDraft({ validation: { mode: 'full', assertions: [], expectedJson: '{}' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft } })} />);
      expect(screen.queryByText(/No expected JSON provided/)).not.toBeInTheDocument();
    });
  });

  describe('selective mode verify and fetch', () => {
    it('calls onFetchSampleResponse when Fetch Response clicked', () => {
      const onFetchSampleResponse = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onFetchSampleResponse })} />);
      fireEvent.click(screen.getByText('Fetch Response'));
      expect(onFetchSampleResponse).toHaveBeenCalled();
    });

    it('calls onValidateResponse when Verify Rules clicked', () => {
      const onValidateResponse = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onValidateResponse })} />);
      fireEvent.click(screen.getByText('Verify Rules'));
      expect(onValidateResponse).toHaveBeenCalled();
    });

    it('shows Validating… while validating', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, validating: true })} />);
      expect(screen.getByText('Validating...')).toBeInTheDocument();
    });

    it('updates host override from verify row and uses Use Settings', () => {
      const setFetchHostOverride = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        fetchHostEnabled: true,
        fetchHostOverride: '',
        setFetchHostOverride,
        resolvedBaseUrl: 'https://settings.example',
      })} />);
      const verifyRowInputs = document.querySelectorAll('.validate-host-input');
      expect(verifyRowInputs.length).toBe(1);
      fireEvent.change(verifyRowInputs[0], { target: { value: 'https://override.test' } });
      expect(setFetchHostOverride).toHaveBeenCalled();
      const useSettingsInValidate = screen.getAllByTitle('Use Settings base URL').pop()!;
      fireEvent.click(useSettingsInValidate);
      expect(setFetchHostOverride).toHaveBeenCalledWith('https://settings.example');
    });
  });

  describe('validation result copy and edge cases', () => {
    it('uses singular discrepancy when one failure', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: false, failures: [{ path: '$.a', expected: '1', actual: '2' }] },
      })} />);
      expect(screen.getByText('1 discrepancy found')).toBeInTheDocument();
    });

    it('uses plural discrepancies when multiple failures', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: {
          passed: false,
          failures: [
            { path: '$.a', expected: '1', actual: '2' },
            { path: '$.b', expected: 'x', actual: 'y' },
          ],
        },
      })} />);
      expect(screen.getByText('2 discrepancies found')).toBeInTheDocument();
    });

    it('does not render failure table when failed with zero failures', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        validationResult: { passed: false, failures: [] },
      })} />);
      expect(screen.getByText('FAILED')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Path' })).not.toBeInTheDocument();
    });
  });

  describe('pending fetch cancel', () => {
    it('calls onFetchCancel', () => {
      const onFetchCancel = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel,
      })} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onFetchCancel).toHaveBeenCalled();
    });
  });

  describe('version panel early returns', () => {
    it('does not append response version when sample JSON is empty', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], sampleJson: '' } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('does not append rules version when there are no expected fields', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [], expectedFields: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });
  });

  describe('AssertionPresetMenu import', () => {
    it('imports assertions when a preset card is chosen', async () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByText('📋 Presets'));
      await waitFor(() => {
        expect(screen.getByText('API Health Check')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('API Health Check'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: expect.arrayContaining([expect.objectContaining({ type: 'status' })]),
          }),
        })
      );
    });
  });

  describe('rules rename callback', () => {
    it('maps rules version label on rename', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          rulesVersions: [{
            id: 'rv1',
            timestamp: 1,
            validationMode: 'selective',
            expectedFields: [],
            excludedPaths: [],
          }],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.rulesVersions?.[0].label).toBe('renamed-rule');
    });
  });

  describe('selective mode radio', () => {
    it('switches to selective body validation', () => {
      const onDraftChange = vi.fn();
      render(<TestEditorValidationTab {...makeProps({ onDraftChange })} />);
      fireEvent.click(screen.getByLabelText('Selective Fields'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ mode: 'selective' }),
        })
      );
    });
  });

  describe('branch coverage — optional fallbacks and edge handlers', () => {
    it('does not close add menu on mousedown inside the menu', () => {
      render(<TestEditorValidationTab {...makeProps()} />);
      fireEvent.click(screen.getByText('+ Add'));
      const inside = screen.getByText('Status Code');
      fireEvent.mouseDown(inside);
      expect(screen.getByText('Regex Builder…')).toBeInTheDocument();
    });

    it('uses [] when validation.assertions is undefined for list and regex modal index', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'none', assertions: undefined },
      });
      const draftRef = { current: draft };
      const { rerender } = render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Status Code'));
      const afterAdd = onDraftChange.mock.calls.at(-1)![0] as Scenario;
      draftRef.current = afterAdd;
      rerender(<TestEditorValidationTab {...makeProps({ draft: afterAdd, draftRef, onDraftChange })} />);
      fireEvent.click(screen.getByText('+ Add'));
      fireEvent.click(screen.getByText('Regex Builder…'));
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
      const noAssert = makeDraft({ validation: { mode: 'none', assertions: undefined } });
      draftRef.current = noAssert;
      rerender(<TestEditorValidationTab {...makeProps({ draft: noAssert, draftRef, onDraftChange })} />);
      expect(screen.getByTestId('regex-assertion-modal')).toBeInTheDocument();
    });

    it('coerces empty responseTime input to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'none', assertions: [{ type: 'responseTime', maxMs: 500 }] },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('500'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ maxMs: 0 })],
          }),
        })
      );
    });

    it('uses empty string for header value when property is missing', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'header', name: 'x', operator: 'contains' } as import('../../../shared/types').Assertion],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      const val = screen.getByPlaceholderText('Expected value');
      fireEvent.change(val, { target: { value: 'y' } });
      expect(onDraftChange).toHaveBeenCalled();
    });

    it('uses sampleJson fallback and coerces empty arrayLength compare to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'arrayLength', jsonPath: '$.a', operator: '>=', value: 2 }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ value: 0 })],
          }),
        })
      );
    });

    it('uses sampleJson fallback for numeric row and coerces empty numeric value to 0', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'numeric', jsonPath: '$.p', operator: '=', value: 1 }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ value: 0 })],
          }),
        })
      );
    });

    it('preserves timezone when kind select stays on today', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'today', timezone: 'utc' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('today'), { target: { value: 'today' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ reference: { kind: 'today', timezone: 'utc' } })],
          }),
        })
      );
    });

    it('preserves fixed iso when kind select stays on fixed', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'none',
          assertions: [{ type: 'date', jsonPath: '$.d', operator: '>', reference: { kind: 'fixed', iso: '2026-03-15' } }],
        },
      });
      const draftRef = { current: draft };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      fireEvent.change(screen.getByDisplayValue('fixed date'), { target: { value: 'fixed' } });
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            assertions: [expect.objectContaining({ reference: { kind: 'fixed', iso: '2026-03-15' } })],
          }),
        })
      );
    });

    it('uses Enter base URL placeholder when resolvedBaseUrl is empty (fetch and verify rows)', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: [{ jsonPath: '$.a', expectedValue: '1' }] },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        resolvedBaseUrl: '',
        fetchHostEnabled: true,
      })} />);
      const placeholders = screen.getAllByPlaceholderText('Enter base URL');
      expect(placeholders.length).toBeGreaterThanOrEqual(2);
    });

    it('shows existing rule count 0 when expectedFields is undefined in pending fetch bar', () => {
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({
        draft,
        draftRef: { current: draft },
        pendingFetchResponse: '{}',
        onFetchKeepRules: vi.fn(),
        onFetchReplaceAll: vi.fn(),
        onFetchCancel: vi.fn(),
      })} />);
      expect(screen.getByText(/existing rule\(s\)/)).toHaveTextContent('0');
    });

    it('restores response version with omitted optional fields', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({ validation: { mode: 'selective', assertions: [] } });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-restore-partial'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            sampleJson: '{"partial":true}',
            expectedFields: [],
          }),
        })
      );
    });

    it('deletes response version when responseVersions is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          responseVersions: [{ id: 'v1', json: '{}', timestamp: 1 }],
        },
      });
      const draftRef = { current: draft as Scenario };
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef, onDraftChange })} />);
      draftRef.current = {
        ...draft,
        validation: { ...draft.validation, responseVersions: undefined },
      };
      fireEvent.click(screen.getByTestId('resp-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ responseVersions: [] }),
        })
      );
    });

    it('renames one response version without altering others', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          responseVersions: [
            { id: 'v1', json: '{}', timestamp: 1 },
            { id: 'v2', json: '{"a":1}', timestamp: 2 },
          ],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('resp-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.responseVersions).toEqual([
        { id: 'v1', json: '{}', timestamp: 1, label: 'renamed' },
        { id: 'v2', json: '{"a":1}', timestamp: 2 },
      ]);
    });

    it('does not save rules version when expectedFields is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], expectedFields: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-save'));
      expect(onDraftChange).not.toHaveBeenCalled();
    });

    it('restores rules with only validationMode set', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          expectedFields: [{ jsonPath: '$.keep', expectedValue: '1' }],
          excludedPaths: ['$.x'],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-restore-partial'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            mode: 'selective',
            expectedFields: [],
            excludedPaths: ['$.x'],
          }),
        })
      );
    });

    it('deletes rules version when rulesVersions is undefined', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: { mode: 'selective', assertions: [], rulesVersions: undefined },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-delete'));
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({ rulesVersions: [] }),
        })
      );
    });

    it('renames one rules version without altering others', () => {
      const onDraftChange = vi.fn();
      const draft = makeDraft({
        validation: {
          mode: 'selective',
          assertions: [],
          rulesVersions: [
            { id: 'rv1', timestamp: 1, validationMode: 'selective', expectedFields: [], excludedPaths: [] },
            { id: 'rv2', timestamp: 2, validationMode: 'selective', expectedFields: [], excludedPaths: [] },
          ],
        },
      });
      render(<TestEditorValidationTab {...makeProps({ draft, draftRef: { current: draft }, onDraftChange })} />);
      fireEvent.click(screen.getByTestId('rules-rename'));
      const updated = onDraftChange.mock.calls[0][0] as Scenario;
      expect(updated.validation.rulesVersions?.[0].label).toBe('renamed-rule');
      expect(updated.validation.rulesVersions?.[1].label).toBeUndefined();
    });
  });
});
