import RunnerPage, { type RunnerPageProps } from './components/RunnerPage';
import { STANDARD_VARIANT } from './components/runnerVariants';

export default function TestRunner(props: RunnerPageProps) {
  return <RunnerPage variant={STANDARD_VARIANT} {...props} />;
}
