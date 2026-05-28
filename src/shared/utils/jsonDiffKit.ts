import { Differ } from 'json-diff-kit';

export const sharedDiffer = new Differ({ detectCircular: false, arrayDiffMethod: 'lcs' });
