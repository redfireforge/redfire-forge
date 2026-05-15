/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBottomUtilityDock } from './useBottomUtilityDock';

describe('useBottomUtilityDock', () => {
  it('initializes with bottomUtilityMode "none" and rulesModalOpen false', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    expect(result.current.bottomUtilityMode).toBe('none');
    expect(result.current.rulesModalOpen).toBe(false);
  });

  it('handleTogglePreview toggles between preview and none', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('preview');

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('none');
  });

  it('handleToggleCodeView toggles between code and none', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleCodeView();
    });
    expect(result.current.bottomUtilityMode).toBe('code');

    act(() => {
      result.current.handleToggleCodeView();
    });
    expect(result.current.bottomUtilityMode).toBe('none');
  });

  it('handleToggleTableView toggles between table and none', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleTableView();
    });
    expect(result.current.bottomUtilityMode).toBe('table');

    act(() => {
      result.current.handleToggleTableView();
    });
    expect(result.current.bottomUtilityMode).toBe('none');
  });

  it('handleToggleRulesView toggles rulesModalOpen independently of bottomUtilityMode', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.rulesModalOpen).toBe(true);
    expect(result.current.bottomUtilityMode).toBe('none');

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.rulesModalOpen).toBe(false);
  });

  it('activating a different dock mode does not affect rulesModalOpen', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.rulesModalOpen).toBe(true);

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('preview');
    expect(result.current.rulesModalOpen).toBe(true);

    act(() => {
      result.current.handleToggleCodeView();
    });
    expect(result.current.bottomUtilityMode).toBe('code');
    expect(result.current.rulesModalOpen).toBe(true);
  });

  it('handleCloseRulesModal closes the rules modal', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.rulesModalOpen).toBe(true);

    act(() => {
      result.current.handleCloseRulesModal();
    });
    expect(result.current.rulesModalOpen).toBe(false);
  });

  it('handler references remain stable across renders', () => {
    const { result, rerender } = renderHook(() => useBottomUtilityDock());

    const first = {
      handleTogglePreview: result.current.handleTogglePreview,
      handleToggleCodeView: result.current.handleToggleCodeView,
      handleToggleTableView: result.current.handleToggleTableView,
      handleToggleRulesView: result.current.handleToggleRulesView,
      handleCloseRulesModal: result.current.handleCloseRulesModal,
    };

    rerender();

    expect(result.current.handleTogglePreview).toBe(first.handleTogglePreview);
    expect(result.current.handleToggleCodeView).toBe(first.handleToggleCodeView);
    expect(result.current.handleToggleTableView).toBe(first.handleToggleTableView);
    expect(result.current.handleToggleRulesView).toBe(first.handleToggleRulesView);
    expect(result.current.handleCloseRulesModal).toBe(first.handleCloseRulesModal);
  });
});
