import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkflowExecutionTrace, TestRun } from '../../../shared/types';
import { validateTrace } from '../../../shared/utils/traceCompression';
import { validateImportedRun } from '../utils/importRun';
import { saveTestRun, loadTestRunsLite } from '../../../shared/utils/storage';

export function useImportHandlers(
  setAllRuns: React.Dispatch<React.SetStateAction<TestRun[]>>,
  setSelectedRunId: React.Dispatch<React.SetStateAction<string>>,
) {
  const importFileRef = useRef<HTMLInputElement>(null);
  const importRunFileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [replayTrace, setReplayTrace] = useState<WorkflowExecutionTrace | null>(null);

  // Auto-dismiss import error after 6 seconds
  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), 6000);
    return () => clearTimeout(timer);
  }, [importError]);

  const handleImportTrace = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const trace = validateTrace(data);
        setReplayTrace(trace);
        setImportedFileName(file.name);
        setShowReplayModal(true);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse trace file');
      }
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleImportRun = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = validateImportedRun(data);
      if (!result.valid) {
        setImportError(`Import failed: ${result.error}`);
        return;
      }
      const { ok, quotaError } = await saveTestRun(result.run);
      if (!ok) {
        setImportError(quotaError ? 'Storage quota exceeded — delete old runs first' : 'Failed to save imported run');
        return;
      }
      const fresh = await loadTestRunsLite();
      setAllRuns(fresh);
      setSelectedRunId(result.run.id);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse run file');
    }
    e.target.value = '';
  }, [setAllRuns, setSelectedRunId]);

  const closeReplayModal = useCallback(() => {
    setShowReplayModal(false);
    setReplayTrace(null);
    setImportedFileName(null);
  }, []);

  return {
    importFileRef,
    importRunFileRef,
    importError,
    setImportError,
    importedFileName,
    showReplayModal,
    setShowReplayModal,
    replayTrace,
    setReplayTrace,
    handleImportTrace,
    handleImportRun,
    closeReplayModal,
  };
}
