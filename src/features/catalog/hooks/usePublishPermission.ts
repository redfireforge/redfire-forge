/**
 * Permission hook for gating publish/unpublish/republish actions.
 *
 * Currently returns all-true (no restrictions). When role-based access
 * control is introduced (multi-user shared repository), this hook will
 * check the user's role against the entry's access policy.
 *
 * Preview is always ungated — it's a user-local sandbox.
 */
export interface PublishPermission {
  canPublish: boolean;
  canUnpublish: boolean;
  canRepublish: boolean;
  /** Human-readable reason when any permission is denied. */
  reason?: string;
}

const ALL_ALLOWED: PublishPermission = {
  canPublish: true,
  canUnpublish: true,
  canRepublish: true,
};

export function usePublishPermission(_entryId: string): PublishPermission {
  return ALL_ALLOWED;
}
