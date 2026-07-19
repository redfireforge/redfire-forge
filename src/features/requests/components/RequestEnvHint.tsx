type Props = {
  hasBaseUrls: boolean;
  isOrphanSubCol: boolean;
};

export default function RequestEnvHint({ hasBaseUrls, isOrphanSubCol }: Props) {
  if (!hasBaseUrls && !isOrphanSubCol) {
    return (
      <span className="req-env-hint">Base URLs not configured — edit collection or sub-collection to add hostnames</span>
    );
  }
  if (isOrphanSubCol) {
    return (
      <span className="req-env-hint req-env-hint-warn" data-testid="req-subcol-orphan-warning">
        This sub-collection isn't linked to a configured environment — edit its settings to bind one.
      </span>
    );
  }
  return null;
}
