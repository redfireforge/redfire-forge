import { act, fireEvent, screen } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import type { GrpcDescriptor } from '@shared/grpc/contracts';

export const DESCRIPTOR_WITH_ENUM: GrpcDescriptor = {
  ...FIXTURE_DESCRIPTOR,
  enumTypes: [
    {
      typeName: 'echo.Status',
      docComment: 'Serving state for echo workers',
      values: [
        { name: 'UNKNOWN', number: 0 },
        { name: 'SERVING', number: 1, docComment: 'Ready to accept RPCs' },
      ],
    },
  ],
};

export async function clickByTestIdAsync(testId: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
    await Promise.resolve();
  });
}
