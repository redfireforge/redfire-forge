import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dispatchKafkaOperation,
  envelopeErrorToUiError,
  toKafkaUiSafeError,
  type KafkaUiSafeError,
} from '../../shared/kafka/kafkaClient';
import type { UseKafkaStateReturn } from './useKafkaState';
import type { KafkaConsumeDraft, KafkaConsumeResultRow } from '../../features/kafka/types';
import { buildSubscribeRequest } from '../../features/kafka/kafkaMessageStudioUtils';

const POLL_INTERVAL_MS = 1000;

export interface UseKafkaStreamModeReturn {
  isStreaming: boolean;
  streamMessages: KafkaConsumeResultRow[];
  streamError: KafkaUiSafeError | null;
  streamSubscriptionId: string | null;
  cursorGap: boolean;

  startStream: (draft: KafkaConsumeDraft, clusterId: string) => Promise<void>;
  stopStream: () => Promise<void>;
  clearStreamMessages: () => void;

  selectedStreamIndex: number | null;
  selectedStreamMessage: KafkaConsumeResultRow | null;
  selectStreamMessage: (index: number | null) => void;
}

export interface UseKafkaStreamModeDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

export function useKafkaStreamMode(
  kafkaState: UseKafkaStateReturn,
  deps?: UseKafkaStreamModeDeps,
): UseKafkaStreamModeReturn {
  const dispatch = deps?.dispatch ?? dispatchKafkaOperation;

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMessages, setStreamMessages] = useState<KafkaConsumeResultRow[]>([]);
  const [streamError, setStreamError] = useState<KafkaUiSafeError | null>(null);
  const [streamSubscriptionId, setStreamSubscriptionId] = useState<string | null>(null);
  const [cursorGap, setCursorGap] = useState(false);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number | null>(null);

  const sinceCursorRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollMessages = useCallback(async () => {
    const subId = subscriptionIdRef.current;
    if (!subId || !isStreamingRef.current) return;

    try {
      const envelope = await dispatch<{
        subscriptionId: string;
        messages: KafkaConsumeResultRow[];
        cursor: number;
        cursorGap?: boolean;
      }>('subscription-messages', {
        subscriptionId: subId,
        sinceCursor: sinceCursorRef.current,
        clusterId: kafkaState.selectedClusterId ?? '',
      });

      if (!isStreamingRef.current) return;

      if (envelope.ok && envelope.data) {
        if (envelope.data.messages.length > 0) {
          setStreamMessages((prev) => [...prev, ...envelope.data!.messages]);
        }
        sinceCursorRef.current = envelope.data.cursor;
        if (envelope.data.cursorGap) {
          setCursorGap(true);
        }
      }
    } catch (err) {
      if (!isStreamingRef.current) return;
      setStreamError(toKafkaUiSafeError(err, 'subscription-messages'));
    }
  }, [dispatch, kafkaState.selectedClusterId]);

  const startStream = useCallback(async (draft: KafkaConsumeDraft, clusterId: string) => {
    if (!draft.topic.trim()) {
      setStreamError({
        kind: 'validation',
        code: 'KAFKA_INVALID_SUBSCRIBE',
        message: 'Topic is required',
        retryable: false,
      });
      return;
    }

    if (kafkaState.connection.state !== 'connected') {
      setStreamError({
        kind: 'cluster',
        code: 'KAFKA_NOT_CONNECTED',
        message: 'Cluster is not connected',
        retryable: false,
      });
      return;
    }

    setStreamError(null);
    setCursorGap(false);
    sinceCursorRef.current = 0;

    try {
      const body = buildSubscribeRequest(draft, clusterId);
      const envelope = await dispatch<{
        clusterId?: string;
        subscription: { subscriptionId: string; topic: string; groupId: string; createdAt: string };
      }>('subscribe', body);

      if (!envelope.ok || !envelope.data) {
        setStreamError(envelopeErrorToUiError(envelope, 'Subscribe failed', 'KAFKA_SUBSCRIBE_FAILED'));
        return;
      }

      const subId = envelope.data.subscription.subscriptionId;
      subscriptionIdRef.current = subId;
      isStreamingRef.current = true;
      setStreamSubscriptionId(subId);
      setIsStreaming(true);

      stopPolling();
      pollingRef.current = setInterval(() => { void pollMessages(); }, POLL_INTERVAL_MS);
    } catch (err) {
      setStreamError(toKafkaUiSafeError(err, 'subscribe'));
    }
  }, [kafkaState.connection.state, dispatch, pollMessages, stopPolling]);

  const stopStream = useCallback(async () => {
    stopPolling();
    isStreamingRef.current = false;
    setIsStreaming(false);

    const subId = subscriptionIdRef.current;
    if (subId) {
      try {
        await dispatch('unsubscribe', {
          subscriptionId: subId,
          clusterId: kafkaState.selectedClusterId ?? '',
        });
      } catch {
        // Best-effort unsubscribe — don't block UI
      }
      subscriptionIdRef.current = null;
      setStreamSubscriptionId(null);
    }
  }, [dispatch, kafkaState.selectedClusterId, stopPolling]);

  const clearStreamMessages = useCallback(() => {
    setStreamMessages([]);
    setCursorGap(false);
    sinceCursorRef.current = 0;
    setSelectedStreamIndex(null);
  }, []);

  const selectStreamMessage = useCallback((index: number | null) => {
    setSelectedStreamIndex(index);
  }, []);

  // Auto-stop on disconnect
  useEffect(() => {
    if (kafkaState.connection.state !== 'connected' && isStreamingRef.current) {
      stopPolling();
      isStreamingRef.current = false;
      setIsStreaming(false);
      subscriptionIdRef.current = null;
      setStreamSubscriptionId(null);
      setStreamError(null);
    }
  }, [kafkaState.connection.state, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      isStreamingRef.current = false;
    };
  }, [stopPolling]);

  const selectedStreamMessage =
    selectedStreamIndex !== null && streamMessages[selectedStreamIndex]
      ? streamMessages[selectedStreamIndex]
      : null;

  return {
    isStreaming,
    streamMessages,
    streamError,
    streamSubscriptionId,
    cursorGap,
    startStream,
    stopStream,
    clearStreamMessages,
    selectedStreamIndex,
    selectedStreamMessage,
    selectStreamMessage,
  };
}
