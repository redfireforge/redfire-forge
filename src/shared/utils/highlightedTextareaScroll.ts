/** Keep a syntax-highlight backdrop aligned with its transparent textarea overlay. */
export function syncHighlightedTextareaScroll(
  textarea: HTMLTextAreaElement | null,
  backdrop: HTMLPreElement | null,
): void {
  if (!textarea || !backdrop) return;
  backdrop.scrollTop = textarea.scrollTop;
  backdrop.scrollLeft = textarea.scrollLeft;
}
