interface LiveApiBadgeProps {
  api: string;
  className?: string;
}

/**
 * Small badge showing the hostname of a live API endpoint.
 * Displays just the domain part (e.g. "jsonplaceholder.typicode.com").
 */
export function LiveApiBadge({ api, className = '' }: LiveApiBadgeProps) {
  let display: string;
  try {
    display = new URL(api).hostname;
  } catch {
    display = api;
  }
  return (
    <span className={`gallery-live-api-badge ${className}`.trim()} title={api}>
      🌐 {display}
    </span>
  );
}
