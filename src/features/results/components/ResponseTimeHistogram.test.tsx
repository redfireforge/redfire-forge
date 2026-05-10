/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResponseTimeHistogram, ResponseTimeOverlayHistogram } from './ResponseTimeHistogram';
import type { TestRun, RequestResult } from '../../../shared/types';

// Mock recharts to avoid complex SVG rendering issues
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ formatter, labelFormatter }: { formatter?: (v: number, n: string) => unknown; labelFormatter?: (l: string) => string }) => {
    const out: Record<string, unknown> = {};
    if (formatter) {
      out.count = formatter(3, 'count');
      out.percent = formatter(5, 'percent');
    }
    if (labelFormatter) {
      out.label = labelFormatter('120');
    }
    return <div data-testid="tooltip" data-format={JSON.stringify(out)} />;
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  Legend: () => <div data-testid="legend" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

function createMockResult(responseTimeMs: number): RequestResult {
  return {
    id: `result-${Math.random()}`,
    scenarioId: 'sc-1',
    scenarioName: 'Test',
    url: 'https://api.example.com/test',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
  };
}

function createMockTestRun(responseTimes: number[]): TestRun {
  return {
    id: 'run-1',
    timestamp: Date.now(),
    config: {
      executionMode: 'sequential',
      iterations: responseTimes.length,
      concurrentUsers: 1,
      thinkTimeMs: 0,
      errorPolicy: 'continue',
    },
    summary: {
      tps: 10,
      avgResponseTime: 100,
      minResponseTime: 50,
      maxResponseTime: 200,
      p50ResponseTime: 100,
      p95ResponseTime: 180,
      p99ResponseTime: 195,
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: responseTimes.length,
      successfulRequests: responseTimes.length,
      failedRequests: 0,
      failedValidations: 0,
      totalDurationMs: 1000,
    },
    results: responseTimes.map(t => createMockResult(t)),
  };
}

describe('ResponseTimeHistogram', () => {
  describe('ResponseTimeHistogram (single run)', () => {
    it('renders histogram with data', () => {
      const run = createMockTestRun([50, 100, 150, 200, 250]);
      render(<ResponseTimeHistogram run={run} />);
      
      expect(screen.getByText('Response Time Distribution')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('displays statistics', () => {
      const run = createMockTestRun([100, 100, 100, 100, 100]);
      render(<ResponseTimeHistogram run={run} />);
      
      // Stats should be displayed
      const container = document.querySelector('.histogram-stats');
      expect(container).toBeInTheDocument();
    });

    it('shows empty hint when no results', () => {
      const run = createMockTestRun([]);
      render(<ResponseTimeHistogram run={run} />);
      
      expect(screen.getByText('No response data for distribution.')).toBeInTheDocument();
    });

    it('handles single data point', () => {
      const run = createMockTestRun([100]);
      render(<ResponseTimeHistogram run={run} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('invokes tooltip formatters for single-run histogram', () => {
      const run = createMockTestRun([50, 100, 150]);
      render(<ResponseTimeHistogram run={run} />);
      const tt = screen.getByTestId('tooltip');
      const fmt = JSON.parse(tt.getAttribute('data-format') ?? '{}');
      expect(fmt.count).toEqual(expect.arrayContaining([3, 'Count']));
      expect(fmt.percent).toEqual(expect.arrayContaining(['5%', 'Percentage']));
      expect(fmt.label).toBe('120 ms');
    });
  });

  describe('ResponseTimeOverlayHistogram', () => {
    it('renders overlay histogram with two runs', () => {
      const baselineRun = createMockTestRun([100, 110, 120, 130, 140]);
      const currentRun = createMockTestRun([90, 100, 110, 120, 130]);
      
      render(
        <ResponseTimeOverlayHistogram
          baselineRun={baselineRun}
          currentRun={currentRun}
        />
      );
      
      expect(screen.getByText('Response Time Distribution (ms)')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('displays baseline and current stats', () => {
      const baselineRun = createMockTestRun([100, 200, 300]);
      const currentRun = createMockTestRun([80, 180, 280]);
      
      render(
        <ResponseTimeOverlayHistogram
          baselineRun={baselineRun}
          currentRun={currentRun}
        />
      );
      
      expect(screen.getByText('Baseline:')).toBeInTheDocument();
      expect(screen.getByText('Current:')).toBeInTheDocument();
    });

    it('toggles between percent and count modes', () => {
      const baselineRun = createMockTestRun([100, 200, 300]);
      const currentRun = createMockTestRun([100, 200, 300]);
      
      render(
        <ResponseTimeOverlayHistogram
          baselineRun={baselineRun}
          currentRun={currentRun}
        />
      );
      
      const percentBtn = screen.getByText('%');
      const countBtn = screen.getByText('#');
      
      expect(percentBtn).toBeInTheDocument();
      expect(countBtn).toBeInTheDocument();
      
      // Switch to count mode
      fireEvent.click(countBtn);
      expect(countBtn).toHaveClass('active');
      
      // Switch back to percent mode
      fireEvent.click(percentBtn);
      expect(percentBtn).toHaveClass('active');
    });

    it('shows empty hint when no data', () => {
      const baselineRun = createMockTestRun([]);
      const currentRun = createMockTestRun([]);
      
      render(
        <ResponseTimeOverlayHistogram
          baselineRun={baselineRun}
          currentRun={currentRun}
        />
      );
      
      expect(screen.getByText('No response data for distribution comparison.')).toBeInTheDocument();
    });

    it('invokes overlay tooltip formatters in percent mode', () => {
      const baselineRun = createMockTestRun([100, 200, 300]);
      const currentRun = createMockTestRun([100, 200, 300]);
      render(<ResponseTimeOverlayHistogram baselineRun={baselineRun} currentRun={currentRun} />);
      const tt = screen.getByTestId('tooltip');
      const fmt = JSON.parse(tt.getAttribute('data-format') ?? '{}');
      expect(fmt.percent?.[0]).toMatch(/%$/);
      expect(fmt.label).toBe('120 ms');
    });

    it('invokes overlay tooltip formatters in count mode', () => {
      const baselineRun = createMockTestRun([100, 200, 300]);
      const currentRun = createMockTestRun([100, 200, 300]);
      render(<ResponseTimeOverlayHistogram baselineRun={baselineRun} currentRun={currentRun} />);
      fireEvent.click(screen.getByText('#'));
      const tt = screen.getByTestId('tooltip');
      const fmt = JSON.parse(tt.getAttribute('data-format') ?? '{}');
      expect(typeof fmt.percent?.[0]).toBe('number');
    });

    it('handles different sized datasets', () => {
      const baselineRun = createMockTestRun([100, 200]);
      const currentRun = createMockTestRun([100, 200, 300, 400, 500]);

      render(
        <ResponseTimeOverlayHistogram
          baselineRun={baselineRun}
          currentRun={currentRun}
        />,
      );

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });
});
