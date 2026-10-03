/** Fit semantic one-line fields in their existing paper boxes; never rewrite text nodes. */
export function fitPaperLines(root: HTMLElement, headerBlockIds: ReadonlySet<string>) {
  const restore: (() => void)[] = [];
  const remember = (element: HTMLElement) => {
    const original = element.getAttribute('style');
    restore.push(() => {if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original);});
  };
  for (const page of root.querySelectorAll<HTMLElement>('[data-bulletin-mode="paper"] [data-bulletin-page]')) {
    const date = page.querySelector<HTMLElement>('[data-fixed-element="date"]');
    const issue = page.querySelector<HTMLElement>('[data-fixed-element="issueNumber"]');
    if (date && issue) {
      remember(date); remember(issue);
      date.style.width = 'max-content';
      date.style.whiteSpace = 'nowrap';
      issue.style.left = `${date.offsetLeft + date.offsetWidth}px`;
      issue.style.top = date.style.top;
      issue.style.width = 'max-content';
      issue.style.whiteSpace = 'nowrap';
    }
    const blocks = Array.from(page.querySelectorAll<HTMLElement>('[data-block-id]'));
    const header = blocks.filter(block => headerBlockIds.has(block.dataset.blockId!));
    if (!header.length) continue;
    const body = blocks.filter(block => !headerBlockIds.has(block.dataset.blockId!));
    const bodyTop = Math.min(...body.map(block => parseFloat(block.style.top)));
    const shift = Math.max(0, bodyTop - Math.min(...header.map(block => parseFloat(block.style.top))));
    const labels = page.querySelectorAll<HTMLElement>('[data-fixed-element="lectureDateMarker"], [data-fixed-element="bodyIssueSummary"], [data-fixed-element="bodySpeakerLabel"], [data-fixed-element="transcriberLabel"], [data-fixed-element="editorLabel"], [data-fixed-element="topRule"]');
    for (const element of [...header, ...labels]) {remember(element); element.style.display = 'none';}
    for (const element of [...body, ...page.querySelectorAll<HTMLElement>('[data-fixed-element="speakerSeparator"]')]) {
      remember(element);
      element.style.top = `${parseFloat(element.style.top) - shift}%`;
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>('[data-bulletin-mode="paper"] [data-block-id]')) {
    if (!element.hasAttribute('data-body-title')) continue;
    const width = element.clientWidth, screenWidth = element.getBoundingClientRect().width;
    if (!width || !screenWidth) continue;
    remember(element);
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
  return () => restore.reverse().forEach(reset => reset());
}
