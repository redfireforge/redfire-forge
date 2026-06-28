/** Brief CSS ripple on demo lesson clicks — isolated to avoid lesson ↔ registry import cycles. */
export function showClickRipple(el: HTMLElement): void {
  const ring = document.createElement('div');
  ring.className = 'demo-click-ripple';
  const rect = el.getBoundingClientRect();
  ring.style.top = `${rect.top + rect.height / 2}px`;
  ring.style.left = `${rect.left + rect.width / 2}px`;
  document.body.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove());
}
