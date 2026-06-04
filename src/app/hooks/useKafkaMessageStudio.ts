import { useCallback, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  dispatchKafkaOperation,
  toKafkaUiSafeError,
  type KafkaUiSafeError,
} from '../../shared/kafka/kafkaClient';
import type { UseKafkaStateReturn } from './useKafkaState';
import type {
  KafkaConsumeDraft,
  KafkaConsumeResultRow,
  KafkaPublishDraft,
  KafkaPublishResult,
} from '../../features/kafka/types';
import {
  buildConsumeRequest,
  buildPublishRequest,
  validateAndFormatJson,
} from '../../features/kafka/kafkaMessageStudioUtils';

// ── Public interface ───────────────────────────────────────────────────────

export interface UseKafkaMessageStudioReturn {
  // Publish
  publishDraft: KafkaPublishDraft;
  setPublishDraft: (patch: Partial<KafkaPublishDraft>) => void;
  publishLoading: boolean;
  publishResult: KafkaPublishResult | null;
  publishError: KafkaUiSafeError | null;
  sendOnce: () => Promise<void>;
  validateJsonBody: () => boolean;

  // Consume
  consumeDraft: KafkaConsumeDraft;
  setConsumeDraft: (patch: Partial<KafkaConsumeDraft>) => void;
  consumeLoading: boolean;
  consumeResult: KafkaConsumeResultRow[] | null;
  consumeTimedOut: boolean;
  consumeError: KafkaUiSafeError | null;
  selectedMessageIndex: number | null;
  selectedMessage: KafkaConsumeResultRow | null;
  selectMessage: (index: number | null) => void;
  consumeOnce: () => Promise<void>;

  // Utilities / reset
  clearPublishResult: () => void;
  clearConsumeResult: () => void;
  /** 0 before first consume; equals consumeResult?.length ?? 0 */
  consumeMessageCount: number;
}

export interface UseKafkaMessageStudioDeps {
  /** Injectable dispatch for unit tests — defaults to dispatchKafkaOperation. */
  dispatch?: typeof dispatchKafkaOperation;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useKafkaMessageStudio(
  kafkaState: UseKafkaStateReturn,
  deps?: UseKafkaMessageStudioDeps,
): UseKafkaMessageStudioReturn {
  const dispatch = deps?.dispatch ?? dispatchKafkaOperation;

  // ── Publish state ────────────────────────────────────────────────────────
  const [publishDraftState, setPublishDraftState] = useState<KafkaPublishDraft>({
    topic: '',
    key: '',
    partition: '',
    acks: -1,
    timeoutMs: '',
    headers: [],
    body: '',
  });

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState<KafkaPublishResult | null>(null);
  const [publishError, setPublishError] = useState<KafkaUiSafeError | null>(null);

  // ── Consume state ────────────────────────────────────────────────────────
  const [consumeDraftState, setConsumeDraftState] = useState<KafkaConsumeDraft>(() => ({
    topic: '',
    groupId: `redfireforge-debug-${uuid().slice(0, 8)}`,
    startPosition: 'latest',
    timeoutMs: '10000',
    maxMessages: '50',
    keyEquals: '',
    headerMatch: '',
    jsonPath: '',
    jsonPathEquals: '',
  }));

  const [consumeLoading, setConsumeLoading] = useState(false);
  const [consumeResult, setConsumeResult] = useState<KafkaConsumeResultRow[] | null>(null);
  const [consumeTimedOut, setConsumeTimedOut] = useState(false);
  const [consumeError, setConsumeError] = useState<KafkaUiSafeError | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);

  // ── Setters ──────────────────────────────────────────────────────────────
  const setPublishDraft = useCallback((patch: Partial<KafkaPublishDraft>) => {
    setPublishDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setConsumeDraft = useCallback((patch: Partial<KafkaConsumeDraft>) => {
    setConsumeDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── validateJsonBody ─────────────────────────────────────────────────────
  const validateJsonBody = useCallback((): boolean => {
    const result = validateAndFormatJson(publishDraftState.body);
    if (result.ok && result.formatted !== undefined) {
      setPublishDraftState((prev) => ({ ...prev, body: result.formatted! }));
    }
    if (!result.ok) {
      setPublishError({
        kind: 'validation',
        code: 'INVALID_JSON',
        message: result.error ?? 'Invalid JSON',
        retryable: false,
      });
    } else {
      // Clear a prior JSON validation error
      setPublishError((prev) =>
        prev?.code === 'INVALID_JSON' ? null : prev,
      );
    }
    return result.ok;
  }, [publishDraftState.body]);

  // ── sendOnce ─────────────────────────────────────────────────────────────
  const sendOnce = useCallback(async () => {
    const clusterId = kafkaState.selectedClusterId ?? '';
    setPublishLoading(true);
    setPublishResult(null);
    setPublishError(null);
    try {
      const body = buildPublishRequest(publishDraftState, clusterId);
      const envelope = await dispatch<KafkaPublishResult>('produce', body);
      if (!envelope.ok || !envelope.data) {
        const msg = envelope.error?.message ?? 'Produce failed';
        const code = envelope.error?.code ?? 'PRODUCE_FAILED';
        const retryable = envelope.error?.retryable ?? true;
        setPublishError({ kind: 'server', code, message: msg, retryable });
        return;
      }
      setPublishResult(envelope.data);
    } catch (err) {
      setPublishError(toKafkaUiSafeError(err, 'produce'));
    } finally {
      setPublishLoading(false);
    }
  }, [kafkaState.selectedClusterId, publishDraftState, dispatch]);

  // ── consumeOnce ──────────────────────────────────────────────────────────
  const consumeOnce = useCallback(async () => {
    const clusterId = kafkaState.selectedClusterId ?? '';
    setConsumeLoading(true);
    setConsumeResult(null);
    setConsumeError(null);
    setConsumeTimedOut(false);
    setSelectedMessageIndex(null);
    try {
      const body = buildConsumeRequest(consumeDraftState, clusterId);
      const envelope = await dispatch<{
        messageCount: number;
        messages: KafkaConsumeResultRow[];
        timedOut: boolean;
      }>('consume-once', body);
      if (!envelope.ok || !envelope.data) {
        const msg = envelope.error?.message ?? 'Consume failed';
        const code = envelope.error?.code ?? 'CONSUME_FAILED';
        const retryable = envelope.error?.retryable ?? true;
        setConsumeError({ kind: 'server', code, message: msg, retryable });
        return;
      }
      setConsumeResult(envelope.data.messages);
      setConsumeTimedOut(envelope.data.timedOut);
    } catch (err) {
      setConsumeError(toKafkaUiSafeError(err, 'consume-once'));
    } finally {
      setConsumeLoading(false);
    }
  }, [kafkaState.selectedClusterId, consumeDraftState, dispatch]);

  // ── Utilities ────────────────────────────────────────────────────────────
  const clearPublishResult = useCallback(() => {
    setPublishResult(null);
    setPublishError(null);
  }, []);

  const clearConsumeResult = useCallback(() => {
    setConsumeResult(null);
    setConsumeError(null);
    setConsumeTimedOut(false);
    setSelectedMessageIndex(null);
  }, []);

  const selectMessage = useCallback((index: number | null) => {
    setSelectedMessageIndex(index);
  }, []);

  const selectedMessage =
    selectedMessageIndex !== null && consumeResult
      ? (consumeResult[selectedMessageIndex] ?? null)
      : null;

  const consumeMessageCount = consumeResult?.length ?? 0;

  return {
    publishDraft: publishDraftState,
    setPublishDraft,
    publishLoading,
    publishResult,
    publishError,
    sendOnce,
    validateJsonBody,

    consumeDraft: consumeDraftState,
    setConsumeDraft,
    consumeLoading,
    consumeResult,
    consumeTimedOut,
    consumeError,
    selectedMessageIndex,
    selectedMessage,
    selectMessage,
    consumeOnce,

    clearPublishResult,
    clearConsumeResult,
    consumeMessageCount,
  };
}
