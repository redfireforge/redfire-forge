/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('suppressResizeObserverError', () => {
  let errorSpy: ReturnType<typeof vi.fn>;
  let rejectionSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    errorSpy = vi.fn();
    rejectionSpy = vi.fn();
    window.addEventListener('error', errorSpy);
    window.addEventListener('unhandledrejection', rejectionSpy);

    await import('./suppressResizeObserverError');
  });

  afterEach(() => {
    window.removeEventListener('error', errorSpy);
    window.removeEventListener('unhandledrejection', rejectionSpy);
    vi.resetModules();
  });

  it('swallows ErrorEvent with ResizeObserver message', () => {
    const event = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
      cancelable: true,
    });
    const prevented = !window.dispatchEvent(event);
    expect(prevented).toBe(true);
  });

  it('does not swallow unrelated ErrorEvents', () => {
    const event = new ErrorEvent('error', {
      message: 'Some other error',
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('swallows unhandledrejection with ResizeObserver reason', () => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'type', { value: 'unhandledrejection' });
    Object.defineProperty(event, 'reason', { value: new Error('ResizeObserver loop limit exceeded') });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not swallow unrelated unhandledrejection', () => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'reason', { value: new Error('Network failure') });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('handles string reason in unhandledrejection', () => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'type', { value: 'unhandledrejection' });
    Object.defineProperty(event, 'reason', { value: 'ResizeObserver error string' });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('handles null reason in unhandledrejection', () => {
    const event = new Event('unhandledrejection', { cancelable: true });
    Object.defineProperty(event, 'type', { value: 'unhandledrejection' });
    Object.defineProperty(event, 'reason', { value: null });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
