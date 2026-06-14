/** Demo Hub Header — breadcrumb navigation */
import type { HubView, DemoDomain, DemoLesson } from './types';

interface DemoHubHeaderProps {
  view: HubView;
  domain: DemoDomain | null;
  lesson: DemoLesson | null;
  onBack: () => void;
  onClose?: () => void;
}

export default function DemoHubHeader({ view, domain, lesson, onBack }: DemoHubHeaderProps) {
  return (
    <div className="demo-hub-header">
      <div className="demo-hub-breadcrumb">
        <button
          className="demo-hub-breadcrumb-item"
          onClick={view !== 'domains' ? onBack : undefined}
          disabled={view === 'domains'}
        >
          🎓 Learning Hub
        </button>
        {domain && (
          <>
            <span className="demo-hub-breadcrumb-sep">›</span>
            <button
              className="demo-hub-breadcrumb-item"
              onClick={view !== 'lessons' ? onBack : undefined}
              disabled={view === 'lessons'}
            >
              {domain.icon} {domain.name}
            </button>
          </>
        )}
        {lesson && (
          <>
            <span className="demo-hub-breadcrumb-sep">›</span>
            <span className="demo-hub-breadcrumb-item active">
              {lesson.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
