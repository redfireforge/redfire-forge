import { describe, expect, it } from 'vitest';
import {
  CONNECTION_PRESETS,
  applyPreset,
  getPresetById,
  getPresetsByCategory,
  presetRequiresCredentials,
  presetRequiresTlsCert,
} from './kafkaConnectionPresets';

describe('kafkaConnectionPresets', () => {
  describe('CONNECTION_PRESETS', () => {
    it('contains at least one preset per category', () => {
      const categories = new Set(CONNECTION_PRESETS.map((p) => p.category));
      expect(categories.has('plaintext')).toBe(true);
      expect(categories.has('sasl')).toBe(true);
      expect(categories.has('tls')).toBe(true);
    });

    it('all presets have unique IDs', () => {
      const ids = CONNECTION_PRESETS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all presets have non-empty required fields', () => {
      for (const preset of CONNECTION_PRESETS) {
        expect(preset.id.length).toBeGreaterThan(0);
        expect(preset.name.length).toBeGreaterThan(0);
        expect(preset.description.length).toBeGreaterThan(0);
        expect(preset.config.brokers.length).toBeGreaterThan(0);
        expect(preset.config.clientId.length).toBeGreaterThan(0);
        expect(preset.config.name.length).toBeGreaterThan(0);
      }
    });

    it('plaintext preset has no auth and no TLS', () => {
      const preset = CONNECTION_PRESETS.find((p) => p.id === 'local-plaintext')!;
      expect(preset.config.auth.mode).toBe('none');
      expect(preset.config.tls.enabled).toBe(false);
    });

    it('SASL presets have correct auth modes', () => {
      const plain = CONNECTION_PRESETS.find((p) => p.id === 'local-sasl-plain')!;
      expect(plain.config.auth.mode).toBe('plain');
      // SASL/PLAIN requires TLS on Redpanda — the description must warn about this to avoid
      // developers selecting this preset for the local Docker secure profile and getting a
      // confusing "mechanism not supported" error.
      expect(plain.description.toLowerCase()).toMatch(/tls|scram/);
      expect(plain.config.tls.enabled).toBe(false); // template default; user switches to TLS if needed

      const scram256 = CONNECTION_PRESETS.find((p) => p.id === 'local-sasl-scram256')!;
      expect(scram256.config.auth.mode).toBe('scram-sha-256');

      const scram512 = CONNECTION_PRESETS.find((p) => p.id === 'local-sasl-scram512')!;
      expect(scram512.config.auth.mode).toBe('scram-sha-512');
    });

    it('TLS presets have TLS enabled', () => {
      const saslTls = CONNECTION_PRESETS.find((p) => p.id === 'local-sasl-tls')!;
      expect(saslTls.config.tls.enabled).toBe(true);
      expect(saslTls.config.tls.rejectUnauthorized).toBe(false);

      const tlsStrict = CONNECTION_PRESETS.find((p) => p.id === 'local-tls-strict')!;
      expect(tlsStrict.config.tls.enabled).toBe(true);
      expect(tlsStrict.config.tls.rejectUnauthorized).toBe(true);
    });
  });

  describe('getPresetById', () => {
    it('returns a preset by ID', () => {
      const preset = getPresetById('local-plaintext');
      expect(preset).toBeDefined();
      expect(preset!.name).toBe('Local Plaintext');
    });

    it('returns undefined for unknown ID', () => {
      expect(getPresetById('nonexistent')).toBeUndefined();
    });
  });

  describe('getPresetsByCategory', () => {
    it('returns all SASL presets', () => {
      const sasl = getPresetsByCategory('sasl');
      expect(sasl.length).toBeGreaterThanOrEqual(3);
      expect(sasl.every((p) => p.category === 'sasl')).toBe(true);
    });

    it('returns empty array for custom category with no entries', () => {
      const custom = getPresetsByCategory('custom');
      expect(custom).toEqual([]);
    });

    it('returns plaintext and tls presets by category', () => {
      expect(getPresetsByCategory('plaintext').every((p) => p.category === 'plaintext')).toBe(true);
      expect(getPresetsByCategory('tls').every((p) => p.category === 'tls')).toBe(true);
    });
  });

  describe('applyPreset', () => {
    it('produces a full KafkaClusterConfig with generated clusterId and timestamps', () => {
      const preset = getPresetById('local-plaintext')!;
      const now = 1700000000000;
      const config = applyPreset(preset, now);

      expect(config.clusterId).toBe('local-plaintext-1700000000000');
      expect(config.name).toBe('Local Plaintext');
      expect(config.clientId).toBe('redfireforge-local');
      expect(config.brokers).toEqual(['127.0.0.1:19092']);
      expect(config.auth).toEqual({ mode: 'none' });
      expect(config.tls).toEqual({ enabled: false, rejectUnauthorized: true });
      expect(config.createdAt).toBe(now);
      expect(config.updatedAt).toBe(now);
    });

    it('uses Date.now() by default', () => {
      const preset = getPresetById('local-sasl-plain')!;
      const before = Date.now();
      const config = applyPreset(preset);
      const after = Date.now();

      expect(config.createdAt).toBeGreaterThanOrEqual(before);
      expect(config.createdAt).toBeLessThanOrEqual(after);
    });

    it('clones brokers, auth, and tls objects rather than reusing references', () => {
      const preset = getPresetById('local-plaintext')!;
      const config = applyPreset(preset, 1);
      expect(config.brokers).not.toBe(preset.config.brokers);
      expect(config.auth).not.toBe(preset.config.auth);
      expect(config.tls).not.toBe(preset.config.tls);
    });
  });

  describe('presetRequiresCredentials', () => {
    it('returns false for plaintext', () => {
      expect(presetRequiresCredentials(getPresetById('local-plaintext')!)).toBe(false);
    });

    it('returns true for SASL presets', () => {
      expect(presetRequiresCredentials(getPresetById('local-sasl-plain')!)).toBe(true);
      expect(presetRequiresCredentials(getPresetById('local-sasl-scram256')!)).toBe(true);
      expect(presetRequiresCredentials(getPresetById('local-sasl-scram512')!)).toBe(true);
    });

    it('returns true for SASL+TLS preset', () => {
      expect(presetRequiresCredentials(getPresetById('local-sasl-tls')!)).toBe(true);
    });

    it('returns false for TLS-only strict preset', () => {
      expect(presetRequiresCredentials(getPresetById('local-tls-strict')!)).toBe(false);
    });
  });

  describe('presetRequiresTlsCert', () => {
    it('returns false for plaintext and non-strict TLS', () => {
      expect(presetRequiresTlsCert(getPresetById('local-plaintext')!)).toBe(false);
      expect(presetRequiresTlsCert(getPresetById('local-sasl-tls')!)).toBe(false);
    });

    it('returns true for strict TLS', () => {
      expect(presetRequiresTlsCert(getPresetById('local-tls-strict')!)).toBe(true);
    });

    it('returns false when tls is disabled regardless of rejectUnauthorized default', () => {
      expect(presetRequiresTlsCert(getPresetById('local-plaintext')!)).toBe(false);
    });
  });
});
