import { lazy, Suspense } from 'react';
import { DEMO_HUB_ENABLED } from '../../../config/features';
import type { DemoGqlStudioBridgesProps } from '../DemoGqlStudioBridges';

const LazyDemoGqlStudioBridges = DEMO_HUB_ENABLED
  ? lazy(() => import('../DemoGqlStudioBridges'))
  : null;

export function GraphqlStudioDemoBridges(props: DemoGqlStudioBridgesProps) {
  if (!LazyDemoGqlStudioBridges) return null;
  return (
    <Suspense fallback={null}>
      <LazyDemoGqlStudioBridges {...props} />
    </Suspense>
  );
}
