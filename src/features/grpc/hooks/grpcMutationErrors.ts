type MutationErrorSetter = (value: string | undefined) => void;

export function formatGrpcMutationErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export async function runGrpcMutationWithError<T>(input: {
  operation: () => Promise<T>;
  setLastMutationError: MutationErrorSetter;
  fallbackMessage: string;
}): Promise<T> {
  try {
    input.setLastMutationError(undefined);
    return await input.operation();
  } catch (error) {
    input.setLastMutationError(formatGrpcMutationErrorMessage(error, input.fallbackMessage));
    throw error;
  }
}