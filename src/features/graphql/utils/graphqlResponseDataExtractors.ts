import type { GraphqlResponse } from '../../../shared/types/graphql';

/** Extract `data.user` when present — used for the compact demo spotlight card. */
export function getResponseDataUser(
  response: GraphqlResponse | null,
): Record<string, unknown> | null {
  if (!response?.data || typeof response.data !== 'object') return null;
  const user = (response.data as { user?: unknown }).user;
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  return user as Record<string, unknown>;
}

/** Extract `data.createUser` when present — used for the Mutations lesson spotlight card. */
export function getResponseDataCreateUser(
  response: GraphqlResponse | null,
): Record<string, unknown> | null {
  if (!response?.data || typeof response.data !== 'object') return null;
  const createUser = (response.data as { createUser?: unknown }).createUser;
  if (!createUser || typeof createUser !== 'object' || Array.isArray(createUser)) return null;
  return createUser as Record<string, unknown>;
}
