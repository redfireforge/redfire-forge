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

/** Simple markdown → HTML converter (bold, bullets, numbered, line breaks) */
function renderMarkdown(text: string): string {
  return text
    .split('\n\n')
    .map(paragraph => {
      // Check if it's a list
      const lines = paragraph.split('\n');
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
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
