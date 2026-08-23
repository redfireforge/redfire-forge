import type { LoadProfileConfig } from '@shared/types';
import { getTargetConcurrency } from '../../../engine/executor';

export function ProfilePreview({ profile }: { profile: LoadProfileConfig }) {
  const w = 220;
  const h = 120;
  const pad = 6;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const maxC = Math.max(profile.maxConcurrency, profile.spikeConcurrency ?? 0, 1);

  const points: string[] = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * profile.durationSec * 1000;
    const c = getTargetConcurrency(profile, t);
    const x = pad + (i / steps) * innerW;
    const y = pad + innerH - (c / maxC) * innerH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const baseY = pad + innerH;
  const polyPoints = `${pad},${baseY} ${points.join(' ')} ${pad + innerW},${baseY}`;

  return (
    <svg className="profile-preview-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <polygon points={polyPoints} />
      <polyline points={points.join(' ')} fill="none" strokeWidth="2" />
      <text x={pad} y={h - 1} className="profile-preview-label">
        {profile.durationSec}s
      </text>
      <text x={w - pad} y={pad + 9} textAnchor="end" className="profile-preview-label">
        {maxC}
      </text>
    </svg>
  );
}
