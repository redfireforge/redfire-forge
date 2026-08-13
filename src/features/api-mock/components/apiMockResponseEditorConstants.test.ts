import { describe, expect, it } from 'vitest';
import {
  CONTENT_TYPE_PRESETS,
  CUSTOM_CONTENT_TYPE,
  FAULT_CARDS,
  QUICK_STATUSES,
  STATUS_REASONS,
} from './apiMockResponseEditorConstants';

describe('apiMockResponseEditorConstants', () => {
  it('exports fault cards and content presets', () => {
    expect(FAULT_CARDS.map(c => c.id)).toEqual(['none', 'timeout', 'reset', 'dribble', 'close', 'malformed']);
    expect(CONTENT_TYPE_PRESETS).toContain('application/json');
    expect(CUSTOM_CONTENT_TYPE).toBe('__custom__');
    expect(QUICK_STATUSES).toContain(404);
    expect(STATUS_REASONS[200]).toBe('OK');
    expect(STATUS_REASONS[504]).toBe('Gateway Timeout');
  });
});
