/**
 * Pure helper functions for Kafka Message Studio.
 * No React imports — all functions are unit-testable in isolation.
 */

import { saveJsonFile } from '../../shared/utils/fileSaver';
import type { KafkaConsumeCursor, KafkaConsumeDraft, KafkaConsumeResultRow, KafkaHeaderRow, KafkaPublishDraft } from './types';

// ── JSON helpers ───────────────────────────────────────────────────────────

export interface ValidateJsonResult {
  ok: boolean;
  /** Present when ok === true: the pretty-printed form (empty string → input was blank) */
  formatted?: string;
  /** Present when ok === false */
  error?: string;
}

/** Try to parse and pretty-print a JSON string. Returns formatted value on success. */
export function validateAndFormatJson(raw: string): ValidateJsonResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, formatted: '' };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return { ok: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// ── Header helpers ─────────────────────────────────────────────────────────

/**
 * Parse a 'key=value' header-match string into a Record.
 * Returns undefined when the input is blank or has no '=' separator.
 */
export function parseHeaderMatch(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) return undefined;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!key) return undefined;
  return { [key]: value };
}

/**
 * Convert header rows (enabled + non-empty key only) into a plain Record.
 * Returns undefined when no enabled rows exist.
 */
export function headersToRecord(rows: KafkaHeaderRow[]): Record<string, string> | undefined {
  const enabled = rows.filter((r) => r.enabled && r.key.trim() !== '');
  if (enabled.length === 0) return undefined;
  return Object.fromEntries(enabled.map((r) => [r.key.trim(), r.value]));
}

// ── Filter builder ─────────────────────────────────────────────────────────

/**
 * Build a server-side KafkaMessageFilter from the consume draft.
 * Returns undefined when no filter fields are set.
 */
export function buildConsumeFilter(draft: KafkaConsumeDraft): Record<string, unknown> | undefined {
  const filter: Record<string, unknown> = {};

  if (draft.keyEquals.trim()) {
    filter.keyEquals = draft.keyEquals.trim();
  }

  const headersMatch = parseHeaderMatch(draft.headerMatch);
  if (headersMatch) {
    filter.headersMatch = headersMatch;
  }

  if (draft.jsonPath.trim()) {
    filter.jsonPath = draft.jsonPath.trim();
  }

  if (draft.jsonPathEquals.trim()) {
    filter.jsonEquals = draft.jsonPathEquals.trim();
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ── Request builders ───────────────────────────────────────────────────────

/** Build the body for dispatchKafkaOperation('produce', body). */
export function buildPublishRequest(
  draft: KafkaPublishDraft,
  clusterId: string,
): Record<string, unknown> {
  const headers = headersToRecord(draft.headers);
  const partitionRaw = draft.partition.trim();
  const partitionNum = partitionRaw !== '' ? parseInt(partitionRaw, 10) : undefined;
  const timeoutRaw = draft.timeoutMs.trim();
  const timeoutMs = timeoutRaw !== '' ? parseInt(timeoutRaw, 10) : undefined;

  const message: Record<string, unknown> = { value: draft.body };
  if (draft.key.trim()) message.key = draft.key.trim();
  if (partitionNum !== undefined && !isNaN(partitionNum)) message.partition = partitionNum;
  if (headers) message.headers = headers;

  const req: Record<string, unknown> = {
    clusterId,
    topic: draft.topic,
    messages: [message],
    acks: draft.acks,
  };

  if (timeoutMs !== undefined && !isNaN(timeoutMs)) req.timeoutMs = timeoutMs;
  if (draft.schemaConfig) req.schemaConfig = draft.schemaConfig;

  return req;
}

/** Build the body for dispatchKafkaOperation('consume-once', body). */
export function buildConsumeRequest(
  draft: KafkaConsumeDraft,
  clusterId: string,
  seekOffsets?: KafkaConsumeCursor[],
): Record<string, unknown> {
  const timeoutMsRaw = parseInt(draft.timeoutMs, 10);
  const maxMessagesRaw = parseInt(draft.maxMessages, 10);

  const req: Record<string, unknown> = {
    clusterId,
    topic: draft.topic,
    fromBeginning: draft.startPosition === 'earliest',
    timeoutMs: isNaN(timeoutMsRaw) ? 10000 : timeoutMsRaw,
    maxMessages: isNaN(maxMessagesRaw) ? 50 : maxMessagesRaw,
  };

  if (draft.groupId.trim()) req.groupId = draft.groupId.trim();

  const filter = buildConsumeFilter(draft);
  if (filter) req.filter = filter;

  if (draft.schemaConfig) req.schemaConfig = draft.schemaConfig;

  const sortOrder = draft.sortOrder ?? 'asc';
  if (sortOrder !== 'asc') req.sortOrder = sortOrder;

  if (seekOffsets && seekOffsets.length > 0) req.seekOffsets = seekOffsets;

  return req;
}

// ── Subscribe request builder ──────────────────────────────────────────────

/** Build the body for dispatchKafkaOperation('subscribe', body). */
export function buildSubscribeRequest(
  draft: KafkaConsumeDraft,
  clusterId: string,
): Record<string, unknown> {
  const req: Record<string, unknown> = {
    clusterId,
    topic: draft.topic,
    fromBeginning: draft.startPosition === 'earliest',
    maxInMemoryMessages: 200,
  };
  if (draft.groupId.trim()) req.groupId = draft.groupId.trim();
  const filter = buildConsumeFilter(draft);
  if (filter) req.filter = filter;
  return req;
}

// ── Export helper ──────────────────────────────────────────────────────────

/** Trigger a file download for the result set (uses shared saveJsonFile — supports browser + Tauri). */
export async function exportResultSet(rows: KafkaConsumeResultRow[], topic: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `kafka-consume-${topic || 'result'}-${date}.json`;
  await saveJsonFile(rows, filename);
}

// ── Preview helper ─────────────────────────────────────────────────────────

/** Return a truncated preview of a message value for the results table. */
export function valuePreview(value: string, maxLen = 60): string {
  if (!value) return '(empty)';
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}
