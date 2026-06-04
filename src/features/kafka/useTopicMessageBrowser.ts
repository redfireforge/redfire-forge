import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dispatchKafkaOperation,
  toKafkaUiSafeError,
  type KafkaUiSafeError,
} from '../../shared/kafka/kafkaClient';
import type { UseKafkaStateReturn } from '../../app/hooks/useKafkaState';
import type { KafkaConsumeResultRow } from './types';
import { buildConsumeFilter } from './kafkaMessageStudioUtils';

export type TimeWindow = 'latest' | 'last-1h' | 'last-24h' | 'earliest';

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

  const consumeOnce = useCallback(async () => {
    if (!topicName.trim()) return;
    setLoading(true);
    setError(null);
    setTimedOut(false);
    setSelectedIndex(null);

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

    try {
      const envelope = await dispatch<{
        topic: string;
        messages: KafkaConsumeResultRow[];
        timedOut?: boolean;
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
      }
    } catch (err) {
      setError(toKafkaUiSafeError(err, 'consume-once'));
    } finally {
      setLoading(false);
    }
  }, [topicName, draft, kafkaState.selectedClusterId, dispatch]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setTimedOut(false);
    setSelectedIndex(null);
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
  };
}
