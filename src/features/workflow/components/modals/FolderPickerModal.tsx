import { useState, useCallback, useMemo } from 'react';
import type { WorkflowFolder } from '../../types/workflow';
import { buildFolderTree, type FolderTreeNode } from '../../utils/workflowFolderTree';

interface Props {
  open: boolean;
  folders: WorkflowFolder[];
  title?: string;
  onPick: (folderId: string | null) => void;
  onCancel: () => void;
}

export default function FolderPickerModal({ open, folders, title = 'Choose Destination Folder', onPick, onCancel }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const tree = useMemo(() => buildFolderTree(folders), [folders]);

  const handleConfirm = useCallback(() => {
    onPick(selected);
  }, [selected, onPick]);

  if (!open) return null;

  return (
    <div className="fp-backdrop" onClick={onCancel}>
      <div className="fp-dialog" onClick={e => e.stopPropagation()}>
        <div className="fp-header">
          <h3 className="fp-title">{title}</h3>
          <button className="fp-close" onClick={onCancel} aria-label="Close">&times;</button>
        </div>
        <div className="fp-body">
          <button
            className={`fp-row fp-row-root${selected === null ? ' fp-row-selected' : ''}`}
            onClick={() => setSelected(null)}
            type="button"
          >
            <span className="fp-row-icon">📂</span>
            <span className="fp-row-label">Workflows (root)</span>
          </button>
          {tree.map(node => (
            <FolderNode key={node.folder.id} node={node} depth={1} selected={selected} onSelect={setSelected} />
          ))}
        </div>
        <div className="fp-footer">
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={handleConfirm}>
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderNode({ node, depth, selected, onSelect }: { node: FolderTreeNode; depth: number; selected: string | null; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <button
        className={`fp-row${selected === node.folder.id ? ' fp-row-selected' : ''}`}
        style={{ paddingLeft: depth * 20 + 8 }}
        onClick={() => onSelect(node.folder.id)}
        type="button"
      >
        {hasChildren && (
          <span
            className={`fp-row-expand${expanded ? ' fp-row-expand-open' : ''}`}
            onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
          >▶</span>
        )}
        <span className="fp-row-icon">📁</span>
        <span className="fp-row-label">{node.folder.name}</span>
      </button>
      {expanded && node.children.map(child => (
        <FolderNode key={child.folder.id} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}
