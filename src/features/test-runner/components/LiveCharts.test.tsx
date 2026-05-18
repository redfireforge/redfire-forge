/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiveCharts } from './LiveCharts';
import type { TimeSeriesPoint } from '../hooks/useTestExecution';

// Mock recharts components — invoke formatters so LiveCharts tooltip helpers are covered
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: (props: { tickFormatter?: (v: number) => string }) => {
    if (props.tickFormatter) {
      props.tickFormatter(3);
    }
    return <div data-testid="x-axis" />;
  },
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: (props: { formatter?: (v: unknown) => unknown; labelFormatter?: (v: unknown) => unknown }) => {
    if (typeof props.formatter === 'function') {
      props.formatter(42, '', {}, {});
    }
    if (typeof props.labelFormatter === 'function') {
      props.labelFormatter(5);
    }
    return <div data-testid="tooltip" />;
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

function createTimeSeriesData(count: number, withConcurrency = false): TimeSeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    elapsedSec: i + 1,
    avgResponseTime: 100 + Math.random() * 50,
    tps: 10 + Math.random() * 5,
    errorRate: Math.random() * 5,
    concurrency: withConcurrency ? 5 + Math.floor(Math.random() * 10) : 0,
  }));
}

describe('LiveCharts', () => {
  it('renders all chart cards', () => {
    const data = createTimeSeriesData(10);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
    expect(screen.getByText('Throughput (TPS)')).toBeInTheDocument();
    expect(screen.getByText('Error Rate (%)')).toBeInTheDocument();
  });

  it('renders responsive containers for each chart', () => {
    const data = createTimeSeriesData(10);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    const containers = screen.getAllByTestId('responsive-container');
    expect(containers.length).toBeGreaterThanOrEqual(3);
  });

  it('renders area charts for response time and throughput', () => {
    const data = createTimeSeriesData(10);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    const areaCharts = screen.getAllByTestId('area-chart');
    expect(areaCharts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders line chart for error rate', () => {
    const data = createTimeSeriesData(10);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders concurrency chart when data has concurrency > 0', () => {
    const data = createTimeSeriesData(10, true); // With concurrency
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.getByText('Concurrency')).toBeInTheDocument();
    const areaCharts = screen.getAllByTestId('area-chart');
    expect(areaCharts.length).toBe(3); // Response, TPS, Concurrency
  });

  it('does not render concurrency chart when all concurrency is 0', () => {
    const data = createTimeSeriesData(10, false); // No concurrency
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.queryByText('Concurrency')).not.toBeInTheDocument();
  });

  it('handles empty data array', () => {
    render(<LiveCharts data={[]} isTimeBased={true} />);
    
    // Should still render chart structure
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const data = createTimeSeriesData(1);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
  });

  it('handles large dataset', () => {
    const data = createTimeSeriesData(1000);
    render(<LiveCharts data={data} isTimeBased={true} />);
    
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
  });

  it('accepts isTimeBased prop', () => {
    const data = createTimeSeriesData(5);
    
    // Should render without errors for both values
    const { rerender } = render(<LiveCharts data={data} isTimeBased={true} />);
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
    
    rerender(<LiveCharts data={data} isTimeBased={false} />);
    expect(screen.getByText('Response Time (ms)')).toBeInTheDocument();
  });
});
