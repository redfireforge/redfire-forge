import type { ProfileTabLinkRef } from '../utils/profileTabUsage';
import { formatProfileTabLinksDisplay } from '../utils/profileTabUsage';

interface GraphqlProfileRowTabUsageProps {
  profileId: string;
  links: ProfileTabLinkRef[];
}

/** "Used by" tab pills on a saved connection profile row. */
export function GraphqlProfileRowTabUsage({ profileId, links }: GraphqlProfileRowTabUsageProps) {
  const { visible, overflowCount, summary } = formatProfileTabLinksDisplay(links);

  return (
    <div
      className="gql-profile-row__tab-usage"
      data-testid={`gql-profile-tab-usage-${profileId}`}
    >
      <span className="gql-profile-row__used-label">Used by</span>
      {links.length === 0 ? (
        <span className="gql-profile-row__unused-hint">Not linked to any tab</span>
      ) : (
        <div
          className="gql-profile-row__tab-pills"
          role="list"
          aria-label={`Tabs using this profile: ${summary}`}
        >
          {visible.map((link) => (
            <span
              key={link.tabId}
              role="listitem"
              className={`gql-profile-row__tab-pill${link.isActive ? ' gql-profile-row__tab-pill--active' : ''}`}
              data-testid={`gql-profile-tab-pill-${profileId}-${link.tabId}`}
              title={link.isActive ? `${link.label} — active tab` : link.label}
            >
              {link.isActive && (
                <span className="gql-profile-row__tab-pill-dot" aria-hidden="true" />
              )}
              {link.label}
            </span>
          ))}
          {overflowCount > 0 && (
            <span
              className="gql-profile-row__tab-pill gql-profile-row__tab-pill--more"
              title={summary}
            >
              +{overflowCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
