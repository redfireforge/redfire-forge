import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { WsMockRule, WsMockFallbackMode } from '../../shared/websocket/types';
import { evaluateRules } from './wsMockRuleEngine';
import type { UseWebSocketMockServerReturn, MockServerConfig } from './useWebSocketMockServer';

type MockRightTab = 'rules' | 'log';

export interface MockUi {
  mock: UseWebSocketMockServerReturn;
  status: UseWebSocketMockServerReturn['status'];
  logs: UseWebSocketMockServerReturn['logs'];
  rules: WsMockRule[];
  config: MockServerConfig;
  starting: boolean;
  editingRuleId: string | null;
  setEditingRuleId: (id: string | null) => void;
  broadcastText: string;
  setBroadcastText: (v: string) => void;
  testInput: string;
  setTestInput: (v: string) => void;
  rightTab: MockRightTab;
  setRightTab: (t: MockRightTab) => void;
  enabledRuleCount: number;
  startedAt: number | null;
  testResult: ReturnType<typeof evaluateRules> | null;
  reversedLogs: UseWebSocketMockServerReturn['logs'];
  handleFallbackChange: (value: string) => void;
  handleStart: () => void;
  handleStop: () => void;
  handleBroadcast: () => void;
  handleAddRule: () => void;
  handleDeleteRule: (id: string) => void;
  handleToggleRule: (id: string) => void;
  handleUpdateRule: (id: string, patch: Partial<WsMockRule>) => void;
  handleMoveRule: (id: string, direction: 'up' | 'down') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredRules: WsMockRule[];
  dragRuleId: string | null;
  dragOverRuleId: string | null;
  handleDragStart: (ruleId: string) => void;
  handleDragOver: (e: DragEvent<HTMLDivElement>, ruleId: string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetRuleId: string) => void;
  handleDragEnd: () => void;
}

/** Next "Rule N" name that is not already used (does not stick after deletes). */
function nextRuleName(existing: WsMockRule[]): string {
  const used = new Set(existing.map((r) => r.name));
  let n = 1;
  while (used.has(`Rule ${n}`)) n += 1;
  return `Rule ${n}`;
}

function createEmptyRule(existing: WsMockRule[]): WsMockRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: nextRuleName(existing),
    enabled: true,
    match: { type: 'any', pattern: '' },
    response: { type: 'echo' },
  };
}

export function useMockServerUi(mock: UseWebSocketMockServerReturn): MockUi {
  const { status, logs, rules, config, starting } = mock;
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [testInput, setTestInput] = useState('');
  const [rightTab, setRightTab] = useState<MockRightTab>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragRuleId, setDragRuleId] = useState<string | null>(null);
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (status.running) {
      setStartedAt((prev) => prev ?? Date.now());
    } else {
      setStartedAt(null);
    }
  }, [status.running]);

  const handleFallbackChange = useCallback((value: string) => {
    const nextFallback = value as WsMockFallbackMode;
    mock.setConfig({ ...config, fallback: nextFallback });
    if (status.running) {
      void mock.pushRulesToServer(rules, nextFallback);
    }
  }, [mock, config, status.running, rules]);

  const handleStart = useCallback(() => {
    void (async () => {
      try {
        await mock.start();
      } catch { /* error shown via status.error */ }
    })();
  }, [mock]);

  const handleStop = useCallback(() => {
    void (async () => {
      try {
        await mock.stop();
      } catch { /* ignore */ }
    })();
  }, [mock]);

  const handleBroadcast = useCallback(() => {
    if (!broadcastText.trim()) return;
    void (async () => {
      try {
        await mock.broadcast(broadcastText);
        setBroadcastText('');
      } catch { /* ignore */ }
    })();
  }, [mock, broadcastText]);

  const updateRules = useCallback((next: WsMockRule[]) => {
    rulesRef.current = next;
    mock.setRules(next);
    if (status.running) {
      void mock.pushRulesToServer(next, config.fallback);
    }
  }, [mock, status.running, config.fallback]);

  const handleAddRule = useCallback(() => {
    const current = rulesRef.current;
    const newRule = createEmptyRule(current);
    updateRules([...current, newRule]);
    setEditingRuleId(newRule.id);
  }, [updateRules]);

  const handleDeleteRule = useCallback((id: string) => {
    const next = rulesRef.current.filter((r) => r.id !== id);
    updateRules(next);
    setEditingRuleId((prev) => (prev === id ? null : prev));
  }, [updateRules]);

  const handleToggleRule = useCallback((id: string) => {
    updateRules(rulesRef.current.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, [updateRules]);

  const handleUpdateRule = useCallback((id: string, patch: Partial<WsMockRule>) => {
    updateRules(rulesRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, [updateRules]);

  const handleMoveRule = useCallback((id: string, direction: 'up' | 'down') => {
    const current = rulesRef.current;
    const idx = current.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= current.length) return;
    const next = [...current];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    updateRules(next);
  }, [updateRules]);

  const handleDragStart = useCallback((ruleId: string) => {
    setDragRuleId(ruleId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, ruleId: string) => {
    e.preventDefault();
    setDragOverRuleId((prev) => (dragRuleId && dragRuleId !== ruleId) ? ruleId : prev);
  }, [dragRuleId]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetRuleId: string) => {
    e.preventDefault();
    if (!dragRuleId || dragRuleId === targetRuleId) {
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const next = [...rules];
    const fromIdx = next.findIndex((r) => r.id === dragRuleId);
    const toIdx = next.findIndex((r) => r.id === targetRuleId);
    if (fromIdx < 0 || toIdx < 0) {
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateRules(next);
    setDragRuleId(null);
    setDragOverRuleId(null);
  }, [dragRuleId, rules, updateRules]);

  const handleDragEnd = useCallback(() => {
    setDragRuleId(null);
    setDragOverRuleId(null);
  }, []);

  const testResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return evaluateRules(rules, testInput, config.fallback);
  }, [testInput, rules, config.fallback]);

  const reversedLogs = useMemo(() => [...logs].reverse(), [logs]);
  const enabledRuleCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.match.type.toLowerCase().includes(q) ||
      r.match.pattern.toLowerCase().includes(q) ||
      r.response.type.toLowerCase().includes(q),
    );
  }, [rules, searchQuery]);

  return {
    mock, status, logs, rules, config, starting,
    editingRuleId, setEditingRuleId,
    broadcastText, setBroadcastText,
    testInput, setTestInput,
    rightTab, setRightTab,
    enabledRuleCount, startedAt,
    testResult, reversedLogs,
    handleFallbackChange,
    handleStart, handleStop, handleBroadcast,
    handleAddRule, handleDeleteRule, handleToggleRule, handleUpdateRule, handleMoveRule,
    searchQuery, setSearchQuery, filteredRules,
    dragRuleId, dragOverRuleId, handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  };
}
