/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApiMockLiveStrip } from './ApiMockLiveStrip';

describe('ApiMockLiveStrip', () => {
  it('deep-links into Runtime and Conflicts when running', () => {
    const onOpenRuntime = vi.fn();
    const onOpenConflicts = vi.fn();
    render(
      <ApiMockLiveStrip
        transactionCount={4}
        conflictCount={1}
        variableCount={2}
        running
        onOpenRuntime={onOpenRuntime}
        onOpenConflicts={onOpenConflicts}
      />,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByTitle('Running')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('api-mock-live-transactions'));
    expect(onOpenRuntime).toHaveBeenCalledWith('transactions');
    fireEvent.click(screen.getByTestId('api-mock-live-conflicts'));
    expect(onOpenConflicts).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('api-mock-live-variables'));
    expect(onOpenRuntime).toHaveBeenCalledWith('variables');
    fireEvent.click(screen.getByTestId('api-mock-live-settings'));
    expect(onOpenRuntime).toHaveBeenCalledWith('settings');
    fireEvent.click(screen.getByTestId('api-mock-live-console'));
    expect(onOpenRuntime).toHaveBeenCalledWith('console');
    fireEvent.click(screen.getByTestId('api-mock-open-runtime'));
    expect(onOpenRuntime).toHaveBeenCalledWith();
  });

  it('shows stopped state without conflict badge when count is zero', () => {
    const onOpenRuntime = vi.fn();
    render(
      <ApiMockLiveStrip
        transactionCount={0}
        conflictCount={0}
        variableCount={0}
        running={false}
        onOpenRuntime={onOpenRuntime}
        onOpenConflicts={vi.fn()}
      />,
    );
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByTitle('Stopped')).toBeInTheDocument();
    expect(screen.getByTestId('api-mock-live-conflicts').querySelector('.am-count-badge.warning')).toBeNull();
  });
});
