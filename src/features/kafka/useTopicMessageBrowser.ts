import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dispatchKafkaOperation,
  toKafkaUiSafeError,
  type KafkaUiSafeError,
} from '../../shared/kafka/kafkaClient';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import type { KafkaConsumeCursor, KafkaConsumeResultRow } from './types';
import { buildConsumeFilter } from './kafkaMessageStudioUtils';

export type TimeWindow = 'latest' | 'last-1h' | 'last-24h' | 'earliest';
export type SortOrder = 'asc' | 'desc';

export interface TopicMessageBrowserDraft {
  groupId: string;
  timeWindow: TimeWindow;
  partition: string;
  timeoutMs: string;
  maxMessages: string;
  keyEquals: string;
  headerMatch: string;
  jsonPath: string;
  jsonPathEquals: string;
  sortOrder: SortOrder;
}

export interface UseTopicMessageBrowserReturn {
  draft: TopicMessageBrowserDraft;
  setDraft: (patch: Partial<TopicMessageBrowserDraft>) => void;
  loading: boolean;
  result: KafkaConsumeResultRow[] | null;
  timedOut: boolean;
  messageCount: number;
  error: KafkaUiSafeError | null;
  selectedIndex: number | null;
  selectedMessage: KafkaConsumeResultRow | null;
  selectMessage: (index: number | null) => void;
  consumeOnce: () => Promise<void>;
  clearResult: () => void;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadMoreLoading: boolean;
}

export interface UseTopicMessageBrowserDeps {
  dispatch?: typeof dispatchKafkaOperation;
}

function makeGroupId(): string {
  return `redfireforge-debug-${Math.random().toString(36).slice(2, 10)}`;
}

function makeDefaultDraft(): TopicMessageBrowserDraft {
  return {
    groupId: makeGroupId(),
    timeWindow: 'latest',
    partition: '',
    timeoutMs: '10000',
    maxMessages: '50',
    keyEquals: '',
    headerMatch: '',
    jsonPath: '',
    jsonPathEquals: '',
    sortOrder: 'asc',
  };
}

export function useTopicMessageBrowser(
  topicName: string,
  kafkaState: UseKafkaStateReturn,
  deps?: UseTopicMessageBrowserDeps,
): UseTopicMessageBrowserReturn {
  const dispatch = deps?.dispatch ?? dispatchKafkaOperation;

  const [draft, setDraftState] = useState<TopicMessageBrowserDraft>(makeDefaultDraft);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KafkaConsumeResultRow[] | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<KafkaUiSafeError | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<KafkaConsumeCursor[] | null>(null);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const prevTopicRef = useRef(topicName);

  useEffect(() => {
    if (prevTopicRef.current !== topicName) {
      prevTopicRef.current = topicName;
      setResult(null);
      setError(null);
      setTimedOut(false);
      setSelectedIndex(null);
    }
  }, [topicName]);

  const setDraft = useCallback((patch: Partial<TopicMessageBrowserDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const buildBody = useCallback((seekOffsets?: KafkaConsumeCursor[]) => {
    const fromBeginning = draft.timeWindow === 'earliest' || draft.timeWindow === 'last-1h' || draft.timeWindow === 'last-24h';
    const filter = buildConsumeFilter({
      topic: topicName,
      groupId: draft.groupId,
      startPosition: fromBeginning ? 'earliest' : 'latest',
      timeoutMs: draft.timeoutMs,
      maxMessages: draft.maxMessages,
      keyEquals: draft.keyEquals,
      headerMatch: draft.headerMatch,
      jsonPath: draft.jsonPath,
      jsonPathEquals: draft.jsonPathEquals,
    });

    const body: Record<string, unknown> = {
      clusterId: kafkaState.selectedClusterId ?? '',
      topic: topicName,
      groupId: draft.groupId,
      fromBeginning,
      timeoutMs: parseInt(draft.timeoutMs, 10) || 10_000,
      maxMessages: parseInt(draft.maxMessages, 10) || 50,
    };
    if (draft.partition.trim()) body.partition = parseInt(draft.partition, 10);
    if (filter) body.filter = filter;
    if (draft.sortOrder !== 'asc') body.sortOrder = draft.sortOrder;
    if (seekOffsets && seekOffsets.length > 0) body.seekOffsets = seekOffsets;
    return body;
  }, [topicName, draft, kafkaState.selectedClusterId]);

  const consumeOnce = useCallback(async () => {
    if (!topicName.trim()) return;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    setSelectedIndex(null);
    setHasMore(false);
    setNextCursor(null);

    const body = buildBody();

    try {
      const envelope = await dispatch<{
        topic: string;
        messages: KafkaConsumeResultRow[];
        timedOut?: boolean;
        hasMore?: boolean;
        nextCursor?: KafkaConsumeCursor[];
      }>('consume-once', body);

      if (envelope.ok && envelope.data) {
        let rows = envelope.data.messages ?? [];
        if (draft.timeWindow === 'last-1h' || draft.timeWindow === 'last-24h') {
          const cutoff = Date.now() - (draft.timeWindow === 'last-1h' ? 3_600_000 : 86_400_000);
          rows = rows.filter((r) => {
            const ts = parseInt(r.timestamp ?? '0', 10);
            return ts >= cutoff;
          });
        }
        setResult(rows);
        setTimedOut(envelope.data.timedOut === true);
        setHasMore(envelope.data.hasMore ?? false);
        setNextCursor(envelope.data.nextCursor ?? null);
      }
    } catch (err) {
      setError(toKafkaUiSafeError(err, 'consume-once'));
    } finally {
      setLoading(false);
    }
  }, [topicName, draft, buildBody, dispatch]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || nextCursor.length === 0) return;
    setLoadMoreLoading(true);
    try {
      const body = buildBody(nextCursor);
      const envelope = await dispatch<{
        messages: KafkaConsumeResultRow[];
        hasMore?: boolean;
        nextCursor?: KafkaConsumeCursor[];
      }>('consume-once', body);
      if (envelope.ok && envelope.data) {
        setResult((prev) =>
          prev ? [...prev, ...envelope.data!.messages] : envelope.data!.messages,
        );
        setHasMore(envelope.data.hasMore ?? false);
        setNextCursor(envelope.data.nextCursor ?? null);
      }
    } catch (err) {
      setError(toKafkaUiSafeError(err, 'consume-once'));
    } finally {
      setLoadMoreLoading(false);
    }
  }, [nextCursor, buildBody, dispatch]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setTimedOut(false);
    setSelectedIndex(null);
    setHasMore(false);
    setNextCursor(null);
  }, []);

  const selectMessage = useCallback((index: number | null) => {
    setSelectedIndex(index);
  }, []);

  const selectedMessage = selectedIndex !== null && result ? result[selectedIndex] ?? null : null;
  const messageCount = result?.length ?? 0;

  return {
    draft, setDraft,
    loading, result, timedOut, messageCount,
    error,
    selectedIndex, selectedMessage, selectMessage,
    consumeOnce, clearResult,
    hasMore, loadMore, loadMoreLoading,
  };
}
