import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { saveJsonFile, saveCsvFile, savePngFile, saveSvgFile, buildExportFilename } from '../../../shared/utils/fileSaver';
import type { CanvasScreenshotFn, CanvasSvgFn } from '../components/WorkflowExecutionCanvas';

type ReplaySnapshotNode = {
  id: string;
  type?: string;
  data?: { label?: string; name?: string };
};

function buildDateStamp(trace: WorkflowExecutionTrace): string {
  return new Date(trace.iterations[0]?.events[0]?.timestamp || Date.now())
    .toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function useExplorerExport(currentTrace: WorkflowExecutionTrace) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [screenshotBusy, setScreenshotBusy] = useState(false);
  const screenshotFnRef = useRef<CanvasScreenshotFn | null>(null);

  const [svgBusy, setSvgBusy] = useState(false);
  const svgFnRef = useRef<CanvasSvgFn | null>(null);

  const exportBusy = screenshotBusy || svgBusy;

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  const handleScreenshotReady = useCallback((fn: CanvasScreenshotFn) => {
    screenshotFnRef.current = fn;
  }, []);

  const handleSvgReady = useCallback((fn: CanvasSvgFn) => {
    svgFnRef.current = fn;
  }, []);

  const handleExportTrace = useCallback(() => {
    const date = buildDateStamp(currentTrace);
    const filename = buildExportFilename({ level: 'trace', name: currentTrace.workflowName, date });
    saveJsonFile(currentTrace, filename);
  }, [currentTrace]);

  const handleExportCsv = useCallback(() => {
    const httpNodes = (currentTrace.workflowSnapshot.nodes as ReplaySnapshotNode[]).filter(
      (n) => n.type === 'http',
    );
    const rows: string[][] = [];
    rows.push(['Node', 'Executions', 'Pass Rate (%)', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'P95 (ms)']);

    for (const node of httpNodes) {
      const durations: number[] = [];
      let passCount = 0;
      let totalCount = 0;
      for (const iter of currentTrace.iterations) {
        for (const ev of iter.events) {
          if (ev.nodeId !== node.id) continue;
          totalCount++;
          if (ev.state === 'pass') passCount++;
          if (ev.durationMs !== undefined) durations.push(ev.durationMs);
        }
      }
      if (totalCount === 0) continue;
      durations.sort((a, b) => a - b);
      const avg = durations.length > 0
        ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length * 100) / 100
        : 0;
      const min = durations.length > 0 ? Math.round(durations[0] * 100) / 100 : 0;
      const max = durations.length > 0 ? Math.round(durations[durations.length - 1] * 100) / 100 : 0;
      const p95Idx = Math.min(Math.ceil(durations.length * 0.95) - 1, durations.length - 1);
      const p95 = durations.length > 0 ? Math.round(durations[Math.max(0, p95Idx)] * 100) / 100 : 0;
      const passRate = Math.round(passCount / totalCount * 10000) / 100;
      const label = node.data?.label || node.data?.name || node.id;
      rows.push([label, String(totalCount), String(passRate), String(avg), String(min), String(max), String(p95)]);
    }

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const date = buildDateStamp(currentTrace);
    const filename = buildExportFilename({ level: 'metrics', name: currentTrace.workflowName, date, ext: 'csv' });
    saveCsvFile(csv, filename);
  }, [currentTrace]);

  const handleExportPng = useCallback(async () => {
    if (!screenshotFnRef.current || screenshotBusy) return;
    setScreenshotBusy(true);
    try {
      const dataUrl = await screenshotFnRef.current();
      const date = buildDateStamp(currentTrace);
      const filename = buildExportFilename({ level: 'screenshot', name: currentTrace.workflowName, date, ext: 'png' });
      await savePngFile(dataUrl, filename);
    } catch {
      // capture may fail in some environments (e.g. cross-origin)
    } finally {
      setScreenshotBusy(false);
    }
  }, [currentTrace, screenshotBusy]);

  const handleExportSvg = useCallback(async () => {
    if (!svgFnRef.current || svgBusy) return;
    setSvgBusy(true);
    try {
      const dataUrl = await svgFnRef.current();
      const date = buildDateStamp(currentTrace);
      const filename = buildExportFilename({ level: 'diagram', name: currentTrace.workflowName, date, ext: 'svg' });
      await saveSvgFile(dataUrl, filename);
    } catch {
      // capture may fail in some environments (e.g. cross-origin)
    } finally {
      setSvgBusy(false);
    }
  }, [currentTrace, svgBusy]);

  return {
    exportMenuOpen,
    setExportMenuOpen,
    exportMenuRef,
    exportBusy,
    screenshotBusy,
    svgBusy,
    handleScreenshotReady,
    handleSvgReady,
    handleExportTrace,
    handleExportCsv,
    handleExportPng,
    handleExportSvg,
  };
}
