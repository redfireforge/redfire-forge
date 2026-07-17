/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphqlComplexityGateModal } from './GraphqlComplexityGateModal';
import type { ComplexityResult } from '../utils/complexityEstimator';

function makeComplexityResult(overrides: Partial<ComplexityResult> = {}): ComplexityResult {
  return {
    score: 1500,
    depth: 4,
    fieldBreakdown: [],
    ...overrides,
  };
}

describe('GraphqlComplexityGateModal', () => {
  const defaultProps = {
    complexityResult: makeComplexityResult(),
    blockThreshold: 1000,
    onSendAnyway: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the modal dialog', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays the score and threshold in the title', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    // The title contains score and threshold
    const title = screen.getByRole('heading');
    expect(title.textContent).toMatch(/1,500/);
    expect(title.textContent).toMatch(/1,000/);
  });

  it('displays the overPercent in the message', () => {
    // score=1500, threshold=1000 → 150%
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    expect(screen.getByText(/150%/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSendAnyway(false) by default when "Send anyway" is clicked', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Send anyway'));
    expect(defaultProps.onSendAnyway).toHaveBeenCalledWith(false);
  });

  it('calls onSendAnyway(true) when "Remember for this session" is checked then Send is clicked', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Send anyway'));
    expect(defaultProps.onSendAnyway).toHaveBeenCalledWith(true);
  });

  it('calls onCancel when Escape key is pressed', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay backdrop is clicked', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onCancel when modal content is clicked (stops at inner div)', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    // Click the title which is inside the modal content
    const title = screen.getByRole('heading');
    fireEvent.click(title);
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  it('renders field breakdown table when fieldBreakdown is non-empty', () => {
    const props = {
      ...defaultProps,
      complexityResult: makeComplexityResult({
        fieldBreakdown: [
          { fieldName: 'users', typeName: 'User', cost: 10, isList: true },
          { fieldName: 'name', typeName: 'String', cost: 1, isList: false },
        ],
      }),
    };
    render(<GraphqlComplexityGateModal {...props} />);
    expect(screen.getByText('Field cost breakdown')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('list ×10')).toBeInTheDocument();
  });

  it('does NOT render field breakdown table when fieldBreakdown is empty', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    expect(screen.queryByText('Field cost breakdown')).not.toBeInTheDocument();
  });

  it('does not render list badge for non-list fields in breakdown', () => {
    const props = {
      ...defaultProps,
      complexityResult: makeComplexityResult({
        fieldBreakdown: [
          { fieldName: 'id', typeName: 'ID', cost: 1, isList: false },
        ],
      }),
    };
    render(<GraphqlComplexityGateModal {...props} />);
    expect(screen.queryByText('list ×10')).not.toBeInTheDocument();
  });

  it('caps the score bar at 100% width when score greatly exceeds threshold', () => {
    const props = {
      ...defaultProps,
      complexityResult: makeComplexityResult({ score: 9999 }),
    };
    render(<GraphqlComplexityGateModal {...props} />);
    const fill = document.querySelector('.gql-gate-score-fill') as HTMLElement | null;
    // Should be capped at 100%
    expect(fill?.style.width).toBe('100%');
  });

  it('sets width correctly when score is exactly at threshold', () => {
    const props = {
      ...defaultProps,
      complexityResult: makeComplexityResult({ score: 1000 }),
    };
    render(<GraphqlComplexityGateModal {...props} />);
    const fill = document.querySelector('.gql-gate-score-fill') as HTMLElement | null;
    expect(fill?.style.width).toBe('100%');
  });

  it('removes Escape key listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<GraphqlComplexityGateModal {...defaultProps} />);
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true });
  });

  it('does not call onCancel when a non-Escape key is pressed (L44 false branch)', () => {
    render(<GraphqlComplexityGateModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });
});
