/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { reactFlowOnError } from './reactFlowOnError';

describe('reactFlowOnError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('swallows error 004 (zero-size parent)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reactFlowOnError('004', 'The React Flow parent container needs a width and a height');
    expect(warn).not.toHaveBeenCalled();
  });

  it('forwards other errors in non-production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reactFlowOnError('003', 'Node type missing');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[React Flow]: Node type missing'),
    );
    expect(warn.mock.calls[0][0]).toContain('error#003');
  });

  it('swallows non-004 errors in production mode', () => {
    const previousMode = import.meta.env.MODE;
    import.meta.env.MODE = 'production';
    try {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      reactFlowOnError('003', 'Node type missing');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      import.meta.env.MODE = previousMode;
    }
  });
});
