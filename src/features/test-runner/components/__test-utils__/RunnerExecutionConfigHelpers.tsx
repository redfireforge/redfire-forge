/**
 * Shared test helpers for RunnerExecutionConfig tests
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import RunnerExecutionConfig from '../RunnerExecutionConfig';
import type { ExecutionMode, ErrorPolicy, LoadProfileConfig, ThinkTimeConfig } from '@shared/types';

export type OverrideProps = Partial<React.ComponentProps<typeof RunnerExecutionConfig>>;

export const defaultLoadProfile: LoadProfileConfig = {
  type: 'sustained',
  durationSec: 60,
  maxConcurrency: 5,
  rampUpSec: 30,
  spikeConcurrency: 10,
  spikeStartSec: 20,
  spikeDurationSec: 10,
};

export const defaultThinkTime: ThinkTimeConfig = { mode: 'none' };

export function renderConfig(overrides: OverrideProps = {}) {
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
    onConcurrencyChange,
    onIterationsChange,
    onTimeoutSecChange,
    onRetryCountChange,
    onRetryDelayMsChange,
    onErrorPolicyChange,
    onMaxErrorsChange,
    onMaxErrorRateChange,
    onLoadProfileChange,
    onThinkTimeChange,
  };
}
