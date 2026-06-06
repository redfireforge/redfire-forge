/**
 * Shared Vitest manual mock for AvailableVariables.
 *
 * Consumed automatically when any test file under
 * src/features/workflow/components/ calls:
 *   vi.mock('../expression/AvailableVariables')
 * without a factory argument.
 */


export default function AvailableVariables(_props: Record<string, unknown>) {
  return <div data-testid="available-variables" />;
}
