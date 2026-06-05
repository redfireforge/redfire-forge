/**
 * Shared Vitest manual mock for InsertVarField.
 *
 * Consumed automatically when any test file under
 * src/features/workflow/components/ calls:
 *   vi.mock('../expression/InsertVarField')
 * without a factory argument.
 */
import React from 'react';

export default function InsertVarField({
  children,
  onInsert,
}: {
  children: React.ReactNode;
  onInsert: (snippet: string) => void;
  [key: string]: unknown;
}) {
  return (
    <div data-testid="insert-var-field">
      {children}
      <button type="button" data-testid="insert-var-apply" onClick={() => onInsert('{{snippet}}')}>
        Apply insert
      </button>
    </div>
  );
}
