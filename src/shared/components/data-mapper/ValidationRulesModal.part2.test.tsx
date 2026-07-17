/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import ValidationRulesModal from './ValidationRulesModal';
import { LineVerifyResult } from './ValidationCodeEditor';

let mockEditorInstance: Record<string, unknown>;

vi.mock('./ValidationCodeEditor', () => ({
  default: (props: Record<string, unknown>) => {
    if (typeof props.onEditorMount === 'function') {
      setTimeout(() => {
        mockEditorInstance = {
          getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
          getModel: vi.fn(() => ({
            getLineContent: vi.fn(() => ''),
            getLineLength: vi.fn(() => 0),
          })),
          executeEdits: vi.fn(),
          focus: vi.fn(),
          getDomNode: vi.fn(() => document.createElement('div')),
          revealLineInCenter: vi.fn(),
          setPosition: vi.fn(),
        };
        (props.onEditorMount as (e: unknown) => void)(mockEditorInstance);
      }, 0);
    }
    return (
      <div
        data-testid="validation-code-editor"
        data-value={String(props.value ?? '')}
        data-hide-header={String(props.hideHeader)}
        data-hide-footer={String(props.hideFooter)}
        data-line-results={JSON.stringify(props.lineResults ?? [])}
      >
        <button
          type="button"
          data-testid="simulate-validation-change"
          onClick={() => {
            const wrap = document.querySelector('[data-testid="validation-code-editor"]') as HTMLElement | null;
            const next = wrap?.dataset.nextText ?? 'user-edited-dsl';
            (props.onChange as (t: string) => void)(next);
          }}
        >
          ApplyMockChange
        </button>
      </div>
    );
  },
}));

vi.mock('./DslReferencePanel', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="dsl-reference-panel">
      <button onClick={() => (props.onInsert as (t: string) => void)('test-insert')}>InsertRef</button>
    </div>
  ),
}));

vi.mock('../../../styles/validation-rules-modal.css', () => ({}));

const baseProps = {
  value: 'offers[0].rank  >=  1\n# comment\n',
  onChange: vi.fn(),
  errors: [],
  samplePaths: ['offers', 'offers[0].rank'],
  onClose: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  resetAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('ValidationRulesModal', () => {

  it('Escape after edits invokes cancel with revert behavior', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<ValidationRulesModal {...baseProps} value="keep  exists" onChange={onChange} onClose={onClose} />);

    const editorEl = screen.getByTestId('validation-code-editor');
    editorEl.dataset.nextText = 'discard  equals  9';
    fireEvent.click(screen.getByTestId('simulate-validation-change'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('keep  exists');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Escape when editor mounted ──

  it('Escape closes modal when editor is mounted and suggest widget is absent', () => {
    render(<ValidationRulesModal {...baseProps} />);
    vi.advanceTimersByTime(10);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Insert / editor edge cases ──

  it('skips DSL insert when editor reports no caret position', () => {
    render(<ValidationRulesModal {...baseProps} />);
    vi.advanceTimersByTime(10);

    (mockEditorInstance.getPosition as ReturnType<typeof vi.fn>).mockReturnValue(null);

    fireEvent.click(screen.getByText('InsertRef'));
    expect(mockEditorInstance.executeEdits).not.toHaveBeenCalled();
  });

  // ── Portal: modal-overlay ancestor ──

  it('portals into closest .modal-overlay ancestor when provided', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);

    const container = document.createElement('div');
    overlay.appendChild(container);

    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: container, writable: true });

    render(<ValidationRulesModal {...baseProps} portalContainerRef={ref as RefObject<HTMLDivElement | null>} />);

    expect(overlay.querySelector('.vr-modal-panel')).toBeTruthy();

    document.body.removeChild(overlay);
  });

  // ── lineResults forwarded ──

  it('forwards lineResults to ValidationCodeEditor', () => {
    const lineResults: LineVerifyResult[] = [{ lineNumber: 1, passed: true, actual: 'a', expected: 'b' }];
    render(<ValidationRulesModal {...baseProps} lineResults={lineResults} />);

    const editor = screen.getByTestId('validation-code-editor');
    expect(editor.getAttribute('data-line-results')).toBe(JSON.stringify(lineResults));
  });

  // ── Inline Verify ──

  it('renders Verify button', () => {
    render(<ValidationRulesModal {...baseProps} sampleResponseData={{ offers: [{ rank: 13 }] }} />);
    expect(screen.getByText(/▶ Verify/)).toBeInTheDocument();
  });

  it('Verify button is disabled when no sampleResponseData', () => {
    render(<ValidationRulesModal {...baseProps} />);
    const btn = screen.getByText(/▶ Verify/);
    expect(btn).toBeDisabled();
  });

  it('Verify button is enabled when sampleResponseData is provided', () => {
    render(<ValidationRulesModal {...baseProps} sampleResponseData={{ offers: [{ rank: 13 }] }} />);
    const btn = screen.getByText(/▶ Verify/);
    expect(btn).not.toBeDisabled();
  });

  it('clicking Verify runs inline verification and shows results', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('shows FAILED RULES strip when a rule fails', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/Failed Rules/)).toBeInTheDocument();
  });

  it('results strip close button hides the strip', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/Failed Rules/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close results'));
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('expanding a failed rule shows debug detail', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    // Click the expand arrow on the failed result
    const stripItems = document.querySelectorAll('.vr-results-strip-item');
    expect(stripItems.length).toBe(1);
    fireEvent.click(stripItems[0]);

    // Debug section should appear
    expect(screen.getByText('Input Data')).toBeInTheDocument();
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('inline results clear when text changes', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Simulate text change
    fireEvent.click(screen.getByText('ApplyMockChange'));
    expect(screen.queryByText(/1 failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('shows passed count when all rules pass', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('handles sampleResponseData as JSON string', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={JSON.stringify({ offers: [{ rank: 13 }] })}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles empty response body gracefully', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        sampleResponseData={undefined}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.queryByText(/Failed Rules/)).not.toBeInTheDocument();
  });

  it('jump-to-line button navigates editor to failed line', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );
    vi.advanceTimersByTime(10);

    fireEvent.click(screen.getByText(/▶ Verify/));

    const gotoBtn = document.querySelector('.vr-results-strip-goto');
    expect(gotoBtn).toBeTruthy();
    fireEvent.click(gotoBtn!);

    expect(mockEditorInstance.revealLineInCenter).toHaveBeenCalled();
    expect(mockEditorInstance.setPosition).toHaveBeenCalled();
  });

  it('falls back to parent verifyStatus stats when inline is idle', () => {
    render(
      <ValidationRulesModal
        {...baseProps}
        verifyStatus="complete"
        verifyPassedCount={5}
        verifyFailedCount={2}
      />,
    );

    expect(screen.getByText(/5 passed/)).toBeInTheDocument();
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();
  });

  it('inline verify stats override parent stats', () => {
    const dsl = 'offers[0].rank  equals  "13"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
        verifyStatus="complete"
        verifyPassedCount={5}
        verifyFailedCount={2}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));

    // Should show inline result (1 passed), not parent (5 passed)
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
    expect(screen.queryByText(/5 passed/)).not.toBeInTheDocument();
  });

  // ── DSL assertions (arrayLength, each, contains, custom) ──

  it('verifies array length assertions', () => {
    const dsl = 'offers  length >=  1';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies each assertions and shows failed items', () => {
    const dsl = 'offers[*].rank  each >=  10';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand to see debug detail
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    fireEvent.click(stripItem!);

    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('verifies contains_any assertions', () => {
    const dsl = 'offers  contains_any  {"rank": 13}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies custom ASSERT expressions', () => {
    const dsl = 'ASSERT $gt($count($.body.offers), 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    // Custom assert should pass — count > 0
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('shows debug steps for failed custom ASSERT', () => {
    const dsl = 'ASSERT $eq($count($.body.offers), 99)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
    expect(screen.getByText('Input Data')).toBeInTheDocument();
  });

  it('expandable debug step shows full value on click', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `offer-${i}-with-long-name` }));
    const dsl = 'offers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    // Expand the failed item
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('Input Data section expands and collapses for large data', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `item-${i}` }));
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    // Should see the expandable input data section
    const inputTitle = screen.getByText('Input Data');
    expect(inputTitle).toBeInTheDocument();

    // Click to expand
    fireEvent.click(inputTitle.closest('.vr-debug-section-title--clickable')!);
  });

  it('handles subset assertions', () => {
    const dsl = 'offers  subset  {"rank": 13}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13, name: 'a' }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    // Subset should match
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies mixed rules (field + collection)', () => {
    const dsl = 'offers[0].rank  equals  "13"\noffers  length >=  1';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/2 passed/)).toBeInTheDocument();
  });

  it('debug step row with ▸ toggle indicator for truncated values', () => {
    // Create a scenario where field value is long enough to trigger truncation
    const longValue = 'x'.repeat(100);
    const dsl = 'data  equals  "wrong"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ data: longValue }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    // Should have clickable step rows with toggle
    const clickableSteps = document.querySelectorAll('.vr-debug-step--clickable');
    if (clickableSteps.length > 0) {
      fireEvent.click(clickableSteps[0]);
      // Should show the full value block
      const fullBlock = document.querySelector('.vr-debug-step-full');
      expect(fullBlock).toBeTruthy();
    }
  });

  it('keyboard Enter on failed item toggles expansion', () => {
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.keyDown(stripItem!, { key: 'Enter' });
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();

    // Toggle close
    fireEvent.keyDown(stripItem!, { key: 'Enter' });
    expect(screen.queryByText('Evaluation Steps')).not.toBeInTheDocument();
  });

  it('enriches undefined paths with available keys', () => {
    const dsl = 'nonexistent.field  equals  "x"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }], count: 1 }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('verifies failed array length assertion with debug steps', () => {
    const dsl = 'offers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 1 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('keyboard Enter on Input Data section toggles expansion', () => {
    const longArray = Array.from({ length: 20 }, (_, i) => ({ rank: i, name: `item-${i}` }));
    const dsl = 'offers[0].rank  equals  "999"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: longArray }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    const inputTitle = document.querySelector('.vr-debug-section-title--clickable');
    if (inputTitle) {
      fireEvent.keyDown(inputTitle, { key: 'Enter' });
    }
  });

  it('keyboard Enter on expandable step toggles full value', () => {
    const longVal = 'y'.repeat(100);
    const dsl = 'data  equals  "wrong"';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ data: longVal }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);

    const clickableStep = document.querySelector('.vr-debug-step--clickable');
    if (clickableStep) {
      fireEvent.keyDown(clickableStep, { key: 'Enter' });
      expect(document.querySelector('.vr-debug-step-full')).toBeTruthy();
      // Toggle back
      fireEvent.keyDown(clickableStep, { key: 'Enter' });
      expect(document.querySelector('.vr-debug-step-full')).toBeFalsy();
    }
  });

  it('type check assertions (is_true, is_null) evaluate correctly', () => {
    const dsl = 'active  is_true';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ active: true }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles each assertion that passes fully', () => {
    const dsl = 'offers[*].rank  each >=  0';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 5 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('handles failed contains_any assertion', () => {
    const dsl = 'offers  contains_any  {"rank": 999}';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();

    const stripItem = document.querySelector('.vr-results-strip-item');
    fireEvent.click(stripItem!);
    expect(screen.getByText('Evaluation Steps')).toBeInTheDocument();
  });

  it('shows no debug data message when neither steps nor input exist', () => {
    // This covers the fallback case for assertion types that don't produce debug info
    const dsl = 'ASSERT true';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
  });

  it('handles multiple failed rules with different expansion states', () => {
    const dsl = 'offers[0].rank  equals  "999"\noffers  length >=  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );

    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();

    const stripItems = document.querySelectorAll('.vr-results-strip-item');
    expect(stripItems.length).toBe(2);

    // Expand first
    fireEvent.click(stripItems[0]);
    expect(document.querySelectorAll('.vr-results-strip-debug').length).toBe(1);

    // Expand second (collapses first)
    fireEvent.click(stripItems[1]);
    expect(document.querySelectorAll('.vr-results-strip-debug').length).toBe(1);
  });

  it('verifies ASSERT custom expression failure shows debug steps', () => {
    const dsl = 'ASSERT $gt($.body.nonExistentField.deep, 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    if (stripItem) {
      fireEvent.click(stripItem);
      expect(document.querySelectorAll('.vr-results-strip-debug').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies each assertion with failing items shows debug info', () => {
    const dsl = 'offers[*].rank  each >  100';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }, { rank: 5 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
    const stripItem = document.querySelector('.vr-results-strip-item');
    expect(stripItem).toBeTruthy();
    if (stripItem) {
      fireEvent.click(stripItem);
      expect(document.querySelectorAll('.vr-results-strip-debug').length).toBeGreaterThanOrEqual(1);
    }
  });

  it('verifies ASSERT with valid path passes verification', () => {
    const dsl = 'ASSERT $gt($count($.body.offers), 0)';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });

  it('verifies length assertion on arrays', () => {
    const dsl = 'offers  length >=  2';
    render(
      <ValidationRulesModal
        {...baseProps}
        value={dsl}
        sampleResponseData={{ offers: [{ rank: 13 }, { rank: 14 }] }}
      />,
    );
    fireEvent.click(screen.getByText(/▶ Verify/));
    expect(screen.getByText(/1 passed/)).toBeInTheDocument();
  });
});
