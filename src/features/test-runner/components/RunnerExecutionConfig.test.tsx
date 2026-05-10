/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunnerExecutionConfig from './RunnerExecutionConfig';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '../../../shared/types';

type OverrideProps = Partial<React.ComponentProps<typeof RunnerExecutionConfig>>;

const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  durationSec: 60,
  maxConcurrency: 5,
  rampUpSec: 30,
  spikeConcurrency: 10,
  spikeStartSec: 20,
  spikeDurationSec: 10,
};

const defaultThinkTime: ThinkTimeConfig = { mode: 'none' };

function renderConfig(overrides: OverrideProps = {}) {
  const onExecutionModeChange = vi.fn();
  const onConcurrencyChange = vi.fn();
  const onIterationsChange = vi.fn();
  const onTimeoutSecChange = vi.fn();
  const onRetryCountChange = vi.fn();
  const onRetryDelayMsChange = vi.fn();
  const onErrorPolicyChange = vi.fn();
  const onMaxErrorsChange = vi.fn();
  const onMaxErrorRateChange = vi.fn();
  const onLoadProfileChange = vi.fn();
  const onThinkTimeChange = vi.fn();

  const result = render(
    <RunnerExecutionConfig
      executionMode={'batch' as ExecutionMode}
      onExecutionModeChange={onExecutionModeChange}
      concurrency={4}
      onConcurrencyChange={onConcurrencyChange}
      iterations={20}
      onIterationsChange={onIterationsChange}
      timeoutSec={30}
      onTimeoutSecChange={onTimeoutSecChange}
      retryCount={0}
      onRetryCountChange={onRetryCountChange}
      retryDelayMs={500}
      onRetryDelayMsChange={onRetryDelayMsChange}
      errorPolicy={'continue' as ErrorPolicy}
      onErrorPolicyChange={onErrorPolicyChange}
      maxErrors={5}
      onMaxErrorsChange={onMaxErrorsChange}
      maxErrorRate={10}
      onMaxErrorRateChange={onMaxErrorRateChange}
      loadProfile={defaultLoadProfile}
      onLoadProfileChange={onLoadProfileChange}
      thinkTime={defaultThinkTime}
      onThinkTimeChange={onThinkTimeChange}
      activeTestCount={3}
      isRunning={false}
      {...overrides}
    />,
  );

  return {
    ...result,
    onExecutionModeChange,
  };
}

describe('RunnerExecutionConfig', () => {
  it('renders execution mode radios from shared metadata', () => {
    renderConfig();

    expect(screen.getByLabelText('Sequential')).toBeTruthy();
    expect(screen.getByLabelText('Batch')).toBeTruthy();
    expect(screen.getByLabelText('Continuous Pool')).toBeTruthy();
    expect(screen.getByLabelText('Load Profile')).toBeTruthy();
    // 'Workflow' mode is excluded from the generic runner's default mode list
    // (it is only shown in the Workflow Runner via a dedicated namePrefix + mode list)
    expect(screen.queryByLabelText('Workflow')).toBeNull();
  });

  it('dispatches the selected execution mode on radio click', () => {
    const { onExecutionModeChange } = renderConfig();

    fireEvent.click(screen.getByLabelText('Sequential'));

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
    const { container } = renderConfig({ errorPolicy: 'continue' });
    const _maxErrsInput = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
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

  // --- onChange callbacks ---
  it('fires onConcurrencyChange', () => {
    const onConcurrencyChange = vi.fn();
    renderConfig({ onConcurrencyChange } as unknown as OverrideProps);
    const concurrencyLabel = screen.getByText('Concurrency');
    const input = concurrencyLabel.closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    expect(onConcurrencyChange).toHaveBeenCalledWith(8);
  });

  it('clamps concurrency to 1 for NaN', () => {
    const onConcurrencyChange = vi.fn();
    renderConfig({ onConcurrencyChange } as unknown as OverrideProps);
    const input = screen.getByText('Concurrency').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(onConcurrencyChange).toHaveBeenCalledWith(1);
  });

  it('fires onIterationsChange', () => {
    const onIterationsChange = vi.fn();
    renderConfig({ onIterationsChange } as unknown as OverrideProps);
    const input = screen.getByText('Iterations').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(onIterationsChange).toHaveBeenCalledWith(50);
  });

  it('clamps total transactions to 1 when input is zero or empty', () => {
    const onIterationsChange = vi.fn();
    renderConfig({ onIterationsChange } as unknown as OverrideProps);
    const input = screen.getByText('Iterations').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(onIterationsChange).toHaveBeenLastCalledWith(1);
    fireEvent.change(input, { target: { value: '' } });
    expect(onIterationsChange).toHaveBeenLastCalledWith(1);
  });

  it('fires onTimeoutSecChange', () => {
    const onTimeoutSecChange = vi.fn();
    renderConfig({ onTimeoutSecChange } as unknown as OverrideProps);
    const input = screen.getByText('Timeout').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '60' } });
    expect(onTimeoutSecChange).toHaveBeenCalledWith(60);
  });

  it('fires onRetryCountChange', () => {
    const onRetryCountChange = vi.fn();
    renderConfig({ onRetryCountChange } as unknown as OverrideProps);
    const input = screen.getByText('Retry').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    expect(onRetryCountChange).toHaveBeenCalledWith(5);
  });

  it('fires onRetryDelayMsChange', () => {
    const onRetryDelayMsChange = vi.fn();
    renderConfig({ retryCount: 3, onRetryDelayMsChange } as unknown as OverrideProps);
    const input = screen.getByText('Retry Delay').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onRetryDelayMsChange).toHaveBeenCalledWith(2000);
  });

  it('fires onErrorPolicyChange for stop-first', () => {
    const onErrorPolicyChange = vi.fn();
    renderConfig({ onErrorPolicyChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByLabelText('Stop 1st'));
    expect(onErrorPolicyChange).toHaveBeenCalledWith('stop-first');
  });

  it('fires onErrorPolicyChange for stop-threshold', () => {
    const onErrorPolicyChange = vi.fn();
    renderConfig({ onErrorPolicyChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByLabelText('Threshold'));
    expect(onErrorPolicyChange).toHaveBeenCalledWith('stop-threshold');
  });

  it('fires onErrorPolicyChange for continue when switching from another policy', () => {
    const onErrorPolicyChange = vi.fn();
    renderConfig({ errorPolicy: 'stop-first', onErrorPolicyChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByLabelText('Continue'));
    expect(onErrorPolicyChange).toHaveBeenCalledWith('continue');
  });

  it('fires onMaxErrorsChange', () => {
    const onMaxErrorsChange = vi.fn();
    renderConfig({ errorPolicy: 'stop-threshold', onMaxErrorsChange } as unknown as OverrideProps);
    const input = screen.getByText('Max Errors').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } });
    expect(onMaxErrorsChange).toHaveBeenCalledWith(100);
  });

  it('fires onMaxErrorRateChange', () => {
    const onMaxErrorRateChange = vi.fn();
    renderConfig({ errorPolicy: 'stop-threshold', onMaxErrorRateChange } as unknown as OverrideProps);
    const input = screen.getByText('Error Rate').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(onMaxErrorRateChange).toHaveBeenCalledWith(50);
  });

  it('fires onThinkTimeChange for constant mode', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'constant', constantMs: 500 }, onThinkTimeChange } as unknown as OverrideProps);
    const input = document.querySelector('.think-time-inline-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1000' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ constantMs: 1000 });
  });

  it('fires onThinkTimeChange for uniform min', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'uniform', minMs: 200, maxMs: 3000 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '100' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ minMs: 100 });
  });

  it('fires onThinkTimeChange for uniform max', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'uniform', minMs: 200, maxMs: 3000 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '5000' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ maxMs: 5000 });
  });

  it('fires onThinkTimeChange for gaussian mean', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'gaussian', meanMs: 800, stdDevMs: 150 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '1200' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ meanMs: 1200 });
  });

  it('fires onThinkTimeChange for gaussian stdDev', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'gaussian', meanMs: 800, stdDevMs: 150 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '250' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ stdDevMs: 250 });
  });

  it('passes 0 for uniform min and max when input is empty', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'uniform', minMs: 100, maxMs: 200 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ minMs: 0 });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ maxMs: 0 });
  });

  it('passes 0 for gaussian mean and stdDev when input is empty', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'gaussian', meanMs: 100, stdDevMs: 50 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ meanMs: 0 });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ stdDevMs: 0 });
  });

  it('fires onThinkTimeChange for mode switch', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ onThinkTimeChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByLabelText('Constant'));
    expect(onThinkTimeChange).toHaveBeenCalledWith({ mode: 'constant' });
  });

  it('fires onThinkTimeChange when selecting uniform or gaussian', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ onThinkTimeChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByLabelText('Uniform'));
    expect(onThinkTimeChange).toHaveBeenLastCalledWith({ mode: 'uniform' });
    fireEvent.click(screen.getByLabelText('Gaussian'));
    expect(onThinkTimeChange).toHaveBeenLastCalledWith({ mode: 'gaussian' });
  });

  // --- Load profile onChange ---
  it('fires onLoadProfileChange for profile type', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({ executionMode: 'load-profile', onLoadProfileChange } as unknown as OverrideProps);
    fireEvent.click(screen.getByText('Ramp-Up'));
    expect(onLoadProfileChange).toHaveBeenCalledWith({ type: 'ramp-up' });
  });

  it('fires onLoadProfileChange for duration', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({ executionMode: 'load-profile', onLoadProfileChange } as unknown as OverrideProps);
    const input = screen.getByText('Duration (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '120' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ durationSec: 120 });
  });

  it('fires onLoadProfileChange for max concurrency', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({ executionMode: 'load-profile', onLoadProfileChange } as unknown as OverrideProps);
    const input = screen.getByText('Max Concurrency').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ maxConcurrency: 20 });
  });

  it('clamps duration on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, durationSec: 2 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Duration (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ durationSec: 5 });
  });

  it('clamps duration on blur to 5 when stored duration is 0', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, durationSec: 0 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Duration (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ durationSec: 5 });
  });

  it('clamps max concurrency on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, maxConcurrency: 200 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Max Concurrency').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ maxConcurrency: 100 });
  });

  it('clamps max concurrency on blur to 1 when stored value is 0', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, maxConcurrency: 0 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Max Concurrency').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ maxConcurrency: 1 });
  });

  it('fires onLoadProfileChange for ramp-up sec', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'ramp-up' },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Ramp (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '10' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ rampUpSec: 10 });
  });

  it('fires onLoadProfileChange for spike concurrency', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike' },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Concurrency').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeConcurrency: 50 });
  });

  it('fires onLoadProfileChange for spike start sec', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike' },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Start (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeStartSec: 15 });
  });

  it('fires onLoadProfileChange for spike duration sec', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike' },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Duration (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeDurationSec: 15 });
  });

  // onBlur clamps for spike fields
  it('clamps spike concurrency on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike', spikeConcurrency: 600 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Concurrency').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeConcurrency: 500 });
  });

  it('clamps ramp sec on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'ramp-up', rampUpSec: 0 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Ramp (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ rampUpSec: 1 });
  });

  // --- isRunning disabled state ---
  it('disables all inputs when isRunning in load-profile mode', () => {
    const { container } = renderConfig({ executionMode: 'load-profile', isRunning: true });
    const inputs = container.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    inputs.forEach(input => {
      expect(input.disabled).toBe(true);
    });
  });

  it('disables error policy radios when isRunning', () => {
    renderConfig({ isRunning: true });
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const errorPolicyRadios = radios.filter(r => r.name === 'runner-errorPolicy');
    expect(errorPolicyRadios.length).toBeGreaterThan(0);
    errorPolicyRadios.forEach(r => expect(r.disabled).toBe(true));
  });

  it('disables transactions when load-profile mode', () => {
    renderConfig({ executionMode: 'load-profile' });
    const transLabel = screen.getByText('Iterations');
    const input = transLabel.closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('shows "Set in profile" hint for concurrency in load-profile', () => {
    renderConfig({ executionMode: 'load-profile' });
    expect(screen.getByText('Set in profile')).toBeTruthy();
  });

  it('shows "Time-based" hint for transactions in load-profile', () => {
    renderConfig({ executionMode: 'load-profile' });
    expect(screen.getByText('Time-based')).toBeTruthy();
  });

  // --- Default values for spike fields ---
  it('uses default spike values when undefined', () => {
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { type: 'spike', durationSec: 60, maxConcurrency: 5 } as unknown as Parameters<typeof renderConfig>[0]['loadProfile'],
    });
    expect(screen.getByText('Spike Concurrency')).toBeTruthy();
  });

  // --- Clamp spike start and spike duration on blur ---
  it('clamps spike start on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike', spikeStartSec: 999 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Start (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeStartSec: 60 });
  });

  it('clamps spike duration on blur', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'spike', spikeDurationSec: 999 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Spike Duration (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ spikeDurationSec: 60 });
  });

  it('uses namePrefix for radio group names to avoid collisions', () => {
    renderConfig({ namePrefix: 'workflow-runner' } as unknown as OverrideProps);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.some(r => r.name === 'workflow-runner-execMode')).toBe(true);
    expect(radios.some(r => r.name === 'workflow-runner-errorPolicy')).toBe(true);
    expect(radios.some(r => r.name === 'workflow-runner-thinkTimeMode')).toBe(true);
  });

  it('when forceSingleIteration, sequential is checked and non-sequential modes are disabled with webhook title', () => {
    renderConfig({
      forceSingleIteration: true,
      executionMode: 'batch',
    } as unknown as OverrideProps);
    const batch = screen.getByLabelText('Batch') as HTMLInputElement;
    const sequential = screen.getByLabelText('Sequential') as HTMLInputElement;
    expect(sequential.checked).toBe(true);
    expect(batch.disabled).toBe(true);
    expect(batch.closest('label')?.getAttribute('title')).toBe('Only Sequential allowed for Wait for Real Webhook mode');
    expect(screen.getByText('Single iteration for real webhook testing')).toBeTruthy();
  });

  it('when forceSingleIteration, concurrency and transactions stay fixed at 1 and show hints', () => {
    renderConfig({
      forceSingleIteration: true,
      executionMode: 'sequential',
      concurrency: 8,
      iterations: 99,
    } as unknown as OverrideProps);
    const conc = screen.getByText('Concurrency').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    const trans = screen.getByText('Iterations').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    expect(conc.value).toBe('1');
    expect(trans.value).toBe('1');
    expect(conc.disabled).toBe(true);
    expect(trans.disabled).toBe(true);
    const fixedHints = screen.getAllByText('Fixed to 1');
    expect(fixedHints.length).toBeGreaterThanOrEqual(2);
  });

  it('shows effective concurrency in pool mode when not sequential', () => {
    renderConfig({ executionMode: 'pool', concurrency: 7 });
    const input = screen.getByText('Concurrency').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('uses default constantMs when omitted in constant think-time mode', () => {
    renderConfig({ thinkTime: { mode: 'constant' } });
    expect(screen.getByDisplayValue('1000')).toBeTruthy();
    expect(screen.getByText(/Fixed 1000ms delay/)).toBeTruthy();
  });

  it('uses default minMs and maxMs when omitted in uniform think-time mode', () => {
    renderConfig({ thinkTime: { mode: 'uniform' } });
    expect(screen.getByText(/Random 500–2000ms/)).toBeTruthy();
  });

  it('uses default meanMs and stdDevMs when omitted in gaussian think-time mode', () => {
    renderConfig({ thinkTime: { mode: 'gaussian' } });
    expect(screen.getByText(/μ=1000ms σ=300ms/)).toBeTruthy();
  });

  it('clamps timeout and retry to 0 when input is empty', () => {
    const onTimeoutSecChange = vi.fn();
    const onRetryCountChange = vi.fn();
    renderConfig({ onTimeoutSecChange, onRetryCountChange } as unknown as OverrideProps);
    const timeoutInput = screen.getByText('Timeout').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '' } });
    expect(onTimeoutSecChange).toHaveBeenCalledWith(0);
    const retryInput = screen.getByText('Retry').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(retryInput, { target: { value: '' } });
    expect(onRetryCountChange).toHaveBeenCalledWith(0);
  });

  it('clamps max errors and max error rate to 1 when input is empty', () => {
    const onMaxErrorsChange = vi.fn();
    const onMaxErrorRateChange = vi.fn();
    renderConfig({
      errorPolicy: 'stop-threshold',
      onMaxErrorsChange,
      onMaxErrorRateChange,
    } as unknown as OverrideProps);
    const maxErr = screen.getByText('Max Errors').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(maxErr, { target: { value: '' } });
    expect(onMaxErrorsChange).toHaveBeenCalledWith(1);
    const rate = screen.getByText('Error Rate').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(rate, { target: { value: '' } });
    expect(onMaxErrorRateChange).toHaveBeenCalledWith(1);
  });

  it('passes 0 for think-time delay fields when input parses to NaN', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'constant', constantMs: 500 }, onThinkTimeChange } as unknown as OverrideProps);
    const input = document.querySelector('.think-time-inline-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(onThinkTimeChange).toHaveBeenCalledWith({ constantMs: 0 });
  });

  it('caps ramp-up sec on blur to duration when ramp exceeds duration', () => {
    const onLoadProfileChange = vi.fn();
    renderConfig({
      executionMode: 'load-profile',
      loadProfile: { ...defaultLoadProfile, type: 'ramp-up', durationSec: 20, rampUpSec: 100 },
      onLoadProfileChange,
    } as unknown as OverrideProps);
    const input = screen.getByText('Ramp (sec)').closest('.profile-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.blur(input);
    expect(onLoadProfileChange).toHaveBeenCalledWith({ rampUpSec: 20 });
  });

});

describe('profileLabel', () => {
  it('returns correct labels', async () => {
    const { profileLabel } = await import('./RunnerExecutionConfig');
    expect(profileLabel('ramp-up')).toBe('Ramp-Up');
    expect(profileLabel('sustained')).toBe('Sustained');
    expect(profileLabel('spike')).toBe('Spike');
  });
});