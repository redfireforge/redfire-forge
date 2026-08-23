/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import MappingTraceOverlay from './MappingTraceOverlay';
import type { MappingTrace } from '@shared/components/data-mapper/utils/mappingTrace';

describe('MappingTraceOverlay', () => {
  it('renders pass and fail counts', () => {
    const traces: MappingTrace[] = [
      {
        mappingId: 'm1',
        sourcePath: '$.a',
        sourceValue: 1,
        evaluatedValue: 1,
        targetPath: 'a',
        targetValue: 1,
        timestamp: 0,
        durationMs: 1.234,
      },
      {
        mappingId: 'm2',
        sourcePath: '$.b',
        sourceValue: null,
        evaluatedValue: undefined,
        targetPath: 'b',
        targetValue: undefined,
        timestamp: 0,
        durationMs: 0.5,
        error: 'eval failed',
      },
    ];
    const onClose = vi.fn();
    render(<MappingTraceOverlay traces={traces} nodeLabel="HTTP 1" onClose={onClose} />);
    expect(screen.getByText('1 passed')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getByText('Mapping Traces — HTTP 1')).toBeInTheDocument();
  });

  it('renders expression cell with ƒx prefix and plain cell when no expression', () => {
    const traces: MappingTrace[] = [
      {
        mappingId: 'expr',
        sourcePath: 'x',
        sourceValue: 0,
        expression: '$.a + 1',
        evaluatedValue: 2,
        targetPath: 'out',
        targetValue: 2,
        timestamp: 0,
        durationMs: 0.01,
      },
      {
        mappingId: 'plain',
        sourcePath: 'y',
        sourceValue: 'hello',
        evaluatedValue: 'hello',
        targetPath: 'msg',
        targetValue: 'hello',
        timestamp: 0,
        durationMs: 0.02,
      },
    ];
    render(<MappingTraceOverlay traces={traces} nodeLabel="N" onClose={() => {}} />);
    expect(screen.getByText(/ƒx/)).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders error vs success status cells and duration dash when missing', () => {
    const traces: MappingTrace[] = [
      {
        mappingId: 'ok',
        sourcePath: 's',
        sourceValue: 1,
        evaluatedValue: 1,
        targetPath: 't',
        targetValue: 1,
        timestamp: 0,
        durationMs: 3.456,
      },
      {
        mappingId: 'bad',
        sourcePath: 's2',
        sourceValue: null,
        evaluatedValue: undefined,
        targetPath: 't2',
        targetValue: undefined,
        timestamp: 0,
        error: 'boom',
      },
    ];
    render(<MappingTraceOverlay traces={traces} nodeLabel="N" onClose={() => {}} />);
    const rowOk = screen.getByText('t').closest('tr');
    const rowBad = screen.getByText('t2').closest('tr');
    expect(rowOk?.className).not.toContain('mapper-trace-row--error');
    expect(rowOk?.querySelector('.mapper-trace-status--pass')).toBeTruthy();
    expect(rowBad).toHaveClass('mapper-trace-row--error');
    expect(rowBad?.querySelector('.mapper-trace-status--fail')).toBeTruthy();
    expect(screen.getByText('3.46ms')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<MappingTraceOverlay traces={[]} nodeLabel="N" onClose={onClose} />);
    fireEvent.click(document.querySelector('.mapper-trace-overlay-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<MappingTraceOverlay traces={[]} nodeLabel="N2" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
