import { describe, it, expect } from 'vitest';
import {
  deriveKafkaTriggerGroupId,
  KAFKA_TRIGGER_CONTEXT_KEYS,
  KAFKA_WAIT_CONTEXT_KEYS,
  isValidKafkaTriggerConfig,
  isValidKafkaWaitConfig,
} from './kafkaTriggerContracts';
import type { KafkaTriggerNodeData, KafkaWaitNodeData } from '../types/workflow';
import { defaultKafkaTriggerNodeData, defaultKafkaWaitNodeData } from '../utils/workflowNodeFactory';

describe('Phase 5A \u2014 kafkaTriggerContracts', () => {
  // ── deriveKafkaTriggerGroupId ───────────────────────────────────────────────

  describe('deriveKafkaTriggerGroupId', () => {
    it('returns a deterministic group ID from workflowId and triggerNodeId', () => {
      const id = deriveKafkaTriggerGroupId('wf-abc', 'n1');
      expect(id).toBe('rf-trigger-wf-abc-n1');
      // Same inputs always produce same result
      expect(deriveKafkaTriggerGroupId('wf-abc', 'n1')).toBe(id);
    });

    it('produces different IDs for different workflowIds', () => {
      const a = deriveKafkaTriggerGroupId('wf-001', 'n1');
      const b = deriveKafkaTriggerGroupId('wf-002', 'n1');
      expect(a).not.toBe(b);
    });

    it('produces different IDs for different nodeIds', () => {
      const a = deriveKafkaTriggerGroupId('wf-001', 'n1');
      const b = deriveKafkaTriggerGroupId('wf-001', 'n2');
      expect(a).not.toBe(b);
    });

    it('includes both workflowId and nodeId in the group ID', () => {
      const id = deriveKafkaTriggerGroupId('my-workflow', 'trigger-node');
      expect(id).toContain('my-workflow');
      expect(id).toContain('trigger-node');
    });
  });

  // ── Context variable keys ───────────────────────────────────────────────────

  describe('KAFKA_TRIGGER_CONTEXT_KEYS', () => {
    it('has kafka.trigger.* prefix for all message metadata keys', () => {
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.topic).toBe('kafka.trigger.topic');
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.partition).toBe('kafka.trigger.partition');
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.offset).toBe('kafka.trigger.offset');
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.key).toBe('kafka.trigger.key');
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.value).toBe('kafka.trigger.value');
    });

    it('has a headerPrefix for dynamic header key construction', () => {
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.headerPrefix).toBe('kafka.trigger.header');
      // Dynamic header key example: `${headerPrefix}.<headerName>`
      expect(`${KAFKA_TRIGGER_CONTEXT_KEYS.headerPrefix}.X-Request-Id`).toBe('kafka.trigger.header.X-Request-Id');
    });
  });

  describe('KAFKA_WAIT_CONTEXT_KEYS', () => {
    it('has kafka.wait.* prefix for all message metadata keys', () => {
      expect(KAFKA_WAIT_CONTEXT_KEYS.topic).toBe('kafka.wait.topic');
      expect(KAFKA_WAIT_CONTEXT_KEYS.partition).toBe('kafka.wait.partition');
      expect(KAFKA_WAIT_CONTEXT_KEYS.offset).toBe('kafka.wait.offset');
      expect(KAFKA_WAIT_CONTEXT_KEYS.key).toBe('kafka.wait.key');
      expect(KAFKA_WAIT_CONTEXT_KEYS.value).toBe('kafka.wait.value');
    });

    it('trigger and wait key sets are distinct from each other', () => {
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.topic).not.toBe(KAFKA_WAIT_CONTEXT_KEYS.topic);
      expect(KAFKA_TRIGGER_CONTEXT_KEYS.value).not.toBe(KAFKA_WAIT_CONTEXT_KEYS.value);
    });

    it('has a wait headerPrefix for dynamic header key construction', () => {
      expect(KAFKA_WAIT_CONTEXT_KEYS.headerPrefix).toBe('kafka.wait.header');
      expect(`${KAFKA_WAIT_CONTEXT_KEYS.headerPrefix}.trace-id`).toBe('kafka.wait.header.trace-id');
    });
  });

  // ── isValidKafkaTriggerConfig ───────────────────────────────────────────────

  describe('isValidKafkaTriggerConfig', () => {
    it('returns false for empty default config (no clusterId, no topic)', () => {
      const data = defaultKafkaTriggerNodeData();
      expect(isValidKafkaTriggerConfig(data)).toBe(false);
    });

    it('returns false when clusterId is set but topic is blank', () => {
      const data: KafkaTriggerNodeData = { ...defaultKafkaTriggerNodeData(), clusterId: 'cluster-1' };
      expect(isValidKafkaTriggerConfig(data)).toBe(false);
    });

    it('returns false when topic is set but clusterId is blank', () => {
      const data: KafkaTriggerNodeData = { ...defaultKafkaTriggerNodeData(), topic: 'my-topic' };
      expect(isValidKafkaTriggerConfig(data)).toBe(false);
    });

    it('returns true when both clusterId and topic are set', () => {
      const data: KafkaTriggerNodeData = { ...defaultKafkaTriggerNodeData(), clusterId: 'cluster-1', topic: 'orders' };
      expect(isValidKafkaTriggerConfig(data)).toBe(true);
    });

    it('returns false when clusterId is whitespace only', () => {
      const data: KafkaTriggerNodeData = { ...defaultKafkaTriggerNodeData(), clusterId: '   ', topic: 'orders' };
      expect(isValidKafkaTriggerConfig(data)).toBe(false);
    });

    it('returns false when topic is whitespace only', () => {
      const data: KafkaTriggerNodeData = { ...defaultKafkaTriggerNodeData(), clusterId: 'cluster-1', topic: '   ' };
      expect(isValidKafkaTriggerConfig(data)).toBe(false);
    });
  });

  // ── isValidKafkaWaitConfig ──────────────────────────────────────────────────

  describe('isValidKafkaWaitConfig', () => {
    it('returns false for empty default config', () => {
      const data = defaultKafkaWaitNodeData();
      // correlationIdExpression is '' by default
      expect(isValidKafkaWaitConfig(data)).toBe(false);
    });

    it('returns false when clusterId and topic are set but correlationIdExpression is blank', () => {
      const data: KafkaWaitNodeData = {
        ...defaultKafkaWaitNodeData(),
        clusterId: 'cluster-1',
        topic: 'responses',
        correlationIdExpression: '',
      };
      expect(isValidKafkaWaitConfig(data)).toBe(false);
    });

    it('returns true when clusterId, topic, and correlationIdExpression are all set', () => {
      const data: KafkaWaitNodeData = {
        ...defaultKafkaWaitNodeData(),
        clusterId: 'cluster-1',
        topic: 'responses',
        correlationIdExpression: '{{orderId}}',
      };
      expect(isValidKafkaWaitConfig(data)).toBe(true);
    });

    it('returns false when correlationIdExpression is whitespace only', () => {
      const data: KafkaWaitNodeData = {
        ...defaultKafkaWaitNodeData(),
        clusterId: 'cluster-1',
        topic: 'responses',
        correlationIdExpression: '   ',
      };
      expect(isValidKafkaWaitConfig(data)).toBe(false);
    });

    it('returns false when topic is whitespace only even with correlation configured', () => {
      const data: KafkaWaitNodeData = {
        ...defaultKafkaWaitNodeData(),
        clusterId: 'cluster-1',
        topic: '   ',
        correlationIdExpression: '{{orderId}}',
      };
      expect(isValidKafkaWaitConfig(data)).toBe(false);
    });

    it('returns false when clusterId is whitespace only even with topic and correlation configured', () => {
      const data: KafkaWaitNodeData = {
        ...defaultKafkaWaitNodeData(),
        clusterId: '   ',
        topic: 'responses',
        correlationIdExpression: '{{orderId}}',
      };
      expect(isValidKafkaWaitConfig(data)).toBe(false);
    });
  });
});
