import type { TrainingPath } from './types';
import { coreTrainingPaths } from './trainingPathsCore';
import { advancedTrainingPaths } from './trainingPathsAdvanced';

/** Content training paths: Requests, Tests, API Catalog, Data Mapper, Environments, Results, API Mock, Kafka Protocols, Gallery. */
export const contentPaths: TrainingPath[] = [
  ...coreTrainingPaths,
  ...advancedTrainingPaths,
];
