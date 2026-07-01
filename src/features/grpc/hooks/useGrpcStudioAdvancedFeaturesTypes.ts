import type { UseGrpcStudioReturn } from './useGrpcStudio';

export type StudioSlice = Pick<
  UseGrpcStudioReturn,
  | 'activeTab'
  | 'activeTabDescriptor'
  | 'activeTabId'
  | 'tabs'
  | 'prepareExecuteSnapshot'
  | 'profiles'
>;
