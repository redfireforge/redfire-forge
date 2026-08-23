/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VerifyRowCard from './VerifyRowCard';
import type { VerifyResult } from '../hooks/useVerifyEngine';
import type { DataSourceColumn, DataSourceRow } from '@shared/types';

// ─── Helpers ──────────────────────────────────────────────────

const requestCols: DataSourceColumn[] = [
  { id: 'c1', name: 'userId', type: 'path', mapping: 'userId' },
];

const validateCols: DataSourceColumn[] = [
  { id: 'v1', name: 'name', type: 'validate', mapping: '$.name' },
  { id: 'v2', name: 'email', type: 'validate', mapping: '$.email' },
];

const row: DataSourceRow = {
  id: 'r1',
  label: 'User 1',
  values: { c1: '42', v1: 'Alice', v2: 'alice@test.com' },
  enabled: true,
};

const rowNoLabel: DataSourceRow = {
  id: 'r2',
  values: { c1: '99', v1: 'Bob', v2: '' },
  enabled: true,
};

function makeVr(overrides: Partial<VerifyResult> = {}): VerifyResult {
  return {
    rowId: 'r1',
    status: 'pass',
    httpStatus: 200,
    failedCells: {},
    actualCells: {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('VerifyRowCard', () => {
  it('renders pending state when no vr', () => {
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={undefined}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(container.querySelector('.verify-card-icon')?.textContent).toBe('○');
    expect(screen.getByText('User 1')).toBeTruthy();
  });

  it('renders pass status correctly', () => {
    const vr = makeVr({ status: 'pass' });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(container.querySelector('.verify-card-pass')).toBeTruthy();
    expect(container.querySelector('.verify-card-icon')?.textContent).toBe('✓');
    expect(screen.getByText('PASS')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('renders fail status with mismatch count', () => {
    const vr = makeVr({ status: 'fail', failedCells: { v1: 'Bob' } });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(container.querySelector('.verify-card-fail')).toBeTruthy();
    expect(screen.getByText('FAIL')).toBeTruthy();
    expect(screen.getByText(/1 Mismatch/)).toBeTruthy();
  });

  it('renders error with simple message', () => {
    const vr = makeVr({ status: 'error', error: 'Connection refused' });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(container.querySelector('.verify-card-error')).toBeTruthy();
    expect(screen.getByText(/Connection refused/)).toBeTruthy();
  });

  it('renders error with detailed info when showErrorDetails=true', () => {
    const vr = makeVr({
      status: 'error',
      error: 'HTTP 500',
      resolvedUrl: 'https://api.example.com/users/42',
      responseBody: '{"error":"internal"}',
      requestHeaders: { 'content-type': 'application/json' },
    });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        showErrorDetails
      />,
    );
    expect(screen.getByText('https://api.example.com/users/42')).toBeTruthy();
  });

  it('renders warn message when showWarnMessage=true', () => {
    const vr = makeVr({ status: 'warn', httpStatus: 200 });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        showWarnMessage
      />,
    );
    expect(screen.getByText(/no validation columns defined/)).toBeTruthy();
  });

  it('does not render warn message when showWarnMessage=false', () => {
    const vr = makeVr({ status: 'warn', httpStatus: 200 });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        showWarnMessage={false}
      />,
    );
    expect(screen.queryByText(/no validation columns defined/)).toBeNull();
  });

  it('hides validation section when collapsed', () => {
    const vr = makeVr({ status: 'pass' });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={true}
      />,
    );
    expect(container.querySelector('.verify-validation-section')).toBeNull();
  });

  it('shows request variables', () => {
    render(
      <VerifyRowCard
        row={row} idx={0} vr={undefined}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(screen.getByText('userId')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('falls back to "Row N" when no label', () => {
    render(
      <VerifyRowCard
        row={rowNoLabel} idx={2} vr={undefined}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(screen.getByText('Row 3')).toBeTruthy();
  });

  it('renders verifying icon when progress matches idx', () => {
    const { container } = render(
      <VerifyRowCard
        row={row} idx={1} vr={undefined}
        verifying={true} progressCurrent={1}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(container.querySelector('.verify-card-active')).toBeTruthy();
    expect(container.querySelector('.verify-card-icon')?.textContent).toBe('⟳');
  });

  it('renders Update button when onUpdateExpectedCell provided and cell failed', () => {
    const onUpdate = vi.fn();
    const vr = makeVr({ status: 'fail', failedCells: { v1: 'Bob' } });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        onUpdateExpectedCell={onUpdate}
      />,
    );
    const updateBtn = screen.getByText('Update');
    fireEvent.click(updateBtn);
    expect(onUpdate).toHaveBeenCalledWith('r1', 'v1', 'Bob');
  });

  it('does not render Update button when onUpdateExpectedCell not provided', () => {
    const vr = makeVr({ status: 'fail', failedCells: { v1: 'Bob' } });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    expect(screen.queryByText('Update')).toBeNull();
  });

  it('renders Accept All for Row button when onAcceptAllForRow provided', () => {
    const onAccept = vi.fn();
    const vr = makeVr({ status: 'fail', failedCells: { v1: 'Bob' } });
    render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        onAcceptAllForRow={onAccept}
      />,
    );
    const acceptBtn = screen.getByText('Accept All for Row');
    fireEvent.click(acceptBtn);
    expect(onAccept).toHaveBeenCalledWith('r1');
  });

  it('skips validate cells with empty values', () => {
    const vr = makeVr({ status: 'pass' });
    const { container } = render(
      <VerifyRowCard
        row={rowNoLabel} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    // v2 has empty value so should not render
    const valRows = container.querySelectorAll('.verify-val-table tbody tr');
    expect(valRows).toHaveLength(1); // only v1 with 'Bob'
  });

  it('renders validation table with correct columns when actions enabled', () => {
    const vr = makeVr({ status: 'pass' });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
        onUpdateExpectedCell={vi.fn()}
      />,
    );
    const headers = container.querySelectorAll('.verify-val-table thead th');
    expect(headers).toHaveLength(5); // status, field, expected, actual, actions
  });

  it('renders validation table without actions column by default', () => {
    const vr = makeVr({ status: 'pass' });
    const { container } = render(
      <VerifyRowCard
        row={row} idx={0} vr={vr}
        verifying={false} progressCurrent={0}
        requestCols={requestCols} validateCols={validateCols}
        collapsed={false}
      />,
    );
    const headers = container.querySelectorAll('.verify-val-table thead th');
    expect(headers).toHaveLength(4); // status, field, expected, actual
  });
});
