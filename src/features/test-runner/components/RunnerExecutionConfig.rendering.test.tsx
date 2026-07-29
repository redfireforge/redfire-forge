/**
 * RunnerExecutionConfig Rendering Tests
 * Split from monolithic RunnerExecutionConfig.test.tsx (915 lines -> ~220 lines)
 * Tests: Core rendering, execution modes, basic controls
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConfig, defaultLoadProfile } from './__test-utils__/RunnerExecutionConfigHelpers';

describe('RunnerExecutionConfig - Rendering', () => {
  it('renders execution mode radios from shared metadata', () => {
    renderConfig();

    expect(screen.getByLabelText('Sequential')).toBeTruthy();
    expect(screen.getByLabelText('Batch')).toBeTruthy();
    expect(screen.getByLabelText('Continuous Pool')).toBeTruthy();
    expect(screen.getByLabelText('Load Profile')).toBeTruthy();
    expect(screen.getByLabelText(/Constant Arrival/)).toBeTruthy();
    expect(screen.getByText('(only desktop)')).toBeTruthy();
    expect(screen.queryByLabelText('Workflow')).toBeNull();
  });

  it('dispatches the selected execution mode on radio click', () => {
    const { onExecutionModeChange } = renderConfig();

    const sequential = screen.getByLabelText('Sequential');
    sequential.click();

    expect(onExecutionModeChange).toHaveBeenCalledWith('sequential');
  });

  // --- Sequential mode ---
  it('shows "Fixed to 1" hint for sequential mode', () => {
    renderConfig({ executionMode: 'sequential' });
    expect(screen.getByText('Fixed to 1')).toBeTruthy();
  });

  // --- Concurrency / Iterations ---
  it('disables concurrency when isRunning', () => {
    renderConfig({ isRunning: true });
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs[0].disabled).toBe(true);
  });

  it('disables execution mode radios when isRunning', () => {
    renderConfig({ isRunning: true });
    expect((screen.getByLabelText('Sequential') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Batch') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows active test count warning when iterations < activeTestCount', () => {
    renderConfig({ iterations: 2, activeTestCount: 5 });
    expect(screen.getByText('5 active')).toBeTruthy();
  });

  // --- Timeout ---
  it('shows "No timeout" hint when timeoutSec is 0', () => {
    renderConfig({ timeoutSec: 0 });
    expect(screen.getByText('No timeout')).toBeTruthy();
  });

  // --- Retry ---
  it('shows "No retry" hint when retryCount is 0', () => {
    renderConfig({ retryCount: 0 });
    expect(screen.getByText('No retry')).toBeTruthy();
  });

  it('shows retry delay field when retryCount > 0', () => {
    renderConfig({ retryCount: 3, retryDelayMs: 1000 });
    expect(screen.getByText('Retry Delay')).toBeTruthy();
  });

  // --- Error policy ---
  it('renders error policy radio buttons', () => {
    renderConfig();
    expect(screen.getByLabelText('Continue')).toBeTruthy();
    expect(screen.getByLabelText('Stop 1st')).toBeTruthy();
    expect(screen.getByLabelText('Threshold')).toBeTruthy();
  });

  it('enables max-errors / error-rate inputs only for stop-threshold', () => {
    renderConfig({ errorPolicy: 'continue' });
    // Max Errors and Error Rate fields should be disabled when not stop-threshold
    const maxErrorsField = screen.getByText('Max Errors').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    expect(maxErrorsField.disabled).toBe(true);
  });

  // --- Think Time ---
  it('renders think time mode options', () => {
    renderConfig();
    expect(screen.getByLabelText('None')).toBeTruthy();
    expect(screen.getByLabelText('Constant')).toBeTruthy();
    expect(screen.getByLabelText('Uniform')).toBeTruthy();
    expect(screen.getByLabelText('Gaussian')).toBeTruthy();
  });

  it('shows constant delay field', () => {
    renderConfig({ thinkTime: { mode: 'constant', constantMs: 500 } });
    const inputs = document.querySelectorAll('.think-time-inline-input');
    expect(inputs.length).toBe(1);
    expect((inputs[0] as HTMLInputElement).value).toBe('500');
    expect(screen.getByText(/Fixed 500ms delay/)).toBeTruthy();
  });

  it('shows uniform min/max fields', () => {
    renderConfig({ thinkTime: { mode: 'uniform', minMs: 200, maxMs: 3000 } });
    const inputs = document.querySelectorAll('.think-time-inline-input');
    expect(inputs.length).toBe(2);
    expect((inputs[0] as HTMLInputElement).value).toBe('200');
    expect((inputs[1] as HTMLInputElement).value).toBe('3000');
    expect(screen.getByText(/Random 200–3000ms/)).toBeTruthy();
  });

  it('shows gaussian mean/stdDev fields', () => {
    renderConfig({ thinkTime: { mode: 'gaussian', meanMs: 800, stdDevMs: 150 } });
    const inputs = document.querySelectorAll('.think-time-inline-input');
    expect(inputs.length).toBe(2);
    expect((inputs[0] as HTMLInputElement).value).toBe('800');
    expect((inputs[1] as HTMLInputElement).value).toBe('150');
    expect(screen.getByText(/μ=800ms σ=150ms/)).toBeTruthy();
  });

  // --- Load profile ---
  it('shows load profile section for load-profile mode', () => {
    renderConfig({ executionMode: 'load-profile' });
    expect(screen.getByText('Ramp-Up')).toBeTruthy();
    expect(screen.getByText('Sustained')).toBeTruthy();
    expect(screen.getByText('Spike')).toBeTruthy();
    expect(screen.getByText('Set in profile')).toBeTruthy();
    expect(screen.getByText('Time-based')).toBeTruthy();
  });

  it('shows ramp-up field for ramp-up profile', () => {
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'ramp-up', rampUpSec: 15 },
    });
    expect(screen.getByText('Ramp (sec)')).toBeTruthy();
  });

  it('shows spike fields for spike profile', () => {
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike' },
    });
    expect(screen.getByText('Spike Concurrency')).toBeTruthy();
    expect(screen.getByText('Spike Start (sec)')).toBeTruthy();
    expect(screen.getByText('Spike Duration (sec)')).toBeTruthy();
    expect(screen.getByText('Base Concurrency')).toBeTruthy();
  });
});
