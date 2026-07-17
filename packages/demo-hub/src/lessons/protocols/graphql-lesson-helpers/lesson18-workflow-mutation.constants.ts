import { GQL } from '@shared/selectors';
import { GQL_DEMO_HTTP } from './core';

export { GQL_DEMO_HTTP };

export const LESSON18_WF_NAME = 'GraphQL User CRUD Demo';
export const LESSON18_TEST_NAME = 'Demo User';
export const LESSON18_TEST_NAME_VAR = 'testName';
export const LESSON18_CREATED_USER_ID_VAR = 'createdUserId';
export const LESSON18_FETCHED_USER_VAR = 'fetchedUser';

export const LESSON18_NODE_START = 'gql18-start';
export const LESSON18_NODE_CREATE = 'gql18-create';
export const LESSON18_NODE_FETCH = 'gql18-fetch';
export const LESSON18_NODE_ASSERT = 'gql18-assert';
export const LESSON18_NODE_DELETE = 'gql18-delete';
export const LESSON18_NODE_END = 'gql18-end';
export const LESSON18_DELETE_NODE_SELECTOR =
  `.react-flow__node[data-id="${LESSON18_NODE_DELETE}"], ${GQL.WF_CANVAS_MUTATION_NODE}`;

export const LESSON18_CREATE_MUTATION =
  'mutation CreateUser($name: String!, $email: String!) {\n' +
  '  createUser(name: $name, email: $email) {\n' +
  '    id\n' +
  '    name\n' +
  '  }\n' +
  '}';

export const LESSON18_MUTATION_VARS =
  '{\n  "name": "{{testName}}",\n  "email": "demo@example.com"\n}';

export const LESSON18_GET_USER_QUERY =
  'query GetUser($id: ID!) {\n' +
  '  user(id: $id) {\n' +
  '    id\n' +
  '    name\n' +
  '  }\n' +
  '}';

/** No quotes around {{createdUserId}} — extraction stores JSON-serialized scalars. */
export const LESSON18_QUERY_VARS = '{\n  "id": {{createdUserId}}\n}';

export const LESSON18_DELETE_MUTATION =
  'mutation DeleteUser($id: ID!) {\n' +
  '  deleteUser(id: $id) {\n' +
  '    success\n' +
  '  }\n' +
  '}';

export const LESSON18_DELETE_VARS = '{\n  "id": {{createdUserId}}\n}';

export const LESSON18_EXTRACTION_JSONPATH = '$.createUser.id';
