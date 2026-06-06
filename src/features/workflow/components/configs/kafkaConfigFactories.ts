/**
 * Shared factory functions for Kafka workflow config panels.
 *
 * Previously duplicated across KafkaConsumeConfig, KafkaTriggerConfig,
 * and KafkaWaitConfig. Centralised here so row shapes are consistent.
 */
import { v4 as uuid } from 'uuid';
import type {
  KafkaConsumeHeaderFilterRow,
  KafkaConsumeJsonPathFilterRow,
} from '../../types/workflow';

/** Create a new, empty header-filter row with a short unique id. */
export function createHeaderFilter(): KafkaConsumeHeaderFilterRow {
  return { id: uuid().slice(0, 8), key: '', value: '', enabled: true };
}

/** Create a new, empty JSONPath-filter row with a short unique id. */
export function createJsonPathFilter(): KafkaConsumeJsonPathFilterRow {
  return { id: uuid().slice(0, 8), jsonPath: '', expectedValue: '', enabled: true };
}

/** Create a new, empty extract-variable row. */
export function createExtractVariable(): { name: string; jsonPath: string } {
  return { name: '', jsonPath: '' };
}
