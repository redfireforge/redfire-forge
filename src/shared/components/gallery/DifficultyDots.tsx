import type { GalleryDifficulty } from '../../../data/galleries/types';

interface DifficultyDotsProps {
  level: GalleryDifficulty;
  showLabel?: boolean;
  className?: string;
}

/**
 * ● ●● ●●● difficulty indicator.
 * Renders 3 dots, coloring 1/2/3 based on easy/medium/advanced.
 */
export function DifficultyDots({ level, showLabel = true, className = '' }: DifficultyDotsProps) {
  return (
    <span className={`gallery-difficulty ${className}`.trim()}>
      <span className="gallery-difficulty-dots" data-level={level}>
        <span className="gallery-dot" />
        <span className="gallery-dot" />
        <span className="gallery-dot" />
      </span>
      {showLabel && <span className="gallery-difficulty-label">{level}</span>}
    </span>
  );
}
