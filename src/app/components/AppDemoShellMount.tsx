import { Suspense, lazy } from 'react';
import type { DemoShellHostProps } from '../demo/DemoShellHost';

// Use import.meta.env directly so Vite substitutes the value at build time and
// Rolldown can eliminate the dead branch (and the 3 MB DemoShellHost chunk)
// in the prod-slim build (VITE_ENABLE_DEMO_HUB=false).
const DemoShellHost =
  import.meta.env.VITE_ENABLE_DEMO_HUB === 'true'
    ? lazy(() =>
        import('../demo/DemoShellHost').then((m) => ({ default: m.DemoShellHost })),
      )
    : null;

interface Props extends DemoShellHostProps {
  enabled: boolean;
}

export default function AppDemoShellMount({ enabled, ...props }: Props) {
  if (!enabled || !DemoShellHost) return null;
  return (
    <Suspense fallback={null}>
      <DemoShellHost {...props} />
    </Suspense>
  );
}
