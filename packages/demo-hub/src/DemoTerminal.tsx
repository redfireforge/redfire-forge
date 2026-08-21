/**
 * Demo Terminal — fake terminal surface for CLI-domain lessons.
 *
 * CLI lessons have no real app DOM to spotlight, so instead of `DemoSpotlight`
 * tracking a selector, these lessons render a pinned, real captured transcript
 * (`step.terminalCommand` / `step.terminalOutput`) in a terminal-styled window.
 * `terminalHighlightLines` is the terminal equivalent of `highlight` — it
 * emphasizes a line range within the output instead of a DOM rect.
 */
import { memo, useEffect, useMemo, useState } from 'react';

interface DemoTerminalProps {
  command?: string;
  output?: string;
  /** 1-based inclusive [start, end] line range(s) to visually emphasize — auto-cycles
   *  through multiple ranges when more than one is given. */
  highlightLines?: [number, number][];
}

/** How long each highlight range stays active before cycling to the next. */
const HIGHLIGHT_CYCLE_MS = 2500;

function isLineHighlighted(lineNumber: number, range?: [number, number]): boolean {
  if (!range) return false;
  const [start, end] = range;
  return lineNumber >= start && lineNumber <= end;
}

export default memo(function DemoTerminal({ command, output, highlightLines }: DemoTerminalProps) {
  const outputLines = useMemo(() => (output ? output.split('\n') : []), [output]);
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  useEffect(() => {
    setActiveRangeIndex(0);
    if (!highlightLines || highlightLines.length < 2) return;
    const interval = setInterval(() => {
      setActiveRangeIndex(i => (i + 1) % highlightLines.length);
    }, HIGHLIGHT_CYCLE_MS);
    return () => clearInterval(interval);
  }, [highlightLines]);

  if (!command && !output) return null;

  const activeRange = highlightLines?.[activeRangeIndex];

  return (
    <div className="demo-terminal" data-testid="demo-terminal">
      <div className="demo-terminal-titlebar">
        <span className="demo-terminal-dot demo-terminal-dot--red" aria-hidden="true" />
        <span className="demo-terminal-dot demo-terminal-dot--yellow" aria-hidden="true" />
        <span className="demo-terminal-dot demo-terminal-dot--green" aria-hidden="true" />
        <span className="demo-terminal-title">~/redfire-forge</span>
      </div>
      <div className="demo-terminal-body">
        {command && (
          <div className="demo-terminal-command-line">
            <span className="demo-terminal-prompt">$</span>
            <span className="demo-terminal-command">{command}</span>
          </div>
        )}
        {outputLines.length > 0 && (
          <pre className="demo-terminal-output">
            {outputLines.map((line, i) => (
              <div
                key={i}
                className={`demo-terminal-line${isLineHighlighted(i + 1, activeRange) ? ' demo-terminal-line--highlight' : ''}`}
              >
                {line.length === 0 ? '\u00A0' : line}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
});
