/** Concept Slide — renders rich concept content */
import type { ConceptContent } from './types';

interface ConceptSlideProps {
  concept: ConceptContent;
}

export default function ConceptSlide({ concept }: ConceptSlideProps) {
  return (
    <div className="demo-concept-slide">
      <h2 className="demo-concept-title">{concept.title}</h2>
      <div
        className="demo-concept-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(concept.body) }}
      />
      {concept.keyTerms && concept.keyTerms.length > 0 && (
        <div className="demo-concept-terms">
          <h4>Key Terms</h4>
          <div className="demo-concept-term-list">
            {concept.keyTerms.map(kt => (
              <span key={kt.term} className="demo-concept-term" title={kt.definition}>
                {kt.term}
              </span>
            ))}
          </div>
        </div>
      )}
      {concept.diagram && (
        <div
          className="demo-concept-diagram"
          dangerouslySetInnerHTML={{ __html: concept.diagram }}
        />
      )}
    </div>
  );
}

/** Simple markdown → HTML converter (bold, bullets, numbered, tables, fenced code, line breaks) */
// eslint-disable-next-line react-refresh/only-export-components
export function renderMarkdown(text: string): string {
  // ── Pre-pass: extract fenced code blocks ──────────────────────────────────
  // Fenced blocks span multiple \n\n boundaries so they must be handled before
  // the paragraph splitter runs. Replace each block with a safe placeholder,
  // render paragraphs, then substitute the rendered <pre><code> blocks back.
  const codeBlocks: string[] = [];
  const FENCE_RE = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  const withPlaceholders = text.replace(FENCE_RE, (_match, code: string) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n$/, '');
    codeBlocks.push(`<pre class="demo-concept-code"><code>${escaped}</code></pre>`);
    return `__CODEBLOCK_${codeBlocks.length - 1}__`;
  });

  const rendered = withPlaceholders
    .split('\n\n')
    .map(paragraph => {
      // If this paragraph is just a code block placeholder, pass it through unchanged
      // (the restoration step below will replace it with <pre><code>...)
      if (/^__CODEBLOCK_\d+__$/.test(paragraph.trim())) {
        return paragraph.trim();
      }

      const lines = paragraph.split('\n').filter(l => l.trim() !== '');

      // Check if it's (or contains) a Markdown table: a separator row of the
      // form |---|---| whose preceding line is the header row.
      const isSeparator = (l: string) => /\|/.test(l) && /^[\s|:-]+$/.test(l) && l.includes('-');
      const sepIdx = lines.findIndex((l, i) => i > 0 && isSeparator(l) && lines[i - 1].includes('|'));

      if (sepIdx > 0) {
        const leadingLines = lines.slice(0, sepIdx - 1); // any text before the header row
        const headerLine = lines[sepIdx - 1];
        const bodyLines = lines.slice(sepIdx + 1);

        const parseRow = (row: string): string[] => {
          const cells = row.split('|');
          if (cells.length && cells[0].trim() === '') cells.shift();
          if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
          return cells.map(cell => cell.trim());
        };

        const headers = parseRow(headerLine);
        const rows = bodyLines.map(parseRow);

        const thead = `<thead><tr>${headers.map(h => `<th>${inlineFormat(h)}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineFormat(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
        const table = `<table class="demo-concept-table">${thead}${tbody}</table>`;
        const lead = leadingLines.length
          ? `<p>${inlineFormat(leadingLines.join('<br/>'))}</p>`
          : '';
        return lead + table;
      }

      // Check if it's a list
      const isBulletList = lines.every(l => l.match(/^[-*]\s/) || l.trim() === '');
      const isNumberedList = lines.every(l => l.match(/^\d+\.\s/) || l.trim() === '');

      if (isBulletList) {
        const items = lines
          .filter(l => l.match(/^[-*]\s/))
          .map(l => `<li>${inlineFormat(l.replace(/^[-*]\s/, ''))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      if (isNumberedList) {
        const items = lines
          .filter(l => l.match(/^\d+\.\s/))
          .map(l => `<li>${inlineFormat(l.replace(/^\d+\.\s/, ''))}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${inlineFormat(paragraph.replace(/\n/g, '<br/>'))}</p>`;
    })
    .join('');

  // Restore fenced code blocks
  return rendered.replace(/__CODEBLOCK_(\d+)__/g, (_, i) => codeBlocks[Number(i)]);
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
