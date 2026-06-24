/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { collapseAppSidebar, expandAppSidebar } from './appShellAdapter';

describe('appShellAdapter', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
  });

  it('collapseAppSidebar invokes bridge when present', () => {
    let called = false;
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = () => {
      called = true;
    };
    collapseAppSidebar();
    expect(called).toBe(true);
  });

  it('expandAppSidebar is a no-op when bridge missing', () => {
    expect(() => expandAppSidebar()).not.toThrow();
  });
});
