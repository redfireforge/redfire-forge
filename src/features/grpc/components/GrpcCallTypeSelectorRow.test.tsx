/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcCallTypeSelectorRow } from './GrpcCallTypeSelectorRow';

describe('GrpcCallTypeSelectorRow', () => {
  it('calls onSelectCallType for layout preview when unlocked', () => {
    const onSelect = vi.fn();
    render(
      <GrpcCallTypeSelectorRow
        activeCallType="unary"
        onSelectCallType={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-call-type-tab-client_streaming'));
    expect(onSelect).toHaveBeenCalledWith('client_streaming');
  });

  it('locks other call types when method is selected', () => {
    render(
      <GrpcCallTypeSelectorRow
        activeCallType="server_streaming"
        lockedCallType="server_streaming"
        onSelectCallType={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-call-type-tab-unary')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('grpc-call-type-locked-hint')).toBeTruthy();
  });
});
