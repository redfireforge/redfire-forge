/**
 * Shared Vitest factories for mocking the `uuid` package.
 *
 * Vitest hoists `vi.mock` above imports — wrap with `vi.hoisted` in the test
 * file (top level), then pass the result to `vi.mock`:
 *
 * @example
 * In the test file: call vi.hoisted to get the factory, then register it via
 * vi-dot-mock('uuid', ...) — see uuidMock.test.ts for a full working example.
 */

export type UuidMockModule = { v4: () => string };

/** Returns the same UUID string on every `v4()` call. */
export function mockUuidFixed(id: string = 'test-uuid'): UuidMockModule {
  return { v4: () => id };
}

/** Returns `prefix-1`, `prefix-2`, … on successive `v4()` calls. */
export function mockUuidSequential(prefix: string = 'uuid'): UuidMockModule {
  let counter = 0;
  return { v4: () => `${prefix}-${++counter}` };
}

/** Returns distinct UUID-shaped strings in a deterministic sequence. */
/**
 * For `vi.hoisted` only — call via `require('…/uuidMock.ts').hoistedUuidFixed(id)`
 * so the factory runs before ESM imports initialize.
 */
export function hoistedUuidFixed(id: string = 'test-uuid'): UuidMockModule {
  return mockUuidFixed(id);
}

/** @see hoistedUuidFixed */
export function hoistedUuidSequential(prefix: string = 'uuid'): UuidMockModule {
  return mockUuidSequential(prefix);
}

/** @see hoistedUuidFixed */
export function hoistedUuidRandom(): UuidMockModule {
  return mockUuidRandom();
}

export function mockUuidRandom(): UuidMockModule {
  let counter = 0;
  return {
    v4: () => {
      const suffix = (counter++).toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${suffix}`;
    },
  };
}
