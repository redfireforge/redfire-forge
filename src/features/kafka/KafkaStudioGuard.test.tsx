/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KafkaStudioGuard } from './KafkaStudioGuard';
import type { KafkaConnectionSnapshot } from '@shared/kafka/kafkaConfig';

function snapshot(overrides?: Partial<KafkaConnectionSnapshot>): KafkaConnectionSnapshot {
  return { state: 'disconnected', ...overrides };
}

describe('KafkaStudioGuard', () => {
  it('shows "No clusters configured" when hasClusters=false', () => {
    render(
      <KafkaStudioGuard
        connection={snapshot()}
        hasClusters={false}
        onNavigateToSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('No clusters configured')).toBeTruthy();
    expect(screen.getByTestId('guard-action-btn').textContent).toBe('→ Add a cluster');
  });

  it('shows "Connecting…" and no button when state=testing', () => {
    render(
      <KafkaStudioGuard
        connection={snapshot({ state: 'testing' })}
        hasClusters={true}
        onNavigateToSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Connecting to cluster…')).toBeTruthy();
    expect(screen.queryByTestId('guard-action-btn')).toBeNull();
  });

  it('shows error title and lastError when state=error', () => {
    render(
      <KafkaStudioGuard
        connection={snapshot({ state: 'error', lastError: 'SASL auth failed' })}
        hasClusters={true}
        onNavigateToSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Cluster connection error')).toBeTruthy();
    expect(screen.getByTestId('guard-subtitle').textContent).toBe('SASL auth failed');
    expect(screen.getByTestId('guard-action-btn').textContent).toBe('→ Open Kafka Settings');
  });

  it('shows fallback message when state=error and no lastError', () => {
    render(
      <KafkaStudioGuard
        connection={snapshot({ state: 'error' })}
        hasClusters={true}
        onNavigateToSettings={vi.fn()}
      />,
    );
    expect(screen.getByTestId('guard-subtitle').textContent).toBe('Unknown error');
  });

  it('shows "Cluster is not connected" for disconnected state', () => {
    render(
      <KafkaStudioGuard
        connection={snapshot({ state: 'disconnected' })}
        hasClusters={true}
        onNavigateToSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Cluster is not connected')).toBeTruthy();
    expect(screen.getByTestId('guard-action-btn').textContent).toBe('→ Open Kafka Settings');
  });

  it('calls onNavigateToSettings when action button is clicked', async () => {
    const onNav = vi.fn();
    render(
      <KafkaStudioGuard
        connection={snapshot({ state: 'disconnected' })}
        hasClusters={true}
        onNavigateToSettings={onNav}
      />,
    );
    await userEvent.click(screen.getByTestId('guard-action-btn'));
    expect(onNav).toHaveBeenCalledOnce();
  });

  it('calls onNavigateToSettings for no-clusters action button', async () => {
    const onNav = vi.fn();
    render(
      <KafkaStudioGuard
        connection={snapshot()}
        hasClusters={false}
        onNavigateToSettings={onNav}
      />,
    );
    await userEvent.click(screen.getByTestId('guard-action-btn'));
    expect(onNav).toHaveBeenCalledOnce();
  });
});
