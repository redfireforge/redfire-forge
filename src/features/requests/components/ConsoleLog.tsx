import type { ConsoleLine } from '../hooks/useResponseCache';

const prefixClass: Record<string, string> = {
  '*': 'req-cl-info',
  '>': 'req-cl-out',
  '<': 'req-cl-in',
  '#': 'req-cl-body',
  '': 'req-cl-plain',
};

export default function ConsoleLog({ lines }: { lines: ConsoleLine[] }) {
  if (lines.length === 0) {
    return <div className="req-response-placeholder">Send a request to see the trace</div>;
  }

  return (
    <div className="req-console-log" data-testid="req-console-log">
      {lines.map((line, i) => {
        const cls = prefixClass[line.prefix] ?? 'req-cl-plain';
        const pfx = line.prefix ? `${line.prefix} ` : '';
        return (
          <div key={i} className={`req-cl-line ${cls}`}>
            {pfx && <span className="req-cl-prefix">{pfx}</span>}
            <span className="req-cl-text">{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}
