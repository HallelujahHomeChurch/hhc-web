/** Fit semantic one-line fields in their existing paper boxes; never rewrite text nodes. */
export function fitPaperLines(root: HTMLElement, headerBlockIds: ReadonlySet<string>, coverRows?: {worship: string[]; work: string[]}) {
  const restore: (() => void)[] = [];
  const remember = (element: HTMLElement) => {
    const original = element.getAttribute('style');
    restore.push(() => {if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original);});
  };
  for (const page of root.querySelectorAll<HTMLElement>('[data-bulletin-mode="paper"] [data-bulletin-page]')) {
    const row = (ids: string[]) => ids.flatMap(id => Array.from(page.querySelectorAll<HTMLElement>('[data-block-id]')).filter(element => element.dataset.blockId === id));
    const songs = row(coverRows?.worship ?? []);
    if (songs.length > 1) {
      const left = songs[0].offsetLeft, last = songs[songs.length - 1];
      const width = last.offsetLeft + last.offsetWidth - left;
      for (const song of songs) {remember(song); song.style.width = 'max-content'; song.style.whiteSpace = 'nowrap';}
      const total = songs.reduce((sum, song) => sum + song.offsetWidth, 0);
      const ratio = Math.min(1, width / total);
      const gap = Math.max(0, (width - total) / (songs.length - 1));
      let x = left;
      for (const song of songs) {
        song.style.left = `${x}px`;
        if (ratio < 1) {song.style.transformOrigin = 'left top'; song.style.transform = `scaleX(${ratio})`;}
        x += song.offsetWidth * ratio + gap;
      }
    }
    const work = row(coverRows?.work ?? []);
    const label = page.querySelector<HTMLElement>('[data-fixed-element="workLabel"]');
    if (label && work.length) {
      remember(label); label.style.width = 'max-content'; label.style.whiteSpace = 'nowrap';
      const left = label.offsetLeft + label.offsetWidth + parseFloat(getComputedStyle(label).fontSize);
      for (const point of work) {
        const right = point.offsetLeft + point.offsetWidth;
        remember(point); point.style.left = `${left}px`; point.style.width = `${right - left}px`;
      }
    }
    const date = page.querySelector<HTMLElement>('[data-fixed-element="date"]');
    const issue = page.querySelector<HTMLElement>('[data-fixed-element="issueNumber"]');
    if (date && issue && !page.closest('[data-reader-renderer="v8"], [data-reader-renderer="v9"]')) {
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
