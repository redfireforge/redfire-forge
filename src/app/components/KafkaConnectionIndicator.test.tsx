/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KafkaConnectionIndicator from './KafkaConnectionIndicator';
import {
  deriveIndicatorStatus,
  type KafkaConnectionIndicatorProps,
} from './KafkaConnectionIndicator.utils';
import type { KafkaConnectionSnapshot } from '../../shared/kafka/kafkaConfig';

function makeProps(overrides: Partial<KafkaConnectionIndicatorProps> = {}): KafkaConnectionIndicatorProps {
  return {
    connection: { state: 'disconnected' },
    clusterName: null,
    hasClusters: true,
    onNavigateToSettings: vi.fn(),
    ...overrides,
  };
}

describe('deriveIndicatorStatus', () => {
  it('returns hidden when no clusters exist', () => {
    expect(deriveIndicatorStatus({ state: 'disconnected' }, false)).toBe('hidden');
    expect(deriveIndicatorStatus({ state: 'connected' }, false)).toBe('hidden');
  });

  it('returns connected when state is connected', () => {
    expect(deriveIndicatorStatus({ state: 'connected', clusterId: 'c1' }, true)).toBe('connected');
  });

  it('returns connecting when state is testing', () => {
    expect(deriveIndicatorStatus({ state: 'testing', clusterId: 'c1' }, true)).toBe('connecting');
  });

  it('returns error when state is error', () => {
    expect(deriveIndicatorStatus({ state: 'error', clusterId: 'c1' }, true)).toBe('error');
  });

  it('returns disconnected when state is disconnected', () => {
    expect(deriveIndicatorStatus({ state: 'disconnected' }, true)).toBe('disconnected');
  });
});

describe('KafkaConnectionIndicator', () => {
  it('renders nothing when hasClusters is false', () => {
    const { container } = render(
      <KafkaConnectionIndicator {...makeProps({ hasClusters: false })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders with disconnected status when hasClusters is true', () => {
    render(<KafkaConnectionIndicator {...makeProps()} />);

    const btn = screen.getByRole('button');
    expect(btn.className).toContain('kafka-connection-indicator--disconnected');
    expect(btn.textContent).toContain('Kafka');
    expect(btn).toHaveAttribute('aria-label', 'Kafka status: Kafka — Disconnected. Click to open Kafka settings.');
  });

  it('renders with connected status and cluster name', () => {
    render(
      <KafkaConnectionIndicator
        {...makeProps({
          connection: { state: 'connected', clusterId: 'c1' },
          clusterName: 'Production',
        })}
      />,
    );

    const btn = screen.getByRole('button');
    expect(btn.className).toContain('kafka-connection-indicator--connected');
    expect(btn).toHaveAttribute('title', 'Production — Connected');
    expect(btn).toHaveAttribute('aria-label', 'Kafka status: Production — Connected. Click to open Kafka settings.');
  });

  it('renders connecting status with pulsing indicator', () => {
    render(
      <KafkaConnectionIndicator
        {...makeProps({
          connection: { state: 'testing', clusterId: 'c1' },
          clusterName: 'Dev Cluster',
        })}
      />,
    );

    const btn = screen.getByRole('button');
    expect(btn.className).toContain('kafka-connection-indicator--connecting');
    expect(btn).toHaveAttribute('title', 'Dev Cluster — Connecting…');
  });

  it('renders error status', () => {
    render(
      <KafkaConnectionIndicator
        {...makeProps({
          connection: { state: 'error', clusterId: 'c1', lastError: 'Auth failed' },
          clusterName: 'Staging',
        })}
      />,
    );

    const btn = screen.getByRole('button');
    expect(btn.className).toContain('kafka-connection-indicator--error');
    expect(btn).toHaveAttribute('title', 'Staging — Error');
  });

  it('calls onNavigateToSettings when clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToSettings = vi.fn();

    render(
      <KafkaConnectionIndicator
        {...makeProps({ onNavigateToSettings })}
      />,
    );

    await user.click(screen.getByRole('button'));
    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
  });

  it('uses fallback label Kafka when clusterName is null', () => {
    render(
      <KafkaConnectionIndicator
        {...makeProps({
          connection: { state: 'connected', clusterId: 'c1' } as KafkaConnectionSnapshot,
          clusterName: null,
        })}
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('title', 'Kafka — Connected');
  });

  it('has the kafka-dot with appropriate status class', () => {
    const { container } = render(
      <KafkaConnectionIndicator
        {...makeProps({
          connection: { state: 'error', clusterId: 'c1' },
        })}
      />,
    );

    const dot = container.querySelector('.kafka-dot');
    expect(dot?.className).toContain('kafka-dot--error');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });
});
