// ─── Results Explorer ────────────────────────────────────────────
export const REX = {
  DIAGRAM: '[data-testid="results-explorer-diagram"]',
  FIT_VIEW_BTN: '[data-testid="results-explorer-fit-view-btn"]',
  VIEW_DIAGRAM: '[data-testid="view-toggle-diagram"]',
  CONSOLE_TOGGLE: '[data-testid="console-toggle-btn-header"]',
  CONSOLE_BODY: '[data-testid="results-console-body"]',
  ITER_PICKER_AGGREGATE: '[data-testid="iter-picker-aggregate"]',
  ITER_PICKER_TOGGLE: '[data-testid="iter-picker-toggle"]',
  ITER_PICKER_DROPDOWN: '[data-testid="iter-picker-dropdown"]',
  /** Iteration picker item by zero-based iteration index. */
  iterPickerItem: (index: number) => `[data-testid="iter-picker-item-${index}"]` as const,
  DETAIL_PANEL_TOGGLE: '[data-testid="detail-panel-toggle"]',
  /** Any rendered execution node inside the explorer canvas. */
  CANVAS_NODE: '.results-explorer-diagram .react-flow__node',
} as const;
