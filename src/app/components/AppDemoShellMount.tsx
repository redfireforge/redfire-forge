import { Suspense, lazy } from 'react';
import type { DemoShellHostProps } from '../demo/DemoShellHost';

const DemoShellHost = lazy(() =>
  import('../demo/DemoShellHost').then((m) => ({ default: m.DemoShellHost })),
);

interface Props extends DemoShellHostProps {
  enabled: boolean;
}

export default function AppDemoShellMount({ enabled, ...props }: Props) {
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <DemoShellHost {...props} />
    </Suspense>
  );
}
