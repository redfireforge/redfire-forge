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
    onConcurrencyChange,
    onIterationsChange,
    onTimeoutSecChange,
    onRetryCountChange,
    onRetryDelayMsChange,
    onErrorPolicyChange,
    onMaxErrorsChange,
    onMaxErrorRateChange,
    onThinkTimeChange,
  };
}

describe('RunnerExecutionConfig - Callbacks', () => {
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
    fireEvent.blur(input);
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
    fireEvent.blur(inputs[0] as HTMLInputElement);
    expect(onThinkTimeChange).toHaveBeenCalledWith({ minMs: 0 });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '' } });
    fireEvent.blur(inputs[1] as HTMLInputElement);
    expect(onThinkTimeChange).toHaveBeenCalledWith({ maxMs: 0 });
  });

  it('passes 0 for gaussian mean and stdDev when input is empty', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'gaussian', meanMs: 100, stdDevMs: 50 }, onThinkTimeChange } as unknown as OverrideProps);
    const inputs = document.querySelectorAll('.think-time-inline-input');
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: '' } });
    fireEvent.blur(inputs[0] as HTMLInputElement);
    expect(onThinkTimeChange).toHaveBeenCalledWith({ meanMs: 0 });
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: '' } });
    fireEvent.blur(inputs[1] as HTMLInputElement);
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

  it('clamps timeout and retry to 0 when input is empty', () => {
    const onTimeoutSecChange = vi.fn();
    const onRetryCountChange = vi.fn();
    renderConfig({ onTimeoutSecChange, onRetryCountChange } as unknown as OverrideProps);
    const timeoutInput = screen.getByText('Timeout').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '' } });
    fireEvent.blur(timeoutInput);
    expect(onTimeoutSecChange).toHaveBeenCalledWith(0);
    const retryInput = screen.getByText('Retry').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(retryInput, { target: { value: '' } });
    fireEvent.blur(retryInput);
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
    fireEvent.blur(maxErr);
    expect(onMaxErrorsChange).toHaveBeenCalledWith(1);
    const rate = screen.getByText('Error Rate').closest('.resilience-field')?.querySelector('input') as HTMLInputElement;
    fireEvent.change(rate, { target: { value: '' } });
    fireEvent.blur(rate);
    expect(onMaxErrorRateChange).toHaveBeenCalledWith(1);
  });

  it('passes 0 for think-time delay fields when input parses to NaN', () => {
    const onThinkTimeChange = vi.fn();
    renderConfig({ thinkTime: { mode: 'constant', constantMs: 500 }, onThinkTimeChange } as unknown as OverrideProps);
    const input = document.querySelector('.think-time-inline-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onThinkTimeChange).toHaveBeenCalledWith({ constantMs: 0 });
  });
});
