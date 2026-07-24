import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Workflow } from '../types/workflow';
import type { ToastApi } from '../components/WorkflowToastProvider';

interface UseWorkflowKeyboardShortcutsOptions {
  selected: Workflow | null;
  previewWorkflow: Workflow | null;
  persistWorkflow: () => void;
  handleToggleConsole: () => void;
  handleUndoAction: () => void;
  handleRedoAction: () => void;
  handleCopyNode: () => void;
  handlePasteNode: () => void;
  handleDuplicateNode: () => void;
  handleQuickTestRef: React.RefObject<() => void>;
  handleDebugQuickTestRef: React.RefObject<() => void>;
  handleAutoLayout: () => void;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCommandPalette: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMinimap: React.Dispatch<React.SetStateAction<boolean>>;
  toast: ToastApi;
}

export function useWorkflowKeyboardShortcuts({
  selected,
  previewWorkflow,
  persistWorkflow,
  handleToggleConsole,
  handleUndoAction,
  handleRedoAction,
  handleCopyNode,
  handlePasteNode,
  handleDuplicateNode,
  handleQuickTestRef,
  handleDebugQuickTestRef,
  handleAutoLayout,
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
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        || !!target.closest?.('.monaco-editor');

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
            handleAutoLayout();
          }
          break;
        case 'm':
          if (!isInput) { e.preventDefault(); setShowMinimap((v) => !v); }
          break;
        case '0':
          if (!isInput) { e.preventDefault(); rfInstance.fitView({ padding: 0.15, minZoom: 0.4, duration: 300 }); }
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
  }, [selected, previewWorkflow, persistWorkflow, toast, handleToggleConsole, handleUndoAction, handleRedoAction, handleCopyNode, handlePasteNode, handleDuplicateNode, rfInstance, setShowShortcuts, setShowCommandPalette, setShowMinimap, handleQuickTestRef, handleDebugQuickTestRef, handleAutoLayout]);
}
