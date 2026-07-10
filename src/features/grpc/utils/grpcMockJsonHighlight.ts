/**
 * Lightweight JSON syntax tokenizer for the mock rule JSON editor.
 * Returns an HTML string with <span> tags wrapping each token type.
 * No dependencies — pure string processing, safe for innerHTML via
 * entity-encoding all literal text before wrapping in spans.
 */

const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|([-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false)\b|(null)\b|([{}[\]:,])/g;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightJsonTokens(json: string): string {
  let result = '';
  let lastIndex = 0;

  JSON_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = JSON_TOKEN_RE.exec(json)) !== null) {
    // Append any non-matched text (whitespace, newlines) as plain escaped text
    if (match.index > lastIndex) {
      result += esc(json.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Key (string followed by colon)
      result += `<span class="grpc-json-key">${esc(match[1])}</span>`;
    } else if (match[2] !== undefined) {
      // String value
      result += `<span class="grpc-json-str">${esc(match[2])}</span>`;
    } else if (match[3] !== undefined) {
      // Number
      result += `<span class="grpc-json-num">${esc(match[3])}</span>`;
    } else if (match[4] !== undefined) {
      // Boolean
      result += `<span class="grpc-json-bool">${esc(match[4])}</span>`;
    } else if (match[5] !== undefined) {
      // Null
      result += `<span class="grpc-json-null">${esc(match[5])}</span>`;
    } else if (match[6] !== undefined) {
      // Punctuation
      result += `<span class="grpc-json-punc">${esc(match[6])}</span>`;
    }

    lastIndex = match.index + match[0].length;
  }

  // Append remaining text
  if (lastIndex < json.length) {
    result += esc(json.slice(lastIndex));
  }

  return result;
}
