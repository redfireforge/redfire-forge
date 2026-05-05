interface Stats {
  totalCompleted: number;
  totalInProgress: number;
  totalManuals: number;
  pathsStarted: number;
  totalPaths: number;
  streak: number;
}

interface Props {
  stats: Stats;
}

export function TrainingProgressDashboard({ stats }: Props) {
  const completionPercentage = stats.totalManuals > 0
    ? Math.round((stats.totalCompleted / stats.totalManuals) * 100)
    : 0;

  return (
    <section className="training-dashboard">
      <div className="training-dashboard-card">
        <div className="training-dashboard-value training-dashboard-value-blue">
          {stats.totalCompleted}
        </div>
        <div className="training-dashboard-label">Completed</div>
        <div className="training-dashboard-sub">
          of {stats.totalManuals} manuals ({completionPercentage}%)
        </div>
      </div>

      <div className="training-dashboard-card">
        <div className="training-dashboard-value training-dashboard-value-yellow">
          {stats.totalInProgress}
        </div>
        <div className="training-dashboard-label">In Progress</div>
        <div className="training-dashboard-sub">
          {stats.totalInProgress > 0 ? 'keep going!' : 'start a manual'}
        </div>
      </div>

      <div className="training-dashboard-card">
        <div className="training-dashboard-value training-dashboard-value-green">
          {stats.pathsStarted}
        </div>
        <div className="training-dashboard-label">Paths Started</div>
        <div className="training-dashboard-sub">
          of {stats.totalPaths} total paths
        </div>
      </div>

      <div className="training-dashboard-card">
        <div className="training-dashboard-value training-dashboard-value-purple">
          🔥 {stats.streak}
        </div>
        <div className="training-dashboard-label">Day Streak</div>
        <div className="training-dashboard-sub">
          {stats.streak > 0 ? 'Keep it up!' : 'Complete a manual to start'}
        </div>
      </div>
    </section>
  );
}
