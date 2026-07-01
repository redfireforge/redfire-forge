/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';

describe('GrpcSpringHintCard (Phase 4G)', () => {
  it('renders health hint copy and dismisses', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <GrpcSpringHintCard hintId="spring_health_actuator" onDismiss={onDismiss} />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_health_actuator')).toBeTruthy();
    expect(screen.getByRole('note', { name: 'Spring Boot Actuator health' })).toBeTruthy();
    await user.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_health_actuator'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders PERMISSION_DENIED hint copy and dismisses', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <GrpcSpringHintCard hintId="spring_permission_denied" onDismiss={onDismiss} />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
    expect(screen.getByRole('note', { name: 'PERMISSION_DENIED (status 7)' })).toBeTruthy();
    await user.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_permission_denied'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
