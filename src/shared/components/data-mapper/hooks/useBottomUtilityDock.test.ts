/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBottomUtilityDock } from './useBottomUtilityDock';

describe('useBottomUtilityDock', () => {
  it('initializes with bottomUtilityMode "none" and rulesFloating false', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    expect(result.current.bottomUtilityMode).toBe('none');
    expect(result.current.rulesFloating).toBe(false);
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

  it('handleToggleRulesView toggles between rules and none', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.bottomUtilityMode).toBe('rules');

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.bottomUtilityMode).toBe('none');
  });

  it('activating a different mode switches away from the current mode', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('preview');

    act(() => {
      result.current.handleToggleCodeView();
    });
    expect(result.current.bottomUtilityMode).toBe('code');

    act(() => {
      result.current.handleToggleTableView();
    });
    expect(result.current.bottomUtilityMode).toBe('table');

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.bottomUtilityMode).toBe('rules');

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('preview');
  });

  it('handleRulesPopOut sets rulesFloating true and closes rules dock when rules was active', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleToggleRulesView();
    });
    expect(result.current.bottomUtilityMode).toBe('rules');

    act(() => {
      result.current.handleRulesPopOut();
    });
    expect(result.current.rulesFloating).toBe(true);
    expect(result.current.bottomUtilityMode).toBe('none');
  });

  it('handleRulesPopOut keeps non-rules bottomUtilityMode unchanged', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleTogglePreview();
    });
    expect(result.current.bottomUtilityMode).toBe('preview');

    act(() => {
      result.current.handleRulesPopOut();
    });
    expect(result.current.rulesFloating).toBe(true);
    expect(result.current.bottomUtilityMode).toBe('preview');
  });

  it('handleRulesPopIn clears floating and opens rules dock', () => {
    const { result } = renderHook(() => useBottomUtilityDock());

    act(() => {
      result.current.handleRulesPopOut();
    });
    expect(result.current.rulesFloating).toBe(true);

    act(() => {
      result.current.handleRulesPopIn();
    });
    expect(result.current.rulesFloating).toBe(false);
    expect(result.current.bottomUtilityMode).toBe('rules');
  });

  it('handler references remain stable across renders', () => {
    const { result, rerender } = renderHook(() => useBottomUtilityDock());

    const first = {
      handleTogglePreview: result.current.handleTogglePreview,
      handleToggleCodeView: result.current.handleToggleCodeView,
      handleToggleTableView: result.current.handleToggleTableView,
      handleToggleRulesView: result.current.handleToggleRulesView,
      handleRulesPopOut: result.current.handleRulesPopOut,
      handleRulesPopIn: result.current.handleRulesPopIn,
    };

    rerender();

    expect(result.current.handleTogglePreview).toBe(first.handleTogglePreview);
    expect(result.current.handleToggleCodeView).toBe(first.handleToggleCodeView);
    expect(result.current.handleToggleTableView).toBe(first.handleToggleTableView);
    expect(result.current.handleToggleRulesView).toBe(first.handleToggleRulesView);
    expect(result.current.handleRulesPopOut).toBe(first.handleRulesPopOut);
    expect(result.current.handleRulesPopIn).toBe(first.handleRulesPopIn);
  });
});
