import { useState, useEffect, useMemo, useRef } from 'react';
import type { WorkflowNodeType } from '../../types/workflow';

interface CommandItem {
  id: string;
  group: string;
  icon: string;
  title: string;
  description: string;
  shortcut?: string;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: {
    onSave: () => void;
    onQuickTest: () => void;
    onDebugTest: () => void;
    onToggleConsole: () => void;
    onAutoLayout: () => void;
    onFitView: () => void;
    onToggleMinimap: () => void;
    onOpenServices: () => void;
    onOpenDefaults: () => void;
    onAddNode: (type: WorkflowNodeType) => void;
    onOpenShortcuts: () => void;
  };
}

export default function WorkflowCommandPalette({ open, onClose, actions }: Props) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => [
    // Actions
    { id: 'save', group: 'Actions', icon: '💾', title: 'Save Workflow', description: 'Save current workflow', shortcut: '⌘S', action: actions.onSave },
    { id: 'quick-test', group: 'Actions', icon: '▶', title: 'Run Quick Test', description: 'Execute all workflow steps', shortcut: '⌘↵', action: actions.onQuickTest },
    { id: 'debug-test', group: 'Actions', icon: '🐛', title: 'Run Debug Test', description: 'Step-by-step debugging', shortcut: '⌘⇧↵', action: actions.onDebugTest },
    { id: 'auto-layout', group: 'Actions', icon: '⊞', title: 'Auto Layout', description: 'Arrange nodes automatically', shortcut: '⌘L', action: actions.onAutoLayout },
    { id: 'fit-view', group: 'Actions', icon: '⊡', title: 'Fit to View', description: 'Zoom to fit all nodes', shortcut: '⌘0', action: actions.onFitView },
    { id: 'minimap', group: 'Actions', icon: '◫', title: 'Toggle Minimap', description: 'Show or hide minimap', shortcut: '⌘M', action: actions.onToggleMinimap },
    { id: 'shortcuts', group: 'Actions', icon: '⌨', title: 'Keyboard Shortcuts', description: 'View all shortcuts', shortcut: '?', action: actions.onOpenShortcuts },
    // Navigate
    { id: 'services', group: 'Navigate', icon: '🔗', title: 'Open Service Registry', description: 'Manage hosts and auth', action: actions.onOpenServices },
    { id: 'variables', group: 'Navigate', icon: '{}', title: 'Open Variables', description: 'Workflow default variables', action: actions.onOpenDefaults },
    { id: 'console', group: 'Navigate', icon: '🖥', title: 'Toggle Console', description: 'Show or hide console panel', shortcut: '⌘J', action: actions.onToggleConsole },
    // Add node
    { id: 'add-http', group: 'Add Node', icon: '⚡', title: 'Add HTTP Request', description: 'Add an HTTP step to the canvas', action: () => actions.onAddNode('http') },
    { id: 'add-condition', group: 'Add Node', icon: '◇', title: 'Add Condition', description: 'Add if/else branching', action: () => actions.onAddNode('condition') },
    { id: 'add-delay', group: 'Add Node', icon: '⏱', title: 'Add Delay', description: 'Add a pause between steps', action: () => actions.onAddNode('delay') },
    { id: 'add-loop', group: 'Add Node', icon: '🔁', title: 'Add Loop', description: 'Add repeat / for-each / while', action: () => actions.onAddNode('loop') },
    { id: 'add-switch', group: 'Add Node', icon: '⑂', title: 'Add Switch', description: 'Add multi-way branching', action: () => actions.onAddNode('switch') },
    { id: 'add-setvar', group: 'Add Node', icon: '📝', title: 'Add Set Variable', description: 'Assign or transform variables', action: () => actions.onAddNode('setVariable') },
    { id: 'add-fork', group: 'Add Node', icon: '⑃', title: 'Add Parallel Fork', description: 'Add concurrent branches', action: () => actions.onAddNode('fork') },
    { id: 'add-join', group: 'Add Node', icon: '⑄', title: 'Add Join', description: 'Wait for all branches', action: () => actions.onAddNode('join') },
  ], [actions]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.trim().toLowerCase();
    return commands.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [query, commands]);

  useEffect(() => { setActiveIndex(0); }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        filtered[activeIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, activeIndex, onClose]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((c) => c.group))];

  let itemIndex = 0;

  return (
    <>
      <div className="wf-cmd-backdrop" onClick={onClose} role="presentation" />
      <div className="wf-cmd-palette" role="dialog" aria-label="Command palette">
        <div className="wf-cmd-input-wrap">
          <svg className="wf-cmd-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="wf-cmd-input"
            type="text"
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="wf-cmd-results">
          {groups.map((group) => {
            const items = filtered.filter((c) => c.group === group);
            return (
              <div key={group}>
                <div className="wf-cmd-group-title">{group}</div>
                {items.map((cmd) => {
                  const idx = itemIndex++;
                  return (
                    <button
                      key={cmd.id}
                      className={`wf-cmd-item ${idx === activeIndex ? 'wf-cmd-item-active' : ''}`}
                      onClick={() => { cmd.action(); onClose(); }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      type="button"
                    >
                      <span className="wf-cmd-item-icon">{cmd.icon}</span>
                      <div className="wf-cmd-item-body">
                        <div className="wf-cmd-item-title">{cmd.title}</div>
                        <div className="wf-cmd-item-desc">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <span className="wf-cmd-item-shortcut">{cmd.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="wf-cmd-empty">No matching commands</div>
          )}
        </div>
        <div className="wf-cmd-footer">
          <span className="wf-cmd-footer-hint"><kbd className="wf-kbd-key" style={{ fontSize: '9px' }}>↑↓</kbd> Navigate</span>
          <span className="wf-cmd-footer-hint"><kbd className="wf-kbd-key" style={{ fontSize: '9px' }}>↵</kbd> Select</span>
          <span className="wf-cmd-footer-hint"><kbd className="wf-kbd-key" style={{ fontSize: '9px' }}>ESC</kbd> Close</span>
        </div>
      </div>
    </>
  );
}
