import { formatTimestamp, highlightMatches, type LogLine } from '../utils/consoleLogUtils';

const PREFIX_CLASS: Record<string, string> = {
  '*': 'wf-cl-info',
  '>': 'wf-cl-out',
  '<': 'wf-cl-in',
  '#': 'wf-cl-extract',
  '!': 'wf-cl-error',
  '---': 'wf-cl-separator',
  '': 'wf-cl-plain',
};

const PREFIX_ICON: Record<string, string> = {
  '*': '●',
  '>': '→',
  '<': '←',
  '#': '⬡',
  '!': '✗',
  '---': '',
  '': '',
};

interface Props {
  line: LogLine;
  searchQuery?: string;
  isMatch?: boolean;
  isCurrentMatch?: boolean;
  onClick?: () => void;
  lineRef?: (el: HTMLDivElement | null) => void;
}

export default function ConsoleLogLine({ line, searchQuery, isMatch, isCurrentMatch, onClick, lineRef }: Props) {
  const cls = PREFIX_CLASS[line.prefix] ?? 'wf-cl-plain';
  const icon = PREFIX_ICON[line.prefix] ?? '';
  const time = formatTimestamp(line.ts);

  const depth = line.depth ?? 0;
  const indentStyle = depth > 0 ? { paddingLeft: `${depth * 16}px` } : undefined;

  return (
    <div
      ref={lineRef}
      className={`wf-cl-line ${cls}${isCurrentMatch ? ' wf-cl-line-current-match' : isMatch ? ' wf-cl-line-match' : ''}${onClick ? ' wf-cl-line-clickable' : ''}${depth > 0 ? ' wf-cl-line-nested' : ''}`}
      style={indentStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {time && <span className="wf-cl-ts">{time}</span>}
      {icon && <span className="wf-cl-icon">{icon}</span>}
      {line.nodeLabel && <span className="wf-cl-node-label">[{line.nodeLabel}]</span>}
      <span className="wf-cl-text">{searchQuery ? highlightMatches(line.text, searchQuery) : line.text}</span>
    </div>
  );
}
