interface Props {
  manualTitle: string;
  pathName: string;
  phaseName: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  manualPath: string;
  onContinue?: () => void;
}

export function ContinueLearningCard({
  manualTitle,
  pathName,
  phaseName,
  difficulty,
  manualPath,
  onContinue,
}: Props) {
  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      window.open(`/docs/training-manuals/${manualPath}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className="training-continue">
      <div className="training-continue-icon">🔥</div>
      <div className="training-continue-info">
        <div className="training-continue-label">CONTINUE LEARNING</div>
        <div className="training-continue-title">{manualTitle}</div>
        <div className="training-continue-meta">
          {pathName} → {phaseName} • {difficulty} difficulty
        </div>
      </div>
      <button className="training-continue-btn" onClick={handleContinue}>
        Continue →
      </button>
    </section>
  );
}
