import { beforeEach } from 'vitest';
import { resetGrpcMockBuilderNodeIdsForTests } from '../grpcMockRuleBuilderModel';

export function setupGrpcMockRuleBuilderModelCoverageGapsTest(): void {
  beforeEach(() => {
    resetGrpcMockBuilderNodeIdsForTests();
  });
}
