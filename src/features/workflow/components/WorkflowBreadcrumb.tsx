export interface BreadcrumbItem {
  id: string;
  name: string;
}

interface Props {
  stack: BreadcrumbItem[];
  currentName: string;
  onNavigate: (index: number) => void;
}

export default function WorkflowBreadcrumb({ stack, currentName, onNavigate }: Props) {
  if (stack.length === 0) return null;

  return (
    <div className="wf-breadcrumb">
      {stack.map((item, i) => (
        <span key={item.id}>
          <button
            type="button"
            className="wf-breadcrumb-link"
            onClick={() => onNavigate(i)}
            title={`Navigate to ${item.name}`}
          >
            {item.name}
          </button>
          <span className="wf-breadcrumb-sep">›</span>
        </span>
      ))}
      <span className="wf-breadcrumb-current">{currentName}</span>
    </div>
  );
}
