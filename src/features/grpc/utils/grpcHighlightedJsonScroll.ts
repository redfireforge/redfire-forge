export function syncHighlightedJsonScrollPosition(
  textarea: HTMLTextAreaElement | null,
  backdrop: HTMLPreElement | null,
): void {
  if (!textarea || !backdrop) return;
  backdrop.scrollTop = textarea.scrollTop;
  backdrop.scrollLeft = textarea.scrollLeft;
}
