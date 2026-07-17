/** Shared helpers for GraphQL Studio demo lessons — backward-compatible barrel. */
export * from './gql-demo-core/constants';
export * from './gql-demo-core/sessionFlags';
export * from './gql-demo-core/endpoint';
export * from './gql-demo-core/monaco';
export * from './gql-demo-core/schema';
export * from './gql-demo-core/response';
export * from './gql-demo-core/setup';

export {
  clearActiveTabAuthOverride,
  closeAuthPanelIfOpen,
  closeAuthPanelQuiet,
  configureDemoTabInheritPageAuth,
  ensureAuthPanelVisible,
  isAuthEditorOpen,
  openAuthPanel,
  openAuthPanelQuiet,
  selectAuthInPanel,
  selectNoAuthInPanel,
  waitForAuthTypeFields,
  type GqlAuthPanelType,
} from './gqlLessonAuthPanel';
