/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { ECHO_METHOD, StatefulGrpcCallPanel } from './GrpcCallPanel.testHelpers';

describe('GrpcCallPanel.testHelpers coverage gaps', () => {
  it('exports a usable Echo method fixture', () => {
    expect(ECHO_METHOD.name).toBeTruthy();
    expect(ECHO_METHOD.requestSchema).toBeTruthy();
  });

  it('StatefulGrpcCallPanel wires onPatch into internal tab state', () => {
    const initialTab = createGrpcStudioTab({
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      timeoutMs: 30_000,
    });

    render(
      <StatefulGrpcCallPanel
        initialTab={initialTab}
        method={ECHO_METHOD}
        serviceFullName="echo.EchoService"
      />, 
    );

    const timeoutInput = screen.getByTestId('grpc-call-timeout-input') as HTMLInputElement;
    expect(timeoutInput.value).toBe('30000');

    fireEvent.change(timeoutInput, { target: { value: '45000' } });
    expect(timeoutInput.value).toBe('45000');
  });
});
