import { describe, it, expect, vi } from 'vitest';
import {
  mockUuidFixed,
  mockUuidSequential,
  mockUuidRandom,
  hoistedUuidFixed,
  hoistedUuidSequential,
  hoistedUuidRandom,
} from './uuidMock';

const hoistedMod = vi.hoisted(() =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./uuidMock.ts').hoistedUuidFixed('hoisted-id'),
);

describe('uuidMock', () => {
  describe('mockUuidFixed', () => {
    it('returns the default id on every call', () => {
      const mod = mockUuidFixed();
      expect(mod.v4()).toBe('test-uuid');
      expect(mod.v4()).toBe('test-uuid');
    });

    it('returns a custom id on every call', () => {
      const mod = mockUuidFixed('custom-id');
      expect(mod.v4()).toBe('custom-id');
    });
  });

  describe('mockUuidSequential', () => {
    it('returns incrementing prefixed ids', () => {
      const mod = mockUuidSequential('uuid');
      expect(mod.v4()).toBe('uuid-1');
      expect(mod.v4()).toBe('uuid-2');
      expect(mod.v4()).toBe('uuid-3');
    });

    it('uses a custom prefix', () => {
      const mod = mockUuidSequential('test-uuid');
      expect(mod.v4()).toBe('test-uuid-1');
      expect(mod.v4()).toBe('test-uuid-2');
    });
  });

  describe('mockUuidRandom', () => {
    it('returns valid UUID-shaped strings', () => {
      const mod = mockUuidRandom();
      const uuid = mod.v4();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('returns distinct values on successive calls', () => {
      const mod = mockUuidRandom();
      expect(mod.v4()).not.toBe(mod.v4());
    });

    it('is deterministic for the same mock instance', () => {
      const mod = mockUuidRandom();
      const first = mod.v4();
      const second = mod.v4();
      const replay = mockUuidRandom();
      expect(replay.v4()).toBe(first);
      expect(replay.v4()).toBe(second);
    });
  });

  describe('hoisted helpers', () => {
    it('hoistedUuidFixed matches mockUuidFixed behavior', () => {
      expect(hoistedMod.v4()).toBe('hoisted-id');
    });

    it('hoistedUuidFixed delegates to mockUuidFixed', () => {
      const mod = hoistedUuidFixed('direct-id');
      expect(mod.v4()).toBe('direct-id');
      expect(mod.v4()).toBe('direct-id');
    });

    it('hoistedUuidSequential delegates to mockUuidSequential', () => {
      const mod = hoistedUuidSequential('seq');
      expect(mod.v4()).toBe('seq-1');
      expect(mod.v4()).toBe('seq-2');
    });

    it('hoistedUuidRandom delegates to mockUuidRandom', () => {
      const mod = hoistedUuidRandom();
      const first = mod.v4();
      const second = mod.v4();
      expect(first).toMatch(/^[0-9a-f]{8}-/);
      expect(first).not.toBe(second);
    });
  });
});
