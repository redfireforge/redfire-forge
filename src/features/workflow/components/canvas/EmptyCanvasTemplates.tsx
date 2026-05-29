/**
 * Template suggestions overlay for empty workflow canvas.
 * Shows curated starter workflows below the "Drop your first node" message.
 */
import { emptyCanvasTemplates, type EmptyCanvasTemplate } from '../../data/emptyCanvasTemplates';

interface Props {
  onSelectTemplate: (template: EmptyCanvasTemplate) => void;
  onBrowseGallery: () => void;
}

export default function EmptyCanvasTemplates({ onSelectTemplate, onBrowseGallery }: Props) {
  if (emptyCanvasTemplates.length === 0) return null;

  return (
    <div className="wf-empty-templates">
      <div className="wf-empty-templates-divider">
        <span>or start from a template</span>
      </div>
      <div className="wf-empty-templates-grid">
        {emptyCanvasTemplates.map(template => (
          <button
            key={template.id}
            className="wf-empty-template-card"
            onClick={() => onSelectTemplate(template)}
            title={`${template.description} (${template.nodeCount} nodes)`}
          >
            <span className="wf-empty-template-icon">{template.icon}</span>
            <span className="wf-empty-template-info">
              <span className="wf-empty-template-name">{template.name}</span>
              <span className="wf-empty-template-meta">
                {template.nodeCount} nodes · {template.difficulty}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button className="wf-empty-browse-link" onClick={onBrowseGallery}>
        Browse All Templates →
      </button>
    </div>
  );
}
