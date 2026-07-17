/** Dispatch native input/change events so React state updates from quiet DOM writes. */
export function setInputValueAndDispatch(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  );
  // React 18+ tracks the last-known DOM value via _valueTracker.  If the
  // tracker already holds the same value we're about to set, React will
  // silently skip onChange.  Reset the tracker to the *current* (old) value
  // so React detects the change after the native setter runs.
  const tracker = (input as HTMLInputElement & { _valueTracker?: { setValue(v: string): void } })._valueTracker;
  if (tracker) {
    tracker.setValue(input.value);
  }
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
