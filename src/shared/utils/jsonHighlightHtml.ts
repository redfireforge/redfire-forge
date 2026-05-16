export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightJsonHtml(json: string): string {
  return escapeHtml(json)
    .replace(
      /("(?:[^"\\]|\\.)*")\s*:/g,
      '<span class="json-hl-key">$1</span>:',
    )
    .replace(
      /:\s*("(?:[^"\\]|\\.)*")/g,
      (_m, val) => `: <span class="json-hl-str">${val}</span>`,
    )
    .replace(
      /:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      ': <span class="json-hl-num">$1</span>',
    )
    .replace(
      /:\s*(true|false|null)/g,
      ': <span class="json-hl-kw">$1</span>',
    );
}
