import React from 'react';

export interface LogLine {
  prefix: string;
  text: string;
  ts: number;
  nodeId?: string;
  nodeLabel?: string;
  /** Nesting depth for sub-workflow lines (0 = root) */
  depth?: number;
}

export function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

export function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="wf-console-match">{part}</mark>
      : part,
  );
}

/**
 * Highlight the first occurrence of `query` in `text` using a `<mark>` tag.
 * Returns plain text if no match or empty query.
 */
export function highlightSearchMatch(text: string, query: string, className = 'search-highlight'): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={className}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
