/**
 * Consolidated sessionStorage helpers for Workflow Designer state.
 * All workflow-scoped transient state belongs here.
 */

/* ── Console open/close ──────────────────────────────────────────────────── */

const CONSOLE_OPEN_KEY = 'workflow_console_open';

export function loadConsoleOpen(): boolean {
  try { return sessionStorage.getItem(CONSOLE_OPEN_KEY) === 'true'; } catch { return false; }
}

export function saveConsoleOpen(open: boolean): void {
  try { sessionStorage.setItem(CONSOLE_OPEN_KEY, String(open)); } catch { /* */ }
}

/* ── Console run behavior ────────────────────────────────────────────────── */

export type ConsoleRunBehavior = 'clear' | 'append';

const RUN_BEHAVIOR_KEY = 'wf-console-run-behavior';

export function loadConsoleRunBehavior(): ConsoleRunBehavior {
  try {
    const v = sessionStorage.getItem(RUN_BEHAVIOR_KEY);
    if (v === 'append') return 'append';
  } catch { /* */ }
  return 'clear';
}

export function saveConsoleRunBehavior(b: ConsoleRunBehavior): void {
  try { sessionStorage.setItem(RUN_BEHAVIOR_KEY, b); } catch { /* */ }
}
