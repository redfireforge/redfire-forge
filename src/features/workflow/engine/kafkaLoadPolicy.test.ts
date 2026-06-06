import { describe, it, expect } from 'vitest';
import { resolveKafkaConsumeLoadPolicy } from './kafkaLoadPolicy';

describe('resolveKafkaConsumeLoadPolicy', () => {
  // ── 'workflow' execution mode ─────────────────────────────────────────────

  describe("executionMode = 'workflow'", () => {
    it("undefined consumeLoadMode → allow with auto-resume fallback and advisory message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('workflow', undefined);
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBe('auto-resume');
      expect(typeof outcome.message).toBe('string');
      expect(outcome.message!.length).toBeGreaterThan(0);
    });

    it("'auto-resume' → allow with no fallbackMode and no message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('workflow', 'auto-resume');
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBeUndefined();
      expect(outcome.message).toBeUndefined();
    });

    it("'synthetic-inject' → allow with no fallbackMode and no message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('workflow', 'synthetic-inject');
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBeUndefined();
      expect(outcome.message).toBeUndefined();
    });

    it("'wait-for-real' → block with non-empty message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('workflow', 'wait-for-real');
      expect(outcome.decision).toBe('block');
      expect(typeof outcome.message).toBe('string');
      expect(outcome.message!.length).toBeGreaterThan(0);
      // message should name the mode so users know what to change
      expect(outcome.message).toContain('wait-for-real');
      expect(outcome.fallbackMode).toBeUndefined();
    });
  });

  // ── 'constant-arrival' execution mode ────────────────────────────────────

  describe("executionMode = 'constant-arrival'", () => {
    it("undefined consumeLoadMode → allow with auto-resume fallback, no message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', undefined);
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBe('auto-resume');
      // constant-arrival default fallback is silent — no advisory message needed from JS side
      expect(outcome.message).toBeUndefined();
    });

    it("'auto-resume' → allow with no message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', 'auto-resume');
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBeUndefined();
      expect(outcome.message).toBeUndefined();
    });

    it("'synthetic-inject' → allow with no message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', 'synthetic-inject');
      expect(outcome.decision).toBe('allow');
      expect(outcome.fallbackMode).toBeUndefined();
      expect(outcome.message).toBeUndefined();
    });

    it("'wait-for-real' → warn with non-empty message", () => {
      const outcome = resolveKafkaConsumeLoadPolicy('constant-arrival', 'wait-for-real');
      expect(outcome.decision).toBe('warn');
      expect(typeof outcome.message).toBe('string');
      expect(outcome.message!.length).toBeGreaterThan(0);
      expect(outcome.fallbackMode).toBeUndefined();
    });
  });

  // ── Passthrough modes (non-graph execution paths) ─────────────────────────
  // 'sequential', 'batch', 'pool', 'load-profile' do not run workflow graph nodes;
  // Kafka consume policy is a no-op allow for all of them.

  it("'load-profile' + 'wait-for-real' → allow (no graph nodes on this path)", () => {
    const outcome = resolveKafkaConsumeLoadPolicy('load-profile', 'wait-for-real');
    expect(outcome.decision).toBe('allow');
    expect(outcome.fallbackMode).toBeUndefined();
    expect(outcome.message).toBeUndefined();
  });

  it("'sequential' + undefined → allow (passthrough, no message)", () => {
    const outcome = resolveKafkaConsumeLoadPolicy('sequential', undefined);
    expect(outcome.decision).toBe('allow');
    expect(outcome.fallbackMode).toBeUndefined();
    expect(outcome.message).toBeUndefined();
  });

  it("'batch' + 'wait-for-real' → allow (passthrough)", () => {
    const outcome = resolveKafkaConsumeLoadPolicy('batch', 'wait-for-real');
    expect(outcome.decision).toBe('allow');
  });

  it("'pool' + 'wait-for-real' → allow (passthrough)", () => {
    const outcome = resolveKafkaConsumeLoadPolicy('pool', 'wait-for-real');
    expect(outcome.decision).toBe('allow');
  });
});
