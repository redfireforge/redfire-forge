import { act, fireEvent, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR } from '../../../../shared/grpc/contractFixtures';

export const SERVER_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ServerStream')!;
export const CLIENT_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'ClientStream')!;
export const BIDI_STREAM = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'BidiStream')!;
export const ECHO_METHOD = FIXTURE_DESCRIPTOR.services[0]!.methods.find((m) => m.name === 'Echo')!;

export async function clickByTestIdAsync(testId: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
    await Promise.resolve();
  });
}
