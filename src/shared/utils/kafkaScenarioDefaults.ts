import type {
  KafkaActionType,
  KafkaConsumeActionConfig,
  KafkaProduceActionConfig,
  Scenario,
} from '../types';

// ─── Default builders ──────────────────────────────────────────────────────────

/**
 * Returns a minimal `KafkaProduceActionConfig` with all required fields set and
 * optional fields filled with their documented defaults.
 */
export function makeDefaultKafkaProduceAction(
  clusterId: string,
  topic: string,
): KafkaProduceActionConfig {
  return {
    clusterId,
    topic,
    acks: -1,
    timeoutMs: 5_000,
  };
}

/**
 * Returns a minimal `KafkaConsumeActionConfig` with all required fields set and
 * optional fields filled with their documented defaults.
 */
export function makeDefaultKafkaConsumeAction(
  clusterId: string,
  topic: string,
): KafkaConsumeActionConfig {
  return {
    clusterId,
    topic,
    fromBeginning: false,
    timeoutMs: 10_000,
    maxMessages: 1,
  };
}

// ─── Type guards ────────────────────────────────────────────────────────────────

/**
 * Returns `true` when the scenario uses a Kafka transport action
 * (`'kafkaProduce'` or `'kafkaConsume'`).
 * Absent `actionType` is treated as `'http'` (backward-compatible default).
 */
export function isKafkaScenario(scenario: Scenario): boolean {
  const type = resolveKafkaActionType(scenario);
  return type === 'kafkaProduce' || type === 'kafkaConsume';
}

/**
 * Resolves the effective action type for a scenario.
 * Absent `actionType` returns `'http'` for backward compatibility.
 */
export function resolveKafkaActionType(scenario: Scenario): KafkaActionType {
  return scenario.actionType ?? 'http';
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates a Kafka scenario's action configuration.
 *
 * Returns an array of human-readable error messages.
 * An empty array means the configuration is valid.
 *
 * HTTP scenarios (`actionType` absent or `'http'`) always return `[]`.
 */
export function validateKafkaActionConfig(scenario: Scenario): string[] {
  const type = resolveKafkaActionType(scenario);
  if (type === 'http') return [];

  if (type === 'kafkaProduce') {
    if (!scenario.kafkaProduceAction) {
      return ['kafkaProduceAction is required when actionType is "kafkaProduce"'];
    }
    const errors: string[] = [];
    if (!scenario.kafkaProduceAction.clusterId.trim()) errors.push('kafkaProduceAction.clusterId is required');
    if (!scenario.kafkaProduceAction.topic.trim()) errors.push('kafkaProduceAction.topic is required');
    return errors;
  }

  if (type === 'kafkaConsume') {
    if (!scenario.kafkaConsumeAction) {
      return ['kafkaConsumeAction is required when actionType is "kafkaConsume"'];
    }
    const errors: string[] = [];
    if (!scenario.kafkaConsumeAction.clusterId.trim()) errors.push('kafkaConsumeAction.clusterId is required');
    if (!scenario.kafkaConsumeAction.topic.trim()) errors.push('kafkaConsumeAction.topic is required');
    const f = scenario.kafkaConsumeAction.filter;
    if (f?.jsonEquals !== undefined && !f?.jsonPath) {
      errors.push('kafkaConsumeAction.filter.jsonEquals requires filter.jsonPath to be set');
    }
    return errors;
  }

  return [];
}
