import { v4 as uuidv4 } from 'uuid';
import type { ResponseVersion, RulesVersion, Scenario } from '@shared/types';

type Validation = Scenario['validation'];

/** Create a ResponseVersion snapshot from the current validation state. */
export function createResponseVersion(v: Validation, json: string): ResponseVersion {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    json,
    validationMode: v.mode,
    selectiveMode: v.selectiveMode,
    expectedFields: v.expectedFields ? [...v.expectedFields] : [],
    excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
    unorderedArrays: v.unorderedArrays,
  };
}

/** Create a RulesVersion snapshot from the current validation state. */
export function createRulesVersion(v: Validation): RulesVersion {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    validationMode: v.mode,
    selectiveMode: v.selectiveMode,
    expectedFields: v.expectedFields ? [...v.expectedFields] : [],
    excludedPaths: v.excludedPaths ? [...v.excludedPaths] : [],
    unorderedArrays: v.unorderedArrays,
    assertions: v.assertions ? structuredClone(v.assertions) : [],
  };
}
