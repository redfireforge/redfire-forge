import { lazy } from 'react';

/** Dev-only lazy panel; null in production builds. */
export const RustExecutorTestPanel = import.meta.env.DEV
  ? lazy(() => import('../features/test-runner/components/RustExecutorTestPanel'))
  : null;
