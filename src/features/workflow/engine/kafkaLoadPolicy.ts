import type { ExecutionMode } from '../../../shared/types';
import type { KafkaConsumeLoadTestMode } from '../types/workflow';

export type KafkaLoadPolicyOutcome = {
  decision: 'allow' | 'warn' | 'block';
  fallbackMode?: KafkaConsumeLoadTestMode;
  message?: string;
};

/**
 * Resolves the Kafka consume load-test policy for a given execution mode and consume load mode.
 *
 * Decision semantics:
 * - 'allow'  — safe to proceed; no guardrail needed
 * - 'warn'   — allowed but non-deterministic; surface advisory to user (reserved for
 *               constant-arrival + wait-for-real; enforcement is at the desktop/Rust boundary)
 * - 'block'  — unsafe for the given mode; Phase 7B throws before iteration starts;
 *               Phase 7C surfaces the message before the user clicks Run
 *
 * fallbackMode is only set when consumeLoadMode is undefined and the execution context
 * has a safer default to recommend ('auto-resume').  Phase 7B applies this fallback to
 * override the node runtime default; Phase 7C renders an advisory banner for it.
 *
 * All non-graph execution modes ('sequential', 'batch', 'pool', 'load-profile') pass
 * through as allow — Kafka consume nodes do not exist on those paths.
 */
export function resolveKafkaConsumeLoadPolicy(
  executionMode: ExecutionMode,
  consumeLoadMode: KafkaConsumeLoadTestMode | undefined,
): KafkaLoadPolicyOutcome {
  if (executionMode === 'workflow') {
    if (consumeLoadMode === undefined) {
      return {
        decision: 'allow',
        fallbackMode: 'auto-resume',
        message:
          'No load test mode configured; defaulting to auto-resume for deterministic iteration behavior',
      };
    }
    if (consumeLoadMode === 'wait-for-real') {
      return {
        decision: 'block',
        message:
          "Kafka consume node has 'wait-for-real' load mode — this blocks every load-test iteration" +
          " waiting for a live Kafka message; set loadTestBehavior.mode to 'auto-resume' or" +
          " 'synthetic-inject' for deterministic load-test behavior",
      };
    }
    // 'auto-resume' | 'synthetic-inject' — safe for workflow load iterations
    return { decision: 'allow' };
  }

  if (executionMode === 'constant-arrival') {
    if (consumeLoadMode === undefined) {
      // JS-side policy only; constant-arrival enforcement is at the desktop/Rust boundary
      return { decision: 'allow', fallbackMode: 'auto-resume' };
    }
    if (consumeLoadMode === 'wait-for-real') {
      return {
        decision: 'warn',
        message:
          'wait-for-real under constant arrival introduces non-deterministic throughput;' +
          ' consider auto-resume or synthetic-inject',
      };
    }
    // 'auto-resume' | 'synthetic-inject'
    return { decision: 'allow' };
  }

  // 'sequential' | 'batch' | 'pool' | 'load-profile'
  // None of these run workflow graph nodes — Kafka consume policy is a no-op passthrough.
  return { decision: 'allow' };
}
