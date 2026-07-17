/**
 * @vitest-environment jsdom
 *
 * GqlComplexityWarningBanner — unit tests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GqlComplexityWarningBanner } from './GqlComplexityWarningBanner';
import type { ComplexityResult } from '../utils/complexityEstimator';

function makeComplexityResult(overrides: Partial<ComplexityResult> = {}): ComplexityResult {
  return {
    score: 1500,
    threshold: 1000,
    blocked: false,
    ...overrides,
  };
}

beforeEach(() => {
  resetAllMocks();
});

describe('GqlComplexityWarningBanner — rendering', () => {
  it('renders nothing when visible=false', () => {
    const { container } = render(
      <GqlComplexityWarningBanner
        visible={false}
        complexityResult={makeComplexityResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when complexityResult=null', () => {
    const { container } = render(
      <GqlComplexityWarningBanner
        visible={true}
        complexityResult={null}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when visible=true and complexityResult is provided', () => {
    render(
      <GqlComplexityWarningBanner
        visible={true}
        complexityResult={makeComplexityResult({ score: 1500, threshold: 1000 })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-complexity-warning-banner')).not.toBeNull();
    expect(screen.getByText(/cost ~1500/)).not.toBeNull();
    expect(screen.getByText(/threshold 1000/)).not.toBeNull();
  });

  it('renders "Run anyway" and dismiss buttons', () => {
    render(
      <GqlComplexityWarningBanner
        visible={true}
        complexityResult={makeComplexityResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gql-complexity-warning-confirm')).not.toBeNull();
    expect(screen.getByTestId('gql-complexity-warning-dismiss')).not.toBeNull();
  });
});

describe('GqlComplexityWarningBanner — interactions', () => {
  it('calls onConfirm when "Run anyway" is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <GqlComplexityWarningBanner
        visible={true}
        complexityResult={makeComplexityResult()}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-complexity-warning-confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <GqlComplexityWarningBanner
        visible={true}
        complexityResult={makeComplexityResult()}
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByTestId('gql-complexity-warning-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
