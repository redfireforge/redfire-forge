import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type { Workflow } from '../types/workflow';
import type { ToastApi } from '../components/WorkflowToastProvider';
import { getAutoLayoutNodes } from '../utils/workflowAutoLayout';

interface UseWorkflowKeyboardShortcutsOptions {
  selected: Workflow | null;
  previewWorkflow: Workflow | null;
  nodesRef: React.RefObject<WorkflowRFNode[]>;
  edgesRef: React.RefObject<WorkflowRFEdge[]>;
  setNodes: React.Dispatch<React.SetStateAction<WorkflowRFNode[]>>;
  setLayoutVersion: React.Dispatch<React.SetStateAction<number>>;
  persistWorkflow: () => void;
  handleToggleConsole: () => void;
  handleUndoAction: () => void;
  handleRedoAction: () => void;
  handleCopyNode: () => void;
  handlePasteNode: () => void;
  handleDuplicateNode: () => void;
  handleQuickTestRef: React.RefObject<() => void>;
  handleDebugQuickTestRef: React.RefObject<() => void>;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>;
  toast: ToastApi;
}

export function useWorkflowKeyboardShortcuts({
  selected,
  previewWorkflow,
  nodesRef,
  edgesRef,
  setNodes,
  setLayoutVersion,
  persistWorkflow,
  handleToggleConsole,
  handleUndoAction,
  handleRedoAction,
  handleCopyNode,
  handlePasteNode,
  handleDuplicateNode,
  handleQuickTestRef,
  handleDebugQuickTestRef,
  setShowShortcuts,
  setShowCommandPalette,
  setShowMinimap,
  toast,
}: UseWorkflowKeyboardShortcutsOptions) {
  const rfInstance = useReactFlow();

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '?' && !mod && !isInput) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (!previewWorkflow) {
            persistWorkflow();
            toast.show('success', 'Workflow saved');
          }
          break;
        case 'k':
          e.preventDefault();
          setShowCommandPalette((v) => !v);
          break;
        case 'j':
          e.preventDefault();
          handleToggleConsole();
          break;
        case 'enter':
          e.preventDefault();
          if (e.shiftKey) handleDebugQuickTestRef.current();
          else handleQuickTestRef.current();
          break;
        case 'l':
          if (!isInput) {
            e.preventDefault();
            const laid = getAutoLayoutNodes(nodesRef.current as WorkflowRFNode[], edgesRef.current as WorkflowRFEdge[]);
            setNodes(laid);
            setLayoutVersion((v) => v + 1);
          }
          break;
        case 'm':
          if (!isInput) { e.preventDefault(); setShowMinimap((v) => !v); }
          break;
        case '0':
          if (!isInput) { e.preventDefault(); rfInstance.fitView({ padding: 0.2, duration: 300 }); }
          break;
        case 'z':
          if (!isInput) {
            e.preventDefault();
            if (e.shiftKey) handleRedoAction();
            else handleUndoAction();
          }
          break;
        case 'c':
          if (!isInput) { e.preventDefault(); handleCopyNode(); }
          break;
        case 'v':
          if (!isInput) { e.preventDefault(); handlePasteNode(); }
          break;
        case 'd':
          if (!isInput) { e.preventDefault(); handleDuplicateNode(); }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, previewWorkflow, persistWorkflow, toast, handleToggleConsole, handleUndoAction, handleRedoAction, handleCopyNode, handlePasteNode, handleDuplicateNode, rfInstance, setNodes, nodesRef, edgesRef, setLayoutVersion, setShowShortcuts, setShowCommandPalette, setShowMinimap, handleQuickTestRef, handleDebugQuickTestRef]);
}
