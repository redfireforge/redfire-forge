/** Default name for Save-to-Collection when operation metadata is sparse. */
export function resolveSaveToCollectionDefaultName(operation: {
  name?: string;
  operationType?: string;
}): string {
  return operation.name ?? operation.operationType ?? 'Unnamed operation';
}
