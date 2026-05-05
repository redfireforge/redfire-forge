/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TestEditorValidationTab from './TestEditorValidationTab';
import type { TestEditorValidationTabProps } from './TestEditorValidationTab';
import type { Scenario } from '../../../shared/types';
import { createRef } from 'react';

// ── Shared mock setup ────────────────────────────────────────────────────────

vi.mock('../../requests/components/JsonPathBuilder', () => ({
  default: () => <div data-testid="json-path-builder" />,
}));
vi.mock('../../requests/components/ResponseVersionPanel', () => ({
  default: () => <div data-testid="response-version-panel" />,
}));
vi.mock('../../requests/components/RulesVersionPanel', () => ({
  default: () => <div data-testid="rules-version-panel" />,
}));
vi.mock('../../requests/components/RegexAssertionModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="regex-assertion-modal">
      <button onClick={onClose}>Close Regex Modal</button>
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
});
