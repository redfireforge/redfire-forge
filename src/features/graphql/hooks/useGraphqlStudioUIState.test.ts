/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioUIState } from './useGraphqlStudioUIState';
import type { FileEntry } from '../utils/multipartBuilder';


describe('useGraphqlStudioUIState', () => {
  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    
    expect(result.current.bottomTab).toBe('variables');
    expect(result.current.rightView).toBe('response');
    expect(result.current.fileEntries).toEqual([]);
    expect(result.current.builderMode).toBe(false);
  });

  it('updates bottomTab state', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    
    act(() => {
      result.current.setBottomTab('auth');
    });
    
    expect(result.current.bottomTab).toBe('auth');
  });

  it('updates rightView state', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    
    act(() => {
      result.current.setRightView('schema');
    });
    
    expect(result.current.rightView).toBe('schema');
  });

  it('updates fileEntries state', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    const mockEntries: FileEntry[] = [
      {
        id: 'f1',
        name: 'test.json',
        file: new File(['{}'], 'test.json', { type: 'application/json' }),
        varPath: 'variables.input.file',
        error: null,
      },
    ];
    
    act(() => {
      result.current.setFileEntries(mockEntries);
    });
    
    expect(result.current.fileEntries).toEqual(mockEntries);
  });

  it('updates builderMode state', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    
    act(() => {
      result.current.setBuilderMode(true);
    });
    
    expect(result.current.builderMode).toBe(true);
  });

  it('focusAuthPanel sets builderMode to false and bottomTab to auth', () => {
    const { result } = renderHook(() => useGraphqlStudioUIState());
    
    // First, set builderMode to true
    act(() => {
      result.current.setBuilderMode(true);
      result.current.setBottomTab('variables');
    });
    
    expect(result.current.builderMode).toBe(true);
    expect(result.current.bottomTab).toBe('variables');
    
    // Call focusAuthPanel
    act(() => {
      result.current.focusAuthPanel();
    });
    
    expect(result.current.builderMode).toBe(false);
    expect(result.current.bottomTab).toBe('auth');
  });
});
