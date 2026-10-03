/** Fit semantic one-line fields in their existing paper boxes; never rewrite text nodes. */
export function fitPaperLines(root: HTMLElement, creditBlockIds: ReadonlyMap<string, string>) {
  const restore: (() => void)[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('[data-bulletin-mode="paper"] [data-block-id]')) {
    if (!element.hasAttribute('data-body-title') && !creditBlockIds.has(element.dataset.blockId!)) continue;
    const original = element.getAttribute('style');
    const width = element.clientWidth, screenWidth = element.getBoundingClientRect().width;
    if (!width || !screenWidth) continue;
    restore.push(() => {if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original);});
    const labelName = creditBlockIds.get(element.dataset.blockId!);
    const label = labelName && element.closest('[data-bulletin-page]')?.querySelector<HTMLElement>(`[data-fixed-element="${labelName}"]`);
    if (label) element.style.top = label.style.top;
    element.style.whiteSpace = 'nowrap';
    element.style.minHeight = getComputedStyle(element).lineHeight;
    const text = root.ownerDocument.createRange();
    text.selectNodeContents(element);
    const textWidth = text.getBoundingClientRect().width;
    if (textWidth > screenWidth) {
      const ratio = screenWidth / textWidth;
      element.style.width = `${width / ratio}px`;
      element.style.transformOrigin = 'left top';
      element.style.transform = `scaleX(${ratio})`;
    }
  }
  return () => restore.forEach(reset => reset());
}
