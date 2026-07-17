/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcSchemaDriftBanner } from './GrpcSchemaDriftBanner';

describe('GrpcSchemaDriftBanner (Phase 3H)', () => {
  it('renders nothing when drift is none', () => {
    const { container } = render(
      <GrpcSchemaDriftBanner
        driftState="none"
        onRebind={vi.fn()}
        onPruneBody={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows warning actions and wires dismiss + prune', () => {
    const onDismiss = vi.fn();
    const onPrune = vi.fn();
    render(
      <GrpcSchemaDriftBanner
        driftState="warning"
        driftMessage="Field removed"
        driftIssues={[{ kind: 'field_removed', fieldName: 'message', message: 'Field "message" was removed' }]}
        onRebind={vi.fn()}
        onPruneBody={onPrune}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByTestId('grpc-schema-drift-banner')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-schema-drift-prune-btn'));
    fireEvent.click(screen.getByTestId('grpc-schema-drift-dismiss-btn'));
    expect(onPrune).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows blocking rebind suggestions without dismiss', () => {
    const onRebind = vi.fn();
    render(
      <GrpcSchemaDriftBanner
        driftState="blocking"
        driftMessage="Method unavailable"
        suggestedRebinds={[{
          service: 'echo.EchoService',
          method: 'BidiStream',
          reason: 'Same request type echo.EchoRequest',
        }]}
        onRebind={onRebind}
        onPruneBody={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('grpc-schema-drift-dismiss-btn')).toBeNull();
    fireEvent.click(screen.getByTestId('grpc-schema-drift-rebind-echo-EchoService-BidiStream'));
    expect(onRebind).toHaveBeenCalledWith('echo.EchoService', 'BidiStream');
  });
});
