/**
 * Global Vitest setup — polyfills required by Monaco Editor in jsdom.
 */
if (typeof document !== 'undefined' && typeof document.queryCommandSupported !== 'function') {
  document.queryCommandSupported = () => false;
}
