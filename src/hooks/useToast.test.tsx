/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToast } from './useToast';
import WorkflowToastProvider from '../components/workflow/WorkflowToastProvider';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <WorkflowToastProvider>{children}</WorkflowToastProvider>;
}

describe('useToast', () => {
  it('returns ToastApi when used within provider', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.show).toBeInstanceOf(Function);
    expect(result.current.dismiss).toBeInstanceOf(Function);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within WorkflowToastProvider');
  });
});
