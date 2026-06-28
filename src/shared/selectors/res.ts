// ─── Results Dashboard ───────────────────────────────────────────
export const RES = {
  /** Wrapper around all headline metric card rows on the Overview tab. */
  METRICS_CARDS: '[data-testid="results-metrics-cards"]',
  /** Second metrics row: P50, P95, P99, error rate, duration, totals. */
  METRICS_LATENCY_ROW: '[data-testid="results-metrics-latency-row"]',
  REQUEST_DETAILS_TAB: '[data-testid="results-tab-requests"]',
  /** Export JSON button in the Results dashboard header. */
  EXPORT_JSON_BTN: '[data-testid="results-export-json-btn"]',
} as const;
