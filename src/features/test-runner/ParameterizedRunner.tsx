import RunnerPage, { type RunnerPageProps } from './components/RunnerPage';
import { PARAMETERIZED_VARIANT } from './components/runnerVariants';

export default function ParameterizedRunner(props: RunnerPageProps) {
  return <RunnerPage variant={PARAMETERIZED_VARIANT} {...props} />;
}
