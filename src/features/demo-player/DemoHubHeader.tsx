/** Demo Hub Header — breadcrumb navigation */
import type { HubView, DemoDomain, DemoLesson } from './types';

interface DemoHubHeaderProps {
  view: HubView;
  domain: DemoDomain | null;
  lesson: DemoLesson | null;
  /** Go one level back (lessons → domains, concept → lessons, live → concept) */
  onBack: () => void;
  /** Jump directly to the domain selector from any view */
  onBackToDomains: () => void;
}

export default function DemoHubHeader({ view, domain, lesson, onBack, onBackToDomains }: DemoHubHeaderProps) {
  return (
    <div className="demo-hub-header">
      <div className="demo-hub-breadcrumb">
        {/* "Learning Hub" always jumps to the root domain selector */}
        <button
          className="demo-hub-breadcrumb-item"
          onClick={view !== 'domains' ? onBackToDomains : undefined}
          disabled={view === 'domains'}
        >
          🎓 Learning Hub
        </button>
        {domain && (
          <>
            <span className="demo-hub-breadcrumb-sep">›</span>
            {/* Domain name goes one level back: concept → lessons, live → concept */}
            <button
              className="demo-hub-breadcrumb-item"
              onClick={view !== 'lessons' ? onBack : undefined}
              disabled={view === 'lessons'}
            >
              {domain.icon} {domain.name}
            </button>
          </>
        )}
        {lesson && (view === 'concept' || view === 'live') && (
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
