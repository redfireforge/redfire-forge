import type { ConsoleLine } from '../../hooks/useResponseCache';

const prefixClass: Record<string, string> = {
  '*': 'wb-cl-info',
  '>': 'wb-cl-out',
  '<': 'wb-cl-in',
  '#': 'wb-cl-body',
  '': 'wb-cl-plain',
};

export default function ConsoleLog({ lines }: { lines: ConsoleLine[] }) {
  if (lines.length === 0) {
    return <div className="wb-response-placeholder">Send a request to see the trace</div>;
  }

  return (
    <div className="wb-console-log">
      {lines.map((line, i) => {
        const cls = prefixClass[line.prefix] ?? 'wb-cl-plain';
        const pfx = line.prefix ? `${line.prefix} ` : '';
        return (
          <div key={i} className={`wb-cl-line ${cls}`}>
            {pfx && <span className="wb-cl-prefix">{pfx}</span>}
            <span className="wb-cl-text">{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}
