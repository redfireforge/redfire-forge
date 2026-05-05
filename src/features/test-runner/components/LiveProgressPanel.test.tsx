/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveProgressPanel from './LiveProgressPanel';
import type { TestSummary, LoadProfileConfig } from '../../../shared/types';

const mockSummary: TestSummary = {
  totalRequests: 100,
  successfulRequests: 95,
  failedRequests: 5,
  avgResponseTime: 150,
  minResponseTime: 50,
  maxResponseTime: 500,
  p95ResponseTime: 350,
  p99ResponseTime: 450,
  tps: 10,
  durationMs: 10000,
  errorRate: 5,
  failedValidations: 2,
  totalIterations: 100,
  completedIterations: 100,
  totalDurationMs: 10000,
};

const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  maxConcurrency: 10,
  durationSec: 60,
};

describe('LiveProgressPanel', () => {
  it('renders progress bar with correct percentage', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={100}
        summary={null}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
      />
    );
    
    expect(screen.getByText('50 / 100 (50%)')).toBeInTheDocument();
  });

  it('renders metrics when summary is provided', () => {
    render(
      <LiveProgressPanel
        isRunning={false}
        completed={100}
        total={100}
        summary={mockSummary}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
      />
    );
    
    expect(screen.getByText('10')).toBeInTheDocument(); // TPS
    expect(screen.getByText('150 ms')).toBeInTheDocument(); // Avg Response
    expect(screen.getByText('5%')).toBeInTheDocument(); // Error Rate
    expect(screen.getByText('2')).toBeInTheDocument(); // Validation Failures
  });

  it('shows execution mode info in progress header', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={25}
        total={100}
        summary={null}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
      />
    );
    
    expect(screen.getByText(/C:5/)).toBeInTheDocument();
    expect(screen.getByText(/T:100/)).toBeInTheDocument();
  });

  it('shows load profile info when in load-profile mode', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={-1}
        summary={null}
        timeSeries={[]}
        profileMeta={{ elapsedMs: 30000, durationMs: 60000, targetConcurrency: 10, currentInFlight: 8 }}
        executionMode="load-profile"
        concurrency={10}
        loadProfile={{ type: 'sustained', maxConcurrency: 10, durationSec: 60 }}
      />
    );
    
    expect(screen.getByText(/Peak:10/)).toBeInTheDocument();
    // 60s appears in both header and progress text, use getAllByText
    expect(screen.getAllByText(/60/).length).toBeGreaterThan(0);
  });

  it('shows think time label when provided', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={100}
        summary={null}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
        thinkTime={{ mode: 'constant', constantMs: 1000 }}
      />
    );
    
    // Think time label format is "Think: 1000ms" or similar
    expect(screen.getByText(/Think.*1000/i)).toBeInTheDocument();
  });

  it('shows host label when provided', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={100}
        summary={null}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
        hostLabel="https://api.example.com"
      />
    );
    
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
  });

  it('shows clear button when not running and onClear is provided', () => {
    const onClear = vi.fn();
    render(
      <LiveProgressPanel
        isRunning={false}
        completed={100}
        total={100}
        summary={mockSummary}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
        onClear={onClear}
      />
    );
    
    const clearBtn = screen.getByTitle('Clear progress');
    expect(clearBtn).toBeInTheDocument();
    
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('hides clear button when running', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={100}
        summary={null}
        timeSeries={[]}
        profileMeta={null}
        executionMode="batch"
        concurrency={5}
        loadProfile={defaultLoadProfile}
        onClear={vi.fn()}
      />
    );
    
    expect(screen.queryByTitle('Clear progress')).not.toBeInTheDocument();
  });

  it('shows concurrency metrics for load profile mode', () => {
    render(
      <LiveProgressPanel
        isRunning={true}
        completed={50}
        total={-1}
        summary={mockSummary}
        timeSeries={[]}
        profileMeta={{ elapsedMs: 30000, durationMs: 60000, targetConcurrency: 10, currentInFlight: 8 }}
        executionMode="load-profile"
        concurrency={10}
        loadProfile={{ type: 'sustained', maxConcurrency: 10, durationSec: 60 }}
      />
    );
    
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('Concurrency')).toBeInTheDocument();
  });
});
