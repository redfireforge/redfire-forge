import type { FeatureGroup } from '../../../shared/types';

export interface RunnerVariant {
  title: string;
  kind: 'standard' | 'parameterized';
  namePrefix: string;
  runButtonLabel: string;
  hasContent: (featureGroups: FeatureGroup[]) => boolean;
  emptyMessage: string;
}

export const STANDARD_VARIANT: RunnerVariant = {
  title: 'Test Runner',
  kind: 'standard',
  namePrefix: 'test-runner',
  runButtonLabel: '▶ Run Test',
  hasContent: (fgs) => fgs.some((fg) => fg.scenarios.some((sc) => sc.tests.length > 0)),
  emptyMessage: 'No tests defined. Go to Feature Groups tab to add some first.',
};

export const PARAMETERIZED_VARIANT: RunnerVariant = {
  title: 'Parameterized Runner',
  kind: 'parameterized',
  namePrefix: 'param-runner',
  runButtonLabel: '▶ Run Parameterized Test',
  hasContent: (fgs) => fgs.some((fg) => fg.scenarios.some((sc) => sc.kind === 'parameterized' && sc.tests.length > 0)),
  emptyMessage: 'No parameterized scenarios defined. Go to Feature Groups tab and create a parameterized scenario with data sources.',
};
