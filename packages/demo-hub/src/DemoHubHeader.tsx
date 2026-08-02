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
  const categoryMeta = lesson?.category && domain?.categories
    ? domain.categories.find(c => c.id === lesson.category)
    : undefined;
  const showLessonCrumb = !!lesson && (view === 'concept' || view === 'live');
  const showCategoryCrumb = showLessonCrumb && !!categoryMeta;

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
        {showCategoryCrumb && categoryMeta && (
          <>
            <span className="demo-hub-breadcrumb-sep">›</span>
            <button
              className="demo-hub-breadcrumb-item"
              onClick={onBack}
              aria-label={`Category ${categoryMeta.label}`}
            >
              {categoryMeta.icon} {categoryMeta.label}
            </button>
          </>
        )}
        {showLessonCrumb && (
          <>
            <span className="demo-hub-breadcrumb-sep">›</span>
            <span className="demo-hub-breadcrumb-item active">
              {lesson!.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
